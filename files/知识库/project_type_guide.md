# project_type_guide.md – 项目类型思考速查表（v2）

用于 T1/T2 阶段快速识别项目类型，以及 S 轮 GitHub 检索时的参考关键词。

---

## 类型 A：桌面程序（Windows / macOS / Linux）

通俗解释：安装在电脑上、双击就能用的那种程序。比如微信桌面版、Notepad++。

优先澄清：
- 目标操作系统（OS）：只要 Windows？还是 Mac 和 Linux 也要支持？
- 分发方式（给别人用的方式）：打包成 exe / dmg / AppImage？需要安装向导吗？
- 系统集成（和 Windows/macOS 深度结合的功能）：
  - 全局热键（不管在哪个软件里，按某个键都能触发）
  - 系统托盘（右下角小图标）
  - 开机自启（电脑一开机就自动运行）
  - 文件关联（双击某种文件自动用这个程序打开）
- 权限：是否需要管理员权限（以管理员身份运行，能做更多系统级操作）？

S 轮 GitHub 检索关键词建议：
- `hotkey tray windows python`
- `system tray app cross-platform`
- `windows desktop tool python pyinstaller`

技术路线选项：
① Python + PyQt/PySide（适合功能丰富的桌面程序）
② Python + tkinter + PyInstaller（适合简单工具，依赖少）
③ C# WinForms/WPF（适合 Windows 专属、性能要求高的场景）
④ Electron/Tauri（适合想用 Web 技术写桌面程序的情况）

⭐ 推荐：根据用户技术背景推荐 Python 系方案，门槛低、社区资源丰富。

---

## 类型 B：Web 应用 / 后端服务

通俗解释：打开浏览器就能用的网站或系统，比如公司内部管理系统、个人博客、在线工具等。

优先澄清：
- 前后端模式：
  - SPA（单页应用，Single Page App）：页面不刷新，像手机 App 一样流畅，但首次加载稍慢
  - SSR（服务端渲染）：每次请求服务器都返回完整 HTML，SEO（搜索引擎收录）更好
  - 传统多页：最简单的网站结构，每跳一个页面都刷新
- 部署环境（程序跑在哪台机器上）：自己的服务器 / 云平台（阿里云/腾讯云）/ Serverless（按需付费的云函数）
- 是否需要登录 & 权限管理
- 数据库（存数据的地方）：SQL（MySQL/PostgreSQL，像 Excel 表格式存储）还是 NoSQL（MongoDB，更灵活）

S 轮检索关键词建议：
- `admin dashboard fastapi react`
- `web app boilerplate python flask`
- `saas starter kit nextjs`

---

## 类型 C：移动 App（iOS / Android）

通俗解释：手机上安装的 App，如微信、抖音等。

优先澄清：
- 目标平台：只做 iOS（苹果手机）/ 只做 Android / 两个都要？
- 原生 vs 跨平台：
  - 原生：用苹果官方语言（Swift）或安卓官方语言（Kotlin）写，性能最好
  - 跨平台（Flutter/React Native）：一套代码同时在两个平台运行，省时省力
- 是否要上架应用商店（App Store / Google Play）：上架有审核周期和合规要求

S 轮检索关键词建议：
- `flutter starter app template`
- `react native boilerplate`
- `ios app open source swift`

---

## 类型 D：浏览器插件 / IDE 插件 / 其它扩展

通俗解释：安装在 Chrome/Firefox 等浏览器里的小工具，或者安装在 VSCode 等编辑器里的功能增强模块。

优先澄清：
- 目标宿主（插件运行在哪个软件里）：Chrome / Edge / Firefox / VSCode / JetBrains IDE？
- Manifest 版本：Chrome 插件现在强制要求 Manifest V3（第三版规范），比旧版限制更多，比如不能随意拦截网络请求
- 权限范围（插件能做哪些事）：读取网页内容？访问浏览器标签页？读写 Cookie？
- 交互方式（用户怎么用这个插件）：点击工具栏图标弹出小窗口 / 右键菜单 / 自动在页面上注入内容

S 轮检索关键词建议：
- `chrome extension boilerplate manifest v3`
- `vscode extension template typescript`
- `browser plugin open source`

---

## 类型 E：开源项目二次开发 / Fork

通俗解释：在别人已经写好并公开的代码基础上，继续修改和完善，做成自己需要的版本。

优先澄清：
- 原项目链接和版本号
- License（开源许可证）：
  - MIT / Apache-2.0：最宽松，可以商用、可以闭源，只需保留版权声明
  - GPL：传染性许可，如果用了 GPL 代码，你修改后的版本也必须开源
  - AGPL：比 GPL 更严格，即使是 Web 服务也要开源
- 改动范围：只加几个功能 / 大改架构 / 长期独立维护
- 与上游（原项目）的关系：是否要跟踪原项目的更新？

S 轮检索特别说明：
- 找到候选项目后，先看 Issues（问题列表）和最近 Commits（提交记录），判断项目是否还在活跃维护
- 检查 License 文件，确认是否允许你的使用方式
- 看 README 里的「Contributing」或「Plugin」章节，了解作者是否提供了官方扩展机制

---

## 类型 F：CLI 工具 / 自动化脚本

通俗解释：在命令行（黑色窗口/终端）里运行的工具，主要做批量处理、自动化任务等。

优先澄清：
- 运行环境：Windows PowerShell / Linux/Mac 终端 / 跨平台
- 入口方式：一个命令 + 参数（如 `tool --input file.csv`）还是多个子命令（如 `tool run` / `tool list`）
- 输出形式：打印到屏幕 / 写入文件 / 调用其它 API

S 轮检索关键词建议：
- `cli tool python click typer`
- `automation script python open source`
- `command line tool golang`

---

## S 轮通用检索建议

无论哪种类型，GitHub 检索时优先筛选：
- ⭐ Star 数 > 500（说明有一定用户认可度）
- 🕐 最近 6 个月有 Commit（说明项目还在维护，不是废弃的）
- 📄 有完整 README 和文档
- ✅ License 允许你的使用场景（商用/闭源等）

检索后，给用户汇报格式：
| 项目名 | 链接 | Star | 最后更新 | License | 匹配程度 | 建议借鉴内容 |
|--------|------|------|----------|---------|----------|--------------|
| ...    | ...  | ...  | ...      | ...     | ✅/🔶/❌ | ...          |

⭐ 推荐项目：[名称]
理由：……

---

📖 本文件常见术语速查

| 术语 | 通俗解释 |
|------|----------|
| 架构 | 程序的整体骨架，决定各模块怎么分工和配合 |
| Fork | 把别人的开源代码复制一份到自己名下，然后在上面改 |
| API | 两个程序之间互相通话的"插座"，通过它传数据和调用功能 |
| License | 开源许可证，规定别人能不能用你的代码、怎么用 |
| 部署 | 把写好的程序放到服务器上，让别人能通过网络访问 |
| 依赖 | 程序运行需要用到的第三方工具包，缺了就跑不起来 |
| 重构 | 不改功能的前提下，重新整理代码结构，让它更清晰好维护 |
| 迭代 | 每次做一小块功能，逐步完善，而不是一次做完所有东西 |
| 热键 | 全局快捷键，不管当前在用什么软件，按下就能触发 |
| 打包 | 把 Python/JS 等脚本连同它依赖的环境一起打成一个 exe 或 dmg，别人无需安装环境就能用 |
| MVP | Minimum Viable Product，最小可用产品，只做最核心的功能，先能用起来再说 |
| SSR | 服务端渲染，每次请求都由服务器生成完整的 HTML 页面返回 |
| SPA | 单页应用，页面不整体刷新，像 App 一样动态更新内容 |
| Manifest V3 | Chrome 浏览器插件的第三版规范，相比旧版限制了一些权限和后台脚本能力 |
| Commit | 一次代码提交，记录了这次改动了什么 |
| Issue | 问题单，开源项目里用户或开发者提的 Bug 报告或功能请求 |
| PR（Pull Request）| 向原项目提交你的改动，请求原作者合并进去 |
| GPL | 一种开源许可证，使用了 GPL 代码的项目也必须开源 |
| MIT | 最宽松的开源许可证，几乎没有限制，可以商用、可以闭源 |
