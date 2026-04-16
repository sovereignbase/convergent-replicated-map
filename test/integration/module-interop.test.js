import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import * as esmApi from '../../dist/index.js'

const require = createRequire(import.meta.url)
const cjsApi = require('../../dist/index.cjs')
const CONTACT_ALICE = '019d81fd-a1e9-76dd-aaf0-f4dd2ac2accc'
const CONTACT_BOB = '019d81fd-a1ea-75cf-b513-f35976cefc93'
const CONTACT_CAROL = '019d81fd-a1eb-7b54-8fd9-5a6dc9f43f10'

function normalizeSnapshot(snapshot) {
  return {
    values: [...snapshot.values]
      .map((entry) => ({
        uuidv7: entry.uuidv7,
        key: entry.value.key,
        value: structuredClone(entry.value.value),
        predecessor: entry.predecessor,
      }))
      .sort(
        (left, right) =>
          left.key.localeCompare(right.key) ||
          left.uuidv7.localeCompare(right.uuidv7)
      ),
    tombstones: [...snapshot.tombstones].sort(),
  }
}

function projection(replica) {
  return Object.fromEntries(replica.entries())
}

test('esm and cjs builds interoperate via snapshots and deltas in both directions', () => {
  const esm = new esmApi.CRMap()
  const cjs = new cjsApi.CRMap()
  const esmDeltas = []
  const cjsDeltas = []

  esm.addEventListener('delta', (event) => {
    esmDeltas.push(structuredClone(event.detail))
  })
  cjs.addEventListener('delta', (event) => {
    cjsDeltas.push(structuredClone(event.detail))
  })

  esm.set(CONTACT_ALICE, { name: 'Alice Example', email: 'alice@example.com' })
  cjs.merge(esmDeltas[0])
  cjs.set(CONTACT_BOB, { name: 'Bob Example', email: 'bob@example.com' })
  esm.merge(cjsDeltas[0])
  esm.delete(CONTACT_ALICE)
  cjs.merge(esmDeltas[1])
  cjs.set(CONTACT_CAROL, { name: 'Carol Example', email: 'carol@example.com' })
  esm.merge(cjs.toJSON())

  assert.equal(esm.size, cjs.size)
  assert.deepEqual(projection(esm), projection(cjs))
  assert.deepEqual(
    normalizeSnapshot(esm.toJSON()),
    normalizeSnapshot(cjs.toJSON())
  )
})

test('public root export exposes CRMap, CRMapError, and core helpers', async () => {
  const mod = await import('../../dist/index.js')

  assert.equal(typeof mod.CRMap, 'function')
  assert.equal(typeof mod.CRMapError, 'function')
  for (const name of [
    '__acknowledge',
    '__create',
    '__delete',
    '__garbageCollect',
    '__merge',
    '__read',
    '__snapshot',
    '__update',
  ]) {
    assert.equal(typeof mod[name], 'function')
  }
})

test('json cloned snapshots roundtrip across builds', () => {
  const esm = new esmApi.CRMap()
  esm.set(CONTACT_ALICE, { name: 'Alice Example', email: 'alice@example.com' })
  esm.set(CONTACT_BOB, { name: 'Bob Example', email: 'bob@example.com' })

  const cjs = new cjsApi.CRMap(structuredClone(esm.toJSON()))

  assert.equal(cjs.size, 2)
  assert.deepEqual(projection(cjs), projection(esm))
  assert.deepEqual(
    normalizeSnapshot(cjs.toJSON()),
    normalizeSnapshot(esm.toJSON())
  )
})
