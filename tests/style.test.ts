import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { sources } from './spelling.test.js'
import { RULE_IDS } from '../src/rules/index.js'

/**
 * House style a reader would notice and a reviewer would flag. Every rule here
 * is one the PRD or the portfolio conventions state; none is taste.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DOCS = join(ROOT, 'docs')
const BASE = 'https://roanukz.github.io/agent-handoff/'

const files = () =>
  sources(ROOT)
    .filter((p) => !p.endsWith('style.test.ts'))
    .map((p) => ({ rel: relative(ROOT, p), body: readFileSync(p, 'utf8') }))

describe('punctuation and words', () => {
  it('has no em or en dashes anywhere a reader or a maintainer sees', () => {
    const hits = files().flatMap(({ rel, body }) => {
      const out: string[] = []
      body.split('\n').forEach((line, i) => {
        if (/[–—]/.test(line)) out.push(`${rel}:${i + 1}`)
      })
      return out
    })
    expect(hits).toEqual([])
  })

  it('says cut, not kill, when dropping scope', () => {
    const hits = files().filter(({ body }) => /\bkill/i.test(body)).map((f) => f.rel)
    expect(hits).toEqual([])
  })

  it('names no employer, client or vendor', () => {
    const banned = /booz\s*allen|ivalua|icertis|moveworks/i
    const hits = files().filter(({ body }) => banned.test(body)).map((f) => f.rel)
    expect(hits).toEqual([])
  })

  it('never describes the author as a non-developer', () => {
    const hits = files().filter(({ body }) => /not a developer|non-developer/i.test(body)).map((f) => f.rel)
    expect(hits).toEqual([])
  })

  it('labels every rule fixture synthetic', () => {
    for (const kind of ['fires', 'quiet']) {
      for (const name of readdirSync(join(ROOT, 'fixtures', kind))) {
        const parsed = JSON.parse(readFileSync(join(ROOT, 'fixtures', kind, name), 'utf8')) as { synthetic?: boolean }
        expect(parsed.synthetic, `${kind}/${name}`).toBe(true)
      }
    }
    const roster = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'agent-submit', 'roster.json'), 'utf8')) as { synthetic?: boolean }
    expect(roster.synthetic).toBe(true)
  })
})

describe('no model, no network', () => {
  it('only the fetch script opens a socket', () => {
    const suspects = /\b(fetch\(|XMLHttpRequest|WebSocket|sendBeacon|from 'node:http|from 'node:https|from 'node:net|require\('http)/
    const hits = files()
      .filter(({ rel }) => /^(src|web)\//.test(rel) && rel !== 'src/cli/fetch-whowhen.ts')
      .filter(({ body }) => suspects.test(body))
      .map((f) => f.rel)
    expect(hits).toEqual([])
  })

  it('nothing imports a model SDK', () => {
    const hits = files().filter(({ rel, body }) => /^(src|web|tests)\//.test(rel) && /@anthropic-ai\/sdk|openai|claude-agent-sdk/.test(body)).map((f) => f.rel)
    expect(hits).toEqual([])
  })
})

describe('teardown page', () => {
  const html = () => readFileSync(join(DOCS, 'index.html'), 'utf8')

  it('exists with the shared hero: eyebrow, product name as h1, byline, two calls to action, facts strip', () => {
    const page = html()
    expect(page).toContain('<p class="eyebrow">Product teardown</p>')
    expect(page).toMatch(/<h1>Did My Agents Hand Off\?<\/h1>/)
    expect(page).toContain('Roanuk Zaman &middot; Product teardown of a tool I designed, directed')
    expect(page).toContain('class="facts"')
    expect((page.match(/class="btn btn-/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('keeps the search title suffix and carries the required metadata block', () => {
    const page = html()
    expect(page).toContain('<title>Did My Agents Hand Off? A Product Teardown</title>')
    expect(page).toContain('<meta name="author" content="Roanuk Zaman" />')
    expect(page).toContain('<meta property="article:author" content="Roanuk Zaman" />')
    expect(page).toContain(`content="${BASE}og-image.png"`)
    expect(page).toContain('property="og:image:width" content="2400"')
    expect(page).toContain('property="og:image:height" content="1254"')
    expect(page).toContain('property="og:image:alt"')
    expect(page).toContain('name="twitter:card" content="summary_large_image"')
    expect(page).toContain(`property="og:url" content="${BASE}"`)
    expect(page).toContain('property="og:type" content="article"')
  })

  it('numbers body parts with Arabic numerals and the contents rail repeats the kicker text', () => {
    const page = html()
    const kickers = [...page.matchAll(/<p class="section-kicker">(Part \d+)<\/p>/g)].map((m) => m[1])
    expect(kickers.length).toBeGreaterThanOrEqual(8)
    kickers.forEach((label, i) => expect(label).toBe(`Part ${i + 1}`))
    kickers.forEach((_, i) => expect(page).toMatch(new RegExp(`<li><a href="#[a-z-]+">${i + 1}\\. `)))
  })

  it('names every rule in the catalog', () => {
    const page = html()
    for (const id of RULE_IDS) expect(page, id).toContain(`<code>${id}</code>`)
  })

  it('makes no network request of its own', () => {
    for (const name of ['index.html', 'tool.html']) {
      const page = readFileSync(join(DOCS, name), 'utf8')
      for (const banned of ['<script src="http', 'fonts.googleapis', '@import url(http', 'cdn.']) expect(page, name).not.toContain(banned)
    }
  })

  it('reports the corpus and calibration numbers from the generated files, not by hand', () => {
    const corpus = JSON.parse(readFileSync(join(ROOT, 'results', 'agent-submit.json'), 'utf8')) as {
      runs: number
      formats: Record<string, number>
      ruleCount: number
    }
    const calibration = JSON.parse(readFileSync(join(ROOT, 'results', 'calibration.json'), 'utf8')) as {
      records: number
      stepHitRate: number
      agentHitRate: number
    }
    const page = html()
    expect(page).toContain(`${corpus.runs} runs`)
    expect(page).toContain(`${corpus.ruleCount} rules`)
    expect(page).toContain(`${calibration.records} labeled`)
    expect(page).toContain(`${Math.round(calibration.stepHitRate * 100)}%`)
  })
})

describe('share cards', () => {
  for (const name of ['og-image', 'og-tool']) {
    const svgPath = join(DOCS, `${name}.svg`)
    const pngPath = join(DOCS, `${name}.png`)

    it(`${name} exists as SVG source and a rendered PNG at two times 1200 by 627`, () => {
      expect(existsSync(svgPath)).toBe(true)
      expect(existsSync(pngPath)).toBe(true)
      const blob = readFileSync(pngPath)
      expect(blob.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      expect(blob.readUInt32BE(16)).toBe(2400)
      expect(blob.readUInt32BE(20)).toBe(1254)
      expect(readFileSync(svgPath, 'utf8')).toContain('viewBox="0 0 1200 627"')
    })

    it(`${name} keeps every element inside the 540px center column and fetches nothing`, () => {
      const body = readFileSync(svgPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
      for (const m of body.matchAll(/<rect[^>]*?x="([\d.]+)"[^>]*?width="([\d.]+)"/g)) {
        const x = Number(m[1])
        const w = Number(m[2])
        if (w >= 1200) continue
        expect(x).toBeGreaterThanOrEqual(330)
        expect(x + w).toBeLessThanOrEqual(870)
      }
      for (const m of body.matchAll(/<line[^>]*?x1="([\d.]+)"[^>]*?x2="([\d.]+)"/g)) {
        for (const v of [Number(m[1]), Number(m[2])]) {
          expect(v).toBeGreaterThanOrEqual(330)
          expect(v).toBeLessThanOrEqual(870)
        }
      }
      for (const banned of ['<image', 'xlink:href', '@import', 'url(http', '.woff', '<use']) expect(body).not.toContain(banned)
    })
  }
})
