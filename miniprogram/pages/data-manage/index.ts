// pages/data-manage/index.ts — 数据管理

interface StorageModule {
  name: string
  keys: string[]
  keyCount: number
  estimatedKB: string
  clearable: boolean
}

/** 估算一组 storage key 的大小（KB） */
function estimateSize(keys: string[]): string {
  let totalBytes = 0
  for (const key of keys) {
    try {
      const val = wx.getStorageSync(key)
      if (val !== undefined && val !== null && val !== '') {
        totalBytes += JSON.stringify(val).length * 2
      }
    } catch (_) { /* skip */ }
  }
  const kb = totalBytes / 1024
  return kb < 1 ? '<1' : kb.toFixed(1)
}

Page({
  data: {
    totalUsedKB: 0,
    totalLimitKB: 10240,
    usagePercent: 0,
    usageBarWidth: '0%',
    modules: [] as StorageModule[],
  },

  onShow() {
    this._loadStorageInfo()
  },

  _loadStorageInfo() {
    try {
      const info = wx.getStorageInfoSync()
      const totalUsedKB = info.currentSize
      const totalLimitKB = info.limitSize
      const usagePercent = Math.min(100, Math.round((totalUsedKB / totalLimitKB) * 100))

      const allKeys = info.keys
      const moyuKeys = allKeys.filter(k => k === 'moyuStats' || k.startsWith('slackingToday_'))
      const poopKeys = allKeys.filter(k => k === 'poopStats' || k === 'poopRunningState')
      const meetingKeys = allKeys.filter(k => k === 'meetingRunningState')
      const settingsKeys = allKeys.filter(k =>
        k === 'userSettings' || k === 'userAvatar' || k === 'userNickname'
      )
      const knownKeys = new Set([...moyuKeys, ...poopKeys, ...meetingKeys, ...settingsKeys])
      const otherKeys = allKeys.filter(k => !knownKeys.has(k))

      const modules: StorageModule[] = [
        { name: '摸鱼统计', keys: moyuKeys, keyCount: moyuKeys.length, estimatedKB: estimateSize(moyuKeys), clearable: true },
        { name: '拉粑粑统计', keys: poopKeys, keyCount: poopKeys.length, estimatedKB: estimateSize(poopKeys), clearable: true },
        { name: '会议统计', keys: meetingKeys, keyCount: meetingKeys.length, estimatedKB: estimateSize(meetingKeys), clearable: true },
        { name: '用户设置', keys: settingsKeys, keyCount: settingsKeys.length, estimatedKB: estimateSize(settingsKeys), clearable: false },
        { name: '其他', keys: otherKeys, keyCount: otherKeys.length, estimatedKB: estimateSize(otherKeys), clearable: false },
      ]

      this.setData({
        totalUsedKB,
        totalLimitKB,
        usagePercent,
        usageBarWidth: `${usagePercent}%`,
        modules,
      })
    } catch (_) {
      wx.showToast({ title: '读取存储信息失败', icon: 'none' })
    }
  },

  onClearModule(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index as number
    const mod = this.data.modules[index]
    if (!mod || mod.keys.length === 0 || !mod.clearable) return

    wx.showModal({
      title: `确认清除「${mod.name}」？`,
      content: `将删除 ${mod.keyCount} 条存储记录，不可恢复。`,
      confirmText: '确认清除',
      confirmColor: '#EF4444',
      success: (res) => {
        if (!res.confirm) return
        try {
          for (const key of mod.keys) {
            wx.removeStorageSync(key)
          }
          wx.showToast({ title: `${mod.name} 已清除`, icon: 'success' })
          this._loadStorageInfo()
        } catch (_) {
          wx.showToast({ title: '清除失败', icon: 'none' })
        }
      },
    })
  },

  onResetAll() {
    wx.showModal({
      title: '确认重置所有数据？',
      content: '此操作将清空所有摸鱼记录、统计数据和设置，不可恢复。',
      confirmText: '确认重置',
      confirmColor: '#EF4444',
      success: (res) => {
        if (!res.confirm) return
        try {
          const info = wx.getStorageInfoSync()
          for (const key of info.keys) {
            wx.removeStorageSync(key)
          }
          wx.showToast({ title: '已重置所有数据', icon: 'success', duration: 2000 })
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/index/index' })
          }, 2000)
        } catch (_) {
          wx.showToast({ title: '重置失败', icon: 'none' })
        }
      },
    })
  },
})
