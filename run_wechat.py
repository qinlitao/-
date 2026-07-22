import requests, json, sys, os, re
sys.path.insert(0, os.path.expanduser(
    r"C:\Users\14250\.workbuddy\skills\web-article-collector\lib"))
from wechat_parser import parse_wechat_article

URL = "https://mp.weixin.qq.com/s/LG-Acfzf8yaeY9Z-uAs4ow"
HDR = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"}
r = requests.get(URL, headers=HDR, timeout=30)
print("STATUS", r.status_code, "BYTES", len(r.content))
r.encoding = r.apparent_encoding
html = r.text
open("liurun_article.html", "w", encoding="utf-8").write(html)

# 提取 biz（公众号唯一标识，用于 wechat2rss 持续订阅）
m = re.search(r'var\s+biz\s*=\s*["\']([^"\']+)["\']', html)
biz = m.group(1) if m else None
print("BIZ =", biz)

rec = parse_wechat_article(html, URL,
    {"name": "刘润", "platform": "wechat", "default_tz": "Asia/Shanghai"})
rec["biz"] = biz
rec["source"] = "刘润(微信)"
rec["platform"] = "wechat"

with open("wechat_liurun.json", "w", encoding="utf-8") as f:
    json.dump(rec, f, ensure_ascii=False, indent=2, default=str)
print("\n=== 结构化记录 ===")
print(json.dumps({k: (v[:160] if isinstance(v, str) and len(v) > 160 else v)
                  for k, v in rec.items()}, ensure_ascii=False, indent=2, default=str))
