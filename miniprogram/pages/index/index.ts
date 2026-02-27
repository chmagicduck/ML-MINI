// pages/index/index.ts — 首页仪表盘 V2
import { getSettings, getTodaySlackingSeconds, saveTodaySlackingSeconds, commitMoyuSession, getMoyuStats } from '../../utils/storage'
import {
  getSecondSalary,
  calcTodayEarnings,
  calcMonthEarnings,
  getTodayWorkProgress,
  getDaysToPayday,
  getDaysToWeekend,
  getDaysToRetirement,
  getMoyuLevel,
  formatMoney,
  formatDuration,
} from '../../utils/calculator'
import { getTodayStatusText, getTodayStatus } from '../../utils/holiday'
import { UserSettings } from '../../utils/types'

const SLOGANS = [
  '只要我不努力，老板就永远过不上想要的生活',
  '摸鱼一时爽，一直摸鱼一直爽',
  '打工人，打工魂，打工都是人上人',
  '躺平不是态度，是艺术',
  '上班如上坟，摸鱼保平安',
  '钱是打工人的，鱼是摸鱼人的',
  '今天摸了，明天继续摸',
]

// 模块级状态（Page 为单例，安全可用）
let _timer: ReturnType<typeof setInterval> | null = null
let _settings: UserSettings | null = null
let _audio: WechatMiniprogram.InnerAudioContext | null = null
// 上次 commit 时的秒数，防重复累计
let _lastCommitSeconds = 0

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

    // 进度环
    progressStyle: 'background: conic-gradient(#66BB6A 0%, #C8E6C9 0%)',
    progressPercent: 0,

    // 摸鱼计时
    isSlacking: false,
    slackingSeconds: 0,
    slackingTimeStr: '00:00:00',

    // 卡片数据
    todayEarnings: '¥0.00',
    monthEarnings: '¥0.00',
    secondSalary: '¥0.0000/秒',
    daysToPayday: 0,
    daysToWeekend: 0,
    daysToRetirement: 0,

    // V2: 等级
    levelName: '职场牛马',
    levelEmoji: '🐂',
    levelColor: '#9E9E9E',
    isGoldLevel: false,
    totalMoney: '¥0.00',

    // V2: 节假日状态
    holidayText: '',
    isHolidayOrWeekend: false,

    // 初始化标记
    hasSettings: false,
    slogan: SLOGANS[0],
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const slogan = SLOGANS[Math.floor(Math.random() * SLOGANS.length)]
    this.setData({ statusBarHeight: sysInfo.statusBarHeight, slogan })
  },

  onShow() {
    _settings = getSettings()
    const hasSettings = _settings.monthlySalary > 0
    const slackingSeconds = getTodaySlackingSeconds()
    _lastCommitSeconds = slackingSeconds

    // V2: 节假日状态
    const holidayText = getTodayStatusText()
    const dayStatus = getTodayStatus()
    const isHolidayOrWeekend = dayStatus === 'holiday' || dayStatus === 'weekend'

    // V2: 等级
    const moyuStats = getMoyuStats()
    const level = getMoyuLevel(moyuStats.totalMoney)

    this.setData({
      hasSettings,
      slackingSeconds,
      holidayText,
      isHolidayOrWeekend,
      levelName: level.name,
      levelEmoji: level.emoji,
      levelColor: level.color,
      isGoldLevel: level.isGold,
      totalMoney: formatMoney(moyuStats.totalMoney),
    })
    this._refresh()
    this._updateStaticCards()

    // Bug2修复：从二级页返回时若摸鱼模式仍开启，重启被 onHide 暂停的计时器
    if (this.data.isSlacking && _timer === null) {
      this._startTimer()
    }
  },

  onHide() {
    this._pause()
  },

  onUnload() {
    this._pause()
  },

  // -------- 更新进度环 --------
  _updateProgress() {
    if (!_settings) return
    const p = Math.min(getTodayWorkProgress(_settings) * 100, 100)
    const pct = Math.round(p)
    this.setData({
      progressPercent: pct,
      progressStyle: `background: conic-gradient(#66BB6A ${pct}%, #C8E6C9 ${pct}%)`,
    })
  },

  // -------- 刷新动态卡片 --------
  _refresh() {
    if (!_settings) return
    const s = _settings
    const slackingSeconds = this.data.slackingSeconds
    this.setData({
      todayEarnings: formatMoney(calcTodayEarnings(s, slackingSeconds)),
      monthEarnings: formatMoney(calcMonthEarnings(s)),
      secondSalary: `¥${getSecondSalary(s).toFixed(4)}/秒`,
      slackingTimeStr: formatDuration(slackingSeconds),
    })
    this._updateProgress()
  },

  // -------- 更新静态倒计时卡片 --------
  _updateStaticCards() {
    if (!_settings) return
    this.setData({
      daysToPayday: getDaysToPayday(_settings.payDay),
      daysToWeekend: getDaysToWeekend(),
      daysToRetirement: getDaysToRetirement(_settings.retirementDate),
    })
  },

  // -------- 启动计时器（C-1: 基于真实时间戳） --------
  _startTimer() {
    if (_timer !== null) return
    const baseSeconds = this.data.slackingSeconds
    const startAt = Date.now()
    _timer = setInterval(() => {
      const seconds = baseSeconds + (Date.now() - startAt) / 1000
      this.setData({ slackingSeconds: seconds, slackingTimeStr: formatDuration(seconds) })
      if (!_settings) return
      this.setData({
        todayEarnings: formatMoney(calcTodayEarnings(_settings, seconds)),
        monthEarnings: formatMoney(calcMonthEarnings(_settings)),
      })
      this._updateProgress()
    }, 100)
  },

  // -------- 暂停/停止计时器 --------
  _pause() {
    if (_timer !== null) {
      clearInterval(_timer)
      _timer = null
      const currentSeconds = this.data.slackingSeconds
      saveTodaySlackingSeconds(currentSeconds)
      // V2: 提交增量到累计统计（防止 onHide 多次触发导致重复计算）
      if (_settings && currentSeconds > _lastCommitSeconds) {
        const deltaSeconds = currentSeconds - _lastCommitSeconds
        const deltaMoney = deltaSeconds * getSecondSalary(_settings)
        commitMoyuSession(deltaSeconds, deltaMoney)
        _lastCommitSeconds = currentSeconds
      }
    }
  },

  // -------- 点击圆环切换摸鱼模式 --------
  onToggleSlacking() {
    const isSlacking = !this.data.isSlacking
    this.setData({ isSlacking })
    if (isSlacking) {
      this._startTimer()
      if (_settings?.soundEnabled) {
        playCoinsSound()
      }
      if (_settings?.vibrateEnabled) {
        wx.vibrateShort({ type: 'light' })
      }
    } else {
      this._pause()
    }
  },

  // -------- 导航 --------
  onGoToPoop() {
    wx.navigateTo({ url: '/pages/poop/index' })
  },
  onGoToFood() {
    wx.navigateTo({ url: '/pages/food/index' })
  },
  onGoToMeeting() {
    wx.navigateTo({ url: '/pages/meeting/index' })
  },
  onGoToCalendar() {
    wx.navigateTo({ url: '/pages/calendar/index' })
  },
})
