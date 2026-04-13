/** Enumerates explicit OR-Set error codes. */
export type CRMapErrorCode = 'BAD_SNAPSHOT'

/** Represents an explicit OR-Set error. */
export class CRMapError extends Error {
  readonly code: CRMapErrorCode

  /**
   * Creates a new OR-Set error.
   *
   * @param code - The semantic error code.
   * @param message - An optional human-readable detail.
   */
  constructor(code: CRMapErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/observed-remove-set} ${detail}`)
    this.code = code
    this.name = 'CRMapError'
  }
}
