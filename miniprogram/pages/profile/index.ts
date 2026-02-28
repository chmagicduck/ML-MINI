// pages/profile/index.ts — 我的页 V1.0.1
import { getSettings, saveSettings, getCurrentSkin, setCurrentSkin } from '../../utils/storage'
import { SKINS } from '../../utils/types'

Page({
  data: {
    soundEnabled: true,
    vibrateEnabled: true,
    monthlySalary: 0,
    salaryDisplay: '未设置',

    // V1.0.1: 皮肤系统
    currentSkin: 'default',
    availableSkins: Object.entries(SKINS).map(([id, skin]) => ({
      id,
      ...skin,
    })),
  },

  onShow() {
    const settings = getSettings()
    const currentSkin = getCurrentSkin()

    this.setData({
      soundEnabled: settings.soundEnabled,
      vibrateEnabled: settings.vibrateEnabled,
      monthlySalary: settings.monthlySalary,
      currentSkin,
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

  // V1.0.1: 选择皮肤
  onSkinTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset
    const skin = SKINS[id as keyof typeof SKINS]

    if (!skin) return

    // 检查解锁条件
    if (skin.unlockType === 'ad') {
      wx.showToast({ title: '需要观看广告解锁', icon: 'none', duration: 2000 })
      return
    }

    if (skin.unlockType === 'level') {
      const settings = getSettings()
      wx.showToast({ title: `需要累计摸鱼 ¥${skin.unlockLevel} 解锁`, icon: 'none', duration: 2000 })
      return
    }

    // 应用皮肤
    setCurrentSkin(id)
    this.setData({ currentSkin: id })
    wx.showToast({ title: `已更换皮肤: ${skin.name}`, icon: 'success', duration: 1500 })
  },
})
