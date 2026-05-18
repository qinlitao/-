"""
图形界面模块：使用 tkinter 构建同步工具 GUI。
"""
import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from pathlib import Path
from typing import List, Optional

from config_manager import ConfigManager, Profile, SyncPath
from sync_engine import sync_in_background, restore_in_background


class SyncToolGUI:
    """同步工具主窗口"""

    def __init__(self):
        self.config = ConfigManager()
        self.current_thread = None
        self.current_engine = None

        # 主窗口
        self.root = tk.Tk()
        self.root.title('📁 文件同步工具 - GitHub 一键同步')
        self.root.geometry('900x650')
        self.root.minsize(800, 550)

        # 设置样式
        self._setup_styles()

        # 构建界面
        self._build_menu()
        self._build_layout()

        # 加载配置
        self._refresh_profile_list()

        # 窗口关闭时保存
        self.root.protocol('WM_DELETE_WINDOW', self._on_close)

    # ── 样式 ─────────────────────────────────────

    def _setup_styles(self):
        style = ttk.Style()
        # 使用可用的主题
        available = style.theme_names()
        for theme in ['clam', 'alt', 'default']:
            if theme in available:
                style.theme_use(theme)
                break

        # 自定义样式
        style.configure('Title.TLabel', font=('Microsoft YaHei', 14, 'bold'))
        style.configure('Section.TLabelframe.Label', font=('Microsoft YaHei', 10, 'bold'))
        style.configure('Sync.TButton', font=('Microsoft YaHei', 10, 'bold'), padding=6)
        style.configure('Danger.TButton', foreground='#c0392b')

    # ── 菜单 ─────────────────────────────────────

    def _build_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label='新建配置', command=self._new_profile, accelerator='Ctrl+N')
        file_menu.add_command(label='删除当前配置', command=self._delete_profile)
        file_menu.add_separator()
        file_menu.add_command(label='全部同步', command=self._sync_all, accelerator='F5')
        file_menu.add_separator()
        file_menu.add_command(label='退出', command=self._on_close)
        menubar.add_cascade(label='文件', menu=file_menu)

        help_menu = tk.Menu(menubar, tearoff=0)
        help_menu.add_command(label='关于', command=self._show_about)
        menubar.add_cascade(label='帮助', menu=help_menu)

        # 快捷键
        self.root.bind('<Control-n>', lambda e: self._new_profile())
        self.root.bind('<F5>', lambda e: self._sync_all())

    # ── 主布局 ───────────────────────────────────

    def _build_layout(self):
        # 顶部标题
        title_frame = ttk.Frame(self.root, padding=(10, 8, 10, 4))
        title_frame.pack(fill=tk.X)
        ttk.Label(title_frame, text='📁 文件同步工具', style='Title.TLabel').pack(side=tk.LEFT)
        ttk.Label(title_frame, text='本地文件 → GitHub 私有仓库', font=('Microsoft YaHei', 9)).pack(
            side=tk.LEFT, padx=12)

        # 主内容区 (左右分栏)
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=(0, 4))

        # 左侧：配置列表
        self._build_left_panel(main_frame)

        # 右侧：配置详情
        self._build_right_panel(main_frame)

        # 底部：日志
        self._build_log_panel()

    def _build_left_panel(self, parent):
        """左侧：配置列表"""
        frame = ttk.LabelFrame(parent, text='同步配置', padding=6)
        frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0, 4))

        # 配置列表
        self.profile_listbox = tk.Listbox(
            frame, width=22, font=('Microsoft YaHei', 10),
            selectmode=tk.SINGLE, exportselection=False
        )
        self.profile_listbox.pack(fill=tk.BOTH, expand=True, pady=(4, 4))
        self.profile_listbox.bind('<<ListboxSelect>>', self._on_profile_select)

        # 按钮
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(fill=tk.X, pady=(2, 0))
        ttk.Button(btn_frame, text='➕ 新建', command=self._new_profile).pack(
            side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 2))
        ttk.Button(btn_frame, text='🗑 删除', command=self._delete_profile,
                   style='Danger.TButton').pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(2, 0))

    def _build_right_panel(self, parent):
        """右侧：配置详情表单"""
        frame = ttk.LabelFrame(parent, text='配置详情', padding=8)
        frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(4, 0))

        # 使用 Canvas + Scrollbar 实现可滚动
        canvas = tk.Canvas(frame, highlightthickness=0)
        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=canvas.yview)
        self.detail_frame = ttk.Frame(canvas)

        self.detail_frame.bind('<Configure>',
                               lambda e: canvas.configure(scrollregion=canvas.bbox('all')))
        canvas.create_window((0, 0), window=self.detail_frame, anchor='nw',
                             tags='detail_frame')
        canvas.configure(yscrollcommand=scrollbar.set)

        # 让内部 frame 宽度跟随 canvas
        def _on_canvas_resize(event):
            canvas.itemconfig('detail_frame', width=event.width)
        canvas.bind('<Configure>', _on_canvas_resize)

        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # 鼠标滚轮支持
        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), 'units')
        canvas.bind_all('<MouseWheel>', _on_mousewheel)

        self._build_detail_form(self.detail_frame)

    def _build_detail_form(self, parent):
        """构建配置表单"""
        row = 0

        # ── 名称 ──
        ttk.Label(parent, text='配置名称', font=('Microsoft YaHei', 9, 'bold')).grid(
            row=row, column=0, sticky=tk.W, pady=(0, 1))
        row += 1
        self.var_name = tk.StringVar()
        ttk.Entry(parent, textvariable=self.var_name, width=50).grid(
            row=row, column=0, sticky=tk.EW, pady=(0, 8))
        row += 1

        # ── 本地路径 ──
        ttk.Label(parent, text='本地同步路径', font=('Microsoft YaHei', 9, 'bold')).grid(
            row=row, column=0, sticky=tk.W, pady=(4, 1))
        row += 1

        self.paths_frame = ttk.Frame(parent)
        self.paths_frame.grid(row=row, column=0, sticky=tk.EW, pady=(0, 4))
        row += 1

        # 路径列表容器
        self.path_entries = []  # [(local_var, sync_name_var, frame), ...]

        # 添加路径按钮
        add_btn = ttk.Button(parent, text='+ 添加路径', command=self._add_path_row)
        add_btn.grid(row=row, column=0, sticky=tk.W, pady=(0, 8))
        row += 1

        # ── GitHub 仓库 ──
        ttk.Label(parent, text='GitHub 仓库 URL', font=('Microsoft YaHei', 9, 'bold')).grid(
            row=row, column=0, sticky=tk.W, pady=(4, 1))
        row += 1
        self.var_repo = tk.StringVar()
        ttk.Entry(parent, textvariable=self.var_repo, width=50).grid(
            row=row, column=0, sticky=tk.EW, pady=(0, 8))
        row += 1

        # ── 分支 ──
        ttk.Label(parent, text='分支名称', font=('Microsoft YaHei', 9, 'bold')).grid(
            row=row, column=0, sticky=tk.W, pady=(4, 1))
        row += 1
        self.var_branch = tk.StringVar(value='main')
        ttk.Entry(parent, textvariable=self.var_branch, width=30).grid(
            row=row, column=0, sticky=tk.W, pady=(0, 8))
        row += 1

        # ── 认证方式 ──
        ttk.Label(parent, text='Git 认证方式', font=('Microsoft YaHei', 9, 'bold')).grid(
            row=row, column=0, sticky=tk.W, pady=(4, 1))
        row += 1
        auth_frame = ttk.Frame(parent)
        auth_frame.grid(row=row, column=0, sticky=tk.W, pady=(0, 2))
        self.var_auth = tk.StringVar(value='ssh')
        ttk.Radiobutton(auth_frame, text='SSH（推荐）', variable=self.var_auth,
                        value='ssh', command=self._on_auth_change).pack(side=tk.LEFT, padx=(0, 16))
        ttk.Radiobutton(auth_frame, text='HTTPS Token', variable=self.var_auth,
                        value='token', command=self._on_auth_change).pack(side=tk.LEFT)
        row += 1

        # Token 输入（仅 token 模式显示）
        self.token_frame = ttk.Frame(parent)
        self.token_frame.grid(row=row, column=0, sticky=tk.EW, pady=(0, 8))
        ttk.Label(self.token_frame, text='Personal Access Token:',
                  font=('Microsoft YaHei', 8)).pack(anchor=tk.W)
        self.var_token = tk.StringVar()
        token_entry = ttk.Entry(self.token_frame, textvariable=self.var_token, width=50, show='*')
        token_entry.pack(fill=tk.X)
        row += 1

        # ── Git 用户信息 ──
        ttk.Label(parent, text='Git 提交用户信息（可选）',
                  font=('Microsoft YaHei', 9, 'bold')).grid(
            row=row, column=0, sticky=tk.W, pady=(8, 1))
        row += 1
        git_frame = ttk.Frame(parent)
        git_frame.grid(row=row, column=0, sticky=tk.EW, pady=(0, 2))
        ttk.Label(git_frame, text='用户名:', font=('Microsoft YaHei', 8)).grid(
            row=0, column=0, sticky=tk.W, padx=(0, 6))
        self.var_git_name = tk.StringVar()
        ttk.Entry(git_frame, textvariable=self.var_git_name, width=22).grid(row=0, column=1, padx=(0, 10))
        ttk.Label(git_frame, text='邮箱:', font=('Microsoft YaHei', 8)).grid(
            row=0, column=2, sticky=tk.W, padx=(0, 6))
        self.var_git_email = tk.StringVar()
        ttk.Entry(git_frame, textvariable=self.var_git_email, width=25).grid(row=0, column=3)
        row += 2

        # ── 操作按钮 ──
        btn_row = ttk.Frame(parent)
        btn_row.grid(row=row, column=0, sticky=tk.EW, pady=(12, 0))
        ttk.Button(btn_row, text='💾 保存配置', command=self._save_profile,
                   style='Sync.TButton').pack(side=tk.LEFT, padx=(0, 4))
        self.btn_sync = ttk.Button(btn_row, text='🔄 立即同步', command=self._sync_current,
                                    style='Sync.TButton')
        self.btn_sync.pack(side=tk.LEFT, padx=(0, 4))
        self.btn_restore = ttk.Button(btn_row, text='📥 从云端恢复', command=self._restore_current)
        self.btn_restore.pack(side=tk.LEFT, padx=(0, 4))
        self.btn_cancel = ttk.Button(btn_row, text='⏹ 取消', command=self._cancel_operation,
                                      state=tk.DISABLED)
        self.btn_cancel.pack(side=tk.LEFT)

        # 初始状态
        self._on_auth_change()
        # 添加一个空路径行
        self._add_path_row()

        # 让列可扩展
        parent.columnconfigure(0, weight=1)

    def _build_log_panel(self):
        """底部日志面板"""
        frame = ttk.LabelFrame(self.root, text='同步日志', padding=4)
        frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=(0, 8))

        # 日志文本区域
        self.log_text = tk.Text(frame, height=8, font=('Consolas', 9),
                                wrap=tk.WORD, state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True, side=tk.LEFT)

        scrollbar = ttk.Scrollbar(frame, command=self.log_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.configure(yscrollcommand=scrollbar.set)

        # 底部按钮
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(fill=tk.X, pady=(4, 0))
        ttk.Button(btn_frame, text='清空日志', command=self._clear_log).pack(side=tk.LEFT)
        self.btn_sync_all = ttk.Button(btn_frame, text='🚀 全部同步', command=self._sync_all,
                                        style='Sync.TButton')
        self.btn_sync_all.pack(side=tk.RIGHT)

    # ── 日志 ────────────────────────────────────

    def log(self, message: str):
        """添加日志消息（支持从后台线程调用）"""
        self.root.after(0, lambda: self._append_log(message))

    def _append_log(self, message: str):
        """在主线程中追加日志"""
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + '\n')
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _clear_log(self):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete('1.0', tk.END)
        self.log_text.configure(state=tk.DISABLED)

    # ── 路径行管理 ─────────────────────────────

    def _add_path_row(self):
        """添加一个路径输入行"""
        frame = ttk.Frame(self.paths_frame)
        frame.pack(fill=tk.X, pady=1)

        var_local = tk.StringVar()
        var_name = tk.StringVar()

        entry = ttk.Entry(frame, textvariable=var_local, width=40)
        entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        ttk.Label(frame, text='→', font=('Consolas', 9)).pack(side=tk.LEFT, padx=2)

        name_entry = ttk.Entry(frame, textvariable=var_name, width=16)
        name_entry.pack(side=tk.LEFT, padx=4)
        ttk.Label(frame, text='(仓库文件夹名)', font=('Microsoft YaHei', 7),
                  foreground='gray').pack(side=tk.LEFT)

        browse_btn = ttk.Button(frame, text='📂', width=3,
                                command=lambda v=var_local, n=var_name: self._browse_path(v, n))
        browse_btn.pack(side=tk.LEFT, padx=(4, 2))

        remove_btn = ttk.Button(frame, text='✕', width=2,
                                command=lambda f=frame, e=(var_local, var_name, frame):
                                self._remove_path_row(f, e))
        remove_btn.pack(side=tk.LEFT)

        self.path_entries.append((var_local, var_name, frame))

    def _remove_path_row(self, frame, entry_tuple):
        """删除一个路径输入行"""
        if len(self.path_entries) <= 1:
            return  # 至少保留一行
        frame.destroy()
        self.path_entries.remove(entry_tuple)

    def _browse_path(self, var_local, var_name):
        """浏览选择文件或文件夹"""
        # 先选择文件夹
        path = filedialog.askdirectory(title='选择要同步的文件夹')
        if not path:
            # 再尝试选择文件
            path = filedialog.askopenfilename(title='选择要同步的文件')
        if path:
            var_local.set(path)
            # 自动填充仓库文件夹名
            if not var_name.get():
                p = Path(path)
                var_name.set(p.name or p.anchor.replace(':', '_drive'))

    # ── 配置管理 ───────────────────────────────

    def _refresh_profile_list(self):
        """刷新左侧配置列表"""
        self.profile_listbox.delete(0, tk.END)
        for name in self.config.get_profile_names():
            self.profile_listbox.insert(tk.END, name)

    def _on_profile_select(self, event=None):
        """选中配置列表中的一项"""
        selection = self.profile_listbox.curselection()
        if not selection:
            return
        name = self.profile_listbox.get(selection[0])
        profile = self.config.get_profile(name)
        if profile:
            self._load_profile_to_form(profile)

    def _load_profile_to_form(self, profile: Profile):
        """将 Profile 数据加载到表单"""
        self.var_name.set(profile.name)
        self.var_repo.set(profile.github_repo)
        self.var_branch.set(profile.branch)
        self.var_auth.set(profile.auth_type)
        self.var_token.set(profile.auth_token)
        self.var_git_name.set(profile.git_user_name)
        self.var_git_email.set(profile.git_user_email)

        # 清除现有路径行
        for _, _, frame in self.path_entries:
            frame.destroy()
        self.path_entries.clear()

        # 加载路径
        if profile.sync_paths:
            for sp in profile.sync_paths:
                self._add_path_row()
                self.path_entries[-1][0].set(sp.local_path)
                self.path_entries[-1][1].set(sp.sync_name)
        else:
            self._add_path_row()

        self._on_auth_change()

    def _read_form_to_profile(self) -> Optional[Profile]:
        """从表单读取数据构建 Profile"""
        name = self.var_name.get().strip()
        if not name:
            messagebox.showwarning('提示', '请输入配置名称')
            return None

        sync_paths = []
        for var_local, var_name, _ in self.path_entries:
            local = var_local.get().strip()
            if local:
                sync_name = var_name.get().strip() or Path(local).name
                sync_paths.append(SyncPath(local_path=local, sync_name=sync_name))

        if not sync_paths:
            messagebox.showwarning('提示', '请至少添加一个同步路径')
            return None

        return Profile(
            name=name,
            sync_paths=sync_paths,
            github_repo=self.var_repo.get().strip(),
            branch=self.var_branch.get().strip() or 'main',
            auth_type=self.var_auth.get(),
            auth_token=self.var_token.get().strip(),
            git_user_name=self.var_git_name.get().strip(),
            git_user_email=self.var_git_email.get().strip(),
        )

    def _new_profile(self):
        """新建配置"""
        # 清空表单
        self.var_name.set('')
        self.var_repo.set('')
        self.var_branch.set('main')
        self.var_auth.set('ssh')
        self.var_token.set('')
        self.var_git_name.set('')
        self.var_git_email.set('')
        self.profile_listbox.selection_clear(0, tk.END)

        for _, _, frame in self.path_entries:
            frame.destroy()
        self.path_entries.clear()
        self._add_path_row()
        self._on_auth_change()

    def _save_profile(self):
        """保存当前配置"""
        profile = self._read_form_to_profile()
        if not profile:
            return

        old_name = None
        selection = self.profile_listbox.curselection()
        if selection:
            old_name = self.profile_listbox.get(selection[0])

        if old_name and old_name != profile.name:
            # 改名：删除旧的，添加新的
            self.config.remove_profile(old_name)
            self.config.add_profile(profile)
        elif old_name:
            self.config.update_profile(old_name, profile)
        else:
            self.config.add_profile(profile)

        self._refresh_profile_list()
        # 选中刚保存的项
        for i in range(self.profile_listbox.size()):
            if self.profile_listbox.get(i) == profile.name:
                self.profile_listbox.selection_set(i)
                self.profile_listbox.see(i)
                break
        self.log(f'✅ 配置已保存: {profile.name}')

    def _delete_profile(self):
        """删除当前配置"""
        selection = self.profile_listbox.curselection()
        if not selection:
            return
        name = self.profile_listbox.get(selection[0])
        if messagebox.askyesno('确认删除', f'确定要删除配置 "{name}" 吗？\n（不会删除云端仓库中的文件）'):
            self.config.remove_profile(name)
            self._refresh_profile_list()
            self._new_profile()
            self.log(f'🗑 已删除配置: {name}')

    def _on_auth_change(self):
        """认证方式切换时显示/隐藏 token 输入"""
        if self.var_auth.get() == 'token':
            self.token_frame.grid()
        else:
            self.token_frame.grid_remove()

    # ── 同步操作 ───────────────────────────────

    def _get_current_profile(self) -> Optional[Profile]:
        """获取当前选中的配置（先保存）"""
        profile = self._read_form_to_profile()
        if not profile:
            return None
        return profile

    def _sync_current(self):
        """同步当前配置"""
        profile = self._get_current_profile()
        if not profile:
            return

        # 确保已保存
        existing = self.config.get_profile(profile.name)
        if existing:
            self.config.update_profile(profile.name, profile)
        else:
            self.config.add_profile(profile)
        self._refresh_profile_list()

        if not profile.github_repo:
            messagebox.showwarning('提示', '请输入 GitHub 仓库 URL')
            return

        self._set_busy(True)
        self.log('')
        self.current_thread, self.current_engine = sync_in_background(
            profile,
            log_callback=self.log,
            on_complete=lambda success: self.root.after(0, lambda: self._on_sync_done(success))
        )

    def _sync_all(self):
        """同步所有配置"""
        profiles = self.config.profiles
        if not profiles:
            messagebox.showinfo('提示', '没有已保存的配置，请先创建配置')
            return

        self._set_busy(True)
        self.log('')
        self.log('🚀 开始全部同步...')

        def sync_next(index=0):
            if index >= len(profiles):
                self.root.after(0, lambda: self._on_sync_done(True))
                return
            profile = profiles[index]
            self.current_thread, self.current_engine = sync_in_background(
                profile,
                log_callback=self.log,
                on_complete=lambda s: self.root.after(100, lambda: sync_next(index + 1))
            )

        sync_next(0)

    def _restore_current(self):
        """从云端恢复"""
        profile = self._get_current_profile()
        if not profile:
            return

        if not profile.github_repo:
            messagebox.showwarning('提示', '请输入 GitHub 仓库 URL')
            return

        if not messagebox.askyesno('确认恢复',
                                   f'将从云端恢复文件到本地路径。\n'
                                   f'配置: {profile.name}\n\n'
                                   f'这可能会覆盖本地文件，确定继续吗？'):
            return

        self._set_busy(True)
        self.log('')
        self.current_thread, self.current_engine = restore_in_background(
            profile,
            log_callback=self.log,
            on_complete=lambda success: self.root.after(0, lambda: self._on_sync_done(success))
        )

    def _cancel_operation(self):
        """取消当前操作"""
        if self.current_engine:
            self.current_engine.cancel()
            self.log('⏹ 正在取消...')
            self._set_busy(False)

    def _on_sync_done(self, success: bool):
        """同步/恢复完成回调"""
        self._set_busy(False)
        if success:
            self.log('')
            messagebox.showinfo('完成', '操作完成！')
        else:
            self.log('')
            messagebox.showwarning('注意', '操作未完全成功，请查看日志了解详情。')

    def _set_busy(self, busy: bool):
        """设置界面忙状态"""
        state = tk.DISABLED if busy else tk.NORMAL
        self.btn_sync.configure(state=state)
        self.btn_restore.configure(state=state)
        self.btn_sync_all.configure(state=state)
        self.btn_cancel.configure(state=tk.NORMAL if busy else tk.DISABLED)

    def _on_close(self):
        """窗口关闭"""
        # 自动保存当前表单
        profile = self._read_form_to_profile()
        if profile:
            existing = self.config.get_profile(profile.name)
            if existing:
                self.config.update_profile(profile.name, profile)
            elif profile.name:
                self.config.add_profile(profile)
        self.root.destroy()

    def _show_about(self):
        messagebox.showinfo('关于',
                            '文件同步工具 v1.0\n\n'
                            '一键将本地文件同步到 GitHub 私有仓库\n'
                            '支持多配置、后台同步、增量更新\n\n'
                            'GitHub: 请创建私有仓库用于存储')

    def run(self):
        """启动 GUI 主循环"""
        self.root.mainloop()


def main():
    app = SyncToolGUI()
    app.run()


if __name__ == '__main__':
    main()
