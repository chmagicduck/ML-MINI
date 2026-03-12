// app.ts
import { saveLastExitState } from './utils/storage'

App<IAppOption>({
  globalData: {},
  onLaunch() {},
  onHide() {
    try {
      saveLastExitState()
    } catch (_) {}
  },
})
