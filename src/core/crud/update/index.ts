import { safeStructuredClone } from '@sovereignbase/utils'
import type {
  CRMapChange,
  CRMapDelta,
  CRMapState,
} from '../../../.types/index.js'
import { v7 as uuidv7 } from 'uuid'

/**
 * Overwrites the current visible value for a key and emits the resulting delta.
 *
 * The incoming value is cloned first, then written as the new winning state
 * entry for `key`. The predecessor entry is tombstoned so the returned delta is
 * ready for gossip.
 *
 * @param key Target key to overwrite.
 * @param value Next visible value for the key.
 * @param crMapReplica Replica to mutate.
 * @returns The local visible change and serialized delta, or `false` when the
 * key is invalid or the value cannot be cloned.
 *
 * Time complexity: O(c), worst case O(c)
 * - c = cloned value payload size
 *
 * Space complexity: O(c)
 */
export function __update<T>(
  key: string,
  value: T,
  crMapReplica: CRMapState<string, T>
): { delta: CRMapDelta<string, T>; change: CRMapChange<string, T> } | false {
  if (typeof key !== 'string') return false

  const [cloned, copiedValue] = safeStructuredClone(value)
  if (!cloned) return false

  const oldEntry = crMapReplica.values.get(key)
  const predecessor = oldEntry ? oldEntry.uuidv7 : uuidv7()
  const entry = {
    uuidv7: uuidv7(),
    value: { key, value: copiedValue },
    predecessor,
  }
  crMapReplica.values.set(key, entry)
  crMapReplica.tombstones.add(predecessor)
  const delta: CRMapDelta<string, T> = {
    values: [
      {
        uuidv7: entry.uuidv7,
        value: { key, value: copiedValue },
        predecessor,
      },
    ],
    tombstones: [predecessor],
  }
  const change: CRMapChange<string, T> = {}
  change[key] = structuredClone(copiedValue) //detached

  return { delta, change }
}
