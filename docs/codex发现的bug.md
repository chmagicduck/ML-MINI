# Codex 发现的潜在重大缺陷（首轮静态审计）

审计时间：2026-03-06  
审计范围：`miniprogram/utils/*`、`miniprogram/pages/*`、`miniprogram/app.ts`  
说明：以下均为“代码层可触发”的真实风险点，按严重度排序（P0 > P1 > P2）。

---

## [P0] 返回页面时可能重复补偿，摸鱼秒数被二次累加

- **类型**：交互逻辑 + 存储一致性
- **证据**：
  - `miniprogram/pages/index/index.ts:158`
  - `miniprogram/pages/index/index.ts:163`
  - `miniprogram/pages/index/index.ts:229`
  - `miniprogram/pages/index/index.ts:236`
- **问题机制**：
  - `onHide` 时记录 `_lastHideWorkedSecs`，但故意不暂停 `_timer`（注释里移除了 `this._pause()`）。
  - `onShow` 又根据“已上班秒数差值”做一次 `catchUpSecs` 补偿，并直接写回 `saveTodaySlackingSeconds(savedSecs + catchUpSecs)`。
  - 若隐藏期间 `_timer` 实际仍在跑（切 tab/切子页常见），补偿会和真实计时叠加，造成重复加秒。
- **结果影响**：
  - 摸鱼时长和收益被放大，战报与真实时长失真。
  - 累计收益会被错误推高，影响等级进度和升级触发。

---

## [P0] 跨午夜持续摸鱼会污染“新一天”数据（秒数继承前一天）

- **类型**：存储逻辑 + 计算逻辑
- **证据**：
  - `miniprogram/utils/storage.ts:14`
  - `miniprogram/utils/storage.ts:60`
  - `miniprogram/pages/index/index.ts:437`
  - `miniprogram/pages/index/index.ts:444`
  - `miniprogram/pages/index/index.ts:169`
- **问题机制**：
  - 每次写入 `saveTodaySlackingSeconds` 都用“当前日期 key”。
  - `_startTimer` 的 `seconds` 是“从本次开摸起的累计秒数”，不会在 00:00 自动归零。
  - 过了午夜后，旧累计值直接写入新日期 key，导致新一天初始就带着前一天秒数。
- **结果影响**：
  - 战报页把这部分当“今日未提交秒数”，当日收益和累计展示大幅虚高。
  - 后续 commit 与展示逻辑长期偏离，形成跨天脏数据。

---

## [P0] 异常退出后未提交秒数可能永久丢失（跨天后无法追补）

- **类型**：存储提交模型缺陷
- **证据**：
  - `miniprogram/pages/index/index.ts:168`
  - `miniprogram/pages/index/index.ts:169`
  - `miniprogram/pages/index/index.ts:486`
  - `miniprogram/pages/index/index.ts:489`
  - `miniprogram/pages/stats/index.ts:113`
  - `miniprogram/utils/storage.ts:93`
- **问题机制**：
  - 首页 `onShow` 把 `_lastCommitSeconds` 直接设为“今日 storage 秒数”。
  - `_pause` 只提交 `currentSeconds - _lastCommitSeconds` 的增量。
  - 若上次会话因杀进程/崩溃未走 `_pause`，那批历史秒数不会补提交通道，只在战报用“未提交差值”临时显示。
  - 一旦过天，这批“仅存在当日 key”的秒数不再参与累计，造成永久损失。
- **结果影响**：
  - `moyuStats.totalSeconds/totalMoney` 与用户真实累计严重背离。
  - 等级、里程碑与历史统计可信度下降。

---

## [P1] 只校验“开启时刻”，未校验“持续时段”，可一直刷到下班后甚至整夜

- **类型**：交互状态机缺陷
- **证据**：
  - `miniprogram/pages/index/index.ts:606`
  - `miniprogram/pages/index/index.ts:608`
  - `miniprogram/pages/index/index.ts:442`
  - `miniprogram/pages/index/index.ts:444`
- **问题机制**：
  - 开始摸鱼前只判断一次 `isWorkingNow`。
  - 启动后计时器没有任何“超出下班时间自动停止/封顶”逻辑。
- **结果影响**：
  - 用户可在临近下班前开启后持续挂机，非工作时段继续累积收益。
  - 与“工作时段内摸鱼”的产品规则冲突，形成可利用漏洞。

---

## [P1] 非工作日也会计算“今日已上班”和“本月已赚”

- **类型**：计算逻辑缺陷
- **证据**：
  - `miniprogram/utils/calculator.ts:89`
  - `miniprogram/utils/calculator.ts:142`
  - `miniprogram/utils/calculator.ts:39`
- **问题机制**：
  - `calcTodayWorkedSeconds` 仅基于当天时刻区间计算，不判断“今天是不是工作日/节假日”。
  - `calcMonthEarnings` 无条件加上 `todaySalary`。
  - 导致周末/法定假日（尤其双休模式）也会按工作日持续入账。
- **结果影响**：
  - 今日工时、今日入账、本月已赚在休息日失真。
  - 用户会误以为系统“自动上班中”。

---

## [P1] 工资分母未纳入法定节假日/调休，和节假日模块割裂

- **类型**：计算体系不一致
- **证据**：
  - `miniprogram/utils/calculator.ts:53`
  - `miniprogram/utils/calculator.ts:39`
  - `miniprogram/utils/holiday.ts:78`
- **问题机制**：
  - `getWorkingDaysInMonth` 仅按周几 + workdayMode 计算工作日。
  - 从不读取 `holiday.ts` 的法定假日/补班信息。
- **结果影响**：
  - 秒薪、日薪、月累计在节假月系统性偏差。
  - 日历/顶部提示和金额计算可能“看起来互相矛盾”。

---

## [P1] 发薪倒计时“0天”分支基本不可达，发薪日当天显示异常

- **类型**：计算逻辑 + UI 分支失效
- **证据**：
  - `miniprogram/utils/calculator.ts:169`
  - `miniprogram/utils/calculator.ts:180`
  - `miniprogram/pages/calendar/index.ts:95`
- **问题机制**：
  - `today < payDay ? 本月 : 下月`，当天 `today === payDay` 会直接走“下月发薪日”。
  - 日历页又写了 `daysToPayday === 0 ? 今天就是发薪日` 的文案分支。
- **结果影响**：
  - 发薪日当天倒计时不为 0，文案与直觉冲突。
  - `“今天就是发薪日”` 逻辑长期不触发。

---

## [P1] 节假日数据自相矛盾：`2026-09-26` 同时是“假日”和“补班”

- **类型**：基础数据缺陷
- **证据**：
  - `miniprogram/utils/holiday.ts:27`
  - `miniprogram/utils/holiday.ts:44`
  - `miniprogram/utils/holiday.ts:79`
  - `miniprogram/utils/holiday.ts:80`
- **问题机制**：
  - `2026-09-26` 同时存在于 `HOLIDAYS_2026` 与 `MAKEUP_WORKDAYS_2026`。
  - `getDayStatus` 判定顺序先 holiday 后 makeup，最终永远判成 holiday。
- **结果影响**：
  - 这一天在日历中状态错误。
  - 若后续把节假日状态接入工资限制，会造成错误业务判断。

---

## [P1] 会议页恢复状态只存“已过秒数”，成本基线上下文丢失

- **类型**：交互逻辑 + 状态持久化缺陷
- **证据**：
  - `miniprogram/utils/storage.ts:188`
  - `miniprogram/utils/storage.ts:190`
  - `miniprogram/pages/meeting/index.ts:11`
  - `miniprogram/pages/meeting/index.ts:20`
  - `miniprogram/pages/meeting/index.ts:55`
  - `miniprogram/pages/meeting/index.ts:65`
- **问题机制**：
  - 持久化的 `MeetingRunningState` 只有 `elapsedSeconds/savedAt`。
  - `participants/useCustomSalary/customSalaryNum/_secondCost` 都不入库。
  - 恢复后按当前页面默认或新配置重算成本，历史上下文断裂。
- **结果影响**：
  - 同一场会议恢复前后“每秒成本”和总额可能突变。
  - 数据解释性和可信度下降。

---

## [P2] 重置全量数据时遗漏 `meetingRunningState`

- **类型**：存储清理不完整
- **证据**：
  - `miniprogram/pages/profile/index.ts:99`
  - `miniprogram/utils/storage.ts:194`
- **问题机制**：
  - 重置清单包含 `poopRunningState`，但未包含 `meetingRunningState`。
- **结果影响**：
  - 用户执行“重置所有数据”后，会议页仍可能恢复旧运行状态。
  - 重置语义不完整，带来“数据没清干净”的体感问题。

---

## [P2] 等级皮肤解锁逻辑未接入累计收益，level 皮肤实际无法解锁

- **类型**：交互逻辑缺陷
- **证据**：
  - `miniprogram/pages/profile/index.ts:64`
  - `miniprogram/pages/profile/index.ts:76`
  - `miniprogram/pages/profile/index.ts:77`
- **问题机制**：
  - `unlockType === 'level'` 分支只弹 toast 后 `return`，没有任何“已达标可解锁”判定。
  - 代码里读取的是 `getSettings()` 而不是累计收益（`getMoyuStats()`）。
- **结果影响**：
  - `rich` 等等级皮肤即使达标也无法使用。
  - 用户成长反馈链路断裂。

---

## [P2] 高频同步写 storage（100ms）且无异常保护，存在卡顿/异常风险

- **类型**：存储稳定性 + 性能风险
- **证据**：
  - `miniprogram/pages/index/index.ts:442`
  - `miniprogram/pages/index/index.ts:448`
  - `miniprogram/utils/storage.ts:60`
  - `miniprogram/utils/storage.ts:62`
- **问题机制**：
  - 首页摸鱼计时器每 100ms 调用 `wx.setStorageSync`。
  - `saveTodaySlackingSeconds` 没有 `try/catch`，写失败会直接抛异常到计时回调。
- **结果影响**：
  - 高频同步 IO 容易拉低主线程流畅度与耗电。
  - 在极端设备/存储异常场景下可能导致计时不稳定。

---

## 建议优先级（修复顺序）

1. **先修 P0**：`重复补偿`、`跨天污染`、`未提交数据永久丢失`（这三项会直接破坏数据可信度）。  
2. **再修 P1**：`工作日判定`、`发薪倒计时`、`会议状态上下文`。  
3. **最后收尾 P2**：`重置遗漏`、`皮肤解锁`、`高频同步写与异常保护`。
