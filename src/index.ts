/**
 * The CR-Struct replica implementation.
 */
export { CRMap } from './CRMap/class.js'

/**
 * The public CR-Struct error class and code union.
 */
export { CRMapError, type CRMapErrorCode } from './.errors/class.js'

/**
 * Public CR-Struct types.
 */
export type {
  CRMapEventMap,
  CRMapEventListener,
  CRMapEventListenerFor,
  /***/
  CRMapState,
  CRMapStateEntry,
  /***/
  CRMapSnapshot,
  CRMapSnapshotEntry,
  /***/
  CRMapChange,
  /***/
  CRMapDelta,
  CRMapAck,
} from './.types/index.js'

/**
 * Public advanced exports, CR-Struct primitives.
 */
export { __create, __read, __update, __delete } from './core/crud/index.js'
export {
  __merge,
  __acknowledge,
  __garbageCollect,
  __snapshot,
} from './core/mags/index.js'
