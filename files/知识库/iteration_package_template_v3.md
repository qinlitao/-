# Iteration Package 执行包模板 v3（完整版）
# 适用：Claude Code + DeepSeek V4 Pro
# 使用方式：将分隔线之间的内容整段粘贴到 Claude Code 对话框

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
以下内容可整段复制到 Claude Code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# MODE: A
# A = 逐步确认（每完成一个 TASK 停下来等我确认）
# B = 全自动执行（全部跑完再统一汇报）

---

## 1. Context（项目背景）

- Project Name（项目名称）：
- Project Type（项目类型，勾选）：
  - [ ] 全新项目（从零开始写）
  - [ ] 开源项目二次开发 / Fork（在别人的开源代码上改）
  - [ ] 插件 / 扩展（运行在别的软件里的小程序，如浏览器插件、VSCode 插件）
  - [ ] 已有私有项目新增功能（在自己已有的项目上加新东西）

- Open‑Source Strategy（开源借鉴策略，勾选）：
  - [ ] 直接 Fork：基于「[项目名](链接)」进行二次开发
  - [ ] 参考架构：参考「[项目名](链接)」的设计思路，代码从头写
  - [ ] 独立开发：未找到合适的开源参考，从头写

- Reference Projects（参考项目清单，S 轮检索结果）：
  | 项目名 | 链接 | ⭐ Star 数 | 匹配程度 | 借鉴内容 |
  |--------|------|-----------|----------|----------|
  | 示例   | https://github.com/... | 2.3k | 部分匹配 | 参考模块划分方式 |

- Reference Repo（若直接 Fork，填写仓库地址和版本）：
- Tech Stack（技术栈，即用什么语言和框架）：
- Platform / OS / Environment（运行平台）：
  - （如：Windows 11 桌面；Chrome 浏览器；iOS 17；Linux 服务器）
- Distribution（分发方式，即怎么把程序给到用户）：
  - （如：打包成 exe / App 商店上架 / 浏览器扩展商店 / 内部服务器部署）
- Current State（当前状态）：
  - （全新起步 / 已有 V1 要做 V2 / 基于开源项目做定制版）

---

## 2. Current Goal（本次目标）

- Goal（一句话目标）：
- In Scope（本次做什么）：
- Out of Scope（本次不做什么）：

---

## 3. UI Design Reference（UI 设计参考）—— 【新增】

> 如果本次迭代涉及用户界面，请参考随包附带的 UI 线框图（Wireframe）ZIP 压缩包。

- UI ZIP 文件名：`ui_wireframes_[项目名].zip`
- 包含页面清单：
  | 文件名 | 对应页面 | 说明 |
  |--------|----------|------|
  | 01_main.png | 主界面 | 程序启动后默认显示的界面 |
  | 02_settings.png | 设置页 | 用户配置热键、应用等 |
- 设计风格约定：
  - 清新简约：白色/浅灰背景，主色不超过 3 种，圆角卡片布局
  - 实现时请尽量还原线框图中的布局层次和间距比例
  - 可以适当美化细节，但不要改变整体信息结构

---

## 4. Global Constraints（全局约束）

### 4.1 Technical Constraints（技术约束）

- Language / Runtime 必选项：
- Framework / Library 约束：
  - 允许使用：
  - 禁止使用：
- 架构约束（整体骨架的限制，如不允许修改某个核心模块）：

### 4.2 Platform & Environment Constraints（平台与环境约束）

- Target OS / Device（目标操作系统/设备）：
- Deployment Environment（部署环境，程序最终跑在哪里）：
- 权限与系统集成需求（如全局热键、托盘图标、开机自启等）：

### 4.3 Integration & Dependency Constraints（集成与依赖约束）

- 必须对接的外部系统 / API（需要和哪些第三方服务打交道）：
- 插件 / 扩展场景：
  - 宿主应用（插件运行在哪个软件里）及版本：
  - 插件 API 版本（如 Chrome Extension Manifest V3）：

### 4.4 Non‑functional Constraints（非功能要求）

- 性能（响应速度、同时能支持多少人用等）：
- 安全 / 隐私 / 合规：
- 可移植性（是否需要在多个系统上运行）：

### 4.5 Open‑Source & Licensing Constraints（开源合规约束，二次开发时填）

- 原项目 License（开源许可证，决定能不能商用/闭源）：
- Fork 限制（必须保留原 License / 不能闭源 / 需要更名等）：
- 与上游的关系（只自用 / 跟踪上游更新 / 计划提 PR 回上游）：

---

## 5. Implementation Tasks（实现任务清单）

> 请按顺序依次完成以下任务。

### TASK-001：[任务名]

- GOAL（目标，一句话）：
- FILES TO CREATE / EDIT（要创建或修改的文件）：
  - `path/to/file`
- CONSTRAINTS（约束）：
  - 只修改上述文件，不重构（不重新整理）其他模块
  - 不引入未批准的第三方库（不随便加新的工具包）
- VERIFY（验证方式，如何手工确认完成）：

---

### TASK-002：[任务名]

- GOAL：
- FILES TO CREATE / EDIT：
- CONSTRAINTS：
- VERIFY：

---

（更多任务继续添加 TASK-003 / TASK-004...）

---

## 6. Execution Order & Acceptance（执行顺序与整体验收）

- 推荐执行顺序：TASK-001 → TASK-002 → ...
- 整体验收标准（全部任务完成后，如何手工验证整体成功）：

---

## 7. Known Limits & Next Step Hints（已知限制与后续方向）

- 当前已知限制：
- 下一步可考虑做的事：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
执行包结束
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
