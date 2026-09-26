import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// WHY A MODEL PACKAGE'S TEST SUITE ASSERTS ON CI YAML
//
// This repo's two required status contexts — `test (24)` and `build-and-test` — were
// BOTH GitHub-hosted, so there was no self-hosted path between them. `build-and-test`
// additionally does no work: it reads `needs.test.result` and exits.
//
// On 2026-09-26 the org's Actions billing failed and GitHub stopped assigning runners to
// hosted jobs. Measured on the sibling repo bitfinex-api-node, job 108349511998:
//
//   name=build-and-test  labels=["ubuntu-latest"]  runner_name=""  steps=[]
//   started 05:55:45Z    completed 05:55:48Z       conclusion=failure
//
// Three seconds, zero steps, no runner. The asymmetry that makes this invisible: a job
// that FAILS leaves a log you can read; a job never ASSIGNED A RUNNER fails with no log,
// no step and no annotation on the check itself. And a passing hosted gate looks
// identical to a passing self-hosted one, so it never drifts loudly. A required context
// that cannot START is strictly worse than one that fails — the repo stops merging and
// the reason is written nowhere on the check.
const workflow = readFileSync(
  fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)),
  'utf8'
)

/**
 * The single-line `runs-on:` of a top-level job, or null when it has none.
 *
 * Returns null for a multi-line (block sequence) `runs-on:` too, so such a lane is
 * reported as UNVERIFIED by the test below rather than silently skipped — an unreadable
 * lane must never read as a passing one.
 */
function jobLane (yaml: string, job: string): string | null {
  const lines = yaml.split('\n')
  const start = lines.findIndex((l) => l === `  ${job}:`)
  if (start === -1) return null
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}[A-Za-z0-9_-]+:/.test(lines[i])) return null // next job; this one had none
    const m = lines[i].match(/^ {4}runs-on:\s*(.+?)\s*$/)
    if (m) return m[1]
  }
  return null
}

// A hosted label ANYWHERE in the expression is a violation, including as a fallback arm:
// the fallback is exactly the arm that runs while the variable is unset, which is the
// state this repo is in until somebody sets it.
const HOSTED = /\b(ubuntu|windows|macos)-(latest|\d)/

for (const job of ['test', 'build-and-test']) {
  test(`'${job}' declares a single-line runs-on the lane guard can read`, () => {
    assert.notEqual(
      jobLane(workflow, job),
      null,
      `job '${job}' has no single-line 'runs-on:' — write it as one so this guard can verify it`
    )
  })

  test(`'${job}' does not ride GitHub-hosted capacity`, () => {
    const lane = jobLane(workflow, job) as string
    assert.ok(
      !HOSTED.test(lane),
      `required check '${job}' runs on GitHub-hosted capacity (${lane}). An unavailable ` +
      'hosted runner does not FAIL the check — the job is created with no runner and no ' +
      'steps, so the context never arrives and every PR in this repo stops merging.'
    )
  })

  test(`'${job}' keeps a rollback knob that does not need a PR to pull`, () => {
    const lane = jobLane(workflow, job) as string
    assert.ok(
      /vars\.[A-Z_]+/.test(lane),
      `required check '${job}' has no vars.* rollback knob, so moving it off a starved ` +
      `lane would need a PR and a review — the wrong speed during an outage: ${lane}`
    )
    // This repo has no merge queue, so a `github.event_name == 'merge_group'` guard would
    // gate the knob behind an event that never fires here — an escape hatch nobody can
    // pull. BfxPingPongBot can afford that shape because it HAS a queue; this repo cannot.
    assert.ok(
      !/merge_group/.test(lane),
      `'${job}' gates its lane on merge_group, but this repo has no merge queue, so that ` +
      `arm is dead and the rollback variable is unreachable: ${lane}`
    )
  })
}
