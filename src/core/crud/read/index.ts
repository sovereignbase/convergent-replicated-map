import { CRMapState } from '../../../.types/index.js'

export function __read<T>(
  key: string,
  crMapReplica: CRMapState<string, T>
): T | undefined {
  return crMapReplica.values.get(key)?.value.value
}
