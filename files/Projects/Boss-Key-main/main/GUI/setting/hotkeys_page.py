import wx
from core.config import Config
import GUI.record as record

import wx.lib.scrolledpanel as scrolled

class HotkeysPage(scrolled.ScrolledPanel):
    def __init__(self, parent):
        super().__init__(parent)
        self.init_UI()
        self.Bind_EVT()
        self.SetupScrolling()
        
    def init_UI(self):
        sizer = wx.BoxSizer(wx.VERTICAL)
        
        # 创建键盘热键设置区域
        keyboard_box = wx.StaticBox(self, label="键盘热键")
        keyboard_box_sizer = wx.StaticBoxSizer(keyboard_box, wx.VERTICAL)
        
        grid_sizer = wx.FlexGridSizer(rows=2, cols=3, gap=(10, 20))
        grid_sizer.AddGrowableCol(1, 1)
        
        # 隐藏/显示窗口热键
        hide_show_label = wx.StaticText(self, label="隐藏/显示窗口热键:")
        self.hide_show_text = wx.TextCtrl(self)
        self.hide_show_btn = wx.Button(self, label="录制热键")
        
        grid_sizer.Add(hide_show_label, 0, wx.ALIGN_CENTER_VERTICAL | wx.ALL, 10)
        grid_sizer.Add(self.hide_show_text, 1, wx.EXPAND | wx.ALL, 10)
        grid_sizer.Add(self.hide_show_btn, 0, wx.EXPAND | wx.ALL, 10)
        
        # 一键关闭程序热键
        close_label = wx.StaticText(self, label="一键关闭程序热键:")
        self.close_text = wx.TextCtrl(self)
        self.close_btn = wx.Button(self, label="录制热键")
        
        grid_sizer.Add(close_label, 0, wx.ALIGN_CENTER_VERTICAL | wx.ALL, 10)
        grid_sizer.Add(self.close_text, 1, wx.EXPAND | wx.ALL, 10)
        grid_sizer.Add(self.close_btn, 0, wx.EXPAND | wx.ALL, 10)
        
        keyboard_box_sizer.Add(grid_sizer, 0, wx.EXPAND | wx.ALL, 5)
        sizer.Add(keyboard_box_sizer, 0, wx.EXPAND | wx.ALL, 10)
        
        # 添加鼠标隐藏选项
        mouse_box = wx.StaticBox(self, label="鼠标隐藏")
        mouse_box_sizer = wx.StaticBoxSizer(mouse_box, wx.VERTICAL)

        mouse_grid_sizer = wx.GridSizer(rows=1, cols=3, gap=(10, 10))
        
        # 中键选项
        self.middle_button_checkbox = wx.CheckBox(self, label="启用鼠标中键切换隐藏")
        self.middle_button_checkbox.SetToolTip(wx.ToolTip("点击鼠标中键可快速隐藏/显示窗口"))
        
        # 侧键1选项
        self.side_button1_checkbox = wx.CheckBox(self, label="启用鼠标侧键1切换隐藏")
        self.side_button1_checkbox.SetToolTip(wx.ToolTip("点击鼠标侧键1(前进键)可快速隐藏/显示窗口"))
        
        # 侧键2选项
        self.side_button2_checkbox = wx.CheckBox(self, label="启用鼠标侧键2切换隐藏")
        self.side_button2_checkbox.SetToolTip(wx.ToolTip("点击鼠标侧键2(后退键)可快速隐藏/显示窗口"))
        
        mouse_grid_sizer.Add(self.middle_button_checkbox, 0, wx.ALL, 10)
        mouse_grid_sizer.Add(self.side_button1_checkbox, 0, wx.ALL, 10)
        mouse_grid_sizer.Add(self.side_button2_checkbox, 0, wx.ALL, 10)

        mouse_move_grid_sizer = wx.GridSizer(rows=2, cols=2, gap=(10, 10))
        
        # 左上角
        self.top_left_checkbox = wx.CheckBox(self, label="左上角快速隐藏")
        self.top_left_checkbox.SetToolTip(wx.ToolTip("快速移动鼠标至左上角以隐藏窗口"))
        mouse_move_grid_sizer.Add(self.top_left_checkbox, 0, wx.ALL, 10)
        
        # 右上角
        self.top_right_checkbox = wx.CheckBox(self, label="右上角快速隐藏")
        self.top_right_checkbox.SetToolTip(wx.ToolTip("快速移动鼠标至右上角以隐藏窗口"))
        mouse_move_grid_sizer.Add(self.top_right_checkbox, 0, wx.ALL, 10)
        
        # 左下角
        self.bottom_left_checkbox = wx.CheckBox(self, label="左下角快速隐藏")
        self.bottom_left_checkbox.SetToolTip(wx.ToolTip("快速移动鼠标至左下角以隐藏窗口"))
        mouse_move_grid_sizer.Add(self.bottom_left_checkbox, 0, wx.ALL, 10)
        
        # 右下角
        self.bottom_right_checkbox = wx.CheckBox(self, label="右下角快速隐藏")
        self.bottom_right_checkbox.SetToolTip(wx.ToolTip("快速移动鼠标至右下角以隐藏窗口"))
        mouse_move_grid_sizer.Add(self.bottom_right_checkbox, 0, wx.ALL, 10)

        mouse_box_sizer.Add(mouse_grid_sizer, 0, wx.EXPAND | wx.ALL, 10)
        mouse_box_sizer.Add(mouse_move_grid_sizer, 0, wx.EXPAND | wx.ALL, 10)
        
        # 添加允许移动恢复选项
        self.allow_move_restore_checkbox = wx.CheckBox(self, label="启用移动恢复窗口")
        self.allow_move_restore_checkbox.SetToolTip(wx.ToolTip("启用后可通过移动鼠标到同一角落恢复已隐藏的窗口"))
        mouse_box_sizer.Add(self.allow_move_restore_checkbox, 0, wx.ALL, 10)
        
        sizer.Add(mouse_box_sizer, 0, wx.EXPAND | wx.ALL, 10)
        
        # 添加其他选项区域
        other_box = wx.StaticBox(self, label="其他")
        other_box_sizer = wx.StaticBoxSizer(other_box, wx.VERTICAL)
        
        # 自动隐藏选项
        auto_hide_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.auto_hide_checkbox = wx.CheckBox(self, label="自动隐藏：")
        self.auto_hide_checkbox.SetToolTip(wx.ToolTip("在无操作指定时间后自动隐藏窗口"))
        auto_hide_sizer.Add(self.auto_hide_checkbox, 0, wx.ALIGN_CENTER_VERTICAL)
        
        # 自动隐藏时间输入框
        self.auto_hide_time = wx.SpinCtrl(self, min=1, max=120, initial=5)
        self.auto_hide_time.SetToolTip(wx.ToolTip("设置多少分钟无操作后自动隐藏"))
        auto_hide_sizer.Add(self.auto_hide_time, 0, wx.LEFT, 10)
        
        # 分钟标签
        minutes_label = wx.StaticText(self, label="分钟")
        auto_hide_sizer.Add(minutes_label, 0, wx.ALIGN_CENTER_VERTICAL | wx.LEFT, 5)
        
        other_box_sizer.Add(auto_hide_sizer, 0, wx.ALL, 10)
        
        # 灰色文本提示
        auto_hide_tip = wx.StaticText(self, label="当键盘和鼠标在指定时间内无操作时，将自动隐藏窗口")
        auto_hide_tip.SetForegroundColour(wx.Colour(128, 128, 128))  # 灰色文本
        other_box_sizer.Add(auto_hide_tip, 0, wx.ALL, 10)
        
        sizer.Add(other_box_sizer, 0, wx.EXPAND | wx.ALL, 10)
        
        self.SetSizer(sizer)
        
    def Bind_EVT(self):
        self.hide_show_btn.Bind(wx.EVT_BUTTON, self.OnRecordHideShow)
        self.close_btn.Bind(wx.EVT_BUTTON, self.OnRecordClose)
        self.auto_hide_checkbox.Bind(wx.EVT_CHECKBOX, self.OnAutoHideToggle)
        
    def OnAutoHideToggle(self, e):
        # 启用或禁用时间输入框
        self.auto_hide_time.Enable(self.auto_hide_checkbox.GetValue())
        
    def SetData(self):
        self.hide_show_text.SetValue(Config.hide_hotkey)
        self.close_text.SetValue(Config.close_hotkey)
        self.middle_button_checkbox.SetValue(Config.middle_button_hide if hasattr(Config, 'middle_button_hide') else False)
        self.side_button1_checkbox.SetValue(Config.side_button1_hide if hasattr(Config, 'side_button1_hide') else False)
        self.side_button2_checkbox.SetValue(Config.side_button2_hide if hasattr(Config, 'side_button2_hide') else False)
        
        # 设置自动隐藏选项
        auto_hide_enabled = Config.auto_hide_enabled if hasattr(Config, 'auto_hide_enabled') else False
        self.auto_hide_checkbox.SetValue(auto_hide_enabled)
        
        auto_hide_time = Config.auto_hide_time if hasattr(Config, 'auto_hide_time') else 5
        self.auto_hide_time.SetValue(auto_hide_time)
        self.auto_hide_time.Enable(auto_hide_enabled)
        
        # 设置鼠标移动至四角隐藏选项
        self.top_left_checkbox.SetValue(Config.top_left_hide if hasattr(Config, 'top_left_hide') else False)
        self.top_right_checkbox.SetValue(Config.top_right_hide if hasattr(Config, 'top_right_hide') else False)
        self.bottom_left_checkbox.SetValue(Config.bottom_left_hide if hasattr(Config, 'bottom_left_hide') else False)
        self.bottom_right_checkbox.SetValue(Config.bottom_right_hide if hasattr(Config, 'bottom_right_hide') else False)
        self.allow_move_restore_checkbox.SetValue(Config.allow_move_restore if hasattr(Config, 'allow_move_restore') else False)
        
    def SaveData(self):
        Config.hide_hotkey = self.hide_show_text.GetValue()
        Config.close_hotkey = self.close_text.GetValue()
        Config.middle_button_hide = self.middle_button_checkbox.GetValue()
        Config.side_button1_hide = self.side_button1_checkbox.GetValue()
        Config.side_button2_hide = self.side_button2_checkbox.GetValue()
        
        # 保存自动隐藏设置
        Config.auto_hide_enabled = self.auto_hide_checkbox.GetValue()
        Config.auto_hide_time = self.auto_hide_time.GetValue()
        
        # 保存鼠标移动至四角隐藏设置
        Config.top_left_hide = self.top_left_checkbox.GetValue()
        Config.top_right_hide = self.top_right_checkbox.GetValue()
        Config.bottom_left_hide = self.bottom_left_checkbox.GetValue()
        Config.bottom_right_hide = self.bottom_right_checkbox.GetValue()
        Config.allow_move_restore = self.allow_move_restore_checkbox.GetValue()
        
    def Reset(self):
        self.hide_show_text.SetValue("Ctrl+Q")
        self.close_text.SetValue("Win+Esc")
        self.middle_button_checkbox.SetValue(False)
        self.side_button1_checkbox.SetValue(False)
        self.side_button2_checkbox.SetValue(False)
        self.auto_hide_checkbox.SetValue(False)
        self.auto_hide_time.SetValue(5)
        self.auto_hide_time.Enable(False)
        
        # 重置鼠标移动至四角隐藏设置
        self.top_left_checkbox.SetValue(False)
        self.top_right_checkbox.SetValue(False)
        self.bottom_left_checkbox.SetValue(False)
        self.bottom_right_checkbox.SetValue(False)
        self.allow_move_restore_checkbox.SetValue(False)
        
    def OnRecordHideShow(self, e):
        self.recordHotkey(self.hide_show_text, self.hide_show_btn)
        
    def OnRecordClose(self, e):
        self.recordHotkey(self.close_text, self.close_btn)
        
    def recordHotkey(self, text_ctrl: wx.TextCtrl, btn: wx.Button):
        try:
            Config.HotkeyListener._stop()
        except:
            pass
        btn.Disable()
        btn.SetLabel("录制中...")
        record.RecordedHotkey.confirm = False
        RecordWindow = record.RecordWindow()
        RecordWindow.ShowModal()
        btn.Enable()
        btn.SetLabel("录制热键")
        if record.RecordedHotkey.confirm:
            text_ctrl.SetValue(record.RecordedHotkey.final_key)