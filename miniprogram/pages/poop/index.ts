// pages/poop/index.ts — 带薪拉粑粑计时器
import {
  getSettings,
  getPoopStats,
  savePoopStats,
  savePoopRunningState,
  getPoopRunningState,
  clearPoopRunningState,
} from '../../utils/storage'
import { getSecondSalary, formatMoney, formatDuration } from '../../utils/calculator'
import { PoopStats } from '../../utils/types'

let _timer: ReturnType<typeof setInterval> | null = null
// C-3: sessions 最多保留 200 条，防止存储溢出
const MAX_SESSIONS = 200

Page({
  data: {
    // 当次计时
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
    encouragement: '开始你的专属VIP包厢时光 👑',
  },

  onLoad() {
    const settings = getSettings()
    const secondSalary = getSecondSalary(settings)
    this.setData({ secondSalary })
    this._loadStats()
  },

  onShow() {
    // 恢复计时器运行状态（切后台或切子页返回时）
    const runningState = getPoopRunningState()
    if (runningState && runningState.isRunning && runningState.sessionStartTime) {
      // 计算离线期间补齐的秒数
      const offlineSecs = Math.floor((Date.now() - runningState.sessionStartTime) / 1000)
      const newSessionSeconds = runningState.sessionSeconds + offlineSecs

      this.setData({
        isRunning: true,
        sessionSeconds: newSessionSeconds,
        sessionTimeStr: formatDuration(newSessionSeconds),
        sessionEarnings: formatMoney(this.data.secondSalary * newSessionSeconds),
      })

      // 重启计时器
      this._startTimer()
    }
  },

  onUnload() {
    this._stopTimer(false)
    clearPoopRunningState()
  },

  // H-8: onHide 时暂停计时，防止切后台继续空转
  onHide() {
    this._stopTimer(false)
    // 保存运行状态，用于 onShow 恢复
    if (this.data.isRunning) {
      savePoopRunningState({
        isRunning: true,
        sessionSeconds: this.data.sessionSeconds,
        sessionStartTime: Date.now(),
      })
    }
    this.setData({ isRunning: false })
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
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  },

  _startTimer() {
    if (_timer !== null) return
    // C-1: 基于时间戳，消除 setInterval 抖动误差
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
      date: this._todayKey(),
      seconds: sessionSeconds,
      earnings,
    }

    const newStats: PoopStats = {
      totalSeconds: stats.totalSeconds + sessionSeconds,
      totalEarnings: stats.totalEarnings + earnings,
      // C-3: 截断到最近 MAX_SESSIONS 条，防止存储溢出
      sessions: [...stats.sessions, newSession].slice(-MAX_SESSIONS),
    }

    savePoopStats(newStats)
    this._loadStats()
  },

  _getEncouragement(seconds: number): string {
    if (seconds < 60) return '刚进场，慢慢来 🚽'
    if (seconds < 180) return '进入状态了，好好享受 💆'
    if (seconds < 300) return '五分钟！职场 VIP 选手 👑'
    if (seconds < 600) return '十分钟大关！你已是传说 🏆'
    if (seconds < 1800) return '半小时！你在办公室还是桑拿房？🔥'
    return '要不要叫同事来找你？😂'
  },

  onToggle() {
    if (this.data.isRunning) {
      // 停止并保存
      this._stopTimer(true)
      clearPoopRunningState()  // 停止时清除运行状态
      this.setData({
        isRunning: false,
        sessionSeconds: 0,
        sessionTimeStr: '00:00:00',
        sessionEarnings: '¥0.0000',
        encouragement: '本次收益已入账，辛苦了！✅',
      })
    } else {
      // 开始
      this.setData({
        isRunning: true,
        encouragement: '开始你的专属VIP包厢时光 👑',
      })
      this._startTimer()
    }
  },
})
