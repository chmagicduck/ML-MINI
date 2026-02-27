// pages/settings/basic.ts — 基本设置表单
import { getSettings, saveSettings } from '../../utils/storage'
import { UserSettings, WorkdayMode } from '../../utils/types'

const WORKDAY_MODES: Array<{ key: WorkdayMode; label: string; desc: string }> = [
  { key: 'double',   label: '双休',   desc: '周六、周日休息' },
  { key: 'sat-off',  label: '周六休', desc: '只有周六休息' },
  { key: 'sun-off',  label: '周日休', desc: '只有周日休息' },
  { key: 'big-small', label: '大小周', desc: '奇数周双休，偶数周单休' },
]

// 生成 1-31 的发薪日数组
const PAY_DAYS = Array.from({ length: 31 }, (_, i) => `${i + 1}日`)

// 时间选项 00:00 ~ 23:30，步长 30 分钟
const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

Page({
  data: {
    settings: {} as UserSettings,
    workdayModes: WORKDAY_MODES,
    payDays: PAY_DAYS,
    timeOptions: TIME_OPTIONS,

    // 各 picker 当前 index
    payDayIndex: 14,          // 默认15日
    workStartIndex: 18,       // 默认09:00
    workEndIndex: 36,         // 默认18:00
    lunchStartIndex: 24,      // 默认12:00
    lunchEndIndex: 26,        // 默认13:00
    eveningStartIndex: 35,    // 默认17:30
    eveningEndIndex: 36,      // 默认18:00
  },

  onLoad() {
    const settings = getSettings()
    this.setData({
      settings,
      payDayIndex: settings.payDay - 1,
      workStartIndex: this._timeToIndex(settings.workStartTime),
      workEndIndex: this._timeToIndex(settings.workEndTime),
      lunchStartIndex: this._timeToIndex(settings.lunchBreakStart),
      lunchEndIndex: this._timeToIndex(settings.lunchBreakEnd),
      eveningStartIndex: this._timeToIndex(settings.eveningBreakStart),
      eveningEndIndex: this._timeToIndex(settings.eveningBreakEnd),
    })
  },

  // -------- 工具：时间字符串 → index --------
  _timeToIndex(time: string): number {
    const idx = TIME_OPTIONS.indexOf(time)
    return idx >= 0 ? idx : 0
  },

  // -------- 月薪输入 --------
  onSalaryInput(e: WechatMiniprogram.Input) {
    const val = parseFloat(e.detail.value) || 0
    this.setData({ 'settings.monthlySalary': val })
  },

  // -------- 发薪日选择 --------
  onPayDayChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ payDayIndex: idx, 'settings.payDay': idx + 1 })
  },

  // -------- 上班时间 --------
  onWorkStartChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ workStartIndex: idx, 'settings.workStartTime': TIME_OPTIONS[idx] })
  },

  // -------- 下班时间 --------
  onWorkEndChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ workEndIndex: idx, 'settings.workEndTime': TIME_OPTIONS[idx] })
  },

  // -------- 午休开关 --------
  onLunchBreakToggle(e: WechatMiniprogram.SwitchChange) {
    this.setData({ 'settings.lunchBreakEnabled': e.detail.value })
  },

  // -------- 午休开始 --------
  onLunchStartChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ lunchStartIndex: idx, 'settings.lunchBreakStart': TIME_OPTIONS[idx] })
  },

  // -------- 午休结束 --------
  onLunchEndChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ lunchEndIndex: idx, 'settings.lunchBreakEnd': TIME_OPTIONS[idx] })
  },

  // -------- 晚休开关 --------
  onEveningBreakToggle(e: WechatMiniprogram.SwitchChange) {
    this.setData({ 'settings.eveningBreakEnabled': e.detail.value })
  },

  // -------- 晚休开始 --------
  onEveningStartChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ eveningStartIndex: idx, 'settings.eveningBreakStart': TIME_OPTIONS[idx] })
  },

  // -------- 晚休结束 --------
  onEveningEndChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ eveningEndIndex: idx, 'settings.eveningBreakEnd': TIME_OPTIONS[idx] })
  },

  // -------- 工作日模式选择 --------
  onWorkdayModeChange(e: WechatMiniprogram.RadioGroupChange) {
    this.setData({ 'settings.workdayMode': e.detail.value as WorkdayMode })
  },

  // -------- 入职日期 --------
  onJoinDateChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ 'settings.joinDate': e.detail.value as string })
  },

  // -------- 退休日期 --------
  onRetirementDateChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ 'settings.retirementDate': e.detail.value as string })
  },

  // -------- 保存（H-6: 增加时间顺序校验） --------
  onSave() {
    const { settings } = this.data
    if (!settings.monthlySalary || settings.monthlySalary <= 0) {
      wx.showToast({ title: '请输入月薪', icon: 'none' })
      return
    }
    if (settings.workStartTime >= settings.workEndTime) {
      wx.showToast({ title: '上班时间须早于下班时间', icon: 'none' })
      return
    }
    if (settings.lunchBreakEnabled && settings.lunchBreakStart >= settings.lunchBreakEnd) {
      wx.showToast({ title: '午休开始须早于结束时间', icon: 'none' })
      return
    }
    if (settings.eveningBreakEnabled && settings.eveningBreakStart >= settings.eveningBreakEnd) {
      wx.showToast({ title: '晚休开始须早于结束时间', icon: 'none' })
      return
    }
    saveSettings(settings)
    wx.showToast({ title: '保存成功 🎉', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1200)
  },
})
