// app.ts
import { saveLastExitState } from './utils/storage'
import { calcTodayWorkedSeconds } from './utils/calculator'
import { getSettings } from './utils/storage'

App<IAppOption>({
  globalData: {},
  onLaunch() {},
  onHide() {
    try {
      const settings = getSettings()
      const workedSecs = calcTodayWorkedSeconds(settings)
      saveLastExitState(workedSecs)
    } catch (_) {}
  },
})
