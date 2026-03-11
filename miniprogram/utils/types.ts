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

/** V1.0.1: 拉粑粑计时器运行状态 */
export interface PoopRunningState {
  isRunning: boolean    // 是否正在计时
  sessionSeconds: number // 当次计时秒数
  sessionStartTime: number | null // 当次计时开始时刻（用于补齐）
}

/** V2: 吗喽等级定义 */
export interface MoyuLevel {
  name: string      // 等级名
  emoji: string     // 图标
  threshold: number // 最低累计金额
  color: string     // 主色
  isGold: boolean   // 是否显示金色边框（摸鱼大圣）
  text: string      // V1.0.1: 等级反讽文案
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
  eveningBreakEnabled: false,
  eveningBreakStart: '17:30',
  eveningBreakEnd: '18:00',
  workdayMode: 'double',
  joinDate: '2020-01-01',
  retirementDate: '2055-01-01',
}

export const DEFAULT_MOYU_STATS: MoyuStats = {
  totalMoney: 0,
  totalSeconds: 0,
  moyuDaysMap: {},
}

// ─────────── V1.0.1: 皮肤系统 ────────────────────────────────

export type SkinId = 'default' | 'suit' | 'rich' | 'cute' | 'bamboo'

export type UnlockType = 'default' | 'ad' | 'level'

export interface Skin {
  name: string
  primaryColor: string
  image: string
  unlockType: UnlockType
  unlockLevel?: number  // 仅 unlockType: 'level' 时有效
}

export const SKINS: Record<SkinId, Skin> = {
  default: {
    name: '默认',
    primaryColor: '#4CAF50',
    image: 'assets/images/skins/malou-default.png',
    unlockType: 'default',
  },
  suit: {
    name: '西装',
    primaryColor: '#2196F3',
    image: 'assets/images/skins/malou-suit.png',
    unlockType: 'ad',
  },
  rich: {
    name: '土豪',
    primaryColor: '#FFD700',
    image: 'assets/images/skins/malou-rich.png',
    unlockType: 'level',
    unlockLevel: 50000,
  },
  cute: {
    name: '萌系',
    primaryColor: '#FF69B4',
    image: 'assets/images/skins/malou-cute.png',
    unlockType: 'ad',
  },
  bamboo: {
    name: '竹子',
    primaryColor: '#00897B',
    image: 'assets/images/skins/malou-bamboo.png',
    unlockType: 'ad',
  },
}

export const DEFAULT_SKIN: SkinId = 'default'
