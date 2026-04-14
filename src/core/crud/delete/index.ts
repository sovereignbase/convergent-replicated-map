import type {
  CRMapChange,
  CRMapDelta,
  CRMapState,
} from '../../../.types/index.js'

/**
 * Deletes the current visible value for a key.
 *
 * The live entry is removed from the replica and its UUIDv7 is recorded as a
 * tombstone so the returned delta can be merged by peers. Internal helper
 * indexes are updated at the same time. Missing keys resolve to `false`
 * without mutating the replica.
 *
 * @param key Target key to delete.
 * @param crMapReplica Replica to mutate.
 * @returns A tombstone-only delta plus an empty visible change object, or
 * `false` when no deletion occurred.
 *
 * Time complexity: O(1), worst case O(1)
 * Space complexity: O(1)
 */
export function __delete<T>(
  key: string,
  crMapReplica: CRMapState<string, T>
): { delta: CRMapDelta<string, T>; change: CRMapChange<string, T> } | false {
  if (typeof key !== 'string') return false

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
