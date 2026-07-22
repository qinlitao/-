"""
LinkedIn 公司主页动态采集（完整流程）
======================================
1. 从 Edge Cookies 解密 LinkedIn 会话
2. HTTPS 请求公司主页动态
3. 解析文字 + 图片 + 时间戳
4. 输出 JSON

前提：Edge 已关闭（释放 Cookies 文件锁）
"""
import os, sys, json, base64, sqlite3, time, re, ctypes, ctypes.wintypes as wt
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from datetime import datetime, timezone, timedelta

WORK = Path(r"F:\WorkBuddy\2026-07-21-06-30-02")
COOKIES_DB = WORK / "cookies_edge.db"
LOCAL_STATE = WORK / "local_state.json"
BEIJING_TZ = timezone(timedelta(hours=8))

# ========== DPAPI + AES-GCM 解密 ==========

class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wt.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

def dpapi_decrypt(data):
    in_blob = DATA_BLOB(len(data), ctypes.create_string_buffer(data, len(data)))
    out_blob = DATA_BLOB()
    ok = ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob))
    if ok:
        result = ctypes.string_at(out_blob.pbData, out_blob.cbData)
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)
        return result
    return None

def get_aes_key():
    with open(LOCAL_STATE, "r", encoding="utf-8") as f:
        state = json.load(f)
    key_blob = base64.b64decode(state["os_crypt"]["encrypted_key"])
    # 关键：跳过 "DPAPI" 前缀（5 字节），解密后面的部分
    decrypted = dpapi_decrypt(key_blob[5:])
    return decrypted if decrypted else None

def decrypt_cookie(aes_key, enc_value):
    if enc_value[:3] not in (b"v10", b"v20"):
        return None
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = enc_value[3:15]
    ciphertext = enc_value[15:]
    return AESGCM(aes_key).decrypt(nonce, ciphertext, None).decode("utf-8", errors="replace")

# ========== LinkedIn 抓取 ==========

LINKEDIN_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

def fetch_linkedin_page(session, url, retries=3):
    """抓取 LinkedIn 页面，带重试"""
    for attempt in range(retries):
        try:
            r = session.get(url, headers=LINKEDIN_HEADERS, timeout=30, allow_redirects=True)
            if r.status_code == 200 and "login" not in r.url.lower():
                return r.text
            if "login" in r.url.lower():
                print(f"  ⚠️ 被导向登录页（会话可能过期）")
                return None
            print(f"  HTTP {r.status_code}，重试 {attempt+1}/{retries}")
        except Exception as e:
            print(f"  请求失败: {e}，重试 {attempt+1}/{retries}")
        time.sleep(2)
    return None

def parse_linkedin_posts(html, source_name="LinkedIn"):
    """解析 LinkedIn 动态页 HTML"""
    soup = BeautifulSoup(html, "lxml")
    posts = []

    # LinkedIn 公司动态页的文章/动态卡片
    # 主要容器：li.feed-shared-update-v2 或 article 元素
    cards = soup.select("li.feed-shared-update-v2")
    if not cards:
        cards = soup.select("article")
    if not cards:
        # fallback: 查找任何含 data-urn 的容器
        cards = soup.find_all(attrs={"data-urn": True})

    print(f"  找到 {len(cards)} 个动态卡片")

    for card in cards:
        post = {}

        # 提取文字内容
        # 主要文本容器
        text_el = card.select_one(".feed-shared-update-v2__description, "
                                   ".feed-shared-text, "
                                   ".break-words, "
                                   "[data-testid='feed-shared-main-href']")
        if text_el:
            post["text"] = text_el.get_text(separator="\n", strip=True)

        if not post.get("text"):
            # fallback: 查找所有段落
            paragraphs = card.find_all("span", class_="break-words")
            if paragraphs:
                post["text"] = "\n".join(p.get_text(strip=True) for p in paragraphs)

        if not post.get("text"):
            # 再 fallback: 任何有足够文本的 span
            for span in card.find_all("span"):
                t = span.get_text(strip=True)
                if len(t) > 50 and "activity" not in (span.get("class") or []):
                    post["text"] = t
                    break

        # 提取图片
        images = []
        for img in card.find_all("img"):
            src = img.get("src", "")
            if src and "ghost" not in src and "data:image" not in src:
                if src.startswith("//"):
                    src = "https:" + src
                images.append(src)
        # 也检查背景图
        for div in card.find_all(attrs={"style": True}):
            style = div["style"]
            bg_match = re.search(r'url\(["\']?(https?://[^"\')\s]+)', style)
            if bg_match:
                images.append(bg_match.group(1))
        if images:
            post["images"] = list(dict.fromkeys(images))  # 去重保序

        # 提取时间
        time_tag = card.find("time")
        if time_tag:
            dt_str = time_tag.get("datetime", "")
            if dt_str:
                post["time_raw"] = dt_str
                try:
                    dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                    post["time_utc"] = dt.isoformat()
                    post["time_beijing"] = dt.astimezone(BEIJING_TZ).strftime("%Y-%m-%d %H:%M")
                    post["time_confidence"] = "high"
                except:
                    post["time_confidence"] = "low"
            # 可见文本时间
            visible_time = time_tag.get_text(strip=True)
            if visible_time:
                post["time_visible"] = visible_time

        # 提取链接
        links = []
        for a in card.find_all("a", href=True):
            href = a["href"]
            if "linkedin.com" in href or "http" in href:
                if "feedUpdate" in href or "/posts/" in href or "/pulse/" in href:
                    links.append(href)
        if links:
            post["link"] = links[0]

        # 提取 URN（含精确时间信息的雪花 ID）
        urn = card.get("data-urn", "")
        if not urn:
            urn_tag = card.find(attrs={"data-urn": True})
            if urn_tag:
                urn = urn_tag.get("data-urn", "")
        if urn:
            post["urn"] = urn

        # 只保留有实质内容的卡片
        if post.get("text") or post.get("images"):
            posts.append(post)

    return posts


def main():
    company = "gasturbinehub"
    max_posts = 50
    url = f"https://www.linkedin.com/company/{company}/posts/?feedView=all"

    print("=" * 60)
    print(f"LinkedIn 采集: {company}")
    print("=" * 60)

    # Step 1: 解密 AES key
    print("\n[1/4] 解密 Edge AES key...")
    aes_key = get_aes_key()
    if not aes_key:
        print("❌ AES key 解密失败，请确保在本机原生终端运行")
        sys.exit(1)
    print(f"✅ AES key: {len(aes_key)} bytes")

    # Step 2: 解密 LinkedIn Cookies
    print("\n[2/4] 提取 LinkedIn Cookies...")
    conn = sqlite3.connect(str(COOKIES_DB))
    rows = conn.execute("""
        SELECT name, encrypted_value, host_key, path
        FROM cookies WHERE host_key LIKE '%linkedin%'
    """).fetchall()
    conn.close()

    cookie_jar = {}
    session = requests.Session()
    for name, enc_val, host, path in rows:
        val = decrypt_cookie(aes_key, enc_val)
        if val:
            cookie_jar[name] = val
            session.cookies.set(name, val, domain=".linkedin.com", path=path)

    print(f"  解密 {len(cookie_jar)} 个 Cookie")
    if "li_at" not in cookie_jar:
        print("  ⚠️ 缺少 li_at，可能不是活跃会话")
    else:
        print(f"  ✅ li_at 已就绪")

    # Step 3: 抓取公司主页动态
    print(f"\n[3/4] 抓取 {url} ...")
    html = fetch_linkedin_page(session, url)
    if not html:
        print("❌ 抓取失败（页面为空或被导向登录页）")
        # 保存原始响应供调试
        sys.exit(1)
    print(f"  页面大小: {len(html):,} bytes")

    # 保存原始 HTML
    debug_file = WORK / "linkedin_debug.html"
    with open(debug_file, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  原始 HTML 已保存: {debug_file}")

    # Step 4: 解析动态
    print(f"\n[4/4] 解析动态...")
    posts = parse_linkedin_posts(html, source_name=company)
    posts = posts[:max_posts]

    print(f"\n{'=' * 60}")
    print(f"共解析 {len(posts)} 条动态")
    for i, p in enumerate(posts[:5]):
        text_preview = (p.get("text") or "")[:80].replace("\n", " ")
        time_str = p.get("time_beijing") or p.get("time_visible") or "N/A"
        imgs = len(p.get("images", []))
        print(f"  [{i+1}] {time_str} | {text_preview}{'...' if len(text_preview)>=80 else ''}")
        if imgs:
            print(f"      📷 {imgs} 张图片")

    # 保存 JSON
    out_file = WORK / f"linkedin_{company}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 结果已保存: {out_file}")

    return posts


if __name__ == "__main__":
    main()
