// 薪资与时间计算引擎
import { UserSettings, WorkdayMode, MoyuLevel, MOYU_LEVELS } from './types'
import { getDayStatus } from './holiday'

/** 解析 "HH:MM" 为当天分钟数（H-2: 加防御性校验） */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0
  const parts = timeStr.split(':')
  const h = Number(parts[0]) || 0
  const m = Number(parts[1]) || 0
  return h * 60 + m
}

/** 每日净工作分钟数（扣除午休） */
export function getDailyWorkMinutes(settings: UserSettings): number {
  const start = parseTimeToMinutes(settings.workStartTime)
  const end = parseTimeToMinutes(settings.workEndTime)
  let total = end - start

  if (settings.lunchBreakEnabled) {
    total -= parseTimeToMinutes(settings.lunchBreakEnd) - parseTimeToMinutes(settings.lunchBreakStart)
  }
  return Math.max(total, 1)
}

/** 获取 ISO 周数（年内第几周），用于大小周判定 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 仅按工作制判断（不含法定节假日/调休） */
function isWorkingDayByMode(year: number, month: number, day: number, mode: WorkdayMode): boolean {
  const date = new Date(year, month, day)
  const dow = date.getDay()
  if (mode === 'double') return dow !== 0 && dow !== 6
  if (mode === 'sat-off') return dow !== 6
  if (mode === 'sun-off') return dow !== 0
  if (mode === 'big-small') {
    const isoWeek = getISOWeekNumber(date)
    return isoWeek % 2 === 1 ? (dow !== 0 && dow !== 6) : dow !== 0
  }
  return dow !== 0 && dow !== 6
}

/** 判断给定日期是否为工作日（含法定节假日/调休） */
function isWorkingDay(year: number, month: number, day: number, mode: WorkdayMode): boolean {
  const dayStatus = getDayStatus(toDateKey(year, month, day))
  if (dayStatus === 'holiday') return false
  if (dayStatus === 'makeup') return true
  return isWorkingDayByMode(year, month, day, mode)
}

/** 指定月份的工作日数量 */
export function getWorkingDaysInMonth(year: number, month: number, mode: WorkdayMode): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (isWorkingDay(year, month, d, mode)) count++
  }
  return count || 1
}

/** 本月已过去的工作日数（不含今天） */
export function getWorkingDaysElapsed(settings: UserSettings): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  let count = 0
  for (let d = 1; d < today; d++) {
    if (isWorkingDay(year, month, d, settings.workdayMode)) count++
  }
  return count
}

/** 每秒薪资（元/秒） */
export function getSecondSalary(settings: UserSettings): number {
  const now = new Date()
  const workDays = getWorkingDaysInMonth(now.getFullYear(), now.getMonth(), settings.workdayMode)
  const dailySalary = settings.monthlySalary / workDays
  const dailySeconds = getDailyWorkMinutes(settings) * 60
  return dailySalary / dailySeconds
}

/**
 * 今日实际已上班秒数（秒精度，钳位到 [0, dailyWorkSeconds]）
 * 从上班时间到当前时刻，扣除已过的午休/晚休时间，下班后锁定为全天工时。
 * 与摸鱼计时器无关，纯基于时间流逝。
 */
export function calcTodayWorkedSeconds(settings: UserSettings): number {
  const now = new Date()
  if (!isWorkingDay(now.getFullYear(), now.getMonth(), now.getDate(), settings.workdayMode)) {
    return 0
  }

  const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const startSec = parseTimeToMinutes(settings.workStartTime) * 60
  const endSec = parseTimeToMinutes(settings.workEndTime) * 60

  if (currentSec <= startSec) return 0

  const effectiveSec = Math.min(currentSec, endSec)
  let workedSecs = effectiveSec - startSec

  if (settings.lunchBreakEnabled) {
    const lunchStartSec = parseTimeToMinutes(settings.lunchBreakStart) * 60
    const lunchEndSec = parseTimeToMinutes(settings.lunchBreakEnd) * 60
    if (effectiveSec > lunchEndSec) {
      workedSecs -= lunchEndSec - lunchStartSec
    } else if (effectiveSec > lunchStartSec) {
      workedSecs -= effectiveSec - lunchStartSec
    }
  }

  return Math.max(0, workedSecs)
}

function getOverlapSeconds(startA: number, endA: number, startB: number, endB: number): number {
  const start = Math.max(startA, startB)
  const end = Math.min(endA, endB)
  return Math.max(0, end - start)
}

function calcWorkedSecondsInDayRange(
  settings: UserSettings,
  year: number,
  month: number,
  day: number,
  fromSec: number,
  toSec: number,
): number {
  if (toSec <= fromSec) return 0
  if (!isWorkingDay(year, month, day, settings.workdayMode)) return 0

  const startSec = parseTimeToMinutes(settings.workStartTime) * 60
  const endSec = parseTimeToMinutes(settings.workEndTime) * 60

  const validStart = Math.max(fromSec, startSec)
  const validEnd = Math.min(toSec, endSec)
  if (validEnd <= validStart) return 0

  let worked = validEnd - validStart

  if (settings.lunchBreakEnabled) {
    const lunchStart = parseTimeToMinutes(settings.lunchBreakStart) * 60
    const lunchEnd = parseTimeToMinutes(settings.lunchBreakEnd) * 60
    worked -= getOverlapSeconds(validStart, validEnd, lunchStart, lunchEnd)
  }

  return Math.max(0, worked)
}

/**
 * 计算任意时间区间内的有效工作秒数（用于前后台切换离线收益）
 */
export function calcWorkedSecondsBetween(settings: UserSettings, startMs: number, endMs: number): number {
  if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) return 0

  let total = 0
  let cursor = startMs
  let guard = 0

  while (cursor < endMs && guard < 400) {
    guard++
    const dayStart = new Date(cursor)
    dayStart.setHours(0, 0, 0, 0)

    const y = dayStart.getFullYear()
    const m = dayStart.getMonth()
    const d = dayStart.getDate()

    const dayStartMs = dayStart.getTime()
    const nextDayMs = dayStartMs + 86400000

    const segStartMs = Math.max(cursor, dayStartMs)
    const segEndMs = Math.min(endMs, nextDayMs)

    const fromSec = (segStartMs - dayStartMs) / 1000
    const toSec = (segEndMs - dayStartMs) / 1000

    total += calcWorkedSecondsInDayRange(settings, y, m, d, fromSec, toSec)
    cursor = nextDayMs
  }

  return Math.max(0, total)
}

/**
 * 今日入账工资（基于实际上班秒数，非摸鱼计时器）
 * 含义：截至目前，打工人已"赚到"的今日工资总额
 */
export function calcTodayWorkedEarnings(settings: UserSettings): number {
  return getSecondSalary(settings) * calcTodayWorkedSeconds(settings)
}

/** 今日摸鱼收益 */
export function calcTodayEarnings(settings: UserSettings, slackingSeconds: number): number {
  return getSecondSalary(settings) * slackingSeconds
}

/**
 * 本月已赚薪资（秒精度版，每100ms可见跳动）
 * 原 calcMonthEarnings 使用分钟精度，每60秒才更新一次，体验差。
 * 新版用 calcTodayWorkedSeconds 精确到秒，使数字实时流动。
 */
export function calcMonthEarnings(settings: UserSettings): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const workDays = getWorkingDaysInMonth(year, month, settings.workdayMode)
  const dailySalary = settings.monthlySalary / workDays
  const elapsed = getWorkingDaysElapsed(settings)
  // 秒精度：今日已上班秒数 / 全天工时秒数 × 日薪
  const dailyWorkSecs = getDailyWorkMinutes(settings) * 60
  const workedSecsToday = Math.min(calcTodayWorkedSeconds(settings), dailyWorkSecs)
  const todaySalary = dailySalary * (workedSecsToday / dailyWorkSecs)
  return elapsed * dailySalary + todaySalary
}

/**
 * 今日工时进度 0~1（保留用于进度环，H-1 修复）
 */
export function getTodayWorkProgress(settings: UserSettings): number {
  const dailyWorkSecs = getDailyWorkMinutes(settings) * 60
  const workedSecs = calcTodayWorkedSeconds(settings)
  return Math.max(0, Math.min(1, workedSecs / dailyWorkSecs))
}

/**
 * 距离下次发薪日（天）
 * H-5: 钳位到目标月份的实际最大天数，防止 31 号溢出
 */
export function getDaysToPayday(payDay: number): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()

  function clampToMonth(y: number, m: number, d: number): Date {
    const maxDay = new Date(y, m + 1, 0).getDate()
    return new Date(y, m, Math.min(d, maxDay))
  }

  const thisMonthPayday = clampToMonth(year, month, payDay)
  if (today === thisMonthPayday.getDate()) return 0

  const target = today < thisMonthPayday.getDate()
    ? thisMonthPayday
    : clampToMonth(year, month + 1, payDay)

  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

/** 距离最近的周日（天），当天为0 */
export function getDaysToWeekend(): number {
  const dow = new Date().getDay()
  return dow === 0 ? 0 : 7 - dow
}

/** 距离退休（天） */
export function getDaysToRetirement(retirementDate: string): number {
  const diff = new Date(retirementDate).getTime() - Date.now()
  return diff <= 0 ? 0 : Math.ceil(diff / 86400000)
}

/**
 * 格式化金额 — 统一 ¥X.XXXX，保留4位小数
 */
export function formatMoney(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '¥0.0000'
  return `¥${amount.toFixed(4)}`
}

/** 格式化秒数为 HH:mm:ss */
export function formatDuration(totalSeconds: number): string {
  const s = Math.floor(Math.max(0, totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
}

/** 根据累计摸鱼总收益获取当前等级 */
export function getMoyuLevel(totalMoney: number): MoyuLevel {
  let level = MOYU_LEVELS[0]
  for (const l of MOYU_LEVELS) {
    if (totalMoney >= l.threshold) level = l
  }
  return level
}

/** 获取下一等级，已满级返回 null */
export function getNextMoyuLevel(totalMoney: number): MoyuLevel | null {
  for (const l of MOYU_LEVELS) {
    if (totalMoney < l.threshold) return l
  }
  return null
}

/**
 * 判断当前时刻是否处于工作时间内
 * 仅检查时间区间，不检查节假日（节假日由调用方决定是否额外限制）
 */
export function isWorkingNow(settings: UserSettings): boolean {
  const now = new Date()
  if (!isWorkingDay(now.getFullYear(), now.getMonth(), now.getDate(), settings.workdayMode)) {
    return false
  }

  const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const startSec = parseTimeToMinutes(settings.workStartTime) * 60
  const endSec = parseTimeToMinutes(settings.workEndTime) * 60
  return currentSec >= startSec && currentSec <= endSec
}

