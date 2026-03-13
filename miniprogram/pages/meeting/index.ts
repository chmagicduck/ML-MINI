// pages/meeting/index.ts — 烧钱会议机（重构版：会议桌可视化 + 会议名称 + 结束会议）
import {
  getSettings,
  saveMeetingRunningState,
  getMeetingRunningState,
  clearMeetingRunningState,
  saveMeetingRecord,
} from '../../utils/storage'
import {
  getSecondSalary,
  formatMoney,
  getWorkingDaysInMonth,
  getDailyWorkMinutes,
} from '../../utils/calculator'
import { MeetingRecord } from '../../utils/types'

const AVATARS = ['👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '😴', '🤔', '🥴', '🤡', '🐒', '🐟']

let _timer: ReturnType<typeof setInterval> | null = null
let _startAt = 0
let _secondCost = 0
let _meetingStartTimestamp = 0

function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function buildAvatarList(count: number): Array<{ emoji: string; index: number }> {
  const list: Array<{ emoji: string; index: number }> = []
  for (let i = 0; i < count; i++) {
    list.push({ emoji: AVATARS[i % AVATARS.length], index: i })
  }
  return list
}

function formatElapsed(totalSeconds: number): string {
  const s = Math.floor(Math.max(0, totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
}

Page({
  data: {
    participants: 5,
    isRunning: false,
    elapsedSeconds: 0,
    totalCost: '0.0000',
    costPerSecond: '0.0000',
    perSecondRaw: 0,
    hasSettings: false,
    elapsedDisplay: '00:00:00',

    // 会议名称
    meetingName: '',

    // 自定义人均月薪
    useCustomSalary: false,
    customSalaryStr: '',
    customSalaryNum: 0,

    // 头像列表
    avatarList: [] as Array<{ emoji: string; index: number }>,
  },

  onLoad() {
    const settings = getSettings()
    const hasSettings = settings.monthlySalary > 0
    const perSec = getSecondSalary(settings)
    const avatarList = buildAvatarList(5)
    this.setData({ hasSettings, perSecondRaw: perSec, avatarList })
    this._updateCostDisplay()
  },

  onShow() {
    const state = getMeetingRunningState()
    if (state && state.isRunning) {
      clearMeetingRunningState()

      const participants = state.participants ?? this.data.participants
      const useCustomSalary = state.useCustomSalary ?? this.data.useCustomSalary
      const customSalaryNum = state.customSalaryNum ?? this.data.customSalaryNum
      const customSalaryStr = useCustomSalary && customSalaryNum > 0 ? String(customSalaryNum) : ''
      const meetingName = state.meetingName ?? this.data.meetingName

      this.setData({
        participants,
        useCustomSalary,
        customSalaryNum,
        customSalaryStr,
        meetingName,
        avatarList: buildAvatarList(participants),
      })
      this._updateCostDisplay()

      const offlineSecs = (Date.now() - state.savedAt) / 1000
      const newElapsed = state.elapsedSeconds + offlineSecs
      this.setData({
        elapsedSeconds: newElapsed,
        totalCost: this._formatCostNumber(newElapsed * _secondCost),
        elapsedDisplay: formatElapsed(newElapsed),
      })
      this._start()
    }
  },

  onUnload() {
    this._stop()
    clearMeetingRunningState()
  },

  onHide() {
    if (this.data.isRunning) {
      saveMeetingRunningState({
        isRunning: true,
        elapsedSeconds: this.data.elapsedSeconds,
        savedAt: Date.now(),
        participants: this.data.participants,
        useCustomSalary: this.data.useCustomSalary,
        customSalaryNum: this.data.customSalaryNum,
        meetingName: this.data.meetingName,
      })
    }
    this._stop()
  },

  // ─── 辅助格式化 ───

  _formatCostNumber(amount: number): string {
    if (!isFinite(amount) || isNaN(amount)) return '0.0000'
    return amount.toFixed(4)
  },

  _updateCostDisplay() {
    const { participants, perSecondRaw, useCustomSalary, customSalaryNum } = this.data

    let perSec = perSecondRaw
    if (useCustomSalary && customSalaryNum > 0) {
      const settings = getSettings()
      const now = new Date()
      const workDays = getWorkingDaysInMonth(now.getFullYear(), now.getMonth(), settings.workdayMode)
      const dailySecs = getDailyWorkMinutes(settings) * 60
      perSec = customSalaryNum / workDays / dailySecs
    }

    _secondCost = perSec * participants
    this.setData({ costPerSecond: _secondCost.toFixed(4) })
  },

  // ─── 会议名称 ───

  onMeetingNameInput(e: WechatMiniprogram.Input) {
    this.setData({ meetingName: e.detail.value })
  },

  // ─── 参会人数 ───

  onDecParticipants() {
    const n = Math.max(1, this.data.participants - 1)
    this.setData({ participants: n, avatarList: buildAvatarList(n) })
    this._updateCostDisplay()
  },

  onIncParticipants() {
    const n = Math.min(50, this.data.participants + 1)
    this.setData({ participants: n, avatarList: buildAvatarList(n) })
    this._updateCostDisplay()
  },

  onParticipantsChange(e: WechatMiniprogram.SliderChange) {
    const n = e.detail.value
    this.setData({ participants: n, avatarList: buildAvatarList(n) })
    this._updateCostDisplay()
  },

  // ─── 自定义月薪 ───

  onToggleCustomSalary() {
    const useCustomSalary = !this.data.useCustomSalary
    this.setData({ useCustomSalary })
    this._updateCostDisplay()
  },

  onCustomSalaryInput(e: WechatMiniprogram.Input) {
    const str = e.detail.value
    const num = parseFloat(str) || 0
    this.setData({ customSalaryStr: str, customSalaryNum: num })
    this._updateCostDisplay()
  },

  // ─── 控制按钮 ───

  onToggle() {
    if (this.data.isRunning) {
      this._stop()
    } else {
      if (!this.data.meetingName.trim()) {
        wx.showToast({ title: '请先输入会议名称', icon: 'none' })
        return
      }
      this._start()
    }
  },

  onReset() {
    wx.showModal({
      title: '确认重置',
      content: '重置将清除当前会议计时数据，此操作不可恢复。确定要重置吗？',
      confirmColor: '#E53935',
      success: (res) => {
        if (res.confirm) {
          this._stop()
          clearMeetingRunningState()
          _meetingStartTimestamp = 0
          this.setData({
            elapsedSeconds: 0,
            totalCost: '0.0000',
            elapsedDisplay: '00:00:00',
          })
        }
      },
    })
  },

  onEndMeeting() {
    if (!this.data.isRunning && this.data.elapsedSeconds <= 0) {
      wx.showToast({ title: '还没有开始会议', icon: 'none' })
      return
    }

    this._stop()

    const now = Date.now()
    const { elapsedSeconds, participants, meetingName, useCustomSalary, customSalaryNum } = this.data

    let averageSalary = 0
    if (useCustomSalary && customSalaryNum > 0) {
      averageSalary = customSalaryNum
    } else {
      try {
        const settings = getSettings()
        averageSalary = settings.monthlySalary
      } catch (_) {
        averageSalary = 0
      }
    }

    const totalCostNum = elapsedSeconds * _secondCost

    const record: MeetingRecord = {
      id: genId(),
      name: meetingName.trim() || '未命名会议',
      participants,
      totalCost: totalCostNum,
      durationSeconds: elapsedSeconds,
      averageSalary,
      startTime: _meetingStartTimestamp || (now - elapsedSeconds * 1000),
      endTime: now,
      createdAt: now,
    }

    try {
      saveMeetingRecord(record)
    } catch (_) {
      wx.showToast({ title: '保存记录失败', icon: 'none' })
      return
    }

    clearMeetingRunningState()
    _meetingStartTimestamp = 0

    this.setData({
      elapsedSeconds: 0,
      totalCost: '0.0000',
      elapsedDisplay: '00:00:00',
      meetingName: '',
    })

    wx.showToast({ title: '会议已结束并保存', icon: 'success' })
  },

  // ─── 导航 ───

  onGoHistory() {
    wx.navigateTo({ url: '/pages/meeting-history/index' })
  },

  // ─── 内部计时 ───

  _start() {
    if (_timer !== null) return
    if (_meetingStartTimestamp === 0) {
      _meetingStartTimestamp = Date.now() - this.data.elapsedSeconds * 1000
    }
    _startAt = Date.now() - this.data.elapsedSeconds * 1000
    this.setData({ isRunning: true })
    _timer = setInterval(() => {
      const elapsed = (Date.now() - _startAt) / 1000
      this.setData({
        elapsedSeconds: elapsed,
        totalCost: this._formatCostNumber(elapsed * _secondCost),
        elapsedDisplay: formatElapsed(elapsed),
      })
    }, 100)
  },

  _stop() {
    if (_timer !== null) {
      clearInterval(_timer)
      _timer = null
    }
    this.setData({ isRunning: false })
  },

  // ─── 分享 ───

  onShareAppMessage() {
    const { participants, totalCost } = this.data
    const costRate = formatMoney(_secondCost)
    return {
      title: `${participants}人会议已烧掉 ¥${totalCost}，速率 ${costRate}/秒 💸`,
      path: '/pages/meeting/index',
    }
  },
})
