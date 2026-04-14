import { isUuidV7 } from '@sovereignbase/utils'
import type { CRMapAck, CRMapState } from '../../../.types/index.js'

/**
 * Emits the current acknowledgement frontier for the replica.
 *
 * The frontier is the largest valid tombstone identifier currently retained by
 * the replica. Empty replicas acknowledge `''`.
 *
 * @param crMapReplica Replica to summarize.
 * @returns The largest retained tombstone identifier, or `''` when none exist.
 */
export function __acknowledge<T>(
  crMapReplica: CRMapState<string, T>
): CRMapAck {
  let largest: CRMapAck = ''
  for (const tombstone of crMapReplica.tombstones.values()) {
    if (!isUuidV7(tombstone) || tombstone < largest) continue
    largest = tombstone
  }
  return largest
}
