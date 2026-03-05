Page({
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
      this.getTabBar().refreshState()
    }
  },
  onGoToMeeting() { wx.navigateTo({ url: '/pages/meeting/index' }) },
  onGoToPoop() { wx.navigateTo({ url: '/pages/poop/index' }) },
  onGoToFood() { wx.navigateTo({ url: '/pages/food/index' }) },
  onGoToCalendar() { wx.navigateTo({ url: '/pages/calendar/index' }) },
})
