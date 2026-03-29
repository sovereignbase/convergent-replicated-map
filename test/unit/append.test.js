import assert from 'node:assert/strict'
import test from 'node:test'
import { ORSet } from '../../dist/index.js'
import {
  captureEvents,
  createValidUuid,
  readSnapshot,
  sortStrings,
} from '../shared/orset.mjs'

test('append assigns uuid, freezes stored value, and emits delta', () => {
  const set = new ORSet()
  const { events } = captureEvents(set)

  set.append({ name: 'alice' })

  const [stored] = set.values()

  assert.equal(set.size, 1)
  assert.equal(typeof stored.__uuidv7, 'string')
  assert.equal(stored.name, 'alice')
  assert.equal(Object.isFrozen(stored), true)
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 0)
  assert.deepEqual(events.delta[0].tombstones, [])
  assert.equal(events.delta[0].values[0].__uuidv7, stored.__uuidv7)
})

test('append preserves a valid supplied free uuid and object identity', () => {
  const set = new ORSet()
  const v7 = createValidUuid('seed')
  const value = { __uuidv7: v7, name: 'manual' }

  set.append(value)

  assert.equal(set.size, 1)
  assert.equal(set.values()[0], value)
  assert.equal(set.values()[0].__uuidv7, v7)
  assert.equal(Object.isFrozen(value), true)
})

test('append ignores duplicate live uuid and emits nothing', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [stored] = set.values()
  const { events } = captureEvents(set)

  set.append(stored)

  assert.equal(set.size, 1)
  assert.equal(events.delta.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('append regenerates invalid supplied uuid', () => {
  const set = new ORSet()

  set.append({ __uuidv7: 'bad', name: 'alice' })

  assert.equal(set.size, 1)
  assert.notEqual(set.values()[0].__uuidv7, 'bad')
})

test('append regenerates tombstoned supplied uuid', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [removed] = set.values()
  set.remove(removed)

  set.append({ __uuidv7: removed.__uuidv7, name: 'bob' })

  assert.equal(set.size, 1)
  assert.notEqual(set.values()[0].__uuidv7, removed.__uuidv7)
})

test('append keeps live values in insertion order', () => {
  const set = new ORSet()

  set.append({ name: 'alice' })
  set.append({ name: 'bob' })
  set.append({ name: 'carol' })

  assert.deepEqual(
    set.values().map((item) => item.name),
    ['alice', 'bob', 'carol']
  )
  assert.deepEqual(
    readSnapshot(set).values.map((value) => value.name),
    ['alice', 'bob', 'carol']
  )
})
