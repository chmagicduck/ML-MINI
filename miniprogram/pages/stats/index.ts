// pages/stats/index.ts — 战报统计页 V2
import { getMoyuStats } from '../../utils/storage'
import { getMoyuLevel, getNextMoyuLevel, formatMoney, formatDuration } from '../../utils/calculator'
import { MOYU_LEVELS } from '../../utils/types'

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

Page({
  data: {
    // 累计统计
    totalMoney: '¥0.00',
    totalSeconds: 0,
    totalTimeStr: '00:00:00',
    totalDays: 0,

    // 等级信息
    levelName: '职场牛马',
    levelEmoji: '🐂',
    levelColor: '#9E9E9E',
    isGoldLevel: false,
    levelProgress: 0,         // 0~100，距离下一级进度
    nextLevelName: '',
    nextLevelThreshold: '¥500',
    isMaxLevel: false,

    // 热力图数据（最近16周 = 112天）
    heatmapRows: [] as HeatmapCell[][],
    heatmapLabels: [] as string[],  // 月份标签 ["1月","","","2月",...]
    heatmapMaxSeconds: 1,           // 用于色阶计算

    // 随机语录
    quote: MOYU_QUOTES[0],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
      this.getTabBar().refreshState()
    }
    const quote = MOYU_QUOTES[Math.floor(Math.random() * MOYU_QUOTES.length)]
    this.setData({ quote })
    this._loadStats()
  },

  onReady() {
    // 等页面渲染完成后绘制热力图
    this._drawHeatmap()
  },

  _loadStats() {
    const stats = getMoyuStats()
    const level = getMoyuLevel(stats.totalMoney)
    const nextLevel = getNextMoyuLevel(stats.totalMoney)

    // 等级进度
    let levelProgress = 100
    let nextLevelName = ''
    let nextLevelThreshold = ''
    let isMaxLevel = false

    if (nextLevel) {
      // 找当前等级的起点
      const currentThreshold = level.threshold
      const nextThreshold = nextLevel.threshold
      const span = nextThreshold - currentThreshold
      const earned = stats.totalMoney - currentThreshold
      levelProgress = Math.min(100, Math.round((earned / span) * 100))
      nextLevelName = nextLevel.name
      nextLevelThreshold = formatMoney(nextThreshold)
    } else {
      isMaxLevel = true
      levelProgress = 100
    }

    // 总天数（有摸鱼记录的天数）
    const totalDays = Object.keys(stats.moyuDaysMap).length

    // 构建热力图数据（16周 × 7天）
    const { rows, labels, maxSeconds } = buildHeatmapData(stats.moyuDaysMap)

    this.setData({
      totalMoney: formatMoney(stats.totalMoney),
      totalSeconds: stats.totalSeconds,
      totalTimeStr: formatDuration(stats.totalSeconds),
      totalDays,
      levelName: level.name,
      levelEmoji: level.emoji,
      levelColor: level.color,
      isGoldLevel: level.isGold,
      levelProgress,
      nextLevelName,
      nextLevelThreshold,
      isMaxLevel,
      heatmapRows: rows,
      heatmapLabels: labels,
      heatmapMaxSeconds: maxSeconds || 1,
    })

    // 数据加载后重绘热力图
    setTimeout(() => this._drawHeatmap(), 100)
  },

  _drawHeatmap() {
    const { heatmapRows, heatmapMaxSeconds } = this.data
    if (!heatmapRows || heatmapRows.length === 0) return

    wx.createSelectorQuery()
      .select('#heatmap-canvas')
      .fields({ node: true, size: true })
      .exec((res: any) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const { width, height } = res[0]
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
        drawHeatmapOnCanvas(ctx, heatmapRows, heatmapMaxSeconds, width, height)
      })
  },

  onShareAppMessage() {
    return {
      title: `我已摸鱼 ${this.data.totalMoney}，等级：${this.data.levelName}`,
      path: '/pages/stats/index',
    }
  },

  onGenerateShareCard() {
    wx.showToast({ title: '生成分享图中...', icon: 'loading', duration: 1500 })
    // 使用 canvas 生成分享海报
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
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        canvas.width = 750 * dpr
        canvas.height = 1000 * dpr
        ctx.scale(dpr, dpr)

        // 绘制海报
        drawPoster(ctx, {
          quote: this.data.quote,
          levelName: this.data.levelName,
          levelEmoji: this.data.levelEmoji,
          totalMoney: this.data.totalMoney,
          totalTimeStr: this.data.totalTimeStr,
        })

        // 导出图片
        wx.canvasToTempFilePath({
          canvas,
          success: (result) => {
            wx.hideToast()
            wx.previewImage({ urls: [result.tempFilePath] })
          },
          fail: () => {
            wx.hideToast()
            wx.showToast({ title: '生成失败，请重试', icon: 'none' })
          },
        })
      })
  },
})

// -------- 热力图数据构建 --------

interface HeatmapCell {
  dateStr: string
  seconds: number
  level: number  // 0=空，1~4色阶
}

function buildHeatmapData(moyuDaysMap: Record<string, number>): {
  rows: HeatmapCell[][]
  labels: string[]
  maxSeconds: number
} {
  const WEEKS = 16
  const DAYS = WEEKS * 7

  // 从今天往前推 DAYS 天
  const cells: HeatmapCell[] = []
  const today = new Date()
  // 对齐到本周日（从周日开始每列）
  const todayDow = today.getDay()
  const alignedToday = new Date(today)
  alignedToday.setDate(today.getDate() - todayDow)  // 本周日

  // 往前推 WEEKS 周
  const startDate = new Date(alignedToday)
  startDate.setDate(alignedToday.getDate() - (WEEKS - 1) * 7)

  let maxSeconds = 0
  const weekLabels: string[] = []  // 每列对应的周起始月份

  for (let w = 0; w < WEEKS; w++) {
    const weekStart = new Date(startDate)
    weekStart.setDate(startDate.getDate() + w * 7)
    const m = weekStart.getMonth() + 1
    // 若是该月的第一周显示月份标签
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(weekStart.getDate() - 7)
    weekLabels.push(weekStart.getMonth() !== prevWeekStart.getMonth() ? `${m}月` : '')

    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + d)
      const y = date.getFullYear()
      const mo = String(date.getMonth() + 1).padStart(2, '0')
      const da = String(date.getDate()).padStart(2, '0')
      const dateStr = `${y}-${mo}-${da}`
      const seconds = moyuDaysMap[dateStr] || 0
      if (seconds > maxSeconds) maxSeconds = seconds
      cells.push({ dateStr, seconds, level: 0 })
    }
  }

  // 计算色阶
  for (const cell of cells) {
    if (cell.seconds === 0) {
      cell.level = 0
    } else if (maxSeconds > 0) {
      const ratio = cell.seconds / maxSeconds
      cell.level = ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4
    }
  }

  // 转为 7 行（每行代表一个周几，7列代表7周中每周的对应天）
  // 实际 wxml 用 16列×7行，这里输出为 rows[天][周]
  const rows: HeatmapCell[][] = []
  for (let d = 0; d < 7; d++) {
    const row: HeatmapCell[] = []
    for (let w = 0; w < WEEKS; w++) {
      row.push(cells[w * 7 + d])
    }
    rows.push(row)
  }

  return { rows, labels: weekLabels, maxSeconds }
}

// -------- Canvas 绘制热力图 --------

function drawHeatmapOnCanvas(
  ctx: any,
  rows: HeatmapCell[][],
  maxSeconds: number,
  width: number,
  height: number,
) {
  const WEEKS = rows[0]?.length || 16
  const cellSize = Math.floor((width - 8) / WEEKS)
  const gap = 2
  const colors = ['#EEEEEE', '#D6E5FF', '#78A8FF', '#245EDB', '#002FA7']

  ctx.clearRect(0, 0, width, height)

  for (let d = 0; d < 7; d++) {
    for (let w = 0; w < WEEKS; w++) {
      const cell = rows[d][w]
      const x = w * (cellSize + gap)
      const y = d * (cellSize + gap)
      ctx.fillStyle = colors[cell.level]
      const r = 3
      roundRect(ctx, x, y, cellSize, cellSize, r)
      ctx.fill()
    }
  }
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

// -------- 分享海报绘制 --------

interface PosterData {
  quote: string
  levelName: string
  levelEmoji: string
  totalMoney: string
  totalTimeStr: string
}

function drawPoster(ctx: any, data: PosterData) {
  const W = 750, H = 1000

  // 背景
  ctx.fillStyle = '#F0F4F8'
  ctx.fillRect(0, 0, W, H)

  // 顶部绿色区域
  ctx.fillStyle = '#002FA7'
  ctx.fillRect(0, 0, W, 320)

  // APP名称
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 56px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('吗喽薪事 🐒', W / 2, 100)

  // slogan
  ctx.font = '28px sans-serif'
  ctx.fillStyle = '#AFC8FF'
  ctx.fillText('只要我不努力，老板就永远过不上想要的生活', W / 2, 160)

  // 等级徽章
  ctx.font = 'bold 80px sans-serif'
  ctx.fillText(data.levelEmoji, W / 2, 260)

  // 等级名
  ctx.font = 'bold 40px sans-serif'
  ctx.fillStyle = '#FFD700'
  ctx.fillText(data.levelName, W / 2, 310)

  // 白色卡片区
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, 40, 360, W - 80, 200, 20)
  ctx.fill()

  ctx.fillStyle = '#002FA7'
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('累计摸鱼收益', W / 2, 410)
  ctx.font = 'bold 72px sans-serif'
  ctx.fillText(data.totalMoney, W / 2, 500)
  ctx.font = '26px sans-serif'
  ctx.fillStyle = '#757575'
  ctx.fillText(`累计摸鱼时长 ${data.totalTimeStr}`, W / 2, 540)

  // 语录区
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, 40, 600, W - 80, 160, 20)
  ctx.fill()

  ctx.fillStyle = '#333'
  ctx.font = '28px sans-serif'
  ctx.textAlign = 'center'
  const lines = wrapText(ctx, `"${data.quote}"`, W - 120)
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 660 + i * 44)
  })

  // 底部
  ctx.fillStyle = '#9E9E9E'
  ctx.font = '24px sans-serif'
  ctx.fillText('扫码加入摸鱼大军 · 吗喽薪事', W / 2, 950)
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split('')
  const lines: string[] = []
  let line = ''
  for (const char of words) {
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
