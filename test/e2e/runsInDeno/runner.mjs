import * as api from '../../../dist/index.js'
import { ensurePassing, printResults, runCRMapSuite } from '../shared/suite.mjs'

const results = await runCRMapSuite(api, { label: 'deno esm' })
printResults(results)
ensurePassing(results)
