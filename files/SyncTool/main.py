"""
文件同步工具 - 入口文件
双击运行或 python main.py 启动 GUI
"""
import sys
import os

# 确保能找到同目录的模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gui_app import main

if __name__ == '__main__':
    main()
