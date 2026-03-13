
// ==========================================
// 2. 烧钱会议室 (Meeting Tool)
// ==========================================
const AVATARS = ['👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '😴', '🤔', '🥴', '🤡', '🐒', '🐟'];

function MeetingView({ setView, showToast }) {
  const [participants, setParticipants] = useState(5);
  const [isCustomSalary, setIsCustomSalary] = useState(false);
  const [salary, setSalary] = useState(15000); // 默认平均月薪
  const [isRunning, setIsRunning] = useState(false);
  const [totalCost, setTotalCost] = useState(0);

  const costPerSecond = (salary / SECONDS_PER_MONTH) * participants;

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setTotalCost(prev => prev + costPerSecond / 10);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRunning, costPerSecond]);

  const reset = () => {
    setIsRunning(false);
    setTotalCost(0);
  };

  return (
    <div className="px-5 h-full flex flex-col">
      <TopBar title="会议烧钱机" onBack={() => setView('menu')} />

      <style>{`
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          80% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .avatar-pop { 
          animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; 
        }
        
        @keyframes fireGlow {
          0% { text-shadow: 0 0 10px rgba(239, 68, 68, 0.3); transform: scale(1); }
          50% { text-shadow: 0 0 25px rgba(239, 68, 68, 0.9), 0 0 45px rgba(239, 68, 68, 0.6); transform: scale(1.02); }
          100% { text-shadow: 0 0 10px rgba(239, 68, 68, 0.3); transform: scale(1); }
        }
        .text-fire { 
          animation: fireGlow 1.2s infinite alternate; 
          color: #DC2626; 
        }
        
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        .avatar-wiggle { 
          animation: wiggle 1.5s infinite ease-in-out; 
        }
      `}</style>

      <div className="flex-1 flex flex-col items-center mt-2 w-full pb-6">
        <div className="text-center mb-4 relative z-20">
          <p className="text-gray-500 text-sm mb-1">本场会议已消耗公司</p>
          <div className="relative">
             {isRunning && <div className="absolute -inset-4 bg-red-500/10 blur-xl rounded-full animate-pulse z-0"></div>}
             <div className={`text-5xl font-bold tracking-tight font-mono tabular-nums transition-all duration-300 relative z-10 ${isRunning ? 'text-fire' : 'text-red-600'}`}>
               ¥{totalCost.toFixed(4)}
             </div>
          </div>
          <p className="text-gray-400 text-xs mt-2 transition-opacity">¥{costPerSecond.toFixed(4)}/秒</p>
        </div>

        <div className={`w-full h-48 bg-slate-800 rounded-[32px] relative overflow-hidden shadow-inner border-4 ${isRunning ? 'border-red-900/80 shadow-[inset_0_0_40px_rgba(220,38,38,0.4)]' : 'border-slate-700'} transition-all duration-500 mb-6 flex justify-center items-center`}>
          <div className="absolute w-[60%] h-[35%] bg-amber-900/90 rounded-[100px] border-4 border-amber-800/60 shadow-2xl z-0 flex items-center justify-center">
             {isRunning && <div className="text-red-500/40 text-4xl animate-pulse">🔥</div>}
          </div>
          
          <div className="absolute inset-0 p-3 flex flex-wrap justify-center content-center gap-x-1.5 gap-y-1 z-10">
            {Array.from({ length: participants }).map((_, i) => (
              <div 
                key={i} 
                className={`text-[22px] drop-shadow-md avatar-pop ${isRunning ? 'avatar-wiggle' : ''}`}
                style={{ 
                  animationDelay: isRunning ? `${(i % 4) * 0.15}s` : '0s',
                  transformOrigin: 'bottom center' 
                }}
              >
                {AVATARS[i % AVATARS.length]}
              </div>
            ))}
          </div>

          {isRunning && (
            <div className="absolute inset-0 bg-gradient-to-t from-red-600/30 to-transparent mix-blend-overlay pointer-events-none animate-pulse"></div>
          )}
        </div>

        <div className="w-full space-y-3 mt-auto">
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-gray-700">
                <User size={18} /> 参会人数
              </div>
              <div className="text-2xl font-bold text-blue-800">
                {participants} <span className="text-xs text-gray-400 font-normal">人</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl disabled:opacity-50 active:bg-blue-100 transition-colors"
                onClick={() => setParticipants(Math.max(1, participants - 1))}
                disabled={isRunning}
              >-</button>
              <input 
                type="range" 
                min="1" max="50" 
                value={participants}
                onChange={(e) => setParticipants(Number(e.target.value))}
                disabled={isRunning}
                className="flex-1 accent-blue-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <button 
                className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl disabled:opacity-50 active:bg-blue-100 transition-colors"
                onClick={() => setParticipants(Math.min(50, participants + 1))}
                disabled={isRunning}
              >+</button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50 transition-all">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-gray-700">
                💵 自定义人均月薪
              </div>
              <button 
                className={`w-12 h-6 rounded-full p-1 transition-colors ${isCustomSalary ? 'bg-blue-500' : 'bg-gray-200'}`}
                onClick={() => setIsCustomSalary(!isCustomSalary)}
                disabled={isRunning}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isCustomSalary ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
            {isCustomSalary && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-gray-500 text-sm">平均月薪 (元)</span>
                <input 
                  type="number" 
                  value={salary}
                  onChange={(e) => setSalary(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-24 text-right bg-gray-50 rounded-lg p-2 font-mono text-blue-600 focus:outline-blue-200"
                />
              </div>
            )}
          </div>
        </div>

        <div className="w-full mt-4 space-y-3">
          <button 
            className={`w-full py-4 rounded-full font-bold text-lg flex justify-center items-center gap-2 shadow-lg transition-all ${isRunning ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/40' : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/30'}`}
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            {isRunning ? '暂停烧钱' : '开始计费'}
          </button>
          
          <div className="flex gap-3">
            <button 
              className="flex-1 py-3 rounded-full bg-white text-gray-600 font-bold border border-gray-200 flex justify-center items-center gap-2 active:bg-gray-50 transition-colors"
              onClick={reset}
            >
              <RotateCcw size={16} /> 重置
            </button>
            <button 
              className="flex-1 py-3 rounded-full bg-white text-blue-500 font-bold border border-blue-100 flex justify-center items-center gap-2 active:bg-blue-50 transition-colors"
              onClick={() => showToast('已生成会议账单，正在呼叫微信...')}
            >
              <Share size={16} /> 分享账单
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}