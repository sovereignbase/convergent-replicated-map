import { isUuidV7 } from '@sovereignbase/utils'
import type { CRMapAck, CRMapState } from '../../../.types/index.js'

/**
 * Removes tombstones that every provided frontier has acknowledged.
 *
 * The smallest valid acknowledgement is selected first. Tombstones at or below
 * that frontier are removed while preserving identifiers still referenced as
 * live predecessors.
 *
 * @param frontiers A collection of acknowledgement frontiers.
 * @param crMapReplica Replica to compact.
 */
export function __garbageCollect<T>(
  frontiers: Array<CRMapAck>,
  crMapReplica: CRMapState<string, T>
): void {
  if (!Array.isArray(frontiers) || frontiers.length < 1) return
  let smallest = ''
  for (const frontier of frontiers) {
    if (!isUuidV7(frontier)) continue
    if (smallest !== '' && smallest <= frontier) continue
    smallest = frontier
  }
  if (smallest === '') return

  crMapReplica.tombstones.forEach((tombstone, _, tombstones) => {
    if (tombstone > smallest || crMapReplica.predecessors.has(tombstone)) return
    tombstones.delete(tombstone)
  })
}
