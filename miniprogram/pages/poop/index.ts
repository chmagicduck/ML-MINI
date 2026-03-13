// pages/poop/index.ts — 带薪拉粑粑计时器（VIP厕位版）
import {
  getSettings,
  getPoopStats,
  savePoopStats,
  savePoopRunningState,
  getPoopRunningState,
  clearPoopRunningState,
  addManualPoopSession,
} from '../../utils/storage'
import { getSecondSalary, formatMoney, formatDuration } from '../../utils/calculator'
import { PoopStats } from '../../utils/types'

let _timer: ReturnType<typeof setInterval> | null = null
const MAX_SESSIONS = 200

function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

Page({
  data: {
    // 计时状态
    isRunning: false,
    sessionSeconds: 0,
    sessionTimeStr: '00:00:00',
    sessionEarnings: '¥0.0000',

    // 历史统计
    totalSeconds: 0,
    totalEarnings: '¥0.0000',
    sessionCount: 0,
    todaySeconds: 0,
    todayEarnings: '¥0.0000',

    // 当前秒薪
    secondSalary: 0,

    // 鼓励语
    encouragement: '开始你的专属VIP包厢时光',

    // 门动画状态
    doorOpen: false,

    // 手动记录
    showManualInput: false,
    manualMinutes: '',
    manualPreviewEarnings: '¥0.0000',
  },

  onLoad() {
    const settings = getSettings()
    const secondSalary = getSecondSalary(settings)
    this.setData({ secondSalary })
    this._loadStats()
  },

  onShow() {
    const runningState = getPoopRunningState()
    if (runningState && runningState.isRunning && runningState.sessionStartTime) {
      const offlineSecs = Math.floor((Date.now() - runningState.sessionStartTime) / 1000)
      const newSessionSeconds = runningState.sessionSeconds + offlineSecs

      this.setData({
        isRunning: true,
        doorOpen: true,
        sessionSeconds: newSessionSeconds,
        sessionTimeStr: formatDuration(newSessionSeconds),
        sessionEarnings: formatMoney(this.data.secondSalary * newSessionSeconds),
      })

      this._startTimer()
    }
  },

  onUnload() {
    this._stopTimer(false)
    clearPoopRunningState()
  },

  onHide() {
    this._stopTimer(false)
    if (this.data.isRunning) {
      savePoopRunningState({
        isRunning: true,
        sessionSeconds: this.data.sessionSeconds,
        sessionStartTime: Date.now(),
      })
    }
    this.setData({ isRunning: false, doorOpen: false })
  },

  _loadStats() {
    const stats = getPoopStats()
    const today = this._todayKey()
    const todaySessions = stats.sessions.filter(s => s.date === today)
    const todaySeconds = todaySessions.reduce((sum, s) => sum + s.seconds, 0)
    const todayEarnings = todaySessions.reduce((sum, s) => sum + s.earnings, 0)

    this.setData({
      totalSeconds: stats.totalSeconds,
      totalEarnings: formatMoney(stats.totalEarnings),
      sessionCount: stats.sessions.length,
      todaySeconds,
      todayEarnings: formatMoney(todayEarnings),
    })
  },

  _todayKey(): string {
    const now = new Date()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${now.getFullYear()}-${m}-${d}`
  },

  _startTimer() {
    if (_timer !== null) return
    const baseSeconds = this.data.sessionSeconds
    const startAt = Date.now()
    _timer = setInterval(() => {
      const sessionSeconds = Math.floor(baseSeconds + (Date.now() - startAt) / 1000)
      const sessionEarnings = this.data.secondSalary * sessionSeconds
      const encouragement = this._getEncouragement(sessionSeconds)
      this.setData({
        sessionSeconds,
        sessionTimeStr: formatDuration(sessionSeconds),
        sessionEarnings: formatMoney(sessionEarnings),
        encouragement,
      })
    }, 1000)
  },

  _stopTimer(save: boolean) {
    if (_timer !== null) {
      clearInterval(_timer)
      _timer = null
    }
    if (save && this.data.sessionSeconds > 0) {
      this._saveSession()
    }
  },

  _saveSession() {
    const { sessionSeconds, secondSalary } = this.data
    const earnings = secondSalary * sessionSeconds
    const stats: PoopStats = getPoopStats()

    const newSession = {
      id: genId(),
      date: this._todayKey(),
      seconds: sessionSeconds,
      earnings,
      source: 'timer' as const,
      createdAt: Date.now(),
    }

    const newStats: PoopStats = {
      totalSeconds: stats.totalSeconds + sessionSeconds,
      totalEarnings: stats.totalEarnings + earnings,
      sessions: [...stats.sessions, newSession].slice(-MAX_SESSIONS),
    }

    savePoopStats(newStats)
    this._loadStats()
  },

  _getEncouragement(seconds: number): string {
    if (seconds < 60) return '刚进场，慢慢来'
    if (seconds < 180) return '进入状态了，好好享受'
    if (seconds < 300) return '五分钟！职场VIP选手'
    if (seconds < 600) return '十分钟大关！你已是传说'
    if (seconds < 1800) return '半小时！你在办公室还是桑拿房？'
    return '要不要叫同事来找你？'
  },

  onToggle() {
    if (this.data.isRunning) {
      this._stopTimer(true)
      clearPoopRunningState()
      this.setData({
        isRunning: false,
        doorOpen: false,
        sessionSeconds: 0,
        sessionTimeStr: '00:00:00',
        sessionEarnings: '¥0.0000',
        encouragement: '本次收益已入账，辛苦了！',
      })
    } else {
      this.setData({
        isRunning: true,
        doorOpen: true,
        encouragement: '开始你的专属VIP包厢时光',
      })
      this._startTimer()
    }
  },

  // ─────────── 手动记录 ───────────────────────────

  onShowManualInput() {
    this.setData({
      showManualInput: true,
      manualMinutes: '',
      manualPreviewEarnings: '¥0.0000',
    })
  },

  onHideManualInput() {
    this.setData({ showManualInput: false })
  },

  onManualMinutesInput(e: WechatMiniprogram.Input) {
    const val = e.detail.value.trim()
    const minutes = parseFloat(val)
    if (!isNaN(minutes) && minutes > 0) {
      const earnings = this.data.secondSalary * minutes * 60
      this.setData({
        manualMinutes: val,
        manualPreviewEarnings: formatMoney(earnings),
      })
    } else {
      this.setData({
        manualMinutes: val,
        manualPreviewEarnings: '¥0.0000',
      })
    }
  },

  onConfirmManual() {
    const minutes = parseFloat(this.data.manualMinutes)
    if (isNaN(minutes) || minutes <= 0) {
      wx.showToast({ title: '请输入有效分钟数', icon: 'none' })
      return
    }

    const seconds = Math.round(minutes * 60)
    const earnings = this.data.secondSalary * seconds
    const date = this._todayKey()

    const success = addManualPoopSession(seconds, earnings, date)
    if (success) {
      this._loadStats()
      this.setData({ showManualInput: false, manualMinutes: '' })
      wx.showToast({ title: '记录成功', icon: 'success' })
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // ─────────── 导航 ───────────────────────────────

  onGoHistory() {
    wx.navigateTo({ url: '/pages/poop-history/index' })
  },
})
