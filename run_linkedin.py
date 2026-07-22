import sys, os, json
sys.path.insert(0, os.path.expanduser(
    r"C:\Users\14250\.workbuddy\skills\web-article-collector\lib"))
from linkedin_feed import collect

URL = "https://www.linkedin.com/company/gasturbinehub/posts/?feedView=all"
PROFILE_COPY = r"F:\WorkBuddy\2026-07-21-06-30-02\li_profile_copy"

recs = collect(
    user_data_dir=PROFILE_COPY,
    url=URL,
    max_posts=30,
    scroll=10,
    out_json="linkedin_gasturbinehub.json",
    debug_html="linkedin_debug.html",
)
print("采集到动态数:", len(recs))
for r in recs[:30]:
    print(f"  {r.get('published_beijing')} | {r.get('confidence')} | {r.get('provenance')} | {r.get('title','')[:50]}")
