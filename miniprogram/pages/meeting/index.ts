// pages/meeting/index.ts — 会议烧钱机 V2.2（支持自定义人均月薪 + 分享）
import { getSettings, saveMeetingRunningState, getMeetingRunningState, clearMeetingRunningState } from '../../utils/storage'
import { getSecondSalary, formatMoney, getWorkingDaysInMonth, getDailyWorkMinutes } from '../../utils/calculator'

let _timer: ReturnType<typeof setInterval> | null = null
let _startAt = 0
let _secondCost = 0

Page({
  data: {
    participants: 5,
    isRunning: false,
    elapsedSeconds: 0,
    totalCost: '¥0.00',
    costPerSecond: '¥0.00/秒',
    perSecondRaw: 0,          // 自己的秒薪
    hasSettings: false,

    // V2.2 自定义人均月薪
    useCustomSalary: false,
    customSalaryStr: '',      // input 绑定的字符串
    customSalaryNum: 0,       // 解析后的数值
  },

  onLoad() {
    const settings = getSettings()
    const hasSettings = settings.monthlySalary > 0
    const perSec = getSecondSalary(settings)
    this.setData({ hasSettings, perSecondRaw: perSec })
    this._updateCostDisplay()
  },

  onShow() {
    // 切后台返回时恢复计时（恢复时同步人数/自定义薪资上下文，避免成本跳变）
    const state = getMeetingRunningState()
    if (state && state.isRunning) {
      clearMeetingRunningState()

      const participants = state.participants ?? this.data.participants
      const useCustomSalary = state.useCustomSalary ?? this.data.useCustomSalary
      const customSalaryNum = state.customSalaryNum ?? this.data.customSalaryNum
      const customSalaryStr = useCustomSalary && customSalaryNum > 0 ? String(customSalaryNum) : ''

      this.setData({ participants, useCustomSalary, customSalaryNum, customSalaryStr })
      this._updateCostDisplay()

      const offlineSecs = (Date.now() - state.savedAt) / 1000
      const newElapsed = state.elapsedSeconds + offlineSecs
      this.setData({
        elapsedSeconds: newElapsed,
        totalCost: formatMoney(newElapsed * _secondCost),
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
      })
    }
    this._stop()
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
    this.setData({ costPerSecond: `${formatMoney(_secondCost)}/秒` })
  },

  onDecParticipants() {
    const n = Math.max(1, this.data.participants - 1)
    this.setData({ participants: n })
    this._updateCostDisplay()
  },

  onIncParticipants() {
    const n = Math.min(50, this.data.participants + 1)
    this.setData({ participants: n })
    this._updateCostDisplay()
  },

  onParticipantsChange(e: WechatMiniprogram.SliderChange) {
    this.setData({ participants: e.detail.value })
    this._updateCostDisplay()
  },

  // V2.2: 自定义月薪开关
  onToggleCustomSalary() {
    const useCustomSalary = !this.data.useCustomSalary
    this.setData({ useCustomSalary })
    this._updateCostDisplay()
  },

  // V2.2: 自定义月薪输入
  onCustomSalaryInput(e: WechatMiniprogram.Input) {
    const str = e.detail.value
    const num = parseFloat(str) || 0
    this.setData({ customSalaryStr: str, customSalaryNum: num })
    this._updateCostDisplay()
  },

  onToggle() {
    if (this.data.isRunning) { this._stop() } else { this._start() }
  },

  onReset() {
    this._stop()
    clearMeetingRunningState()
    this.setData({ elapsedSeconds: 0, totalCost: '¥0.00' })
  },

  _start() {
    if (_timer !== null) return
    _startAt = Date.now() - this.data.elapsedSeconds * 1000
    this.setData({ isRunning: true })
    _timer = setInterval(() => {
      const elapsed = (Date.now() - _startAt) / 1000
      this.setData({ elapsedSeconds: elapsed, totalCost: formatMoney(elapsed * _secondCost) })
    }, 100)
  },

  _stop() {
    if (_timer !== null) { clearInterval(_timer); _timer = null }
    this.setData({ isRunning: false })
  },

  // V2.2: 分享
  onShareAppMessage() {
    const { participants, totalCost } = this.data
    const costRate = formatMoney(_secondCost)
    return {
      title: `正在参加一个 ${costRate}/秒 的高端会议，${participants}人已烧掉 ${totalCost}，速来帮我算算这会开完公司还剩多少钱 💸`,
      path: '/pages/meeting/index',
    }
  },
})
