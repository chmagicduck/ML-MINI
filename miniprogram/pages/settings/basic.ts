// pages/settings/basic.ts — 基本设置表单
import { getSettings, saveSettings } from '../../utils/storage'
import { UserSettings, WorkdayMode } from '../../utils/types'

const WORKDAY_MODES: Array<{ key: WorkdayMode; label: string; desc: string }> = [
  { key: 'double',    label: '双休',   desc: '周六、周日均休息' },
  { key: 'sat-off',  label: '周六休', desc: '仅周六休息（周日上班）' },
  { key: 'sun-off',  label: '周日休', desc: '仅周日休息（周六上班）' },
  { key: 'big-small', label: '大小周', desc: '奇数周双休，偶数周仅周日休' },
]

const PAY_DAYS = Array.from({ length: 31 }, (_, i) => `${i + 1}日`)

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

    payDayIndex: 14,
    workStartIndex: 18,
    workEndIndex: 36,
    lunchStartIndex: 24,
    lunchEndIndex: 26,

    fromOnboarding: false,
  },

  onLoad(options: Record<string, string>) {
    const fromOnboarding = options.from === 'onboarding'
    const settings = getSettings()
    this.setData({
      fromOnboarding,
      settings,
      payDayIndex: settings.payDay - 1,
      workStartIndex: this._timeToIndex(settings.workStartTime),
      workEndIndex: this._timeToIndex(settings.workEndTime),
      lunchStartIndex: this._timeToIndex(settings.lunchBreakStart),
      lunchEndIndex: this._timeToIndex(settings.lunchBreakEnd),
    })
  },

  _timeToIndex(time: string): number {
    const idx = TIME_OPTIONS.indexOf(time)
    return idx >= 0 ? idx : 0
  },

  onSalaryInput(e: WechatMiniprogram.Input) {
    const val = parseFloat(e.detail.value) || 0
    this.setData({ 'settings.monthlySalary': val })
  },

  onPayDayChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ payDayIndex: idx, 'settings.payDay': idx + 1 })
  },

  onWorkStartChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ workStartIndex: idx, 'settings.workStartTime': TIME_OPTIONS[idx] })
  },

  onWorkEndChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ workEndIndex: idx, 'settings.workEndTime': TIME_OPTIONS[idx] })
  },

  onLunchBreakToggle(e: WechatMiniprogram.SwitchChange) {
    this.setData({ 'settings.lunchBreakEnabled': e.detail.value })
  },

  onLunchStartChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ lunchStartIndex: idx, 'settings.lunchBreakStart': TIME_OPTIONS[idx] })
  },

  onLunchEndChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value)
    this.setData({ lunchEndIndex: idx, 'settings.lunchBreakEnd': TIME_OPTIONS[idx] })
  },

  onWorkdayModeChange(e: WechatMiniprogram.RadioGroupChange) {
    this.setData({ 'settings.workdayMode': e.detail.value as WorkdayMode })
  },

  // 保存前校验
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
    saveSettings(settings)

    if (this.data.fromOnboarding) {
      wx.showToast({ title: '设置完成 🎉', icon: 'success' })
      setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 1200)
    } else {
      wx.showToast({ title: '保存成功 🎉', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1200)
    }
  },

})
