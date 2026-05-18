@echo off
chcp 65001 >nul
title 文件同步工具
echo 正在启动文件同步工具...
python "%~dp0main.py"
pause
