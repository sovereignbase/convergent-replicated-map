import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { ORSet as ORSetEsm } from '../../dist/index.js'
import { cloneSnapshot, readSnapshot, sortStrings } from '../shared/orset.mjs'

const require = createRequire(import.meta.url)
const { ORSet: ORSetCjs } = require('../../dist/index.cjs')

function sortedSnapshotIds(set) {
  return sortStrings(readSnapshot(set).values.map((value) => value.__uuidv7))
}

test('esm and cjs builds interoperate via snapshots in both directions', () => {
  const esm = new ORSetEsm()
  const cjs = new ORSetCjs()

  esm.append({ role: 'admin' })
  cjs.merge(readSnapshot(esm))
  cjs.append({ role: 'editor' })
  esm.merge(readSnapshot(cjs))

  assert.equal(esm.size, 2)
  assert.equal(cjs.size, 2)
  assert.deepEqual(sortedSnapshotIds(esm), sortedSnapshotIds(cjs))
})

test('public root export exposes ORSet but not ORSetError runtime value', async () => {
  const mod = await import('../../dist/index.js')

  assert.equal(typeof mod.ORSet, 'function')
  assert.equal('ORSetError' in mod, false)
})

test('json cloned snapshots roundtrip across builds', () => {
  const esm = new ORSetEsm()
  esm.append({ role: 'admin' })

  const cjs = new ORSetCjs(cloneSnapshot(readSnapshot(esm)))

  assert.equal(cjs.size, 1)
  assert.equal(cjs.values()[0].role, 'admin')
  assert.equal(typeof cjs.values()[0].__uuidv7, 'string')
})
