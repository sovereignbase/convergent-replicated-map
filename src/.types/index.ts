/**Replica State*/

/**
 * Represents the internal replicated state for a single field.
 */
export type CRMapStateEntry<K extends string, V> = {
  uuidv7: string
  value: { key: K; value: V }
  predecessor: string
}

/**
 * Represents the internal replicated state of an CR-Map replica.
 */
export type CRMapState<K extends string, V> = {
  values: Map<K, CRMapStateEntry<K, V>>
  relations: Map<string, K>
  tombstones: Set<string>
  predecessors: Set<string>
}

/**Serlialized projection of replica state*/

/**
 * Represents the serialized state for a single field.
 */
export type CRMapSnapshotEntry<K, V> = {
  uuidv7: string
  value: { key: K; value: V }
  predecessor: string
}

/**
 * Represents a serialized snapshot of the full replica state.
 */
export type CRMapSnapshot<K extends string, V> = {
  values: Array<CRMapSnapshotEntry<K, V>>
  tombstones: Array<string>
}

/**Resolved projection of replica state*/

/**
 * Represents visible field values that changed during a local operation or merge.
 */
export type CRMapChange<K extends string, V> = Record<K, V | undefined>
/**(T)*/

/**Partial changes to gossip*/

/**
 * Represents a partial serialized state projection exchanged between replicas.
 */
export type CRMapDelta<K extends string, V> = Partial<CRMapSnapshot<K, V>>

/**A "report" on what the replica has seen*/

/**
 * Represents the current acknowledgement frontier emitted by a replica.
 */
export type CRMapAck = string

/***/

/**
 * Maps OO-Struct event names to their event payload shapes.
 */
export type CRMapEventMap<K extends string, V> = {
  /** STATE / PROJECTION */
  snapshot: CRMapSnapshot<K, V>
  change: CRMapChange<K, V>

  /** GOSSIP / PROTOCOL */
  delta: CRMapDelta<K, V>
  ack: CRMapAck
}

/**
 * Represents a strongly typed OO-Struct event listener.
 */
export type CRMapEventListener<
  T,
  K extends keyof CRMapEventMap<string, T>,
> =
  | ((event: CustomEvent<CRMapEventMap<string, T>[K]>) => void)
  | { handleEvent(event: CustomEvent<CRMapEventMap<string, T>[K]>): void }

/**
 * Resolves an event name to its corresponding listener type.
 */
export type CRMapEventListenerFor<
  T,
  K extends string,
> = K extends keyof CRMapEventMap<string, T>
  ? CRMapEventListener<T, K>
  : EventListenerOrEventListenerObject
