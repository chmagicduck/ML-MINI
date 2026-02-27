// pages/meeting/index.ts — 会议烧钱机 V2
import { getSettings } from '../../utils/storage'
import { getSecondSalary, formatMoney } from '../../utils/calculator'

// 模块级状态
let _timer: ReturnType<typeof setInterval> | null = null
let _startAt = 0
let _secondCost = 0  // 每秒总花费（所有参会者）

Page({
  data: {
    participants: 5,         // 参会人数（默认5人）
    isRunning: false,
    elapsedSeconds: 0,
    totalCost: '¥0.00',
    costPerSecond: '¥0.00/秒',
    perSecondRaw: 0,
    hasSettings: false,
  },

  onLoad() {
    const settings = getSettings()
    const hasSettings = settings.monthlySalary > 0
    const perSec = getSecondSalary(settings)
    this.setData({
      hasSettings,
      perSecondRaw: perSec,
    })
    this._updateCostDisplay()
  },

  onUnload() {
    this._stop()
  },

  onHide() {
    this._stop()
  },

  _updateCostDisplay() {
    const { participants, perSecondRaw } = this.data
    _secondCost = perSecondRaw * participants
    this.setData({
      costPerSecond: `${formatMoney(_secondCost)}/秒`,
    })
  },

  // -------- 参会人数调整 --------
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
    const n = e.detail.value
    this.setData({ participants: n })
    this._updateCostDisplay()
  },

  // -------- 开始/停止 --------
  onToggle() {
    if (this.data.isRunning) {
      this._stop()
    } else {
      this._start()
    }
  },

  onReset() {
    this._stop()
    this.setData({
      elapsedSeconds: 0,
      totalCost: '¥0.00',
    })
  },

  _start() {
    if (_timer !== null) return
    _startAt = Date.now() - this.data.elapsedSeconds * 1000
    this.setData({ isRunning: true })

    _timer = setInterval(() => {
      const elapsed = (Date.now() - _startAt) / 1000
      const cost = elapsed * _secondCost
      this.setData({
        elapsedSeconds: elapsed,
        totalCost: formatMoney(cost),
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

})
