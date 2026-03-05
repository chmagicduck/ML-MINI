// pages/calendar/index.ts — 节假日日历 V2
import { getSettings } from '../../utils/storage'
import { getDaysToPayday } from '../../utils/calculator'
import { getMonthDayStatuses, DayStatus } from '../../utils/holiday'

interface CalendarDay {
  day: number
  status: DayStatus
  isToday: boolean
  isPayday: boolean
  isEmpty: boolean  // 月初占位空格
}

Page({
  data: {
    year: 0,
    month: 0,
    monthStr: '',
    weeks: [] as CalendarDay[][],
    daysToPayday: 0,
    paydayStr: '',
    payDay: 15,

    // 图例
    legend: [
      { color: '#FFFFFF', text: '工作日', border: '#E0E0E0' },
      { color: '#EAF1FF', text: '节假日', border: '#AFC8FF' },
      { color: '#FFF9C4', text: '调休补班', border: '#F9A825' },
      { color: '#FFEBEE', text: '周末', border: '#EF9A9A' },
      { color: '#E3F2FD', text: '发薪日', border: '#90CAF9' },
    ],
  },

  onLoad() {
    this._buildCalendar()
  },

  _buildCalendar() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const today = now.getDate()
    const settings = getSettings()
    const payDay = settings.payDay
    const daysToPayday = getDaysToPayday(payDay)

    const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
    const monthStr = `${year}年 ${monthNames[month]}`

    const dayStatuses = getMonthDayStatuses(year, month)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDow = new Date(year, month, 1).getDay()  // 0=Sun

    // 构建日历格，从周日开始
    const cells: CalendarDay[] = []
    // 月初占位
    for (let i = 0; i < firstDow; i++) {
      cells.push({ day: 0, status: 'workday', isToday: false, isPayday: false, isEmpty: true })
    }
    // 日期格
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        status: dayStatuses[d] || 'workday',
        isToday: d === today,
        isPayday: d === payDay,
        isEmpty: false,
      })
    }
    // 末尾补齐到完整行
    while (cells.length % 7 !== 0) {
      cells.push({ day: 0, status: 'workday', isToday: false, isPayday: false, isEmpty: true })
    }

    // 分行
    const weeks: CalendarDay[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }

    const paydayStr = daysToPayday === 0 ? '今天就是发薪日！🎉' : `还有 ${daysToPayday} 天发薪，坚持住！`

    this.setData({
      year,
      month,
      monthStr,
      weeks,
      daysToPayday,
      paydayStr,
      payDay,
    })
  },
})
