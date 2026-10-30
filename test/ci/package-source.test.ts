import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error -- a plain .mjs script with no declarations; tests are not type-checked
import { buildPackageSource, checkPackageSource, SOURCE_PATH } from '../../scripts/generate-package-source.mjs'

// Knowledge-Hub's ingest fetches standards/generated/package-source.json at the release
// commit and rejects a catalog whose package set or version differs from the event.
const root = fileURLToPath(new URL('../..', import.meta.url))
const code = (path: string): string =>
  readFileSync(join(root, path), 'utf8').split('\n').map((l) => l.replace(/(^|\s)#.*$/, '')).join('\n')

describe('package-source catalog', () => {
  it('the committed catalog matches package.json', () => {
    const source = checkPackageSource({
      packagePath: join(root, 'package.json'),
      sourcePath: join(root, SOURCE_PATH)
    })
    assert.strictEqual(source.producer, 'bfx-api-node-models')
    assert.strictEqual(source.packages[0].owner, 'Trading')
  })

  it('a stable package declares at least two expected consumers', () => {
    const [pkg] = buildPackageSource({ name: '@cloudingenium/bfx-api-node-models', version: '1.0.0' }).packages
    assert.strictEqual(pkg.maturity, 'stable')
    assert.ok(pkg.expectedConsumers.length >= 2)
  })

  it('rejects a catalog left behind by a version bump', () => {
    const dir = mkdtempSync(join(tmpdir(), 'package-source-'))
    const pkg = { name: '@cloudingenium/bfx-api-node-models', version: '1.0.0', engines: { node: '>=24.0.0' } }
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ ...pkg, version: '1.1.0' }))
    writeFileSync(join(dir, 'source.json'), JSON.stringify(buildPackageSource(pkg, { publishedAt: '2026-10-30T00:00:00.000Z' })))
    assert.throws(
      () => checkPackageSource({ packagePath: join(dir, 'package.json'), sourcePath: join(dir, 'source.json') }),
      /does not match package\.json/
    )
  })
})

describe('package-source release gate', () => {
  it('publish.yml checks the catalog before a tag can publish', () => {
    assert.match(code('.github/workflows/publish.yml'), /^ {6}- run: pnpm run package-source:check\s*$/m)
  })

  // The dispatch mints the org automation App key, which must stay on an on-prem VM, and
  // this PUBLIC repo can never be assigned one (required-check-lanes.test.ts).
  it('publish.yml never mints the org automation App key on a hosted runner', () => {
    assert.doesNotMatch(code('.github/workflows/publish.yml'), /CLOUDINGENIUM_AUTOMATION_PRIVATE_KEY/)
  })
})
