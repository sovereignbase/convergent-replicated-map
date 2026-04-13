import { prototype, isUuidV7, safeStructuredClone } from '@sovereignbase/utils'
import type { CRMapSnapshotEntry, CRMapStateEntry } from '../../.types/index.js'

export function transformStateEntryToSnapshotEntry<T>(
  stateEntry: CRMapStateEntry<string, T>
): CRMapSnapshotEntry<string, T> {
  return {
    uuidv7: stateEntry.uuidv7,
    value: {
      key: stateEntry.value.key,
      value: structuredClone(stateEntry.value.value),
    },
    predecessor: stateEntry.predecessor,
  }
}
