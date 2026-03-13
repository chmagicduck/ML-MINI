// pages/food/index.ts — 今天吃什么随机抽奖 + 食物管理
import type { FoodItem, FoodHistory } from '../../utils/types'
import {
  getFoodConfig, saveFoodConfig, addFoodItem, updateFoodItem, deleteFoodItem,
  getFoodHistory, addFoodHistory, getFoodHistoryStats,
} from '../../utils/storage'

// 抽奖滚动帧间隔（毫秒）
const ROLL_INTERVAL = 80
const ROLL_DURATION = 2500
const HISTORY_DISPLAY_LIMIT = 5

let _rollTimer: ReturnType<typeof setInterval> | null = null
let _stopTimer: ReturnType<typeof setTimeout> | null = null

/** 生成唯一 ID（时间戳 + 随机串） */
function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 获取今天的日期 key（格式 YYYY-MM-DD） */
function todayKey(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

/** 新增食物表单的默认值 */
function defaultNewForm() {
  return {
    emoji: '🍱',
    name: '',
    tag: '',
    weight: 5,
  }
}

Page({
  data: {
    // ── 抽奖视图 ──
    isRolling: false,
    result: null as FoodItem | null,
    displayName: '???',
    displayEmoji: '🎰',
    displayTag: '点击开始抽奖',
    history: [] as Array<{ emoji: string; name: string; date: string }>,

    // ── 管理视图 ──
    showManager: false,
    foodList: [] as FoodItem[],
    foodStats: {} as Record<string, number>,

    // ── 编辑状态 ──
    editingId: '',
    editForm: { emoji: '', name: '', tag: '', weight: 5 },

    // ── 新增状态 ──
    showAddForm: false,
    newForm: defaultNewForm(),
  },

  // ─────────── 生命周期 ─────────────────────────────────────

  onLoad() {
    this._loadHistory()
  },

  onShow() {
    // 每次展示时刷新食物列表（从其他页面返回可能有变化）
    if (this.data.showManager) {
      this._loadFoodList()
    }
  },

  onUnload() {
    this._clearTimers()
  },

  // ─────────── 内部方法 ─────────────────────────────────────

  _clearTimers() {
    if (_rollTimer !== null) { clearInterval(_rollTimer); _rollTimer = null }
    if (_stopTimer !== null) { clearTimeout(_stopTimer); _stopTimer = null }
  },

  /** 加权随机选择 */
  _weightedRandom(items: FoodItem[]): FoodItem {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
    let random = Math.random() * totalWeight
    for (const item of items) {
      random -= item.weight
      if (random <= 0) return item
    }
    return items[items.length - 1]
  },

  /** 加载最近的食物选择历史 */
  _loadHistory() {
    const allHistory = getFoodHistory()
    const recent = allHistory
      .slice(-HISTORY_DISPLAY_LIMIT)
      .reverse()
      .map(h => ({ emoji: h.emoji, name: h.foodName, date: h.date }))
    this.setData({ history: recent })
  },

  /** 加载食物列表 + 统计 */
  _loadFoodList() {
    const foodList = getFoodConfig()
    const foodStats = getFoodHistoryStats()
    this.setData({ foodList, foodStats })
  },

  // ─────────── 抽奖逻辑 ─────────────────────────────────────

  onRoll() {
    if (this.data.isRolling) return

    const items = getFoodConfig()
    if (items.length === 0) {
      wx.showToast({ title: '请先添加食物选项', icon: 'none' })
      return
    }

    this.setData({ isRolling: true, result: null, displayTag: '选择中...' })

    // 滚动动画
    _rollTimer = setInterval(() => {
      const random = this._weightedRandom(items)
      this.setData({
        displayEmoji: random.emoji,
        displayName: random.name,
      })
    }, ROLL_INTERVAL)

    // 停止动画并定结果
    _stopTimer = setTimeout(() => {
      if (_rollTimer !== null) {
        clearInterval(_rollTimer)
        _rollTimer = null
      }

      const result = this._weightedRandom(items)
      this.setData({
        isRolling: false,
        result,
        displayEmoji: result.emoji,
        displayName: result.name,
        displayTag: result.tag,
      })
    }, ROLL_DURATION)
  },

  /** 确认选择：记录到历史 */
  onConfirm() {
    const { result } = this.data
    if (!result) return

    const entry: FoodHistory = {
      foodId: result.id,
      foodName: result.name,
      emoji: result.emoji,
      date: todayKey(),
      createdAt: Date.now(),
    }
    addFoodHistory(entry)
    this._loadHistory()

    wx.showToast({ title: `就吃${result.name}！`, icon: 'none' })
  },

  /** 重新抽奖 */
  onReroll() {
    this.setData({
      result: null,
      displayName: '???',
      displayEmoji: '🎰',
      displayTag: '点击开始抽奖',
    })
  },

  // ─────────── 管理视图切换 ─────────────────────────────────

  onOpenManager() {
    this._loadFoodList()
    this.setData({
      showManager: true,
      editingId: '',
      showAddForm: false,
    })
  },

  onCloseManager() {
    this.setData({
      showManager: false,
      editingId: '',
      showAddForm: false,
    })
  },

  // ─────────── 编辑食物 ─────────────────────────────────────

  onStartEdit(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset
    const item = this.data.foodList.find(f => f.id === id)
    if (!item) return

    this.setData({
      editingId: id,
      editForm: {
        emoji: item.emoji,
        name: item.name,
        tag: item.tag,
        weight: item.weight,
      },
      showAddForm: false,
    })
  },

  onCancelEdit() {
    this.setData({ editingId: '' })
  },

  onEditEmojiInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editForm.emoji': e.detail.value })
  },

  onEditNameInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editForm.name': e.detail.value })
  },

  onEditTagInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editForm.tag': e.detail.value })
  },

  onEditWeightChange(e: WechatMiniprogram.SliderChange) {
    this.setData({ 'editForm.weight': e.detail.value })
  },

  onSaveEdit() {
    const { editingId, editForm } = this.data
    if (!editingId) return

    const name = editForm.name.trim()
    const emoji = editForm.emoji.trim()
    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    if (!emoji) {
      wx.showToast({ title: 'Emoji 不能为空', icon: 'none' })
      return
    }

    updateFoodItem(editingId, {
      name,
      emoji,
      tag: editForm.tag.trim(),
      weight: editForm.weight,
    })

    this.setData({ editingId: '' })
    this._loadFoodList()
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  /** 管理视图中拖动权重滑块（非编辑模式下快速调整） */
  onWeightChange(e: WechatMiniprogram.SliderChange) {
    const { id } = e.currentTarget.dataset
    const newWeight = e.detail.value
    updateFoodItem(id, { weight: newWeight })
    this._loadFoodList()
  },

  // ─────────── 删除食物 ─────────────────────────────────────

  onDeleteFood(e: WechatMiniprogram.TouchEvent) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${name}」吗？`,
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          deleteFoodItem(id)
          this._loadFoodList()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      },
    })
  },

  // ─────────── 新增食物 ─────────────────────────────────────

  onShowAddForm() {
    this.setData({
      showAddForm: true,
      newForm: defaultNewForm(),
      editingId: '',
    })
  },

  onHideAddForm() {
    this.setData({ showAddForm: false })
  },

  onNewEmojiInput(e: WechatMiniprogram.Input) {
    this.setData({ 'newForm.emoji': e.detail.value })
  },

  onNewNameInput(e: WechatMiniprogram.Input) {
    this.setData({ 'newForm.name': e.detail.value })
  },

  onNewTagInput(e: WechatMiniprogram.Input) {
    this.setData({ 'newForm.tag': e.detail.value })
  },

  onNewWeightChange(e: WechatMiniprogram.SliderChange) {
    this.setData({ 'newForm.weight': e.detail.value })
  },

  onAddFood() {
    const { newForm } = this.data
    const name = newForm.name.trim()
    const emoji = newForm.emoji.trim()

    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    if (!emoji) {
      wx.showToast({ title: 'Emoji 不能为空', icon: 'none' })
      return
    }

    const item: FoodItem = {
      id: genId(),
      name,
      emoji,
      tag: newForm.tag.trim(),
      weight: newForm.weight,
      isDefault: false,
    }

    addFoodItem(item)
    this.setData({ showAddForm: false, newForm: defaultNewForm() })
    this._loadFoodList()
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  // ─────────── 分享 ─────────────────────────────────────────

  onShareAppMessage() {
    const { result } = this.data
    if (result) {
      return {
        title: `别卷了！薪潮涌动建议大家今天吃 ${result.emoji}${result.name}`,
        path: '/pages/food/index',
      }
    }
    return {
      title: '今天吃什么？让薪潮涌动帮你决定！',
      path: '/pages/food/index',
    }
  },
})
