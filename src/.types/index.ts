export type ORSetEntry<T> = { __uuidv7: string } & T
export type ORSetState<T> = {
  items: Record<string, Readonly<ORSetEntry<T>>>
  tombs: Set<string>
}
export type ORSetSnapshot<T> = {
  items: Array<ORSetEntry<T>>
  tombs: Array<string>
}
export type ORSetMergeResult<T> = {
  removals: Array<string>
  additions: Array<ORSetEntry<T>>
}

export type ORSetEventMap<T> = {
  snapshot: ORSetSnapshot<T>
  delta: ORSetSnapshot<T>
  merge: ORSetMergeResult<T>
}

export type ORSetEventListener<
  T,
  K extends keyof ORSetEventMap<T>,
> =
  | ((event: CustomEvent<ORSetEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<ORSetEventMap<T>[K]>): void }

export type ORSetEventListenerFor<T, K extends string> =
  K extends keyof ORSetEventMap<T>
    ? ORSetEventListener<T, K>
    : EventListenerOrEventListenerObject
