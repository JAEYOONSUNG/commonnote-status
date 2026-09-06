/** Public, read-only GitHub observations. This module never contacts the app server. */
export const STATUS_REPO = 'JAEYOONSUNG/commonnote-status'
export const SITES = Object.freeze([
  Object.freeze({ name: 'CommonNote API', url: 'https://commonnote.app/api/health', slug: 'common-note-api' }),
  Object.freeze({ name: 'CommonNote Collaboration', url: 'https://commonnote.app/collab/health', slug: 'common-note-collaboration' }),
  Object.freeze({ name: 'CommonNote Downloads', url: 'https://commonnote.app/downloads/latest.json', slug: 'common-note-downloads' }),
])

const SOURCE = `https://github.com/${STATUS_REPO}`
const RAW = `https://raw.githubusercontent.com/${STATUS_REPO}/master/history/`
const ISSUE_API = `https://api.github.com/repos/${STATUS_REPO}/issues`
const RUNS_API = `https://api.github.com/repos/${STATUS_REPO}/actions/workflows/uptime.yml/runs?status=completed&branch=master&per_page=1`
const STALE_MS = 15 * 60_000
const FUTURE_MS = 60_000
const DAY_MS = 86_400_000
const REQUEST_MS = 8_000
const ISSUE_PAGES = 2
const ISSUE_PAGE_SIZE = 100
const PERIODS = ['Day', 'Week', 'Month', 'Year']
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const knownStatus = value => ['up', 'down', 'degraded'].includes(value)

function clock(now) {
  if (!Number.isFinite(now) || now < 0 || now > 8_640_000_000_000_000 - 366 * DAY_MS) throw new TypeError('Invalid status clock')
  return now
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null
  const at = Date.parse(value)
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 19) === value.slice(0, 19) ? at : null
}

function calendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const at = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value ? at : null
}

function blankSite(site) {
  return {
    ...site, status: 'unknown', observedAt: null, lastRecordedAt: null, recordedStatus: 'unknown', stale: true, monitoringSince: null,
    uptimeDay: '—', uptimeWeek: '—', uptimeMonth: '—', uptimeYear: '—',
    timeDay: null, timeWeek: null, timeMonth: null, timeYear: null,
    dailyMinutesDown: {},
  }
}

async function readBounded(response, maximum, signal) {
  const size = response.headers?.get('content-length')
  if (size !== null && size !== undefined && (!/^\d+$/.test(size) || Number(size) > maximum)) throw new Error('Oversized response')
  if (!response.body?.getReader) throw new Error('Missing response body')
  const reader = response.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maximum) throw new Error('Oversized response')
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } catch (error) {
    void reader.cancel().catch(() => {})
    throw error
  } finally {
    signal.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
}

// The timeout covers both headers and streaming bodies, even if a custom fetch
// implementation ignores AbortSignal. Never follow server-supplied redirects.
async function request(url, fetchImpl, maximum, json = true) {
  const controller = new AbortController()
  let timer
  try {
    const body = (async () => {
      const response = await fetchImpl(url, {
        signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-cache',
        headers: { accept: json ? 'application/json' : 'text/plain' },
      })
      if (controller.signal.aborted || !response.ok || response.redirected || (response.url && response.url !== url)) throw new Error('Unavailable response')
      const text = await readBounded(response, maximum, controller.signal)
      return { data: json ? JSON.parse(text) : text, link: response.headers?.get('link') ?? '' }
    })()
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('Status request timeout'))
      }, REQUEST_MS)
    })
    return await Promise.race([body, timeout])
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}

function statistics(raw, now) {
  const result = {}
  for (const period of PERIODS) {
    const percent = raw[`uptime${period}`]
    result[`uptime${period}`] = typeof percent === 'string' && /^\d{1,3}(?:\.\d{1,6})?%$/.test(percent) && Number(percent.slice(0, -1)) <= 100 ? percent : '—'
    const time = raw[`time${period}`]
    result[`time${period}`] = typeof time === 'number' && Number.isFinite(time) && time >= 0 && time <= 86_400_000 ? time : null
  }
  const down = {}
  if (record(raw.dailyMinutesDown)) {
    const today = Math.floor(now / DAY_MS) * DAY_MS
    // No absence is converted to a zero: a missing day remains unrecorded.
    for (const [day, minutes] of Object.entries(raw.dailyMinutesDown).slice(0, 1_000)) {
      const at = calendarDay(day)
      if (at !== null && at <= today && at >= today - 365 * DAY_MS && typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0 && minutes <= 1_440) down[day] = minutes
    }
  }
  result.dailyMinutesDown = down
  return result
}

function historyObservation(text, site, now) {
  if (typeof text !== 'string') return {}
  const values = new Map()
  for (const line of text.split(/\r?\n/)) {
    const match = /^(url|status|lastUpdated|startTime):[ \t]*(.*)$/.exec(line)
    if (!match) continue
    if (values.has(match[1])) return {}
    let value = match[2].trim()
    if (/^"[^"\\]*"$/.test(value) || /^'[^']*'$/.test(value)) value = value.slice(1, -1)
    values.set(match[1], value)
  }
  if (values.get('url') !== site.url) return {}
  const at = timestamp(values.get('lastUpdated'))
  const observedAt = at !== null && at <= now + FUTURE_MS ? at : null
  const start = timestamp(values.get('startTime'))
  const monitoringSince = start !== null && observedAt !== null && start <= observedAt && start <= now ? new Date(start).toISOString() : null
  const status = values.get('status')
  const stale = observedAt === null || now - observedAt > STALE_MS || !knownStatus(status)
  return { observedAt, lastRecordedAt: observedAt, recordedStatus: observedAt !== null && knownStatus(status) ? status : 'unknown', monitoringSince, stale, status: stale ? 'unknown' : status }
}

/** Run success is metadata about the monitor, not a new per-service measurement. */
async function monitorRun(fetchImpl, now) {
  const unknown = { monitorRunAt: null, monitorCompletedAt: null, monitorConclusion: 'unknown', monitorAvailable: false, monitorUrl: null, monitorStale: true }
  const result = await request(RUNS_API, fetchImpl, 65_536)
  if (!record(result?.data) || !Array.isArray(result.data.workflow_runs) || result.data.workflow_runs.length !== 1) return unknown
  const run = result.data.workflow_runs[0]
  const sameRepo = repo => record(repo) && typeof repo.full_name === 'string' && repo.full_name.toLowerCase() === STATUS_REPO.toLowerCase()
  const positive = value => Number.isSafeInteger(value) && value > 0
  const conclusions = ['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required', 'stale', 'startup_failure']
  if (!record(run) || !positive(run.id) || !positive(run.run_attempt) || run.run_attempt > 1_000 ||
    run.name !== 'Uptime CI' || run.path !== '.github/workflows/uptime.yml' || run.head_branch !== 'master' ||
    !sameRepo(run.repository) || !sameRepo(run.head_repository) || !/^[a-f0-9]{40}$/i.test(run.head_sha) ||
    !['schedule', 'workflow_dispatch', 'repository_dispatch'].includes(run.event) || run.status !== 'completed' || !conclusions.includes(run.conclusion)) return unknown
  const expectedUrl = `${SOURCE}/actions/runs/${run.id}`
  if (typeof run.html_url !== 'string' || run.html_url.toLowerCase() !== expectedUrl.toLowerCase()) return unknown
  const at = timestamp(run.run_started_at)
  const completed = timestamp(run.updated_at)
  if (at === null || completed === null || at > completed || completed > now + FUTURE_MS) return unknown
  const metadata = { monitorRunAt: at, monitorCompletedAt: completed, monitorConclusion: run.conclusion, monitorUrl: expectedUrl, monitorStale: now - at > STALE_MS }
  // Keep a completed failure visible; never look further back for a green run.
  if (run.conclusion !== 'success') return { ...unknown, ...metadata, monitorAvailable: true }
  const jobsUrl = `https://api.github.com/repos/${STATUS_REPO}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`
  const jobsResult = await request(jobsUrl, fetchImpl, 262_144)
  if (!record(jobsResult?.data) || !Array.isArray(jobsResult.data.jobs) || !Number.isSafeInteger(jobsResult.data.total_count) ||
    jobsResult.data.total_count < 1 || jobsResult.data.total_count > 100 || jobsResult.data.jobs.length !== jobsResult.data.total_count) return { ...unknown, ...metadata, monitorConclusion: 'unknown' }
  const jobs = jobsResult.data.jobs.filter(job => record(job) && job.name === 'Check status')
  if (jobs.length !== 1) return { ...unknown, ...metadata, monitorConclusion: 'unknown' }
  const job = jobs[0]
  const jobStart = timestamp(job.started_at)
  const jobEnd = timestamp(job.completed_at)
  if (job.run_id !== run.id || job.run_attempt !== run.run_attempt || job.head_sha !== run.head_sha || job.status !== 'completed' || job.conclusion !== 'success' ||
    jobStart === null || jobEnd === null || jobStart < at || jobEnd < jobStart || jobEnd > completed || !Array.isArray(job.steps) || job.steps.length > 100) return { ...unknown, ...metadata, monitorConclusion: 'unknown' }
  const steps = job.steps.filter(step => record(step) && step.name === 'Check endpoint status')
  if (steps.length !== 1) return { ...unknown, ...metadata, monitorConclusion: 'unknown' }
  const step = steps[0]
  const stepStart = timestamp(step.started_at)
  const stepEnd = timestamp(step.completed_at)
  if (step.status !== 'completed' || step.conclusion !== 'success' || stepStart === null || stepEnd === null || stepStart < jobStart || stepEnd < stepStart || stepEnd > jobEnd) return { ...unknown, ...metadata, monitorConclusion: 'unknown' }
  return { ...metadata, monitorAvailable: true }
}

function normalizeIncident(raw, now, windowStart) {
  if (!record(raw)) return null
  if ('pull_request' in raw) return { skip: true }
  if (!Number.isSafeInteger(raw.number) || raw.number < 1 || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 2_000) return null
  const expected = `${SOURCE}/issues/${raw.number}`
  if (typeof raw.html_url !== 'string' || raw.html_url.toLowerCase() !== expected.toLowerCase()) return null
  const opened = timestamp(raw.created_at)
  const closed = raw.closed_at === null ? null : timestamp(raw.closed_at)
  if (opened === null || opened > now + FUTURE_MS || (raw.closed_at !== null && closed === null) || (closed !== null && (closed < opened || closed > now + FUTURE_MS))) return null
  if (raw.state !== 'open' && raw.state !== 'closed') return null
  if ((raw.state === 'open') !== (closed === null)) return null
  if (closed !== null && closed < windowStart) return { skip: true }
  if (!Array.isArray(raw.labels) || raw.labels.length > 100) return null
  const labels = raw.labels.map(label => record(label) ? label.name : label).filter(label => typeof label === 'string')
  if (!labels.includes('status')) return { skip: true }
  const matches = SITES.filter(site => labels.includes(site.slug))
  return {
    number: raw.number, title: raw.title.trim(), url: expected,
    openedAt: new Date(opened).toISOString(), closedAt: closed === null ? null : new Date(closed).toISOString(),
    site: matches.length === 1 ? matches[0].slug : null,
  }
}

async function incidentStream(state, fetchImpl, now, windowStart) {
  const incidents = []
  let complete = true
  for (let page = 1; page <= ISSUE_PAGES; page += 1) {
    const params = new URLSearchParams({ labels: 'status', state, per_page: String(ISSUE_PAGE_SIZE), sort: state === 'open' ? 'created' : 'updated', direction: 'desc', page: String(page) })
    if (state === 'closed') params.set('since', new Date(windowStart).toISOString())
    const result = await request(`${ISSUE_API}?${params}`, fetchImpl, 1_048_576)
    if (!result || !Array.isArray(result.data) || result.data.length > ISSUE_PAGE_SIZE) return { incidents, available: false, complete: false }
    for (const raw of result.data) {
      const incident = normalizeIncident(raw, now, windowStart)
      if (!incident || (incident.closedAt !== undefined && (incident.closedAt === null) !== (state === 'open'))) complete = false
      else if (!incident.skip) incidents.push(incident)
    }
    // Link is only a completeness hint; we never request URLs supplied by it.
    const more = /;\s*rel\s*=\s*"?next\b/i.test(result.link)
    if (!more && result.data.length < ISSUE_PAGE_SIZE) return { incidents, available: true, complete }
    if (page === ISSUE_PAGES) complete = false
  }
  return { incidents, available: true, complete }
}

/** Fetch at most ten allowlisted GitHub resources; no app-origin probe or auth. */
export async function loadStatusFeed({ fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  clock(now)
  const windowStart = now - 90 * DAY_MS
  const [summary, histories, open, closed, monitor] = await Promise.all([
    request(`${RAW}summary.json`, fetchImpl, 262_144),
    Promise.all(SITES.map(site => request(`${RAW}${site.slug}.yml`, fetchImpl, 16_384, false))),
    incidentStream('open', fetchImpl, now, windowStart),
    incidentStream('closed', fetchImpl, now, windowStart),
    monitorRun(fetchImpl, now),
  ])
  const rows = Array.isArray(summary?.data) && summary.data.length <= 100 ? summary.data : []
  const sites = SITES.map((site, index) => {
    const matches = rows.filter(row => record(row) && row.url === site.url && row.slug === site.slug)
    const observed = historyObservation(histories[index]?.data, site, now)
    const normalized = { ...blankSite(site), ...(matches.length === 1 ? statistics(matches[0], now) : {}), ...observed }
    // Summary failures retain the same three cards but cannot yield a green feed.
    if (matches.length !== 1) Object.assign(normalized, { status: 'unknown', stale: true })
    return normalized
  })
  const starts = sites.map(site => site.monitoringSince).filter(Boolean).sort()
  const byNumber = new Map()
  for (const incident of [...closed.incidents, ...open.incidents]) byNumber.set(incident.number, incident)
  const incidents = [...byNumber.values()].sort((a, b) => Number(a.closedAt !== null) - Number(b.closedAt !== null) || Date.parse(b.openedAt) - Date.parse(a.openedAt) || b.number - a.number)
  return ageStatusFeed({
    generatedAt: now, observedAt: null, stale: true,
    monitoringSince: starts[0] ?? null, sites, incidents,
    incidentsAvailable: open.available && closed.available,
    incidentsComplete: open.complete && closed.complete,
    incidentsWindowStart: new Date(windowStart).toISOString(), source: SOURCE, ...monitor,
  }, now)
}

/** Age an already validated feed without relabeling old observations as fresh. */
export function ageStatusFeed(feed, now = Date.now()) {
  clock(now)
  const sites = feed.sites.map(site => {
    const validAt = Number.isFinite(site.observedAt) && site.observedAt >= 0 && site.observedAt <= now + FUTURE_MS
    const stale = site.stale || !validAt || now - site.observedAt > STALE_MS || !knownStatus(site.status)
    return { ...site, observedAt: validAt ? site.observedAt : null, stale, status: stale ? 'unknown' : site.status }
  })
  return {
    ...feed, sites, stale: sites.length !== SITES.length || sites.some(site => site.stale),
    observedAt: sites.length === SITES.length && sites.every(site => site.observedAt !== null) ? Math.min(...sites.map(site => site.observedAt)) : null,
    monitorStale: feed.monitorStale || !Number.isFinite(feed.monitorRunAt) || feed.monitorRunAt > now + FUTURE_MS || now - feed.monitorRunAt > STALE_MS,
  }
}
