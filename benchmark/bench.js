import {
  CRMap,
  __acknowledge,
  __create,
  __delete,
  __garbageCollect,
  __merge,
  __read,
  __snapshot,
  __update,
} from '../dist/index.js'

const MAP_SIZE = 5_000
const OPS = 250
const SEED_REVISIONS = 2

const BENCHMARKS = [
  {
    group: 'crud',
    name: 'create / hydrate snapshot',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'read / primitive key hit',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'read / object key hit',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'read / missing key',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'update / overwrite string',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'update / overwrite object',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'delete / single key',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'delete / clear all',
    n: MAP_SIZE,
    ops: OPS,
  },
  { group: 'mags', name: 'snapshot', n: MAP_SIZE, ops: OPS },
  { group: 'mags', name: 'acknowledge', n: MAP_SIZE, ops: OPS },
  { group: 'mags', name: 'garbage collect', n: MAP_SIZE, ops: OPS },
  {
    group: 'mags',
    name: 'merge ordered deltas',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'mags',
    name: 'merge direct successor',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'mags',
    name: 'merge shuffled gossip',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'mags',
    name: 'merge stale conflict',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'constructor / hydrate snapshot',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'get / primitive key',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'get / object key',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'has / live key',
    n: MAP_SIZE,
    ops: OPS,
  },
  { group: 'class', name: 'keys()', n: MAP_SIZE, ops: OPS },
  { group: 'class', name: 'values()', n: MAP_SIZE, ops: OPS },
  { group: 'class', name: 'entries()', n: MAP_SIZE, ops: OPS },
  { group: 'class', name: 'set / string', n: MAP_SIZE, ops: OPS },
  { group: 'class', name: 'set / object', n: MAP_SIZE, ops: OPS },
  { group: 'class', name: 'delete(key)', n: MAP_SIZE, ops: OPS },
  { group: 'class', name: 'clear()', n: MAP_SIZE, ops: OPS },
  { group: 'class', name: 'snapshot', n: MAP_SIZE, ops: OPS },
  { group: 'class', name: 'acknowledge', n: MAP_SIZE, ops: OPS },
  { group: 'class', name: 'garbage collect', n: MAP_SIZE, ops: OPS },
  {
    group: 'class',
    name: 'merge ordered deltas',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'merge direct successor',
    n: MAP_SIZE,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'merge shuffled gossip',
    n: MAP_SIZE,
    ops: OPS,
  },
]

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function shuffledIndices(length, seed) {
  const indices = Array.from({ length }, (_, index) => index)
  const rand = random(seed)
  for (let index = indices.length - 1; index > 0; index--) {
    const nextIndex = Math.floor(rand() * (index + 1))
    ;[indices[index], indices[nextIndex]] = [indices[nextIndex], indices[index]]
  }
  return indices
}

function key(index) {
  return `key:${index}`
}

function stringValue(index, prefix = 'value') {
  return `${prefix}:${index}`
}

function objectValue(index, prefix = 'value') {
  return {
    id: index,
    meta: {
      label: `${prefix}:${index}`,
      even: index % 2 === 0,
    },
  }
}

function mixedValue(index, prefix = 'value') {
  return index % 2 === 0
    ? stringValue(index, prefix)
    : objectValue(index, prefix)
}

function createSeededState(size, revisions = SEED_REVISIONS) {
  const state = __create()
  for (let revision = 0; revision < revisions; revision++) {
    for (let index = 0; index < size; index++) {
      const result = __update(
        key(index),
        mixedValue(index + revision * size, `seed-${revision}`),
        state
      )
      if (!result)
        throw new Error(`seed update failed at ${revision}:${index}`)
    }
  }
  return state
}

function createSnapshot(size) {
  return __snapshot(createSeededState(size))
}

function createSeededMap(size) {
  return new CRMap(createSnapshot(size))
}

function readClassDelta(replica, action) {
  let delta
  const listener = (event) => {
    delta = event.detail
  }
  replica.addEventListener('delta', listener)
  try {
    action()
  } finally {
    replica.removeEventListener('delta', listener)
  }
  return delta
}

function readClassSnapshot(replica) {
  let snapshot
  const listener = (event) => {
    snapshot = event.detail
  }
  replica.addEventListener('snapshot', listener)
  try {
    replica.snapshot()
  } finally {
    replica.removeEventListener('snapshot', listener)
  }
  return snapshot
}

function readClassAck(replica) {
  let ack
  const listener = (event) => {
    ack = event.detail
  }
  replica.addEventListener('ack', listener)
  try {
    replica.acknowledge()
  } finally {
    replica.removeEventListener('ack', listener)
  }
  return ack
}

function collectOrderedCoreDeltas(source, amount, offset) {
  const deltas = []
  for (let index = 0; index < amount; index++) {
    const result = __update(
      key(index % 64),
      mixedValue(offset + index, 'delta'),
      source
    )
    if (!result) throw new Error(`ordered core delta failed at ${index}`)
    deltas.push(result.delta)
  }
  return deltas
}

function collectMixedCoreDeltas(source, amount, offset) {
  const deltas = []
  const rand = random(0xc0ffee)

  for (let index = 0; index < amount; index++) {
    let result = false

    if (index % 9 === 0 && source.values.size > 0) result = __delete(source)
    else if (index % 4 === 0 && source.values.size > 0) {
      const liveKeys = Array.from(source.values.keys())
      const liveKey = liveKeys[Math.floor(rand() * liveKeys.length)]
      result = __delete(source, liveKey)
    } else {
      result = __update(
        key(Math.floor(rand() * Math.max(1, MAP_SIZE))),
        mixedValue(offset + index, 'mixed'),
        source
      )
    }

    if (!result) {
      result = __update(
        key(Math.floor(rand() * Math.max(1, MAP_SIZE))),
        mixedValue(offset + index, 'fallback'),
        source
      )
    }
    if (!result) throw new Error(`mixed core delta failed at ${index}`)
    deltas.push(result.delta)
  }
  return deltas
}

function collectOrderedClassDeltas(source, amount, offset) {
  const deltas = []
  for (let index = 0; index < amount; index++) {
    const delta = readClassDelta(source, () => {
      source.set(key(index % 64), mixedValue(offset + index, 'delta'))
    })
    if (!delta) throw new Error(`ordered class delta failed at ${index}`)
    deltas.push(delta)
  }
  return deltas
}

function collectMixedClassDeltas(source, amount, offset) {
  const deltas = []
  const rand = random(0xc0ffee)

  for (let index = 0; index < amount; index++) {
    let delta

    if (index % 9 === 0 && source.size > 0) {
      delta = readClassDelta(source, () => {
        source.clear()
      })
    } else if (index % 4 === 0 && source.size > 0) {
      const liveKeys = source.keys()
      const liveKey = liveKeys[Math.floor(rand() * liveKeys.length)]
      delta = readClassDelta(source, () => {
        source.delete(liveKey)
      })
    } else {
      delta = readClassDelta(source, () => {
        source.set(
          key(Math.floor(rand() * Math.max(1, MAP_SIZE))),
          mixedValue(offset + index, 'mixed')
        )
      })
    }

    if (!delta) {
      delta = readClassDelta(source, () => {
        source.set(
          key(Math.floor(rand() * Math.max(1, MAP_SIZE))),
          mixedValue(offset + index, 'fallback')
        )
      })
    }
    if (!delta) throw new Error(`mixed class delta failed at ${index}`)
    deltas.push(delta)
  }
  return deltas
}

function time(fn) {
  const start = process.hrtime.bigint()
  const ops = fn()
  const end = process.hrtime.bigint()
  return { ms: Number(end - start) / 1_000_000, ops }
}

function runBenchmark(definition) {
  switch (`${definition.group}:${definition.name}`) {
    case 'crud:create / hydrate snapshot': {
      const snapshot = createSnapshot(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) __create(snapshot)
        return definition.ops
      })
    }
    case 'crud:read / primitive key hit': {
      const state = createSeededState(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          __read(key(0), state)
        return definition.ops
      })
    }
    case 'crud:read / object key hit': {
      const state = createSeededState(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          __read(key(1), state)
        return definition.ops
      })
    }
    case 'crud:read / missing key': {
      const state = createSeededState(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          __read('missing:key', state)
        return definition.ops
      })
    }
    case 'crud:update / overwrite string': {
      const state = __create(createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          __update('hot:string', stringValue(index, 'bench'), state)
        }
        return definition.ops
      })
    }
    case 'crud:update / overwrite object': {
      const state = __create(createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          __update('hot:object', objectValue(index, 'bench'), state)
        }
        return definition.ops
      })
    }
    case 'crud:delete / single key': {
      const snapshot = createSnapshot(definition.n)
      const states = Array.from({ length: definition.ops }, () =>
        __create(snapshot)
      )
      return time(() => {
        for (const state of states) __delete(state, key(0))
        return states.length
      })
    }
    case 'crud:delete / clear all': {
      const snapshot = createSnapshot(definition.n)
      const states = Array.from({ length: definition.ops }, () =>
        __create(snapshot)
      )
      return time(() => {
        for (const state of states) __delete(state)
        return states.length
      })
    }
    case 'mags:snapshot': {
      const state = createSeededState(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) __snapshot(state)
        return definition.ops
      })
    }
    case 'mags:acknowledge': {
      const state = createSeededState(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          __acknowledge(state)
        return definition.ops
      })
    }
    case 'mags:garbage collect': {
      const snapshot = createSnapshot(definition.n)
      const frontiers = Array.from({ length: 3 }, () =>
        __acknowledge(__create(snapshot))
      )
      const states = Array.from({ length: definition.ops }, () =>
        __create(snapshot)
      )
      return time(() => {
        for (const state of states) __garbageCollect(frontiers, state)
        return states.length
      })
    }
    case 'mags:merge ordered deltas': {
      const source = __create(createSnapshot(definition.n))
      const target = __create(createSnapshot(definition.n))
      const deltas = collectOrderedCoreDeltas(
        source,
        definition.ops,
        definition.n
      )
      return time(() => {
        for (const delta of deltas) __merge(delta, target)
        return deltas.length
      })
    }
    case 'mags:merge direct successor': {
      const baseSnapshot = __snapshot(__create())
      const source = __create(baseSnapshot)
      const successor = __update('name', 'alice', source)
      if (!successor) throw new Error('direct successor delta missing')
      const states = Array.from({ length: definition.ops }, () =>
        __create(baseSnapshot)
      )
      return time(() => {
        for (const state of states) __merge(successor.delta, state)
        return states.length
      })
    }
    case 'mags:merge shuffled gossip': {
      const source = __create(createSnapshot(definition.n))
      const target = __create(createSnapshot(definition.n))
      const deltas = collectMixedCoreDeltas(source, definition.ops, definition.n)
      const order = shuffledIndices(deltas.length, 0xbeef)
      return time(() => {
        for (const index of order) __merge(deltas[index], target)
        return order.length
      })
    }
    case 'mags:merge stale conflict': {
      const baseSnapshot = __snapshot(__create())
      const older = __create(baseSnapshot)
      const incoming = __update('name', 'older', older)
      if (!incoming) throw new Error('stale incoming delta missing')
      const newer = __create(baseSnapshot)
      __update('name', 'newer', newer)
      const targetSnapshot = __snapshot(newer)
      const states = Array.from({ length: definition.ops }, () =>
        __create(targetSnapshot)
      )
      return time(() => {
        for (const state of states) __merge(incoming.delta, state)
        return states.length
      })
    }
    case 'class:constructor / hydrate snapshot': {
      const snapshot = createSnapshot(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          new CRMap(snapshot)
        }
        return definition.ops
      })
    }
    case 'class:get / primitive key': {
      const replica = createSeededMap(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.get(key(0))
        return definition.ops
      })
    }
    case 'class:get / object key': {
      const replica = createSeededMap(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.get(key(1))
        return definition.ops
      })
    }
    case 'class:has / live key': {
      const replica = createSeededMap(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.has(key(0))
        return definition.ops
      })
    }
    case 'class:keys()': {
      const replica = createSeededMap(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.keys()
        return definition.ops
      })
    }
    case 'class:values()': {
      const replica = createSeededMap(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.values()
        return definition.ops
      })
    }
    case 'class:entries()': {
      const replica = createSeededMap(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.entries()
        return definition.ops
      })
    }
    case 'class:set / string': {
      const replica = new CRMap(createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          replica.set('hot:string', stringValue(index, 'bench'))
        }
        return definition.ops
      })
    }
    case 'class:set / object': {
      const replica = new CRMap(createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          replica.set('hot:object', objectValue(index, 'bench'))
        }
        return definition.ops
      })
    }
    case 'class:delete(key)': {
      const snapshot = createSnapshot(definition.n)
      const replicas = Array.from({ length: definition.ops }, () => new CRMap(snapshot))
      return time(() => {
        for (const replica of replicas) replica.delete(key(0))
        return replicas.length
      })
    }
    case 'class:clear()': {
      const snapshot = createSnapshot(definition.n)
      const replicas = Array.from({ length: definition.ops }, () => new CRMap(snapshot))
      return time(() => {
        for (const replica of replicas) replica.clear()
        return replicas.length
      })
    }
    case 'class:snapshot': {
      const replica = createSeededMap(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          readClassSnapshot(replica)
        return definition.ops
      })
    }
    case 'class:acknowledge': {
      const replica = createSeededMap(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          readClassAck(replica)
        return definition.ops
      })
    }
    case 'class:garbage collect': {
      const snapshot = createSnapshot(definition.n)
      const frontiers = Array.from({ length: 3 }, () =>
        readClassAck(new CRMap(snapshot))
      )
      const replicas = Array.from({ length: definition.ops }, () => new CRMap(snapshot))
      return time(() => {
        for (const replica of replicas) replica.garbageCollect(frontiers)
        return replicas.length
      })
    }
    case 'class:merge ordered deltas': {
      const source = new CRMap(createSnapshot(definition.n))
      const target = new CRMap(createSnapshot(definition.n))
      const deltas = collectOrderedClassDeltas(
        source,
        definition.ops,
        definition.n
      )
      return time(() => {
        for (const delta of deltas) target.merge(delta)
        return deltas.length
      })
    }
    case 'class:merge direct successor': {
      const baseSnapshot = readClassSnapshot(new CRMap())
      const source = new CRMap(baseSnapshot)
      const successor = readClassDelta(source, () => {
        source.set('name', 'alice')
      })
      if (!successor) throw new Error('direct successor class delta missing')
      const replicas = Array.from({ length: definition.ops }, () => new CRMap(baseSnapshot))
      return time(() => {
        for (const replica of replicas) replica.merge(successor)
        return replicas.length
      })
    }
    case 'class:merge shuffled gossip': {
      const source = new CRMap(createSnapshot(definition.n))
      const target = new CRMap(createSnapshot(definition.n))
      const deltas = collectMixedClassDeltas(
        source,
        definition.ops,
        definition.n
      )
      const order = shuffledIndices(deltas.length, 0xbeef)
      return time(() => {
        for (const index of order) target.merge(deltas[index])
        return order.length
      })
    }
    default:
      throw new Error(
        `unknown benchmark: ${definition.group}:${definition.name}`
      )
  }
}

function formatNumber(number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
    number
  )
}

function pad(value, width) {
  return String(value).padEnd(width, ' ')
}

function printTable(rows) {
  const columns = [
    ['group', (row) => row.group],
    ['scenario', (row) => row.name],
    ['n', (row) => formatNumber(row.n)],
    ['ops', (row) => formatNumber(row.ops)],
    ['ms', (row) => formatNumber(row.ms)],
    ['ms/op', (row) => formatNumber(row.msPerOp)],
    ['ops/sec', (row) => formatNumber(row.opsPerSecond)],
  ]
  const widths = columns.map(([header, getter]) =>
    Math.max(header.length, ...rows.map((row) => getter(row).length))
  )
  console.log(
    columns.map(([header], index) => pad(header, widths[index])).join('  ')
  )
  console.log(widths.map((width) => '-'.repeat(width)).join('  '))
  for (const row of rows) {
    console.log(
      columns
        .map(([, getter], index) => pad(getter(row), widths[index]))
        .join('  ')
    )
  }
}

const rows = BENCHMARKS.map((definition) => {
  const result = runBenchmark(definition)
  return {
    ...definition,
    ops: result.ops,
    ms: result.ms,
    msPerOp: result.ms / result.ops,
    opsPerSecond: result.ops / (result.ms / 1_000),
  }
})

console.log('CRMap benchmark')
console.log(
  `node=${process.version} platform=${process.platform} arch=${process.arch}`
)
console.log('')
printTable(rows)
