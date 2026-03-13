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
  workdayMode: WorkdayMode     // 工作日模式
  joinDate: string             // 入职日期 "YYYY-MM-DD"
  retirementDate: string       // 退休日期 "YYYY-MM-DD"
}

export interface PoopStats {
  totalSeconds: number
  totalEarnings: number
  sessions: PoopSession[]
}

export interface PoopSession {
  id: string                      // 唯一标识
  date: string                    // "YYYY-MM-DD"
  seconds: number
  earnings: number
  source: 'timer' | 'manual'     // 来源：计时器 / 手动记录
  createdAt: number               // 创建时间戳
}

/** 会议记录 */
export interface MeetingRecord {
  id: string
  name: string                    // 会议名称
  participants: number            // 参会人数
  totalCost: number               // 总消耗金额
  durationSeconds: number         // 会议时长（秒）
  averageSalary: number           // 人均月薪
  startTime: number               // 开始时间戳
  endTime: number                 // 结束时间戳
  createdAt: number
}

/** 食物选项 */
export interface FoodItem {
  id: string
  name: string
  emoji: string
  tag: string
  weight: number                  // 概率权重 1-10
  isDefault: boolean              // 是否为默认选项
}

/** 食物选择历史记录 */
export interface FoodHistory {
  foodId: string
  foodName: string
  emoji: string
  date: string                    // "YYYY-MM-DD"
  createdAt: number
}

export type MoyuEventSource = 'index_timer' | 'manual_edit' | 'repair'

export interface MoyuEvent {
  id: string
  dayKey: string                  // "YYYY-MM-DD"
  startAt: number                 // 会话起始时间戳(ms)
  endAt: number                   // 会话结束时间戳(ms)
  seconds: number                 // 会话时长（秒）
  money: number                   // 会话收益（按当时薪资快照入账）
  source: MoyuEventSource
  note?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

/** 累计摸鱼统计 */
export interface MoyuStats {
  totalMoney: number                    // 累计摸鱼收益（元）
  totalSeconds: number                  // 累计摸鱼秒数
  moyuDaysMap: Record<string, number>  // "YYYY-MM-DD": 当日摸鱼秒数（用于热力图）
  events: MoyuEvent[]                   // 摸鱼事件行
}

/** 拉粑粑计时器运行状态 */
export interface PoopRunningState {
  isRunning: boolean    // 是否正在计时
  sessionSeconds: number // 当次计时秒数
  sessionStartTime: number | null // 当次计时开始时刻（用于补齐）
}

/** 吗喽等级定义 */
export interface MoyuLevel {
  name: string      // 等级名
  emoji: string     // 图标
  threshold: number // 最低累计金额
  color: string     // 主色
  isGold: boolean   // 是否显示金色边框（摸鱼大圣）
  text: string      // 等级反讽文案
}

export const MOYU_LEVELS: MoyuLevel[] = [
  { name: '职场新人',   emoji: '🐣', threshold: 0,     color: '#BDBDBD', isGold: false, text: '刚踏上打工路，前途一片迷茫' },
  { name: '摸鱼入门',   emoji: '🐠', threshold: 50,    color: '#9E9E9E', isGold: false, text: '已学会假装认真的第一步' },
  { name: '摸鱼学徒',   emoji: '🐟', threshold: 150,   color: '#66BB6A', isGold: false, text: '初窥摸鱼门道，但距大师还远' },
  { name: '小有成就',   emoji: '🐊', threshold: 350,   color: '#43A047', isGold: false, text: '已掌握摸鱼精髓，开始进阶' },
  { name: '带薪锦鲤',   emoji: '🎏', threshold: 700,   color: '#26A69A', isGold: false, text: '我这辈子唯一的坚持，就是每天带薪拉屎' },
  { name: '摸鱼能手',   emoji: '🦈', threshold: 1500,  color: '#42A5F5', isGold: false, text: '进入高端摸鱼行列，薪水不再是梦' },
  { name: '职场老油条', emoji: '🐬', threshold: 3500,  color: '#7E57C2', isGold: false, text: '看遍职场百态，摸鱼是最大的真理' },
  { name: '划水宗师',   emoji: '🐋', threshold: 8000,  color: '#AB47BC', isGold: false, text: '上班是我的副业，摸鱼才是正业' },
  { name: '摸鱼大圣',   emoji: '🐒', threshold: 20000, color: '#EF5350', isGold: false, text: '老板的工资单，是我的致富密码' },
  { name: '传说打工人', emoji: '👑', threshold: 50000, color: '#FFD700', isGold: true,  text: '老板的钱，最终都要回到打工人的口袋' },
]

export const DEFAULT_SETTINGS: UserSettings = {
  monthlySalary: 0,
  payDay: 15,
  workStartTime: '09:00',
  workEndTime: '18:00',
  lunchBreakEnabled: true,
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  workdayMode: 'double',
  joinDate: '2020-01-01',
  retirementDate: '2055-01-01',
}

export const DEFAULT_MOYU_STATS: MoyuStats = {
  totalMoney: 0,
  totalSeconds: 0,
  moyuDaysMap: {},
  events: [],
}

/** 默认食物列表 */
export const DEFAULT_FOOD_LIST: FoodItem[] = [
  { id: 'default_1',  name: '黄焖鸡米饭', emoji: '🍗', tag: '万年不变', weight: 5, isDefault: true },
  { id: 'default_2',  name: '麻辣烫',     emoji: '🌶️', tag: '灵魂所在', weight: 5, isDefault: true },
  { id: 'default_3',  name: '沙县小吃',   emoji: '🥢', tag: '国民选择', weight: 5, isDefault: true },
  { id: 'default_4',  name: '兰州拉面',   emoji: '🍜', tag: '西北风情', weight: 5, isDefault: true },
  { id: 'default_5',  name: '螺蛳粉',     emoji: '🐌', tag: '臭名远扬', weight: 5, isDefault: true },
  { id: 'default_6',  name: '外卖随便点', emoji: '📱', tag: '懒人福音', weight: 5, isDefault: true },
  { id: 'default_7',  name: '便利店凑合', emoji: '🏪', tag: '社畜标配', weight: 5, isDefault: true },
  { id: 'default_8',  name: '蹭同事的',   emoji: '👀', tag: '白嫖大师', weight: 5, isDefault: true },
  { id: 'default_9',  name: '不吃了！减肥！', emoji: '🥗', tag: '每天都说', weight: 5, isDefault: true },
  { id: 'default_10', name: '回家吃',     emoji: '🏠', tag: '梦想而已', weight: 5, isDefault: true },
  { id: 'default_11', name: '公司食堂',   emoji: '🍽️', tag: '爱恨交织', weight: 5, isDefault: true },
  { id: 'default_12', name: '包子+豆浆',  emoji: '🥛', tag: '快速解决', weight: 5, isDefault: true },
  { id: 'default_13', name: '烤鸭饭',     emoji: '🦆', tag: '犒劳自己', weight: 5, isDefault: true },
  { id: 'default_14', name: '炒饭随便配', emoji: '🍳', tag: '万能基础', weight: 5, isDefault: true },
  { id: 'default_15', name: '火锅（下班约）', emoji: '🫕', tag: '快乐源泉', weight: 5, isDefault: true },
]
