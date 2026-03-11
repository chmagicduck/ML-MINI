// pages/lab/index.ts — 深海实验室 V1.0
Page({
  data: {},

  onGoToMeeting() { wx.navigateTo({ url: '/pages/meeting/index' }) },
  onGoToPoop()    { wx.navigateTo({ url: '/pages/poop/index' }) },
  onGoToFood()    { wx.navigateTo({ url: '/pages/food/index' }) },
})
