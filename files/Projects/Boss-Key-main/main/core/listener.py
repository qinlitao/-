from core.config import Config
import core.tools as tool
from win32gui import GetForegroundWindow, ShowWindow
from win32con import SW_HIDE, SW_SHOW
import win32process
import win32api
import sys
from pynput import keyboard, mouse
import multiprocessing
import threading
import time
import os
import wx

class HotkeyListener():
    def __init__(self):
        # 先定义所有属性
        self.Queue = multiprocessing.Queue()
        self.listener = None
        self.mouse_listener = None
        self.mouse_move_listener = None  # 鼠标移动监听器
        self.keyboard_activity_listener = None
        self.mouse_activity_listener = None
        self.last_activity_time = time.time()
        self.auto_hide_timer = None
        self.shared_state_file = os.path.join(Config.root_path, ".bosskey_state")
        self.end_flag = False
        
        # 角落边界检测参数
        self.corner_threshold = 10  # 角落检测的阈值（像素）
        self.corner_cooldown = 1.0  # 角落触发的冷却时间（秒）
        self.last_corner_trigger = 0  # 上次角落触发的时间戳
        # 使用win32api获取屏幕尺寸
        self.screen_width = win32api.GetSystemMetrics(0)  # SM_CXSCREEN常量为0
        self.screen_height = win32api.GetSystemMetrics(1)  # SM_CYSCREEN常量为1
        
        try:
            self.ShowWindows()
        except:
            pass
        tool.sendNotify("Boss Key正在运行！", "Boss Key正在为您服务，您可通过托盘图标看到我")
        
        self.reBind()
        threading.Thread(target=self.listenToQueue, daemon=True).start()
        
        # 启动自动隐藏监控（如果启用）
        self.start_auto_hide_monitor()

    def listenToQueue(self):
        exit_flag = False
        while True:
            try:
                msg = self.Queue.get()
                if msg == "showTaskBarIcon":
                    wx.CallAfter(Config.TaskBarIcon.ShowIcon())
                elif msg == "hideTaskBarIcon":
                    wx.CallAfter(Config.TaskBarIcon.HideIcon())
                elif msg == "closeApp":
                    print("收到关闭消息")
                    self.ShowWindows()
                    tool.sendNotify("Boss Key已停止服务", "Boss Key已成功退出")
                    self._stop()
                    try:
                        wx.GetApp().ExitMainLoop()
                    except Exception as e:
                        print(e)
                        pass
                    exit_flag = True
                    break
            except:
                pass
            finally:
                if exit_flag:
                    sys.exit(0)

    def reBind(self):
        self._stop()
        self.BindHotKey()
        # 如果启用了任何鼠标按键隐藏，则添加鼠标监听
        if (hasattr(Config, 'middle_button_hide') and Config.middle_button_hide) or \
           (hasattr(Config, 'side_button1_hide') and Config.side_button1_hide) or \
           (hasattr(Config, 'side_button2_hide') and Config.side_button2_hide):
            self.start_mouse_listener()
            
        # 如果启用了任何屏幕角落隐藏，则添加鼠标移动监听
        if (hasattr(Config, 'top_left_hide') and Config.top_left_hide) or \
           (hasattr(Config, 'top_right_hide') and Config.top_right_hide) or \
           (hasattr(Config, 'bottom_left_hide') and Config.bottom_left_hide) or \
           (hasattr(Config, 'bottom_right_hide') and Config.bottom_right_hide):
            self.start_mouse_move_listener()
        
        # 启动自动隐藏监控（如果启用）
        self.start_auto_hide_monitor()
        
    def start_auto_hide_monitor(self):
        """启动自动隐藏监控"""
        # 停止之前的监控
        self.stop_auto_hide_monitor()
        
        # 检查是否启用了自动隐藏
        if hasattr(Config, 'auto_hide_enabled') and Config.auto_hide_enabled:
            # 启动活动监听器
            self.start_activity_listeners()
            
            # 启动定时器，每5秒检查一次是否需要自动隐藏
            self.auto_hide_timer = threading.Timer(5, self.check_auto_hide)
            self.auto_hide_timer.daemon = True
            self.auto_hide_timer.start()
            
    def stop_auto_hide_monitor(self):
        """停止自动隐藏监控"""
        # 停止定时器
        if self.auto_hide_timer:
            self.auto_hide_timer.cancel()
            self.auto_hide_timer = None
            
        # 停止活动监听器
        self.stop_activity_listeners()
            
    def start_activity_listeners(self):
        """启动键盘和鼠标活动监听器"""
        # 停止之前的监听器
        self.stop_activity_listeners()
        
        # 启动键盘活动监听器
        self.keyboard_activity_listener = keyboard.Listener(on_press=self.on_activity)
        self.keyboard_activity_listener.daemon = True
        self.keyboard_activity_listener.start()
        
        # 启动鼠标活动监听器
        self.mouse_activity_listener = mouse.Listener(
            on_move=self.on_activity,
            on_click=self.on_activity,
            on_scroll=self.on_activity
        )
        self.mouse_activity_listener.daemon = True
        self.mouse_activity_listener.start()
        
    def stop_activity_listeners(self):
        """停止键盘和鼠标活动监听器"""
        if self.keyboard_activity_listener:
            self.keyboard_activity_listener.stop()
            self.keyboard_activity_listener = None
            
        if self.mouse_activity_listener:
            self.mouse_activity_listener.stop()
            self.mouse_activity_listener = None
            
    def on_activity(self, *args, **kwargs):
        """记录最后一次活动时间"""
        self.last_activity_time = time.time()
        
    def check_auto_hide(self):
        """检查是否需要自动隐藏"""
        try:
            # 重新加载配置
            if hasattr(Config, 'auto_hide_enabled') and Config.auto_hide_enabled:
                # 计算闲置时间（秒）
                idle_time = time.time() - self.last_activity_time
                # 转换自动隐藏时间为秒
                auto_hide_seconds = Config.auto_hide_time * 60
                
                # 如果闲置时间超过设定的自动隐藏时间，且窗口当前是显示状态
                if idle_time >= auto_hide_seconds and self.get_windows_state() == 1:
                    # 执行隐藏操作，修复了这里的错误调用
                    wx.CallAfter(self.onHide)
        
        finally:
            # 如果仍然启用了自动隐藏，则设置下一次检查
            if hasattr(Config, 'auto_hide_enabled') and Config.auto_hide_enabled:
                self.auto_hide_timer = threading.Timer(5, self.check_auto_hide)
                self.auto_hide_timer.daemon = True
                self.auto_hide_timer.start()
            
    def start_mouse_listener(self):
        """启动鼠标监听器"""
        if self.mouse_listener is None or not self.mouse_listener.is_alive():
            self.mouse_listener = mouse.Listener(on_click=self.on_mouse_click)
            self.mouse_listener.daemon = True
            self.mouse_listener.start()
            
    def on_mouse_click(self, x, y, button, pressed):
        """鼠标点击事件处理"""
        if pressed:  # 只在按下时触发，不在松开时触发
            if (button == mouse.Button.middle and Config.middle_button_hide) or \
               (button == mouse.Button.x1 and Config.side_button1_hide) or \
               (button == mouse.Button.x2 and Config.side_button2_hide):
                # 在主线程中执行onHide
                wx.CallAfter(self.onHide)

    def start_mouse_move_listener(self):
        """启动鼠标移动监听器"""
        if self.mouse_move_listener is None or not self.mouse_move_listener.is_alive():
            self.mouse_move_listener = mouse.Listener(on_move=self.on_mouse_move)
            self.mouse_move_listener.daemon = True
            self.mouse_move_listener.start()
    
    def on_mouse_move(self, x, y):
        """鼠标移动事件处理，检测四个角落"""
        now = time.time()
        # 如果冷却时间未过，则不处理
        if now - self.last_corner_trigger < self.corner_cooldown:
            return
            
        # 获取当前窗口状态，1=显示，0=隐藏
        current_state = self.get_windows_state()
        
        # 检测是否在角落区域
        corner_detected = None
        
        # 左上角
        if x <= self.corner_threshold and y <= self.corner_threshold:
            if Config.top_left_hide:
                corner_detected = "top_left"
        
        # 右上角
        elif x >= self.screen_width - self.corner_threshold and y <= self.corner_threshold:
            if Config.top_right_hide:
                corner_detected = "top_right"
        
        # 左下角
        elif x <= self.corner_threshold and y >= self.screen_height - self.corner_threshold:
            if Config.bottom_left_hide:
                corner_detected = "bottom_left"
        
        # 右下角
        elif x >= self.screen_width - self.corner_threshold and y >= self.screen_height - self.corner_threshold:
            if Config.bottom_right_hide:
                corner_detected = "bottom_right"
        
        # 如果检测到角落并且满足条件
        if corner_detected:
            # 根据当前状态和恢复设置决定是否执行操作
            if current_state == 1 or (current_state == 0 and Config.allow_move_restore):
                wx.CallAfter(self.onHide)
                self.last_corner_trigger = now

    def ListenerProcess(self, hotkey):
        """键盘热键监听进程"""
        try:
            with keyboard.GlobalHotKeys(hotkey) as listener:
                self.end_flag = False
                while listener.running and not self.end_flag:
                    time.sleep(0.1)  # 减少CPU使用率
                
                # 如果是因为 end_flag 退出但监听器仍在运行
                if listener.running and self.end_flag:
                    listener.stop()
                    
                print("热键监听已停止")
        except Exception as e:
            # 热键监听出错时尝试恢复窗口
            self.set_windows_state(1)  # 强制设置状态为显示
            print(f"热键监听出错: {e}")

    def BindHotKey(self):
        hotkeys = {
            Config.hide_hotkey: self.onHide,
            Config.close_hotkey: self.Close
        }
        hotkeys = tool.keyConvert(hotkeys)
                
        self.listener = multiprocessing.Process(target=self.ListenerProcess, daemon=True, args=(hotkeys,), name="Boss-Key热键监听进程")
        self.listener.start()

    def get_windows_state(self):
        """获取窗口状态，1=显示，0=隐藏"""
        try:
            if os.path.exists(self.shared_state_file):
                with open(self.shared_state_file, 'r') as f:
                    return int(f.read().strip() or '1')
            return 1  # 默认状态为显示
        except:
            return 1  # 出错时默认状态为显示
            
    def set_windows_state(self, state):
        """设置窗口状态，1=显示，0=隐藏"""
        try:
            with open(self.shared_state_file, 'w') as f:
                f.write(str(state))
            Config.times = state  # 同时更新内存中的状态
        except Exception as e:
            print(f"设置窗口状态失败: {e}")

    def onHide(self, e=""):
        """根据当前状态切换窗口显示/隐藏"""
        # 从共享状态文件获取当前状态
        current_state = self.get_windows_state()
        
        if current_state == 1:
            # 隐藏窗口
            self.HideWindows()
        else:
            # 显示窗口
            self.ShowWindows()

    def ShowWindows(self, load=True):
        """显示之前隐藏的窗口"""
        if load:
            Config.load()
            
        # 如果有冻结的进程，先解冻
        if Config.freeze_after_hide and Config.frozen_pids:
            for pid in Config.frozen_pids:
                try:
                    tool.resume_process(pid)
                except Exception as e:
                    print(f"解冻进程失败: {e}")
            Config.frozen_pids = []
            
        for i in Config.history:
            ShowWindow(i, SW_SHOW)
            if Config.mute_after_hide:
                tool.changeMute(i, 0)

        if Config.hide_icon_after_hide:
            self.Queue.put("showTaskBarIcon")
                
        # 更新状态
        self.set_windows_state(1)
        Config.save()
    
    def HideWindows(self):
        """隐藏指定的窗口"""
        Config.load()
        needHide = []
        frozen_pids = []
        windows = tool.getAllWindows()
        
        outer = windows
        inner = Config.hide_binding

        # 减少循环次数，选择相对较少的做外循环
        if len(Config.hide_binding) < len(windows):
            outer = Config.hide_binding
            inner = windows

        for i in outer:
            for j in inner:
                if tool.isSameWindow(i, j, False, not Config.path_match):
                    if outer == Config.hide_binding:  # 此时i是绑定的元素，j是窗口元素，需要隐藏j
                        needHide.append(j.hwnd)
                        if Config.freeze_after_hide and hasattr(j, 'PID') and j.PID:
                            frozen_pids.append(j.PID)
                    else:
                        needHide.append(i.hwnd)
                        if Config.freeze_after_hide and hasattr(i, 'PID') and i.PID:
                            frozen_pids.append(i.PID)
                    break

        if Config.hide_current:  # 插入当前窗口的句柄
            hwnd = GetForegroundWindow()
            needHide.append(hwnd)
            # 如果需要冻结进程，获取当前窗口的PID
            if Config.freeze_after_hide:
                try:
                    pid = win32process.GetWindowThreadProcessId(hwnd)[1]
                    current_pid = win32process.GetCurrentProcessId()  # 获取当前程序的PID
                    if pid != current_pid and pid != os.getpid():  # 如果当前窗口的pid与本程序的pid相同，则不冻结
                        frozen_pids.append(pid)
                except:
                    pass

        needHide = tool.remove_duplicates(needHide)  # 去重
        frozen_pids = tool.remove_duplicates(frozen_pids) if Config.freeze_after_hide else []  # 去重
        
        for i in needHide:
            if Config.send_before_hide:
                time.sleep(0.2)
                keyboard.Controller().tap(keyboard.KeyCode.from_vk(0xB2))
                
            ShowWindow(i, SW_HIDE)
            if Config.mute_after_hide:
                tool.changeMute(i, 1)
                
        # 冻结进程
        if Config.freeze_after_hide and frozen_pids:
            for pid in frozen_pids:
                try:
                    tool.suspend_process(pid)
                except Exception as e:
                    print(f"冻结进程失败: {e}")
            Config.frozen_pids = frozen_pids

        Config.history = needHide
        # 更新状态
        self.set_windows_state(0)
        if Config.hide_icon_after_hide:
            self.Queue.put("hideTaskBarIcon")
        Config.save()

    def Close(self, e=""):
        self.Queue.put("closeApp")
    
    def _stop(self):
        """
        直接关闭listener，应该使用Close
        """
        if self.listener is not None:
            self.end_flag = True 
            try:
                self.listener.terminate()
                self.listener.join()
            except:
                pass
            finally:
                self.listener = None
                
        # 停止鼠标按键监听器
        if hasattr(self, 'mouse_listener') and self.mouse_listener is not None:
            try:
                self.mouse_listener.stop()
                self.mouse_listener = None
            except:
                pass
        
        # 停止鼠标移动监听器
        if hasattr(self, 'mouse_move_listener') and self.mouse_move_listener is not None:
            try:
                self.mouse_move_listener.stop()
                self.mouse_move_listener = None
            except:
                pass
                
        # 停止自动隐藏监控
        self.stop_auto_hide_monitor()
        self._cleanup()
        
    def _cleanup(self):
        # 清理状态文件
        try:
            if hasattr(self, 'shared_state_file') and os.path.exists(self.shared_state_file):
                os.remove(self.shared_state_file)
                print("已清理状态文件")
        except Exception as e:
            print(f"清理状态文件失败: {e}")
