// 薪资与时间计算引擎
import { UserSettings, WorkdayMode, MoyuLevel, MOYU_LEVELS } from './types'

/** 解析 "HH:MM" 为当天分钟数（H-2: 加防御性校验） */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0
  const parts = timeStr.split(':')
  const h = Number(parts[0]) || 0
  const m = Number(parts[1]) || 0
  return h * 60 + m
}

/** 每日净工作分钟数（扣除午休/晚休） */
export function getDailyWorkMinutes(settings: UserSettings): number {
  const start = parseTimeToMinutes(settings.workStartTime)
  const end = parseTimeToMinutes(settings.workEndTime)
  let total = end - start

  if (settings.lunchBreakEnabled) {
    total -= parseTimeToMinutes(settings.lunchBreakEnd) - parseTimeToMinutes(settings.lunchBreakStart)
  }
  if (settings.eveningBreakEnabled) {
    total -= parseTimeToMinutes(settings.eveningBreakEnd) - parseTimeToMinutes(settings.eveningBreakStart)
  }
  return Math.max(total, 1)
}

/** 获取 ISO 周数（年内第几周），用于大小周判定（H-3: 修复月内周 → ISO 周） */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/** 判断给定月份中某一天是否为工作日 */
function isWorkingDay(year: number, month: number, day: number, mode: WorkdayMode): boolean {
  const date = new Date(year, month, day)
  const dow = date.getDay() // 0=Sun,6=Sat
  if (mode === 'double') return dow !== 0 && dow !== 6
  if (mode === 'sat-off') return dow !== 6  // 仅周六休
  if (mode === 'sun-off') return dow !== 0  // 仅周日休
  if (mode === 'big-small') {
    // H-3: 使用 ISO 周数保证跨月连续性，奇数周双休，偶数周仅周日休
    const isoWeek = getISOWeekNumber(date)
    return isoWeek % 2 === 1 ? (dow !== 0 && dow !== 6) : dow !== 0
  }
  return dow !== 0 && dow !== 6
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

/** 今日摸鱼收益 */
export function calcTodayEarnings(settings: UserSettings, slackingSeconds: number): number {
  return getSecondSalary(settings) * slackingSeconds
}

/** 本月已赚薪资（基于当前时刻） */
export function calcMonthEarnings(settings: UserSettings): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const workDays = getWorkingDaysInMonth(year, month, settings.workdayMode)
  const dailySalary = settings.monthlySalary / workDays
  const elapsed = getWorkingDaysElapsed(settings)
  const todayProgress = getTodayWorkProgress(settings)
  return (elapsed + todayProgress) * dailySalary
}

/**
 * 今日工时进度 0~1
 * H-1: 扣除休息时段，使进度与 getDailyWorkMinutes 分母一致
 */
export function getTodayWorkProgress(settings: UserSettings): number {
  const now = new Date()
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const startMin = parseTimeToMinutes(settings.workStartTime)
  const endMin = parseTimeToMinutes(settings.workEndTime)

  if (currentMin <= startMin) return 0
  if (currentMin >= endMin) return 1

  let workedMinutes = currentMin - startMin

  if (settings.lunchBreakEnabled) {
    const lunchStart = parseTimeToMinutes(settings.lunchBreakStart)
    const lunchEnd = parseTimeToMinutes(settings.lunchBreakEnd)
    if (currentMin > lunchEnd) {
      workedMinutes -= lunchEnd - lunchStart
    } else if (currentMin > lunchStart) {
      workedMinutes -= currentMin - lunchStart
    }
  }

  if (settings.eveningBreakEnabled) {
    const eveStart = parseTimeToMinutes(settings.eveningBreakStart)
    const eveEnd = parseTimeToMinutes(settings.eveningBreakEnd)
    if (currentMin > eveEnd) {
      workedMinutes -= eveEnd - eveStart
    } else if (currentMin > eveStart) {
      workedMinutes -= currentMin - eveStart
    }
  }

  const totalWorkMinutes = getDailyWorkMinutes(settings)
  return Math.max(0, Math.min(1, workedMinutes / totalWorkMinutes))
}

/**
 * 距离下次发薪日（天）
 * H-5: 钳位到目标月份的实际最大天数，防止 31 号溢出
 */
export function getDaysToPayday(payDay: number): number {
  const now = new Date()
  const today = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()

  function clampToMonth(y: number, m: number, d: number): Date {
    const maxDay = new Date(y, m + 1, 0).getDate()
    return new Date(y, m, Math.min(d, maxDay))
  }

  const target = today < payDay
    ? clampToMonth(year, month, payDay)
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

/** 格式化金额 */
export function formatMoney(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '¥0.00'
  if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(2)}万`
  }
  return `¥${amount.toFixed(2)}`
}

/** 格式化秒数为 HH:mm:ss */
export function formatDuration(totalSeconds: number): string {
  const s = Math.floor(Math.max(0, totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
}

/**
 * V2: 根据累计摸鱼总收益获取当前等级
 */
export function getMoyuLevel(totalMoney: number): MoyuLevel {
  let level = MOYU_LEVELS[0]
  for (const l of MOYU_LEVELS) {
    if (totalMoney >= l.threshold) {
      level = l
    }
  }
  return level
}

/**
 * V2: 获取下一等级信息（用于进度显示）
 * 返回 null 表示已到顶级
 */
export function getNextMoyuLevel(totalMoney: number): MoyuLevel | null {
  for (const l of MOYU_LEVELS) {
    if (totalMoney < l.threshold) {
      return l
    }
  }
  return null
}
