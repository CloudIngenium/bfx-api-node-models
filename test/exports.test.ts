import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

// Consumers that resolve under the `require` condition (tsx running a .ts file outside a
// "type": "module" tree, createRequire, CommonJS tools) fail with
// ERR_PACKAGE_PATH_NOT_EXPORTED when an entry offers `import` alone.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  exports: Record<string, Record<string, string>>
}

test('every exports entry offers a default condition, on the same file as import', () => {
  for (const [subpath, conditions] of Object.entries(pkg.exports)) {
    assert.ok(conditions.default, `${subpath} has no default condition`)
    assert.equal(conditions.default, conditions.import, `${subpath}: default and import differ`)
  }
})

test('every subpath loads under the require condition (needs the build)', () => {
  const require = createRequire(import.meta.url)
  for (const subpath of Object.keys(pkg.exports)) {
    const specifier = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`
    const mod = require(specifier) as Record<string, unknown>
    assert.ok(Object.keys(mod).length > 0, `${specifier} loaded no exports`)
  }
})
