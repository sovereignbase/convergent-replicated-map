import assert from 'node:assert/strict'
import test from 'node:test'
import { ORSet } from '../../dist/index.js'
import {
  assertBadSnapshotError,
  captureEvents,
  createValidUuid,
  readSnapshot,
  sortStrings,
} from '../shared/orset.mjs'

test('merge rejects malformed snapshots', () => {
  const set = new ORSet()

  assert.throws(() => set.merge(null), assertBadSnapshotError)
})

test('merge imports live additions and emits merge', () => {
  const source = new ORSet()
  source.append({ name: 'alice' })
  const [live] = source.values()
  const target = new ORSet()
  const { events } = captureEvents(target)

  target.merge(readSnapshot(source))

  assert.equal(target.size, 1)
  assert.equal(target.values()[0].__uuidv7, live.__uuidv7)
  assert.equal(events.merge.length, 1)
  assert.equal(events.snapshot.length, 0)
  assert.deepEqual(events.merge[0].removals, [])
  assert.deepEqual(events.merge[0].additions, [live])
})

test('merge removes live values from tombstones and decrements size', () => {
  const removableId = createValidUuid('removable')
  const target = new ORSet({
    values: [{ __uuidv7: removableId, name: 'removable' }],
    tombstones: [],
  })
  const { events } = captureEvents(target)

  target.merge({ values: [], tombstones: [removableId] })

  assert.equal(target.size, 0)
  assert.deepEqual(readSnapshot(target).tombstones, [removableId])
  assert.equal(events.merge.length, 1)
  assert.deepEqual(events.merge[0].removals, [removableId])
  assert.deepEqual(events.merge[0].additions, [])
})

test('merge records causal tombstones without a local live value', () => {
  const target = new ORSet()
  const ghostId = createValidUuid('ghost')
  const { events } = captureEvents(target)

  target.merge({ values: [], tombstones: [ghostId] })

  assert.equal(target.size, 0)
  assert.deepEqual(readSnapshot(target).tombstones, [ghostId])
  assert.equal(events.merge.length, 1)
  assert.deepEqual(events.merge[0].removals, [ghostId])
})

test('merge skips invalid tombstones and invalid values', () => {
  const target = new ORSet()
  const { events } = captureEvents(target)

  target.merge({
    values: [{ __uuidv7: 'bad', name: 'invalid' }],
    tombstones: ['bad'],
  })

  assert.equal(target.size, 0)
  assert.equal(events.merge.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('merge ignores live duplicates already present locally', () => {
  const target = new ORSet()
  target.append({ name: 'alice' })
  const [live] = target.values()
  const { events } = captureEvents(target)

  target.merge({ values: [live], tombstones: [] })

  assert.equal(target.size, 1)
  assert.equal(events.merge.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('merge never resurrects tombstoned uuid from ingress values', () => {
  const tombedId = createValidUuid('tombed')
  const target = new ORSet({ values: [], tombstones: [tombedId] })
  const { events } = captureEvents(target)

  target.merge({
    values: [{ __uuidv7: tombedId, name: 'zombie' }],
    tombstones: [],
  })

  assert.equal(target.size, 0)
  assert.equal(events.merge.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('merge applies tombstones before a conflicting ingress value with the same uuid', () => {
  const conflictId = createValidUuid('conflict')
  const target = new ORSet({
    values: [{ __uuidv7: conflictId, name: 'live' }],
    tombstones: [],
  })
  const { events } = captureEvents(target)

  target.merge({
    values: [{ __uuidv7: conflictId, name: 'resurrected' }],
    tombstones: [conflictId],
  })

  assert.equal(target.size, 0)
  assert.equal(events.merge.length, 1)
  assert.deepEqual(events.merge[0].removals, [conflictId])
  assert.deepEqual(events.merge[0].additions, [])
})

test('merge can add and remove in the same operation', () => {
  const removedId = createValidUuid('removed')
  const source = new ORSet()
  source.append({ name: 'added' })
  const [added] = source.values()
  const target = new ORSet({
    values: [{ __uuidv7: removedId, name: 'removed' }],
    tombstones: [],
  })
  const { events } = captureEvents(target)

  target.merge({
    values: [added],
    tombstones: [removedId],
  })

  assert.equal(target.size, 1)
  assert.equal(target.values()[0].__uuidv7, added.__uuidv7)
  assert.equal(events.merge.length, 1)
  assert.deepEqual(events.merge[0].removals, [removedId])
  assert.deepEqual(
    events.merge[0].additions.map((item) => item.__uuidv7),
    [added.__uuidv7]
  )
})

test('merge stays silent on no-op snapshots', () => {
  const target = new ORSet()
  const knownTomb = createValidUuid('known-tomb')
  target.merge({ values: [], tombstones: [knownTomb] })
  const { events } = captureEvents(target)

  target.merge({
    values: [{ __uuidv7: 'bad', name: 'invalid' }],
    tombstones: ['bad', knownTomb],
  })

  assert.equal(events.merge.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('replicas converge after append remove and merge roundtrip', () => {
  const a = new ORSet()
  const b = new ORSet()

  a.append({ name: 'alice' })
  a.append({ name: 'bob' })
  b.merge(readSnapshot(a))

  const alice = a.values().find((item) => item.name === 'alice')
  a.remove(alice)
  b.merge(readSnapshot(a))
  a.merge(readSnapshot(b))

  assert.equal(a.size, b.size)
  assert.deepEqual(
    sortStrings(readSnapshot(a).values.map((value) => value.__uuidv7)),
    sortStrings(readSnapshot(b).values.map((value) => value.__uuidv7))
  )
  assert.deepEqual(
    sortStrings(readSnapshot(a).tombstones),
    sortStrings(readSnapshot(b).tombstones)
  )
})
