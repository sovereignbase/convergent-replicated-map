import { CRMapSnapshot, CRMapState } from '../.types/index.js'
import { __create, __read, __update } from '../core/crud/index.js'

export class CRMap<T> {
  private readonly state: CRMapState<string, T>
  private readonly eventTarget: EventTarget
  constructor(snapshot?: CRMapSnapshot<string, T>) {
    this.state = __create<T>(snapshot)
    this.eventTarget = new EventTarget()
  }

  get size() {
    return this.state.values.size
  }

  get(key: string): T | undefined {
    return __read<T>(key, this.state)
  }
  has(key: string): boolean {
    return this.state.values.has(key)
  }
  set(key: string, value: T): void {
    const result = __update<T>(key, value, this.state)
    if (result) {
      const { delta, change } = result
      if (delta) {
        void this.eventTarget.dispatchEvent(
          new CustomEvent('delta', { detail: delta })
        )
      }
      if (change) {
        void this.eventTarget.dispatchEvent(
          new CustomEvent('change', { detail: change })
        )
      }
    }
  }
}
