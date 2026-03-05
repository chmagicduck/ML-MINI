Page({
  data: {
    steps: [
      { title: '① 录入工资参数', desc: '配置月薪、发薪日、工时与工作日规则，建立收益净值基线。' },
      { title: '② 点击开始摸鱼', desc: '首页将以毫秒级实时滚动显示「今日鱼额」。' },
      { title: '③ 查看资产战报', desc: '在战报页观察热力趋势、等级成长与累计收益。' },
    ],
  },
  onGoSetup() {
    wx.navigateTo({ url: '/pages/settings/basic?fromGuide=1' })
  },
})
