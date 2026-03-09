import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  FlaskConical, 
  User, 
  Coffee, 
  Wallet, 
  Calendar, 
  Moon,
  ChevronRight,
  Clock,
  Play,
  Square,
  Settings2,
  Trophy,
  RotateCcw,
  Info,
  Palette,
  Timer,
  Map,
  Lock,
  CheckCircle2,
  Flame,
  Poop,
  Utensils,
  Sparkles,
  Zap,
  Microscope
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('lab'); // 默认进入实验室看效果
  const [fishSeconds, setFishSeconds] = useState(161); 
  const [totalWorkSeconds, setTotalWorkSeconds] = useState(20273); 
  const [totalEarnings, setTotalEarnings] = useState(83.2632);
  const [todaySalary, setTodaySalary] = useState(30605.37);
  const [isFishing, setIsFishing] = useState(true);

  // 等级路线图数据
  const roadmap = [
    { name: '萌新', threshold: 0, icon: '🐣' },
    { name: '入门', threshold: 50, icon: '🐠' },
    { name: '学徒', threshold: 150, icon: '🐟' },
    { name: '成就', threshold: 350, icon: '🐊' },
    { name: '专家', threshold: 800, icon: '🦈' },
    { name: '领主', threshold: 2000, icon: '🐳' },
  ];

  // 动态计算当前等级
  let currentLevelIndex = roadmap.length - 1;
  for (let i = 0; i < roadmap.length; i++) {
    if (totalEarnings < roadmap[i].threshold) {
      currentLevelIndex = i - 1;
      break;
    }
  }
  currentLevelIndex = Math.max(0, currentLevelIndex);
  
  const currentLevelData = roadmap[currentLevelIndex];
  const nextLevelData = roadmap[Math.min(currentLevelIndex + 1, roadmap.length - 1)];
  const levelProgress = currentLevelIndex === roadmap.length - 1 
    ? 100 
    : ((totalEarnings - currentLevelData.threshold) / (nextLevelData.threshold - currentLevelData.threshold)) * 100;
  const diffToNext = nextLevelData.threshold - totalEarnings;

  useEffect(() => {
    let timer;
    if (isFishing) {
      timer = setInterval(() => {
        setFishSeconds(s => s + 1);
        setTotalWorkSeconds(s => s + 1);
        setTotalEarnings(prev => prev + 0.0015);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isFishing]);

  const formatTime = (s) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const offWorkPercent = 72; 
  const fishRatio = totalWorkSeconds > 0 ? fishSeconds / totalWorkSeconds : 0;
  const fishVisualDegree = ((fishSeconds % 3600) / 3600) * 360;

  const renderContent = () => {
    switch (activeTab) {
      case 'lab':
        return (
          <div className="flex-1 overflow-y-auto px-5 py-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12 bg-[#F8FAFC]">
            {/* 实验室顶部页眉 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-emerald-500 p-1.5 rounded-lg">
                  <Microscope size={18} className="text-white" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">实验室</h1>
              </div>
              <p className="text-[11px] font-bold text-slate-400">打工人的秘密武器库 · SECRET WEAPONS</p>
            </div>

            {/* 1. 核心大卡片: 烧钱会议室 */}
            <div className="group relative mb-6 cursor-pointer active:scale-[0.98] transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-[32px] blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative bg-white rounded-[32px] p-6 border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-3xl shadow-inner shadow-orange-200/50">
                    💸
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="bg-orange-50 text-orange-600 text-[10px] font-black px-2 py-1 rounded-full mb-1">REALTIME</span>
                    <div className="flex items-center gap-1 text-orange-500">
                      <Flame size={14} className="animate-pulse" />
                      <span className="text-[12px] font-bold">燃烧中</span>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <h2 className="text-xl font-black text-slate-800">烧钱会议室</h2>
                  <p className="text-[11px] font-bold text-slate-400 mt-1">实时计算会议成本，感受燃烧的钱</p>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px]">👤</div>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">已有 2,419 位组长在使用</span>
                </div>

                <div className="absolute bottom-4 right-6 w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center shadow-lg group-hover:translate-x-1 transition-transform">
                  <ChevronRight size={20} className="text-white" />
                </div>
              </div>
            </div>

            {/* 2. 中型功能区: 栅格不对称布局 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 带薪拉粑粑 */}
              <div className="group bg-white rounded-[28px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-600/30"></div>
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:rotate-12 transition-transform">
                  💩
                </div>
                <h3 className="text-[14px] font-black text-slate-800">带薪拉粑粑</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-1 leading-tight">如厕即赚钱<br/>记录年度收益</p>
                <div className="mt-4 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-amber-600" />
                </div>
              </div>

              {/* 今天吃什么 */}
              <div className="group bg-[#EEF2FF] rounded-[28px] p-5 border border-indigo-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/30"></div>
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm group-hover:scale-110 transition-transform">
                  🍱
                </div>
                <h3 className="text-[14px] font-black text-slate-800">今天吃什么</h3>
                <p className="text-[10px] font-bold text-slate-500 mt-1 leading-tight">选择困难症<br/>终极救星</p>
                <div className="mt-4 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Zap size={14} className="text-white fill-current" />
                </div>
              </div>
            </div>

            {/* 3. 底部预告模块 */}
            <div className="mt-8 px-2 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-slate-400" />
                <span className="text-[11px] font-black text-slate-400 tracking-wider uppercase">更多研发中...</span>
              </div>
              <div className="h-[1px] flex-1 bg-slate-200 mx-4"></div>
              <div className="w-2 h-2 rounded-full bg-slate-200"></div>
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="flex-1 overflow-y-auto px-4 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-8 bg-[#F8FAFC]">
            
            {/* 1. 顶部个人资料区 (极致压缩) */}
            <div className="flex items-center gap-3 mb-3 px-1 mt-1 cursor-pointer active:opacity-70 transition-opacity">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                  <User size={24} className="text-slate-400" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-black text-slate-800 leading-none">微信用户昵称</div>
                <div className="text-[10px] text-slate-400 mt-1 font-bold">摸鱼天数: 128天 · 已同步</div>
              </div>
              <ChevronRight size={14} className="text-slate-300" />
            </div>

            {/* 2. 收益核心卡片 */}
            <div className="bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] rounded-2xl p-4 shadow-lg shadow-blue-100 relative overflow-hidden mb-3">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
              
              <div className="relative z-10 flex justify-between items-center mb-3">
                 <div>
                   <div className="text-[9px] text-blue-200 font-bold mb-0.5 opacity-80">当前摸鱼总收益</div>
                   <div className="text-2xl font-black text-white leading-none">¥{totalEarnings.toFixed(2)}</div>
                 </div>
                 <div className="bg-white/15 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1 shadow-sm">
                    <span className="text-[13px]">{currentLevelData.icon}</span>
                    <span className="text-[10px] text-white font-bold">{currentLevelData.name}</span>
                 </div>
              </div>
              
              <div className="relative z-10 bg-black/10 rounded-xl p-2.5 border border-white/5">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[9px] text-blue-100 font-bold opacity-70">等级提升进度</span>
                  <span className="text-[9px] text-white font-bold">
                    再赚 <span className="text-yellow-300">¥{diffToNext.toFixed(2)}</span> 升级
                  </span>
                </div>
                <div className="h-1.5 w-full bg-black/30 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-300 to-blue-400 rounded-full relative" style={{ width: `${levelProgress}%` }}>
                     <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/40 blur-[2px]"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 等级路线图 (收窄线性版) */}
            <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm mb-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-1 text-slate-700">
                  <Map size={12} className="text-blue-500"/>
                  <span className="text-[11px] font-black">摸鱼之路</span>
                </div>
                <span className="text-[9px] text-slate-400 font-bold">最高等级: 深海领主</span>
              </div>
              
              <div className="relative px-2 pb-1">
                {/* 背景线 */}
                <div className="absolute top-[13px] left-4 right-4 h-[2px] bg-slate-100"></div>
                {/* 激活线 */}
                <div 
                  className="absolute top-[13px] left-4 h-[2px] bg-blue-500 transition-all duration-500" 
                  style={{ width: `calc(${(currentLevelIndex / (roadmap.length - 1)) * 100}% - 8px)` }}
                ></div>
                
                <div className="flex justify-between relative z-10">
                  {roadmap.map((lvl, idx) => {
                    const isReached = idx <= currentLevelIndex;
                    return (
                      <div key={idx} className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[14px] transition-all duration-300 ${isReached ? 'bg-blue-50 border-2 border-blue-500' : 'bg-slate-50 border-2 border-slate-100 opacity-40 grayscale'}`}>
                          {isReached ? lvl.icon : <Lock size={10} className="text-slate-400"/>}
                        </div>
                        <span className={`text-[8px] mt-1 font-black ${isReached ? 'text-blue-600' : 'text-slate-400'}`}>
                          {lvl.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 4. 统计面板 (更紧凑) */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                  <TrendingUp size={12} />
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400">击败同事</div>
                  <div className="text-[13px] font-black text-slate-700">99.2%</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
                  <Coffee size={12} />
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400">摸鱼效率</div>
                  <div className="text-[13px] font-black text-slate-700">优秀</div>
                </div>
              </div>
            </div>

            {/* 5. 紧凑设置列表 (减少内边距) */}
            <div className="flex flex-col gap-2">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <SettingItem icon={<Settings2 size={15} className="text-blue-500"/>} label="薪资工时" />
                <div className="h-[1px] bg-slate-50 mx-10"></div>
                <SettingItem icon={<Calendar size={15} className="text-indigo-500"/>} label="节假日" />
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-2">
                <SettingItem icon={<Info size={15} className="text-slate-400"/>} label="关于软件" />
                <div className="h-[1px] bg-slate-50 mx-10"></div>
                <button className="w-full px-4 py-3 flex items-center justify-between active:bg-red-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                      <RotateCcw size={14} />
                    </div>
                    <span className="text-[13px] font-bold text-red-500">清除数据</span>
                  </div>
                  <ChevronRight size={14} className="text-slate-200" />
                </button>
              </div>

              <div className="text-center py-2 text-[9px] text-slate-300 font-bold tracking-widest">
                鱼额宝 · 个人基地 v2.5.0
              </div>
            </div>
          </div>
        );
      case 'home':
      default:
        return (
          <>
            {/* 圆形计时器 */}
            <div className="px-6 pt-4 flex flex-col items-center shrink-0">
              <div className="relative w-56 h-56 flex items-center justify-center">
                <div 
                  className="absolute inset-0 rounded-full flex items-center justify-center transition-all duration-1000"
                  style={{
                    background: `conic-gradient(#3B82F6 ${fishVisualDegree}deg, #E2E8F0 ${fishVisualDegree}deg 260deg, #F1F5F9 260deg)`
                  }}
                >
                  <div className="w-[calc(100%-12px)] h-[calc(100%-12px)] bg-white rounded-full flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-2 rounded-full bg-gradient-to-b from-[#E0F2FE] to-[#F0F9FF] shadow-[inset_0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
                      <div className="absolute -top-4 -left-4 w-32 h-32 bg-white/40 blur-2xl rounded-full"></div>
                      <div className={`absolute bottom-0 w-full bg-blue-400/10 transition-all duration-1000 ${isFishing ? 'h-[45%]' : 'h-[25%]'}`}>
                        <div className="absolute top-0 w-[200%] h-6 bg-blue-300/10 -translate-y-1/2 animate-wave-slow"></div>
                      </div>
                      
                      {isFishing && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute bottom-2 left-1/3 w-1.5 h-1.5 bg-white/40 rounded-full animate-bubble" style={{animationDelay: '0s'}}></div>
                          <div className="absolute bottom-4 left-1/2 w-1 h-1 bg-white/40 rounded-full animate-bubble" style={{animationDelay: '1.2s'}}></div>
                        </div>
                      )}

                      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-10 ${isFishing ? 'animate-fish-patrol' : 'opacity-40 grayscale-[0.5]'}`}>
                        <div className="relative w-full h-full flex items-center justify-center">
                          <div className="w-12 h-7 bg-gradient-to-r from-orange-500 to-orange-400 rounded-[50%_60%_60%_50%] relative shadow-sm">
                            <div className="absolute right-2 top-2 w-2 h-2 bg-white rounded-full flex items-center justify-center">
                              <div className="w-1 h-1 bg-black rounded-full"></div>
                            </div>
                          </div>
                          <div className="absolute left-[-2px] flex flex-col gap-[-4px]">
                            <div className="w-5 h-4 bg-orange-600 rounded-[0%_100%_20%_100%] origin-right animate-tail-up"></div>
                            <div className="w-5 h-4 bg-orange-600 rounded-[100%_20%_100%_0%] origin-right mt-[-4px] animate-tail-down"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="z-10 text-center pointer-events-none">
                      <div className={`text-[10px] font-bold mb-0.5 ${isFishing ? 'text-blue-600/80' : 'text-gray-400'}`}>
                        {isFishing ? '正在计费' : '休息中'}
                      </div>
                      <div className={`text-[32px] font-black tracking-tighter leading-none ${isFishing ? 'text-[#1E3A8A]' : 'text-gray-300'}`}>
                        {formatTime(fishSeconds)}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsFishing(!isFishing); }}
                        className={`mt-4 pointer-events-auto flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-black transition-all active:scale-90 ${isFishing ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {isFishing ? <Square size={8} fill="currentColor"/> : <Play size={8} fill="currentColor"/>}
                        <span>{isFishing ? '停止' : '开始'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 工时进度条 */}
            <div className="px-8 mt-6 shrink-0">
              <div className="flex justify-between items-center text-[10px] font-bold text-[#94A3B8] mb-2 px-1">
                 <div className="flex items-center gap-1"><Clock size={12} className="text-blue-400"/> 工时: {formatTime(totalWorkSeconds)}</div>
                 <div className="text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md">摸鱼率: {(fishRatio * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-black text-[#475569]">下班进度 {offWorkPercent}%</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => <div key={i} className={`w-3 h-1 rounded-full ${i <= 4 ? 'bg-blue-500' : 'bg-gray-200'}`} />)}
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-200/40 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 w-[72%] rounded-full shadow-sm relative">
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 数据填充区 */}
            <div className="flex-1 px-6 my-4 flex flex-col gap-3 overflow-y-auto">
              <div className="bg-[#1E40AF] rounded-[28px] p-5 shadow-xl shadow-blue-100 flex flex-col justify-center shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex justify-between items-start relative z-10 text-white">
                  <div>
                    <div className="text-blue-200 text-[12px] font-bold flex items-center gap-1.5 mb-1.5">
                      <Wallet size={14} className="opacity-70" /> 今日摸鱼收入
                    </div>
                    <div className="text-[34px] font-black tracking-tight leading-none">
                      ¥{totalEarnings.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-2 py-1.5 rounded-xl border border-white/10 text-right">
                     <div className="text-[8px] font-bold uppercase opacity-50">实时流速</div>
                     <div className="text-[11px] font-black">¥1.5097/秒</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-4">
                <div className="bg-[#FFFBF5] rounded-[24px] p-4 border border-orange-100 flex flex-col justify-between shadow-sm min-h-[100px]">
                  <div className="text-[#9A3412] text-[11px] font-black flex items-center gap-1.5">
                    <Coffee size={13} className="text-orange-400"/> 今日入账
                  </div>
                  <div className="text-[20px] font-black text-[#C2410C]">¥{todaySalary.toLocaleString()}</div>
                </div>

                <div className="bg-white rounded-[24px] p-4 border border-gray-100 flex flex-col justify-between shadow-sm min-h-[100px]">
                  <div className="text-[#64748B] text-[11px] font-black flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-green-500"/> 本月已赚
                  </div>
                  <div className="text-[20px] font-black text-[#16A34A]">¥204,518</div>
                </div>

                <div className="bg-white rounded-[24px] p-4 border border-gray-100 flex flex-col justify-between shadow-sm">
                  <div className="text-[#64748B] text-[11px] font-black flex items-center gap-1.5">
                    <Calendar size={13} className="text-blue-500" /> 发薪倒数
                  </div>
                  <div className="text-[22px] font-black text-[#1E293B]">9 <span className="text-[10px] text-gray-400 font-bold ml-0.5">天</span></div>
                  <div className="text-[9px] text-blue-500 font-bold flex items-center gap-0.5">查看明细 <ChevronRight size={10} /></div>
                </div>

                <div className="bg-white rounded-[24px] p-4 border border-gray-100 flex flex-col justify-between shadow-sm">
                  <div className="text-[#64748B] text-[11px] font-black flex items-center gap-1.5">
                    <Moon size={13} className="text-indigo-500" /> 距离周末
                  </div>
                  <div className="text-[22px] font-black text-[#1E293B]">2 <span className="text-[10px] text-gray-400 font-bold ml-0.5">天</span></div>
                  <div className="text-[9px] text-indigo-400 font-bold italic">坚持住！</div>
                </div>
              </div>
            </div>
          </>
        );
      case 'report':
        return <div className="flex-1 flex items-center justify-center text-slate-400 font-bold">情报模块研发中...</div>;
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-[#F5F7F9] p-2 font-sans text-[#334155]">
      <style>
        {`
          @keyframes wave-slow {
            0% { transform: translateX(0) translateY(-50%); }
            100% { transform: translateX(-50%) translateY(-50%); }
          }
          @keyframes bubble {
            0% { transform: translateY(0); opacity: 0; }
            20% { opacity: 0.6; }
            100% { transform: translateY(-80px); opacity: 0; }
          }
          @keyframes fish-patrol {
            0% { transform: translate(-80%, -40%) scaleX(1); }
            45% { transform: translate(10%, -60%) scaleX(1); }
            50% { transform: translate(10%, -60%) scaleX(-1); }
            95% { transform: translate(-80%, -40%) scaleX(-1); }
            100% { transform: translate(-80%, -40%) scaleX(1); }
          }
          @keyframes tail-up {
            0%, 100% { transform: rotate(10deg); }
            50% { transform: rotate(30deg); }
          }
          @keyframes tail-down {
            0%, 100% { transform: rotate(-10deg); }
            50% { transform: rotate(-30deg); }
          }
          .animate-wave-slow { animation: wave-slow 6s linear infinite; }
          .animate-bubble { animation: bubble 4s ease-in infinite; }
          .animate-fish-patrol { animation: fish-patrol 10s ease-in-out infinite; }
          .animate-tail-up { animation: tail-up 0.5s ease-in-out infinite; }
          .animate-tail-down { animation: tail-down 0.5s ease-in-out infinite; }
          ::-webkit-scrollbar { width: 0; height: 0; display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}
      </style>

      <div className="relative w-[375px] h-[812px] bg-white rounded-[45px] shadow-[0_0_0_10px_#1F2937,0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col">
        
        {/* 顶部导航 */}
        <div className="shrink-0 bg-white z-50">
          <div className="h-11"></div>
          <div className="h-11 px-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-blue-200">鱼</div>
              <span className="text-[16px] font-bold text-[#111827]">
                {activeTab === 'home' ? '鱼额宝' : activeTab === 'lab' ? '深海实验室' : '特工中心'}
              </span>
            </div>
            <div className="w-[80px] h-7 bg-[#F2F2F2]/50 rounded-full border border-gray-100 flex items-center justify-evenly opacity-30">
              <div className="w-2.5 h-2.5 rounded-full bg-black/20"></div>
              <div className="w-[1px] h-3 bg-black/10"></div>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-black/20"></div>
            </div>
          </div>
        </div>

        {renderContent()}

        {/* 底部 TabBar */}
        <div className="h-14 bg-white border-t border-gray-50 px-8 flex justify-between items-center shrink-0 z-50">
          <NavItem active={activeTab === 'home'} icon={<TrendingUp size={20}/>} label="摸鱼" onClick={() => setActiveTab('home')} />
          <NavItem active={activeTab === 'report'} icon={<BarChart3 size={20}/>} label="情报" onClick={() => setActiveTab('report')} />
          <NavItem active={activeTab === 'lab'} icon={<FlaskConical size={20}/>} label="实验" onClick={() => setActiveTab('lab')} />
          <NavItem active={activeTab === 'profile'} icon={<User size={20}/>} label="我的" onClick={() => setActiveTab('profile')} />
        </div>

        <div className="h-6 bg-white flex justify-center items-start shrink-0">
          <div className="w-[110px] h-[4px] bg-gray-100 rounded-full mt-1.5"></div>
        </div>
      </div>
    </div>
  );
};

const SettingItem = ({ icon, label, value }) => (
  <button className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50 transition-colors">
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-[13px] font-bold text-slate-700">{label}</span>
    </div>
    <div className="flex items-center gap-1.5">
      {value && <span className="text-[11px] font-bold text-slate-400">{value}</span>}
      <ChevronRight size={14} className="text-slate-200" />
    </div>
  </button>
);

const NavItem = ({ active, icon, label, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${active ? 'text-blue-600' : 'text-[#CBD5E1]'}`}>
    <div className={`${active ? 'scale-110' : ''}`}>{icon}</div>
    <span className={`text-[9px] font-black ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
  </button>
);

export default App;