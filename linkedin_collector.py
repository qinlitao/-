"""
LinkedIn 公司主页动态采集器（自包含，本机运行）
=================================================
支持 Edge v127+ App-Bound Encryption 自动降级。

用法：
  python linkedin_collector.py --company gasturbinehub
  python linkedin_collector.py --company gasturbinehub --li_at "你的li_at值"

第一次运行会尝试自动解密 Edge Cookies。
如果 Edge 是 v127+（App-Bound Encryption），会引导你手动粘贴 li_at 值。
之后每次运行只需粘一次，会缓存到本地文件。
"""
import os, sys, json, sqlite3, base64, time, re, argparse, subprocess
from pathlib import Path
from datetime import datetime, timezone, timedelta

# ========== 自动安装依赖 ==========
def ensure_deps():
    needed = []
    for mod, pkg in [("requests", "requests"), ("bs4", "beautifulsoup4"),
                     ("lxml", "lxml"), ("cryptography", "cryptography")]:
        try:
            __import__(mod)
        except ImportError:
            needed.append(pkg)
    if needed:
        print(f"[setup] 安装: {', '.join(needed)} ...", flush=True)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *needed])
        print("[setup] 完成", flush=True)

ensure_deps()

import requests
from bs4 import BeautifulSoup

# ========== 配置 ==========
WORK = Path(__file__).parent
COOKIE_CACHE = WORK / "li_session.json"
BEIJING_TZ = timezone(timedelta(hours=8))
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0")

# ========== DPAPI + AES-GCM 解密（三种路径） ==========
import ctypes
import ctypes.wintypes as wt

class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wt.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

def _dpapi_decrypt(data, flags=1):
    """CryptUnprotectData。flags=1 (CRYPTPROTECT_UI_FORBIDDEN)"""
    in_blob = DATA_BLOB(len(data), ctypes.create_string_buffer(data, len(data)))
    out_blob = DATA_BLOB()
    desc = ctypes.c_wchar_p()
    ok = ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(in_blob), ctypes.byref(desc), None,
        None, None, flags, ctypes.byref(out_blob))
    if not ok:
        return None
    result = ctypes.string_at(out_blob.pbData, out_blob.cbData)
    ctypes.windll.kernel32.LocalFree(out_blob.pbData)
    if desc:
        ctypes.windll.kernel32.LocalFree(desc)
    return result

def _get_v10_key():
    """路径 A: 旧版 encrypted_key → DPAPI → AES key（适用于 Edge < v127）"""
    ls = os.path.join(os.environ["LOCALAPPDATA"], r"Microsoft\Edge\User Data\Local State")
    with open(ls, "r", encoding="utf-8") as f:
        state = json.load(f)
    key_blob = base64.b64decode(state["os_crypt"]["encrypted_key"])
    decrypted = _dpapi_decrypt(key_blob[5:])  # 跳过 "DPAPI" 前缀
    return decrypted if decrypted and len(decrypted) == 32 else None

def _try_decrypt_with_key(aes_key, enc_val):
    """用 AES key 尝试解密 v20 cookie"""
    if enc_val[:3] not in (b"v10", b"v20"):
        return None
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = enc_val[3:15]
    ct_tag = enc_val[15:]
    return AESGCM(aes_key).decrypt(nonce, ct_tag, None).decode("utf-8", errors="replace")

def _extract_cookies_with_key(aes_key, profile="Default"):
    """用给定 AES key 解密所有 LinkedIn cookies"""
    db = os.path.join(os.environ["LOCALAPPDATA"],
                      rf"Microsoft\Edge\User Data\{profile}\Network\Cookies")
    conn = sqlite3.connect(db)
    rows = conn.execute(
        "SELECT name, encrypted_value FROM cookies WHERE host_key LIKE '%linkedin%'"
    ).fetchall()
    conn.close()
    cookies = {}
    for name, enc in rows:
        try:
            cookies[name] = _try_decrypt_with_key(aes_key, enc)
        except Exception:
            pass
    return cookies

def try_automatic_decrypt(profile="Default"):
    """尝试自动解密，返回 (cookies_dict, method_string) 或 (None, reason)"""
    # 路径 A: 旧版 encrypted_key
    aes_key = _get_v10_key()
    if aes_key:
        cookies = _extract_cookies_with_key(aes_key, profile)
        if "li_at" in cookies:
            return cookies, "v10_key (旧版 DPAPI)"

    # 路径 B: 直接 DPAPI 解密 li_at（Chrome < v80 方式）
    db = os.path.join(os.environ["LOCALAPPDATA"],
                      rf"Microsoft\Edge\User Data\{profile}\Network\Cookies")
    conn = sqlite3.connect(db)
    row = conn.execute(
        "SELECT encrypted_value FROM cookies WHERE name='li_at' LIMIT 1"
    ).fetchone()
    conn.close()
    if row:
        enc = row[0]
        if enc[:3] not in (b"v10", b"v20"):
            raw = _dpapi_decrypt(enc)
            if raw:
                return {"li_at": raw.decode("utf-8", errors="replace")}, "direct_DPAPI"

    # 路径 C: 尝试 browser_cookie3（如果可用且支持）
    try:
        import browser_cookie3
        cj = browser_cookie3.edge(domain_name=".linkedin.com")
        cookies = {c.name: c.value for c in cj if "linkedin" in c.domain}
        if "li_at" in cookies:
            return cookies, "browser_cookie3"
    except Exception:
        pass

    reason = "Edge v127+ App-Bound Encryption" if aes_key else "无法获取 AES key"
    return None, reason

# ========== 手动 Cookie 输入 ==========
def prompt_manual_cookie():
    """引导用户手动粘贴 li_at 值"""
    print("\n" + "=" * 60)
    print("需要手动提供 LinkedIn 会话 Cookie")
    print("=" * 60)
    print("""
步骤（约30秒）：
  1. 打开 Edge，确保已登录 LinkedIn
  2. 按 F12 打开开发者工具
  3. 切到 Application（应用程序）标签
  4. 左侧 Cookies → https://www.linkedin.com
  5. 找到 li_at 这一行，双击 Value 列，全选复制
  6. 回到这里粘贴
""")
    li_at = input("请粘贴 li_at 值: ").strip()
    if not li_at:
        print("未输入，退出")
        sys.exit(1)
    return li_at

def save_session(cookies):
    """缓存 session 到本地文件"""
    with open(COOKIE_CACHE, "w", encoding="utf-8") as f:
        json.dump({"cookies": cookies, "saved_at": datetime.now().isoformat()}, f,
                  ensure_ascii=False, indent=2)

def load_cached_session():
    """读取缓存的 session"""
    if not COOKIE_CACHE.exists():
        return None
    try:
        data = json.load(open(COOKIE_CACHE, encoding="utf-8"))
        return data.get("cookies")
    except Exception:
        return None

# ========== LinkedIn 请求与解析 ==========
def fetch_page(url, cookies):
    """带 Cookie 请求 LinkedIn 页面"""
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
    })
    for name, val in cookies.items():
        session.cookies.set(name, val, domain=".linkedin.com", path="/")
        session.cookies.set(name, val, domain=".www.linkedin.com", path="/")

    for attempt in range(3):
        try:
            r = session.get(url, timeout=30, allow_redirects=True)
            if r.status_code == 200 and "login" not in r.url.lower():
                return r.text
            if "login" in r.url.lower():
                print(f"  ⚠️ 被导向登录页 — Cookie 可能已过期")
                return None
            print(f"  HTTP {r.status_code}，重试 {attempt+1}/3")
        except Exception as e:
            print(f"  请求失败: {e}，重试 {attempt+1}/3")
        time.sleep(2)
    return None

def parse_posts(html, company):
    """解析 LinkedIn 动态"""
    soup = BeautifulSoup(html, "lxml")
    posts = []

    cards = soup.select("li.feed-shared-update-v2")
    if not cards:
        cards = soup.select("article")
    if not cards:
        cards = soup.find_all(attrs={"data-urn": True})

    for card in cards:
        post = {}

        # 文字
        text_el = (card.select_one(".feed-shared-update-v2__description") or
                   card.select_one(".feed-shared-text") or
                   card.select_one(".break-words"))
        if text_el:
            post["text"] = text_el.get_text(separator="\n", strip=True)
        if not post.get("text"):
            for span in card.find_all("span", class_="break-words"):
                t = span.get_text(strip=True)
                if len(t) > 30:
                    post["text"] = t
                    break

        # 图片
        images = []
        for img in card.find_all("img", src=True):
            src = img["src"]
            if src and "ghost" not in src and "data:image" not in src:
                if src.startswith("//"):
                    src = "https:" + src
                images.append(src)
        if images:
            post["images"] = list(dict.fromkeys(images))

        # 时间
        time_tag = card.find("time")
        if time_tag and time_tag.get("datetime"):
            try:
                dt = datetime.fromisoformat(time_tag["datetime"].replace("Z", "+00:00"))
                post["time_utc"] = dt.isoformat()
                post["time_beijing"] = dt.astimezone(BEIJING_TZ).strftime("%Y-%m-%d %H:%M")
            except Exception:
                pass

        # 链接
        for a in card.find_all("a", href=True):
            if "/posts/" in a["href"] or "activity" in a["href"]:
                href = a["href"]
                post["link"] = href if href.startswith("http") else "https://www.linkedin.com" + href
                break

        if post.get("text") or post.get("images"):
            posts.append(post)

    return posts

# ========== 输出 ==========
def save_results(posts, company):
    """保存 JSON + Markdown"""
    json_path = WORK / f"linkedin_{company}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)

    md_path = WORK / f"linkedin_{company}.md"
    lines = [f"# LinkedIn 动态 — {company}\n", f"共 {len(posts)} 条\n"]
    for i, p in enumerate(posts, 1):
        lines.append(f"## {i}. {(p.get('text') or '')[:80]}")
        if p.get("time_beijing"):
            lines.append(f"时间：{p['time_beijing']}（北京时间）")
        if p.get("link"):
            lines.append(f"链接：{p['link']}")
        if p.get("images"):
            lines.append(f"图片：{len(p['images'])} 张")
            for img in p["images"][:3]:
                lines.append(f"  ![]({img})")
        lines.append("")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return json_path, md_path

# ========== 主流程 ==========
def main():
    parser = argparse.ArgumentParser(description="LinkedIn 公司主页动态采集器")
    parser.add_argument("--company", required=True, help="公司 slug")
    parser.add_argument("--max", type=int, default=50, help="最大条数")
    parser.add_argument("--profile", default="Default", help="Edge profile")
    parser.add_argument("--li_at", help="直接提供 li_at 值（跳过自动解密）")
    parser.add_argument("--no-cache", action="store_true", help="不使用缓存的 session")
    args = parser.parse_args()

    print("=" * 60)
    print(f"LinkedIn 采集: {args.company}")
    print("=" * 60)

    # 获取 cookies
    cookies = None

    # 1) 检查命令行参数
    if args.li_at:
        cookies = {"li_at": args.li_at}
        print("[1] 使用命令行提供的 li_at")

    # 2) 尝试缓存
    if not cookies and not args.no_cache:
        cached = load_cached_session()
        if cached and "li_at" in cached:
            cookies = cached
            print("[1] 使用缓存的 session")

    # 3) 尝试自动解密
    if not cookies:
        print("[1] 尝试自动解密 Edge Cookies ...")
        auto_cookies, method = try_automatic_decrypt(args.profile)
        if auto_cookies and "li_at" in auto_cookies:
            cookies = auto_cookies
            print(f"  ✅ 自动解密成功 ({method})，提取到 {len(cookies)} 个 Cookie")
        else:
            print(f"  ❌ 自动解密失败: {method}")

    # 4) 手动输入
    if not cookies or "li_at" not in cookies:
        li_at = prompt_manual_cookie()
        cookies = {"li_at": li_at}
        # 尝试获取其他 cookie
        print("  补充其他 LinkedIn cookies ...")
        auto_cookies, _ = try_automatic_decrypt(args.profile)
        if auto_cookies:
            cookies.update(auto_cookies)
        save_session(cookies)
        print("  ✅ Session 已缓存，下次无需重复输入")

    print(f"  li_at: {cookies['li_at'][:30]}...")

    # 抓取
    url = f"https://www.linkedin.com/company/{args.company}/posts/?feedView=all"
    print(f"\n[2] 抓取 {url}")
    html = fetch_page(url, cookies)
    if not html:
        print("❌ 抓取失败")
        sys.exit(1)
    print(f"  页面: {len(html):,} bytes")

    # 保存调试 HTML
    (WORK / "linkedin_debug.html").write_text(html, encoding="utf-8")

    # 解析
    print(f"\n[3] 解析动态 ...")
    posts = parse_posts(html, args.company)
    posts = posts[:args.max]
    print(f"  解析到 {len(posts)} 条")

    # 保存
    print(f"\n[4] 保存 ...")
    json_path, md_path = save_results(posts, args.company)
    print(f"  JSON: {json_path}")
    print(f"  Markdown: {md_path}")

    # 预览
    for i, p in enumerate(posts[:5], 1):
        text = (p.get("text") or "")[:80].replace("\n", " ")
        time_str = p.get("time_beijing", "N/A")
        imgs = len(p.get("images", []))
        print(f"\n  [{i}] {time_str} | {text}")
        if imgs:
            print(f"      📷 {imgs} 张图片")

    print(f"\n{'=' * 60}")
    print(f"✅ 完成: {len(posts)} 条已输出到 {json_path}")

if __name__ == "__main__":
    main()
