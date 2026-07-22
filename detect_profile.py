import sqlite3, os
base = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\User Data")
for prof in ["Default", "Profile 1", "Profile 2"]:
    db = os.path.join(base, prof, "History")
    if not os.path.exists(db):
        print(prof, "无 History 文件"); continue
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro&immutable=1", uri=True)
        cur = con.cursor()
        cur.execute("SELECT url FROM urls WHERE url LIKE '%linkedin%' LIMIT 8")
        rows = cur.fetchall()
        con.close()
        print(prof, "-> linkedin 访问记录数:", len(rows))
        for (u,) in rows[:5]:
            print("    ", u[:100])
    except Exception as e:
        print(prof, "读取失败:", e)
