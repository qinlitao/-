import subprocess, time, json, sys, os, random, signal
import requests, websocket
sys.path.insert(0, os.path.expanduser(
    r"C:\Users\14250\.workbuddy\skills\web-article-collector\lib"))
from linkedin_feed import parse_feed_html

PROFILE = r"F:\WorkBuddy\2026-07-21-06-30-02\li_profile_copy"
EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9222
URL = "https://www.linkedin.com/company/gasturbinehub/posts/?feedView=all"
OUT = "linkedin_gasturbinehub.json"
MAX_POSTS = 30
SCROLL = 10

class CDP:
    def __init__(self, ws):
        self.ws = ws
        self._id = 0
        self._pending = {}
    def send(self, method, params=None, wait=True):
        self._id += 1
        msg = {"id": self._id, "method": method, "params": params or {}}
        self.ws.send(json.dumps(msg))
        if not wait:
            return None
        # 等该 id 的响应
        while True:
            raw = self.ws.recv()
            m = json.loads(raw)
            if m.get("id") == self._id:
                return m
            # 否则是事件，忽略
    def evaluate(self, expr):
        r = self.send("Runtime.evaluate",
                      {"expression": expr, "returnByValue": True,
                       "awaitPromise": True})
        return r.get("result", {}).get("result", {}).get("value")

def wait_endpoint(port, timeout=30):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            r = requests.get(f"http://127.0.0.1:{port}/json/version", timeout=3)
            if r.status_code == 200:
                return True
        except Exception:
            time.sleep(1)
    return False

def main():
    print("[cdp] 启动 msedge (headless, 复用登录态) ...", flush=True)
    proc = subprocess.Popen(
        [EXE, f"--remote-debugging-port={PORT}", f"--user-data-dir={PROFILE}",
         "--no-first-run", "--no-default-browser-check",
         "--disable-blink-features=AutomationControlled",
         "--headless=new", URL],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_endpoint(PORT):
            raise RuntimeError("CDP 端点未就绪（msedge 可能启动失败）")
        print("[cdp] CDP 端点就绪", flush=True)
        # 取 page target
        targets = requests.get(f"http://127.0.0.1:{PORT}/json", timeout=5).json()
        page = next((t for t in targets if t.get("type") == "page"), None)
        if not page:
            raise RuntimeError("未找到 page target")
        ws_url = page["webSocketDebuggerUrl"]
        ws = websocket.create_connection(ws_url, timeout=30)
        c = CDP(ws)
        c.send("Page.enable")
        c.send("Runtime.enable")
        print("[cdp] 已连接，等待页面加载 ...", flush=True)
        time.sleep(6)
        cur = c.evaluate("location.href")
        print("[cdp] 当前 URL:", cur, flush=True)
        # 滚动加载
        last = 0
        for i in range(SCROLL):
            c.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(random.uniform(2.0, 3.5))
            n = len(parse_feed_html(c.evaluate("document.documentElement.outerHTML") or ""))
            print(f"[cdp] 滚动 {i+1}/{SCROLL} 已抽 {n} 条", flush=True)
            if n >= MAX_POSTS:
                break
        html = c.evaluate("document.documentElement.outerHTML") or ""
        with open("linkedin_debug.html", "w", encoding="utf-8") as f:
            f.write(html)
        recs = parse_feed_html(html, source_name="LinkedIn")[:MAX_POSTS]
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(recs, f, ensure_ascii=False, indent=2, default=str)
        print(f"[cdp] 完成，采集 {len(recs)} 条 -> {OUT}", flush=True)
        ws.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    main()
