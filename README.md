[![npm version](https://img.shields.io/npm/v/@sovereignbase/convergent-replicated-map)](https://www.npmjs.com/package/@sovereignbase/convergent-replicated-map)
[![CI](https://github.com/sovereignbase/convergent-replicated-map/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/sovereignbase/convergent-replicated-map/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/sovereignbase/convergent-replicated-map/branch/master/graph/badge.svg)](https://codecov.io/gh/sovereignbase/convergent-replicated-map)
[![license](https://img.shields.io/npm/l/@sovereignbase/convergent-replicated-map)](LICENSE)

# convergent-replicated-map

Convergent Replicated Map (CR-Map), a delta CRDT for dynamic string-keyed maps.

## Compatibility

- Runtimes: Node >= 20, modern browsers, Bun, Deno, Cloudflare Workers, Edge Runtime.
- Module format: ESM + CommonJS.
- Required globals / APIs: `EventTarget`, `CustomEvent`, `structuredClone`.
- TypeScript: bundled types.

## Goals

- Deterministic convergence of the live map projection under asynchronous gossip delivery.
- Consistent behavior across Node, browsers, worker, and edge runtimes.
- Garbage collection possibility without breaking live-view convergence.
- Event-driven API.

## Installation

```sh
npm install @sovereignbase/convergent-replicated-map
# or
pnpm add @sovereignbase/convergent-replicated-map
# or
yarn add @sovereignbase/convergent-replicated-map
# or
bun add @sovereignbase/convergent-replicated-map
```

## Usage

### Copy-paste example

```ts
import { CRMap } from '@sovereignbase/convergent-replicated-map'

type TodoValue = string | number | { done: boolean } | string[]

const alice = new CRMap<TodoValue>()
const bob = new CRMap<TodoValue>()

alice.addEventListener('delta', (event) => {
  bob.merge(event.detail)
})

alice.set('title', 'hello world')
alice.set('count', 1)
alice.set('meta', { done: true })
alice.set('tags', ['urgent', 'offline'])

console.log(bob.get('title')) // 'hello world'
console.log(bob.get('meta')) // { done: true }
console.log(bob.entries())
```

### Hydrating from a snapshot

```ts
import {
  CRMap,
  type CRMapSnapshot,
} from '@sovereignbase/convergent-replicated-map'

const source = new CRMap<string>()
let snapshot!: CRMapSnapshot<string, string>

source.addEventListener(
  'snapshot',
  (event) => {
    snapshot = event.detail
  },
  { once: true }
)

source.set('title', 'draft')
source.set('status', 'ready')
source.snapshot()

const restored = new CRMap<string>(snapshot)

console.log(restored.entries()) // [['title', 'draft'], ['status', 'ready']]
```

### Event channels

```ts
import { CRMap } from '@sovereignbase/convergent-replicated-map'

const map = new CRMap<string | number>()

map.addEventListener('delta', (event) => {
  console.log('delta', event.detail)
})

map.addEventListener('change', (event) => {
  console.log('change', event.detail)
})

map.addEventListener('snapshot', (event) => {
  console.log('snapshot', event.detail)
})

map.addEventListener('ack', (event) => {
  console.log('ack', event.detail)
})

map.set('name', 'alice')
map.set('count', 1)
map.delete('name')
map.snapshot()
map.acknowledge()
```

### Iteration and JSON serialization

```ts
import { CRMap } from '@sovereignbase/convergent-replicated-map'

const map = new CRMap<string | { done: boolean }>()

map.set('title', 'Write docs')
map.set('meta', { done: false })

const serialized = JSON.stringify(map)
const restored = new CRMap<string | { done: boolean }>(JSON.parse(serialized))

for (const [key, value] of map) {
  console.log(key, value)
}

map.forEach((value, key, target) => {
  console.log(key, value, target.size)
})

console.log(map.keys())
console.log(map.values())
console.log(map.entries())
console.log(restored.get('title')) // 'Write docs'
```

`get()`, `for...of`, `values()`, `entries()`, and `forEach()` return detached
copies of visible values. Mutating those returned values does not mutate the
underlying replica state.

### Acknowledgements and garbage collection

```ts
import { CRMap, type CRMapAck } from '@sovereignbase/convergent-replicated-map'

const alice = new CRMap<string>()
const bob = new CRMap<string>()
const frontiers = new Map<string, CRMapAck>()

alice.addEventListener('delta', (event) => bob.merge(event.detail))
bob.addEventListener('delta', (event) => alice.merge(event.detail))

alice.addEventListener('ack', (event) => {
  frontiers.set('alice', event.detail)
})

bob.addEventListener('ack', (event) => {
  frontiers.set('bob', event.detail)
})

alice.set('title', 'x')
alice.set('title', 'y')
alice.delete('title')

alice.acknowledge()
bob.acknowledge()

alice.garbageCollect([...frontiers.values()])
bob.garbageCollect([...frontiers.values()])
```

### Advanced exports

If you need to build your own string-keyed CRDT binding instead of using the
high-level `CRMap` class, the package also exports the core CRUD and MAGS
functions together with the replica and payload types.

Those low-level exports let you build custom map abstractions, protocol
wrappers, or framework-specific bindings while preserving the same convergence
rules as the default `CRMap` binding.

```ts
import {
  __create,
  __update,
  __merge,
  __snapshot,
  type CRMapDelta,
  type CRMapSnapshot,
} from '@sovereignbase/convergent-replicated-map'

const replica = __create<string>()
const local = __update('title', 'draft', replica)

if (local) {
  const outgoing: CRMapDelta<string, string> = local.delta
  const remoteChange = __merge(outgoing, replica)

  console.log(remoteChange)
}

const snapshot: CRMapSnapshot<string, string> = __snapshot(replica)
console.log(snapshot)
```

The intended split is:

- `__create`, `__read`, `__update`, `__delete` for local replica mutations.
- `__merge`, `__acknowledge`, `__garbageCollect`, `__snapshot` for gossip,
  compaction, and serialization.
- `CRMap` when you want the default event-driven class API.

## Runtime behavior

### Validation and errors

The public package exports the `CRMapErrorCode` type, which currently contains:

- `BAD_SNAPSHOT`

The current runtime surface is intentionally tolerant:

- malformed top-level merge payloads are ignored
- malformed snapshot values are dropped during hydration
- invalid UUIDs and malformed entries are ignored
- duplicate identical deltas are idempotent
- stale same-key contenders can trigger a reply delta instead of mutating live state
- non-cloneable local writes return `false` from low-level helpers instead of mutating state

### Safety and copying semantics

- Snapshots are serializable full-state payloads with `values` and `tombstones`.
- Deltas are serializable partial snapshot payloads with `values` and `tombstones`.
- `change` is a minimal key-keyed visible patch where deleted keys map to `undefined`.
- `toJSON()` returns a detached serializable snapshot.
- `get()`, `for...of`, `values()`, `entries()`, and `forEach()` expose detached copies of visible values rather than mutable references into replica state.
- `keys()`, `set()`, `delete()`, `clear()`, `merge()`, `snapshot()`, `acknowledge()`, and `garbageCollect()` all operate on the live map projection.

### Convergence and compaction

- The convergence target is the visible key-value projection, not identical internal tombstone sets.
- Same-key conflict resolution follows this order:
  - a direct descendant wins
  - the same UUID can advance via a larger predecessor
  - otherwise the larger UUIDv7 wins
- When local state already dominates an incoming contender, merge emits a reply delta instead of silently discarding that information.
- Tombstones remain until acknowledgement frontiers make them safe to collect.
- Garbage collection compacts tombstones below the smallest valid acknowledgement frontier while preserving active predecessor links.

## Tests

```sh
npm run test
```

What the current test suite covers:

- Coverage on built `dist/**/*.js`: `100%` statements, `100%` branches, `100%` functions, and `100%` lines via `c8`.
- Public `CRMap` surface: constructor, `get()`, `has()`, `set()`, `delete()`, `clear()`, iteration, `forEach()`, events, and JSON / inspect behavior.
- Core edge paths and hostile ingress handling for `__create`, `__read`, `__update`, `__delete`, `__merge`, `__snapshot`, `__acknowledge`, and `__garbageCollect`.
- Snapshot hydration edge cases for duplicate key contenders, tombstoned entries, malformed values, and stale helper-index cleanup.
- Integration convergence stress for:
  - local CRUD live-view semantics
  - snapshot hydration independent of entry order
  - merge idempotency for duplicate deltas
  - acknowledgement and garbage collection recovery
  - deterministic shuffled snapshot exchange
  - queued delta delivery with reply deltas and replica restarts
  - `25` aggressive deterministic convergence scenarios
- End-to-end runtime matrix for:
  - Node ESM
  - Node CJS
  - Bun ESM
  - Bun CJS
  - Deno ESM
  - Cloudflare Workers ESM
  - Edge Runtime ESM
  - Browsers via Playwright: Chromium, Firefox, WebKit, mobile Chrome, mobile Safari
- Current status: `npm run test` passes on Node `v22.14.0` (`win32 x64`).

## Benchmarks

```sh
npm run bench
```

The benchmark runner currently uses:

- `MAP_SIZE = 5_000`
- `OPS = 250`
- `SEED_REVISIONS = 2`
- output columns: `group`, `scenario`, `n`, `ops`, `ms`, `ms/op`, `ops/sec`

Last measured on Node `v22.14.0` (`win32 x64`):

| group   | scenario                         |     n | ops |        ms | ms/op |    ops/sec |
| ------- | -------------------------------- | ----: | --: | --------: | ----: | ---------: |
| `crud`  | `create / hydrate snapshot`      | 5,000 | 250 | 18,018.35 | 72.07 |      13.87 |
| `crud`  | `read / primitive key hit`       | 5,000 | 250 |      0.66 |  0.00 | 380,575.43 |
| `crud`  | `read / object key hit`          | 5,000 | 250 |      1.41 |  0.01 | 177,468.59 |
| `crud`  | `read / missing key`             | 5,000 | 250 |      0.83 |  0.00 | 300,516.89 |
| `crud`  | `update / overwrite string`      | 5,000 | 250 |      3.50 |  0.01 |  71,332.78 |
| `crud`  | `update / overwrite object`      | 5,000 | 250 |     23.60 |  0.09 |  10,594.43 |
| `crud`  | `delete / single key`            | 5,000 | 250 |      6.66 |  0.03 |  37,509.94 |
| `crud`  | `delete / clear all`             | 5,000 | 250 |  1,118.90 |  4.48 |     223.43 |
| `mags`  | `snapshot`                       | 5,000 | 250 |  8,610.49 | 34.44 |      29.03 |
| `mags`  | `acknowledge`                    | 5,000 | 250 |  1,557.81 |  6.23 |     160.48 |
| `mags`  | `garbage collect`                | 5,000 | 250 |    679.80 |  2.72 |     367.75 |
| `mags`  | `merge ordered deltas`           | 5,000 | 250 |      9.36 |  0.04 |  26,708.55 |
| `mags`  | `merge direct successor`         | 5,000 | 250 |      3.77 |  0.02 |  66,256.76 |
| `mags`  | `merge shuffled gossip`          | 5,000 | 250 |     17.35 |  0.07 |  14,408.64 |
| `mags`  | `merge stale conflict`           | 5,000 | 250 |      6.17 |  0.02 |  40,548.21 |
| `class` | `constructor / hydrate snapshot` | 5,000 | 250 | 17,015.31 | 68.06 |      14.69 |
| `class` | `get / primitive key`            | 5,000 | 250 |      1.46 |  0.01 | 171,797.69 |
| `class` | `get / object key`               | 5,000 | 250 |      2.61 |  0.01 |  95,928.78 |
| `class` | `has / live key`                 | 5,000 | 250 |      0.54 |  0.00 | 464,338.78 |
| `class` | `keys()`                         | 5,000 | 250 |     13.49 |  0.05 |  18,538.16 |
| `class` | `values()`                       | 5,000 | 250 |  6,861.52 | 27.45 |      36.44 |
| `class` | `entries()`                      | 5,000 | 250 |  6,839.57 | 27.36 |      36.55 |
| `class` | `set / string`                   | 5,000 | 250 |      5.46 |  0.02 |  45,782.51 |
| `class` | `set / object`                   | 5,000 | 250 |      9.07 |  0.04 |  27,556.71 |
| `class` | `delete(key)`                    | 5,000 | 250 |      4.41 |  0.02 |  56,695.77 |
| `class` | `clear()`                        | 5,000 | 250 |    889.96 |  3.56 |     280.91 |
| `class` | `snapshot`                       | 5,000 | 250 |  7,679.73 | 30.72 |      32.55 |
| `class` | `acknowledge`                    | 5,000 | 250 |  1,592.53 |  6.37 |     156.98 |
| `class` | `garbage collect`                | 5,000 | 250 |    987.88 |  3.95 |     253.07 |
| `class` | `merge ordered deltas`           | 5,000 | 250 |     37.22 |  0.15 |   6,716.31 |
| `class` | `merge direct successor`         | 5,000 | 250 |      5.78 |  0.02 |  43,232.40 |
| `class` | `merge shuffled gossip`          | 5,000 | 250 |     14.78 |  0.06 |  16,920.24 |

## License

Apache-2.0
