import { isUuidV7, prototype } from '@sovereignbase/utils'
import { transformSnapshotEntryToStateEntry } from '../../../.helpers/index.js'
import type { CRMapSnapshot, CRMapState } from '../../../.types/index.js'

/**
 * Creates a local CRMap replica from an optional snapshot.
 *
 * Invalid snapshot records are ignored. Accepted tombstones are materialized
 * first, then live entries are cloned into the replica. Duplicate key
 * contenders use a minimal deterministic tie-break: a direct descendant wins,
 * the same UUID can advance with a larger predecessor, and otherwise the larger
 * UUIDv7 wins.
 *
 * @param snapshot Optional serialized CRMap state.
 * @returns A hydrated CRMap replica.
 *
 * Time complexity: O(v + t + c), worst case O(v + t + c)
 * - v = snapshot value entry count
 * - t = snapshot tombstone count
 * - c = cloned value payload size across accepted entries
 *
 * Space complexity: O(v + t + c)
 */
export function __create<T>(
  snapshot?: CRMapSnapshot<string, T>
): CRMapState<string, T> {
  const crMapReplica: CRMapState<string, T> = {
    values: new Map(),
    relations: new Map(),
    tombstones: new Set(),
    predecessors: new Set(),
  }
  if (!snapshot || prototype(snapshot) !== 'record') return crMapReplica

  if (
    Object.hasOwn(snapshot, 'tombstones') &&
    Array.isArray(snapshot.tombstones)
  ) {
    for (const tombstone of snapshot.tombstones) {
      if (!isUuidV7(tombstone) || crMapReplica.tombstones.has(tombstone))
        continue
      crMapReplica.tombstones.add(tombstone)
    }
  }

  if (!Object.hasOwn(snapshot, 'values') || !Array.isArray(snapshot.values))
    return crMapReplica

  for (const snapshotEntry of snapshot.values) {
    if (prototype(snapshotEntry) !== 'record') continue
    if (crMapReplica.tombstones.has(snapshotEntry.uuidv7)) continue
    const stateEntry = transformSnapshotEntryToStateEntry<T>(snapshotEntry)
    if (!stateEntry) continue

    const currentEntry = crMapReplica.values.get(stateEntry.value.key)
    if (
      currentEntry &&
      currentEntry.uuidv7 === stateEntry.uuidv7 &&
      currentEntry.predecessor >= stateEntry.predecessor
    )
      continue
    if (
      currentEntry &&
      currentEntry.uuidv7 !== stateEntry.uuidv7 &&
      currentEntry.uuidv7 !== stateEntry.predecessor &&
      currentEntry.uuidv7 >= stateEntry.uuidv7
    )
      continue
    if (currentEntry) {
      crMapReplica.relations.delete(currentEntry.uuidv7)
      crMapReplica.predecessors.delete(currentEntry.predecessor)
    }
    crMapReplica.relations.set(stateEntry.uuidv7, stateEntry.value.key)
    crMapReplica.values.set(stateEntry.value.key, stateEntry)
    crMapReplica.predecessors.add(stateEntry.predecessor)
  }
  return crMapReplica
}
