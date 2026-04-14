import type { CRMapAck, CRMapState } from '../../../.types/index.js'

export function __acknowledge<T>(
  crMapReplica: CRMapState<string, T>
): CRMapAck {
  let largest: CRMapAck = ''
  for (const tombstone of crMapReplica.tombstones.values()) {
    if (largest === '') {
      largest = tombstone
      continue
    }

    if (tombstone < largest) continue

    largest = tombstone
  }
  return largest
}
