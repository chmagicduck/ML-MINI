// pages/calendar/index.ts — 节假日日历（支持全年翻月）
import { getSettings } from '../../utils/storage'
import { getDaysToPayday } from '../../utils/calculator'
import { getMonthDayStatuses, DayStatus } from '../../utils/holiday'

interface CalendarDay {
  day: number
  status: DayStatus
  isToday: boolean
  isPayday: boolean
  isEmpty: boolean
}

const TODAY = new Date()
const THIS_YEAR = TODAY.getFullYear()
const MONTH_NAMES = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']

Page({
  data: {
    viewYear: THIS_YEAR,
    viewMonth: TODAY.getMonth(),
    monthStr: '',
    canPrev: false,
    canNext: false,
    weeks: [] as CalendarDay[][],
    daysToPayday: 0,
    paydayStr: '',
    payDay: 15,

    legend: [
      { color: '#FFFFFF', text: '工作日', border: '#E0E0E0' },
      { color: '#EFF6FF', text: '节假日', border: '#93C5FD' },
      { color: '#FFF9C4', text: '调休补班', border: '#F9A825' },
      { color: '#FFEBEE', text: '周末', border: '#EF9A9A' },
      { color: '#E3F2FD', text: '发薪日', border: '#90CAF9' },
    ],
  },

  onLoad() {
    const settings = getSettings()
    this.setData({ payDay: settings.payDay })
    this._buildCalendar(THIS_YEAR, TODAY.getMonth())
  },

  onPrevMonth() {
    const { viewYear, viewMonth } = this.data
    if (viewMonth === 0) return
    this._buildCalendar(viewYear, viewMonth - 1)
  },

  onNextMonth() {
    const { viewYear, viewMonth } = this.data
    if (viewMonth === 11) return
    this._buildCalendar(viewYear, viewMonth + 1)
  },

  _buildCalendar(year: number, month: number) {
    const { payDay } = this.data
    const todayDate = TODAY.getDate()
    const todayMonth = TODAY.getMonth()
    const todayYear = TODAY.getFullYear()
    const daysToPayday = getDaysToPayday(payDay)

    const monthStr = `${year}年 ${MONTH_NAMES[month]}`
    const canPrev = month > 0
    const canNext = month < 11

    const dayStatuses = getMonthDayStatuses(year, month)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDow = new Date(year, month, 1).getDay()

    const cells: CalendarDay[] = []
    for (let i = 0; i < firstDow; i++) {
      cells.push({ day: 0, status: 'workday', isToday: false, isPayday: false, isEmpty: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === todayDate && month === todayMonth && year === todayYear
      cells.push({
        day: d,
        status: dayStatuses[d] || 'workday',
        isToday,
        isPayday: d === payDay,
        isEmpty: false,
      })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: 0, status: 'workday', isToday: false, isPayday: false, isEmpty: true })
    }

    const weeks: CalendarDay[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }

    const paydayStr = daysToPayday === 0 ? '今天就是发薪日！🎉' : `还有 ${daysToPayday} 天发薪，坚持住！`

    this.setData({ viewYear: year, viewMonth: month, monthStr, canPrev, canNext, weeks, daysToPayday, paydayStr })
  },
})
