import { v7 as uuidv7, version as uuidVersion } from 'uuid'
import type { ORSetEntry, ORSetSnapshot, ORSetState } from '../.types/index.js'
import { validateORSetSnapshot } from './validateORSetSnapshot/index.js'

export class ORSet<T> {
  private eventListeners: {
    snapshot: Set<(snapshot: ORSetSnapshot<T>) => void>
    remove: Set<(delta: ORSetSnapshot<T>) => void>
    append: Set<(delta: ORSetSnapshot<T>) => void>
  } = {
    snapshot: new Set(),
    remove: new Set(),
    append: new Set(),
  }
  private state: ORSetState<T>
  public size: number
  /***/
  constructor(snapshot?: ORSetSnapshot<T>) {
    this.size = 0
    this.state = { items: {}, tombs: new Set([]) }
    if (snapshot) {
      if (validateORSetSnapshot(snapshot)) {
        this.state.tombs = new Set(snapshot.tombs)
        for (const item of snapshot.items) {
          const v7 = item.__uuidv7
          if (!this.state.tombs.has(v7)) {
            this.state.items[v7] = Object.freeze(item)
            this.size++
          }
        }
      }
    }
  }
  /***/
  append(entry: ORSetEntry<T>): void {
    const v7 = uuidv7()
    entry.__uuidv7 = v7
    this.state.items[v7] = entry
    for (const listener of this.eventListeners.append) {
      listener({
        tombs: [],
        items: [entry],
      })
    }
  }
  /***/
  has(value: ORSetEntry<T>): boolean {
    if (this.state.tombs.has(value.__uuidv7)) {
      return false
    }
    return this.state.items.has(value)
  }
  /***/
  clear(): void {
    const egressTombs = []
    for (const v7 of Object.keys(this.state.items)) {
      this.state.tombs.add(v7)
      delete this.state.items[v7]
      egressTombs.push(v7)
    }
    for (const listener of this.eventListeners.remove) {
      listener({
        tombs: egressTombs,
        items: [],
      })
    }
  }
  /***/
  remove(entry: ORSetEntry<T>): void {
    const v7 = entry.__uuidv7
    this.state.tombs.add(v7)
    delete this.state.items[v7]
    for (const listener of this.eventListeners.remove) {
      listener({
        tombs: [v7],
        items: [],
      })
    }
  }
  /***/
  values(): Array<Readonly<ORSetEntry<T>>> {
    return Object.values(this.state.items)
  }
  /***/
  merge(ingress: ORSetSnapshot<T>) {
    const valid = validateORSetSnapshot(ingress)
    if (!valid) return

    for (const tomb of ingress.tombs) {
      if (typeof tomb !== 'string' || uuidVersion(tomb) !== 7) continue
      this.state.tombs.add(tomb)
      delete this.state.items[tomb]
    }
    const seen = new Set<string>()
    const items = new Set<ORSetEntry<T>>()

    for (const entry of ingress.items) {
      const v7 = entry.__uuidv7
      if (!this.state.tombs.has(v7) && !Object.hasOwn(this.state.items, v7)) {
        this.state.items[v7] = entry
      }
    }
  }
  /***/
  addEventListener() {}
  /***/
  removeEventListener() {}
}
