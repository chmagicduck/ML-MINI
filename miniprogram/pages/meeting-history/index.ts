// pages/meeting-history/index.ts — 会议历史记录
import {
  getMeetingRecordsPaged,
  updateMeetingRecord,
  deleteMeetingRecord,
} from '../../utils/storage'
import { formatMoney } from '../../utils/calculator'
import { MeetingRecord } from '../../utils/types'

const PAGE_SIZE = 10

interface DisplayRecord {
  id: string
  name: string
  participants: number
  totalCostDisplay: string
  durationDisplay: string
  dateDisplay: string
  raw: MeetingRecord
}

function formatDuration(totalSeconds: number): string {
  const s = Math.floor(Math.max(0, totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}小时${m}分${sec}秒`
  if (m > 0) return `${m}分${sec}秒`
  return `${sec}秒`
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day} ${hour}:${min}`
}

function toDisplayRecord(record: MeetingRecord): DisplayRecord {
  return {
    id: record.id,
    name: record.name,
    participants: record.participants,
    totalCostDisplay: formatMoney(record.totalCost),
    durationDisplay: formatDuration(record.durationSeconds),
    dateDisplay: formatDate(record.createdAt),
    raw: record,
  }
}

Page({
  data: {
    records: [] as DisplayRecord[],
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    isEmpty: true,
    isLoading: false,

    // 编辑态
    editingId: '',
    editName: '',
    editParticipants: 0,

    // 分享态
    shareRecord: null as DisplayRecord | null,
  },

  onLoad() {
    this._loadPage(1)
  },

  onShow() {
    this._loadPage(this.data.currentPage)
  },

  _loadPage(page: number) {
    this.setData({ isLoading: true })
    try {
      const { records, total } = getMeetingRecordsPaged(page, PAGE_SIZE)
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
      const safePage = Math.min(page, totalPages)

      const displayRecords = records.map(toDisplayRecord)

      this.setData({
        records: displayRecords,
        currentPage: safePage,
        totalPages,
        totalCount: total,
        isEmpty: total === 0,
        isLoading: false,
      })
    } catch (_) {
      this.setData({ isLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // ─── 分页 ───

  onPrevPage() {
    if (this.data.currentPage > 1) {
      this._loadPage(this.data.currentPage - 1)
    }
  },

  onNextPage() {
    if (this.data.currentPage < this.data.totalPages) {
      this._loadPage(this.data.currentPage + 1)
    }
  },

  // ─── 编辑 ───

  onStartEdit(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string
    const record = this.data.records.find(r => r.id === id)
    if (!record) return

    this.setData({
      editingId: id,
      editName: record.name,
      editParticipants: record.participants,
    })
  },

  onCancelEdit() {
    this.setData({ editingId: '' })
  },

  onEditNameInput(e: WechatMiniprogram.Input) {
    this.setData({ editName: e.detail.value })
  },

  onEditParticipantsInput(e: WechatMiniprogram.Input) {
    const num = parseInt(e.detail.value, 10)
    if (!isNaN(num) && num >= 1 && num <= 50) {
      this.setData({ editParticipants: num })
    }
  },

  onSaveEdit() {
    const { editingId, editName, editParticipants } = this.data
    if (!editingId) return

    const trimmedName = editName.trim()
    if (!trimmedName) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    if (editParticipants < 1 || editParticipants > 50) {
      wx.showToast({ title: '人数需在1-50之间', icon: 'none' })
      return
    }

    try {
      const success = updateMeetingRecord(editingId, {
        name: trimmedName,
        participants: editParticipants,
      })
      if (success) {
        this.setData({ editingId: '' })
        this._loadPage(this.data.currentPage)
        wx.showToast({ title: '已更新', icon: 'success' })
      } else {
        wx.showToast({ title: '更新失败', icon: 'none' })
      }
    } catch (_) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  // ─── 删除 ───

  onDelete(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string
    const record = this.data.records.find(r => r.id === id)
    if (!record) return

    wx.showModal({
      title: '确认删除',
      content: `确定要删除会议「${record.name}」的记录吗？此操作不可恢复。`,
      confirmColor: '#E53935',
      success: (res) => {
        if (res.confirm) {
          try {
            const success = deleteMeetingRecord(id)
            if (success) {
              this._loadPage(this.data.currentPage)
              wx.showToast({ title: '已删除', icon: 'success' })
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' })
            }
          } catch (_) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  },

  // ─── 选中记录用于分享 ───

  onSelectForShare(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string
    const record = this.data.records.find(r => r.id === id)
    if (!record) return
    this.setData({ shareRecord: record })
  },

  // ─── 分享 ───

  onShareAppMessage() {
    const record = this.data.shareRecord
    if (record) {
      this.setData({ shareRecord: null })
      return {
        title: `会议「${record.name}」：${record.participants}人参会，共消耗 ${record.totalCostDisplay}，时长 ${record.durationDisplay}`,
        path: '/pages/meeting/index',
      }
    }
    return {
      title: '来看看我们的会议烧了多少钱！',
      path: '/pages/meeting/index',
    }
  },
})
