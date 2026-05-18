"""
同步引擎：负责 Git 仓库操作和文件同步的核心逻辑。
"""
import os
import subprocess
import shutil
import threading
from pathlib import Path
from datetime import datetime
from typing import Callable, Optional

from config_manager import Profile, SyncPath


class SyncEngine:
    """文件同步引擎，封装了 Git 操作和文件复制逻辑"""

    def __init__(self, profile: Profile, log_callback: Callable[[str], None] = None):
        self.profile = profile
        self.log = log_callback or (lambda msg: print(msg))
        self.repo_dir = profile.repo_cache_path
        self.files_dir = self.repo_dir / 'files'  # 仓库中存放同步文件的目录
        self._cancel_flag = threading.Event()

    def cancel(self):
        """取消当前同步操作"""
        self._cancel_flag.set()

    def _check_git_installed(self) -> bool:
        """检查 Git 是否可用"""
        try:
            subprocess.run(['git', '--version'], capture_output=True, timeout=5)
            return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _run_git(self, *args, cwd=None, capture=True) -> tuple:
        """运行 Git 命令，返回 (success, output)"""
        cwd = cwd or self.repo_dir
        cmd = ['git'] + list(args)
        try:
            result = subprocess.run(
                cmd, cwd=cwd, capture_output=True, text=True, timeout=120,
                env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'}
            )
            output = result.stdout.strip() or result.stderr.strip()
            success = result.returncode == 0
            if not success and output:
                self.log(f"  [git] {output}")
            return success, output
        except subprocess.TimeoutExpired:
            return False, 'Git 命令超时'
        except Exception as e:
            return False, f'Git 命令执行失败: {e}'

    def setup_repo(self) -> bool:
        """准备 Git 仓库：克隆或拉取最新代码"""
        if not self._check_git_installed():
            self.log("❌ 未检测到 Git，请先安装 Git: https://git-scm.com/")
            return False

        self.repo_dir.mkdir(parents=True, exist_ok=True)

        if (self.repo_dir / '.git').exists():
            self.log(f"📦 仓库已存在，拉取最新: {self.profile.github_repo}")
            # 配置远程 URL（支持 token 认证）
            self._run_git('remote', 'set-url', 'origin', self.profile.repo_url_with_auth)
            self._run_git('fetch', 'origin')
            # 尝试切换到目标分支
            ok, _ = self._run_git('checkout', self.profile.branch)
            if not ok:
                self._run_git('checkout', '-b', self.profile.branch)
            self._run_git('pull', 'origin', self.profile.branch)
            return True
        else:
            self.log(f"📥 克隆仓库: {self.profile.github_repo}")
            # 先尝试删除可能存在的空目录
            if self.repo_dir.exists():
                shutil.rmtree(self.repo_dir, ignore_errors=True)

            ok, output = self._run_git(
                'clone', '-b', self.profile.branch,
                self.profile.repo_url_with_auth, str(self.repo_dir)
            )
            if not ok:
                self.log(f"  克隆失败，尝试初始化新仓库...")
                self.repo_dir.mkdir(parents=True, exist_ok=True)
                self._run_git('init')
                self._run_git('checkout', '-b', self.profile.branch)
                # 创建一个初始提交
                readme = self.repo_dir / 'README.md'
                readme.write_text(f'# {self.profile.name}\n\n文件同步备份仓库。\n', encoding='utf-8')
                self._run_git('add', 'README.md')
                self._run_git('commit', '-m', '初始化同步仓库')
            return True

    def _configure_git_user(self):
        """在仓库中配置 git 用户信息"""
        if self.profile.git_user_name:
            self._run_git('config', 'user.name', self.profile.git_user_name)
        if self.profile.git_user_email:
            self._run_git('config', 'user.email', self.profile.git_user_email)

    def sync(self) -> bool:
        """执行完整同步流程"""
        self._cancel_flag.clear()
        start_time = datetime.now()
        self.log(f"{'='*50}")
        self.log(f"🔄 开始同步: {self.profile.name}")
        self.log(f"   时间: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

        # 1. 准备仓库
        if not self.setup_repo():
            self.log("❌ 仓库准备失败")
            return False

        self._configure_git_user()
        self.log(f"   仓库地址: {self.profile.github_repo}")
        self.log(f"   分支: {self.profile.branch}")

        # 2. 清空并重建 files 目录
        if self.files_dir.exists():
            shutil.rmtree(self.files_dir)
        self.files_dir.mkdir(parents=True, exist_ok=True)

        # 3. 复制文件
        total_files = 0
        total_size = 0
        skipped = 0

        for sync_path in self.profile.sync_paths:
            if self._cancel_flag.is_set():
                self.log("⏹ 同步已取消")
                return False

            local = Path(sync_path.local_path).expanduser()
            if not local.exists():
                self.log(f"⚠ 路径不存在，跳过: {sync_path.local_path}")
                skipped += 1
                continue

            dest_base = self.files_dir / sync_path.sync_name
            self.log(f"📁 同步: {sync_path.local_path} → files/{sync_path.sync_name}/")

            if local.is_file():
                dest_base.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(local, dest_base)
                total_files += 1
                total_size += local.stat().st_size
                self.log(f"   ✓ {local.name}")
            elif local.is_dir():
                for file_path in local.rglob('*'):
                    if self._cancel_flag.is_set():
                        self.log("⏹ 同步已取消")
                        return False

                    if file_path.is_file():
                        # 跳过 .git 目录
                        if '.git' in file_path.parts:
                            continue
                        # 跳过过大文件（>100MB 提示）
                        fsize = file_path.stat().st_size
                        if fsize > 100 * 1024 * 1024:
                            self.log(f"   ⚠ 文件过大 ({fsize / 1024 / 1024:.1f}MB)，跳过: {file_path.name}")
                            skipped += 1
                            continue

                        rel = file_path.relative_to(local)
                        dest_file = dest_base / rel
                        dest_file.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(file_path, dest_file)
                        total_files += 1
                        total_size += fsize

        if total_files == 0:
            self.log("⚠ 没有文件被同步")
            return False

        self.log(f"   共 {total_files} 个文件，{self._format_size(total_size)}")
        if skipped:
            self.log(f"   跳过 {skipped} 个")

        # 4. Git 提交和推送
        self.log("📝 提交到 Git...")
        self._run_git('add', '-A')

        # 检查是否有变更
        ok, status_output = self._run_git('status', '--porcelain')
        if ok and not status_output:
            self.log("   没有变更，跳过提交")
            self.log("✅ 同步完成 (无变更)")
            return True

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        commit_msg = f'同步 {timestamp} | {total_files} 个文件 | {self._format_size(total_size)}'
        ok, _ = self._run_git('commit', '-m', commit_msg)
        if not ok:
            self.log("⚠ 提交失败（可能没有变更）")

        self.log("🚀 推送到远程仓库...")
        ok, output = self._run_git('push', 'origin', self.profile.branch)
        if not ok:
            self.log(f"❌ 推送失败: {output}")
            self.log("   提示: 请检查网络连接和仓库权限")
            return False

        elapsed = (datetime.now() - start_time).total_seconds()
        self.log(f"✅ 同步完成! 耗时 {elapsed:.1f} 秒")
        self.log(f"{'='*50}")
        return True

    def restore(self) -> bool:
        """从云端恢复文件到本地"""
        self._cancel_flag.clear()
        self.log(f"{'='*50}")
        self.log(f"📥 开始恢复: {self.profile.name}")

        # 1. 拉取最新
        if not self.setup_repo():
            self.log("❌ 仓库准备失败")
            return False

        self._run_git('pull', 'origin', self.profile.branch)

        # 2. 检查 files 目录
        if not self.files_dir.exists():
            self.log("❌ 仓库中没有 files 目录")
            return False

        # 3. 复制回本地
        restored_count = 0
        for sync_path in self.profile.sync_paths:
            if self._cancel_flag.is_set():
                self.log("⏹ 恢复已取消")
                return False

            local = Path(sync_path.local_path).expanduser()
            src_dir = self.files_dir / sync_path.sync_name

            if not src_dir.exists():
                self.log(f"⚠ 仓库中找不到: {sync_path.sync_name}")
                continue

            self.log(f"📁 恢复: files/{sync_path.sync_name}/ → {sync_path.local_path}")

            if src_dir.is_file():
                local.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_dir, local)
                restored_count += 1
                self.log(f"   ✓ {local.name}")
            elif src_dir.is_dir():
                for file_path in src_dir.rglob('*'):
                    if file_path.is_file():
                        rel = file_path.relative_to(src_dir)
                        dest_file = local / rel
                        dest_file.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(file_path, dest_file)
                        restored_count += 1

        self.log(f"   恢复了 {restored_count} 个文件")
        self.log(f"✅ 恢复完成!")
        self.log(f"{'='*50}")
        return True

    @staticmethod
    def _format_size(size_bytes: int) -> str:
        """格式化文件大小"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"


def sync_in_background(profile: Profile, log_callback: Callable[[str], None],
                       on_complete: Callable[[bool], None] = None):
    """在后台线程中执行同步"""
    engine = SyncEngine(profile, log_callback)

    def run():
        success = engine.sync()
        if on_complete:
            on_complete(success)

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return thread, engine


def restore_in_background(profile: Profile, log_callback: Callable[[str], None],
                          on_complete: Callable[[bool], None] = None):
    """在后台线程中执行恢复"""
    engine = SyncEngine(profile, log_callback)

    def run():
        success = engine.restore()
        if on_complete:
            on_complete(success)

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return thread, engine
