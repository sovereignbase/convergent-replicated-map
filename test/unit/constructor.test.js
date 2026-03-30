import assert from 'node:assert/strict'
import test from 'node:test'
import { ORSet } from '../../dist/index.js'
import {
  assertBadSnapshotError,
  createValidUuid,
  readSnapshot,
} from '../shared/orset.mjs'

test('constructor starts empty without snapshot', () => {
  const set = new ORSet()

  assert.equal(set.size, 0)
  assert.deepEqual(set.values(), [])
  assert.deepEqual(readSnapshot(set), { values: [], tombstones: [] })
})

test('constructor rejects explicit null snapshot', () => {
  assert.throws(() => new ORSet(null), assertBadSnapshotError)
})

test('constructor rejects explicit false snapshot', () => {
  assert.throws(() => new ORSet(false), assertBadSnapshotError)
})

test('constructor rejects snapshot missing values array', () => {
  assert.throws(() => new ORSet({ tombstones: [] }), assertBadSnapshotError)
})

test('constructor rejects snapshot missing tombstones array', () => {
  assert.throws(() => new ORSet({ values: [] }), assertBadSnapshotError)
})

test('constructor filters invalid tombstones, tombstoned values, duplicate live ids, and invalid values', () => {
  const liveId = createValidUuid('live')
  const removedId = createValidUuid('removed')

  const set = new ORSet({
    values: [
      { __uuidv7: liveId, name: 'first' },
      { __uuidv7: liveId, name: 'second' },
      { __uuidv7: removedId, name: 'removed' },
      { __uuidv7: 'bad', name: 'invalid' },
    ],
    tombstones: ['bad', removedId],
  })

  assert.equal(set.size, 1)
  assert.deepEqual(
    set.values().map((item) => item.name),
    ['first']
  )
  assert.deepEqual(readSnapshot(set).tombstones, [removedId])
})

test('constructor freezes accepted snapshot values', () => {
  const liveId = createValidUuid('live')

  const set = new ORSet({
    values: [{ __uuidv7: liveId, name: 'live' }],
    tombstones: [],
  })

  assert.equal(Object.isFrozen(set.values()[0]), true)
})

test('has returns true only for live uuids', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [live] = set.values()
  const missingId = createValidUuid('missing')

  assert.equal(set.has(live), true)
  assert.equal(set.has(live.__uuidv7), true)
  assert.equal(set.has({ __uuidv7: missingId, name: 'missing' }), false)
  assert.equal(set.has(missingId), false)
})

test('snapshot dispatches detached arrays', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const snapshot = readSnapshot(set)

  snapshot.values.push({ __uuidv7: createValidUuid('other'), name: 'other' })
  snapshot.tombstones.push(createValidUuid('ghost'))

  assert.equal(readSnapshot(set).values.length, 1)
  assert.equal(readSnapshot(set).tombstones.length, 0)
})
