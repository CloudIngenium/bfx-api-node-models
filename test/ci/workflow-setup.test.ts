import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// A PIN IS A VERSION NOBODY IS WATCHING.
//
// Until 2026-09-26 this repo pinned CloudIngenium/ci-actions/setup-node-pnpm at 8ff1a2a4,
// four commits behind the 7d65852f that bfx-api-node-rest and bitfinex-api-node use. The
// gap was not cosmetic. That older revision takes pnpm from a HARDCODED input defaulting
// to 11.12.0 and never reads package.json at all, so every CI run here installed pnpm
// 11.12.0 while this package declared `packageManager: pnpm@11.18.0`. Measured in the run
// of 2026-09-26T16:51Z: `pnpm-version: 11.12.0`.
//
// Nothing failed. `pnpm install --frozen-lockfile` ran under a pnpm six minors away from
// the one that wrote the lockfile, and reported success — which is the whole problem. A
// version skew that fails is a bug; a version skew that passes is a lie that compounds.
//
// The pin was also commented `# v1`, a tag that has never existed: CloudIngenium/ci-actions
// carries no tags at all. Readers, and Dependabot, reason about the comment while the job
// runs the SHA — so a "bump" can be a silent downgrade. The comment is gone rather than
// corrected, matching the form the sibling repos use.
const WORKFLOW_DIR = fileURLToPath(new URL('../../.github/workflows/', import.meta.url))
const SETUP_ACTION = 'CloudIngenium/ci-actions/setup-node-pnpm'

interface Workflow { readonly name: string, readonly body: string }

function workflows (): Workflow[] {
  return readdirSync(WORKFLOW_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((name) => ({ name, body: readFileSync(WORKFLOW_DIR + name, 'utf8') }))
}

/** Comment-stripped, so prose ABOUT a rule does not read as a violation of it. */
function code (body: string): string {
  return body.split('\n').map((l) => l.replace(/(^|\s)#.*$/, '')).join('\n')
}

function actionRefs (): { file: string, ref: string }[] {
  return workflows().flatMap((w) =>
    [...code(w.body).matchAll(new RegExp(`${SETUP_ACTION}@(\\S+)`, 'g'))]
      .map((m) => ({ file: w.name, ref: m[1] })))
}

test('finds workflows to check, so this suite cannot pass vacuously', () => {
  assert.ok(workflows().length > 0, `no workflow files under ${WORKFLOW_DIR}`)
})

test('every use of the shared setup action is pinned by full SHA', () => {
  const refs = actionRefs()
  assert.ok(refs.length > 0, `no workflow uses ${SETUP_ACTION}`)
  for (const r of refs) {
    // A moving ref — a branch, or a tag someone can retarget — is remote code execution
    // with extra steps: the job runs whatever it points at on the day it runs.
    assert.match(r.ref, /^[0-9a-f]{40}$/,
      `${r.file} uses ${SETUP_ACTION}@${r.ref} — pin a full 40-character SHA`)
  }
})

test('every workflow pins the SAME version of the shared setup action', () => {
  const refs = new Set(actionRefs().map((r) => r.ref))
  assert.strictEqual(refs.size, 1,
    `workflows pin ${refs.size} different versions of ${SETUP_ACTION}: ${[...refs].join(', ')}. ` +
    'Two pins for one action means the workflows disagree about what "the shared setup" ' +
    'is, and only one of them receives the next fix.')
})

test('CI resolves pnpm from packageManager, never from a hardcoded input', () => {
  // This is the assertion that would have caught the 11.12.0-vs-11.18.0 skew. Passing
  // `pnpm-version:` re-creates it by hand: the workflow then pins a pnpm that package.json
  // does not know about, and the two drift apart in silence.
  const offenders = workflows()
    .filter((w) => /^\s*pnpm-version:/m.test(code(w.body)))
    .map((w) => w.name)

  assert.deepEqual(offenders, [],
    `these workflows pass an explicit pnpm-version: ${offenders.join(', ')}. Let the action ` +
    'read packageManager from package.json instead, so there is exactly one place that ' +
    'says which pnpm this package uses.')
})

test('package.json declares the packageManager the action will resolve', () => {
  // The other half of the same invariant: the action reads this field, so its absence
  // would send CI silently back to the action's own fallback version.
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')
  ) as { packageManager?: string }
  assert.match(pkg.packageManager ?? '', /^pnpm@\d+\.\d+\.\d+/,
    'package.json has no exact pnpm packageManager — CI would fall back to the action default')
})
