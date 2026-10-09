import { lineMd } from './line-md';

/**
 * Inline SVG icon set shared by Astro components and the game script.
 * Most icons are the animated Material Line Icons (line-md, see scripts/gen-icons.mjs);
 * the few without an animated equivalent stay as static paths.
 */
const staticPaths = {
  'heart-crack': '<path d="M19 14c1.5-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" fill="currentColor" fill-opacity=".25"/><path d="m12 13-1-1 2-2-3-3 2-2"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
} as const;

export type IconName = keyof typeof staticPaths | 'refresh' | 'arrow-right' | 'play' | 'pause' | 'volume-on' | 'volume-off' | 'heart' | 'trophy' | 'check' | 'x' | 'zap';

export function icon(name: IconName, cls = ''): string {
  const body = lineMd[name] ?? staticPaths[name as keyof typeof staticPaths];
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Replays the draw-in animation of every icon inside `root` (used when a hidden screen is shown). */
export function replayIcons(root: ParentNode) {
  root.querySelectorAll('svg').forEach((svg) => (svg as SVGSVGElement).setCurrentTime?.(0));
}
