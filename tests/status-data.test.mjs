import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadStatusFeed, ageStatusFeed, SITES, STATUS_REPO } from '../status-web/status-data.mjs'

const NOW = Date.parse('2026-09-06T10:00:00.000Z')
const DAY = 86_400_000
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
const summary = () => SITES.map(site => ({
  ...site, status: 'up', uptimeDay: '100.00%', uptimeWeek: '99.90%', uptimeMonth: '99.50%', uptimeYear: '99.00%',
  timeDay: 543, timeWeek: 567, timeMonth: 589, timeYear: 600, dailyMinutesDown: { '2026-09-05': 12, '2026-09-06': 0 },
}))
const history = (site, values = {}) => Object.entries({
  url: site.url, status: 'up', lastUpdated: new Date(NOW - 60_000).toISOString(),
  startTime: '2026-09-03T15:21:06.769Z', ...values,
}).map(([key, value]) => `${key}: ${value}`).join('\n')
const issue = (number = 1, overrides = {}) => ({
  number, title: 'CommonNote API is down', html_url: `https://github.com/${STATUS_REPO}/issues/${number}`,
  created_at: '2026-09-05T09:00:00.000Z', closed_at: null, state: 'open',
  labels: [{ name: 'status' }, { name: SITES[0].slug }], ...overrides,
})

const monitor = overrides => ({
  id: 12345, run_attempt: 1, name: 'Uptime CI', path: '.github/workflows/uptime.yml', head_branch: 'master',
  repository: { full_name: STATUS_REPO }, head_repository: { full_name: STATUS_REPO }, head_sha: 'a'.repeat(40),
  event: 'schedule', status: 'completed', conclusion: 'success', html_url: `https://github.com/${STATUS_REPO}/actions/runs/12345`,
  run_started_at: new Date(NOW - 30_000).toISOString(), updated_at: new Date(NOW - 10_000).toISOString(), ...overrides,
})
const monitorJobs = overrides => ({ total_count: 1, jobs: [{
  name: 'Check status', run_id: 12345, run_attempt: 1, head_sha: 'a'.repeat(40), status: 'completed', conclusion: 'success',
  started_at: new Date(NOW - 29_000).toISOString(), completed_at: new Date(NOW - 11_000).toISOString(),
  steps: [{ name: 'Check endpoint status', status: 'completed', conclusion: 'success', started_at: new Date(NOW - 28_000).toISOString(), completed_at: new Date(NOW - 12_000).toISOString() }],
  ...overrides,
}] })

function fixture({ rows = summary(), histories = {}, open = [], closed = [], run = monitor(), jobs = monitorJobs(), intercept } = {}) {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    const parsed = new URL(url)
    if (intercept) {
      const result = await intercept(parsed, options)
      if (result !== undefined) return result
    }
    if (parsed.pathname.endsWith('/summary.json')) return json(rows)
    if (parsed.hostname === 'raw.githubusercontent.com') {
      const site = SITES.find(site => parsed.pathname.endsWith(`/${site.slug}.yml`))
      assert.ok(site, `Unknown requested history: ${parsed.pathname}`)
      return new Response(histories[site.slug] ?? history(site))
    }
    assert.equal(parsed.hostname, 'api.github.com')
    if (parsed.pathname.endsWith('/actions/workflows/uptime.yml/runs')) return json({ workflow_runs: run ? [run] : [] })
    if (parsed.pathname.includes('/attempts/')) return json(jobs)
    assert.equal(parsed.pathname, `/repos/${STATUS_REPO}/issues`)
    return json(parsed.searchParams.get('state') === 'open' ? open : closed)
  }
  return { calls, fetchImpl }
}

test('fixed three service cards combine verified observations with validated historical statistics', async () => {
  const source = fixture()
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.equal(feed.generatedAt, NOW)
  assert.equal(feed.observedAt, NOW - 60_000)
  assert.equal(feed.stale, false)
  assert.equal(feed.sites.length, 3)
  assert.equal(feed.source, `https://github.com/${STATUS_REPO}`)
  assert.equal(feed.monitoringSince, '2026-09-03T15:21:06.769Z')
  for (const site of feed.sites) {
    assert.equal(site.status, 'up')
    assert.equal(site.recordedStatus, 'up')
    assert.equal(site.lastRecordedAt, NOW - 60_000)
    assert.equal(site.monitoringSince, feed.monitoringSince)
    assert.equal(site.uptimeWeek, '99.90%')
    assert.equal(site.timeDay, 543)
    assert.deepEqual(site.dailyMinutesDown, { '2026-09-05': 12, '2026-09-06': 0 })
  }
  assert.equal(feed.incidentsAvailable, true)
  assert.equal(feed.incidentsComplete, true)
  assert.equal(feed.incidentsWindowStart, new Date(NOW - 90 * DAY).toISOString())
  assert.equal(source.calls.length, 8)
  for (const { url, options } of source.calls) {
    assert.ok(['raw.githubusercontent.com', 'api.github.com'].includes(new URL(url).hostname))
    assert.equal(options.credentials, 'omit')
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers.authorization, undefined)
  }
})

test('imports actual repository public fixtures without network or Node dependencies in the browser module', async () => {
  const files = await Promise.all(['summary.json', ...SITES.map(site => `${site.slug}.yml`)].map(file => readFile(new URL(`../history/${file}`, import.meta.url), 'utf8')))
  const updated = files.slice(1).map(text => Date.parse(/^lastUpdated:\s*(.+)$/m.exec(text)[1]))
  const now = Math.max(...updated) + 60_000
  const source = fixture({ rows: JSON.parse(files[0]), histories: Object.fromEntries(SITES.map((site, index) => [site.slug, files[index + 1]])) })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now })
  assert.deepEqual(feed.sites.map(site => site.slug), SITES.map(site => site.slug))
  assert.deepEqual(feed.sites.map(site => site.observedAt), updated)
  assert.ok(feed.sites.every(site => site.monitoringSince !== null))
  const module = await readFile(new URL('../status-web/status-data.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(module, /(?:\bimport\s|\brequire\s*\(|\b(?:document|window|localStorage|process)\s*\.)/)
})

test('history health overrides summary health independently for each known service', async () => {
  const source = fixture({ histories: {
    [SITES[0].slug]: history(SITES[0], { status: 'down' }),
    [SITES[1].slug]: history(SITES[1], { status: 'degraded' }),
  } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.deepEqual(feed.sites.map(site => site.status), ['down', 'degraded', 'up'])
})

test('old, missing, and future history observations fail closed without changing generated time', async () => {
  const source = fixture({ histories: {
    [SITES[0].slug]: history(SITES[0], { lastUpdated: new Date(NOW - 900_001).toISOString() }),
    [SITES[1].slug]: history(SITES[1], { lastUpdated: 'missing' }),
    [SITES[2].slug]: history(SITES[2], { lastUpdated: new Date(NOW + 60_001).toISOString() }),
  } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.ok(feed.sites.every(site => site.status === 'unknown' && site.stale))
  assert.equal(feed.sites[0].observedAt, NOW - 900_001)
  assert.equal(feed.sites[1].observedAt, null)
  assert.equal(feed.sites[2].observedAt, null)
  assert.equal(feed.observedAt, null)
  assert.equal(feed.generatedAt, NOW)
  assert.equal(feed.sites[0].recordedStatus, 'up')
  assert.equal(feed.sites[1].recordedStatus, 'unknown')
  assert.equal(feed.sites[2].recordedStatus, 'unknown')
})

test('15 minute stale and 60 second future tolerance boundaries are inclusive', async () => {
  const source = fixture({ histories: {
    [SITES[0].slug]: history(SITES[0], { lastUpdated: new Date(NOW - 900_000).toISOString() }),
    [SITES[1].slug]: history(SITES[1], { lastUpdated: new Date(NOW + 60_000).toISOString() }),
  } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.ok(feed.sites.every(site => site.status === 'up' && !site.stale))
})

test('rejects invalid calendar dates, duplicate YAML fields, and unknown history status', async () => {
  const source = fixture({ histories: {
    [SITES[0].slug]: history(SITES[0], { lastUpdated: '2026-02-30T10:00:00.000Z' }),
    [SITES[1].slug]: `${history(SITES[1])}\nstatus: down`,
    [SITES[2].slug]: history(SITES[2], { status: 'operational' }),
  } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.ok(feed.sites.every(site => site.status === 'unknown' && site.stale))
})

test('never borrows another service history or follows injected summary URLs/slugs', async () => {
  const rows = summary()
  rows[0].url = 'https://evil.example/health'
  rows[1].slug = '../secrets'
  rows.push({ ...SITES[2], url: 'javascript:alert(1)', slug: '../../private' })
  const source = fixture({ rows, histories: { [SITES[2].slug]: history(SITES[0]) } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.ok(feed.sites.every(site => site.status === 'unknown'))
  assert.deepEqual(feed.sites.map(site => site.url), SITES.map(site => site.url))
  assert.equal(source.calls.length, 8)
})

test('canonical names ignore arbitrary summary markup and duplicate rows lose statistics', async () => {
  const rows = summary()
  rows[0].name = '<script>malicious()</script>'
  rows.push({ ...rows[1], status: 'down' })
  const source = fixture({ rows })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.equal(feed.sites[0].name, SITES[0].name)
  assert.equal(feed.sites[1].status, 'unknown')
  assert.equal(feed.sites[1].uptimeDay, '—')
  assert.equal(feed.sites[1].timeDay, null)
})

test('invalid summary and all-network failures retain three honest unknown skeletons', async () => {
  for (const rows of [null, {}, [], Array.from({ length: 101 }, () => summary()[0])]) {
    const feed = await loadStatusFeed({ fetchImpl: fixture({ rows }).fetchImpl, now: NOW })
    assert.equal(feed.sites.length, 3)
    assert.ok(feed.sites.every(site => site.status === 'unknown' && site.uptimeDay === '—' && site.timeDay === null))
  }
  const feed = await loadStatusFeed({ fetchImpl: async () => { throw new Error('offline') }, now: NOW })
  assert.equal(feed.sites.length, 3)
  assert.ok(feed.sites.every(site => site.status === 'unknown' && site.stale))
  assert.equal(feed.observedAt, null)
  assert.equal(feed.monitoringSince, null)
  assert.equal(feed.incidentsAvailable, false)
  assert.equal(feed.incidentsComplete, false)
})

test('percentages, response times and daily aggregates are finite, bounded and calendar-valid', async () => {
  const rows = summary()
  Object.assign(rows[0], {
    uptimeDay: '100.01%', uptimeWeek: '-1%', uptimeMonth: '<b>99%</b>', uptimeYear: 100,
    timeDay: -1, timeWeek: '500', timeMonth: null, timeYear: 86_400_001,
    dailyMinutesDown: { '2026-02-30': 10, '2026-09-07': 10, '2025-01-01': 10, '2026-09-05': -1, '2026-09-04': 1441, '2026-09-03': '12', '2026-09-02': 1440, '2026-09-01': 0 },
  })
  const feed = await loadStatusFeed({ fetchImpl: fixture({ rows }).fetchImpl, now: NOW })
  const site = feed.sites[0]
  for (const key of ['Day', 'Week', 'Month', 'Year']) {
    assert.equal(site[`uptime${key}`], '—')
    assert.equal(site[`time${key}`], null)
  }
  assert.deepEqual(site.dailyMinutesDown, { '2026-09-02': 1440, '2026-09-01': 0 })
  assert.equal(site.dailyMinutesDown['2026-08-31'], undefined)
})

test('per-service monitoring starts are historical facts, not repository age or peer timestamps', async () => {
  const source = fixture({ histories: {
    [SITES[0].slug]: history(SITES[0], { startTime: '2026-09-04T10:00:00.000Z' }),
    [SITES[1].slug]: history(SITES[1], { startTime: '2026-09-05T10:00:00.000Z' }),
    [SITES[2].slug]: history(SITES[2], { startTime: '2026-09-07T10:00:00.000Z' }),
  } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.equal(feed.monitoringSince, '2026-09-04T10:00:00.000Z')
  assert.equal(feed.sites[1].monitoringSince, '2026-09-05T10:00:00.000Z')
  assert.equal(feed.sites[2].monitoringSince, null)
})

test('ageStatusFeed is immutable and does not resurrect stale feeds or refresh generatedAt', async () => {
  const original = await loadStatusFeed({ fetchImpl: fixture().fetchImpl, now: NOW })
  const aged = ageStatusFeed(original, NOW + 900_000)
  assert.equal(original.stale, false)
  assert.equal(aged.stale, true)
  assert.equal(aged.generatedAt, NOW)
  assert.equal(aged.observedAt, NOW - 60_000)
  assert.ok(aged.sites.every(site => site.status === 'unknown'))
  assert.ok(ageStatusFeed(aged, NOW).sites.every(site => site.status === 'unknown'))
  const backward = ageStatusFeed(original, NOW - 120_001)
  assert.ok(backward.sites.every(site => site.observedAt === null && site.status === 'unknown'))
})

test('invalid caller clocks reject explicitly', async () => {
  for (const now of [NaN, Infinity, -1, 'today', null]) {
    await assert.rejects(loadStatusFeed({ fetchImpl: fixture().fetchImpl, now }), TypeError)
    assert.throws(() => ageStatusFeed({ sites: [] }, now), TypeError)
  }
})

test('all open incidents survive age filtering; closed incidents use the closure within 90 days', async () => {
  const old = '2025-01-01T00:00:00.000Z'
  const source = fixture({
    open: [issue(1, { created_at: old })],
    closed: [issue(2, { created_at: old, state: 'closed', closed_at: '2026-09-05T10:00:00.000Z' }), issue(3, { created_at: old, state: 'closed', closed_at: '2026-01-05T10:00:00.000Z' })],
  })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.deepEqual(feed.incidents.map(incident => incident.number), [1, 2])
  assert.equal(feed.incidents[0].openedAt, old)
  assert.equal(feed.incidents[0].site, SITES[0].slug)
  const requests = source.calls.filter(call => new URL(call.url).hostname === 'api.github.com').map(call => new URL(call.url))
  assert.equal(requests.find(url => url.searchParams.get('state') === 'open').searchParams.has('since'), false)
  assert.equal(requests.find(url => url.searchParams.get('state') === 'closed').searchParams.get('since'), new Date(NOW - 90 * DAY).toISOString())
})

test('failure in either incident stream is visibly unavailable but retains valid partial incidents', async () => {
  const source = fixture({ open: [issue()], intercept: url => {
    if (url.hostname === 'api.github.com' && url.searchParams.get('state') === 'closed') return new Response('rate limited', { status: 403 })
  } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.equal(feed.incidentsAvailable, false)
  assert.equal(feed.incidentsComplete, false)
  assert.equal(feed.incidents.length, 1)
  assert.equal(feed.sites[0].status, 'up')
})

test('non-array/missing incident data is not a successful empty history', async () => {
  for (const open of [{ message: 'API error' }, null, [null]]) {
    const feed = await loadStatusFeed({ fetchImpl: fixture({ open }).fetchImpl, now: NOW })
    assert.equal(feed.incidentsComplete, false)
    assert.deepEqual(feed.incidents, [])
  }
})

test('rejects injected issue URLs, impossible/future/reversed timestamps, invalid numbers and state', async () => {
  const invalid = [
    { html_url: 'javascript:alert(1)' }, { html_url: `https://github.com/${STATUS_REPO}/issues/1?redirect=evil` },
    { html_url: `https://github.com.evil.test/${STATUS_REPO}/issues/1` }, { html_url: 'https://github.com/other/repo/issues/1' },
    { html_url: `https://github.com/${STATUS_REPO}/issues/2` }, { number: '1' }, { number: -1 },
    { created_at: '2026-02-30T01:00:00.000Z' }, { created_at: '2027-01-01T00:00:00.000Z' },
    { closed_at: '2026-09-04T00:00:00.000Z', state: 'closed' }, { closed_at: 'bad', state: 'closed' },
    { state: 'closed' }, { title: '' }, { labels: {} },
  ].map(overrides => issue(1, overrides))
  const feed = await loadStatusFeed({ fetchImpl: fixture({ open: [...invalid, issue(20)] }).fetchImpl, now: NOW })
  assert.deepEqual(feed.incidents.map(incident => incident.number), [20])
  assert.equal(feed.incidentsComplete, false)
})

test('filters PRs and nonstatus issues without interpolating untrusted site labels', async () => {
  const feed = await loadStatusFeed({ fetchImpl: fixture({ open: [
    issue(1, { pull_request: {} }), issue(2, { labels: [] }),
    issue(3, { title: '<img src=x onerror=alert(1)>', labels: ['status', '<script>'] }),
    issue(4, { html_url: `https://github.com/${STATUS_REPO.toLowerCase()}/issues/4`, labels: ['status', SITES[0].slug, SITES[1].slug] }),
  ] }).fetchImpl, now: NOW })
  assert.deepEqual(feed.incidents.map(incident => incident.number), [4, 3])
  assert.equal(feed.incidents[0].site, null)
  assert.equal(feed.incidents[1].site, null)
  assert.equal(feed.incidents[1].title, '<img src=x onerror=alert(1)>') // Renderer must use textContent.
  assert.equal(feed.incidentsComplete, true)
})

test('bounded pagination never follows untrusted Link URLs and flags incomplete collection', async () => {
  const source = fixture({ intercept: url => {
    if (!url.pathname.endsWith('/issues')) return undefined
    const page = Number(url.searchParams.get('page'))
    const state = url.searchParams.get('state')
    const data = Array.from({ length: 100 }, (_, index) => issue(index + page * 100 + (state === 'closed' ? 1000 : 0), state === 'closed' ? { state, closed_at: '2026-09-05T10:00:00.000Z' } : {}))
    return new Response(JSON.stringify(data), { headers: { link: '<https://evil.example/steal>; rel="next"' } })
  } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.equal(source.calls.length, 10)
  assert.equal(feed.incidents.length, 400)
  assert.equal(feed.incidentsAvailable, true)
  assert.equal(feed.incidentsComplete, false)
  assert.ok(source.calls.every(call => ['api.github.com', 'raw.githubusercontent.com'].includes(new URL(call.url).hostname)))
})

test('full issue page without visible Link still checks the next fixed page', async () => {
  const source = fixture({ intercept: url => {
    if (url.hostname !== 'api.github.com' || url.searchParams.get('state') !== 'open') return undefined
    const page = Number(url.searchParams.get('page'))
    return json(page === 1 ? Array.from({ length: 100 }, (_, index) => issue(index + 1)) : [issue(101, { created_at: '2025-01-01T00:00:00.000Z' })])
  } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.equal(feed.incidents.length, 101)
  assert.equal(feed.incidentsComplete, true)
  assert.equal(source.calls.length, 9)
})

test('HTTP, redirect, malformed JSON, oversized headers, and oversized stream bodies fail closed', async () => {
  const failures = [
    () => new Response('offline', { status: 500 }),
    () => new Response('{not-json'),
    () => new Response('[]', { headers: { 'content-length': '999999999' } }),
    () => new Response('x'.repeat(262_145)),
    () => Object.assign(new Response('[]'), { __unused: true }),
  ]
  // Positive control: valid Response succeeds; hostile response URL is rejected.
  const redirected = () => {
    const response = json(summary())
    Object.defineProperty(response, 'url', { value: 'https://evil.example/payload' })
    return response
  }
  failures[4] = redirected
  for (const failure of failures) {
    const source = fixture({ intercept: url => url.pathname.endsWith('/summary.json') ? failure() : undefined })
    const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
    assert.ok(feed.sites.every(site => site.status === 'unknown' && site.timeDay === null))
  }
  const healthy = await loadStatusFeed({ fetchImpl: fixture().fetchImpl, now: NOW })
  assert.equal(healthy.stale, false)
})

test('rejects oversized histories, excessive issue arrays and missing bodies', async () => {
  const source = fixture({ histories: { [SITES[0].slug]: `${history(SITES[0])}\n${'x'.repeat(16_384)}` }, open: Array.from({ length: 101 }, (_, index) => issue(index + 1)), intercept: url => {
    if (url.pathname.endsWith(`${SITES[1].slug}.yml`)) return new Response(null, { status: 204 })
  } })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.deepEqual(feed.sites.map(site => site.status), ['unknown', 'unknown', 'up'])
  assert.equal(feed.incidentsAvailable, false)
})

test('hard request timeout terminates even a fetch that ignores AbortSignal', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const signals = []
  const pending = loadStatusFeed({ fetchImpl: async (_url, { signal }) => { signals.push(signal); return new Promise(() => {}) }, now: NOW })
  t.mock.timers.tick(8_001)
  const feed = await pending
  assert.equal(signals.length, 7)
  assert.ok(signals.every(signal => signal.aborted))
  assert.equal(feed.stale, true)
  assert.equal(feed.incidentsAvailable, false)
})

test('hard timeout also cancels slow streaming response bodies', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let cancelled = 0
  const pending = loadStatusFeed({ fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled += 1 } })), now: NOW })
  await new Promise(resolve => setImmediate(resolve))
  t.mock.timers.tick(8_001)
  const feed = await pending
  assert.equal(cancelled, 7)
  assert.ok(feed.sites.every(site => site.status === 'unknown'))
  assert.equal(feed.incidentsAvailable, false)
})

test('validates a successful monitor run separately without restamping old site recordings', async () => {
  const at = NOW - 12 * 60 * 60_000
  const source = fixture({ histories: Object.fromEntries(SITES.map(site => [site.slug, history(site, { lastUpdated: new Date(at).toISOString() })])) })
  const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  assert.equal(feed.monitorRunAt, NOW - 30_000)
  assert.equal(feed.monitorCompletedAt, NOW - 10_000)
  assert.equal(feed.monitorConclusion, 'success')
  assert.equal(feed.monitorAvailable, true)
  assert.equal(feed.monitorStale, false)
  assert.equal(feed.monitorUrl, `https://github.com/${STATUS_REPO}/actions/runs/12345`)
  assert.equal(feed.observedAt, at)
  assert.ok(feed.sites.every(site => site.lastRecordedAt === at && site.recordedStatus === 'up' && site.status === 'unknown' && site.stale))
  const request = source.calls.find(call => call.url.includes('/workflows/uptime.yml/runs'))
  assert.equal(new URL(request.url).searchParams.get('status'), 'completed')
  const jobsRequest = source.calls.find(call => call.url.includes('/attempts/'))
  assert.ok(jobsRequest.url.includes('/runs/12345/attempts/1/jobs'))
})

test('latest failed or cancelled monitor remains visible and never falls back to older success', async () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required']) {
    const source = fixture({ run: monitor({ conclusion }) })
    const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
    assert.equal(feed.monitorConclusion, conclusion)
    assert.equal(feed.monitorAvailable, true)
    assert.equal(feed.monitorRunAt, NOW - 30_000)
    assert.equal(source.calls.filter(call => call.url.includes('/actions/')).length, 1)
  }
})

test('rejects run repository, workflow, branch, event, URL, timestamps and identity mismatches', async () => {
  const invalid = [
    { repository: { full_name: 'other/repo' } }, { head_repository: { full_name: 'fork/commonnote-status' } },
    { name: 'Summary CI' }, { path: '.github/workflows/summary.yml' }, { head_branch: 'feature' }, { event: 'pull_request' },
    { html_url: 'https://evil.example/run' }, { html_url: `https://github.com/${STATUS_REPO}/actions/runs/12345#fragment` },
    { id: '../secrets' }, { run_attempt: '1' }, { run_attempt: -1 }, { head_sha: '../main' },
    { status: 'in_progress' }, { conclusion: 'healthy' },
    { run_started_at: '2026-02-30T01:00:00Z' }, { run_started_at: new Date(NOW).toISOString() },
    { updated_at: new Date(NOW + 60_001).toISOString() }, { updated_at: 'bad' },
  ]
  for (const overrides of invalid) {
    const source = fixture({ run: monitor(overrides) })
    const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
    assert.equal(feed.monitorAvailable, false, JSON.stringify(overrides))
    assert.equal(feed.monitorConclusion, 'unknown')
    assert.equal(feed.monitorRunAt, null)
    assert.equal(source.calls.some(call => call.url.includes('/attempts/')), false)
  }
})

test('success needs an exact successful job and endpoint-check step for the current attempt', async () => {
  const invalid = [
    null, {}, { total_count: 101, jobs: [] }, { total_count: 2, jobs: monitorJobs().jobs },
    { total_count: 2, jobs: [...monitorJobs().jobs, ...monitorJobs().jobs] },
    ...[
      { name: 'Wrong job' }, { run_id: 777 }, { run_attempt: 2 }, { head_sha: 'b'.repeat(40) },
      { status: 'in_progress' }, { conclusion: 'failure' }, { started_at: new Date(NOW - 40_000).toISOString() },
      { completed_at: new Date(NOW + 1_000).toISOString() }, { steps: [] },
      { steps: [{ ...monitorJobs().jobs[0].steps[0], name: 'Update summary' }] },
      { steps: [{ ...monitorJobs().jobs[0].steps[0], conclusion: 'skipped' }] },
      { steps: [{ ...monitorJobs().jobs[0].steps[0], completed_at: new Date(NOW).toISOString() }] },
      { steps: [...monitorJobs().jobs[0].steps, ...monitorJobs().jobs[0].steps] },
    ].map(monitorJobs),
  ]
  for (const jobs of invalid) {
    const feed = await loadStatusFeed({ fetchImpl: fixture({ jobs }).fetchImpl, now: NOW })
    assert.equal(feed.monitorAvailable, false)
    assert.equal(feed.monitorConclusion, 'unknown')
    assert.equal(feed.monitorRunAt, NOW - 30_000) // Run exists, but success is unverified.
  }
})

test('missing monitor metadata never means monitor success and does not erase valid recorded site data', async () => {
  for (const source of [fixture({ run: null }), fixture({ intercept: url => {
    if (url.pathname.includes('/actions/')) return new Response('unavailable', { status: 403 })
  } })]) {
    const feed = await loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
    assert.equal(feed.monitorAvailable, false)
    assert.equal(feed.monitorConclusion, 'unknown')
    assert.ok(feed.sites.every(site => site.recordedStatus === 'up'))
  }
})

test('aging stale monitor metadata is independent from the recorded site statuses', async () => {
  const original = await loadStatusFeed({ fetchImpl: fixture().fetchImpl, now: NOW })
  assert.equal(ageStatusFeed(original, NOW + 870_000).monitorStale, false)
  const aged = ageStatusFeed(original, NOW + 870_001)
  assert.equal(aged.monitorStale, true)
  assert.equal(aged.monitorConclusion, 'success')
  assert.equal(aged.monitorRunAt, NOW - 30_000)
  assert.equal(original.monitorStale, false)
  assert.equal(ageStatusFeed(aged, NOW).monitorStale, true)
})

test('run-attempt job request also has a bounded timeout and cannot preserve an unverified success', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const source = fixture({ intercept: url => {
    if (url.pathname.includes('/attempts/')) return new Promise(() => {})
  } })
  const pending = loadStatusFeed({ fetchImpl: source.fetchImpl, now: NOW })
  await new Promise(resolve => setImmediate(resolve))
  t.mock.timers.tick(8_001)
  const feed = await pending
  assert.equal(feed.monitorAvailable, false)
  assert.equal(feed.monitorConclusion, 'unknown')
  assert.equal(feed.monitorRunAt, NOW - 30_000)
  assert.equal(feed.incidentsAvailable, true)
})
