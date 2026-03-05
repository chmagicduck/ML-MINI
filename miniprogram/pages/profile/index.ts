// pages/profile/index.ts — 我的页 V2
import { getSettings, saveSettings } from '../../utils/storage'

Page({
  data: {
    soundEnabled: true,
    vibrateEnabled: true,
    monthlySalary: 0,
    salaryDisplay: '未设置',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
      this.getTabBar().refreshState()
    }
    const settings = getSettings()
    this.setData({
      soundEnabled: settings.soundEnabled,
      vibrateEnabled: settings.vibrateEnabled,
      monthlySalary: settings.monthlySalary,
      salaryDisplay: settings.monthlySalary > 0
        ? `¥${settings.monthlySalary.toLocaleString()}/月`
        : '未设置',
    })
  },

  onGoToBasic() {
    wx.navigateTo({ url: '/pages/settings/basic' })
  },

  onGoToCalendar() {
    wx.navigateTo({ url: '/pages/calendar/index' })
  },

  onToggleSound(e: WechatMiniprogram.SwitchChange) {
    const soundEnabled = e.detail.value
    const settings = getSettings()
    saveSettings({ ...settings, soundEnabled })
    this.setData({ soundEnabled })
  },

  onToggleVibrate(e: WechatMiniprogram.SwitchChange) {
    const vibrateEnabled = e.detail.value
    const settings = getSettings()
    saveSettings({ ...settings, vibrateEnabled })
    this.setData({ vibrateEnabled })
  },
})
