#!/usr/bin/env node
/**
 * Validates everything in content/puzzles/ before it ships.
 *
 * Boots Vite in middleware mode purely to load the TypeScript rules, so the
 * checker and the game share one definition of what a valid puzzle is rather
 * than drifting apart.
 *
 *   npm run puzzles:check          errors fail, warnings report
 *   npm run puzzles:check -- --strict   warnings fail too
 */
import { createServer } from 'vite'

const strict = process.argv.includes('--strict')

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

let findings
let count
try {
  const { puzzleSources } = await server.ssrLoadModule('/src/data/content.ts')
  const { validatePuzzles } = await server.ssrLoadModule('/src/data/validate.ts')
  const { resolvePuzzles } = await server.ssrLoadModule('/src/data/resolve.ts')

  findings = validatePuzzles(puzzleSources)
  count = puzzleSources.length
  // Resolution has to survive too — a puzzle that validates but throws on
  // resolve would break at runtime instead of here.
  resolvePuzzles(puzzleSources)
} finally {
  await server.close()
}

const errors = findings.filter((f) => f.level === 'error')
const warnings = findings.filter((f) => f.level === 'warning')

const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const DIM = '\x1b[2m'
const OFF = '\x1b[0m'

for (const f of [...errors, ...warnings]) {
  const tag = f.level === 'error' ? `${RED}error${OFF}` : `${YELLOW}warn ${OFF}`
  console.log(`${tag} ${DIM}${f.where}${OFF} — ${f.message}`)
}

const items = findings.length ? '\n' : ''
if (errors.length) {
  console.log(
    `${items}${RED}${errors.length} error(s)${OFF}, ${warnings.length} warning(s) across ${count} puzzles`,
  )
  process.exit(1)
}

if (warnings.length && strict) {
  console.log(`${items}${YELLOW}${warnings.length} warning(s)${OFF} across ${count} puzzles (--strict)`)
  process.exit(1)
}

console.log(
  `${items}${GREEN}✓${OFF} ${count} puzzles valid` +
    (warnings.length ? `, ${YELLOW}${warnings.length} warning(s)${OFF}` : ''),
)
