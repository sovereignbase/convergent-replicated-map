export type ORSetValue<T> = Omit<T, '__uuidv7'> & { __uuidv7: string }
export type ORSetAppendInput<T> = Omit<ORSetValue<T>, '__uuidv7'> &
  Partial<Pick<ORSetValue<T>, '__uuidv7'>>
export type ORSetState<T> = {
  values: Record<string, Readonly<ORSetValue<T>>>
  tombstones: Set<string>
}
export type ORSetSnapshot<T> = {
  values: Array<Readonly<ORSetValue<T>>>
  tombstones: Array<string>
}
export type ORSetMergeResult<T> = {
  removals: Array<string>
  additions: Array<Readonly<ORSetValue<T>>>
}

export type ORSetEventMap<T> = {
  snapshot: ORSetSnapshot<T>
  delta: ORSetSnapshot<T>
  merge: ORSetMergeResult<T>
}

export type ORSetEventListener<T, K extends keyof ORSetEventMap<T>> =
  | ((event: CustomEvent<ORSetEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<ORSetEventMap<T>[K]>): void }

export type ORSetEventListenerFor<
  T,
  K extends string,
> = K extends keyof ORSetEventMap<T>
  ? ORSetEventListener<T, K>
  : EventListenerOrEventListenerObject
