#!/usr/bin/env node
// Writes (default) or verifies (--check) standards/generated/package-source.json, the
// committed cloudingenium.package-source/v1 catalog blob. A `package-source-published` event
// points Knowledge-Hub at this file at the exact release commit; its ingest re-reads it there
// and queues the release for the shared drain, which opens the consumer lockfile bumps
// (Knowledge-Hub docs/PACKAGE-SOURCE-CONTRACT.md). This repo is public, so publish.yml
// cannot send that event itself yet: see the note at the end of publish.yml.
// Mirrors bfx-bot-shared-types/scripts/generate-package-source.mjs.
//
// Release flow: bump package.json, run `pnpm package-source:generate`, commit both, tag.
// `--check` fails when the committed file no longer matches what this script would write
// (version, consumers, checks...), so a tag cannot publish a release the event cannot carry.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { pathToFileURL } from 'node:url'

export const PACKAGE_SOURCE_SCHEMA = 'cloudingenium.package-source/v1'
export const PRODUCER = 'bfx-api-node-models'
export const SOURCE_PATH = 'standards/generated/package-source.json'

// The repositories whose manifests declare this package (fleet census and org code
// search). Knowledge-Hub reports drift both ways, so keep this list current.
export const EXPECTED_CONSUMERS = ['BfxPingPongBot', 'bfx-api-node-rest', 'bitfinex-api-node']

// What publish.yml verifies before and after `pnpm publish`.
export const CHECKS = ['build', 'lint', 'test', 'package-artifact', 'registry-tarball']

export function buildPackageSource (pkg, { publishedAt = new Date().toISOString() } = {}) {
  return {
    schemaVersion: PACKAGE_SOURCE_SCHEMA,
    producer: PRODUCER,
    publishedAt,
    packages: [{
      name: pkg.name,
      version: pkg.version,
      ecosystem: 'npm',
      owner: 'Trading',
      maturity: 'stable',
      compatibility: {
        node: pkg.engines?.node ?? '>=24.0.0'
      },
      checks: [...CHECKS],
      expectedConsumers: [...EXPECTED_CONSUMERS]
    }]
  }
}

export function writePackageSource ({
  packagePath = 'package.json',
  outputPath = SOURCE_PATH,
  publishedAt = process.env.PACKAGE_SOURCE_PUBLISHED_AT
} = {}) {
  const pkg = JSON.parse(readFileSync(resolve(packagePath), 'utf8'))
  const source = buildPackageSource(pkg, { publishedAt: publishedAt || new Date().toISOString() })
  mkdirSync(dirname(resolve(outputPath)), { recursive: true })
  writeFileSync(resolve(outputPath), `${JSON.stringify(source, null, 2)}\n`)
  return source
}

export function checkPackageSource ({
  packagePath = 'package.json',
  sourcePath = SOURCE_PATH
} = {}) {
  const pkg = JSON.parse(readFileSync(resolve(packagePath), 'utf8'))
  const source = JSON.parse(readFileSync(resolve(sourcePath), 'utf8'))
  const publishedAt = source?.publishedAt
  if (typeof publishedAt !== 'string' || Number.isNaN(Date.parse(publishedAt))) {
    throw new Error(`${sourcePath} has no valid publishedAt; run pnpm package-source:generate`)
  }
  if (!isDeepStrictEqual(source, buildPackageSource(pkg, { publishedAt }))) {
    throw new Error(`${sourcePath} does not match package.json; run pnpm package-source:generate`)
  }
  return source
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const check = process.argv.includes('--check')
    const source = check ? checkPackageSource() : writePackageSource()
    const [pkg] = source.packages
    process.stdout.write(`${check ? 'Verified' : 'Generated'} ${source.schemaVersion} for ${pkg.name}@${pkg.version}.\n`)
  } catch (error) {
    process.stderr.write(`[package-source] ${error.message}\n`)
    process.exitCode = 1
  }
}
