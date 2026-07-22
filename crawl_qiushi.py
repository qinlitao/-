#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《求是》杂志 2026年 文章爬取 + 可编辑PDF生成
数据源: 求是网 qstheory.cn (公开、无需登录)
产出: 每篇文章一个可编辑(文字可选)PDF + 每期合订PDF + Markdown/JSON索引
"""
import os, re, sys, time, json, html as htmlmod, argparse, urllib.request, urllib.error
from urllib.parse import urljoin
from bs4 import BeautifulSoup

# ---------- 配置 ----------
BASE = "https://www.qstheory.cn"
MULU = BASE + "/qs/mulu.htm"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
DELAY = 0.5          # 请求间隔(秒)，礼貌限速
TIMEOUT = 30
RETRIES = 3

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "qiushi_2026")

# ---------- 网络 ----------
def fetch(url):
    last = None
    for i in range(RETRIES):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")

def norm(url, base=BASE):
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http"):
        return url
    return urljoin(base, url)

# ---------- 解析 ----------
def get_issue_toc_urls(year, start, end):
    """返回 {期号(int): 目录页url}"""
    html = fetch(MULU)
    soup = BeautifulSoup(html, "lxml")
    year_url = None
    for a in soup.find_all("a", href=True):
        if a.get_text(strip=True) == f"{year}年":
            year_url = norm(a["href"], MULU)
            break
    if not year_url:
        raise RuntimeError("未找到 %d 年索引链接" % year)
    html = fetch(year_url)
    soup = BeautifulSoup(html, "lxml")
    res = {}
    for a in soup.find_all("a", href=True):
        m = re.search(r"年第(\d+)期", a.get_text(strip=True))
        if m:
            no = int(m.group(1))
            if start <= no <= end:
                res[no] = norm(a["href"], year_url)
    return dict(sorted(res.items()))

ART_RE = re.compile(r"/(\d{8})/([0-9a-fA-F]+)/c\.html$")

def get_articles(toc_url):
    """从目录页提取文章链接 -> [(url, title)]"""
    html = fetch(toc_url)
    soup = BeautifulSoup(html, "lxml")
    # 期号/标签
    m = re.search(r"(\d{4})年第(\d+)期", soup.title.get_text() if soup.title else "")
    issue_label = m.group(0) if m else ""
    seen, out = set(), []
    for a in soup.find_all("a", href=True):
        h = a["href"]
        if not ART_RE.search(h):
            continue
        txt = a.get_text(strip=True)
        # 跳过空标题与“往期/其他期次”导航链接（形如《求是》2025年第X期）
        if not txt or re.search(r"年第\d+期", txt):
            continue
        u = norm(h, toc_url)
        if u in seen:
            continue
        seen.add(u)
        out.append((u, txt))
    return issue_label, out

def parse_article(url, html):
    soup = BeautifulSoup(html, "lxml")
    content = soup.select_one(".text") or soup.select_one(".content") or soup.body
    src = re.search(r"来源：《求是》\s*(\d+/\d+)", html)
    source = src.group(1) if src else ""
    app = content.select_one(".appellation")
    author = app.get_text(strip=True) if app else ""
    pt = content.select_one(".pubtime")
    date = pt.get_text(strip=True) if pt else ""
    h1 = content.find(["h1", "h2"])
    title = h1.get_text(strip=True) if h1 else (
        soup.title.get_text(strip=True).replace(" - 求是网", "") if soup.title else "")
    for el in content.select(".appellation, .pubtime"):
        el.decompose()
    if h1:
        h1.decompose()
    paras = []
    for tag in content.find_all(["p", "h2", "h3", "h4", "li"]):
        t = tag.get_text(strip=True)
        if t:
            paras.append(t)
    if not paras:
        txt = content.get_text("\n", strip=True)
        paras = [l for l in txt.split("\n") if l]
    return {"title": title, "author": author, "date": date,
            "source": source, "body": "\n".join(paras), "url": url}

# ---------- 文件名 ----------
def slugify(s, maxlen=40):
    s = re.sub(r'[\\/:*?"<>|\r\n\t]', "_", s)
    s = re.sub(r"\s+", "_", s).strip("._")
    return s[:maxlen] or "untitled"

# ---------- PDF ----------
def build_pdf(articles, out_path, doc_title=""):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak)
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    FONT = "STSong-Light"
    try:
        pdfmetrics.registerFont(UnicodeCIDFont(FONT))
    except Exception:
        pass
    def esc(t):
        return htmlmod.escape(t).replace("\n", "<br/>")
    ts = ParagraphStyle("T", fontName=FONT, fontSize=15, leading=21, spaceAfter=8)
    ms = ParagraphStyle("M", fontName=FONT, fontSize=9, leading=13, spaceAfter=4)
    bs = ParagraphStyle("B", fontName=FONT, fontSize=11, leading=18,
                        spaceAfter=6, wordWrap="CJK")
    doc = SimpleDocTemplate(out_path, pagesize=A4, title=doc_title,
                            topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2*cm, rightMargin=2*cm)
    story = []
    for i, a in enumerate(articles):
        story.append(Paragraph(esc(a["title"]), ts))
        meta = "作者：%s　来源：《求是》%s　%s" % (a["author"], a["source"], a["date"])
        story.append(Paragraph(esc(meta), ms))
        story.append(Spacer(1, 6))
        for para in a["body"].split("\n"):
            if para.strip():
                story.append(Paragraph(esc(para), bs))
        if i < len(articles) - 1:
            story.append(PageBreak())
    doc.build(story)

# ---------- 主流程 ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=14)
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        os.makedirs(OUT, exist_ok=True)
        sample = [{"title": "自测：在庆祝中国共产党成立105周年大会上的讲话",
                   "author": "习近平", "source": "2026/14", "date": "2026-07-15 15:00:50",
                   "body": "同志们，朋友们：\n今天，我们隆重集会。\n（2026年7月1日）\n——矢志追求真理，始终把准前进方向。\n这段文字用于验证中文字体是否能正常嵌入并可被选中复制。"}]
        p = os.path.join(OUT, "selftest.pdf")
        build_pdf(sample, p, "selftest")
        print("SELFTEST_OK", p, os.path.getsize(p))
        return

    os.makedirs(OUT, exist_ok=True)
    pdf_dir = os.path.join(OUT, "pdf")
    txt_dir = os.path.join(OUT, "text")
    os.makedirs(pdf_dir, exist_ok=True)
    os.makedirs(txt_dir, exist_ok=True)

    manifest = []
    toc = get_issue_toc_urls(args.year, args.start, args.end)
    print("发现期次:", sorted(toc.keys()))
    for no in sorted(toc.keys()):
        turl = toc[no]
        issue_label, articles = get_articles(turl)
        print(f"[{issue_label}] 目录链接 {len(articles)} 篇")
        idir_pdf = os.path.join(pdf_dir, "issue_%04d_%02d" % (args.year, no))
        idir_txt = os.path.join(txt_dir, "issue_%04d_%02d" % (args.year, no))
        os.makedirs(idir_pdf, exist_ok=True)
        os.makedirs(idir_txt, exist_ok=True)
        issue_articles = []
        seen_slug = {}
        for idx, (aurl, atitle) in enumerate(articles, 1):
            slug = slugify(atitle)
            if slug in seen_slug:
                seen_slug[slug] += 1
                slug = "%s_%d" % (slug, seen_slug[slug])
            else:
                seen_slug[slug] = 1
            pdf_path = os.path.join(idir_pdf, slug + ".pdf")
            md_path = os.path.join(idir_txt, slug + ".md")
            if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
                # 已存在则跳过下载，但仍登记
                rec = {"issue": issue_label, "issue_no": no, "title": atitle,
                       "url": aurl, "pdf": pdf_path, "md": md_path}
                issue_articles.append(rec)
                manifest.append(rec)
                continue
            try:
                html = fetch(aurl)
                art = parse_article(aurl, html)
                # 若目录标题为空，用正文标题
                if not atitle:
                    atitle = art["title"]
                art["title"] = atitle
            except Exception as e:
                print("  ! 失败 %s : %s" % (aurl, e))
                continue
            # Markdown
            md = "# %s\n\n- 作者：%s\n- 来源：《求是》%s\n- 日期：%s\n- 原文：%s\n\n%s\n" % (
                art["title"], art["author"], art["source"], art["date"], aurl, art["body"])
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md)
            # 单篇 PDF
            try:
                build_pdf([art], pdf_path, art["title"])
            except Exception as e:
                print("  ! PDF失败 %s : %s" % (aurl, e))
            rec = {"issue": issue_label, "issue_no": no, "title": art["title"],
                   "author": art["author"], "date": art["date"],
                   "source": art["source"], "url": aurl,
                   "pdf": pdf_path, "md": md_path,
                   "chars": len(art["body"])}
            issue_articles.append(rec)
            manifest.append(rec)
            if idx % 5 == 0:
                print("    ...已处理 %d/%d" % (idx, len(articles)))
            time.sleep(DELAY)
        # 合订 PDF
        if issue_articles:
            combined = os.path.join(idir_pdf, "%04d-%02d_合订.pdf" % (args.year, no))
            arts = [{"title": r["title"],
                     "author": r.get("author", ""),
                     "source": r.get("source", ""),
                     "date": r.get("date", ""),
                     "body": open(r["md"], encoding="utf-8").read().split("\n\n", 1)[-1]} 
                    for r in issue_articles]
            try:
                build_pdf(arts, combined, issue_label)
                print("  合订PDF ->", combined)
            except Exception as e:
                print("  ! 合订PDF失败:", e)
        time.sleep(DELAY)

    # 索引
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUT, "index.csv"), "w", encoding="utf-8-sig") as f:
        f.write("期次,期号,标题,作者,日期,来源,字数,PDF路径,原文链接\n")
        for r in manifest:
            f.write("%s,%s,%s,%s,%s,%s,%s,%s,%s\n" % (
                r.get("issue",""), r.get("issue_no",""), r.get("title",""),
                r.get("author",""), r.get("date",""), r.get("source",""),
                r.get("chars",""), r.get("pdf",""), r.get("url","")))
    # README
    with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as f:
        f.write("# 《求是》杂志 %d年 文章采集\n\n" % args.year)
        f.write("- 范围：%d年第%d期 — 第%d期（四中全会以后，共%d期）\n" % (
            args.year, args.start, args.end, args.end-args.start+1))
        f.write("- 数据源：求是网 qstheory.cn（公开内容）\n")
        f.write("- 文章总数：%d\n" % len(manifest))
        f.write("- 产出：\n  - `pdf/issue_YYYY_NN/` 每篇文章一个**文字可选/可编辑**PDF + 该期`合订.pdf`\n")
        f.write("  - `text/issue_YYYY_NN/` 每篇文章 Markdown（含元数据，便于入库）\n")
        f.write("  - `index.json` / `index.csv` 结构化索引\n\n")
        f.write("> 说明：求是网不直接提供文章PDF，本批PDF由提取到的正文重新排版生成，")
        f.write("文字层可选中复制，适合作为知识库材料。请遵守《求是》杂志版权与转载规定，仅用于个人学习研究。\n")
    print("DONE. 文章总数=%d 索引=%s" % (len(manifest), os.path.join(OUT, "index.json")))

if __name__ == "__main__":
    main()
