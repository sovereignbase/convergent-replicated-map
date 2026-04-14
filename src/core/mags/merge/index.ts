import { isUuidV7, prototype } from '@sovereignbase/utils'
import type {
  CRMapDelta,
  CRMapChange,
  CRMapState,
} from '../../../.types/index.js'
import {
  transformSnapshotEntryToStateEntry,
  transformStateEntryToSnapshotEntry,
} from '../../../.helpers/index.js'

/**
 * Merges an incoming delta into the current replica.
 *
 * Accepted tombstones remove visible keys immediately. Value contenders for a
 * known key follow the same conflict model as `CRStruct`: same UUIDs can
 * advance via a larger predecessor, direct descendants win, and otherwise the
 * larger UUIDv7 wins. When local state already dominates an incoming contender,
 * the function emits a reply delta.
 *
 * @param crMapDelta Incoming partial snapshot projection.
 * @param crMapReplica Local replica state.
 * @returns The visible change projection and optional reply delta, or `false`
 * when the input is invalid or produces no effect.
 */
export function __merge<T>(
  crMapDelta: CRMapDelta<string, T>,
  crMapReplica: CRMapState<string, T>
): { change: CRMapChange<string, T>; delta: CRMapDelta<string, T> } | false {
  if (!crMapDelta || prototype(crMapDelta) !== 'record') return false

  const change: CRMapChange<string, T> = {}
  const delta: CRMapDelta<string, T> = {}
  let hasChange = false
  let hasDelta = false

  if (
    Object.hasOwn(crMapDelta, 'tombstones') &&
    Array.isArray(crMapDelta.tombstones)
  ) {
    for (const tombstone of crMapDelta.tombstones) {
      if (!isUuidV7(tombstone) || crMapReplica.tombstones.has(tombstone))
        continue
      crMapReplica.tombstones.add(tombstone)
      const live = crMapReplica.relations.get(tombstone)
      if (!live) continue
      const currentEntry = crMapReplica.values.get(live)
      if (!currentEntry || currentEntry.uuidv7 !== tombstone) {
        crMapReplica.relations.delete(tombstone)
        continue
      }
      crMapReplica.values.delete(live)
      crMapReplica.relations.delete(tombstone)
      crMapReplica.predecessors.delete(currentEntry.predecessor)
      change[live] = undefined
      hasChange = true
    }
  }

  if (!Object.hasOwn(crMapDelta, 'values') || !Array.isArray(crMapDelta.values))
    return hasChange ? { change, delta } : false

  for (const snapshotEntry of crMapDelta.values) {
    if (prototype(snapshotEntry) !== 'record') continue
    if (crMapReplica.tombstones.has(snapshotEntry.uuidv7)) continue
    const contender = transformSnapshotEntryToStateEntry<T>(snapshotEntry)
    if (!contender) continue

    const currentEntry = crMapReplica.values.get(contender.value.key)
    if (!currentEntry) {
      crMapReplica.values.set(contender.value.key, contender)
      crMapReplica.relations.set(contender.uuidv7, contender.value.key)
      crMapReplica.predecessors.add(contender.predecessor)
      crMapReplica.tombstones.add(contender.predecessor)
      change[contender.value.key] = structuredClone(contender.value.value)
      hasChange = true
      continue
    }

    if (currentEntry.uuidv7 === contender.uuidv7) {
      if (currentEntry.predecessor < contender.predecessor) {
        crMapReplica.predecessors.delete(currentEntry.predecessor)
        currentEntry.value = contender.value
        currentEntry.predecessor = contender.predecessor
        crMapReplica.predecessors.add(contender.predecessor)
        crMapReplica.tombstones.add(contender.predecessor)
        change[contender.value.key] = structuredClone(contender.value.value)
        hasChange = true
      } else if (
        currentEntry.predecessor === contender.predecessor &&
        JSON.stringify(currentEntry.value.value) ===
          JSON.stringify(contender.value.value)
      ) {
        continue
      } else {
        if (!delta.values) delta.values = []
        delta.values.push(transformStateEntryToSnapshotEntry(currentEntry))
        hasDelta = true
      }
      continue
    }

    if (
      currentEntry.uuidv7 === contender.predecessor ||
      crMapReplica.tombstones.has(currentEntry.uuidv7) ||
      contender.uuidv7 > currentEntry.uuidv7
    ) {
      crMapReplica.tombstones.add(contender.predecessor)
      crMapReplica.tombstones.add(currentEntry.uuidv7)
      crMapReplica.relations.delete(currentEntry.uuidv7)
      crMapReplica.predecessors.delete(currentEntry.predecessor)
      crMapReplica.values.set(contender.value.key, contender)
      crMapReplica.relations.set(contender.uuidv7, contender.value.key)
      crMapReplica.predecessors.add(contender.predecessor)
      change[contender.value.key] = structuredClone(contender.value.value)
      hasChange = true
      continue
    }

    crMapReplica.tombstones.add(contender.uuidv7)
    if (!delta.tombstones) delta.tombstones = []
    delta.tombstones.push(contender.uuidv7)
    if (!delta.values) delta.values = []
    delta.values.push(transformStateEntryToSnapshotEntry(currentEntry))
    hasDelta = true
  }

  if (!hasChange && !hasDelta) return false

  return { change, delta }
}
