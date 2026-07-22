#!/bin/bash
cd "F:/WorkBuddy/2026-07-21-06-30-02"
PY="C:/Users/14250/.workbuddy/binaries/python/envs/default/Scripts/python.exe"

echo "等待你关闭 Edge（最多约 9 分钟）..."
for i in $(seq 1 108); do
  n=$(tasklist //FI "IMAGENAME eq msedge.exe" 2>/dev/null | grep -ci msedge)
  if [ "$n" -eq 0 ]; then echo "EDGE_CLOSED (iter $i)"; break; fi
  sleep 5
done
n=$(tasklist //FI "IMAGENAME eq msedge.exe" 2>/dev/null | grep -ci msedge)
if [ "$n" -ne 0 ]; then echo "EDGE_STILL_OPEN ($n) -> 未关闭，脚本退出，请关闭后重跑"; exit 1; fi

SRC="$LOCALAPPDATA/Microsoft/Edge/User Data/Default"
DST="F:/WorkBuddy/2026-07-21-06-30-02/li_profile_copy"
rm -rf "$DST"; mkdir -p "$DST"
echo "复制 Default profile（含登录态）到临时目录..."
robocopy "$SRC" "$DST" /E /R:3 /W:1 /XD "Cache" "Code Cache" "GPUCache" "Service Worker" "Crashpad" /NFL /NDL /NJH
echo "COPY_DONE"; ls -l "$DST/Network/Cookies" 2>&1 | head -n 1

echo "启动 LinkedIn 采集（会弹出一个用副本登录的 Edge 窗口）..."
"$PY" run_linkedin.py
echo "COLLECT_EXIT $?"
