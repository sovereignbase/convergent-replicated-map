export function validateORSetSnapshot<T>(ingress: T): boolean {
  if (ingress && typeof ingress === 'object') {
    const { items, tombs } = ingress as Record<string, any>
    return items && Array.isArray(items) && tombs && Array.isArray(tombs)
  }
  return false
}
