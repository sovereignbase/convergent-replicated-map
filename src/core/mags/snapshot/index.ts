import { transformStateEntryToSnapshotEntry } from '../../../.helpers/index.js'
import type { CRMapSnapshot, CRMapState } from '../../../.types/index.js'

/**
 * Serializes the current replica state into a snapshot projection.
 *
 * Each visible entry is converted to its serializable form and all retained
 * tombstones are emitted.
 *
 * @param crMapReplica Replica to serialize.
 * @returns A full snapshot suitable for hydration or transport.
 */
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
