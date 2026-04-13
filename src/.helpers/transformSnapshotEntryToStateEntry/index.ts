import { prototype, isUuidV7, safeStructuredClone } from '@sovereignbase/utils'
import type { CRMapSnapshotEntry, CRMapStateEntry } from '../../.types/index.js'

export function transformSnapshotEntryToStateEntry<T>(
  snapshotEntry: CRMapSnapshotEntry<string, T>
): CRMapStateEntry<string, T> | false {
  if (
    prototype(snapshotEntry) !== 'record' ||
    !Object.hasOwn(snapshotEntry, 'value') ||
    !isUuidV7(snapshotEntry.uuidv7) ||
    !isUuidV7(snapshotEntry.predecessor) ||
    !Array.isArray(snapshotEntry.tombstones)
  )
    return false

  const { key, value } = snapshotEntry.value
  if (!key || typeof key !== 'string') return false
  const [cloned, copiedValue] = safeStructuredClone(value)
  if (!cloned) return false

  const tombstones = new Set<string>([])
  for (const tombstone of snapshotEntry.tombstones) {
    if (
      !isUuidV7(tombstone) ||
      tombstone ===
        snapshotEntry.uuidv7 /**if it was actually overwritten the current uuid would be different so this must be malicious*/
    )
      continue
    tombstones.add(tombstone)
  }

  if (!tombstones.has(snapshotEntry.predecessor)) return false

  return {
    uuidv7: snapshotEntry.uuidv7,
    value: { key, value: copiedValue },
    predecessor: snapshotEntry.predecessor,
    tombstones: tombstones,
  }
}
