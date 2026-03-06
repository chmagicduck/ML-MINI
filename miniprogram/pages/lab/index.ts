// pages/lab/index.ts — 实验室页
Page({
  data: {},

  onGoToMeeting() { wx.navigateTo({ url: '/pages/meeting/index' }) },
  onGoToPoop()    { wx.navigateTo({ url: '/pages/poop/index' }) },
  onGoToFood()    { wx.navigateTo({ url: '/pages/food/index' }) },
})
