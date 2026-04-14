import { isUuidV7 } from '@sovereignbase/utils'
import type {
  CRMapState,
  CRMapDelta,
  CRMapChange,
} from '../../../.types/index.js'
import { transformSnapshotEntryToStateEntry } from '../../../.helpers/index.js'

export function __merge<T>(
  crMapDelta: CRMapDelta<string, T>,
  crMapReplica: CRMapState<string, T>
) {
  const change: CRMapChange<string, T> = {}

  if (
    Object.hasOwn(crMapDelta, 'tombstones') &&
    Array.isArray(crMapDelta.tombstones)
  ) {
    for (const tombstone of crMapDelta.tombstones) {
      if (!isUuidV7(tombstone) || crMapReplica.tombstones.has(tombstone))
        continue
      crMapReplica.tombstones.add(tombstone)
      const live = crMapReplica.relations.get(tombstone)
      if (live) {
        crMapReplica.values.delete(live)
        crMapReplica.relations.delete(tombstone)
      }
    }
  }

  if (!Object.hasOwn(crMapDelta, 'values') || !Array.isArray(crMapDelta.values))
    return crMapReplica

  for (const snapshotEntry of crMapDelta.values) {
    if (crMapReplica.tombstones.has(snapshotEntry.uuidv7)) continue
    const stateEntry = transformSnapshotEntryToStateEntry<T>(snapshotEntry)
    if (!stateEntry) continue

    const currentEntry = crMapReplica.values.get(stateEntry.value.key)
    if (currentEntry && currentEntry.uuidv7 >= stateEntry.uuidv7) continue

    crMapReplica.values.set(stateEntry.value.key, stateEntry)
    crMapReplica.relations.set(stateEntry.uuidv7, stateEntry.value.key)
  }
  return crMapReplica
}
