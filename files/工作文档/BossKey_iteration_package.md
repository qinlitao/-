# Iteration Package 执行包模板
# 适用：Claude Code + DeepSeek V4 Pro
# 使用方式：将「可整段复制到 Claude Code」标注下方的内容，整段粘贴到 Claude Code 对话框

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
以下内容可整段复制到 Claude Code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. Context（项目背景）

- Project Name：BossKey 老板键程序
- Tech Stack：Python 3.10+, PyQt5, pywin32, keyboard, PyInstaller
- Platform / OS：Windows 10/11
- Current State：全新项目，从零开始实现

---

## 2. Current Goal（本次目标）

- Goal（一句话）：实现一个 Windows 老板键程序，支持快捷键切换应用、动态规则配置、托盘常驻、开机自启，并能打包为单个 .exe 文件
- In Scope（本次做什么）：
  - 窗口管理模块（最小化/还原/置顶）
  - 规则管理模块（JSON 持久化）
  - 全局快捷键监听（含切换状态）
  - PyQt5 设置界面（增删改规则）
  - 系统托盘图标（常驻后台、开机自启）
  - 程序入口与模块初始化
  - PyInstaller 打包配置（单文件 .exe）
- Out of Scope（本次不做什么）：
  - 快捷键录制模式（用户手动输入文本即可）
  - 进程选择器 UI
  - 多用户配置隔离
  - 快捷键冲突检测

---

## 3. Global Constraints（全局约束）

- Language：Python 3.10+
- Runtime / Framework：PyQt5
- OS 限制：仅 Windows，不需要跨平台
- 依赖约束（允许的第三方库）：pywin32, keyboard, PyQt5, PyInstaller
- 其他约束：
  - 配置文件路径：打包后使用 sys._MEIPASS 兼容路径，运行时 config/rules.json 存放在可执行文件同目录
  - keyboard 库在某些系统需要管理员权限，打包时 manifest 中请求管理员权限
  - PyInstaller 打包目标：--onefile --windowed --icon=assets/icon.ico（icon 文件需一并创建占位）

---

## 4. Implementation Tasks（实现任务）

> 请按顺序依次完成以下任务。

### TASK-001：窗口管理模块

- GOAL：封装所有 Win32 窗口操作，提供最小化、还原、置顶、枚举接口
- FILES TO CREATE / EDIT：
  - `window_manager.py`
- CONSTRAINTS：
  - 使用 pywin32（win32gui, win32con, win32process）
  - 实现以下方法：
    - get_all_visible_windows() → 返回当前所有可见非最小化窗口的 hwnd 列表，过滤无标题、任务栏、托盘等系统窗口
    - minimize_windows(hwnd_list) → 最小化指定 hwnd 列表
    - restore_windows(hwnd_list) → 还原指定 hwnd 列表
    - find_windows_by_process_name(name: str) → 按进程名（如 WeChat.exe）查找所有匹配窗口 hwnd 列表
    - bring_to_front(hwnd) → 将窗口置顶并聚焦（使用 SetForegroundWindow）
  - 不引入除 pywin32 外的额外依赖
- VERIFY：在 Python shell 中导入并调用 get_all_visible_windows()，能返回当前打开的普通应用窗口句柄列表，不含系统窗口

---

### TASK-002：规则管理模块

- GOAL：实现快捷键与目标应用绑定规则的 CRUD，并持久化到 JSON 文件
- FILES TO CREATE / EDIT：
  - `rule_manager.py`
  - `config/rules.json`（自动创建）
- CONSTRAINTS：
  - 每条规则数据结构：
    { "id": "<uuid>", "hotkey": "ctrl+alt+1", "apps": ["WeChat.exe", "chrome.exe"], "name": "工作模式" }
  - 实现方法：load_rules(), save_rules(rules), add_rule(name, hotkey, apps), delete_rule(rule_id), update_rule(rule_id, data)
  - config/ 目录不存在时自动创建，rules.json 不存在时初始化为空列表 []
  - 打包兼容：配置文件读写路径使用可执行文件同目录（os.path.dirname(sys.executable) 或 os.path.abspath(".")），而非 sys._MEIPASS
- VERIFY：调用 add_rule() 后 rules.json 出现对应条目；调用 delete_rule() 后条目消失；重启程序后数据仍存在

---

### TASK-003：全局快捷键监听模块

- GOAL：注册全局快捷键，实现「首次触发 → 切换」「再次触发 → 还原」的状态机逻辑
- FILES TO CREATE / EDIT：
  - `hotkey_manager.py`
- CONSTRAINTS：
  - 使用 keyboard 库注册/注销热键
  - 内部维护状态字典：{ "ctrl+alt+1": { "active": False, "minimized_hwnds": [] } }
  - 触发逻辑：
    1. active == False 时：
       a. 调用 get_all_visible_windows() 记录当前所有可见窗口到 minimized_hwnds
       b. 调用 minimize_windows(minimized_hwnds)
       c. 找到目标应用的所有窗口并调用 bring_to_front()
       d. 设 active = True
    2. active == True 时：
       a. 调用 restore_windows(minimized_hwnds)
       b. 清空 minimized_hwnds，设 active = False
  - 提供 register_all(rules) 和 unregister_all() 方法，用于规则变更时刷新热键注册
  - hotkey_manager 持有 window_manager 实例作为依赖注入
- VERIFY：运行程序后按下已配置快捷键，目标应用置前其他最小化；再按一次所有窗口还原

---

### TASK-004：PyQt5 设置界面

- GOAL：实现规则管理的图形界面，支持新增、编辑、删除规则，并包含开机自启选项
- FILES TO CREATE / EDIT：
  - `ui/settings_window.py`
  - `ui/__init__.py`（空文件）
- CONSTRAINTS：
  - 主界面：QTableWidget 展示规则列表，列：规则名称、快捷键、目标应用
  - 操作按钮：「新增规则」「编辑规则」「删除规则」（编辑/删除需先选中行）
  - 新增/编辑使用 QDialog 弹窗，字段：
    - 规则名称（QLineEdit）
    - 快捷键（QLineEdit，placeholder: ctrl+alt+1）
    - 目标应用（支持多个进程名，每行一个，使用 QPlainTextEdit）
  - 底部「开机自启」QCheckBox，状态读写调用 TASK-005 的 get_autostart_status() 和 set_autostart()
  - 保存规则后立即调用 hotkey_manager.unregister_all() + register_all(new_rules) 刷新热键
  - SettingsWindow 通过构造函数接受 rule_manager 和 hotkey_manager 实例
- VERIFY：打开设置窗口 → 新增规则保存 → 列表刷新 → 重启程序后规则仍存在

---

### TASK-005：系统托盘图标与开机自启

- GOAL：实现程序后台常驻托盘图标，右键菜单控制，并提供开机自启能力
- FILES TO CREATE / EDIT：
  - `ui/tray.py`
  - `assets/icon.ico`（使用 PyQt5 生成一个简单的 16x16 占位图标并保存为 .ico，无需外部图片）
- CONSTRAINTS：
  - 使用 QSystemTrayIcon + QMenu
  - 右键菜单：「打开设置」「退出」
  - 双击托盘图标打开设置窗口
  - 关闭设置窗口时仅隐藏（setVisible(False)），不退出程序（重写 closeEvent）
  - 开机自启实现：
    - set_autostart(enable: bool)：写入/删除注册表 HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run，键名 BossKey，值为可执行文件完整路径
    - get_autostart_status() → bool：检查注册表键是否存在
  - icon.ico 用代码生成（QPixmap 画一个绿色圆形，转存为 .ico）
- VERIFY：程序启动后托盘区出现图标；右键菜单功能正常；关闭设置窗口程序仍在托盘；勾选开机自启后注册表中出现对应键值

---

### TASK-006：程序入口

- GOAL：初始化所有模块，启动托盘常驻，处理程序退出清理
- FILES TO CREATE / EDIT：
  - `main.py`
  - `requirements.txt`
  - `build.spec`（PyInstaller 打包配置）
- CONSTRAINTS：
  - main.py 启动顺序：
    1. 创建 QApplication（sys.argv），设置 setQuitOnLastWindowClosed(False)
    2. 初始化 RuleManager、WindowManager、HotkeyManager
    3. 加载规则并调用 hotkey_manager.register_all(rules)
    4. 初始化 TrayIcon，传入 settings_window 工厂函数
    5. 注册 app.aboutToQuit 信号，退出时调用 hotkey_manager.unregister_all()
    6. 执行 sys.exit(app.exec_())
  - requirements.txt 内容：
    PyQt5>=5.15
    pywin32>=305
    keyboard>=0.13
    pyinstaller>=6.0
  - build.spec 关键配置：
    - --onefile（单文件）
    - --windowed（无控制台窗口）
    - --uac-admin（请求管理员权限，解决 keyboard 库权限问题）
    - --icon=assets/icon.ico
    - 将 config/ 目录标记为 datas，打包后在同级目录生成（不内嵌 exe）
    - 在 build.spec 中使用 datas=[('assets/icon.ico', 'assets')]
  - 同时提供 build.bat 一键打包脚本：pyinstaller build.spec --clean
- VERIFY：
  1. python main.py 正常启动，托盘图标出现，无报错
  2. pip install pyinstaller 后执行 build.bat，dist/ 目录生成 BossKey.exe
  3. 双击 BossKey.exe 正常运行，托盘图标出现，功能与开发模式一致

---

## 5. Execution Order & Acceptance（执行顺序与整体验收）

- 推荐执行顺序：TASK-001 → TASK-002 → TASK-003 → TASK-004 → TASK-005 → TASK-006
- 整体验收标准：
  1. python main.py 启动后托盘图标出现，无报错
  2. 打开设置界面，新增规则：名称「测试」、快捷键 ctrl+alt+1、目标应用 notepad.exe
  3. 打开记事本 + 其他几个窗口
  4. 按下 Ctrl+Alt+1：其他窗口全部最小化，记事本置顶显示
  5. 再按 Ctrl+Alt+1：其他窗口全部还原
  6. 勾选「开机自启」→ 打开注册表 HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run → 确认 BossKey 键存在
  7. 执行 build.bat → dist/BossKey.exe 生成 → 双击运行验证功能一致

---

## 6. Known Limits & Next Step Hints（已知限制与后续方向）

- 当前已知限制：
  - keyboard 库需要管理员权限，打包时已通过 --uac-admin 处理，开发运行时需以管理员身份运行终端
  - 快捷键为文本输入格式（如 ctrl+alt+1），无录制模式
  - 进程名需手动输入，无自动探测（如需输入 WeChat.exe 而非「微信」）
  - config/rules.json 不内嵌在 .exe 中，需与 .exe 同目录存放（首次运行自动创建）
- 下一步可考虑做的事：
  - 快捷键录制模式（按下即捕获按键组合）
  - 进程选择器（列出当前运行进程供点选）
  - 规则分组 / 模式切换（工作模式 / 娱乐模式）
  - 打包为 NSIS 安装包（含快捷方式创建）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
执行包结束
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
