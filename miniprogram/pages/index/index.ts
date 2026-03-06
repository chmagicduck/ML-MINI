// pages/index/index.ts — 首页仪表盘 V2.2
import {
  getSettings,
  getTodaySlackingSeconds,
  saveTodaySlackingSeconds,
  commitMoyuSession,
  getMoyuStats,
  setPendingLevelUp,
  getPendingLevelUp,
  clearPendingLevelUp,
  getLastExitState,
  clearLastExitState,
  hasShownInitialIdentity,
  setInitialIdentityShown,
} from '../../utils/storage'
import {
  getSecondSalary,
  calcTodayEarnings,
  calcTodayWorkedEarnings,
  calcTodayWorkedSeconds,
  calcMonthEarnings,
  getTodayWorkProgress,
  getDaysToPayday,
  getDaysToWeekend,
  getWorkingDaysInMonth,
  getMoyuLevel,
  isWorkingNow,
  formatMoney,
  formatDuration,
} from '../../utils/calculator'
import { getTodayStatusText, getTodayStatus } from '../../utils/holiday'
import { UserSettings, MoyuLevel } from '../../utils/types'

const SLOGANS = [
  '只要我不努力，老板就永远过不上想要的生活',
  '摸鱼一时爽，一直摸鱼一直爽',
  '打工人，打工魂，打工都是人上人',
  '躺平不是态度，是艺术',
  '上班如上坟，摸鱼保平安',
  '钱是打工人的，鱼是摸鱼人的',
  '今天摸了，明天继续摸',
]

// ── 模块级状态（Page 单例安全）────────────────────────────────
let _timer: ReturnType<typeof setInterval> | null = null
let _settings: UserSettings | null = null
let _audio: WechatMiniprogram.InnerAudioContext | null = null

// 累计收益缓存，避免 timer tick 频繁读 Storage
let _baseTotalMoney = 0
// 上次 commit 时的摸鱼秒数，用于增量计算
let _lastCommitSeconds = 0
// 已知的最高等级门槛；-1 表示未初始化（防止启动时误弹）
let _lastLevelThreshold = -1
// 升级弹窗是否正在展示（防止连续弹出）
let _levelUpShowing = false
// 始终运行的时钟 timer，负责入账工资/本月已赚/进度环
let _clockTimer: ReturnType<typeof setInterval> | null = null
// 后台/子页面隐藏时的已上班秒数，用于返回后补齐摸鱼收益
let _lastHideWorkedSecs = 0
// 金币雨 Canvas 上下文（onReady 初始化）
let _coinCanvas: any = null
let _coinCtx: any = null
let _coinAnimTimer: ReturnType<typeof setInterval> | null = null
// 上次触发金币雨时的 ¥10 门槛（防止重复触发）
let _lastCoinThreshold = 0

function playCoinsSound() {
  try {
    if (!_audio) {
      _audio = wx.createInnerAudioContext()
      _audio.src = '/assets/sounds/coins.mp3'
    }
    _audio.seek(0)
    _audio.play()
  } catch (_) {}
}

Page({
  data: {
    statusBarHeight: 0,
    progressStyle: 'background: conic-gradient(#66BB6A 0%, #C8E6C9 0%)',
    progressPercent: 0,
    slackingPercent: 0,  // V1.0.1: 摸鱼时间占比

    // 摸鱼计时
    isSlacking: false,
    slackingSeconds: 0,
    slackingTimeStr: '00:00:00',

    // 卡片数据
    todayEarnings: '¥0.00',          // 今日摸鱼收入
    todayWorkedEarnings: '¥0.00',    // V2.1 今日入账工资
    monthEarnings: '¥0.00',          // 本月已赚
    secondSalary: '¥0.0000/秒',      // 秒薪显示
    daysToPayday: 0,
    daysToWeekend: 0,
    workDaysInMonth: 0,

    // 等级
    levelName: '职场牛马',
    levelEmoji: '🐂',
    levelColor: '#9E9E9E',
    isGoldLevel: false,
    totalMoney: '¥0.00',

    // 节假日
    holidayText: '',
    isHolidayOrWeekend: false,

    // V2.1 计算说明
    showCalcExplain: false,
    secondSalaryValue: '0.0000',

    // V2.2 金币雨
    showCoinRain: false,

    // V1.0.1 倒计时和工时显示
    timeUntilOffWork: '还有 8 小时 30 分钟下班',
    todayWorkedTimeStr: '00:00:00',  // 今日已工时
    todaySlackingTimeStr: '00:00:00',  // 今日已摸工时

    hasSettings: false,
    slogan: SLOGANS[0],
  },

  onLoad() {
    // V1.0.1: 使用新 API getWindowInfo，兼容旧版本
    let statusBarHeight = 20
    try {
      const windowInfo = (wx as any).getWindowInfo?.()
      if (windowInfo) {
        statusBarHeight = windowInfo.statusBarHeight
      }
    } catch (_) {
      // 降级到旧 API
      const sysInfo = wx.getSystemInfoSync()
      statusBarHeight = sysInfo.statusBarHeight
    }

    const slogan = SLOGANS[Math.floor(Math.random() * SLOGANS.length)]
    this.setData({ statusBarHeight, slogan })
  },

  onReady() {
    this._initCoinCanvas()
  },

  onShow() {
    // V2.3 Fix: 重置升级弹窗标志和金币雨阈值
    _levelUpShowing = false
    _lastCoinThreshold = 0

    _settings = getSettings()
    const hasSettings = _settings.monthlySalary > 0

    // ── V2.2: 摸鱼状态补齐（切子页/进后台返回时补齐工作时间内的收益）
    if (this.data.isSlacking && _lastHideWorkedSecs > 0 && _settings) {
      const nowWorkedSecs = calcTodayWorkedSeconds(_settings)
      const catchUpSecs = Math.max(0, nowWorkedSecs - _lastHideWorkedSecs)
      if (catchUpSecs > 0) {
        const savedSecs = getTodaySlackingSeconds()
        saveTodaySlackingSeconds(savedSecs + catchUpSecs)
      }
      _lastHideWorkedSecs = 0
    }

    const slackingSeconds = getTodaySlackingSeconds()
    _lastCommitSeconds = slackingSeconds

    // 节假日
    const holidayText = getTodayStatusText()
    const dayStatus = getTodayStatus()
    const isHolidayOrWeekend = dayStatus === 'holiday' || dayStatus === 'weekend'

    // 等级 & 累计
    const moyuStats = getMoyuStats()
    _baseTotalMoney = moyuStats.totalMoney
    const level = getMoyuLevel(_baseTotalMoney)
    // V2.3 Fix: 每次 onShow 都重新初始化等级阈值（防止遗留状态影响升级检测）
    _lastLevelThreshold = level.threshold

    // 本月工作日数
    const now = new Date()
    const workDaysInMonth = getWorkingDaysInMonth(
      now.getFullYear(), now.getMonth(), _settings.workdayMode
    )

    const secondSalaryValue = getSecondSalary(_settings).toFixed(4)

    this.setData({
      hasSettings,
      slackingSeconds,
      holidayText,
      isHolidayOrWeekend,
      levelName: level.name,
      levelEmoji: level.emoji,
      levelColor: level.color,
      isGoldLevel: level.isGold,
      totalMoney: formatMoney(_baseTotalMoney),
      workDaysInMonth,
      secondSalaryValue,
      secondSalary: `¥${secondSalaryValue}/秒`,
    })

    this._refresh()
    this._updateStaticCards()
    this._updateTimeUntilOffWork()  // V1.0.1: 初始化倒计时
    this._startClock()

    // V2.2: 检查持久化的升级通知（冷启动后仍可弹窗）
    const pendingLevel = getPendingLevelUp()
    if (pendingLevel && !_levelUpShowing) {
      clearPendingLevelUp()
      setTimeout(() => this._showLevelUpModal(pendingLevel as MoyuLevel), 600)
    }

    // V2.2: 离线收益弹窗（冷启动且距上次退出超 1 小时）
    if (!this.data.isSlacking && _settings) {
      this._checkOfflineEarnings()
    }

    // 二级页返回时若计时仍开启，重启 timer
    if (this.data.isSlacking && _timer === null) {
      this._startTimer()
    }
  },

  onHide() {
    // V2.2: 记录隐藏时的已上班秒数，用于返回后补齐
    if (this.data.isSlacking && _settings) {
      _lastHideWorkedSecs = calcTodayWorkedSeconds(_settings)
    }
    // V2.3 Fix: 不停止 _timer，让它在后台继续运行，保持 storage 中的摸鱼秒数最新
    // 这样战报页可以实时读到最新的摸鱼数据
    // this._pause()  // ← 移除这个调用
    this._stopClock()  // 仅停止显示相关的时钟
  },

  onUnload() {
    // V2.3 Fix: 页面卸载时保存摸鱼数据
    if (this.data.isSlacking) {
      saveTodaySlackingSeconds(this.data.slackingSeconds)
    }
    this._stopClock()
    this._pause()
    if (_coinAnimTimer !== null) { clearInterval(_coinAnimTimer); _coinAnimTimer = null }
  },

  // ─────────── V2.2 离线收益弹窗 ──────────────────────────────
  _checkOfflineEarnings() {
    if (!_settings) return
    const exitState = getLastExitState()
    clearLastExitState()
    if (!exitState) return

    const elapsed = Date.now() - exitState.ts
    const hourMs = 3600000
    const exitDate = new Date(exitState.ts)
    const today = new Date()
    const sameDay = exitDate.getFullYear() === today.getFullYear()
      && exitDate.getMonth() === today.getMonth()
      && exitDate.getDate() === today.getDate()

    if (elapsed < hourMs || !sameDay) return

    const nowWorkedSecs = calcTodayWorkedSeconds(_settings)
    const earnedSecs = Math.max(0, nowWorkedSecs - exitState.workedSecs)
    if (earnedSecs <= 0) return

    const offlineEarnings = earnedSecs * getSecondSalary(_settings)
    setTimeout(() => {
      wx.showModal({
        title: '🐒 你不在的时候...',
        content: `我偷偷帮你从老板兜里掏走了\n${formatMoney(offlineEarnings)}\n\n打卡上班，继续薅！`,
        confirmText: '收下！',
        showCancel: false,
      })
    }, 800)
  },

  // ─────────── V1.0.1 进度条和工时显示 ─────────────────────────────
  _updateProgress() {
    if (!_settings) return

    // 已工作秒数
    const workedSecs = calcTodayWorkedSeconds(_settings)

    // 计算总工时秒数（上班时间 - 休息时间）
    const [startH, startM] = _settings.workStartTime.split(':').map(Number)
    const [endH, endM] = _settings.workEndTime.split(':').map(Number)
    const lunchDuration = _settings.lunchBreakEnabled
      ? (parseInt(_settings.lunchBreakEnd.split(':')[0]) - parseInt(_settings.lunchBreakStart.split(':')[0])) * 3600 +
        (parseInt(_settings.lunchBreakEnd.split(':')[1]) - parseInt(_settings.lunchBreakStart.split(':')[1])) * 60
      : 0
    const totalWorkSeconds = (endH - startH) * 3600 + (endM - startM) * 60 - lunchDuration

    // 摸鱼秒数
    const slackingSecs = this.data.slackingSeconds

    // 计算百分比
    const workedPercent = Math.min(100, Math.round((workedSecs / totalWorkSeconds) * 100))
    const slackingPercent = Math.min(100, Math.round((slackingSecs / totalWorkSeconds) * 100))
    // V1.0.1 Fix: 防止两个百分比之和超过 100%
    const combinedPercent = Math.min(100, workedPercent + slackingPercent)

    // 更新进度条样式：两层圆形（已工作绿色 + 已摸鱼蓝色）
    const style = `background: conic-gradient(
      #66BB6A ${workedPercent}%,
      #42A5F5 ${workedPercent}%,
      #42A5F5 ${combinedPercent}%,
      #C8E6C9 ${combinedPercent}%
    )`

    this.setData({
      progressPercent: workedPercent,
      slackingPercent,
      progressStyle: style,
      todayWorkedTimeStr: formatDuration(workedSecs),
      todaySlackingTimeStr: formatDuration(slackingSecs),
    })
  },

  // ─────────── V1.0.1 下班倒计时 ─────────────────────────────
  _updateTimeUntilOffWork() {
    if (!_settings) return
    const [eh, em] = _settings.workEndTime.split(':').map(Number)
    const now = new Date()
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0, 0)
    const remaining = endOfDay.getTime() - now.getTime()

    let text: string
    if (remaining <= 0) {
      text = '🎉 已下班，尽情摸鱼！'
    } else {
      const totalMinutes = Math.floor(remaining / 60000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      text = hours > 0
        ? `还有 ${hours} 小时 ${minutes} 分钟下班`
        : `还有 ${minutes} 分钟下班！`
    }

    this.setData({ timeUntilOffWork: text })
  },

  // ─────────── 刷新（静态时机调用）────────────────────────────
  _refresh() {
    if (!_settings) return
    const s = _settings
    const secs = this.data.slackingSeconds
    this.setData({
      todayEarnings: formatMoney(calcTodayEarnings(s, secs)),
      todayWorkedEarnings: formatMoney(calcTodayWorkedEarnings(s)),
      monthEarnings: formatMoney(calcMonthEarnings(s)),
      slackingTimeStr: formatDuration(secs),
    })
    this._updateProgress()
  },

  // ─────────── 静态倒计时卡片 ──────────────────────────────
  _updateStaticCards() {
    if (!_settings) return
    this.setData({
      daysToPayday: getDaysToPayday(_settings.payDay),
      daysToWeekend: getDaysToWeekend(),
    })
  },

  // ─────────── 等级升级弹窗 ─────────────────────────────────
  _checkLevelUp(currentTotalMoney: number) {
    const newLevel = getMoyuLevel(currentTotalMoney)

    // V2.3 Fix: 简化升级检测逻辑
    // 如果新等级的阈值 > 上次记录的等级阈值，说明升级了
    if (newLevel.threshold > _lastLevelThreshold) {
      _lastLevelThreshold = newLevel.threshold
      console.log(`[升级触发] 🎉 升级到 ${newLevel.name}！准备弹窗...`)
      this.setData({
        levelName: newLevel.name,
        levelEmoji: newLevel.emoji,
        levelColor: newLevel.color,
        isGoldLevel: newLevel.isGold,
      })
      // V2.2: 先持久化再弹窗
      setPendingLevelUp(newLevel)
      this._triggerCoinRain()
      this._showLevelUpModal(newLevel)
    }
  },

  _showLevelUpModal(level: MoyuLevel) {
    if (_levelUpShowing) return
    _levelUpShowing = true
    if (_settings?.vibrateEnabled) {
      try {
        wx.vibrateShort({ type: 'medium' })
      } catch (_) {}
    }
    wx.showModal({
      title: '🎉 吗喽进化了！',
      content: `${level.emoji} ${level.name} 解锁！\n\n你的累计摸鱼收益突破了新门槛，\n继续摸，继续进化！`,
      confirmText: '去战报',  // V2.3 Fix: 缩短为4汉字以内，修复 wx.showModal 限制
      cancelText: '继续摸鱼',
      success: (res) => {
        _levelUpShowing = false
        clearPendingLevelUp()
        if (res.confirm) wx.switchTab({ url: '/pages/stats/index' })
      },
      fail: () => { _levelUpShowing = false },
    })
  },

  // ─────────── 始终运行的时钟（入账工资/本月已赚/进度环）──────
  _startClock() {
    if (_clockTimer !== null) return
    _clockTimer = setInterval(() => {
      if (!_settings) return

      this.setData({
        todayWorkedEarnings: formatMoney(calcTodayWorkedEarnings(_settings)),
        monthEarnings: formatMoney(calcMonthEarnings(_settings)),
      })
      this._updateProgress()
      this._updateTimeUntilOffWork()  // V1.0.1: 每秒更新倒计时
    }, 1000)
  },

  _stopClock() {
    if (_clockTimer !== null) {
      clearInterval(_clockTimer)
      _clockTimer = null
    }
  },

  // ─────────── 摸鱼计时器（100ms，仅摸鱼中运行）──────────────
  _startTimer() {
    if (_timer !== null) return
    const baseSeconds = this.data.slackingSeconds
    const startAt = Date.now()

    _timer = setInterval(() => {
      if (!_settings) return
      const seconds = baseSeconds + (Date.now() - startAt) / 1000

      // V2.3 Fix: 每100ms实时保存摸鱼秒数到 storage
      // 这样战报页即使首页被隐藏，也能读到最新数据
      saveTodaySlackingSeconds(seconds)

      // 今日摸鱼收入（仅摸鱼中刷新）
      const todayEarnings = formatMoney(calcTodayEarnings(_settings, seconds))

      // 实时累计（_baseTotalMoney + 本次增量）
      const liveDelta = seconds - _lastCommitSeconds
      const liveMoney = Math.max(0, liveDelta) * getSecondSalary(_settings)
      const currentTotalMoney = _baseTotalMoney + liveMoney

      this.setData({
        slackingSeconds: seconds,
        slackingTimeStr: formatDuration(seconds),
        todayEarnings,
        totalMoney: formatMoney(currentTotalMoney),
      })

      // V1.0.1: 金币雨——每突破 ¥1 整数门槛触发一次（改为¥1频率，强化爽感）
      const earnedInt = Math.floor(calcTodayEarnings(_settings, seconds))
      if (earnedInt > _lastCoinThreshold && earnedInt >= 1) {
        _lastCoinThreshold = earnedInt
        this._triggerCoinRain()
        // V1.0.1: 金币音效与金币雨同步
        if (_settings?.soundEnabled) playCoinsSound()
      }

      // 等级升级检测
      this._checkLevelUp(currentTotalMoney)
    }, 100)
  },

  // ─────────── 暂停计时器 ──────────────────────────────────
  _pause() {
    if (_timer !== null) {
      clearInterval(_timer)
      _timer = null
      const currentSeconds = this.data.slackingSeconds
      saveTodaySlackingSeconds(currentSeconds)
      if (_settings && currentSeconds > _lastCommitSeconds) {
        const deltaSeconds = currentSeconds - _lastCommitSeconds
        const deltaMoney = deltaSeconds * getSecondSalary(_settings)
        commitMoyuSession(deltaSeconds, deltaMoney)
        _baseTotalMoney += deltaMoney
        _lastCommitSeconds = currentSeconds
      }
    }
  },

  // ─────────── V2.2 金币雨 ─────────────────────────────────
  _initCoinCanvas() {
    wx.createSelectorQuery()
      .select('#coin-rain-canvas')
      .fields({ node: true, size: true })
      .exec((res: any) => {
        if (!res || !res[0] || !res[0].node) return
        _coinCanvas = res[0].node
        // V1.0.1: 使用新 API getDeviceInfo
        let dpr = 2
        try {
          const deviceInfo = (wx as any).getDeviceInfo?.()
          if (deviceInfo && deviceInfo.pixelRatio) {
            dpr = deviceInfo.pixelRatio
          }
        } catch (_) {
          dpr = wx.getSystemInfoSync().pixelRatio || 2
        }
        _coinCanvas.width = res[0].width * dpr
        _coinCanvas.height = res[0].height * dpr
        _coinCtx = _coinCanvas.getContext('2d')
        _coinCtx.scale(dpr, dpr)
      })
  },

  _triggerCoinRain() {
    if (!_coinCtx || _coinAnimTimer !== null) return
    const canvas = _coinCanvas
    // V1.0.1: 使用新 API getDeviceInfo
    let dpr = 2
    try {
      const deviceInfo = (wx as any).getDeviceInfo?.()
      if (deviceInfo && deviceInfo.pixelRatio) {
        dpr = deviceInfo.pixelRatio
      }
    } catch (_) {
      dpr = wx.getSystemInfoSync().pixelRatio || 2
    }
    const W = canvas.width / dpr
    const H = canvas.height / dpr

    // V1.0.1: 增强粒子系统（粒子数、旋转、椭圆、重力）
    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      opacity: number
      rotation: number
      rotationSpeed: number
      aspect: number
      color: string
    }

    const COLORS = ['#FFD700', '#FFA000', '#FF8F00']
    const particles: Particle[] = Array.from({ length: 40 }, () => ({
      x: 40 + Math.random() * (W - 80),
      y: -20 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 3,
      vy: 6 + Math.random() * 6,
      size: 14 + Math.random() * 18,
      opacity: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      aspect: 0.4 + Math.random() * 0.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))

    let frame = 0
    const TOTAL = 50
    const FADE_AT = 28

    _coinAnimTimer = setInterval(() => {
      _coinCtx.clearRect(0, 0, W, H)
      frame++

      for (const p of particles) {
        p.y += p.vy
        p.x += p.vx
        p.vy += 0.4  // V1.0.1: 重力加速度（替代纯空气阻力）
        p.rotation += p.rotationSpeed

        if (frame > FADE_AT) {
          p.opacity = Math.max(0, 1 - (frame - FADE_AT) / (TOTAL - FADE_AT))
        }

        // V1.0.1: 椭圆金币绘制（模拟硬币侧面倾斜）
        _coinCtx.save()
        _coinCtx.globalAlpha = p.opacity
        _coinCtx.translate(p.x, p.y)
        _coinCtx.rotate(p.rotation)
        _coinCtx.scale(1, p.aspect)
        _coinCtx.fillStyle = p.color
        _coinCtx.beginPath()
        _coinCtx.arc(0, 0, p.size, 0, Math.PI * 2)
        _coinCtx.fill()
        _coinCtx.restore()
      }

      if (frame >= TOTAL) {
        clearInterval(_coinAnimTimer!)
        _coinAnimTimer = null
        _coinCtx.clearRect(0, 0, W, H)
        _coinCtx.globalAlpha = 1
      }
    }, 33)
  },

  // ─────────── 切换摸鱼模式 ────────────────────────────────
  onToggleSlacking() {
    // V2.2: 工作时间外禁止开摸
    if (!this.data.isSlacking && _settings && !isWorkingNow(_settings)) {
      wx.showToast({ title: '工作时间外无法开启摸鱼 🐟', icon: 'none', duration: 2000 })
      return
    }

    const isSlacking = !this.data.isSlacking
    this.setData({ isSlacking })
    if (isSlacking) {
      // V2.3 Fix: 首次开启摸鱼时展示初始身份，用 success 回调确保弹窗完全关闭后再启动 timer
      if (!hasShownInitialIdentity()) {
        const initialLevel = getMoyuLevel(0)
        setInitialIdentityShown()
        wx.showModal({
          title: '🎉 获得初始身份',
          content: `${initialLevel.emoji} ${initialLevel.name}\n\n${initialLevel.text}`,
          confirmText: '开始摸鱼',
          showCancel: false,
          success: () => {
            // 弹窗关闭后再启动计时器
            this._startTimer()
            if (_settings?.soundEnabled) playCoinsSound()
            if (_settings?.vibrateEnabled) {
              try {
                wx.vibrateShort({ type: 'light' })
              } catch (_) {}
            }
          }
        })
      } else {
        // 已显示过初始身份，直接启动计时器
        this._startTimer()
        if (_settings?.soundEnabled) playCoinsSound()
        if (_settings?.vibrateEnabled) {
          try {
            wx.vibrateShort({ type: 'light' })
          } catch (_) {}
        }
      }
    } else {
      this._pause()
    }
  },

  // ─────────── 计算说明折叠 ────────────────────────────────
  onToggleCalcExplain() {
    this.setData({ showCalcExplain: !this.data.showCalcExplain })
  },

  // ─────────── 导航 ────────────────────────────────────────
  onGoToCalendar(){ wx.navigateTo({ url: '/pages/calendar/index' }) },
})
