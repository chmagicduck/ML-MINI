Page({
  data: {
    steps: [
      { title: '① 建立资产基线', desc: '填写月薪、工时与工作日规则，系统自动计算单位秒价值。' },
      { title: '② 开始深潜', desc: '点击「开始摸鱼」，收益会以毫秒级速度滚动增长。' },
      { title: '③ 查看战报', desc: '在战报页追踪收益趋势与等级成长。' },
    ],
  },
  onStart() {
    wx.setStorageSync('fishGuideSeen', true)
    wx.switchTab({ url: '/pages/index/index' })
  },
})
