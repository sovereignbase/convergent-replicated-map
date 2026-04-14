import test from 'node:test'
import * as api from '../../dist/index.js'
import {
  ensurePassing,
  printResults,
  runCRMapSuite,
} from '../e2e/shared/suite.mjs'

test('unit: CRMap core invariants', async () => {
  const results = await runCRMapSuite(api, {
    label: 'unit',
    includeStress: false,
    stressRounds: 4,
  })
  printResults(results)
  ensurePassing(results)
})
