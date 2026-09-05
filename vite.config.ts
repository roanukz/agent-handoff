/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const here = (file: string) => fileURLToPath(new URL(`./${file}`, import.meta.url))

/**
 * The zero-network promise, enforced by the browser rather than asserted in
 * prose. default-src 'none' covers connect-src, so fetch, XHR, WebSocket and
 * sendBeacon are refused even if a future dependency tries one. style-src
 * carries 'unsafe-inline' only because the score meter's width is a computed
 * style; that permits styling, never a request. Build only: the dev server
 * needs its hot reload socket.
 */
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'"

const cspMeta = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend'
      }
    ]
  }
})

export default defineConfig({
  // Relative asset paths, so the built page works at any URL and from a
  // local folder with no server, which is what "works offline" means here.
  base: './',
  root: here('web'),
  publicDir: false,
  plugins: [cspMeta()],
  build: {
    outDir: here('docs'),
    // docs/ also holds the hand-written teardown, its stylesheet and the
    // share cards. Vite writes tool.html and its assets beside them.
    emptyOutDir: false,
    target: 'es2022',
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { tool: here('web/tool.html') }
    }
  },
  test: {
    root: here('.'),
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
