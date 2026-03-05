import { getSettings, getTodaySlackingSeconds, saveTodaySlackingSeconds, commitMoyuSession, getMoyuStats } from '../../utils/storage'
import { calcTodayEarnings, getDaysToWeekend, getDaysToRetirement, getMoyuLevel, formatMoney } from '../../utils/calculator'
import { UserSettings } from '../../utils/types'

let timer: ReturnType<typeof setInterval> | null = null
let animTimer: ReturnType<typeof setInterval> | null = null
let settings: UserSettings | null = null
let committedSeconds = 0

Page({
  data: {
    isSlacking: false,
    slackingSeconds: 0,
    progressPercent: 0,
    todayEarnings: '¥0.00',
    animatedTodayEarnings: '¥0.00',
    daysToWeekend: 0,
    daysToRetirement: 0,
    levelName: '深海巨鲨',
    displayAmount: 0,
    targetAmount: 0,
  },
  onShow() {
    const hasSalary = !!getSettings().monthlySalary
    if (!wx.getStorageSync('fishGuideSeen') || !hasSalary) {
      wx.reLaunch({ url: '/pages/onboarding/index' })
      return
    }
    this.setTab(0)
    settings = getSettings()
    const slackingSeconds = getTodaySlackingSeconds()
    committedSeconds = slackingSeconds
    const totalMoney = getMoyuStats().totalMoney
    this.setData({
      slackingSeconds,
      daysToWeekend: getDaysToWeekend(),
      daysToRetirement: getDaysToRetirement(settings.retirementDate),
      levelName: getMoyuLevel(totalMoney).name,
    })
    this.refresh()
    this.startAmountAnimation()
  },
  onHide() { this.pause() },
  onUnload() { this.pause(); if (animTimer) clearInterval(animTimer) },
  setTab(index: number) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: index })
      this.getTabBar().refreshState()
    }
  },
  refresh() {
    if (!settings) return
    const targetAmount = calcTodayEarnings(settings, this.data.slackingSeconds)
    this.setData({
      todayEarnings: formatMoney(targetAmount),
      targetAmount,
      progressPercent: Math.min(100, Math.round((this.data.slackingSeconds % 3600) / 36)),
    })
  },
  startAmountAnimation() {
    if (animTimer) return
    animTimer = setInterval(() => {
      const next = this.data.displayAmount + (this.data.targetAmount - this.data.displayAmount) * 0.35
      this.setData({ displayAmount: next, animatedTodayEarnings: formatMoney(next) })
    }, 50)
  },
  pause() {
    if (timer) {
      clearInterval(timer)
      timer = null
      const cur = this.data.slackingSeconds
      saveTodaySlackingSeconds(cur)
      if (settings && cur > committedSeconds) {
        const delta = cur - committedSeconds
        commitMoyuSession(delta, calcTodayEarnings(settings, delta))
        committedSeconds = cur
      }
    }
    wx.setStorageSync('fishIsSlacking', false)
    this.getTabBar()?.refreshState()
  },
  onToggleSlacking() {
    const nextState = !this.data.isSlacking
    this.setData({ isSlacking: nextState })
    wx.setStorageSync('fishIsSlacking', nextState)
    this.getTabBar()?.refreshState()
    if (nextState) {
      const base = this.data.slackingSeconds
      const start = Date.now()
      timer = setInterval(() => {
        this.setData({ slackingSeconds: base + (Date.now() - start) / 1000 })
        this.refresh()
      }, 100)
    } else {
      this.pause()
    }
  },
})
