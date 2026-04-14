/** Enumerates explicit CR-Map error codes. */
export type CRMapErrorCode = 'BAD_SNAPSHOT'

/** Represents an explicit CR-Map error. */
export class CRMapError extends Error {
  readonly code: CRMapErrorCode

  /**
   * Creates a new CR-Map error.
   *
   * @param code - The semantic error code.
   * @param message - An optional human-readable detail.
   */
  constructor(code: CRMapErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/convergent-replicated-map} ${detail}`)
    this.code = code
    this.name = 'CRMapError'
  }
}
