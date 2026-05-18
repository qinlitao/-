import wx
import wx.dataview as dataview
import win32gui
import win32con
import win32process
import webbrowser
import psutil
from core import tools as tool
from core.model import WindowInfo
from core.config import Config
from GUI.setting.binding_page import BindingPage
from core.tools import check_pssuspend_exists, is_admin, run_as_admin

class WindowRestorePanel(BindingPage):
    """继承BindingPage实现窗口恢复的面板"""
    def __init__(self, parent):
        super().__init__(parent)
        
    def init_UI(self):
        # 创建界面
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # 树形列表 - 复用BindingPage的列表设置方式
        self.left_treelist = dataview.TreeListCtrl(self, style=dataview.TL_CHECKBOX)
        self.left_treelist.AppendColumn('窗口标题', width=300)
        self.left_treelist.AppendColumn('窗口句柄', width=100)
        self.left_treelist.AppendColumn('进程PID', width=150)
        
        # 第一行按钮区域: 显示窗口，隐藏窗口，刷新窗口
        btn_sizer1 = wx.BoxSizer(wx.HORIZONTAL)
        self.show_btn = wx.Button(self, label="显示窗口")
        self.hide_btn = wx.Button(self, label="隐藏窗口")
        self.refresh_btn = wx.Button(self, label="刷新窗口")
        
        btn_sizer1.Add(self.show_btn, proportion=1, flag=wx.RIGHT, border=5)
        btn_sizer1.Add(self.hide_btn, proportion=1, flag=wx.LEFT|wx.RIGHT, border=5)
        btn_sizer1.Add(self.refresh_btn, proportion=1, flag=wx.LEFT, border=5)
        
        # 第二行按钮区域: 冻结进程，解冻进程
        btn_sizer2 = wx.BoxSizer(wx.HORIZONTAL)
        self.hide_freeze_btn = wx.Button(self, label="冻结进程")
        self.resume_btn = wx.Button(self, label="解冻进程")
        
        btn_sizer2.Add(self.hide_freeze_btn, proportion=1, flag=wx.RIGHT, border=5)
        btn_sizer2.Add(self.resume_btn, proportion=1, flag=wx.LEFT, border=5)
        
        # 布局
        main_sizer.Add(self.left_treelist, proportion=1, flag=wx.EXPAND|wx.LEFT|wx.RIGHT, border=5)
        main_sizer.Add(btn_sizer1, flag=wx.EXPAND|wx.ALL, border=10)
        main_sizer.Add(btn_sizer2, flag=wx.EXPAND|wx.LEFT|wx.RIGHT|wx.BOTTOM, border=10)
        
        self.SetSizer(main_sizer)
        
    def Bind_EVT(self):
        self.show_btn.Bind(wx.EVT_BUTTON, self.on_show_window)
        self.hide_btn.Bind(wx.EVT_BUTTON, self.on_hide_window)
        self.refresh_btn.Bind(wx.EVT_BUTTON, self.on_refresh_window)
        self.left_treelist.Bind(dataview.EVT_TREELIST_ITEM_CHECKED, self.OnToggleCheck)
        self.hide_freeze_btn.Bind(wx.EVT_BUTTON, self.on_hide_freeze_window)
        self.resume_btn.Bind(wx.EVT_BUTTON, self.on_resume_process)

    def SetData(self):
        self.RefreshLeftList()
        
        # 检查 pssuspend64 是否存在和管理员权限
        admin_status = is_admin()
        has_pssuspend = check_pssuspend_exists()
        
        if not has_pssuspend:
            self.hide_freeze_btn.SetToolTip(wx.ToolTip("需要 pssuspend64.exe 才能使用此功能"))
            self.resume_btn.SetToolTip(wx.ToolTip("需要 pssuspend64.exe 才能使用此功能"))
        elif not admin_status:
            self.hide_freeze_btn.SetToolTip(wx.ToolTip("需要管理员权限才能使用此功能"))
            self.resume_btn.SetToolTip(wx.ToolTip("需要管理员权限才能使用此功能"))
        else:
            self.hide_freeze_btn.Enable()
            self.resume_btn.Enable()
            
        # 如果没有管理员权限，添加请求管理员权限按钮
        if not admin_status:
            admin_button_sizer = wx.BoxSizer(wx.HORIZONTAL)
            self.admin_btn = wx.Button(self, label="获取管理员权限")
            self.admin_btn.Bind(wx.EVT_BUTTON, self.on_request_admin)
            admin_button_sizer.Add(self.admin_btn, proportion=1, flag=wx.ALL, border=5)
            self.GetSizer().Add(admin_button_sizer, flag=wx.EXPAND|wx.LEFT|wx.RIGHT|wx.BOTTOM, border=10)
            self.Layout()

    def RefreshLeftList(self, e=None):
        def enumHandler(hwnd, windows):
            title = tool.hwnd2windowName(hwnd)
            
            pid = win32process.GetWindowThreadProcessId(hwnd)[1]
            process_name = psutil.Process(pid).name()
            process_path = psutil.Process(pid).exe()
            
            windows.append(WindowInfo(
                title=title, 
                hwnd=int(hwnd), 
                process=process_name, 
                PID=int(pid), 
                path=process_path
            ))
            return True

        windows = []
        win32gui.EnumWindows(enumHandler, windows)
        windows.sort(key=lambda x: x.title)
        self.InsertTreeList(windows, self.left_treelist, True)
        
    def on_refresh_window(self, e=None):
        """刷新窗口列表"""
        self.RefreshLeftList()
        
    def on_show_window(self, e=None):
        windows = self.ItemsData(self.left_treelist, only_checked=True)
        if not windows:
            wx.MessageBox("请先选择要显示的窗口", "提示", wx.OK | wx.ICON_INFORMATION)
            return
            
        result = wx.MessageBox(f"将恢复{len(windows)}个窗口\r\n恢复未知的窗口可能会导致窗口出错", "警告", wx.OK | wx.CANCEL | wx.ICON_WARNING)
        if result != wx.OK:
            return
        for window in windows:
            win32gui.ShowWindow(window.hwnd, win32con.SW_SHOW)

    def on_hide_window(self, e=None):
        windows = self.ItemsData(self.left_treelist, only_checked=True)
        if not windows:
            wx.MessageBox("请先选择要隐藏的窗口", "提示", wx.OK | wx.ICON_INFORMATION)
            return
            
        result = wx.MessageBox(f"将隐藏{len(windows)}个窗口\r\n隐藏未知的窗口可能会导致窗口出错", "警告", wx.OK | wx.CANCEL | wx.ICON_WARNING)        
        if result != wx.OK:
            return
        for window in windows:
            win32gui.ShowWindow(window.hwnd, win32con.SW_HIDE)
            
    def on_hide_freeze_window(self, e=None):
        # 检查 pssuspend64 是否存在
        if not check_pssuspend_exists():
            dlg = wx.MessageDialog(self, 
                "未检测到pssuspend64.exe文件！\n请先下载并放置到程序根目录，然后重试。\n\n您可以从以下链接下载：\nhttps://download.sysinternals.com/files/PSTools.zip",
                "无法冻结进程", wx.OK | wx.ICON_ERROR)
            dlg.SetOKLabel("确定")
            dlg.SetOKCancelLabels("确定", "下载")
            result = dlg.ShowModal()
            if result == wx.ID_CANCEL:
                webbrowser.open("https://download.sysinternals.com/files/PSTools.zip")
            dlg.Destroy()
            return
            
        # 检查管理员权限
        if not is_admin():
            wx.MessageBox("此功能需要管理员权限才能使用！\n请点击\"获取管理员权限\"按钮重启程序。",
                         "权限不足", wx.OK | wx.ICON_ERROR)
            return
            
        windows = self.ItemsData(self.left_treelist, only_checked=True)
        if not windows:
            wx.MessageBox("请先选择要冻结的窗口进程", "提示", wx.OK | wx.ICON_INFORMATION)
            return
            
        result = wx.MessageBox(f"将冻结{len(windows)}个进程\n冻结未知的进程可能会导致系统不稳定", "警告", 
                             wx.OK | wx.CANCEL | wx.ICON_WARNING)
        if result != wx.OK:
            return
            
        for window in windows:
            try:
                if hasattr(window, 'PID') and window.PID:
                    tool.suspend_process_enhanced(window.PID)
            except Exception as e:
                wx.MessageBox(f"冻结失败: {str(e)}", "错误", wx.OK | wx.ICON_ERROR)
                
    def on_resume_process(self, e=None):
        # 检查 pssuspend64 是否存在
        if not check_pssuspend_exists():
            dlg = wx.MessageDialog(self, 
                "未检测到pssuspend64.exe文件！\n请先下载并放置到程序根目录，然后重试。\n\n您可以从以下链接下载：\nhttps://download.sysinternals.com/files/PSTools.zip",
                "无法解冻进程", wx.OK | wx.ICON_ERROR)
            dlg.SetOKLabel("确定")
            dlg.SetOKCancelLabels("确定", "下载")
            result = dlg.ShowModal()
            if result == wx.ID_CANCEL:
                webbrowser.open("https://download.sysinternals.com/files/PSTools.zip")
            dlg.Destroy()
            return
            
        # 检查管理员权限
        if not is_admin():
            wx.MessageBox("此功能需要管理员权限才能使用！\n请点击\"获取管理员权限\"按钮重启程序。",
                         "权限不足", wx.OK | wx.ICON_ERROR)
            return
            
        windows = self.ItemsData(self.left_treelist, only_checked=True)
        if not windows:
            wx.MessageBox("请先选择要解冻的窗口进程", "提示", wx.OK | wx.ICON_INFORMATION)
            return
            
        result = wx.MessageBox(f"将解冻{len(windows)}个进程", "确认", wx.OK | wx.CANCEL | wx.ICON_QUESTION)
        if result != wx.OK:
            return
            
        for window in windows:
            try:
                if hasattr(window, 'PID') and window.PID:
                    tool.resume_process_enhanced(window.PID)
            except Exception as e:
                wx.MessageBox(f"解冻失败: {str(e)}", "错误", wx.OK | wx.ICON_ERROR)

    def on_request_admin(self, e=None):
        """请求管理员权限"""
        wx.MessageBox("程序将重启并请求管理员权限", "提示", wx.OK | wx.ICON_INFORMATION)
        run_as_admin()
        wx.GetApp().GetTopWindow().Close()
        wx.GetApp().ExitMainLoop()


class WindowRestoreDialog(wx.Frame):
    def __init__(self, id):
        wx.Frame.__init__(self, None, id=id, title="窗口恢复工具 - Boss Key", style=wx.DEFAULT_FRAME_STYLE | wx.RESIZE_BORDER)
        self.SetIcon(wx.Icon(wx.Image(Config.icon).ConvertToBitmap()))
        self.SetSize((700, 600))
        self.Center()
        
        # 使用继承自BindingPage的面板
        self.panel = WindowRestorePanel(self)
        
        # 创建框架布局
        sizer = wx.BoxSizer(wx.VERTICAL)
        sizer.Add(self.panel, 1, wx.EXPAND)
        self.SetSizer(sizer)
        
        # 设置初始数据
        self.panel.SetData()
        
    def Restore(self):
        """恢复窗口，用于taskbar.py中调用"""
        self.Show()