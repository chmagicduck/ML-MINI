App<IAppOption>({
  globalData: {},
  onLaunch() {
    const seenGuide = !!wx.getStorageSync('fishGuideSeen')
    if (!seenGuide) {
      wx.reLaunch({ url: '/pages/onboarding/index' })
    }
  },
})
