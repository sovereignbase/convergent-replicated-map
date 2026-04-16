/**
 * Internal replica state.
 */

/**
 * Represents one visible replica entry for a map key.
 */
export type CRMapStateEntry<K extends string, V> = {
  uuidv7: string
  value: { key: K; value: V }
  predecessor: string
}

/**
 * Represents the internal state of a CR-Map replica.
 */
export type CRMapState<K extends string, V> = {
  values: Map<K, CRMapStateEntry<K, V>>
  relations: Map<string, K>
  tombstones: Set<string>
  predecessors: Set<string>
}

/**
 * Serialized replica state.
 */

/**
 * Represents one serialized visible map entry.
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

/**
 * Visible replica projections.
 */

/**
 * Represents visible key-value changes from a local operation or merge.
 */
export type CRMapChange<K extends string, V> = Record<K, V | undefined>

/**
 * Partial serialized state exchanged between replicas.
 */

/**
 * Represents a partial serialized replica projection exchanged between replicas.
 */
export type CRMapDelta<K extends string, V> = Partial<CRMapSnapshot<K, V>>

/**
 * Acknowledgement frontier.
 */

/**
 * Represents the current acknowledgement frontier emitted by a replica.
 */
export type CRMapAck = string

/**
 * Maps event names to their payload shapes.
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
 * Represents a strongly typed CR-Map event listener.
 */
export type CRMapEventListener<T, K extends keyof CRMapEventMap<string, T>> =
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
