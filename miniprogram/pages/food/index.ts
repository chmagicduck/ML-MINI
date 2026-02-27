// pages/food/index.ts — 今天吃什么随机抽奖
const FOOD_LIST = [
  { name: '黄焖鸡米饭', emoji: '🍗', tag: '万年不变' },
  { name: '麻辣烫', emoji: '🌶️', tag: '灵魂所在' },
  { name: '沙县小吃', emoji: '🥢', tag: '国民选择' },
  { name: '兰州拉面', emoji: '🍜', tag: '西北风情' },
  { name: '螺蛳粉', emoji: '🐌', tag: '臭名远扬' },
  { name: '外卖随便点', emoji: '📱', tag: '懒人福音' },
  { name: '便利店凑合', emoji: '🏪', tag: '社畜标配' },
  { name: '蹭同事的', emoji: '👀', tag: '白嫖大师' },
  { name: '不吃了！减肥！', emoji: '🥗', tag: '每天都说' },
  { name: '回家吃', emoji: '🏠', tag: '梦想而已' },
  { name: '公司食堂', emoji: '🍽️', tag: '爱恨交织' },
  { name: '包子+豆浆', emoji: '🥛', tag: '快速解决' },
  { name: '烤鸭饭', emoji: '🦆', tag: '犒劳自己' },
  { name: '炒饭随便配', emoji: '🍳', tag: '万能基础' },
  { name: '火锅（下班约）', emoji: '🫕', tag: '快乐源泉' },
]

// 抽奖滚动帧间隔（毫秒）
const ROLL_INTERVAL = 80
const ROLL_DURATION = 2500

let _rollTimer: ReturnType<typeof setInterval> | null = null
let _stopTimer: ReturnType<typeof setTimeout> | null = null

Page({
  data: {
    isRolling: false,
    result: null as (typeof FOOD_LIST)[0] | null,
    displayName: '???',
    displayEmoji: '🎰',
    displayTag: '点击开始抽奖',
    history: [] as Array<(typeof FOOD_LIST)[0]>,
  },

  onUnload() {
    this._clearTimers()
  },

  _clearTimers() {
    if (_rollTimer !== null) { clearInterval(_rollTimer); _rollTimer = null }
    if (_stopTimer !== null) { clearTimeout(_stopTimer); _stopTimer = null }
  },

  onRoll() {
    if (this.data.isRolling) return

    this.setData({ isRolling: true, result: null, displayTag: '选择中...' })

    // 滚动动画
    _rollTimer = setInterval(() => {
      const random = FOOD_LIST[Math.floor(Math.random() * FOOD_LIST.length)]
      this.setData({
        displayEmoji: random.emoji,
        displayName: random.name,
      })
    }, ROLL_INTERVAL)

    // 停止动画并定结果
    _stopTimer = setTimeout(() => {
      clearInterval(_rollTimer!)
      _rollTimer = null

      const result = FOOD_LIST[Math.floor(Math.random() * FOOD_LIST.length)]
      const history = [result, ...this.data.history].slice(0, 5)

      this.setData({
        isRolling: false,
        result,
        displayEmoji: result.emoji,
        displayName: result.name,
        displayTag: result.tag,
        history,
      })

      wx.vibrateShort({ type: 'medium' })
    }, ROLL_DURATION)
  },

  onReroll() {
    this.setData({ result: null, displayName: '???', displayEmoji: '🎰', displayTag: '点击开始抽奖' })
  },
})
