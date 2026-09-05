/**
 * A closed icon set whose shapes differ, not only their colors: notice is the
 * only square, warning the only triangle, and info, success and error are
 * circles that differ in what is inside them, so every status stays readable
 * with all color removed. An icon always sits beside a word, never alone.
 */

export type IconName = 'success' | 'error' | 'warning' | 'notice' | 'info'

const ICON_PATHS: Record<IconName, string> = {
  success: '<circle cx="8" cy="8" r="6.25"/><path d="m5.25 8.25 1.9 1.9 3.6-4.1"/>',
  error: '<circle cx="8" cy="8" r="6.25"/><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"/>',
  warning: '<path d="M8 2.2 14.4 13.3H1.6Z"/><path d="M8 6.4v3.1"/><path d="M8 11.5h.01"/>',
  notice: '<rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.5"/><path d="M5 6.25h6M5 9.25h4"/>',
  info: '<circle cx="8" cy="8" r="6.25"/><path d="M8 7.2v4"/><path d="M8 4.9h.01"/>'
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'icon')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.6')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  // Static, trusted constants from ICON_PATHS only, never user content.
  svg.innerHTML = ICON_PATHS[name]
  return svg
}
