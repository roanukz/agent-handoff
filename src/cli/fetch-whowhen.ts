/**
 * Download the Who&When labeled set (184 JSON records) from the authors'
 * repository into data/whowhen/, which is gitignored. This is the only file
 * in the project that opens a socket. The set is MIT licensed; the records
 * embed task text from GAIA and AssistantBench, which is why it is fetched
 * rather than vendored.
 *
 * Source: https://github.com/mingyin1/Agents_Failure_Attribution
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './load.js'

const REPO = 'mingyin1/Agents_Failure_Attribution'
const RAW = `https://raw.githubusercontent.com/${REPO}/main/`
const OUT = join(ROOT, 'data', 'whowhen')

async function main() {
  const tree = (await (await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`)).json()) as { tree: Array<{ path: string; type: string }> }
  const files = tree.tree.filter((t) => t.type === 'blob' && /^Who&When\/(Hand-Crafted|Algorithm-Generated)\/\d+\.json$/.test(t.path))
  if (files.length === 0) throw new Error('No records found in the repository tree; has the layout changed?')
  mkdirSync(OUT, { recursive: true })
  const license = await (await fetch(`${RAW}LICENSE`)).text()
  writeFileSync(join(OUT, 'LICENSE'), license)
  writeFileSync(
    join(OUT, 'README.md'),
    `# Who&When, fetched copy\n\nFetched from https://github.com/${REPO} by \`npm run fetch:whowhen\`. Not committed. See LICENSE in this folder. Cite: Zhang et al., "Which Agent Causes Task Failures and When?", ICML 2025, arXiv:2505.00212.\n`
  )
  let n = 0
  for (const f of files) {
    const rel = f.path.replace(/^Who&When\//, '')
    const dest = join(OUT, rel)
    if (existsSync(dest)) {
      n++
      continue
    }
    mkdirSync(join(OUT, rel.split('/')[0]!), { recursive: true })
    const res = await fetch(RAW + encodeURI(f.path).replace('&', '%26'))
    if (!res.ok) throw new Error(`${f.path}: ${res.status}`)
    writeFileSync(dest, await res.text())
    n++
    if (n % 20 === 0) console.log(`${n} of ${files.length}`)
  }
  console.log(`${n} records in ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
