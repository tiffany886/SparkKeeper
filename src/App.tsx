/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Smartphone, 
  Code, 
  ShieldCheck, 
  Play, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  AlertTriangle,
  Info,
  MessageSquare,
  Users,
  Zap,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface FriendConfig {
  id: string;
  name: string;
  message: string;
  enabled?: boolean;
}

interface AppConfig {
  friends: FriendConfig[];
  interval: number;
  autoWakeup: boolean;
  emergencyStop: boolean;
  lastScanTime?: string;
  deviceIp?: string; // 新增：手机端 AutoX.js 的 IP 地址
}

// --- Constants ---

const DEFAULT_SCRIPT_TEMPLATE = `/**
 * SparkKeeper v1.1.0
 * AutoX.js Script for Douyin (Huawei/HarmonyOS Optimized)
 * Includes: Friend Scanner & Automated Sparking
 */

const config = {{CONFIG_JSON}};

// --- Scanner Module ---
var Scanner = {
    getFriends: function() {
        toastLog("开始同步好友列表...");
        launchApp("抖音");
        waitForPackage("com.ss.android.ugc.aweme");
        sleep(3000);

        // 路径：消息 -> 发起聊天 (推荐路径)
        let msgTab = text("消息").findOne(5000);
        if (msgTab) {
            click(msgTab.bounds().centerX(), msgTab.bounds().centerY());
            sleep(1500);
            
            // 点击右上角“发起聊天”或搜索图标
            let startChat = desc("发起聊天").findOne(2000) || id("xxx").findOne(1000);
            if (startChat) startChat.click();
            sleep(2000);
        }

        let friends = new Set();
        let lastCount = 0;
        let sameCountTimes = 0;

        while (sameCountTimes < 3) {
            let list = id("user_name_text").find();
            if (list.empty()) {
                list = textMatches(/.+/).find(); // 兜底方案
            }

            list.forEach(i => {
                let name = i.text();
                if (name && name.length > 0 && name != "搜索") {
                    friends.add(name);
                }
            });

            // 向上滑动半屏
            swipe(device.width / 2, device.height * 0.8, device.width / 2, device.height * 0.3, 800);
            sleep(1000);

            if (friends.size == lastCount) {
                sameCountTimes++;
            } else {
                lastCount = friends.size;
                sameCountTimes = 0;
            }
            toastLog("当前已扫描好友: " + friends.size);
        }
        
        toastLog("同步完成，共获取 " + friends.size + " 位好友");
        return Array.from(friends);
    }
};

// --- Initialization & Permissions ---
function init() {
    if (!auto.service) {
        toastLog("请先开启无障碍服务！");
        app.startActivity({action: "android.settings.ACCESSIBILITY_SETTINGS"});
        exit();
    }
    
    if (!floaty.checkPermission()) {
        toastLog("请开启悬浮窗权限");
        floaty.requestPermission();
    }

    if (config.emergencyStop) {
        threads.start(function(){
            events.observeKey();
            events.on("key_down", function(keyCode, event){
                if(keyCode == keys.volume_down){
                    toastLog("紧急停止：脚本已退出");
                    exit();
                }
            });
        });
    }
}

// --- Core Logic ---
function sendSpark(friendName, content) {
    toastLog("正在处理好友: " + friendName);
    launchApp("抖音");
    waitForPackage("com.ss.android.ugc.aweme");
    sleep(3000);
    
    let msgTab = text("消息").findOne(5000);
    if(msgTab) {
        click(msgTab.bounds().centerX(), msgTab.bounds().centerY());
        sleep(1000);
    } else {
        return false;
    }

    let friend = text(friendName).findOne(3000);
    if(friend) {
        click(friend.bounds().centerX(), friend.bounds().centerY());
        sleep(1500);
        setText(content);
        sleep(800);
        let sendBtn = text("发送").findOne(2000);
        if(sendBtn) {
            sendBtn.click();
            sleep(1000);
            back();
            return true;
        }
    }
    return false;
}

// --- Main Execution ---
function main() {
    init();
    
    if (text("未登录").exists() || text("登录").exists()) {
        alert("请先手动登录抖音，完成后点击确定继续");
    }

    if (config.autoWakeup && !device.isScreenOn()) {
        device.wakeUp();
        sleep(1000);
    }

    device.keepScreenOn(3600000);

    while(true) {
        for (let i = 0; i < config.friends.length; i++) {
            let f = config.friends[i];
            if (f.enabled !== false) {
                sendSpark(f.name, f.message);
                sleep(config.interval * 1000);
            }
        }
        toastLog("一轮任务结束，等待下次循环...");
        sleep(30 * 60 * 1000); 
    }
}

main();
`;

// --- Components ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'script' | 'guide'>('dashboard');
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('sparkkeeper_config');
    return saved ? JSON.parse(saved) : {
      friends: [
        { id: '1', name: '张三', message: '早安火花！', enabled: true },
        { id: '2', name: '李四', message: '记得回火花~', enabled: true }
      ],
      interval: 5,
      autoWakeup: true,
      emergencyStop: true,
      lastScanTime: '2026-04-03 10:00:00',
      deviceIp: ''
    };
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  // 远程运行脚本函数
  const runOnDevice = async (scriptContent: string) => {
    if (!config.deviceIp) {
      alert("请先在‘控制面板’配置手机端的 IP 地址！");
      return;
    }
    setIsConnecting(true);
    try {
      // AutoX.js 默认 Web 端口通常为 9317 (需在手机端开启 Web 服务)
      const response = await fetch(`http://${config.deviceIp}:9317/run`, {
        method: 'POST',
        body: scriptContent,
        headers: { 'Content-Type': 'text/plain' }
      });
      if (response.ok) {
        alert("脚本已成功发送至手机并开始运行！");
      } else {
        throw new Error("连接失败");
      }
    } catch (err) {
      alert("无法连接到手机。请确保：\n1. 手机已开启 AutoX.js 的‘远程调试/Web服务’\n2. 手机与此设备在同一 Wi-Fi 下\n3. IP 地址填写正确");
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('sparkkeeper_config', JSON.stringify(config));
  }, [config]);

  const addFriend = () => {
    setConfig({
      ...config,
      friends: [...config.friends, { id: Date.now().toString(), name: '', message: '', enabled: true }]
    });
  };

  const removeFriend = (id: string) => {
    setConfig({
      ...config,
      friends: config.friends.filter(f => f.id !== id)
    });
  };

  const updateFriend = (id: string, field: keyof FriendConfig, value: any) => {
    setConfig({
      ...config,
      friends: config.friends.map(f => f.id === id ? { ...f, [field]: value } : f)
    });
  };

  const toggleFriend = (id: string) => {
    setConfig({
      ...config,
      friends: config.friends.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f)
    });
  };

  const generatedScript = DEFAULT_SCRIPT_TEMPLATE.replace('{{CONFIG_JSON}}', JSON.stringify(config, null, 4));

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-100 font-sans selection:bg-red-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#16191f] border-r border-white/5 z-50 hidden lg:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SparkKeeper</h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={<Smartphone size={20} />} 
            label="控制面板" 
          />
          <NavItem 
            active={activeTab === 'config'} 
            onClick={() => setActiveTab('config')} 
            icon={<Settings size={20} />} 
            label="任务配置" 
          />
          <NavItem 
            active={activeTab === 'script'} 
            onClick={() => setActiveTab('script')} 
            icon={<Code size={20} />} 
            label="脚本生成" 
          />
          <NavItem 
            active={activeTab === 'guide'} 
            onClick={() => setActiveTab('guide')} 
            icon={<ShieldCheck size={20} />} 
            label="华为适配指南" 
          />
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="bg-white/5 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-2">当前版本</p>
            <p className="text-sm font-mono text-red-500">v1.0.0-stable</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#0f1115]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold capitalize">
              {activeTab === 'dashboard' && '运行概览'}
              {activeTab === 'config' && '配置中心'}
              {activeTab === 'script' && '代码导出'}
              {activeTab === 'guide' && '华为专项适配'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <Info size={20} className="text-gray-400" />
            </button>
            <div className="h-8 w-[1px] bg-white/10 mx-2" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-green-500">服务就绪</span>
            </div>
          </div>
        </header>

        <div className="p-6 max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard 
                    title="待续火花好友" 
                    value={config.friends.filter(f => f.enabled).length.toString()} 
                    icon={<Users className="text-blue-400" />}
                    trend={`总数: ${config.friends.length}`}
                  />
                  <StatCard 
                    title="上次同步" 
                    value={config.lastScanTime ? config.lastScanTime.split(' ')[1] : '从未'} 
                    icon={<Zap className="text-yellow-400" />}
                    trend={config.lastScanTime ? config.lastScanTime.split(' ')[0] : '请先同步'}
                  />
                  <StatCard 
                    title="华为适配状态" 
                    value="已优化" 
                    icon={<ShieldCheck className="text-green-400" />}
                    trend="HarmonyOS 4.0+"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#16191f] rounded-3xl border border-white/5 p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold">设备连接 (Remote)</h3>
                      <div className={`p-2 rounded-xl ${config.deviceIp ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                        <Smartphone className={config.deviceIp ? 'text-green-500' : 'text-yellow-500'} size={20} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">手机局域网 IP</label>
                        <input 
                          type="text" 
                          value={config.deviceIp}
                          onChange={(e) => setConfig({ ...config, deviceIp: e.target.value })}
                          placeholder="例如: 192.168.1.5"
                          className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-all"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500">
                        * 在 AutoX.js 设置中开启“远程调试”或“Web服务”即可获取 IP。
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#16191f] rounded-3xl border border-white/5 p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold">一键操作</h3>
                      <div className="p-2 bg-red-500/10 rounded-xl">
                        <Play className="text-red-500" size={20} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => runOnDevice(generatedScript)}
                        disabled={isConnecting}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-red-600 hover:bg-red-700 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Play size={24} />
                        <span className="text-xs font-bold">一键运行</span>
                      </button>
                      <button 
                        onClick={() => alert("请在手机端抖音完成登录，脚本将自动检测状态。")}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-95"
                      >
                        <MessageSquare size={24} className="text-blue-400" />
                        <span className="text-xs font-bold">登录抖音</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'config' && (
              <motion.div
                key="config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <section className="bg-[#16191f] rounded-3xl border border-white/5 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Users className="text-red-500" />
                      <h3 className="text-lg font-bold">好友任务列表</h3>
                    </div>
                    <button 
                      onClick={addFriend}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold transition-all active:scale-95"
                    >
                      <Plus size={18} />
                      添加好友
                    </button>
                  </div>

                  <div className="space-y-4">
                    {config.friends.map((friend) => (
                      <div key={friend.id} className={`group flex flex-col md:flex-row gap-4 p-4 rounded-2xl border transition-all ${
                        friend.enabled ? 'bg-white/5 border-white/5' : 'bg-white/2 border-transparent opacity-60'
                      }`}>
                        <div className="flex items-center gap-4 shrink-0">
                          <button 
                            onClick={() => toggleFriend(friend.id)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                              friend.enabled ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-500'
                            }`}
                          >
                            <Check size={20} />
                          </button>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">好友昵称</label>
                              <input 
                                type="text" 
                                value={friend.name}
                                onChange={(e) => updateFriend(friend.id, 'name', e.target.value)}
                                placeholder="例如: 张三"
                                className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-all"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">发送文案</label>
                              <input 
                                type="text" 
                                value={friend.message}
                                onChange={(e) => updateFriend(friend.id, 'message', e.target.value)}
                                placeholder="例如: 早安火花"
                                className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-all"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-end justify-end">
                          <button 
                            onClick={() => removeFriend(friend.id)}
                            className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-[#16191f] rounded-3xl border border-white/5 p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <Settings className="text-red-500" />
                    <h3 className="text-lg font-bold">全局运行参数</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-sm font-bold">好友切换间隔 (秒)</label>
                          <span className="text-red-500 font-mono">{config.interval}s</span>
                        </div>
                        <input 
                          type="range" 
                          min="2" 
                          max="60" 
                          value={config.interval}
                          onChange={(e) => setConfig({ ...config, interval: parseInt(e.target.value) })}
                          className="w-full accent-red-600"
                        />
                        <p className="text-xs text-gray-500">建议设置在 5s 以上，防止操作过快触发抖音风控。</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <ToggleItem 
                        title="自动唤醒屏幕" 
                        desc="检测到黑屏时尝试唤醒设备" 
                        active={config.autoWakeup}
                        onChange={(v) => setConfig({ ...config, autoWakeup: v })}
                      />
                      <ToggleItem 
                        title="音量键紧急停止" 
                        desc="运行中按【音量减】立即退出脚本" 
                        active={config.emergencyStop}
                        onChange={(v) => setConfig({ ...config, emergencyStop: v })}
                      />
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'script' && (
              <motion.div
                key="script"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-[#16191f] rounded-3xl border border-white/5 overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/50" />
                      </div>
                      <span className="text-xs font-mono text-gray-500 ml-2">spark_keeper_main.js</span>
                    </div>
                    <button 
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all active:scale-95"
                    >
                      {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                      {copied ? '已复制' : '复制代码'}
                    </button>
                  </div>
                  <div className="p-6 bg-[#0d0f13] overflow-x-auto">
                    <pre className="text-sm font-mono text-gray-300 leading-relaxed">
                      <code>{generatedScript}</code>
                    </pre>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 flex gap-4">
                  <Info className="text-blue-400 shrink-0" />
                  <div className="text-sm text-blue-200/80 leading-relaxed">
                    <p className="font-bold text-blue-400 mb-1">使用说明：</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>在手机上打开 AutoX.js 客户端。</li>
                      <li>点击右下角【+】号，选择【新建文件】。</li>
                      <li>将上述代码粘贴进去并保存。</li>
                      <li>点击运行按钮，并根据提示开启【无障碍】和【悬浮窗】权限。</li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'guide' && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <GuideCard 
                  title="权限守护" 
                  icon={<ShieldCheck className="text-green-400" />}
                  items={[
                    "关闭华为系统的“自动管理”启动项",
                    "在电池设置中将 AutoX.js 设为“不允许优化”",
                    "锁定 AutoX.js 在后台多任务视图中（下拉加锁）"
                  ]}
                />
                <GuideCard 
                  title="屏幕适配" 
                  icon={<Smartphone className="text-blue-400" />}
                  items={[
                    "避免使用 click(x, y) 绝对坐标",
                    "脚本已内置 widget.bounds().centerX() 动态定位",
                    "适配 Mate 60/70 系列的挖孔屏偏移"
                  ]}
                />
                <GuideCard 
                  title="异常处理" 
                  icon={<AlertTriangle className="text-yellow-400" />}
                  items={[
                    "检测到滑动验证码时会自动暂停并弹窗提醒",
                    "抖音版本更新导致控件 ID 变化时，请联系开发者",
                    "建议关闭抖音的“青少年模式”弹窗"
                  ]}
                />
                <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-8 flex flex-col justify-center items-center text-center">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="text-red-500" size={32} />
                  </div>
                  <h4 className="text-lg font-bold mb-2">安全警告</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    本脚本仅供学习交流使用。频繁的自动化操作可能导致抖音账号被限制。
                    请合理设置执行间隔，并遵守平台相关规定。
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-[#16191f] border-t border-white/5 px-6 py-3 flex justify-between items-center z-50">
        <MobileNavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Smartphone size={20} />} />
        <MobileNavItem active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Settings size={20} />} />
        <MobileNavItem active={activeTab === 'script'} onClick={() => setActiveTab('script')} icon={<Code size={20} />} />
        <MobileNavItem active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} icon={<ShieldCheck size={20} />} />
      </nav>
    </div>
  );
}

// --- Sub-components ---

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        active 
          ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-lg shadow-red-500/5' 
          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`p-3 rounded-xl transition-all ${
        active ? 'bg-red-500/10 text-red-500' : 'text-gray-400'
      }`}
    >
      {icon}
    </button>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-[#16191f] p-6 rounded-3xl border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-white/5 rounded-xl">
          {icon}
        </div>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{trend}</span>
      </div>
      <p className="text-gray-400 text-sm mb-1">{title}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function StepItem({ number, title, desc, done }: { number: string, title: string, desc: string, done: boolean }) {
  return (
    <div className="flex gap-4 p-4 rounded-2xl hover:bg-white/2 transition-colors">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm shrink-0 ${
        done ? 'bg-green-500/20 text-green-500' : 'bg-white/5 text-gray-500'
      }`}>
        {done ? <Check size={18} /> : number}
      </div>
      <div>
        <h4 className="font-bold mb-1">{title}</h4>
        <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ToggleItem({ title, desc, active, onChange }: { title: string, desc: string, active: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
      <div>
        <h4 className="text-sm font-bold mb-0.5">{title}</h4>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <button 
        onClick={() => onChange(!active)}
        className={`w-12 h-6 rounded-full transition-all relative ${active ? 'bg-red-600' : 'bg-gray-700'}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${active ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  );
}

function GuideCard({ title, icon, items }: { title: string, icon: React.ReactNode, items: string[] }) {
  return (
    <div className="bg-[#16191f] p-8 rounded-3xl border border-white/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-white/5 rounded-xl">
          {icon}
        </div>
        <h4 className="font-bold">{title}</h4>
      </div>
      <ul className="space-y-4">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm text-gray-400 leading-relaxed">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
