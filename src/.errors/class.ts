/**
 * Error codes thrown by {@link CRMap}.
 */
export type CRMapErrorCode = 'INVALID_KEY' | 'VALUE_NOT_CLONEABLE'

/**
 * Represents a typed CRMap runtime error.
 */
export class CRMapError extends Error {
  /**
   * The semantic error code for the failure.
   */
  readonly code: CRMapErrorCode

  /**
   * Creates a typed CRMap error.
   *
   * @param code - The semantic error code.
   * @param message - An optional human-readable detail message.
   */
  constructor(code: CRMapErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/convergent-replicated-map} ${detail}`)
    this.code = code
    this.name = 'CRMapError'
  }
}
