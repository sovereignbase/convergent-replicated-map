const TEST_TIMEOUT_MS = 10_000
const CONTACT_ALICE = '019d81fd-a1e9-76dd-aaf0-f4dd2ac2accc'
const CONTACT_BOB = '019d81fd-a1ea-75cf-b513-f35976cefc93'
const CONTACT_CAROL = '019d81fd-a1eb-7b54-8fd9-5a6dc9f43f10'
const CONTACT_DAVE = '019d81fd-a1ec-73e5-9a9d-0d1129b3cbe2'
const CONTACT_IDS = [CONTACT_ALICE, CONTACT_BOB, CONTACT_CAROL, CONTACT_DAVE]

export async function runCRMapSuite(api, options = {}) {
  const {
    label = 'runtime',
    includeStress = false,
    stressRounds = 12,
    verbose = false,
  } = options
  const results = { label, ok: true, errors: [], tests: [] }
  const {
    CRMap,
    CRMapError,
    __acknowledge,
    __create,
    __delete,
    __garbageCollect,
    __merge,
    __read,
    __snapshot,
    __update,
  } = api

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'assertion failed')
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `expected ${actual} to equal ${expected}`)
    }
  }

  function assertCRMapError(error, code, message) {
    assert(error instanceof CRMapError, message || 'expected CRMapError')
    assertEqual(error.name, 'CRMapError')
    assertEqual(error.code, code)
  }

  function assertJsonEqual(actual, expected, message) {
    const actualJson = JSON.stringify(actual)
    const expectedJson = JSON.stringify(expected)
    if (actualJson !== expectedJson) {
      throw new Error(
        message || `expected ${actualJson} to equal ${expectedJson}`
      )
    }
  }

  function assertChangeEqual(actual, expected, message) {
    const normalizeChange = (change) =>
      Object.keys(change)
        .sort()
        .map((key) => [
          key,
          change[key] === undefined
            ? { __type: 'undefined' }
            : structuredClone(change[key]),
        ])

    assertJsonEqual(
      normalizeChange(actual),
      normalizeChange(expected),
      message || 'change mismatch'
    )
  }

  function sortStrings(values) {
    return [...values].sort()
  }

  function createReplica(snapshot) {
    return new CRMap(snapshot)
  }

  function captureEvents(replica) {
    const events = {
      delta: [],
      change: [],
      snapshot: [],
      ack: [],
    }

    replica.addEventListener('delta', (event) => {
      events.delta.push(event.detail)
    })
    replica.addEventListener('change', (event) => {
      events.change.push(event.detail)
    })
    replica.addEventListener('snapshot', (event) => {
      events.snapshot.push(event.detail)
    })
    replica.addEventListener('ack', (event) => {
      events.ack.push(event.detail)
    })

    return events
  }

  function createValidUuid(seed = 'seed') {
    const state = __create()
    const result = __update(`seed-${seed}`, { seed }, state)
    assert(result, 'expected valid uuid seed update')
    return result.delta.values[0].uuidv7
  }

  function readSnapshot(replica) {
    return replica.toJSON()
  }

  function emitSnapshot(replica) {
    let snapshot

    replica.addEventListener(
      'snapshot',
      (event) => {
        snapshot = event.detail
      },
      { once: true }
    )
    assertEqual(replica.snapshot(), undefined)
    assert(snapshot, 'expected snapshot detail')

    return snapshot
  }

  function emitAck(replica) {
    let ack = ''

    replica.addEventListener(
      'ack',
      (event) => {
        ack = event.detail
      },
      { once: true }
    )
    assertEqual(replica.acknowledge(), undefined)
    return ack
  }

  function projection(replica) {
    return Object.fromEntries(replica.entries())
  }

  function normalizeProjection(value) {
    if (Array.isArray(value)) return value.map(normalizeProjection)
    if (!value || typeof value !== 'object') return value

    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeProjection(value[key])])
    )
  }

  function assertProjectionEqual(actual, expected, message) {
    assertJsonEqual(
      normalizeProjection(actual),
      normalizeProjection(expected),
      message || 'projection mismatch'
    )
  }

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
      tombstones: sortStrings(snapshot.tombstones),
    }
  }

  function nextValue(contactId, step, replicaIndex) {
    return {
      memberId: contactId,
      displayName: `Contact ${replicaIndex}-${step}`,
      email: `contact-${replicaIndex}-${step}@example.com`,
      tags: [`group-${replicaIndex}`, `step-${step}`],
      active: (step + replicaIndex) % 2 === 0,
    }
  }

  function hostilePayload(step) {
    const validUuid = createValidUuid(`valid-${step}`)
    return step % 6 === 0
      ? null
      : step % 6 === 1
        ? false
        : step % 6 === 2
          ? []
          : step % 6 === 3
            ? { values: 'bad' }
            : step % 6 === 4
              ? {
                  values: [
                    {
                      uuidv7: 'bad',
                      predecessor: 'bad',
                      value: { key: 'ghost', value: 'bad' },
                    },
                  ],
                  tombstones: ['bad'],
                }
              : {
                  values: [
                    {
                      uuidv7: validUuid,
                      predecessor: 'bad',
                      value: { key: 'ghost', value: 'bad' },
                    },
                  ],
                }
  }

  function random(seed) {
    let state = seed >>> 0
    return () => {
      state = (state + 0x6d2b79f5) >>> 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function shuffled(values, seed) {
    const next = values.slice()
    const rand = random(seed)
    for (let index = next.length - 1; index > 0; index--) {
      const other = Math.floor(rand() * (index + 1))
      ;[next[index], next[other]] = [next[other], next[index]]
    }
    return next
  }

  function shuffledIndices(length, seed) {
    return shuffled(
      Array.from({ length }, (_, index) => index),
      seed
    )
  }

  function settleReplicaSnapshots(replicas, rounds, seed, options = {}) {
    const { restartEveryRound = 0 } = options

    for (let round = 0; round < rounds; round++) {
      const snapshots = replicas.map((replica) => readSnapshot(replica))
      const deliveries = []

      for (let sourceIndex = 0; sourceIndex < snapshots.length; sourceIndex++) {
        for (
          let targetIndex = 0;
          targetIndex < replicas.length;
          targetIndex++
        ) {
          if (sourceIndex === targetIndex) continue
          deliveries.push({ sourceIndex, targetIndex })
        }
      }

      for (const deliveryIndex of shuffledIndices(
        deliveries.length,
        seed + round
      )) {
        const { sourceIndex, targetIndex } = deliveries[deliveryIndex]
        replicas[targetIndex].merge(snapshots[sourceIndex])
      }

      if (restartEveryRound > 0 && (round + 1) % restartEveryRound === 0) {
        const restartIndex = (seed + round) % replicas.length
        replicas[restartIndex] = createReplica(
          readSnapshot(replicas[restartIndex])
        )
      }
    }
  }

  function runSnapshotScenario(seed, options = {}) {
    const {
      replicaCount = 3,
      steps = 120,
      restartEvery = 0,
      settleRounds = 10,
      settleSeedOffset = 100_000,
    } = options
    const rng = random(seed)
    const replicas = Array.from({ length: replicaCount }, () => createReplica())
    const keys = CONTACT_IDS

    for (let step = 0; step < steps; step++) {
      const actorIndex = Math.floor(rng() * replicas.length)
      const actor = replicas[actorIndex]
      const branch = rng()

      if (branch < 0.4) {
        const key = keys[Math.floor(rng() * keys.length)]
        actor.set(key, nextValue(key, step, actorIndex))
      } else if (branch < 0.58) {
        if (actor.size === 0 || rng() < 0.3) actor.clear()
        else actor.delete(keys[Math.floor(rng() * keys.length)])
      } else if (branch < 0.82) {
        const sourceIndex = Math.floor(rng() * replicas.length)
        if (sourceIndex !== actorIndex)
          actor.merge(readSnapshot(replicas[sourceIndex]))
      } else if (branch < 0.92) {
        actor.merge(hostilePayload(step))
      } else {
        const frontiers = replicas.map(emitAck).filter(Boolean)
        if (frontiers.length > 0) {
          for (const replica of replicas) replica.garbageCollect(frontiers)
        }
      }

      if (restartEvery > 0 && (step + 1) % restartEvery === 0) {
        const restartIndex = (seed + step) % replicas.length
        replicas[restartIndex] = createReplica(
          readSnapshot(replicas[restartIndex])
        )
      }
    }

    settleReplicaSnapshots(replicas, settleRounds, seed + settleSeedOffset)
    return replicas
  }

  function allOtherIndices(length, sourceIndex) {
    return Array.from({ length }, (_, index) => index).filter(
      (index) => index !== sourceIndex
    )
  }

  function queuePayload(queue, sourceIndex, payload, targets) {
    const uniqueTargets = [...new Set(targets)].filter(
      (targetIndex) => targetIndex !== sourceIndex
    )
    if (uniqueTargets.length === 0) return
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return
    if ((payload.values?.length ?? 0) + (payload.tombstones?.length ?? 0) < 1)
      return

    queue.push({
      sourceIndex,
      targets: uniqueTargets,
      payload: structuredClone(payload),
    })
  }

  function captureReplicaDeltas(replica, fn) {
    const deltas = []
    const listener = (event) => {
      deltas.push(event.detail)
    }
    replica.addEventListener('delta', listener)
    try {
      fn()
    } finally {
      replica.removeEventListener('delta', listener)
    }
    return deltas
  }

  function deliverOneReplicaMessage(replicas, queue, rand) {
    const messageIndex = Math.floor(rand() * queue.length)
    const message = queue[messageIndex]
    const targetOffset = Math.floor(rand() * message.targets.length)
    const targetIndex = message.targets.splice(targetOffset, 1)[0]
    const replyDeltas = captureReplicaDeltas(replicas[targetIndex], () => {
      replicas[targetIndex].merge(message.payload)
    })

    for (const replyDelta of replyDeltas) {
      queuePayload(
        queue,
        targetIndex,
        replyDelta,
        allOtherIndices(replicas.length, targetIndex)
      )
    }

    if (message.targets.length === 0) queue.splice(messageIndex, 1)
  }

  function drainReplicaQueue(replicas, queue, seed, options = {}) {
    const rand = random(seed)
    let deliveries = 0
    const maxDeliveries =
      options.maxDeliveries ??
      Math.max(2_000, queue.length * Math.max(1, replicas.length) * 8)

    while (queue.length > 0) {
      deliverOneReplicaMessage(replicas, queue, rand)
      deliveries++
      if (deliveries > maxDeliveries) {
        throw new Error(
          `replica gossip queue exceeded ${maxDeliveries} deliveries`
        )
      }
    }
  }

  function runQueuedDeltaScenario(seed, options = {}) {
    const {
      replicaCount = 4,
      steps = 120,
      restartEvery = 0,
      settleRounds = 8,
    } = options
    const rng = random(seed)
    const replicas = Array.from({ length: replicaCount }, () => createReplica())
    const queue = []
    const keys = CONTACT_IDS

    for (let step = 0; step < steps; step++) {
      const actorIndex = Math.floor(rng() * replicas.length)
      const actor = replicas[actorIndex]
      const branch = rng()

      if (branch < 0.38) {
        const key = keys[Math.floor(rng() * keys.length)]
        const deltas = captureReplicaDeltas(actor, () => {
          actor.set(key, nextValue(key, step, actorIndex))
        })
        for (const delta of deltas) {
          queuePayload(
            queue,
            actorIndex,
            delta,
            allOtherIndices(replicas.length, actorIndex)
          )
        }
      } else if (branch < 0.56) {
        const deltas = captureReplicaDeltas(actor, () => {
          if (actor.size === 0 || rng() < 0.35) actor.clear()
          else actor.delete(keys[Math.floor(rng() * keys.length)])
        })
        for (const delta of deltas) {
          queuePayload(
            queue,
            actorIndex,
            delta,
            allOtherIndices(replicas.length, actorIndex)
          )
        }
      } else if (branch < 0.82) {
        if (queue.length > 0) {
          const deliveries = 1 + Math.floor(rng() * Math.min(4, queue.length))
          for (let index = 0; index < deliveries && queue.length > 0; index++) {
            deliverOneReplicaMessage(replicas, queue, rng)
          }
        }
      } else if (branch < 0.92) {
        actor.merge(hostilePayload(step))
      } else {
        const frontiers = replicas.map(emitAck).filter(Boolean)
        if (frontiers.length > 0) {
          for (const replica of replicas) replica.garbageCollect(frontiers)
        }
      }

      if (restartEvery > 0 && (step + 1) % restartEvery === 0) {
        const restartIndex = (seed + step) % replicas.length
        replicas[restartIndex] = createReplica(
          readSnapshot(replicas[restartIndex])
        )
      }
    }

    drainReplicaQueue(replicas, queue, seed + 90_000)
    settleReplicaSnapshots(replicas, settleRounds, seed + 120_000)
    return replicas
  }

  async function withTimeout(promise, ms, name) {
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`timeout after ${ms}ms${name ? `: ${name}` : ''}`))
      }, ms)
    })
    return Promise.race([promise.finally(() => clearTimeout(timer)), timeout])
  }

  async function runTest(name, fn) {
    try {
      if (verbose) console.log(`${label}: ${name}`)
      await withTimeout(Promise.resolve().then(fn), TEST_TIMEOUT_MS, name)
      results.tests.push({ name, ok: true })
    } catch (error) {
      results.ok = false
      results.tests.push({ name, ok: false })
      results.errors.push({ name, message: String(error) })
    }
  }

  await runTest('exports shape', () => {
    for (const value of [
      CRMap,
      CRMapError,
      __acknowledge,
      __create,
      __delete,
      __garbageCollect,
      __merge,
      __read,
      __snapshot,
      __update,
    ]) {
      assert(typeof value === 'function', 'missing public export')
    }

    const error = new CRMapError('INVALID_KEY')
    assertEqual(
      error.message,
      '{@sovereignbase/convergent-replicated-map} INVALID_KEY'
    )
  })

  await runTest(
    'constructor collection surface serialization and empty acknowledge are coherent',
    () => {
      const replica = createReplica()
      const events = captureEvents(replica)
      const snapshot = readSnapshot(replica)

      assertEqual(replica.size, 0)
      assertEqual(replica.get('ghost'), undefined)
      assertEqual(replica.has('ghost'), false)
      assertJsonEqual(replica.keys(), [])
      assertJsonEqual(replica.values(), [])
      assertJsonEqual(replica.entries(), [])
      assertJsonEqual([...replica], [])
      assertJsonEqual(projection(replica), {})
      assertJsonEqual(normalizeSnapshot(snapshot), {
        values: [],
        tombstones: [],
      })
      assertJsonEqual(normalizeSnapshot(emitSnapshot(replica)), {
        values: [],
        tombstones: [],
      })
      assertEqual(replica.toString(), JSON.stringify(snapshot))
      assertJsonEqual(
        replica[Symbol.for('nodejs.util.inspect.custom')](),
        snapshot
      )
      assertJsonEqual(replica[Symbol.for('Deno.customInspect')](), snapshot)

      replica.acknowledge()
      assertEqual(events.ack.length, 0)
    }
  )

  await runTest(
    'reads iterators snapshots and change payloads are detached from live state',
    () => {
      const replica = createReplica()
      const events = captureEvents(replica)
      replica.set(CONTACT_ALICE, {
        name: 'Alice Example',
        email: 'alice@example.com',
        tags: ['friend'],
        online: false,
      })
      replica.set(CONTACT_BOB, {
        name: 'Bob Example',
        email: 'bob@example.com',
        tags: ['coworker'],
        online: false,
      })
      replica.set(CONTACT_ALICE, {
        name: 'Alice Example',
        email: 'alice@example.com',
        tags: ['friend', 'vip'],
        online: true,
      })

      const read = replica.get(CONTACT_ALICE)
      read.online = false
      read.tags.push('mutated')

      const values = replica.values()
      values[0].online = false
      values[0].tags.push('mutated')
      values[1].tags.push('mutated')

      const entries = Object.fromEntries(replica.entries())
      entries[CONTACT_ALICE].online = false
      entries[CONTACT_ALICE].tags.push('entry')
      entries[CONTACT_BOB].tags.push('entry')

      const iterated = Object.fromEntries([...replica])
      iterated[CONTACT_ALICE].online = false
      iterated[CONTACT_ALICE].tags.push('iterator')
      iterated[CONTACT_BOB].tags.push('iterator')

      replica.forEach((value, key) => {
        value.online = false
        value.tags.push(`forEach:${key}`)
      })

      const snapshot = emitSnapshot(replica)
      const aliceEntry = snapshot.values.find(
        (entry) => entry.value.key === CONTACT_ALICE
      )
      const bobEntry = snapshot.values.find(
        (entry) => entry.value.key === CONTACT_BOB
      )
      aliceEntry.value.value.online = false
      aliceEntry.value.value.tags.push('snapshot')
      bobEntry.value.value.tags.push('snapshot')
      snapshot.tombstones.push(createValidUuid('ghost'))

      events.change[0][CONTACT_ALICE].online = true
      events.change[0][CONTACT_ALICE].tags.push('changed')

      assertJsonEqual(replica.get(CONTACT_ALICE), {
        name: 'Alice Example',
        email: 'alice@example.com',
        tags: ['friend', 'vip'],
        online: true,
      })
      assertJsonEqual(replica.get(CONTACT_BOB), {
        name: 'Bob Example',
        email: 'bob@example.com',
        tags: ['coworker'],
        online: false,
      })
      assert(readSnapshot(replica).tombstones.length > 0, 'expected tombstones')
    }
  )

  await runTest(
    'local writes keyed delete full delete and core overloads stay coherent',
    () => {
      const replica = createReplica()
      const events = captureEvents(replica)

      replica.set(CONTACT_ALICE, { name: 'Alice Example' })
      replica.set(CONTACT_BOB, { name: 'Bob Example' })
      replica.delete(CONTACT_ALICE)
      replica.clear()
      replica.delete('ghost')
      replica.clear()

      assertEqual(replica.size, 0)
      assertEqual(events.delta.length, 4)
      assertEqual(events.change.length, 4)
      assertChangeEqual(events.change[2], { [CONTACT_ALICE]: undefined })
      assertChangeEqual(events.change[3], { [CONTACT_BOB]: undefined })
      assertEqual(replica.has(CONTACT_ALICE), false)

      const state = __create()
      const update = __update('alpha', { ok: true }, state)
      assert(update, 'expected keyed update')
      update.change.alpha.ok = false
      assertJsonEqual(__read('alpha', state), { ok: true })

      const keyedDelete = __delete('alpha', state)
      assert(keyedDelete, 'expected keyed delete')
      assertChangeEqual(keyedDelete.change, { alpha: undefined })
      assertEqual(__read('alpha', state), undefined)

      const fullState = __create()
      assert(__update(CONTACT_ALICE, { name: 'Alice Example' }, fullState))
      assert(__update(CONTACT_BOB, { name: 'Bob Example' }, fullState))
      const fullDelete = __delete(fullState)
      assert(fullDelete, 'expected full delete')
      assertEqual(fullState.values.size, 0)
      assertChangeEqual(fullDelete.change, {
        [CONTACT_ALICE]: undefined,
        [CONTACT_BOB]: undefined,
      })
      assertEqual(fullDelete.delta.tombstones.length, 2)
    }
  )

  await runTest(
    'create hydration resolves duplicate key contenders and ignores tombstoned entries',
    () => {
      const root = createValidUuid('root')
      const sameUuid = createValidUuid('same')
      const greaterPredecessor = createValidUuid('greater')
      const descendant = createValidUuid('descendant')
      const tombed = createValidUuid('tombed')

      const state = __create({
        values: [
          {
            uuidv7: tombed,
            value: { key: 'dead', value: 'removed' },
            predecessor: root,
          },
          {
            uuidv7: sameUuid,
            value: { key: 'name', value: 'first' },
            predecessor: root,
          },
          {
            uuidv7: sameUuid,
            value: { key: 'name', value: 'same-uuid-advanced' },
            predecessor: greaterPredecessor,
          },
          {
            uuidv7: descendant,
            value: { key: 'name', value: 'descendant' },
            predecessor: sameUuid,
          },
        ],
        tombstones: [tombed],
      })

      assertEqual(__read('dead', state), undefined)
      assertEqual(__read('name', state), 'descendant')
      const snapshot = __snapshot(state)
      assertEqual(snapshot.values.length, 1)
      assertEqual(snapshot.values[0].value.key, 'name')
      assertEqual(snapshot.values[0].value.value, 'descendant')
    }
  )

  await runTest(
    'core guard branches and hydration edge cases stay inert',
    () => {
      const tombstone = createValidUuid('tombstone')
      const olderPredecessor = createValidUuid('older-predecessor')
      const newerPredecessor = createValidUuid('newer-predecessor')
      const sameUuid = createValidUuid('same-uuid')
      const smallerUuid = createValidUuid('smaller-uuid')
      const largerUuid = createValidUuid('larger-uuid')
      const replaceOlderUuid = createValidUuid('replace-older-uuid')
      const replaceNewerUuid = createValidUuid('replace-newer-uuid')
      const brokenUuid = createValidUuid('broken-uuid')

      const withoutValues = __create({
        tombstones: [tombstone, tombstone, 'bad'],
      })
      assertEqual(withoutValues.tombstones.has(tombstone), true)
      assertEqual(withoutValues.tombstones.size, 1)
      assertEqual(withoutValues.values.size, 0)

      const hydrated = __create({
        tombstones: [tombstone, tombstone, 'bad'],
        values: [
          null,
          {
            uuidv7: brokenUuid,
            predecessor: tombstone,
            value: { key: 'broken', value: () => {} },
          },
          {
            uuidv7: sameUuid,
            predecessor: newerPredecessor,
            value: { key: 'same', value: 'winner' },
          },
          {
            uuidv7: sameUuid,
            predecessor: olderPredecessor,
            value: { key: 'same', value: 'stale-same-uuid' },
          },
          {
            uuidv7: largerUuid,
            predecessor: tombstone,
            value: { key: 'compete', value: 'large' },
          },
          {
            uuidv7: smallerUuid,
            predecessor: tombstone,
            value: { key: 'compete', value: 'small' },
          },
          {
            uuidv7: replaceOlderUuid,
            predecessor: tombstone,
            value: { key: 'replace', value: 'old' },
          },
          {
            uuidv7: replaceNewerUuid,
            predecessor: tombstone,
            value: { key: 'replace', value: 'new' },
          },
        ],
      })

      assertEqual(__read('broken', hydrated), undefined)
      assertEqual(__read('same', hydrated), 'winner')
      assertEqual(__read('compete', hydrated), 'large')
      assertEqual(__read('replace', hydrated), 'new')
      assertEqual(__delete('ghost'), false)
    }
  )

  await runTest('typed errors remain explicit in local operations', () => {
    const state = __create()

    try {
      __update('', { ok: true }, state)
      throw new Error('expected invalid key error')
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'expected invalid key error'
      ) {
        throw error
      }
      assertCRMapError(error, 'INVALID_KEY')
    }

    try {
      __update('broken', () => {}, state)
      throw new Error('expected clone error')
    } catch (error) {
      if (error instanceof Error && error.message === 'expected clone error') {
        throw error
      }
      assertCRMapError(error, 'VALUE_NOT_CLONEABLE')
    }

    assertEqual(__delete('ghost'), false)

    try {
      __delete(state, '')
      throw new Error('expected delete key error')
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'expected delete key error'
      ) {
        throw error
      }
      assertCRMapError(error, 'INVALID_KEY')
    }

    const replica = createReplica()
    const events = captureEvents(replica)

    try {
      replica.set('', 'broken')
      throw new Error('expected set key error')
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'expected set key error'
      ) {
        throw error
      }
      assertCRMapError(error, 'INVALID_KEY')
    }

    try {
      replica.set('broken', () => {})
      throw new Error('expected set clone error')
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'expected set clone error'
      ) {
        throw error
      }
      assertCRMapError(error, 'VALUE_NOT_CLONEABLE')
    }

    try {
      replica.delete('')
      throw new Error('expected public delete key error')
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'expected public delete key error'
      ) {
        throw error
      }
      assertCRMapError(error, 'INVALID_KEY')
    }

    assertEqual(replica.size, 0)
    assertEqual(events.delta.length, 0)
    assertEqual(events.change.length, 0)
  })

  await runTest(
    'merge ignores malformed ingress and invalid siblings without throwing',
    () => {
      const replica = createReplica()
      replica.set('stable', { value: 'stable' })
      const before = normalizeSnapshot(readSnapshot(replica))
      const validUuid = createValidUuid('valid')
      const validPredecessor = createValidUuid('predecessor')

      const payloads = [
        null,
        false,
        [],
        { values: 'bad' },
        { tombstones: 'bad' },
        { values: [null] },
        {
          values: [
            {
              uuidv7: 'bad',
              predecessor: 'bad',
              value: { key: 'ghost', value: 'ignored' },
            },
          ],
        },
        {
          values: [
            {
              uuidv7: validUuid,
              predecessor: 'bad',
              value: { key: 'ghost', value: 'ignored' },
            },
          ],
        },
        {
          values: [
            {
              uuidv7: validUuid,
              predecessor: validPredecessor,
              value: { key: 1, value: 'ignored' },
            },
          ],
        },
      ]

      for (const payload of payloads) {
        assertEqual(replica.merge(payload), undefined)
      }

      assertJsonEqual(normalizeSnapshot(readSnapshot(replica)), before)
    }
  )

  await runTest(
    'merge drops stale relation pointers on tombstone ingress',
    () => {
      const state = __create()
      const local = __update('name', { version: 2 }, state)
      assert(local, 'expected local update')
      const staleUuid = createValidUuid('stale-relation')
      state.relations.set(staleUuid, 'name')

      assertEqual(__merge({ tombstones: [staleUuid] }, state), false)
      assertEqual(state.relations.has(staleUuid), false)
      assertJsonEqual(__read('name', state), { version: 2 })
    }
  )

  await runTest(
    'merge adopts direct successors and same-uuid candidates with greater predecessors',
    () => {
      const source = createReplica()
      const target = createReplica(readSnapshot(source))
      const sourceEvents = captureEvents(source)
      source.set(CONTACT_ALICE, {
        name: 'Alice Example',
        email: 'alice@example.com',
      })

      const targetEvents = captureEvents(target)
      target.merge(sourceEvents.delta[0])

      assertJsonEqual(target.get(CONTACT_ALICE), {
        name: 'Alice Example',
        email: 'alice@example.com',
      })
      assertEqual(targetEvents.delta.length, 0)
      assertEqual(targetEvents.change.length, 1)
      assertChangeEqual(targetEvents.change[0], {
        [CONTACT_ALICE]: {
          name: 'Alice Example',
          email: 'alice@example.com',
        },
      })

      const replica = createReplica()
      replica.set(CONTACT_BOB, {
        name: 'Bob Example',
        email: 'bob@example.com',
        online: false,
      })
      const snapshot = structuredClone(readSnapshot(replica))
      const entry = snapshot.values.find(
        (value) => value.value.key === CONTACT_BOB
      )
      entry.predecessor = createValidUuid('greater')
      entry.value.value = {
        name: 'Bob Example',
        email: 'bob@example.com',
        online: true,
      }

      const events = captureEvents(replica)
      replica.merge({ values: [entry] })

      assertJsonEqual(replica.get(CONTACT_BOB), {
        name: 'Bob Example',
        email: 'bob@example.com',
        online: true,
      })
      assertEqual(events.delta.length, 0)
      assertEqual(events.change.length, 1)
      assertChangeEqual(events.change[0], {
        [CONTACT_BOB]: {
          name: 'Bob Example',
          email: 'bob@example.com',
          online: true,
        },
      })
    }
  )

  await runTest(
    'merge emits rebuttal deltas for stale same-key ingress and peers converge after exchange',
    () => {
      const base = createReplica()
      const older = createReplica(readSnapshot(base))
      const newer = createReplica(readSnapshot(base))

      older.set(CONTACT_ALICE, { name: 'Alice Older' })
      newer.set(CONTACT_ALICE, { name: 'Alice Newer' })

      const newerEvents = captureEvents(newer)
      newer.merge(readSnapshot(older))

      assertJsonEqual(newer.get(CONTACT_ALICE), { name: 'Alice Newer' })
      assertEqual(newerEvents.change.length, 0)
      assertEqual(newerEvents.delta.length, 1)

      older.merge(newerEvents.delta[0])
      assertJsonEqual(
        normalizeSnapshot(readSnapshot(older)),
        normalizeSnapshot(readSnapshot(newer))
      )

      const sameUuid = createReplica()
      sameUuid.set(CONTACT_BOB, { name: 'Bob Example', online: true })
      const snapshot = structuredClone(readSnapshot(sameUuid))
      const entry = snapshot.values.find(
        (value) => value.value.key === CONTACT_BOB
      )
      entry.value.value = { name: 'Bob Example', online: false }

      const sameUuidEvents = captureEvents(sameUuid)
      sameUuid.merge({ values: [entry] })

      assertJsonEqual(sameUuid.get(CONTACT_BOB), {
        name: 'Bob Example',
        online: true,
      })
      assertEqual(sameUuidEvents.change.length, 0)
      assertEqual(sameUuidEvents.delta.length, 1)
    }
  )

  await runTest('duplicate identical delta is idempotent', () => {
    const source = createReplica()
    const sourceEvents = captureEvents(source)
    source.set(CONTACT_ALICE, { name: 'Alice Example' })

    const target = createReplica()
    target.merge(sourceEvents.delta[0])
    const targetEvents = captureEvents(target)
    target.merge(sourceEvents.delta[0])

    assertEqual(targetEvents.delta.length, 0)
    assertEqual(targetEvents.change.length, 0)
    assertJsonEqual(target.get(CONTACT_ALICE), { name: 'Alice Example' })
  })

  await runTest(
    'acknowledge and garbageCollect compact tombstones and ignore invalid frontiers',
    () => {
      const replica = createReplica()
      replica.set(CONTACT_ALICE, { name: 'Alice Example', revision: 'a' })
      replica.set(CONTACT_ALICE, { name: 'Alice Example', revision: 'b' })
      replica.set(CONTACT_ALICE, { name: 'Alice Example', revision: 'c' })
      const before = readSnapshot(replica)

      replica.garbageCollect(false)
      replica.garbageCollect([])
      replica.garbageCollect(['bad'])

      assertJsonEqual(
        normalizeSnapshot(readSnapshot(replica)),
        normalizeSnapshot(before)
      )

      const ack = emitAck(replica)
      assert(ack !== '', 'expected non-empty ack frontier')

      replica.garbageCollect([ack])
      const after = readSnapshot(replica)
      const current = after.values.find(
        (entry) => entry.value.key === CONTACT_ALICE
      )

      assert(
        after.tombstones.includes(current.predecessor),
        'expected current predecessor to survive gc'
      )
      assert(
        after.tombstones.length < before.tombstones.length,
        'expected gc to compact tombstones'
      )
    }
  )

  await runTest(
    'listener objects removal and event channels behave consistently',
    () => {
      const replica = createReplica()
      let deltaDetail
      let snapshotCalls = 0
      const deltaListener = {
        handleEvent(event) {
          deltaDetail = event.detail
        },
      }
      const snapshotListener = () => {
        snapshotCalls++
      }

      replica.addEventListener('delta', deltaListener)
      replica.addEventListener('snapshot', snapshotListener)
      replica.set(CONTACT_ALICE, { name: 'Alice Example' })
      replica.snapshot()
      replica.removeEventListener('delta', deltaListener)
      replica.removeEventListener('snapshot', snapshotListener)
      replica.set(CONTACT_ALICE, { name: 'Alice Updated' })
      replica.snapshot()

      assertEqual(deltaDetail.values.length, 1)
      assertEqual(snapshotCalls, 1)
    }
  )

  if (includeStress) {
    await runTest(
      'replicas converge after deterministic shuffled snapshot exchange',
      () => {
        const replicas = runSnapshotScenario(0xc0ffee, {
          replicaCount: 4,
          steps: stressRounds * 20,
          settleRounds: 12,
        })
        const expected = projection(replicas[0])

        for (let index = 1; index < replicas.length; index++) {
          assertProjectionEqual(projection(replicas[index]), expected)
        }
        for (const replica of replicas) {
          const hydrated = createReplica(readSnapshot(replica))
          assertProjectionEqual(projection(hydrated), expected)
        }
      }
    )

    await runTest(
      'replicas converge under queued delta delivery reply deltas and restarts',
      () => {
        const replicas = runQueuedDeltaScenario(0x5eed5eed, {
          replicaCount: 4,
          steps: stressRounds * 24,
          restartEvery: 9,
          settleRounds: 10,
        })
        const expected = projection(replicas[0])

        for (let index = 1; index < replicas.length; index++) {
          assertProjectionEqual(projection(replicas[index]), expected)
        }
        for (const replica of replicas) {
          const hydrated = createReplica(readSnapshot(replica))
          assertProjectionEqual(projection(hydrated), expected)
        }
      }
    )

    await runTest('25 aggressive deterministic convergence scenarios', () => {
      for (let scenario = 0; scenario < 25; scenario++) {
        const replicas =
          scenario % 2 === 0
            ? runSnapshotScenario(50_000 + scenario, {
                replicaCount: 3 + (scenario % 3),
                steps: 24 + (scenario % 5) * 8,
                restartEvery: scenario % 4 === 0 ? 7 : 0,
                settleRounds: 8,
              })
            : runQueuedDeltaScenario(60_000 + scenario, {
                replicaCount: 3 + (scenario % 3),
                steps: 20 + (scenario % 5) * 8,
                restartEvery: scenario % 4 === 1 ? 7 : 0,
                settleRounds: 8,
              })

        const expected = projection(replicas[0])
        for (let index = 1; index < replicas.length; index++) {
          assertProjectionEqual(
            projection(replicas[index]),
            expected,
            `scenario ${scenario} diverged`
          )
        }
        for (const replica of replicas) {
          const hydrated = createReplica(readSnapshot(replica))
          assertProjectionEqual(
            projection(hydrated),
            expected,
            `scenario ${scenario} hydrate mismatch`
          )
        }
      }
    })
  }

  return results
}

export function printResults(results) {
  const passed = results.tests.filter((test) => test.ok).length
  console.log(`${results.label}: ${passed}/${results.tests.length} passed`)
  if (!results.ok) {
    for (const error of results.errors) {
      console.error(`  - ${error.name}: ${error.message}`)
    }
  }
}

export function ensurePassing(results) {
  if (results.ok) return
  throw new Error(
    `${results.label} failed with ${results.errors.length} failing tests`
  )
}
