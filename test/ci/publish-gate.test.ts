import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// models-publish-dispatch-08: publish.yml also runs on workflow_dispatch, which
// can target any branch, and the tag/manifest version check is skipped off a
// tag. Without a job-level gate a manual run on a branch published that branch.
const body = readFileSync(
  fileURLToPath(new URL('../../.github/workflows/publish.yml', import.meta.url)), 'utf8')

/** Comment-stripped, so prose ABOUT the gate does not satisfy it. */
const code = body.split('\n').map((l) => l.replace(/(^|\s)#.*$/, '')).join('\n')

/** The `publish:` job block: from its key to the next two-space job key or EOF. */
function publishJob (): string {
  const start = code.search(/^ {2}publish:\s*$/m)
  assert.ok(start >= 0, 'publish.yml has no publish job')
  const rest = code.slice(start + 1)
  const next = rest.search(/^ {2}[A-Za-z0-9_-]+:\s*$/m)
  return next >= 0 ? rest.slice(0, next) : rest
}

test('publish.yml can still be dispatched by hand', () => {
  assert.match(code, /^\s+workflow_dispatch:/m)
})

test('the publish job runs only on a refs/tags/v* ref', () => {
  assert.match(publishJob(), /^ {4}if: startsWith\(github\.ref, 'refs\/tags\/v'\)\s*$/m)
})
