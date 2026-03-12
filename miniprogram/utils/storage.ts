// 本地存储工具函数
import {
  UserSettings,
  PoopStats,
  MoyuStats,
  DEFAULT_SETTINGS,
  DEFAULT_MOYU_STATS,
  PoopRunningState,
  MoyuEvent,
  MoyuEventSource,
} from './types'

const KEYS = {
  SETTINGS: 'userSettings',
  POOP_STATS: 'poopStats',
  MOYU_STATS: 'moyuStats',
  SLACKING_PREFIX: 'slackingToday_',
  PENDING_LEVEL_UP: 'pendingLevelUp',
  LAST_EXIT_STATE: 'lastExitState',
  INITIAL_IDENTITY_SHOWN: 'initialIdentityShown',
  ONBOARDING_DONE: 'onboardingDone',
  USER_AVATAR: 'userAvatar',
  USER_NICKNAME: 'userNickname',
}

function todayKey(): string {
  return dayKeyByTimestamp(Date.now())
}

function dayKeyByTimestamp(ts: number): string {
  const now = new Date(ts)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const n = Number(value)
  return isFinite(n) ? n : fallback
}

function isValidDayKey(dayKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey)
}

function genEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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

function normalizeSource(raw: unknown): MoyuEventSource {
  if (raw === 'index_timer' || raw === 'manual_edit' || raw === 'repair') {
    return raw
  }
  return 'repair'
}

function sanitizeEvent(raw: unknown): MoyuEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<MoyuEvent>

  const seconds = Math.max(0, toFiniteNumber(item.seconds, 0))
  const money = Math.max(0, toFiniteNumber(item.money, 0))
  if (seconds <= 0.0001) return null

  const startAt = toFiniteNumber(item.startAt, Date.now())
  const endAtRaw = toFiniteNumber(item.endAt, startAt)
  const endAt = Math.max(startAt, endAtRaw)

  const dayKey = typeof item.dayKey === 'string' && isValidDayKey(item.dayKey)
    ? item.dayKey
    : dayKeyByTimestamp(startAt)

  const createdAt = toFiniteNumber(item.createdAt, startAt)
  const updatedAt = toFiniteNumber(item.updatedAt, endAt)
  const id = typeof item.id === 'string' && item.id ? item.id : genEventId()
  const source = normalizeSource(item.source)

  const event: MoyuEvent = {
    id,
    dayKey,
    startAt,
    endAt,
    seconds,
    money,
    source,
    createdAt,
    updatedAt,
  }

  if (typeof item.note === 'string' && item.note.trim()) {
    event.note = item.note.trim()
  }
  if (typeof item.deletedAt === 'number' && isFinite(item.deletedAt)) {
    event.deletedAt = item.deletedAt
  }
  return event
}

function buildAggregatesFromEvents(events: MoyuEvent[]): Pick<MoyuStats, 'totalMoney' | 'totalSeconds' | 'moyuDaysMap'> {
  let totalMoney = 0
  let totalSeconds = 0
  const moyuDaysMap: Record<string, number> = {}

  for (const event of events) {
    if (event.deletedAt) continue
    if (!isValidDayKey(event.dayKey)) continue

    const safeSeconds = Math.max(0, toFiniteNumber(event.seconds, 0))
    const safeMoney = Math.max(0, toFiniteNumber(event.money, 0))
    if (safeSeconds <= 0.0001) continue

    totalSeconds += safeSeconds
    totalMoney += safeMoney
    moyuDaysMap[event.dayKey] = (moyuDaysMap[event.dayKey] || 0) + safeSeconds
  }

  return {
    totalMoney,
    totalSeconds,
    moyuDaysMap: trimOldDays(moyuDaysMap, 365),
  }
}

function normalizeMoyuStats(raw: unknown): { stats: MoyuStats; changed: boolean } {
  if (!raw || typeof raw !== 'object') {
    return { stats: { ...DEFAULT_MOYU_STATS }, changed: false }
  }

  const payload = raw as Partial<MoyuStats>
  if (!Array.isArray(payload.events)) {
    return { stats: { ...DEFAULT_MOYU_STATS }, changed: true }
  }

  const sanitizedEvents = payload.events
    .map((event) => sanitizeEvent(event))
    .filter((event): event is MoyuEvent => event !== null)

  const aggregates = buildAggregatesFromEvents(sanitizedEvents)
  const stats: MoyuStats = {
    events: sanitizedEvents,
    totalMoney: aggregates.totalMoney,
    totalSeconds: aggregates.totalSeconds,
    moyuDaysMap: aggregates.moyuDaysMap,
  }

  const changed = sanitizedEvents.length !== payload.events.length
    || Math.abs(toFiniteNumber(payload.totalMoney, 0) - stats.totalMoney) > 0.0001
    || Math.abs(toFiniteNumber(payload.totalSeconds, 0) - stats.totalSeconds) > 0.0001
    || JSON.stringify(payload.moyuDaysMap || {}) !== JSON.stringify(stats.moyuDaysMap)

  return { stats, changed }
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

/** 读取累计摸鱼统计 */
export function getMoyuStats(): MoyuStats {
  try {
    const stored = wx.getStorageSync(KEYS.MOYU_STATS)
    const normalized = normalizeMoyuStats(stored)
    if (normalized.changed) {
      saveMoyuStats(normalized.stats)
    }
    return normalized.stats
  } catch (_) {}
  return { ...DEFAULT_MOYU_STATS }
}

/** 保存累计摸鱼统计 */
export function saveMoyuStats(stats: MoyuStats): void {
  try {
    wx.setStorageSync(KEYS.MOYU_STATS, stats)
  } catch (_) {}
}

export interface MoyuCommitMeta {
  startAt?: number
  endAt?: number
  source?: MoyuEventSource
  note?: string
}

function canMergeEvent(last: MoyuEvent | undefined, incoming: MoyuEvent): boolean {
  if (!last) return false
  if (last.deletedAt) return false
  if (last.dayKey !== incoming.dayKey) return false
  if (last.source !== incoming.source) return false
  if ((last.note || '') !== (incoming.note || '')) return false
  const gapMs = incoming.startAt - last.endAt
  return gapMs >= 0 && gapMs <= 1500
}

function commitMoyuSessionByDay(
  dayKey: string,
  newSeconds: number,
  newMoney: number,
  meta?: MoyuCommitMeta,
): boolean {
  if (newSeconds <= 0 || !isFinite(newSeconds) || !isValidDayKey(dayKey)) return false
  try {
    const stats = getMoyuStats()
    const safeMoney = isFinite(newMoney) ? Math.max(0, newMoney) : 0

    const now = Date.now()
    const startRaw = toFiniteNumber(meta?.startAt, now - newSeconds * 1000)
    const endRaw = toFiniteNumber(meta?.endAt, now)
    const startAt = Math.min(startRaw, endRaw)
    const endAt = Math.max(startRaw, endRaw)

    const event: MoyuEvent = {
      id: genEventId(),
      dayKey,
      startAt,
      endAt,
      seconds: newSeconds,
      money: safeMoney,
      source: meta?.source ?? 'index_timer',
      createdAt: now,
      updatedAt: now,
    }
    if (meta?.note && meta.note.trim()) {
      event.note = meta.note.trim()
    }

    const events = [...stats.events]
    const last = events.length > 0 ? events[events.length - 1] : undefined
    if (canMergeEvent(last, event) && last) {
      last.endAt = Math.max(last.endAt, event.endAt)
      last.seconds += event.seconds
      last.money += event.money
      last.updatedAt = now
    } else {
      events.push(event)
    }

    const daySeconds = (stats.moyuDaysMap[dayKey] || 0) + newSeconds
    const updated: MoyuStats = {
      totalMoney: stats.totalMoney + safeMoney,
      totalSeconds: stats.totalSeconds + newSeconds,
      moyuDaysMap: trimOldDays({
        ...stats.moyuDaysMap,
        [dayKey]: daySeconds,
      }, 365),
      events,
    }

    saveMoyuStats(updated)
    return true
  } catch (_) {
    return false
  }
}

/** 读取摸鱼事件行（用于报表/后续手动编辑） */
export function getMoyuEvents(): MoyuEvent[] {
  return getMoyuStats().events.filter(event => !event.deletedAt)
}

/**
 * 提交一次摸鱼会话，更新累计统计
 * @param newSeconds 本次新增的摸鱼秒数（增量）
 * @param newMoney 本次新增的摸鱼收益（增量，按当时薪资快照）
 */
export function commitMoyuSession(newSeconds: number, newMoney: number, meta?: MoyuCommitMeta): boolean {
  return commitMoyuSessionByDay(todayKey(), newSeconds, newMoney, meta)
}

/** 指定日期提交摸鱼会话（用于跨天归档/补偿） */
export function commitMoyuSessionForDay(
  dayKey: string,
  newSeconds: number,
  newMoney: number,
  meta?: MoyuCommitMeta,
): boolean {
  return commitMoyuSessionByDay(dayKey, newSeconds, newMoney, meta)
}

// ─────────── 升级提示持久化 ────────────────────────────

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

// ─────────── 离线收益弹窗状态 ─────────────────────────

interface ExitState {
  ts: number        // 退出时刻 timestamp
}

export function saveLastExitState(): void {
  try { wx.setStorageSync(KEYS.LAST_EXIT_STATE, { ts: Date.now() }) } catch (_) {}
}

export function getLastExitState(): ExitState | null {
  try {
    const value = wx.getStorageSync(KEYS.LAST_EXIT_STATE)
    if (!value) return null
    const ts = toFiniteNumber((value as { ts?: number }).ts, 0)
    return ts > 0 ? { ts } : null
  } catch (_) {
    return null
  }
}

export function clearLastExitState(): void {
  try { wx.removeStorageSync(KEYS.LAST_EXIT_STATE) } catch (_) {}
}

// ─────────── 拉粑粑计时器运行状态 ────────────────────

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

// ─────────── 初始身份提示 ────────────────────────────────

export function hasShownInitialIdentity(): boolean {
  try { return wx.getStorageSync(KEYS.INITIAL_IDENTITY_SHOWN) === true } catch (_) { return false }
}

export function setInitialIdentityShown(): void {
  try { wx.setStorageSync(KEYS.INITIAL_IDENTITY_SHOWN, true) } catch (_) {}
}

// ─────────── 引导页状态 ────────────────────────────────────

export function isOnboardingDone(): boolean {
  try { return wx.getStorageSync(KEYS.ONBOARDING_DONE) === true } catch (_) { return false }
}

export function setOnboardingDone(): void {
  try { wx.setStorageSync(KEYS.ONBOARDING_DONE, true) } catch (_) {}
}

// ─────────── 用户头像 & 昵称 ──────────────────────────────

export function getUserAvatar(): string {
  try { return wx.getStorageSync(KEYS.USER_AVATAR) || '' } catch (_) { return '' }
}

export function saveUserAvatar(url: string): void {
  try { wx.setStorageSync(KEYS.USER_AVATAR, url) } catch (_) {}
}

export function getUserNickname(): string {
  try { return wx.getStorageSync(KEYS.USER_NICKNAME) || '' } catch (_) { return '' }
}

export function saveUserNickname(name: string): void {
  try { wx.setStorageSync(KEYS.USER_NICKNAME, name) } catch (_) {}
}
