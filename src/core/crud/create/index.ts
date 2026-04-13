import { transformSnapshotEntryToStateEntry } from '../../../.helpers/index.js'
import type { CRMapSnapshot, CRMapState } from '../../../.types/index.js'
export function create<T>(
  snapshot?: CRMapSnapshot<string, T>
): CRMapState<string, T> {
  const crMapReplica: CRMapState<string, T> = new Map()
  if (Array.isArray(snapshot)) {
    for (const snapshotEntry of snapshot) {
      const stateEntry = transformSnapshotEntryToStateEntry(snapshotEntry)
      if (!stateEntry) continue
      crMapReplica.set(stateEntry.value.key, stateEntry)
    }
  }
  return crMapReplica
}
