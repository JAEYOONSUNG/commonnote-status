import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { formatPercent, formatMilliseconds, overallState, safeIssueUrl, translations } from '../status-web/status.js'
import { SITES } from '../status-web/status-data.mjs'
import { buildStatusSite } from '../scripts/build-status.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('KO/EN keys match and markup contains no missing translation keys', () => {
  assert.deepEqual(Object.keys(translations.ko).sort(), Object.keys(translations.en).sort())
  for (const text of Object.values(translations).flatMap(Object.values)) assert(!/undefined|\$UPTIME|\$TIME/.test(text))
  const html = fs.readFileSync(path.join(root, 'status-web/index.html'), 'utf8')
  for (const [, key] of html.matchAll(/data-i18n="([^"]+)"/g)) assert(key in translations.ko, key)
})
test('unknown values cannot create plausible availability numbers or HTML', () => {
  for (const value of [null, undefined, 'undefined', '<img src=x onerror=alert(1)>', '101%', '-1%']) assert.equal(formatPercent(value), '—')
  assert.equal(formatPercent('100.00%'), '100%'); assert.equal(formatPercent('99.25%'), '99.25%')
  for (const value of [null, undefined, NaN, Infinity, -1, '200']) assert.equal(formatMilliseconds(value), '—')
  assert.equal(formatMilliseconds(0), '0 ms')
})
test('overall status cannot turn a stale or partial feed green', () => {
  const up = { status: 'up', stale: false }
  assert.equal(overallState([up, up, up]), 'up')
  assert.equal(overallState([up, up]), 'unknown')
  assert.equal(overallState([up, up, { ...up, stale: true }]), 'unknown')
  assert.equal(overallState([up, up, { status: 'down', stale: false }]), 'down')
})
test('incident links stay on the exact public repository', () => {
  const url = 'https://github.com/JAEYOONSUNG/commonnote-status/issues/12'
  assert.equal(safeIssueUrl({ number: 12, url }), url)
  for (const bad of ['javascript:alert(1)', 'https://example.com/', `${url}?token=secret`, 'https://github.com/other/repo/issues/12']) assert.equal(safeIssueUrl({ number: 12, url: bad }), null)
})
test('custom publishing stays separate and does not broaden repository permissions', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/commonnote-status.yml'), 'utf8')
  assert(workflow.includes('types: [completed]'))
  assert(!workflow.includes("workflow_run.conclusion == 'success'"))
  assert(workflow.includes('ref: master')); assert(workflow.includes('persist-credentials: false'))
  assert(workflow.includes('permissions: {}')); assert(workflow.includes('actions: read')); assert(workflow.includes('issues: read'))
  assert(!workflow.includes('contents: write')); assert(!workflow.includes('GH_PAT')); assert(!workflow.includes('publish_dir:'))
  assert(workflow.includes('path: _status_dist'))
  for (const [, ref] of workflow.matchAll(/uses: ([^\s#]+)/g)) assert(/@[a-f0-9]{40}$/.test(ref), ref)
  const config = fs.readFileSync(path.join(root, '.upptimerc.yml'), 'utf8')
  assert(config.includes('overallUptime: "전체 가동률 $UPTIME"'))
  assert(config.includes('averageResponseTime: "평균 응답 시간 $TIME ms"'))
})
test('build copies only static sources with root index and independent assets', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'commonnote-status-build-'))
  try {
    const feed = { generatedAt: Date.now(), sites: SITES.map((site) => ({ ...site, status: 'unknown' })), incidents: [] }
    const result = buildStatusSite(output, feed, 'a'.repeat(40))
    assert(result.files > 8)
    const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8')
    assert(html.includes('connect-src &#39;self&#39;') || html.includes("connect-src 'self'"))
    for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (url.startsWith('https://') || url.startsWith('#')) continue
      assert(url.startsWith('./'), url)
      assert(fs.existsSync(path.join(output, url)), url)
    }
    assert(fs.existsSync(path.join(output, '.nojekyll')))
    assert(!fs.existsSync(path.join(output, '.git')))
    assert(!fs.existsSync(path.join(output, 'tests')))
    assert(!fs.existsSync(path.join(output, 'scripts')))
    assert.throws(() => buildStatusSite(output, feed), /empty directory/)
    const script = fs.readFileSync(path.join(output, 'status.js'), 'utf8')
    assert(script.includes("'./status-data.json'"))
    assert(!/fetch(?:Impl)?\(['"]https:\/\/commonnote\.app|\/api\/health|\/api\/status-feed/.test(script))
    assert(!script.includes('innerHTML'))
    const info = JSON.parse(fs.readFileSync(path.join(output, 'build-info.json'), 'utf8'))
    assert.equal(info.revision, 'a'.repeat(40)); assert.equal(info.sourceHash.length, 64)
  } finally { fs.rmSync(output, { recursive: true, force: true }) }
})
