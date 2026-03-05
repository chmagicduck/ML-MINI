import { getSettings } from './utils/storage'

App<IAppOption>({
  globalData: {},
  onLaunch() {
    const settings = getSettings()
    const seenGuide = !!wx.getStorageSync('fishGuideSeen')
    if (!seenGuide || !settings.monthlySalary || settings.monthlySalary <= 0) {
      wx.reLaunch({ url: '/pages/onboarding/index' })
    }
  },
})
