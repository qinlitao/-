import wx
from core.config import Config
import core.tools as tool
from .binding_page import BindingPage
from .hotkeys_page import HotkeysPage
from .options_page import OptionsPage

class SettingWindow(wx.Frame):
    def __init__(self, id=None):
        super().__init__(None, id=id, title="设置 - Boss Key", style=wx.DEFAULT_FRAME_STYLE | wx.RESIZE_BORDER)
        self.SetIcon(wx.Icon(wx.Image(Config.icon).ConvertToBitmap()))
        
        self.init_UI()
        self.InitMenu()
        self.Bind_EVT()
        self.SetData()
        self.SetSize((1500, 800))
        self.Center()

    def init_UI(self):
        panel = wx.Panel(self)
        self.infobar = wx.InfoBar(panel)
        sizer = wx.BoxSizer(wx.VERTICAL)
        
        # 创建notebook
        self.notebook = wx.Notebook(panel)
        
        # 添加各个设置页面
        self.binding_page = BindingPage(self.notebook)
        self.hotkeys_page = HotkeysPage(self.notebook)
        self.options_page = OptionsPage(self.notebook)
        
        self.notebook.AddPage(self.binding_page, "窗口绑定")
        self.notebook.AddPage(self.hotkeys_page, "热键设置")
        self.notebook.AddPage(self.options_page, "其他选项")
        
        sizer.Add(self.infobar, 0, wx.EXPAND | wx.ALL, 5)
        sizer.Add(self.notebook, 1, wx.EXPAND | wx.ALL, 5)
        
        # 创建按钮
        button_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.reset_btn = wx.Button(panel, label="重置设置", size=(-1, 50))
        self.save_btn = wx.Button(panel, label="保存设置", size=(-1, 50))
        button_sizer.Add(self.reset_btn, proportion=1, flag=wx.LEFT, border=20)
        button_sizer.Add(self.save_btn, proportion=1, flag=wx.RIGHT, border=20)
        
        sizer.Add(button_sizer, 0, wx.EXPAND | wx.ALL, 10)
        
        # 设置提示
        if Config.first_start:
            self.infobar.ShowMessage("欢迎使用 Boss Key！本页面仅在首次启动或内容有更新时自动显示，后续可通过托盘图标打开本页面", wx.ICON_INFORMATION)
        
        panel.SetSizer(sizer)
        sizer.Fit(self)

    def InitMenu(self):
        ## 创建菜单栏
        menuBar = wx.MenuBar()
        menu1 = wx.Menu()
        menu1.Append(101, "检查更新")
        menu1.Append(wx.ID_ABOUT, "关于程序")
        menu1.AppendSeparator()
        menu1.Append(wx.ID_EXIT, "退出程序")
        menuBar.Append(menu1, "关于(&A)")

        menu2 = wx.Menu()
        menu2.Append(201, "开机自启", kind=wx.ITEM_CHECK)
        menu2.Append(202, "窗口恢复工具")
        menuBar.Append(menu2, "工具(&T)")

        # menuBar.Append(300, "帮助(&H)")

        self.SetMenuBar(menuBar)

        ## 绑定菜单事件
        self.Bind(wx.EVT_MENU, Config.TaskBarIcon.onUpdate, id=101)
        self.Bind(wx.EVT_MENU, Config.TaskBarIcon.onAbout, id=wx.ID_ABOUT)
        self.Bind(wx.EVT_MENU, Config.TaskBarIcon.onExit, id=wx.ID_EXIT)
        self.Bind(wx.EVT_MENU, Config.TaskBarIcon.onStartup, id=201)
        self.Bind(wx.EVT_MENU_OPEN, self.OnUpdateStartupStatus)
        self.Bind(wx.EVT_MENU, Config.TaskBarIcon.onRestore, id=202)
        # self.Bind(wx.EVT_MENU, self.OnHelp, id=300)

    def Bind_EVT(self):
        self.save_btn.Bind(wx.EVT_BUTTON, self.OnSave)
        self.reset_btn.Bind(wx.EVT_BUTTON, self.OnReset)
        self.Bind(wx.EVT_CLOSE, self.OnClose)

    def SetData(self):
        Config.load()
        self.binding_page.SetData()
        self.hotkeys_page.SetData()
        self.options_page.SetData()

    def OnSave(self, e):
        # 从各页面获取数据
        self.binding_page.SaveData()
        self.hotkeys_page.SaveData()
        self.options_page.SaveData()
        
        # 应用更改
        Config.HotkeyListener.ShowWindows(load=False)
        Config.save()
        try:
            Config.HotkeyListener.reBind()
            wx.MessageDialog(None, "保存成功", "Boss Key", wx.OK | wx.ICON_INFORMATION).ShowModal()
        except:
            wx.MessageDialog(None, "热键绑定失败，请重试", "Boss Key", wx.OK | wx.ICON_ERROR).ShowModal()

    def OnReset(self, e):
        # 重置所有设置
        self.binding_page.Reset()
        self.hotkeys_page.Reset()
        self.options_page.Reset()
        wx.MessageDialog(None, "已重置选项，请保存设置以启用", "Boss Key", wx.OK | wx.ICON_INFORMATION).ShowModal()

    def OnClose(self, e):
        self.Hide()

    def OnUpdateStartupStatus(self, e=""):
        # 更新菜单项的选中状态
        print(1)
        self.GetMenuBar().FindItemById(201).Check(tool.checkStartup("Boss Key Application", Config.file_path))
        
    def RefreshLeftList(self, e=None):
        """刷新左侧列表，供外部调用"""
        self.binding_page.RefreshLeftList()
