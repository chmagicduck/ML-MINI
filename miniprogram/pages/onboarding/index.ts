// pages/onboarding/index.ts — 引导页
import { setOnboardingDone } from '../../utils/storage'

interface StepInfo {
  title: string
  description: string
  icon: string
  bgClass: string
}

const STEPS: StepInfo[] = [
  {
    title: '欢迎来到薪潮涌动',
    description: '在这里，每一秒的工作都有价值。我们将时间转化为实时收益，让摸鱼变得理直气壮。',
    icon: '✨',
    bgClass: 'icon-bg-blue',
  },
  {
    title: '精准算账',
    description: '输入你的月薪和工作时间，我们将为你实时计算"摸鱼时薪"，看着账户数字跳动，心情更愉悦。',
    icon: '💰',
    bgClass: 'icon-bg-orange',
  },
  {
    title: '下班倒计时',
    description: '不再盯着枯燥的时钟。通过"退潮倒计时"，陪着你的小鱼一起游向自由。',
    icon: '🎯',
    bgClass: 'icon-bg-green',
  },
]

Page({
  data: {
    step: 0,
    currentTitle: STEPS[0].title,
    currentDesc: STEPS[0].description,
    currentIcon: STEPS[0].icon,
    currentBgClass: STEPS[0].bgClass,
    btnText: '继续探索',
    isLastStep: false,
    statusBarHeight: 20,
    dotIndexes: [0, 1, 2],
  },

  onLoad() {
    let statusBarHeight = 20
    try {
      const windowInfo = (wx as any).getWindowInfo?.()
      if (windowInfo) statusBarHeight = windowInfo.statusBarHeight
    } catch (_) {
      try {
        const sysInfo = wx.getSystemInfoSync()
        statusBarHeight = sysInfo.statusBarHeight
      } catch (_e) {}
    }
    this.setData({ statusBarHeight })
  },

  onNext() {
    const { step } = this.data
    if (step < STEPS.length - 1) {
      const next = step + 1
      const info = STEPS[next]
      this.setData({
        step: next,
        currentTitle: info.title,
        currentDesc: info.description,
        currentIcon: info.icon,
        currentBgClass: info.bgClass,
        isLastStep: next === STEPS.length - 1,
        btnText: next === STEPS.length - 1 ? '开启薪潮涌动' : '继续探索',
      })
    } else {
      setOnboardingDone()
      wx.redirectTo({ url: '/pages/settings/basic?from=onboarding' })
    }
  },
})
