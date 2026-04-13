import { transformSnapshotEntryToStateEntry } from '../../../.helpers/index.js'
import type { CRMapSnapshot, CRMapState } from '../../../.types/index.js'
export function create<T>(
  snapshot?: CRMapSnapshot<string, T>
): CRMapState<string, T> {
  const crMapReplica: CRMapState<string, T> = {
    values: new Map(),
    tombstones: new Set(),
  }
  if (Array.isArray(snapshot)) {
    for (const snapshotEntry of snapshot) {
      const stateEntry = transformSnapshotEntryToStateEntry<T>(snapshotEntry)
      if (!stateEntry) continue
      crMapReplica.values.set(stateEntry.value.key, stateEntry)
    }
  }
  return crMapReplica
}
