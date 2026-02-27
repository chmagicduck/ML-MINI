/**
 * 2026年中国法定节假日引擎
 * 数据来源：根据历年国务院节假日安排规律推算，精确日期以国务院公告为准。
 * 主要固定节点：元旦(1/1)、春节(农历正月初一=2026-02-17)、清明(4/5)、劳动节(5/1)、
 * 端午(农历五月初五≈6/19)、中秋(农历八月十五≈9/25)、国庆(10/1)
 */

/** 2026 年法定节假日（含调休延长假期） */
const HOLIDAYS_2026: string[] = [
  // 元旦 (1天，周四，不调休)
  '2026-01-01',

  // 春节 (2026-02-17 农历正月初一，8天)
  '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
  '2026-02-21', '2026-02-22', '2026-02-23', '2026-02-24',

  // 清明节 (4/5 周日，连休3天：4/4-4/6)
  '2026-04-04', '2026-04-05', '2026-04-06',

  // 劳动节 (5/1 周五，连休5天：5/1-5/5)
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',

  // 端午节 (农历五月初五≈6/19，连休3天：6/19-6/21)
  '2026-06-19', '2026-06-20', '2026-06-21',

  // 中秋节 (农历八月十五≈9/25，连休3天：9/25-9/27)
  '2026-09-25', '2026-09-26', '2026-09-27',

  // 国庆节 (10/1，连休7天：10/1-10/7)
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07',
]

/**
 * 2026 年调休补班日（周末但需上班）
 * 这些日期是周六/周日，但因调休须正常上班。
 */
const MAKEUP_WORKDAYS_2026: string[] = [
  '2026-02-07',  // 春节前补班（周六）
  '2026-02-28',  // 春节后补班（周六）
  '2026-03-28',  // 清明节前补班（周六）
  '2026-04-26',  // 劳动节前补班（周日）
  '2026-05-09',  // 劳动节后补班（周六）
  '2026-09-26',  // 中秋/国庆前补班（周六）
  '2026-10-10',  // 国庆后补班（周六）
]

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 是否为法定节假日 */
export function isHoliday(dateStr: string): boolean {
  return HOLIDAYS_2026.includes(dateStr)
}

/** 是否为调休补班日（周末须上班） */
export function isMakeupWorkday(dateStr: string): boolean {
  return MAKEUP_WORKDAYS_2026.includes(dateStr)
}

export type DayStatus =
  | 'workday'         // 普通工作日
  | 'holiday'         // 法定节假日
  | 'weekend'         // 普通周末
  | 'makeup'          // 调休补班（周末须上班）

/** 获取今日假日状态 */
export function getTodayStatus(): DayStatus {
  const today = toDateStr(new Date())
  return getDayStatus(today)
}

/** 获取指定日期状态 */
export function getDayStatus(dateStr: string): DayStatus {
  if (isHoliday(dateStr)) return 'holiday'
  if (isMakeupWorkday(dateStr)) return 'makeup'
  const dow = new Date(dateStr).getDay()
  if (dow === 0 || dow === 6) return 'weekend'
  return 'workday'
}

/**
 * 获取今日状态文案
 * 用于首页顶部提示条
 */
export function getTodayStatusText(): string {
  const status = getTodayStatus()
  const dow = new Date().getDay()
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const dayName = dayNames[dow]

  switch (status) {
    case 'holiday':
      return '今天是法定节假日，躺平不内疚！'
    case 'weekend':
      return `今天是${dayName}，休息！当前是纯利润时间 ✌️`
    case 'makeup':
      return `今天是${dayName}但要补班，辛苦打工人了...`
    default:
      return ''  // 普通工作日，不显示特殊提示
  }
}

/** 获取某月每天的节假日状态（用于日历渲染） */
export function getMonthDayStatuses(year: number, month: number): Record<number, DayStatus> {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const result: Record<number, DayStatus> = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(month + 1).padStart(2, '0')
    const day = String(d).padStart(2, '0')
    result[d] = getDayStatus(`${year}-${m}-${day}`)
  }
  return result
}

/** 获取今天是第几周（ISO周数，用于大小周） */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
