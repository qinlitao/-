# MODE: B
# B = 全自动执行（全部跑完再统一汇报）

---

## 1. Context（项目背景）

- Project Name：WorkplaceSleepGuard
- Project Type：✅ 全新项目（从零开始写）
- Open-Source Strategy：✅ 独立开发（参考 iwalton3/auto-face-lock 的触发逻辑思路，代码从头写）
- Tech Stack：Python 3.x + OpenCV（Haar Cascade 正脸/侧脸检测 + HOG 人体检测）
- Platform / OS：Windows 10 / 11 桌面
- Distribution：直接运行 Python 脚本（.py 文件），无需打包
- Current State：全新起步

---

## 2. Current Goal（本次目标）

- Goal：用摄像头检测工位前是否有人头（含正脸、侧脸、静止状态），连续20秒检测不到人头则自动触发Windows睡眠。

- In Scope（本次做的事）：
  1. 摄像头实时画面采集
  2. 双重人头检测：
     a. OpenCV Haar Cascade 多角度人脸检测（覆盖正脸 + 轻微侧脸）
     b. HOG + SVM 人体上半身/头肩检测（覆盖大角度侧脸、低头静止等正脸检测失败的场景）
  3. 计时逻辑：任一检测器检测到人 → 重置计时器；两者均检测不到 → 开始倒计时
  4. 倒计时满20秒 → 调用 Windows 睡眠命令
  5. 控制台实时打印状态（检测到人 / 未检测到人 + 剩余倒计时秒数）
  6. 按 Q 键可退出程序

- Out of Scope（本次不做）：
  - GUI 界面
  - 系统托盘图标
  - 开机自启
  - 任何联网功能

---

## 3. UI Design Reference

- 本次无 GUI，跳过此节

---

## 4. Global Constraints（全局约束）

### 4.1 技术约束
- Language：Python 3.8+
- 允许使用的库：
  - opencv-python（摄像头 + Haar Cascade 人脸检测 + HOG人体检测）
  - ctypes 或 subprocess（调用 Windows 睡眠命令）
  - time、threading（计时器）
- 禁止使用：任何需要联网的 AI API（如 Azure Face API）
- 架构约束：单文件脚本，逻辑清晰，便于后续手动调参

### 4.2 平台与环境约束
- Target OS：Windows 10 / 11
- 睡眠触发命令：
  ```python
  import subprocess
  subprocess.run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
  ```
  （此命令在 Windows 上触发睡眠 Sleep，不是关机）
- 不需要管理员权限

### 4.3 非功能要求
- 性能：每秒采集 1～2 帧即可（降低 CPU 占用），不需要高帧率
- 隐私：所有图像处理均在本地完成，不保存任何图片或视频
- 误触发容忍：必须连续满 20 秒无人才触发睡眠，单帧检测失败不触发

---

## 5. Implementation Tasks（实现任务清单）

### TASK-001：搭建摄像头采集 + 双重检测框架

- GOAL：实现摄像头开启、每秒采集帧、运行双重检测器并返回"是否有人"布尔值
- FILES TO CREATE：
  - `workplace_sleep_guard.py`
- 检测逻辑说明：
  - 检测器 A（主力）：OpenCV 内置 Haar Cascade
    - 使用 `haarcascade_frontalface_default.xml`（正脸）
    - 使用 `haarcascade_profileface.xml`（侧脸，覆盖大角度侧转）
    - 两个 cascade 任一检测到人脸 → 判定"有人"
  - 检测器 B（兜底）：OpenCV HOG + SVM 人体上半身检测
    - 使用 `cv2.HOGDescriptor_getDefaultPeopleDetector()`
    - 专门处理"低头/俯仰/只露出头肩"等正脸检测失败的场景
    - 若检测器 A 未检测到但检测器 B 检测到 → 也判定"有人"
  - 只有 A 和 B 同时检测不到 → 判定"无人"
- CONSTRAINTS：
  - 采集间隔：每 0.5 秒采一帧（time.sleep(0.5)）
  - 为减少误判，对每一帧做一次轻微灰度+缩放预处理（resize 到宽度 640px）再送入检测器
- VERIFY：运行脚本后，在摄像头前正对、侧转约45度、低头，控制台均应打印"检测到人"

---

### TASK-002：实现20秒倒计时 + 睡眠触发逻辑

- GOAL：连续20秒"无人"后自动触发睡眠，一旦检测到人立即重置计时
- FILES TO EDIT：
  - `workplace_sleep_guard.py`
- 逻辑说明：
  ```
  person_absent_start = None  # 记录"无人"开始的时间戳

  每帧循环：
    if 检测到人:
        person_absent_start = None   # 重置，不倒计时
        打印: "[有人] 检测到人头，监控中..."
    else:
        if person_absent_start is None:
            person_absent_start = time.time()  # 开始计时
        elapsed = time.time() - person_absent_start
        remaining = 20 - elapsed
        打印: f"[无人] 未检测到人，{remaining:.0f} 秒后进入睡眠"
        if elapsed >= 20:
            触发睡眠()
  ```
- CONSTRAINTS：
  - 睡眠触发后，脚本自动退出（无需再监控）
  - 触发睡眠前先打印提示："即将进入睡眠，正在执行..."
- VERIFY：用手遮住摄像头，观察倒计时从20开始递减；把手移开，倒计时应立即重置

---

### TASK-003：启动提示 + 退出快捷键

- GOAL：程序启动时打印使用说明，按 Q 键可随时退出
- FILES TO EDIT：
  - `workplace_sleep_guard.py`
- 说明：
  - 启动时控制台打印：
    ```
    ========================================
    WorkplaceSleepGuard 已启动
    - 检测到人头：保持正常状态
    - 离开工位满 20 秒：自动进入睡眠
    - 按 Q 键退出程序
    ========================================
    ```
  - OpenCV 窗口可选择性显示摄像头预览（带检测框），方便调试；
    在代码顶部加一个变量 SHOW_PREVIEW = True，设为 False 可关闭预览窗口
- VERIFY：程序启动后看到上述提示；在预览窗口按 Q 键程序正常退出

---

### TASK-004：生成 requirements.txt

- GOAL：列出所有依赖，方便一键安装
- FILES TO CREATE：
  - `requirements.txt`
- 内容：
  ```
  opencv-python>=4.5.0
  ```
  （HOG 检测器已内置于 opencv-python，无需额外安装其他包）
- VERIFY：执行 `pip install -r requirements.txt` 无报错

---

## 6. Execution Order & Acceptance（执行顺序与整体验收）

- 推荐执行顺序：TASK-001 → TASK-002 → TASK-003 → TASK-004
- 整体验收标准：
  1. 运行 `python workplace_sleep_guard.py`，看到启动提示
  2. 坐在摄像头前（正脸、侧脸均可），控制台持续打印"检测到人"
  3. 离开座位（或遮住摄像头），倒计时从20秒开始递减
  4. 回到座位，倒计时立即重置
  5. 遮住摄像头静等20秒，电脑进入睡眠状态

---

## 7. Known Limits & Next Step Hints（已知限制与后续方向）

- 当前已知限制：
  - 光线很暗时 Haar Cascade 检测率会下降，建议在正常室内光线下使用
  - HOG 人体检测对距离摄像头非常近（<50cm）的场景覆盖可能不足
  - 摄像头被贴纸遮住会被误判为"无人"（这是预期行为，不是 Bug）

- 下一步可考虑做的事：
  - 加入系统托盘图标，让程序后台静默运行
  - 支持自定义倒计时时间（命令行参数传入）
  - 改用更精准的 MediaPipe 人头检测模型（效果更好但需要额外安装）

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
执行包结束 · WorkplaceSleepGuard v1.0
由预思考工程师生成 · 可整段复制到 Claude Code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
