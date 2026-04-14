import * as api from '/dist/index.js'
import { printResults, runCRMapSuite } from '../shared/suite.mjs'

const results = await runCRMapSuite(api, { label: 'browser esm' })
printResults(results)
window.__CRMAP_RESULTS__ = results

const status = document.getElementById('status')
if (status) {
  status.textContent = results.ok ? 'ok' : `failed: ${results.errors.length}`
}
