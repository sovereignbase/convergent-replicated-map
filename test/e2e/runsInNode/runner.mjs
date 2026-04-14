import { createRequire } from 'node:module'
import * as esmApi from '../../../dist/index.js'
import { ensurePassing, printResults, runCRMapSuite } from '../shared/suite.mjs'

const require = createRequire(import.meta.url)
const cjsApi = require('../../../dist/index.cjs')

for (const [label, api] of [
  ['node esm', esmApi],
  ['node cjs', cjsApi],
]) {
  const results = await runCRMapSuite(api, { label })
  printResults(results)
  ensurePassing(results)
}
