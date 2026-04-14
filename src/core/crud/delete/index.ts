import type {
  CRMapChange,
  CRMapDelta,
  CRMapState,
} from '../../../.types/index.js'

/**
 * Deletes one key or every live key from the replica.
 *
 * A keyed delete removes one visible entry. When no key is specified, every
 * live entry is removed. Removed UUIDv7 identifiers are recorded as tombstones
 * so the returned delta can be merged by peers. Internal helper indexes are
 * updated at the same time. Missing keys resolve to `false` without mutating
 * the replica.
 *
 * @param key Target key to delete.
 * @param crMapReplica Replica to mutate.
 * @returns A tombstone-only delta plus a visible delete projection, or `false`
 * when no deletion occurred.
 *
 * Time complexity: O(1) for keyed deletes, O(k) for full deletes
 * Space complexity: O(1) for keyed deletes, O(k) for full deletes
 */
export function __delete<T>(
  crMapReplica: CRMapState<string, T>,
  key?: string
): { delta: CRMapDelta<string, T>; change: CRMapChange<string, T> } | false
export function __delete<T>(
  key: string,
  crMapReplica: CRMapState<string, T>
): { delta: CRMapDelta<string, T>; change: CRMapChange<string, T> } | false
export function __delete<T>(
  keyOrReplica: string | CRMapState<string, T>,
  crMapReplicaOrKey?: CRMapState<string, T> | string
): { delta: CRMapDelta<string, T>; change: CRMapChange<string, T> } | false {
  const crMapReplica =
    typeof keyOrReplica === 'string'
      ? (crMapReplicaOrKey as CRMapState<string, T> | undefined)
      : keyOrReplica
  const key =
    typeof keyOrReplica === 'string'
      ? keyOrReplica
      : typeof crMapReplicaOrKey === 'string'
        ? crMapReplicaOrKey
        : undefined
  if (!crMapReplica) return false

  if (key !== undefined) {
    const entry = crMapReplica.values.get(key)
    if (!entry) return false

    crMapReplica.tombstones.add(entry.uuidv7)
    crMapReplica.values.delete(key)
    crMapReplica.relations.delete(entry.uuidv7)
    crMapReplica.predecessors.delete(entry.predecessor)
    const delta: CRMapDelta<string, T> = {
      tombstones: [entry.uuidv7],
    }
    const change: CRMapChange<string, T> = { [key]: undefined }
    return { delta, change }
  }

  if (crMapReplica.values.size === 0) return false

  const delta: CRMapDelta<string, T> = { tombstones: [] }
  const change: CRMapChange<string, T> = {}
  for (const [liveKey, entry] of crMapReplica.values.entries()) {
    crMapReplica.tombstones.add(entry.uuidv7)
    delta.tombstones!.push(entry.uuidv7)
    change[liveKey] = undefined
  }
  crMapReplica.values.clear()
  crMapReplica.relations.clear()
  crMapReplica.predecessors.clear()

  return { delta, change }
}
