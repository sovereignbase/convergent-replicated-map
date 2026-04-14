import { transformStateEntryToSnapshotEntry } from '../../../.helpers/index.js'
import { CRMapSnapshot, CRMapState } from '../../../.types/index.js'

export function __snapshot<T>(
  crMapReplica: CRMapState<string, T>
): CRMapSnapshot<string, T> {
  const out: CRMapSnapshot<string, T> = {
    values: [],
    tombstones: Array.from(crMapReplica.tombstones),
  }
  for (const stateEntry of crMapReplica.values.values()) {
    out.values.push(transformStateEntryToSnapshotEntry(stateEntry))
  }
  return out
}
