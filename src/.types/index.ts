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
