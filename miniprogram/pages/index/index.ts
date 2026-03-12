// pages/index/index.ts — 鱼额宝首页
import {
  getSettings,
  getTodaySlackingSeconds,
  saveTodaySlackingSeconds,
  commitMoyuSession,
  commitMoyuSessionForDay,
  getMoyuStats,
  setPendingLevelUp,
  getPendingLevelUp,
  clearPendingLevelUp,
  getLastExitState,
  clearLastExitState,
  hasShownInitialIdentity,
  setInitialIdentityShown,
  isOnboardingDone,
} from '../../utils/storage'
import {
  getSecondSalary,
  calcTodayEarnings,
  calcTodayWorkedEarnings,
  calcTodayWorkedSeconds,
  calcWorkedSecondsBetween,
  calcMonthEarnings,
  getDailyWorkMinutes,
  getDaysToPayday,
  getDaysToWeekend,
  getWorkingDaysInMonth,
  getMoyuLevel,
  isWorkingNow,
  formatMoney,
  formatDuration,
} from '../../utils/calculator'
import { getTodayStatusText, getTodayStatus } from '../../utils/holiday'
import { UserSettings, MoyuLevel } from '../../utils/types'

const SLOGANS = [
  '只要我不努力，老板就永远过不上想要的生活',
  '摸鱼一时爽，一直摸鱼一直爽',
  '打工人，打工魂，打工都是人上人',
  '躺平不是态度，是艺术',
  '上班如上坟，摸鱼保平安',
  '钱是打工人的，鱼是摸鱼人的',
  '今天摸了，明天继续摸',
]

// ── 模块级状态（Page 单例安全）────────────────────────────────
let _timer: ReturnType<typeof setInterval> | null = null
let _settings: UserSettings | null = null

// 累计收益缓存，避免 timer tick 频繁读 Storage
let _baseTotalMoney = 0
// 上次 commit 时的摸鱼秒数，用于增量计算
let _lastCommitSeconds = 0
// 当前计时轮次的基准秒和起始时间（用于生成事件时间段）
let _timerBaseSeconds = 0
let _timerStartAt = 0
// 已知的最高等级门槛；-1 表示未初始化（防止启动时误弹）
let _lastLevelThreshold = -1
// 升级弹窗是否正在展示（防止连续弹出）
let _levelUpShowing = false
// 始终运行的时钟 timer，负责入账工资/本月已赚/进度环
let _clockTimer: ReturnType<typeof setInterval> | null = null
const STORAGE_SYNC_INTERVAL_MS = 1000
const AUTO_COMMIT_INTERVAL_SECONDS = 1

function dayKeyByTimestamp(ts: number = Date.now()): string {
  const now = new Date(ts)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

function dayStartTimestampByKey(dayKey: string): number {
  const parts = dayKey.split('-')
  const y = Number(parts[0]) || 0
  const m = Number(parts[1]) || 1
  const d = Number(parts[2]) || 1
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

Page({
  data: {
    statusBarHeight: 0,
    progressStyle: 'background: conic-gradient(#3B82F6 0%, #E2E8F0 0%)',

    // 摸鱼计时
    isSlacking: false,
    slackingSeconds: 0,
    slackingTimeStr: '00:00:00',

    // 卡片数据
    todayEarnings: '¥0.0000',
    todayWorkedEarnings: '¥0.0000',
    monthEarnings: '¥0.0000',
    secondSalary: '¥0.0000/秒',
    daysToPayday: 0,
    daysToWeekend: 0,
    workDaysInMonth: 0,

    // 等级
    levelName: '职场牛马',
    levelEmoji: '🐂',
    levelColor: '#9E9E9E',
    isGoldLevel: false,
    totalMoney: '¥0.0000',

    // 节假日
    holidayText: '',
    isHolidayOrWeekend: false,

    // 计算说明
    showCalcExplain: false,
    secondSalaryValue: '0.0000',

    // 工时与进度
    todayWorkedTimeStr: '00:00:00',
    fishRatioStr: '0.0%',
    offWorkPercent: 0,

    hasSettings: false,
    slogan: SLOGANS[0],
  },

  onLoad() {
    // 首次使用：跳转引导页
    if (!isOnboardingDone()) {
      wx.reLaunch({ url: '/pages/onboarding/index' })
      return
    }

    let statusBarHeight = 20
    try {
      const windowInfo = (wx as any).getWindowInfo?.()
      if (windowInfo) {
        statusBarHeight = windowInfo.statusBarHeight
      }
    } catch (_) {
      const sysInfo = wx.getSystemInfoSync()
      statusBarHeight = sysInfo.statusBarHeight
    }

    const slogan = SLOGANS[Math.floor(Math.random() * SLOGANS.length)]
    this.setData({ statusBarHeight, slogan })
  },

  onShow() {
    _levelUpShowing = false

    _settings = getSettings()
    const hasSettings = _settings.monthlySalary > 0
    const slackingSeconds = getTodaySlackingSeconds()

    // 启动自愈：补齐"今日未提交秒数"
    let moyuStats = getMoyuStats()
    const todayKey = dayKeyByTimestamp()
    const committedTodaySecs = moyuStats.moyuDaysMap[todayKey] || 0
    const uncommittedTodaySecs = Math.max(0, slackingSeconds - committedTodaySecs)
    if (_settings && uncommittedTodaySecs > 0.001) {
      const uncommittedMoney = uncommittedTodaySecs * getSecondSalary(_settings)
      const committed = commitMoyuSessionForDay(todayKey, uncommittedTodaySecs, uncommittedMoney, {
        source: 'repair',
        note: 'startup-self-heal',
      })
      if (committed) {
        moyuStats = getMoyuStats()
      }
    }

    _lastCommitSeconds = slackingSeconds

    // 节假日
    const holidayText = getTodayStatusText()
    const dayStatus = getTodayStatus()
    const isHolidayOrWeekend = dayStatus === 'holiday' || dayStatus === 'weekend'

    // 等级 & 累计
    _baseTotalMoney = moyuStats.totalMoney
    const level = getMoyuLevel(_baseTotalMoney)
    _lastLevelThreshold = level.threshold

    // 本月工作日数
    const now = new Date()
    const workDaysInMonth = getWorkingDaysInMonth(
      now.getFullYear(), now.getMonth(), _settings.workdayMode
    )

    const secondSalaryValue = getSecondSalary(_settings).toFixed(4)

    this.setData({
      hasSettings,
      slackingSeconds,
      holidayText,
      isHolidayOrWeekend,
      levelName: level.name,
      levelEmoji: level.emoji,
      levelColor: level.color,
      isGoldLevel: level.isGold,
      totalMoney: formatMoney(_baseTotalMoney),
      workDaysInMonth,
      secondSalaryValue,
      secondSalary: `¥${secondSalaryValue}/秒`,
    })

    this._refresh()
    this._updateStaticCards()
    this._updateTimeUntilOffWork()
    this._startClock()

    // 检查持久化的升级通知
    const pendingLevel = getPendingLevelUp()
    if (pendingLevel && !_levelUpShowing) {
      clearPendingLevelUp()
      setTimeout(() => this._showLevelUpModal(pendingLevel as MoyuLevel), 600)
    }

    // 离线收益弹窗
    if (!this.data.isSlacking && _settings) {
      this._checkOfflineEarnings()
    }

    // 二级页返回时若计时仍开启，重启 timer
    if (this.data.isSlacking && _timer === null) {
      this._startTimer()
    }
  },

  onHide() {
    this._stopClock()
  },

  onUnload() {
    if (this.data.isSlacking) {
      saveTodaySlackingSeconds(this.data.slackingSeconds)
    }
    this._stopClock()
    this._pause()
  },

  // ─────────── 离线收益弹窗 ──────────────────────────────
  _checkOfflineEarnings() {
    if (!_settings) return
    const exitState = getLastExitState()
    clearLastExitState()
    if (!exitState) return

    const nowMs = Date.now()
    const elapsed = nowMs - exitState.ts
    const hourMs = 3600000
    if (elapsed < hourMs) return

    const earnedSecs = calcWorkedSecondsBetween(_settings, exitState.ts, nowMs)
    if (earnedSecs <= 0.001) return

    const offlineEarnings = earnedSecs * getSecondSalary(_settings)
    setTimeout(() => {
      wx.showModal({
        title: '🐟 你不在的时候...',
        content: `鱼额宝偷偷帮你从老板兜里掏走了\n${formatMoney(offlineEarnings)}\n\n打卡上班，继续薅！`,
        confirmText: '收下！',
        showCancel: false,
      })
    }, 800)
  },

  // ─────────── 进度条和工时显示 ─────────────────────────────
  _updateProgress() {
    if (!_settings) return

    const workedSecs = calcTodayWorkedSeconds(_settings)
    const totalWorkSeconds = Math.max(1, getDailyWorkMinutes(_settings) * 60)
    const slackingSecs = this.data.slackingSeconds

    // 下班进度百分比
    const offWorkPercent = Math.min(100, Math.round((workedSecs / totalWorkSeconds) * 100))

    // 摸鱼率
    const fishRatio = workedSecs > 0 ? slackingSecs / workedSecs : 0
    const fishRatioStr = `${(fishRatio * 100).toFixed(1)}%`

    // 鱼缸计时器用的进度样式：摸鱼部分用蓝色环
    const fishVisualDegree = ((slackingSecs % 3600) / 3600) * 360
    const style = `background: conic-gradient(#3B82F6 ${fishVisualDegree}deg, #E2E8F0 ${fishVisualDegree}deg 260deg, #F1F5F9 260deg)`

    this.setData({
      progressStyle: style,
      todayWorkedTimeStr: formatDuration(workedSecs),
      fishRatioStr,
      offWorkPercent,
    })
  },

  // ─────────── 下班倒计时 ─────────────────────────────
  _updateTimeUntilOffWork() {
    if (!_settings) return
    const parts = _settings.workEndTime.split(':')
    const eh = Number(parts[0]) || 0
    const em = Number(parts[1]) || 0
    const now = new Date()
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0, 0)
    const remaining = endOfDay.getTime() - now.getTime()

    if (remaining <= 0) {
      this.setData({ offWorkPercent: 100 })
    }
  },

  // ─────────── 刷新 ────────────────────────────
  _refresh() {
    if (!_settings) return
    const s = _settings
    const secs = this.data.slackingSeconds
    this.setData({
      todayEarnings: formatMoney(calcTodayEarnings(s, secs)),
      todayWorkedEarnings: formatMoney(calcTodayWorkedEarnings(s)),
      monthEarnings: formatMoney(calcMonthEarnings(s)),
      slackingTimeStr: formatDuration(secs),
    })
    this._updateProgress()
  },

  // ─────────── 静态倒计时卡片 ──────────────────────────────
  _updateStaticCards() {
    if (!_settings) return
    this.setData({
      daysToPayday: getDaysToPayday(_settings.payDay),
      daysToWeekend: getDaysToWeekend(),
    })
  },

  // ─────────── 等级升级弹窗 ─────────────────────────────────
  _checkLevelUp(currentTotalMoney: number) {
    const newLevel = getMoyuLevel(currentTotalMoney)

    if (newLevel.threshold > _lastLevelThreshold) {
      _lastLevelThreshold = newLevel.threshold
      this.setData({
        levelName: newLevel.name,
        levelEmoji: newLevel.emoji,
        levelColor: newLevel.color,
        isGoldLevel: newLevel.isGold,
      })
      setPendingLevelUp(newLevel)
      this._showLevelUpModal(newLevel)
    }
  },

  _showLevelUpModal(level: MoyuLevel) {
    if (_levelUpShowing) return
    _levelUpShowing = true
    wx.showModal({
      title: '🎉 等级提升！',
      content: `${level.emoji} ${level.name} 解锁！\n\n你的累计摸鱼收益突破了新门槛，\n继续摸，继续进化！`,
      confirmText: '知道了',
      showCancel: false,
      success: () => {
        _levelUpShowing = false
        clearPendingLevelUp()
      },
      fail: () => { _levelUpShowing = false },
    })
  },

  // ─────────── 始终运行的时钟 ──────
  _startClock() {
    if (_clockTimer !== null) return
    _clockTimer = setInterval(() => {
      if (!_settings) return

      this.setData({
        todayWorkedEarnings: formatMoney(calcTodayWorkedEarnings(_settings)),
        monthEarnings: formatMoney(calcMonthEarnings(_settings)),
      })
      this._updateProgress()
      this._updateTimeUntilOffWork()
    }, 1000)
  },

  _stopClock() {
    if (_clockTimer !== null) {
      clearInterval(_clockTimer)
      _clockTimer = null
    }
  },

  // ─────────── 摸鱼计时器（100ms）──────────────
  _startTimer() {
    if (_timer !== null) return

    let baseSeconds = this.data.slackingSeconds
    let startAt = Date.now()
    let activeDayKey = dayKeyByTimestamp(startAt)
    let lastStorageSyncAt = 0

    _timerBaseSeconds = baseSeconds
    _timerStartAt = startAt

    const commitDelta = (seconds: number, dayKey: string) => {
      if (!_settings) return
      const deltaSeconds = seconds - _lastCommitSeconds
      if (deltaSeconds <= 0.001) return

      const startOffsetSeconds = Math.max(0, _lastCommitSeconds - baseSeconds)
      const endOffsetSeconds = Math.max(0, seconds - baseSeconds)
      const eventStartAt = startAt + startOffsetSeconds * 1000
      const eventEndAt = Math.max(eventStartAt, startAt + endOffsetSeconds * 1000)

      const deltaMoney = deltaSeconds * getSecondSalary(_settings)
      const committed = commitMoyuSessionForDay(dayKey, deltaSeconds, deltaMoney, {
        startAt: eventStartAt,
        endAt: eventEndAt,
        source: 'index_timer',
      })
      if (committed) {
        _baseTotalMoney += deltaMoney
        _lastCommitSeconds = seconds
      }
    }

    _timer = setInterval(() => {
      if (!_settings) return
      const nowMs = Date.now()
      const currentDayKey = dayKeyByTimestamp(nowMs)

      // 跨天处理
      if (currentDayKey !== activeDayKey) {
        const boundaryMs = dayStartTimestampByKey(currentDayKey)
        const closingSeconds = baseSeconds + Math.max(0, boundaryMs - startAt) / 1000
        commitDelta(closingSeconds, activeDayKey)

        baseSeconds = 0
        startAt = boundaryMs
        activeDayKey = currentDayKey
        _lastCommitSeconds = 0
        _timerBaseSeconds = baseSeconds
        _timerStartAt = startAt

        saveTodaySlackingSeconds(0)
        this.setData({
          slackingSeconds: 0,
          slackingTimeStr: '00:00:00',
          todayWorkedTimeStr: '00:00:00',
        })
        this._updateStaticCards()
      }

      const seconds = baseSeconds + (nowMs - startAt) / 1000

      // 同步写频率控制
      if (nowMs - lastStorageSyncAt >= STORAGE_SYNC_INTERVAL_MS) {
        saveTodaySlackingSeconds(seconds)
        lastStorageSyncAt = nowMs
      }

      // 增量提交
      if (seconds - _lastCommitSeconds >= AUTO_COMMIT_INTERVAL_SECONDS) {
        commitDelta(seconds, activeDayKey)
      }

      // 工作时段结束自动停表
      if (!isWorkingNow(_settings)) {
        saveTodaySlackingSeconds(seconds)
        this.setData({
          slackingSeconds: seconds,
          slackingTimeStr: formatDuration(seconds),
          isSlacking: false,
        })
        this._pause()
        wx.showToast({ title: '已超出工作时段，自动暂停摸鱼', icon: 'none', duration: 1800 })
        return
      }

      // 今日摸鱼收入
      const todayEarnings = formatMoney(calcTodayEarnings(_settings, seconds))

      // 实时累计
      const liveDelta = Math.max(0, seconds - _lastCommitSeconds)
      const liveMoney = liveDelta * getSecondSalary(_settings)
      const currentTotalMoney = _baseTotalMoney + liveMoney

      this.setData({
        slackingSeconds: seconds,
        slackingTimeStr: formatDuration(seconds),
        todayEarnings,
        totalMoney: formatMoney(currentTotalMoney),
      })

      // 等级升级检测
      this._checkLevelUp(currentTotalMoney)
    }, 100)
  },

  // ─────────── 暂停计时器 ──────────────────────────────────
  _pause() {
    if (_timer !== null) {
      clearInterval(_timer)
      _timer = null
      const currentSeconds = this.data.slackingSeconds
      saveTodaySlackingSeconds(currentSeconds)
      if (_settings && currentSeconds > _lastCommitSeconds) {
        const deltaSeconds = currentSeconds - _lastCommitSeconds
        const deltaMoney = deltaSeconds * getSecondSalary(_settings)

        const startOffsetSeconds = Math.max(0, _lastCommitSeconds - _timerBaseSeconds)
        const endOffsetSeconds = Math.max(0, currentSeconds - _timerBaseSeconds)
        const eventStartAt = _timerStartAt + startOffsetSeconds * 1000
        const eventEndAt = Math.max(eventStartAt, _timerStartAt + endOffsetSeconds * 1000)

        const committed = commitMoyuSession(deltaSeconds, deltaMoney, {
          startAt: eventStartAt,
          endAt: eventEndAt,
          source: 'index_timer',
        })
        if (committed) {
          _baseTotalMoney += deltaMoney
          _lastCommitSeconds = currentSeconds
        }
      }
      _timerBaseSeconds = 0
      _timerStartAt = 0
    }
  },

  // ─────────── 切换摸鱼模式 ────────────────────────────────
  onToggleSlacking() {
    if (!this.data.isSlacking && _settings && !isWorkingNow(_settings)) {
      wx.showToast({ title: '工作时间外无法开启摸鱼 🐟', icon: 'none', duration: 2000 })
      return
    }

    const isSlacking = !this.data.isSlacking
    this.setData({ isSlacking })
    if (isSlacking) {
      if (!hasShownInitialIdentity()) {
        const initialLevel = getMoyuLevel(0)
        setInitialIdentityShown()
        wx.showModal({
          title: '🎉 获得初始身份',
          content: `${initialLevel.emoji} ${initialLevel.name}\n\n${initialLevel.text}`,
          confirmText: '开始摸鱼',
          showCancel: false,
          success: () => {
            this._startTimer()
          }
        })
      } else {
        this._startTimer()
      }
    } else {
      this._pause()
    }
  },

  // ─────────── 计算说明折叠 ────────────────────────────────
  onToggleCalcExplain() {
    this.setData({ showCalcExplain: !this.data.showCalcExplain })
  },

  // ─────────── 导航 ────────────────────────────────────────
  onGoToCalendar() { wx.navigateTo({ url: '/pages/calendar/index' }) },
})
