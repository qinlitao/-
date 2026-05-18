"""
配置管理模块：管理同步配置文件（Profile），每个 Profile 可包含多个同步路径。
"""
import json
import os
from pathlib import Path
from typing import List, Optional


# 配置文件默认路径：用户目录/.sync-tool/profiles.json
DEFAULT_CONFIG_DIR = Path.home() / '.sync-tool'
DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_DIR / 'profiles.json'
# Git 仓库缓存目录
REPO_CACHE_DIR = DEFAULT_CONFIG_DIR / 'repos'


class SyncPath:
    """单个同步路径的配置"""

    def __init__(self, local_path: str, sync_name: str = ''):
        self.local_path = local_path
        # 同步到仓库中的文件夹名称，默认取路径最后一段
        p = Path(local_path)
        self.sync_name = sync_name or p.name or p.anchor.replace(':', '_drive')

    def to_dict(self) -> dict:
        return {'local_path': self.local_path, 'sync_name': self.sync_name}

    @classmethod
    def from_dict(cls, d: dict) -> 'SyncPath':
        return cls(local_path=d['local_path'], sync_name=d.get('sync_name', ''))

    def __repr__(self):
        return f"SyncPath({self.local_path} -> {self.sync_name})"


class Profile:
    """同步配置"""

    def __init__(self, name: str, sync_paths: List[SyncPath],
                 github_repo: str, branch: str = 'main',
                 auth_type: str = 'ssh', auth_token: str = '',
                 git_user_name: str = '', git_user_email: str = ''):
        self.name = name
        self.sync_paths = sync_paths
        self.github_repo = github_repo
        self.branch = branch or 'main'
        self.auth_type = auth_type       # 'ssh' 或 'token'
        self.auth_token = auth_token     # HTTPS Personal Access Token
        self.git_user_name = git_user_name
        self.git_user_email = git_user_email

    @property
    def repo_url_with_auth(self) -> str:
        """返回带认证信息的仓库 URL"""
        if self.auth_type == 'token' and self.auth_token:
            # 将 https://github.com/user/repo 转为 https://token@github.com/user/repo
            url = self.github_repo
            if url.startswith('https://'):
                url = url.replace('https://', f'https://{self.auth_token}@')
            return url
        return self.github_repo

    @property
    def repo_cache_path(self) -> Path:
        """本地缓存仓库的路径"""
        safe_name = self.name.replace(' ', '_').replace('/', '_')
        return REPO_CACHE_DIR / safe_name

    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'sync_paths': [sp.to_dict() for sp in self.sync_paths],
            'github_repo': self.github_repo,
            'branch': self.branch,
            'auth_type': self.auth_type,
            'auth_token': self.auth_token,
            'git_user_name': self.git_user_name,
            'git_user_email': self.git_user_email,
        }

    @classmethod
    def from_dict(cls, d: dict) -> 'Profile':
        sync_paths = [SyncPath.from_dict(sp) for sp in d.get('sync_paths', [])]
        return cls(
            name=d['name'],
            sync_paths=sync_paths,
            github_repo=d.get('github_repo', ''),
            branch=d.get('branch', 'main'),
            auth_type=d.get('auth_type', 'ssh'),
            auth_token=d.get('auth_token', ''),
            git_user_name=d.get('git_user_name', ''),
            git_user_email=d.get('git_user_email', ''),
        )


class ConfigManager:
    """配置文件管理器"""

    def __init__(self, config_file=None):
        self.config_file = Path(config_file or DEFAULT_CONFIG_FILE)
        self.profiles: List[Profile] = []
        self.load()

    def load(self):
        """从磁盘加载配置"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self.profiles = [Profile.from_dict(p) for p in data.get('profiles', [])]
            except (json.JSONDecodeError, KeyError):
                self.profiles = []
        else:
            self.profiles = []

    def save(self):
        """保存配置到磁盘"""
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        data = {'profiles': [p.to_dict() for p in self.profiles]}
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def add_profile(self, profile: Profile):
        self.profiles.append(profile)
        self.save()

    def update_profile(self, name: str, profile: Profile):
        for i, p in enumerate(self.profiles):
            if p.name == name:
                self.profiles[i] = profile
                self.save()
                return True
        return False

    def remove_profile(self, name: str) -> bool:
        for i, p in enumerate(self.profiles):
            if p.name == name:
                self.profiles.pop(i)
                self.save()
                return True
        return False

    def get_profile(self, name: str) -> Optional[Profile]:
        for p in self.profiles:
            if p.name == name:
                return p
        return None

    def get_profile_names(self) -> List[str]:
        return [p.name for p in self.profiles]
