import { isUuidV7, prototype } from '@sovereignbase/utils'
import { transformSnapshotEntryToStateEntry } from '../../../.helpers/index.js'
import type { CRMapSnapshot, CRMapState } from '../../../.types/index.js'
export function __create<T>(
  snapshot?: CRMapSnapshot<string, T>
): CRMapState<string, T> {
  const crMapReplica: CRMapState<string, T> = {
    values: new Map(),
    tombstones: new Set(),
  }
  if (
    snapshot &&
    prototype(snapshot) === 'record' &&
    Object.hasOwn(snapshot, 'values') &&
    Object.hasOwn(snapshot, 'tombstones')
  ) {
    if (Array.isArray(snapshot.tombstones)) {
      for (const tombstone of snapshot.tombstones) {
        if (!isUuidV7(tombstone) || crMapReplica.tombstones.has(tombstone))
          continue
        crMapReplica.tombstones.add(tombstone)
      }
    }
    if (Array.isArray(snapshot.values)) {
      for (const snapshotEntry of snapshot.values) {
        if (crMapReplica.tombstones.has(snapshotEntry.uuidv7)) continue
        if (crMapReplica.values.has(snapshotEntry.value.key)) {
          /**TODO add merge conflict resolution logic */
          continue
        }
        const stateEntry = transformSnapshotEntryToStateEntry<T>(snapshotEntry)
        if (!stateEntry) continue
        crMapReplica.values.set(stateEntry.value.key, stateEntry)
      }
    }
  }
  return crMapReplica
}
