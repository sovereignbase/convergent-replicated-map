import { safeStructuredClone } from '@sovereignbase/utils'
import { CRMapState, CRMapDelta, CRMapChange } from '../../../.types/index.js'
import { v7 as uuidv7 } from 'uuid'

export function __update<T>(
  key: string,
  value: T,
  crMapReplica: CRMapState<string, T>
): { delta: CRMapDelta<string, T>; change: CRMapChange<string, T> } | false {
  const delta: CRMapDelta<string, T> = { values: [], tombstones: [] }
  const change: CRMapChange<string, T> = {}
  if (typeof key !== 'string') return false

  const [cloned, copiedValue] = safeStructuredClone(value)
  if (!cloned) return false

  const oldEntry = crMapReplica.values.get(key)

  const predecessor = oldEntry ? oldEntry.uuidv7 : uuidv7()
  const newUuidv7 = uuidv7()

  const entry = {
    uuidv7: newUuidv7,
    value: { key: key, value: copiedValue },
    predecessor: predecessor,
  }

  crMapReplica.values.set(key, entry)
  delta.values?.push(entry)
  crMapReplica.tombstones.add(predecessor)
  delta.tombstones?.push(predecessor)

  change[key] = copiedValue

  return {
    delta,
    change,
  }
}
