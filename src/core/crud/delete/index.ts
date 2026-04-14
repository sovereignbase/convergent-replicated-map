import { CRMapChange, CRMapDelta, CRMapState } from '../../../.types/index.js'

export function __delete<T>(
  key: string,
  crMapReplica: CRMapState<string, T>
): { delta: CRMapDelta<string, T>; change: CRMapChange<string, T> } | false {
  if (typeof key !== 'string') return false

  let hasDelta: boolean
  let hasChange: boolean
  let out:
    | { delta: CRMapDelta<string, T>; change: CRMapChange<string, T> }
    | false = false
  const delta: CRMapDelta<string, T> = { tombstones: [] }
  const change: CRMapChange<string, T> = {}

  const entry = crMapReplica.values.get(key)
  if (!entry) return false

  crMapReplica.tombstones.add(entry.uuidv7)
  crMapReplica.values.delete(key)

  return out
}
