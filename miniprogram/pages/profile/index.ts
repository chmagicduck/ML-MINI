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

  // V1.0.1: 数据重置
  resetAllData() {
    wx.showModal({
      title: '⚠️ 确认重置所有数据？',
      content: '此操作将清空所有摸鱼记录、战报数据和带薪拉粑粑统计，不可恢复。',
      confirmText: '确认重置',
      confirmColor: '#EF5350',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清除摸鱼累计统计
            wx.removeStorageSync('moyuStats')
            // 清除带薪拉粑粑统计
            wx.removeStorageSync('poopStats')
            // 清除带薪拉粑粑运行状态
            wx.removeStorageSync('poopRunningState')
            // 清除升级弹窗持久化状态
            wx.removeStorageSync('pendingLevelUp')
            // 清除离线收益弹窗状态
            wx.removeStorageSync('lastExitState')
            // 清除初始身份标记
            wx.removeStorageSync('initialIdentityShown')
            // 清除所有历日摸鱼秒数（今日及以往）
            const allKeys = wx.getStorageInfoSync().keys
            allKeys.forEach((key: string) => {
              if (key.startsWith('slackingToday_')) {
                wx.removeStorageSync(key)
              }
            })

            wx.showToast({ title: '已重置所有数据 🗑️', icon: 'success', duration: 2000 })
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/index/index' })
            }, 2000)
          } catch (err) {
            wx.showToast({ title: '重置失败，请重试', icon: 'none' })
          }
        }
      }
    })
  },
