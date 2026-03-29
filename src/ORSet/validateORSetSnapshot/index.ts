export function validateORSetSnapshot<T>(ingress: T): boolean {
  if (ingress && typeof ingress === 'object') {
    const { values, tombstones } = ingress as Record<string, any>
    return (
      values && Array.isArray(values) && tombstones && Array.isArray(tombstones)
    )
  }
  return false
}
