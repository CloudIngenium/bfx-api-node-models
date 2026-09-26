import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// THIS PACKAGE IS PUBLIC, AND THAT INVERTS THE FLEET'S RUNNER RULE.
//
// Across CloudIngenium's PRIVATE repos the standing rule is the opposite of what this
// file asserts: a REQUIRED status check must not ride GitHub-hosted capacity, because on
// 2026-09-26 the org's Actions billing failed ("recent account payments have failed or
// your spending limit needs to be increased") and hosted jobs stopped being ASSIGNED A
// RUNNER — created with no runner and NO STEPS, dead in ~3 s, leaving no log and no
// annotation on the check. A required context that cannot START freezes every merge, and
// says why nowhere. Five sibling repos were moved to self-hosted lanes that day.
//
// THIS REPO MUST NOT FOLLOW THEM, and the reason is a property of its visibility:
//
//   * It is PUBLIC. Every CloudIngenium org runner group reports
//     `allows_public_repositories: false` (Default id=1 and id=3, MCP-Deploy, azure-burst
//     — checked 2026-09-26). GitHub therefore never assigns an org self-hosted runner to
//     a job from this repository. The job does not fail; it QUEUES FOREVER.
//   * Because it is public, its GitHub-hosted minutes are FREE and are not drawn against
//     the org spending limit — so the billing failure that froze the private repos never
//     touched this one. Its run history confirms it: no failed run at all, and no run
//     during the 2026-09-26 outage window.
//
// Both halves were measured the hard way. A first attempt at this repo copied the sibling
// fix and routed `test` to Build-Light: the job sat QUEUED for 464 minutes while six of
// the seven Build-Light runners were idle, because an idle runner a repo is not permitted
// to use is not capacity. That attempt is what this guard now prevents from recurring —
// including by me. The cheapest failure here is loud; the expensive one is silent.
const workflow = readFileSync(
  fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)),
  'utf8'
)

/**
 * The single-line `runs-on:` of a top-level job, or null when it has none.
 *
 * Returns null for a multi-line (block sequence) `runs-on:` too, so such a lane is
 * reported as UNVERIFIED by the tests below rather than silently skipped — an unreadable
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

// The repo's required contexts, per the branch-protection ruleset on master.
// `test (24)` is the matrix job's rendered name; `build-and-test` mirrors it.
const REQUIRED_JOBS = ['test', 'build-and-test']

// `self-hosted` is the label that makes a job unroutable HERE. A hosted label anywhere is
// fine; a self-hosted one anywhere — including as the fallback arm of a `vars.*` selector,
// which is exactly the arm that runs while the variable is unset — is not.
const SELF_HOSTED = /self-hosted/

for (const job of REQUIRED_JOBS) {
  test(`'${job}' declares a single-line runs-on the lane guard can read`, () => {
    assert.notEqual(
      jobLane(workflow, job),
      null,
      `job '${job}' has no single-line 'runs-on:' — write it as one so this guard can verify it`
    )
  })

  test(`'${job}' stays on GitHub-hosted capacity, because this repo is public`, () => {
    const lane = jobLane(workflow, job) as string
    assert.ok(
      !SELF_HOSTED.test(lane),
      `required check '${job}' selects a self-hosted lane (${lane}). This repository is ` +
      'PUBLIC and every CloudIngenium runner group sets allows_public_repositories=false, ' +
      'so GitHub will never assign it one: the job QUEUES FOREVER rather than failing, and ' +
      'the PR is blocked by a check that never reports. Measured 2026-09-26 — 464 minutes ' +
      'queued with six of seven Build-Light runners idle. The private-repo rule (keep ' +
      'required checks OFF hosted capacity) does not transfer to this repo; hosted minutes ' +
      'are free here and are not billed against the org spending limit.'
    )
  })

  test(`'${job}' pins a hosted image rather than leaving the lane implicit`, () => {
    const lane = jobLane(workflow, job) as string
    assert.match(
      lane,
      /\b(ubuntu|windows|macos)-(latest|\d)/,
      `required check '${job}' names no GitHub-hosted image (${lane}). On a public repo ` +
      'that is the only lane it can actually be assigned to.'
    )
  })
}

// The block above guards the REQUIRED checks in ci.yml. But the constraint that makes a
// self-hosted lane unroutable here is a property of the REPOSITORY, not of a check's
// required-ness: `allows_public_repositories: false` applies to every job this repo
// starts. A non-required job on a self-hosted lane does not fail either — it queues
// forever, reporting nothing, which is the quietest way for an observer to be dead.
//
// So this widens the rule to every workflow file, and it is deliberately blunt: it scans
// comment-stripped YAML for the label anywhere, including inside the fallback arm of a
// `fromJSON(vars.X || '["self-hosted",...]')` selector — the arm that runs precisely when
// the variable is unset, which is the state a new repo is in.
test('no workflow in this PUBLIC repo selects a self-hosted lane', () => {
  const dir = fileURLToPath(new URL('../../.github/workflows/', import.meta.url))
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  assert.ok(files.length > 0, 'no workflows found — this guard would pass vacuously')

  const offenders: string[] = []
  for (const f of files) {
    const body = readFileSync(dir + f, 'utf8')
      .split('\n')
      .map((l) => l.replace(/(^|\s)#.*$/, ''))  // drop comments; they may discuss the rule
      .join('\n')
    if (SELF_HOSTED.test(body)) offenders.push(f)
  }

  assert.deepEqual(offenders, [],
    `these workflows name a self-hosted runner: ${offenders.join(', ')}. This repository ` +
    'is PUBLIC and every CloudIngenium runner group sets allows_public_repositories=false, ' +
    'so GitHub never assigns one — the job QUEUES FOREVER rather than failing. Measured ' +
    '2026-09-26: 464 minutes queued with six of seven Build-Light runners idle.')
})
