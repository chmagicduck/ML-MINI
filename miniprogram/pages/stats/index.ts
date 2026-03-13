// pages/stats/index.ts — 洋流情报
import { getSettings, getMoyuStats, getTodaySlackingSeconds } from '../../utils/storage'
import { calcStatsBreakdown, StatsBreakdown, StatsDimension } from '../../utils/calculator'

/** 维度标签映射 */
const DIMENSION_LABELS: Record<StatsDimension, string> = {
  day: '今日工时中摸鱼占比',
  week: '本周工时中摸鱼占比',
  month: '本月工时中摸鱼占比',
  year: '全年工时中摸鱼占比',
}

let _refreshTimer: ReturnType<typeof setInterval> | null = null

Page({
  data: {
    activeTab: 'day' as StatsDimension,

    // 甜甜圈样式（CSS conic-gradient）
    donutStyle: '',

    // 中心数据
    centerLabel: '今日工时中摸鱼占比',
    moyuRate: '0.0%',

    // 图例数据
    workTime: '0h',
    workPercent: '0%',
    moyuTime: '0h',
    moyuPercent: '0%',
    futureTime: '--',
    futurePercent: '--',
    hasFuture: true,
  },

  onShow() {
    this._loadData()
    this._startRefresh()
  },

  onHide() {
    this._stopRefresh()
  },

  onUnload() {
    this._stopRefresh()
  },

  /** 每秒刷新数据（实时更新当日维度） */
  _startRefresh() {
    if (_refreshTimer !== null) return
    _refreshTimer = setInterval(() => {
      this._loadData()
    }, 1000)
  },

  _stopRefresh() {
    if (_refreshTimer !== null) {
      clearInterval(_refreshTimer)
      _refreshTimer = null
    }
  },

  /** 切换维度 tab */
  onSwitchTab(e: any) {
    const tab = e.currentTarget.dataset.tab as StatsDimension
    this.setData({ activeTab: tab })
    this._loadData()
  },

  /** 加载并渲染统计数据 */
  _loadData() {
    const settings = getSettings()
    const stats = getMoyuStats()
    const dimension = this.data.activeTab

    // 构建含未提交秒数的 moyuDaysMap
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const actualTodaySecs = getTodaySlackingSeconds()
    const moyuDaysMap = { ...stats.moyuDaysMap }
    if (actualTodaySecs > (moyuDaysMap[todayKey] || 0)) {
      moyuDaysMap[todayKey] = actualTodaySecs
    }

    const breakdown = calcStatsBreakdown(settings, moyuDaysMap, dimension)
    this._renderBreakdown(breakdown, dimension)
  },

  /** 将统计结果渲染到界面 */
  _renderBreakdown(b: StatsBreakdown, dim: StatsDimension) {
    const total = b.totalSeconds || 1

    // 各区段百分比
    const workPct = (b.workSeconds / total) * 100
    const moyuPct = (b.moyuSeconds / total) * 100
    const futurePct = (b.futureSeconds / total) * 100

    // 摸鱼率 = 摸鱼时间 / 工时（工作+摸鱼），即上班时间中的摸鱼比例
    const onClock = b.workSeconds + b.moyuSeconds
    const moyuRate = onClock > 0
      ? ((b.moyuSeconds / onClock) * 100).toFixed(1)
      : '0.0'

    // CSS conic-gradient 甜甜圈（灰=工作，蓝=摸鱼，极浅=未到）
    const d1 = (workPct / 100) * 360
    const d2 = d1 + (moyuPct / 100) * 360
    const donutStyle = `background: conic-gradient(#CBD5E1 0deg ${d1}deg, #3B82F6 ${d1}deg ${d2}deg, #F1F5F9 ${d2}deg 360deg)`

    const hasFuture = b.futureSeconds > 0

    this.setData({
      donutStyle,
      centerLabel: DIMENSION_LABELS[dim],
      moyuRate: `${moyuRate}%`,
      workTime: formatHours(b.workSeconds),
      workPercent: `${workPct.toFixed(1)}%`,
      moyuTime: formatHours(b.moyuSeconds),
      moyuPercent: `${moyuPct.toFixed(1)}%`,
      futureTime: hasFuture ? formatHours(b.futureSeconds) : '--',
      futurePercent: hasFuture ? `${futurePct.toFixed(1)}%` : '--',
      hasFuture,
    })
  },
})

/** 秒数格式化为可读时长（如 2.5h、45m、30s） */
function formatHours(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}
