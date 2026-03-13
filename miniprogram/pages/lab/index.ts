// pages/lab/index.ts — 深海动力室
Page({
  data: {},

  onGoToMeeting() { wx.navigateTo({ url: '/pages/meeting/index' }) },
  onGoToPoop()    { wx.navigateTo({ url: '/pages/poop/index' }) },
  onGoToFood()    { wx.navigateTo({ url: '/pages/food/index' }) },
})
