// 类型定义

export type WorkdayMode = 'double' | 'sat-off' | 'sun-off' | 'big-small'

export interface UserSettings {
  monthlySalary: number        // 月薪（元）
  payDay: number               // 发薪日 1-31
  workStartTime: string        // 上班时间 "09:00"
  workEndTime: string          // 下班时间 "18:00"
  lunchBreakEnabled: boolean   // 午休开关
  lunchBreakStart: string      // 午休开始 "12:00"
  lunchBreakEnd: string        // 午休结束 "13:00"
  eveningBreakEnabled: boolean // 晚休开关
  eveningBreakStart: string    // 晚休开始
  eveningBreakEnd: string      // 晚休结束
  workdayMode: WorkdayMode     // 工作日模式
  joinDate: string             // 入职日期 "YYYY-MM-DD"
  retirementDate: string       // 退休日期 "YYYY-MM-DD"
  soundEnabled: boolean        // 金币音效
  vibrateEnabled: boolean      // V2: 震动反馈
}

export interface PoopStats {
  totalSeconds: number
  totalEarnings: number
  sessions: PoopSession[]
}

export interface PoopSession {
  date: string      // "YYYY-MM-DD"
  seconds: number
  earnings: number
}

/** V2: 累计摸鱼统计 */
export interface MoyuStats {
  totalMoney: number                    // 累计摸鱼收益（元）
  totalSeconds: number                  // 累计摸鱼秒数
  moyuDaysMap: Record<string, number>  // "YYYY-MM-DD": 当日摸鱼秒数（用于热力图）
}

/** V2: 吗喽等级定义 */
export interface MoyuLevel {
  name: string      // 等级名
  emoji: string     // 图标
  threshold: number // 最低累计金额
  color: string     // 主色
  isGold: boolean   // 是否显示金色边框（摸鱼大圣）
}

export const MOYU_LEVELS: MoyuLevel[] = [
  { name: '职场牛马', emoji: '🐂', threshold: 0,     color: '#9E9E9E', isGold: false },
  { name: '摸鱼学徒', emoji: '🐟', threshold: 500,   color: '#66BB6A', isGold: false },
  { name: '带薪锦鲤', emoji: '🎏', threshold: 2000,  color: '#42A5F5', isGold: false },
  { name: '划水宗师', emoji: '🏊', threshold: 10000, color: '#AB47BC', isGold: false },
  { name: '摸鱼大圣', emoji: '🐒', threshold: 50000, color: '#FFD700', isGold: true  },
]

export const DEFAULT_SETTINGS: UserSettings = {
  monthlySalary: 0,
  payDay: 15,
  workStartTime: '09:00',
  workEndTime: '18:00',
  lunchBreakEnabled: true,
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  eveningBreakEnabled: false,
  eveningBreakStart: '17:30',
  eveningBreakEnd: '18:00',
  workdayMode: 'double',
  joinDate: '2020-01-01',
  retirementDate: '2055-01-01',
  soundEnabled: true,
  vibrateEnabled: true,
}

export const DEFAULT_MOYU_STATS: MoyuStats = {
  totalMoney: 0,
  totalSeconds: 0,
  moyuDaysMap: {},
}
