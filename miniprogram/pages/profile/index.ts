// pages/profile/index.ts — 个人基地
import {
  getSettings,
  getMoyuStats,
  getTodaySlackingSeconds,
  getUserAvatar,
  saveUserAvatar,
  getUserNickname,
  saveUserNickname,
} from '../../utils/storage'
import {
  getMoyuLevel,
  getNextMoyuLevel,
  formatMoney,
  calcTodayEarnings,
} from '../../utils/calculator'
import { MOYU_LEVELS } from '../../utils/types'

interface RoadmapNode {
  name: string
  shortName: string
  emoji: string
  isReached: boolean
}

let _profileTimer: ReturnType<typeof setInterval> | null = null

Page({
  data: {
    // 用户信息
    avatarUrl: '',
    nickname: '',

    // 收益 & 等级
    totalMoney: '¥0.0000',
    levelName: '职场新人',
    levelEmoji: '🐣',
    levelProgress: 0,
    diffToNext: '0.0000',
    isMaxLevel: false,

    // 摸鱼天数
    moyuDays: 0,

    // 路线图
    roadmapNodes: [] as RoadmapNode[],
    roadmapActiveWidth: '0%',

    // 统计
    beatPercent: '99.2%',
    efficiencyLabel: '优秀',
  },

  onShow() {
    this.setData({
      avatarUrl: getUserAvatar(),
      nickname: getUserNickname(),
    })
    this._loadData()
    this._startRealtimeRefresh()
  },

  onHide() {
    this._stopRealtimeRefresh()
  },

  onUnload() {
    this._stopRealtimeRefresh()
  },

  _startRealtimeRefresh() {
    if (_profileTimer !== null) return
    _profileTimer = setInterval(() => {
      this._loadData()
    }, 1000)
  },

  _stopRealtimeRefresh() {
    if (_profileTimer !== null) {
      clearInterval(_profileTimer)
      _profileTimer = null
    }
  },

  _loadData() {
    const stats = getMoyuStats()
    const settings = getSettings()

    // 计算实时总收益（含未提交的摸鱼秒数）
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const committedTodaySecs = stats.moyuDaysMap[todayKey] || 0
    const actualTodaySecs = getTodaySlackingSeconds()
    const uncommittedSecs = Math.max(0, actualTodaySecs - committedTodaySecs)
    const uncommittedMoney = uncommittedSecs > 0 ? calcTodayEarnings(settings, uncommittedSecs) : 0
    const displayTotalMoney = stats.totalMoney + uncommittedMoney

    // 等级
    const level = getMoyuLevel(displayTotalMoney)
    const nextLevel = getNextMoyuLevel(displayTotalMoney)

    let levelProgress = 100
    let diffToNext = '0.00'
    let isMaxLevel = false

    if (nextLevel) {
      const span = nextLevel.threshold - level.threshold
      const earned = displayTotalMoney - level.threshold
      levelProgress = Math.min(100, Math.round((earned / span) * 100))
      diffToNext = (nextLevel.threshold - displayTotalMoney).toFixed(4)
    } else {
      isMaxLevel = true
    }

    // 摸鱼天数
    const moyuDays = Object.keys(stats.moyuDaysMap).length

    // 路线图节点
    const currentLevelIndex = MOYU_LEVELS.findIndex(l => l.threshold === level.threshold)
    const shortNames: Record<string, string> = {
      '职场新人': '新人',
      '摸鱼入门': '入门',
      '摸鱼学徒': '学徒',
      '小有成就': '成就',
      '带薪锦鲤': '锦鲤',
      '摸鱼能手': '能手',
      '职场老油条': '油条',
      '划水宗师': '宗师',
      '摸鱼大圣': '大圣',
      '传说打工人': '传说',
    }
    const roadmapNodes: RoadmapNode[] = MOYU_LEVELS.map((lvl, idx) => ({
      name: lvl.name,
      shortName: shortNames[lvl.name] || lvl.name,
      emoji: lvl.emoji,
      isReached: idx <= currentLevelIndex,
    }))

    // 路线图激活线宽度
    const roadmapActiveWidth = currentLevelIndex >= 0
      ? `calc(${(currentLevelIndex / (MOYU_LEVELS.length - 1)) * 100}% - 16rpx)`
      : '0%'

    // 摸鱼效率标签
    const totalSeconds = stats.totalSeconds + uncommittedSecs
    let efficiencyLabel = '一般'
    if (totalSeconds > 3600 * 50) {
      efficiencyLabel = '卓越'
    } else if (totalSeconds > 3600 * 20) {
      efficiencyLabel = '优秀'
    } else if (totalSeconds > 3600 * 5) {
      efficiencyLabel = '良好'
    }

    // 击败同事百分比（基于摸鱼天数的简化算法）
    let beatPercent = '50.0%'
    if (moyuDays > 100) {
      beatPercent = '99.9%'
    } else if (moyuDays > 50) {
      beatPercent = '95.0%'
    } else if (moyuDays > 20) {
      beatPercent = '85.0%'
    } else if (moyuDays > 5) {
      beatPercent = '60.0%'
    }

    this.setData({
      totalMoney: formatMoney(displayTotalMoney),
      levelName: level.name,
      levelEmoji: level.emoji,
      levelProgress,
      diffToNext,
      isMaxLevel,
      moyuDays,
      roadmapNodes,
      roadmapActiveWidth,
      beatPercent,
      efficiencyLabel,
    })
  },

  onChooseAvatar(e: any) {
    const tempPath: string = e.detail.avatarUrl
    if (!tempPath) return
    const fs = wx.getFileSystemManager()
    const savedPath = `${wx.env.USER_DATA_PATH}/avatar.png`
    fs.saveFile({
      tempFilePath: tempPath,
      filePath: savedPath,
      success: () => {
        saveUserAvatar(savedPath)
        this.setData({ avatarUrl: savedPath })
      },
      fail: () => {
        saveUserAvatar(tempPath)
        this.setData({ avatarUrl: tempPath })
      },
    })
  },

  onNicknameChange(e: any) {
    const name: string = (e.detail.value || '').trim()
    if (name) {
      saveUserNickname(name)
      this.setData({ nickname: name })
    }
  },

  onGoToBasic() {
    wx.navigateTo({ url: '/pages/settings/basic' })
  },

  onGoToCalendar() {
    wx.navigateTo({ url: '/pages/calendar/index' })
  },

  resetAllData() {
    wx.showModal({
      title: '⚠️ 确认重置所有数据？',
      content: '此操作将清空所有摸鱼记录、战报数据和带薪拉粑粑统计，不可恢复。',
      confirmText: '确认重置',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          try {
            const keysToRemove = [
              'userSettings',
              'moyuStats',
              'poopStats',
              'poopRunningState',
              'meetingRunningState',
              'pendingLevelUp',
              'lastExitState',
              'initialIdentityShown',
              'onboardingDone',
              'userAvatar',
              'userNickname',
            ]

            keysToRemove.forEach(key => {
              wx.removeStorageSync(key)
            })

            try {
              const allKeys = wx.getStorageInfoSync().keys
              allKeys.forEach((key: string) => {
                if (key.startsWith('slackingToday_')) {
                  wx.removeStorageSync(key)
                }
              })
            } catch (_) {}

            wx.showToast({ title: '已重置所有数据', icon: 'success', duration: 2000 })
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/index/index' })
            }, 2000)
          } catch (_) {
            wx.showToast({ title: '重置失败，请重试', icon: 'none' })
          }
        }
      }
    })
  },
})
