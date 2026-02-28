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

    hasSettings: false,
    slogan: SLOGANS[0],
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const slogan = SLOGANS[Math.floor(Math.random() * SLOGANS.length)]
    this.setData({ statusBarHeight: sysInfo.statusBarHeight, slogan })
  },

  onReady() {
    this._initCoinCanvas()
  },

  onShow() {
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
    this._stopClock()
    this._pause()
  },

  onUnload() {
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

  // ─────────── 进度环 ───────────────────────────────────────
  _updateProgress() {
    if (!_settings) return
    const p = Math.min(getTodayWorkProgress(_settings) * 100, 100)
    const pct = Math.round(p)
    this.setData({
      progressPercent: pct,
      progressStyle: `background: conic-gradient(#66BB6A ${pct}%, #C8E6C9 ${pct}%)`,
    })
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
    if (_lastLevelThreshold < 0) {
      _lastLevelThreshold = newLevel.threshold
      return
    }
    if (newLevel.threshold > _lastLevelThreshold) {
      _lastLevelThreshold = newLevel.threshold
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
      confirmText: '去战报看看',
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

      // V2.2: 金币雨——每突破 ¥10 整数门槛触发一次
      const earnedInt = Math.floor(calcTodayEarnings(_settings, seconds))
      const coinThreshold = Math.floor(earnedInt / 10) * 10
      if (coinThreshold > _lastCoinThreshold && earnedInt >= 10) {
        _lastCoinThreshold = coinThreshold
        this._triggerCoinRain()
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
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        _coinCanvas.width = res[0].width * dpr
        _coinCanvas.height = res[0].height * dpr
        _coinCtx = _coinCanvas.getContext('2d')
        _coinCtx.scale(dpr, dpr)
      })
  },

  _triggerCoinRain() {
    if (!_coinCtx || _coinAnimTimer !== null) return
    const canvas = _coinCanvas
    const dpr = wx.getSystemInfoSync().pixelRatio || 2
    const W = canvas.width / dpr
    const H = canvas.height / dpr

    interface Particle { x: number; y: number; vx: number; vy: number; size: number; opacity: number }
    const particles: Particle[] = Array.from({ length: 18 }, () => ({
      x: 40 + Math.random() * (W - 80),
      y: -20 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 3,
      vy: 5 + Math.random() * 5,
      size: 18 + Math.random() * 16,
      opacity: 1,
    }))

    let frame = 0
    const TOTAL = 50
    const FADE_AT = 32

    _coinAnimTimer = setInterval(() => {
      _coinCtx.clearRect(0, 0, W, H)
      frame++

      for (const p of particles) {
        p.y += p.vy
        p.x += p.vx
        p.vy *= 0.98  // 空气阻力
        if (frame > FADE_AT) {
          p.opacity = Math.max(0, 1 - (frame - FADE_AT) / (TOTAL - FADE_AT))
        }
        _coinCtx.globalAlpha = p.opacity
        _coinCtx.font = `${p.size}px sans-serif`
        _coinCtx.textAlign = 'center'
        _coinCtx.fillText('🪙', p.x, p.y)
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
      this._startTimer()
      if (_settings?.soundEnabled) playCoinsSound()
      if (_settings?.vibrateEnabled) wx.vibrateShort({ type: 'light' })
    } else {
      this._pause()
    }
  },

  // ─────────── 计算说明折叠 ────────────────────────────────
  onToggleCalcExplain() {
    this.setData({ showCalcExplain: !this.data.showCalcExplain })
  },

  // ─────────── 导航 ────────────────────────────────────────
  onGoToPoop()    { wx.navigateTo({ url: '/pages/poop/index' }) },
  onGoToFood()    { wx.navigateTo({ url: '/pages/food/index' }) },
  onGoToMeeting() { wx.navigateTo({ url: '/pages/meeting/index' }) },
  onGoToCalendar(){ wx.navigateTo({ url: '/pages/calendar/index' }) },
})
