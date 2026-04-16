import { safeStructuredClone } from '@sovereignbase/utils'
import type {
  CRMapChange,
  CRMapDelta,
  CRMapState,
} from '../../../.types/index.js'
import { CRMapError } from '../../../.errors/class.js'
import { v7 as uuidv7 } from 'uuid'

/**
 * Overwrites the current visible value for a key and emits the resulting delta.
 *
 * The incoming value is cloned first, then written as the new winning state
 * entry for `key`. The predecessor entry is tombstoned so the returned delta is
 * ready for gossip. Internal helper indexes are updated to keep merge and
 * garbage collection logic coherent.
 *
 * @param key Target key to overwrite.
 * @param value Next visible value for the key.
 * @param crMapReplica Replica to mutate.
 * @returns The local visible change and serialized delta.
 *
 * @throws {CRMapError} Thrown when the key is not a non-empty string.
 * @throws {CRMapError} Thrown when the value is not supported by `structuredClone`.
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
  if (typeof key !== 'string' || key.length === 0)
    throw new CRMapError('INVALID_KEY', 'Map keys must be non-empty strings.')

  const [cloned, copiedValue] = safeStructuredClone(value)
  if (!cloned)
    throw new CRMapError(
      'VALUE_NOT_CLONEABLE',
      'Updated values must be supported by structuredClone.'
    )

  const oldEntry = crMapReplica.values.get(key)
  const predecessor = oldEntry ? oldEntry.uuidv7 : uuidv7()
  const entry = {
    uuidv7: uuidv7(),
    value: { key, value: copiedValue },
    predecessor,
  }
  if (oldEntry) {
    crMapReplica.relations.delete(oldEntry.uuidv7)
    crMapReplica.predecessors.delete(oldEntry.predecessor)
  }
  crMapReplica.values.set(key, entry)
  crMapReplica.relations.set(entry.uuidv7, key)
  crMapReplica.predecessors.add(predecessor)
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
