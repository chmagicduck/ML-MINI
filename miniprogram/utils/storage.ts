// 本地存储工具函数
import { UserSettings, PoopStats, MoyuStats, DEFAULT_SETTINGS, DEFAULT_MOYU_STATS } from './types'

const KEYS = {
  SETTINGS: 'userSettings',
  POOP_STATS: 'poopStats',
  MOYU_STATS: 'moyuStats',
  SLACKING_PREFIX: 'slackingToday_',
  PENDING_LEVEL_UP: 'pendingLevelUp',
  LAST_EXIT_STATE: 'lastExitState',
}

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
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

export function saveTodaySlackingSeconds(seconds: number): void {
  const key = KEYS.SLACKING_PREFIX + todayKey()
  wx.setStorageSync(key, seconds)
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

/**
 * V2: 提交一次摸鱼会话，更新累计统计
 * 在每次暂停/停止时调用，增量写入防止重复计算
 * @param newSeconds 本次新增的摸鱼秒数（增量）
 * @param newMoney 本次新增的摸鱼收益（增量）
 */
export function commitMoyuSession(newSeconds: number, newMoney: number): void {
  if (newSeconds <= 0) return
  try {
    const stats = getMoyuStats()
    const today = todayKeyForMap()
    const daySeconds = (stats.moyuDaysMap[today] || 0) + newSeconds
    const updated: MoyuStats = {
      totalMoney: stats.totalMoney + newMoney,
      totalSeconds: stats.totalSeconds + newSeconds,
      moyuDaysMap: {
        ...stats.moyuDaysMap,
        [today]: daySeconds,
      },
    }
    // 热力图数据只保留最近 365 天，避免无限增长
    updated.moyuDaysMap = trimOldDays(updated.moyuDaysMap, 365)
    saveMoyuStats(updated)
  } catch (_) {}
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
