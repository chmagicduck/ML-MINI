// pages/poop-history/index.ts — 蹲坑历史记录
import {
  getPoopStats,
  getPoopSessionsPaged,
  updatePoopSession,
  deletePoopSession,
  getSettings,
} from '../../utils/storage'
import { getSecondSalary, formatMoney, formatDuration } from '../../utils/calculator'
import { PoopSession } from '../../utils/types'

const PAGE_SIZE = 10

interface DisplaySession extends PoopSession {
  durationStr: string
  earningsStr: string
  sourceLabel: string
}

Page({
  data: {
    // 列表
    sessions: [] as DisplaySession[],
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    hasMore: false,

    // 汇总
    totalEarnings: '¥0.0000',
    totalSeconds: 0,
    totalDurationStr: '00:00:00',

    // 编辑
    editingId: '',
    editMinutes: '',
    editPreviewEarnings: '¥0.0000',
    showEditPanel: false,

    // 薪资
    secondSalary: 0,
  },

  onLoad() {
    const settings = getSettings()
    const secondSalary = getSecondSalary(settings)
    this.setData({ secondSalary })
    this._loadSummary()
    this._loadPage(1)
  },

  onShow() {
    this._loadSummary()
    this._loadPage(this.data.currentPage)
  },

  _loadSummary() {
    const stats = getPoopStats()
    this.setData({
      totalEarnings: formatMoney(stats.totalEarnings),
      totalSeconds: stats.totalSeconds,
      totalDurationStr: formatDuration(stats.totalSeconds),
    })
  },

  _loadPage(page: number) {
    const { sessions, total } = getPoopSessionsPaged(page, PAGE_SIZE)
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1

    const displaySessions: DisplaySession[] = sessions.map(s => ({
      ...s,
      durationStr: formatDuration(s.seconds),
      earningsStr: formatMoney(s.earnings),
      sourceLabel: s.source === 'timer' ? '计时器' : '手动',
    }))

    this.setData({
      sessions: displaySessions,
      currentPage: page,
      totalPages,
      totalCount: total,
      hasMore: page < totalPages,
    })
  },

  // ─────────── 分页 ───────────────────────────────

  onNextPage() {
    if (this.data.currentPage < this.data.totalPages) {
      this._loadPage(this.data.currentPage + 1)
    }
  },

  onPrevPage() {
    if (this.data.currentPage > 1) {
      this._loadPage(this.data.currentPage - 1)
    }
  },

  // ─────────── 编辑 ───────────────────────────────

  onEditSession(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const session = this.data.sessions.find(s => s.id === id)
    if (!session) return

    const minutes = String(Math.round(session.seconds / 60))
    this.setData({
      editingId: id,
      editMinutes: minutes,
      editPreviewEarnings: formatMoney(session.earnings),
      showEditPanel: true,
    })
  },

  onEditMinutesInput(e: WechatMiniprogram.Input) {
    const val = e.detail.value.trim()
    const minutes = parseFloat(val)
    if (!isNaN(minutes) && minutes > 0) {
      const earnings = this.data.secondSalary * minutes * 60
      this.setData({
        editMinutes: val,
        editPreviewEarnings: formatMoney(earnings),
      })
    } else {
      this.setData({
        editMinutes: val,
        editPreviewEarnings: '¥0.0000',
      })
    }
  },

  onConfirmEdit() {
    const minutes = parseFloat(this.data.editMinutes)
    if (isNaN(minutes) || minutes <= 0) {
      wx.showToast({ title: '请输入有效分钟数', icon: 'none' })
      return
    }

    const seconds = Math.round(minutes * 60)
    const earnings = this.data.secondSalary * seconds

    const success = updatePoopSession(this.data.editingId, { seconds, earnings })
    if (success) {
      this.setData({ showEditPanel: false, editingId: '' })
      this._loadSummary()
      this._loadPage(this.data.currentPage)
      wx.showToast({ title: '修改成功', icon: 'success' })
    } else {
      wx.showToast({ title: '修改失败', icon: 'none' })
    }
  },

  onCancelEdit() {
    this.setData({ showEditPanel: false, editingId: '' })
  },

  // ─────────── 删除 ───────────────────────────────

  onDeleteSession(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确认删除这条蹲坑记录？',
      confirmColor: '#E53E3E',
      success: (res) => {
        if (res.confirm) {
          const success = deletePoopSession(id)
          if (success) {
            this._loadSummary()
            // 如果当前页已无数据，退回上一页
            const remaining = this.data.totalCount - 1
            const maxPage = Math.ceil(remaining / PAGE_SIZE) || 1
            const page = Math.min(this.data.currentPage, maxPage)
            this._loadPage(page)
            wx.showToast({ title: '已删除', icon: 'success' })
          } else {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  },

  // ─────────── 分享 ───────────────────────────────

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const { totalDurationStr, totalEarnings } = this.data
    return {
      title: `我已累计蹲坑 ${totalDurationStr}，赚了 ${totalEarnings}`,
      path: '/pages/poop/index',
    }
  },
})
