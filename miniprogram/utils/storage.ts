// 本地存储工具函数 — 负责所有 wx.Storage 的读写操作
// 核心职责：用户设置、摸鱼统计（事件源模式）、各页面运行状态的持久化
import {
  UserSettings,
  PoopStats,
  PoopSession,
  MoyuStats,
  DEFAULT_SETTINGS,
  DEFAULT_MOYU_STATS,
  PoopRunningState,
  MoyuEvent,
  MoyuEventSource,
  MeetingRecord,
  FoodItem,
  FoodHistory,
  DEFAULT_FOOD_LIST,
} from './types'

/** Storage key 常量集中管理 */
const KEYS = {
  SETTINGS: 'userSettings',
  POOP_STATS: 'poopStats',
  MOYU_STATS: 'moyuStats',
  SLACKING_PREFIX: 'slackingToday_',
  PENDING_LEVEL_UP: 'pendingLevelUp',
  INITIAL_IDENTITY_SHOWN: 'initialIdentityShown',
  ONBOARDING_DONE: 'onboardingDone',
  USER_AVATAR: 'userAvatar',
  USER_NICKNAME: 'userNickname',
  MEETING_RECORDS: 'meetingRecords',
  FOOD_CONFIG: 'foodConfig',
  FOOD_HISTORY: 'foodHistory',
}

// ─────────── 内部工具函数 ────────────────────────────────────

/** 获取今天的日期 key（格式 YYYY-MM-DD） */
function todayKey(): string {
  return dayKeyByTimestamp(Date.now())
}

/** 时间戳转日期 key */
function dayKeyByTimestamp(ts: number): string {
  const now = new Date(ts)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

/** 安全转数值，处理 NaN/Infinity 返回 fallback */
function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const n = Number(value)
  return isFinite(n) ? n : fallback
}

/** 校验日期 key 格式 YYYY-MM-DD */
function isValidDayKey(dayKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey)
}

/** 生成唯一事件 ID（时间戳 + 随机串） */
function genEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 裁剪日期映射表，仅保留最近 N 天的记录 */
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

/** 规范化事件来源字段，无效值回退为 'repair' */
function normalizeSource(raw: unknown): MoyuEventSource {
  if (raw === 'index_timer' || raw === 'manual_edit' || raw === 'repair') {
    return raw
  }
  return 'repair'
}

/**
 * 清洗单条摸鱼事件，校验并修复所有字段
 * 返回 null 表示此条事件无效（秒数为0或数据损坏）
 */
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

/** 从事件列表重新聚合 totalMoney/totalSeconds/moyuDaysMap */
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

/**
 * 读取并规范化摸鱼统计数据
 * 若数据损坏或聚合值偏差，自动修复并标记 changed=true
 */
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

// ─────────── 用户设置 ────────────────────────────────────────

/** 读取用户设置，缺失字段用默认值填充 */
export function getSettings(): UserSettings {
  try {
    const stored = wx.getStorageSync(KEYS.SETTINGS)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...stored }
    }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS }
}

/** 保存用户设置 */
export function saveSettings(settings: UserSettings): void {
  wx.setStorageSync(KEYS.SETTINGS, settings)
}

// ─────────── 拉粑粑统计 ────────────────────────────────────

/** 读取拉粑粑累计统计 */
export function getPoopStats(): PoopStats {
  try {
    const stored = wx.getStorageSync(KEYS.POOP_STATS)
    if (stored) return stored as PoopStats
  } catch (_) {}
  return { totalSeconds: 0, totalEarnings: 0, sessions: [] }
}

/** 保存拉粑粑统计 */
export function savePoopStats(stats: PoopStats): void {
  try {
    wx.setStorageSync(KEYS.POOP_STATS, stats)
  } catch (_) {
    // 存储已满时静默失败，不影响主流程
  }
}

// ─────────── 今日摸鱼秒数（按天隔离） ──────────────────────

/** 读取今日已摸鱼秒数 */
export function getTodaySlackingSeconds(): number {
  try {
    const key = KEYS.SLACKING_PREFIX + todayKey()
    return wx.getStorageSync(key) || 0
  } catch (_) {
    return 0
  }
}

/** 保存今日摸鱼秒数 */
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

/** 提交元信息（可选时间段、来源、备注） */
export interface MoyuCommitMeta {
  startAt?: number
  endAt?: number
  source?: MoyuEventSource
  note?: string
}

/** 相邻事件合并的最大间隔（毫秒）；间隔在此范围内的连续事件合并为一条 */
const EVENT_MERGE_GAP_MS = 1500

/**
 * 判断新事件是否可以合并到最后一条事件中
 * 条件：同天、同来源、同备注、间隔不超过 EVENT_MERGE_GAP_MS
 */
function canMergeEvent(last: MoyuEvent | undefined, incoming: MoyuEvent): boolean {
  if (!last) return false
  if (last.deletedAt) return false
  if (last.dayKey !== incoming.dayKey) return false
  if (last.source !== incoming.source) return false
  if ((last.note || '') !== (incoming.note || '')) return false
  const gapMs = incoming.startAt - last.endAt
  return gapMs >= 0 && gapMs <= EVENT_MERGE_GAP_MS
}

/**
 * 按天提交摸鱼会话（内部核心方法）
 * 步骤：1.校验 → 2.构建事件 → 3.尝试合并或追加 → 4.更新聚合值 → 5.写入存储
 */
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
  meetingName?: string
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

// ─────────── 会议记录 CRUD ────────────────────────────────────

/** 读取所有会议记录 */
export function getMeetingRecords(): MeetingRecord[] {
  try {
    return (wx.getStorageSync(KEYS.MEETING_RECORDS) || []) as MeetingRecord[]
  } catch (_) {
    return []
  }
}

/** 保存会议记录（追加一条） */
export function saveMeetingRecord(record: MeetingRecord): void {
  try {
    const records = getMeetingRecords()
    wx.setStorageSync(KEYS.MEETING_RECORDS, [...records, record])
  } catch (_) {}
}

/** 更新会议记录 */
export function updateMeetingRecord(id: string, updates: Partial<MeetingRecord>): boolean {
  try {
    const records = getMeetingRecords()
    const idx = records.findIndex(r => r.id === id)
    if (idx === -1) return false
    const updated = records.map(r => r.id === id ? { ...r, ...updates } : r)
    wx.setStorageSync(KEYS.MEETING_RECORDS, updated)
    return true
  } catch (_) {
    return false
  }
}

/** 删除会议记录 */
export function deleteMeetingRecord(id: string): boolean {
  try {
    const records = getMeetingRecords()
    const filtered = records.filter(r => r.id !== id)
    if (filtered.length === records.length) return false
    wx.setStorageSync(KEYS.MEETING_RECORDS, filtered)
    return true
  } catch (_) {
    return false
  }
}

/** 分页获取会议记录（按创建时间倒序） */
export function getMeetingRecordsPaged(page: number, pageSize: number = 10): { records: MeetingRecord[], total: number } {
  const all = getMeetingRecords().sort((a, b) => b.createdAt - a.createdAt)
  const start = (page - 1) * pageSize
  return {
    records: all.slice(start, start + pageSize),
    total: all.length,
  }
}

// ─────────── 蹲坑记录扩展 CRUD ──────────────────────────────

/** 添加手动蹲坑记录 */
export function addManualPoopSession(seconds: number, earnings: number, date: string): boolean {
  try {
    const stats = getPoopStats()
    const session: PoopSession = {
      id: genEventId(),
      date,
      seconds,
      earnings,
      source: 'manual',
      createdAt: Date.now(),
    }
    const newStats: PoopStats = {
      totalSeconds: stats.totalSeconds + seconds,
      totalEarnings: stats.totalEarnings + earnings,
      sessions: [...stats.sessions, session].slice(-200),
    }
    savePoopStats(newStats)
    return true
  } catch (_) {
    return false
  }
}

/** 更新蹲坑记录 */
export function updatePoopSession(id: string, updates: Partial<PoopSession>): boolean {
  try {
    const stats = getPoopStats()
    const idx = stats.sessions.findIndex(s => s.id === id)
    if (idx === -1) return false
    const old = stats.sessions[idx]
    const updated = { ...old, ...updates }
    const sessions = stats.sessions.map(s => s.id === id ? updated : s)
    // 重新计算总计
    const totalSeconds = sessions.reduce((sum, s) => sum + s.seconds, 0)
    const totalEarnings = sessions.reduce((sum, s) => sum + s.earnings, 0)
    savePoopStats({ totalSeconds, totalEarnings, sessions })
    return true
  } catch (_) {
    return false
  }
}

/** 删除蹲坑记录 */
export function deletePoopSession(id: string): boolean {
  try {
    const stats = getPoopStats()
    const sessions = stats.sessions.filter(s => s.id !== id)
    if (sessions.length === stats.sessions.length) return false
    const totalSeconds = sessions.reduce((sum, s) => sum + s.seconds, 0)
    const totalEarnings = sessions.reduce((sum, s) => sum + s.earnings, 0)
    savePoopStats({ totalSeconds, totalEarnings, sessions })
    return true
  } catch (_) {
    return false
  }
}

/** 分页获取蹲坑记录（按创建时间倒序） */
export function getPoopSessionsPaged(page: number, pageSize: number = 10): { sessions: PoopSession[], total: number } {
  const all = getPoopStats().sessions.sort((a, b) => b.createdAt - a.createdAt)
  const start = (page - 1) * pageSize
  return {
    sessions: all.slice(start, start + pageSize),
    total: all.length,
  }
}

// ─────────── 食物配置 CRUD ────────────────────────────────────

/** 读取食物配置（首次使用返回默认列表） */
export function getFoodConfig(): FoodItem[] {
  try {
    const stored = wx.getStorageSync(KEYS.FOOD_CONFIG)
    if (stored && Array.isArray(stored) && stored.length > 0) return stored as FoodItem[]
  } catch (_) {}
  return DEFAULT_FOOD_LIST.map(item => ({ ...item }))
}

/** 保存完整食物配置 */
export function saveFoodConfig(items: FoodItem[]): void {
  try { wx.setStorageSync(KEYS.FOOD_CONFIG, items) } catch (_) {}
}

/** 添加食物选项 */
export function addFoodItem(item: FoodItem): void {
  const items = getFoodConfig()
  saveFoodConfig([...items, item])
}

/** 更新食物选项 */
export function updateFoodItem(id: string, updates: Partial<FoodItem>): boolean {
  const items = getFoodConfig()
  const idx = items.findIndex(f => f.id === id)
  if (idx === -1) return false
  saveFoodConfig(items.map(f => f.id === id ? { ...f, ...updates } : f))
  return true
}

/** 删除食物选项 */
export function deleteFoodItem(id: string): boolean {
  const items = getFoodConfig()
  const filtered = items.filter(f => f.id !== id)
  if (filtered.length === items.length) return false
  saveFoodConfig(filtered)
  return true
}

// ─────────── 食物历史记录 ────────────────────────────────────

/** 读取食物选择历史 */
export function getFoodHistory(): FoodHistory[] {
  try {
    return (wx.getStorageSync(KEYS.FOOD_HISTORY) || []) as FoodHistory[]
  } catch (_) {
    return []
  }
}

/** 添加食物选择记录 */
export function addFoodHistory(entry: FoodHistory): void {
  try {
    const history = getFoodHistory()
    // 保留最近 500 条
    const updated = [...history, entry].slice(-500)
    wx.setStorageSync(KEYS.FOOD_HISTORY, updated)
  } catch (_) {}
}

/** 获取食物选择统计（foodId → 次数） */
export function getFoodHistoryStats(): Record<string, number> {
  const history = getFoodHistory()
  const stats: Record<string, number> = {}
  for (const entry of history) {
    stats[entry.foodId] = (stats[entry.foodId] || 0) + 1
  }
  return stats
}
