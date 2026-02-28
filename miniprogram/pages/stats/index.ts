// pages/stats/index.ts — 战报统计页 V2.3
import { getMoyuStats, getTodaySlackingSeconds, getSettings, getPendingLevelUp, clearPendingLevelUp } from '../../utils/storage'
import {
  getMoyuLevel,
  getNextMoyuLevel,
  calcTodayEarnings,
  formatMoney,
  formatDuration,
} from '../../utils/calculator'
import { MOYU_LEVELS, MoyuLevel } from '../../utils/types'

const MOYU_QUOTES = [
  '打工是不可能打工的，这辈子都不可能打工的',
  '躺平就是我的清醒，摸鱼就是我的智慧',
  '我不是在摸鱼，我是在战略性休整',
  '人在江湖飘，哪能不摸鱼',
  '身体是革命的本钱，摸鱼是革命的手段',
  '老板的钱，通过我的双手，最终还是到了我的口袋',
  '不摸鱼的打工人，不是好社畜',
  '上班摸鱼，下班躺平，这就是我的一生',
]

interface LevelRoadmapItem {
  name: string
  emoji: string
  threshold: number
  thresholdStr: string
  isUnlocked: boolean
  isCurrent: boolean
  isGold: boolean
  color: string
  progressStr: string   // "还差 ¥XX.XX" 或 ""
}

// V2.3 Fix: 实时更新计时器（仅在战报页显示时运行）
let _refreshTimer: ReturnType<typeof setInterval> | null = null

Page({
  data: {
    // 累计统计
    totalMoney: '¥0.00',
    totalSeconds: 0,
    totalTimeStr: '00:00:00',
    totalDays: 0,

    // 等级
    levelName: '职场牛马',
    levelEmoji: '🐂',
    levelColor: '#9E9E9E',
    isGoldLevel: false,
    levelProgress: 0,
    nextLevelName: '',
    nextLevelThreshold: '¥500.00',
    isMaxLevel: false,

    // V2.1 等级路线图
    levelRoadmap: [] as LevelRoadmapItem[],

    // 语录
    quote: MOYU_QUOTES[0],
  },

  onShow() {
    const quote = MOYU_QUOTES[Math.floor(Math.random() * MOYU_QUOTES.length)]
    this.setData({ quote })
    this._loadStats()

    // V2.3 Fix: 启动每秒刷新定时器，更新实时数据
    this._startRefreshTimer()

    // V2.2: 战报页也检查持久化的升级通知
    const pendingLevel = getPendingLevelUp()
    if (pendingLevel) {
      clearPendingLevelUp()
      setTimeout(() => {
        wx.showToast({ title: `🎉 ${pendingLevel.emoji} ${pendingLevel.name} 解锁！`, icon: 'none', duration: 3000 })
      }, 400)
    }
  },

  onHide() {
    // V2.3 Fix: 离开页面时停止刷新
    this._stopRefreshTimer()
  },

  onUnload() {
    // V2.3 Fix: 页面卸载时停止刷新
    this._stopRefreshTimer()
  },

  // ─────────── V2.3 Fix: 简化的实时刷新 ──────────────
  _startRefreshTimer() {
    if (_refreshTimer !== null) return
    _refreshTimer = setInterval(() => {
      this._updateLiveData()
    }, 1000)
  },

  _stopRefreshTimer() {
    if (_refreshTimer !== null) {
      clearInterval(_refreshTimer)
      _refreshTimer = null
    }
  },

  // V2.3 Fix: 仅更新实时变化的数据（不重绘 Canvas）
  _updateLiveData() {
    const stats = getMoyuStats()
    const settings = getSettings()
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const committedTodaySecs = stats.moyuDaysMap[todayKey] || 0
    const actualTodaySecs = getTodaySlackingSeconds()
    const uncommittedSecs = Math.max(0, actualTodaySecs - committedTodaySecs)
    const uncommittedMoney = uncommittedSecs > 0 ? calcTodayEarnings(settings, uncommittedSecs) : 0
    const displayTotalMoney = stats.totalMoney + uncommittedMoney

    const level = getMoyuLevel(displayTotalMoney)
    const nextLevel = getNextMoyuLevel(displayTotalMoney)
    let levelProgress = 100
    let nextLevelName = ''
    let nextLevelThreshold = ''
    let isMaxLevel = false

    if (nextLevel) {
      const span = nextLevel.threshold - level.threshold
      const earned = displayTotalMoney - level.threshold
      levelProgress = Math.min(100, Math.round((earned / span) * 100))
      nextLevelName = nextLevel.name
      nextLevelThreshold = formatMoney(nextLevel.threshold)
    } else {
      isMaxLevel = true
      levelProgress = 100
    }

    const levelRoadmap = this._buildLevelRoadmap(displayTotalMoney)

    // 仅更新实时变化的部分
    this.setData({
      totalMoney: formatMoney(displayTotalMoney),
      totalSeconds: stats.totalSeconds + uncommittedSecs,
      totalTimeStr: formatDuration(stats.totalSeconds + uncommittedSecs),
      levelName: level.name,
      levelEmoji: level.emoji,
      levelColor: level.color,
      isGoldLevel: level.isGold,
      levelProgress,
      nextLevelName,
      nextLevelThreshold,
      isMaxLevel,
      levelRoadmap,
    })
  },

  _loadStats() {
    const stats = getMoyuStats()
    const settings = getSettings()
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const committedTodaySecs = stats.moyuDaysMap[todayKey] || 0
    const actualTodaySecs = getTodaySlackingSeconds()
    const uncommittedSecs = Math.max(0, actualTodaySecs - committedTodaySecs)
    const uncommittedMoney = uncommittedSecs > 0 ? calcTodayEarnings(settings, uncommittedSecs) : 0
    const displayTotalMoney = stats.totalMoney + uncommittedMoney

    // 等级与进度
    const level = getMoyuLevel(displayTotalMoney)
    const nextLevel = getNextMoyuLevel(displayTotalMoney)

    let levelProgress = 100
    let nextLevelName = ''
    let nextLevelThreshold = ''
    let isMaxLevel = false

    if (nextLevel) {
      const span = nextLevel.threshold - level.threshold
      const earned = displayTotalMoney - level.threshold
      levelProgress = Math.min(100, Math.round((earned / span) * 100))
      nextLevelName = nextLevel.name
      nextLevelThreshold = formatMoney(nextLevel.threshold)
    } else {
      isMaxLevel = true
      levelProgress = 100
    }

    // 等级路线图
    const levelRoadmap = this._buildLevelRoadmap(displayTotalMoney)

    // 总天数
    const totalDays = Object.keys(stats.moyuDaysMap).length

    this.setData({
      totalMoney: formatMoney(displayTotalMoney),
      totalSeconds: stats.totalSeconds + uncommittedSecs,
      totalTimeStr: formatDuration(stats.totalSeconds + uncommittedSecs),
      totalDays,
      levelName: level.name,
      levelEmoji: level.emoji,
      levelColor: level.color,
      isGoldLevel: level.isGold,
      levelProgress,
      nextLevelName,
      nextLevelThreshold,
      isMaxLevel,
      levelRoadmap,
    })
  },

  // V2.1 等级路线图构建
  _buildLevelRoadmap(totalMoney: number): LevelRoadmapItem[] {
    const currentLevel = getMoyuLevel(totalMoney)
    return MOYU_LEVELS.map((level, idx) => {
      const isUnlocked = totalMoney >= level.threshold
      const isCurrent = level.threshold === currentLevel.threshold
      const nextLevel = MOYU_LEVELS[idx + 1]
      let progressStr = ''
      if (isCurrent && nextLevel) {
        const remaining = nextLevel.threshold - totalMoney
        progressStr = remaining > 0 ? `还差 ${formatMoney(remaining)}` : ''
      }
      return {
        name: level.name,
        emoji: level.emoji,
        threshold: level.threshold,
        thresholdStr: formatMoney(level.threshold),
        isUnlocked,
        isCurrent,
        isGold: level.isGold,
        color: level.color,
        progressStr,
      }
    })
  },

  onShareAppMessage() {
    return {
      title: `我已摸鱼 ${this.data.totalMoney}，等级：${this.data.levelName}`,
      path: '/pages/stats/index',
    }
  },

  onGenerateShareCard() {
    wx.showToast({ title: '生成战报中...', icon: 'loading', duration: 1500 })
    this._generatePoster()
  },

  _generatePoster() {
    wx.createSelectorQuery()
      .select('#poster-canvas')
      .fields({ node: true, size: true })
      .exec((res: any) => {
        if (!res || !res[0] || !res[0].node) {
          wx.showToast({ title: '生成失败', icon: 'none' })
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        // V1.0.1: 使用新 API getDeviceInfo
        let dpr = 2
        try {
          const deviceInfo = (wx as any).getDeviceInfo?.()
          if (deviceInfo && deviceInfo.pixelRatio) {
            dpr = deviceInfo.pixelRatio
          }
        } catch (_) {
          dpr = wx.getSystemInfoSync().pixelRatio || 2
        }
        canvas.width = 750 * dpr
        canvas.height = 1080 * dpr
        ctx.scale(dpr, dpr)

        drawPoster(ctx, {
          quote: this.data.quote,
          levelName: this.data.levelName,
          levelEmoji: this.data.levelEmoji,
          totalMoney: this.data.totalMoney,
          totalTimeStr: this.data.totalTimeStr,
        })

        // V1.0.1: 生成后弹出操作菜单
        wx.canvasToTempFilePath({
          canvas,
          success: (result) => {
            wx.hideToast()
            wx.showActionSheet({
              itemList: ['分享给朋友', '保存到相册'],
              success: (res) => {
                if (res.tapIndex === 0) {
                  // 分享给朋友（调用小程序分享）
                  wx.showToast({ title: '长按图片分享给朋友', icon: 'none', duration: 2000 })
                  wx.previewImage({ urls: [result.tempFilePath] })
                } else if (res.tapIndex === 1) {
                  // 保存到相册
                  wx.saveImageToPhotosAlbum({
                    filePath: result.tempFilePath,
                    success: () => {
                      wx.showToast({ title: '已保存到相册', icon: 'success', duration: 2000 })
                    },
                    fail: () => {
                      wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none', duration: 2000 })
                    }
                  })
                }
              },
            })
          },
          fail: () => {
            wx.hideToast()
            wx.showToast({ title: '生成失败，请重试', icon: 'none' })
          },
        })
      })
  },
})

// ─────────── 分享海报绘制 ────────────────────────────────────

// V2.2: 等级反讽文案
const LEVEL_SARCASM: Record<string, string> = {
  '职场牛马': '刚踏上摸鱼之路，革命尚未成功，同志继续偷懒。',
  '摸鱼学徒': '已初窥摸鱼门道，但距大师境界，还差三年摸瓜。',
  '带薪锦鲤': '我这辈子唯一的坚持，就是每天带薪拉屎。',
  '划水宗师': '上班是我的副业，摸鱼才是我的正业。',
  '摸鱼大圣': '老板的钱，最终都要回到打工人的口袋。',
}

interface PosterData {
  quote: string
  levelName: string
  levelEmoji: string
  totalMoney: string
  totalTimeStr: string
}

function drawPoster(ctx: any, data: PosterData) {
  const W = 750, H = 1080
  ctx.fillStyle = '#F0F4F0'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#2E7D32'
  ctx.fillRect(0, 0, W, 340)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 56px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('吗喽薪事 🐒', W / 2, 100)
  ctx.font = '28px sans-serif'
  ctx.fillStyle = '#A5D6A7'
  ctx.fillText('只要我不努力，老板就永远过不上想要的生活', W / 2, 160)
  ctx.font = 'bold 80px sans-serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(data.levelEmoji, W / 2, 260)
  ctx.font = 'bold 40px sans-serif'
  ctx.fillStyle = '#FFD700'
  ctx.fillText(data.levelName, W / 2, 310)

  // V2.2: 等级反讽文案（小字）
  const sarcasm = LEVEL_SARCASM[data.levelName] || ''
  if (sarcasm) {
    ctx.font = '22px sans-serif'
    ctx.fillStyle = 'rgba(165,214,167,0.9)'
    ctx.fillText(sarcasm, W / 2, 340)
  }

  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, 40, 380, W - 80, 200, 20)
  ctx.fill()
  ctx.fillStyle = '#1B5E20'
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('累计摸鱼收益', W / 2, 430)
  ctx.font = 'bold 72px sans-serif'
  ctx.fillText(data.totalMoney, W / 2, 520)
  ctx.font = '26px sans-serif'
  ctx.fillStyle = '#757575'
  ctx.fillText(`累计摸鱼时长 ${data.totalTimeStr}`, W / 2, 560)

  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, 40, 620, W - 80, 160, 20)
  ctx.fill()
  ctx.fillStyle = '#333'
  ctx.font = '28px sans-serif'
  ctx.textAlign = 'center'
  const lines = wrapText(ctx, `"${data.quote}"`, W - 120)
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 660 + i * 44))

  ctx.fillStyle = '#9E9E9E'
  ctx.font = '24px sans-serif'
  ctx.fillText('扫码加入摸鱼大军 · 吗喽薪事', W / 2, 1030)
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of text.split('')) {
    const testLine = line + char
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      lines.push(line)
      line = char
    } else {
      line = testLine
    }
  }
  if (line) lines.push(line)
  return lines
}
