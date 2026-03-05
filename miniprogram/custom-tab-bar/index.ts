Component({
  data: {
    selected: 0,
    isSlacking: false,
    list: [
      { pagePath: '/pages/index/index', text: '鱼额', iconPath: '/assets/images/tabbar/tab-money.png', selectedIconPath: '/assets/images/tabbar/tab-money-active.png' },
      { pagePath: '/pages/stats/index', text: '战报', iconPath: '/assets/images/tabbar/tab-chart.png', selectedIconPath: '/assets/images/tabbar/tab-chart-active.png' },
      { pagePath: '/pages/settings/index', text: 'Lab', iconPath: '/assets/images/tabbar/tab-lab.png', selectedIconPath: '/assets/images/tabbar/tab-lab-active.png' },
      { pagePath: '/pages/profile/index', text: '我的', iconPath: '/assets/images/tabbar/tab-profile.png', selectedIconPath: '/assets/images/tabbar/tab-profile-active.png' },
    ],
  },
  methods: {
    switchTab(e: WechatMiniprogram.BaseEvent) {
      const data = e.currentTarget.dataset as { path: string; index: number }
      wx.switchTab({ url: data.path })
      this.setData({ selected: data.index })
    },
    refreshState() {
      this.setData({ isSlacking: !!wx.getStorageSync('fishIsSlacking') })
    },
  },
  lifetimes: {
    attached() {
      this.setData({ isSlacking: !!wx.getStorageSync('fishIsSlacking') })
    },
  },
})
