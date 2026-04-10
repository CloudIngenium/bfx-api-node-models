#!/usr/bin/env node
// Post-build guard: catches the class of bug shipped in 10.0.0 where dist/
// imported named exports from the CJS `bfx-api-node-util` package, which
// Node 24 ESM rejects at load time. Two checks:
//   1. Static grep — no file under dist/ may import from `bfx-api-node-util`.
//   2. Smoke load — actually `import('./dist/index.js')` and verify it resolves.

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(repoRoot, 'dist')

const FORBIDDEN_SPECIFIERS = ['bfx-api-node-util']

async function* walk (dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile() && full.endsWith('.js')) yield full
  }
}

const offenders = []
for await (const file of walk(distDir)) {
  const src = await readFile(file, 'utf8')
  for (const spec of FORBIDDEN_SPECIFIERS) {
    const re = new RegExp(`from ['"]${spec.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`)
    if (re.test(src)) offenders.push([relative(repoRoot, file), spec])
  }
}

if (offenders.length > 0) {
  console.error('check-dist: forbidden imports found in dist/:')
  for (const [f, s] of offenders) console.error(`  ${f} → ${s}`)
  console.error('\nThese specifiers are CJS packages and break Node 24 ESM named imports.')
  console.error('Fix the source so it imports from a local module instead.')
  process.exit(1)
}

try {
  const mod = await import(join(distDir, 'index.js'))
  const exportCount = Object.keys(mod).length
  if (exportCount === 0) throw new Error('dist/index.js loaded but exports nothing')
  console.log(`check-dist: OK (${exportCount} exports, no forbidden imports)`)
} catch (err) {
  console.error('check-dist: dist/index.js failed to load on Node', process.version)
  console.error(err)
  process.exit(1)
}
