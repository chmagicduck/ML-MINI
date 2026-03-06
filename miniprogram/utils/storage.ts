// 本地存储工具函数
import {
  UserSettings,
  PoopStats,
  MoyuStats,
  DEFAULT_SETTINGS,
  DEFAULT_MOYU_STATS,
  PoopRunningState,
} from './types'

const KEYS = {
  SETTINGS: 'userSettings',
  POOP_STATS: 'poopStats',
  MOYU_STATS: 'moyuStats',
  SLACKING_PREFIX: 'slackingToday_',
  PENDING_LEVEL_UP: 'pendingLevelUp',
  LAST_EXIT_STATE: 'lastExitState',
  INITIAL_IDENTITY_SHOWN: 'initialIdentityShown',  // V1.0.1: 是否已显示初始身份提示
}

function todayKey(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

export function getSettings(): UserSettings {
  try {
    const stored = wx.getStorageSync(KEYS.SETTINGS)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...stored }
    }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: UserSettings): void {
  wx.setStorageSync(KEYS.SETTINGS, settings)
}

export function getPoopStats(): PoopStats {
  try {
    const stored = wx.getStorageSync(KEYS.POOP_STATS)
    if (stored) return stored
  } catch (_) {}
  return { totalSeconds: 0, totalEarnings: 0, sessions: [] }
}

export function savePoopStats(stats: PoopStats): void {
  try {
    wx.setStorageSync(KEYS.POOP_STATS, stats)
  } catch (_) {
    // 存储已满时静默失败，不影响主流程
  }
}

export function getTodaySlackingSeconds(): number {
  try {
    const key = KEYS.SLACKING_PREFIX + todayKey()
    return wx.getStorageSync(key) || 0
  } catch (_) {
    return 0
  }
}

export function saveTodaySlackingSeconds(seconds: number): boolean {
  const key = KEYS.SLACKING_PREFIX + todayKey()
  try {
    wx.setStorageSync(key, seconds)
    return true
  } catch (_) {
    return false
  }
}

/** V2: 读取累计摸鱼统计 */
export function getMoyuStats(): MoyuStats {
  try {
    const stored = wx.getStorageSync(KEYS.MOYU_STATS)
    if (stored) {
      return { ...DEFAULT_MOYU_STATS, ...stored }
    }
  } catch (_) {}
  return { ...DEFAULT_MOYU_STATS }
}

/** V2: 保存累计摸鱼统计 */
export function saveMoyuStats(stats: MoyuStats): void {
  try {
    wx.setStorageSync(KEYS.MOYU_STATS, stats)
  } catch (_) {}
}

function isValidDayKey(dayKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey)
}

function commitMoyuSessionByDay(dayKey: string, newSeconds: number, newMoney: number): boolean {
  if (newSeconds <= 0 || !isFinite(newSeconds) || !isValidDayKey(dayKey)) return false
  try {
    const stats = getMoyuStats()
    const safeMoney = isFinite(newMoney) ? Math.max(0, newMoney) : 0
    const safeDaysMap = stats.moyuDaysMap && typeof stats.moyuDaysMap === 'object'
      ? stats.moyuDaysMap
      : {}
    const daySeconds = (safeDaysMap[dayKey] || 0) + newSeconds

    const updated: MoyuStats = {
      totalMoney: stats.totalMoney + safeMoney,
      totalSeconds: stats.totalSeconds + newSeconds,
      moyuDaysMap: {
        ...safeDaysMap,
        [dayKey]: daySeconds,
      },
    }
    // 热力图数据只保留最近 365 天，避免无限增长
    updated.moyuDaysMap = trimOldDays(updated.moyuDaysMap, 365)
    saveMoyuStats(updated)
    return true
  } catch (_) {
    return false
  }
}

/**
 * V2: 提交一次摸鱼会话，更新累计统计
 * 在每次暂停/停止时调用，增量写入防止重复计算
 * @param newSeconds 本次新增的摸鱼秒数（增量）
 * @param newMoney 本次新增的摸鱼收益（增量）
 */
export function commitMoyuSession(newSeconds: number, newMoney: number): boolean {
  return commitMoyuSessionByDay(todayKeyForMap(), newSeconds, newMoney)
}

/** V2.4: 指定日期提交摸鱼会话（用于跨天归档/补偿） */
export function commitMoyuSessionForDay(dayKey: string, newSeconds: number, newMoney: number): boolean {
  return commitMoyuSessionByDay(dayKey, newSeconds, newMoney)
}

function todayKeyForMap(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

function trimOldDays(map: Record<string, number>, keepDays: number): Record<string, number> {
  const keys = Object.keys(map).sort()
  if (keys.length <= keepDays) return map
  const trimmed: Record<string, number> = {}
  const keep = keys.slice(-keepDays)
  for (const k of keep) {
    trimmed[k] = map[k]
  }
  return trimmed
}

// ─────────── V2.2: 升级提示持久化 ────────────────────────────

interface PendingLevel {
  name: string
  emoji: string
  color: string
  isGold: boolean
  threshold: number
}

export function setPendingLevelUp(level: PendingLevel): void {
  try { wx.setStorageSync(KEYS.PENDING_LEVEL_UP, level) } catch (_) {}
}

export function getPendingLevelUp(): PendingLevel | null {
  try { return wx.getStorageSync(KEYS.PENDING_LEVEL_UP) || null } catch (_) { return null }
}

export function clearPendingLevelUp(): void {
  try { wx.removeStorageSync(KEYS.PENDING_LEVEL_UP) } catch (_) {}
}

// ─────────── V2.2: 离线收益弹窗状态 ─────────────────────────

interface ExitState {
  ts: number        // 退出时刻 timestamp
  workedSecs: number  // 退出时已上班秒数
}

export function saveLastExitState(workedSecs: number): void {
  try { wx.setStorageSync(KEYS.LAST_EXIT_STATE, { ts: Date.now(), workedSecs }) } catch (_) {}
}

export function getLastExitState(): ExitState | null {
  try { return wx.getStorageSync(KEYS.LAST_EXIT_STATE) || null } catch (_) { return null }
}

export function clearLastExitState(): void {
  try { wx.removeStorageSync(KEYS.LAST_EXIT_STATE) } catch (_) {}
}

// ─────────── V1.0.1: 拉粑粑计时器运行状态 ────────────────────

const POOP_RUNNING_STATE_KEY = 'poopRunningState'

export function savePoopRunningState(state: PoopRunningState): void {
  try { wx.setStorageSync(POOP_RUNNING_STATE_KEY, state) } catch (_) {}
}

export function getPoopRunningState(): PoopRunningState | null {
  try { return wx.getStorageSync(POOP_RUNNING_STATE_KEY) || null } catch (_) { return null }
}

export function clearPoopRunningState(): void {
  try { wx.removeStorageSync(POOP_RUNNING_STATE_KEY) } catch (_) {}
}

// ─────────── 烧钱会议室计时器运行状态 ────────────────────────

interface MeetingRunningState {
  isRunning: boolean
  elapsedSeconds: number
  savedAt: number
  participants?: number
  useCustomSalary?: boolean
  customSalaryNum?: number
}

const MEETING_RUNNING_STATE_KEY = 'meetingRunningState'

export function saveMeetingRunningState(state: MeetingRunningState): void {
  try { wx.setStorageSync(MEETING_RUNNING_STATE_KEY, state) } catch (_) {}
}

export function getMeetingRunningState(): MeetingRunningState | null {
  try { return wx.getStorageSync(MEETING_RUNNING_STATE_KEY) || null } catch (_) { return null }
}

export function clearMeetingRunningState(): void {
  try { wx.removeStorageSync(MEETING_RUNNING_STATE_KEY) } catch (_) {}
}

// ─────────── V1.0.1: 初始身份提示 ────────────────────────────────

export function hasShownInitialIdentity(): boolean {
  try { return wx.getStorageSync(KEYS.INITIAL_IDENTITY_SHOWN) === true } catch (_) { return false }
}

export function setInitialIdentityShown(): void {
  try { wx.setStorageSync(KEYS.INITIAL_IDENTITY_SHOWN, true) } catch (_) {}
}

// ─────────── V1.0.1: 皮肤系统 ────────────────────────────────

export function getCurrentSkin(): string {
  try { return wx.getStorageSync('currentSkin') || 'default' } catch (_) { return 'default' }
}

export function setCurrentSkin(skinId: string): void {
  try { wx.setStorageSync('currentSkin', skinId) } catch (_) {}
}
