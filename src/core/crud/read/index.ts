import type { CRMapState } from '../../../.types/index.js'

/**
 * Reads the current visible value for a key.
 *
 * Successful reads return a detached structured clone of the stored value, so
 * mutating the returned object does not mutate the replica. Missing keys
 * resolve to `undefined`.
 *
 * @param key Target key in the live map.
 * @param crMapReplica Replica to read from.
 * @returns A detached copy of the current value, or `undefined` when the key
 * is absent.
 *
 * Time complexity: O(c), worst case O(c)
 * - c = cloned value payload size
 *
 * Space complexity: O(c)
 */
export function __read<T>(
  key: string,
  crMapReplica: CRMapState<string, T>
): T | undefined {
  return structuredClone(crMapReplica.values.get(key)?.value.value)
}
