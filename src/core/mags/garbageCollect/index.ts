import { CRMapAck, CRMapState } from '../../../.types/index.js'

export function __garbageCollect<T>(
  frontiers: Array<CRMapAck>,
  crMapReplica: CRMapState<string, T>
): void {
  frontiers.sort((a, b) => (a > b ? 1 : -1))
  const smallest = frontiers[0]
  crMapReplica.tombstones.forEach((tombstone, _, tombstones) => {
    if (tombstone < smallest && !crMapReplica.predecessors.has(tombstone)) {
      tombstones.delete(tombstone)
    }
  })
}
