import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { ORSet as ORSetEsm } from '../../dist/index.js'
import { readSnapshot, sortStrings } from '../shared/orset.mjs'

const require = createRequire(import.meta.url)
const { ORSet: ORSetCjs } = require('../../dist/index.cjs')

test('replicas converge after interleaved append remove and merge operations', () => {
  const a = new ORSetEsm()
  const b = new ORSetCjs()

  a.append({ name: 'alice' })
  a.append({ name: 'bob' })
  b.merge(readSnapshot(a))
  b.append({ name: 'carol' })
  a.merge(readSnapshot(b))

  const alice = a.values().find((item) => item.name === 'alice')
  const carol = b.values().find((item) => item.name === 'carol')
  a.remove(alice)
  b.remove(carol)
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

test('cjs build consumes tomb only snapshots from esm replica', () => {
  const esm = new ORSetEsm()
  const cjs = new ORSetCjs()

  esm.append({ name: 'alice' })
  const [alice] = esm.values()
  esm.remove(alice)
  cjs.merge(readSnapshot(esm))

  assert.equal(cjs.size, 0)
  assert.deepEqual(readSnapshot(cjs).values, [])
  assert.deepEqual(readSnapshot(cjs).tombstones, [alice.__uuidv7])
})
