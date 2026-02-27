// pages/settings/index.ts — 设置主页（列表）
import { getSettings, saveSettings } from '../../utils/storage'

Page({
  data: {
    soundEnabled: true,
  },

  onShow() {
    const settings = getSettings()
    this.setData({ soundEnabled: settings.soundEnabled })
  },

  onGoToBasic() {
    wx.navigateTo({ url: '/pages/settings/basic' })
  },

  onToggleSound(e: WechatMiniprogram.SwitchChange) {
    const soundEnabled = e.detail.value
    const settings = getSettings()
    saveSettings({ ...settings, soundEnabled })
    this.setData({ soundEnabled })
  },
})
