
// ==========================================
// 3. 带薪拉粑粑 (Poop Tool)
// ==========================================
function PoopView({ setView, showToast }) {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const salary = 12000; 
  
  const earningsPerSecond = salary / SECONDS_PER_MONTH;
  const currentEarnings = seconds * earningsPerSecond;

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="px-5 h-full flex flex-col">
      <TopBar title="带薪拉粑粑" onBack={() => setView('menu')} />

      <style>{`
        @keyframes floatGold {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-40px) scale(0.8); opacity: 0; }
        }
        .gold-particle {
          animation: floatGold 1s ease-out infinite;
        }
        @keyframes doorSlide {
          from { transform: translateX(0); }
          to { transform: translateX(-80%); }
        }
        .door-close {
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes waterFlow {
          0% { transform: translateY(0); }
          100% { transform: translateY(10px); }
        }
        .water-anim {
          animation: waterFlow 0.5s linear infinite;
        }
      `}</style>

      <div className="flex-1 flex flex-col mt-2">
        {/* 顶部状态 */}
        <div className="text-center mb-6">
           <div className="text-5xl font-bold text-blue-600 tracking-tight font-mono tabular-nums">
             {formatTime(seconds)}
           </div>
           <div className="flex items-center justify-center gap-1 mt-1">
             <span className="text-blue-500 font-bold text-lg">¥{currentEarnings.toFixed(4)}</span>
             {isRunning && <span className="text-amber-500 text-xs font-bold animate-bounce">+¥</span>}
           </div>
        </div>

        {/* 核心可视化区：VIP 厕位 */}
        <div className="w-full h-64 bg-slate-100 rounded-[40px] relative overflow-hidden shadow-inner border-4 border-white mb-6">
          {/* 背景：瓷砖墙感 */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', size: '20px 20px' }}></div>
          
          {/* 厕所隔间内部 */}
          <div className="absolute inset-x-8 inset-y-6 bg-white rounded-t-2xl shadow-lg flex flex-col items-center justify-end pb-8 border-x border-t border-slate-200">
             {/* 抽水马桶简化视觉 */}
             <div className="w-20 h-12 bg-slate-100 rounded-full border-b-4 border-slate-300 relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-8 bg-slate-200 rounded-t-lg"></div>
             </div>
             {/* 用户角色 */}
             <div className={`text-5xl mb-2 transition-all duration-500 ${isRunning ? 'scale-110' : 'grayscale opacity-50'}`}>
               {isRunning ? '🧘‍♂️' : '👤'}
             </div>
             {/* 产出特效 */}
             {isRunning && (
               <div className="absolute top-10 flex flex-col items-center">
                  <div className="text-2xl animate-bounce">💩</div>
                  <div className="flex gap-2">
                    <span className="gold-particle text-yellow-500 font-bold">¥</span>
                    <span className="gold-particle text-yellow-500 font-bold" style={{ animationDelay: '0.3s' }}>¥</span>
                    <span className="gold-particle text-yellow-500 font-bold" style={{ animationDelay: '0.6s' }}>¥</span>
                  </div>
               </div>
             )}
          </div>

          {/* 门：交互动画 */}
          <div className={`absolute inset-x-8 inset-y-6 bg-blue-500 rounded-t-2xl border-x-4 border-t-4 border-blue-600 z-20 flex items-center justify-center transition-transform duration-700 ease-in-out ${isRunning ? 'translate-x-[-90%]' : 'translate-x-0 shadow-2xl'}`}>
             <div className="w-2 h-12 bg-blue-700 rounded-full"></div>
             {!isRunning && <div className="absolute top-4 right-4 bg-white/20 px-2 py-0.5 rounded text-[10px] text-white font-bold">VACANT</div>}
          </div>

          {/* 底部水流装饰 (运行中显示) */}
          {isRunning && (
            <div className="absolute bottom-0 w-full h-2 bg-blue-400/30 flex justify-around">
               <div className="w-1 h-full bg-blue-400 water-anim"></div>
               <div className="w-1 h-full bg-blue-400 water-anim" style={{ animationDelay: '0.1s' }}></div>
               <div className="w-1 h-full bg-blue-400 water-anim" style={{ animationDelay: '0.2s' }}></div>
            </div>
          )}
        </div>

        {/* 收益统计 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50 text-center">
            <div className="text-gray-400 text-[10px] uppercase font-bold mb-1">今日累计</div>
            <div className="text-xl font-bold text-blue-600">¥{(currentEarnings + 5.62).toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50 text-center">
            <div className="text-gray-400 text-[10px] uppercase font-bold mb-1">健康提醒</div>
            <div className="text-sm font-bold text-green-500 mt-1">状态良好</div>
          </div>
        </div>

        <button 
          className={`w-full py-5 rounded-[24px] font-bold text-lg text-white shadow-xl transition-all active:scale-95 mb-4 ${isRunning ? 'bg-amber-500 shadow-amber-500/30' : 'bg-blue-600 shadow-blue-600/30'}`}
          onClick={() => setIsRunning(!isRunning)}
        >
          {isRunning ? '🚽 完事，提裤子' : '🧻 进入 VIP 包厢'}
        </button>

        <div className="mt-auto mb-4 bg-blue-50 p-4 rounded-2xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">💡</div>
          <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
            据统计，每天在公司如厕 15 分钟，一年相当于多出 8 天带薪假。深海动力室祝您产出顺利！
          </p>
        </div>
      </div>
    </div>
  );
}