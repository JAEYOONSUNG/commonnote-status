import { ageStatusFeed, SITES } from './status-data.mjs'

const COPY = {
  ko: {
    skip: '본문으로 건너뛰기', 'brand.status': '상태', 'nav.incidents': '장애 이력', 'nav.data': '감시 데이터', 'nav.app': '앱으로',
    'headline.default': 'CommonNote 서비스 가동 상태', 'headline.up': '최근 상태 기록은 정상입니다', 'headline.down': '장애가 보고되었습니다', 'headline.degraded': '느린 응답이 보고되었습니다',
    'state.loading': '상태를 확인하는 중…', 'state.unknown': '현재 상태 미확인', 'state.up': '최근 기록 모두 정상', 'state.down': '일부 서비스 장애 기록', 'state.degraded': '일부 서비스 지연 기록',
    sub: '앱 서버와 독립된 외부 감시 기록입니다. 오래된 기록은 현재 상태로 단정하지 않습니다.',
    note: '정상 상태가 이어지면 상태 기록 시각은 바뀌지 않을 수 있습니다. 감시 작업 실행과 상태 기록은 별도로 표시합니다.',
    refresh: '다시 확인', 'updated': '상태 기록 {time}', 'updated.none': '유효한 상태 기록을 확인할 수 없음',
    'site.api': '웹·API', 'site.collab': '실시간 편집 서버', 'site.downloads': '앱 업데이트 배포',
    'site.up': '정상', 'site.down': '장애', 'site.degraded': '느림', 'site.unknown': '미확인',
    'record': '마지막 기록: {state} · {time}', 'record.none': '유효한 상태 기록을 확인하지 못했습니다.', 'record.stale': '오래된 기록 · 현재 상태와 다를 수 있음',
    'monitor.success': '최근 감시 작업 성공 · {time}', 'monitor.failure': '최근 감시 작업 미완료 · {time}', 'monitor.none': '최근 감시 작업을 확인할 수 없음', 'monitor.stale': '감시 실행 갱신 지연',
    'strip.label': '지난 90일 기록된 장애', 'strip.start': '90일 전', 'strip.today': '오늘', 'strip.none': '감시 전 또는 기록 미확인', 'strip.clear': '집계에 기록된 장애 없음', 'strip.down': '{minutes}분 장애 기록',
    'stat.day': '24시간', 'stat.week': '7일', 'stat.month': '30일', 'stat.year': '1년', 'resp': '응답 시간 · 최근 일간 집계',
    'incidents.title': '장애 이력', 'incidents.empty': '진행 중이거나 지난 90일에 종료된 장애 기록이 없습니다.',
    'incidents.error': '장애 이력을 모두 불러오지 못했습니다. GitHub 원본 기록도 확인해 주세요.', 'incidents.partial': '표시 범위를 넘는 이력이 있습니다. 전체 기록은 GitHub에서 확인할 수 있습니다.',
    'incidents.open': '진행 중', 'incidents.closed': '{minutes}분 뒤 종료',
    'footer.default': '감시 데이터: GitHub Actions · 실행 지연 가능', 'footer.since': '감시 시작 {date} · GitHub Actions · 실행 지연 가능', 'footer.issues': 'GitHub 장애 기록', 'footer.privacy': '개인정보',
    'feed.error': '갱신하지 못했습니다. 마지막으로 받은 기록을 표시합니다.', 'feed.empty': '상태 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.',
    'rel.now': '방금', 'rel.minutes': '{n}분 전', 'rel.hours': '{n}시간 전', 'rel.days': '{n}일 전',
  },
  en: {
    skip: 'Skip to content', 'brand.status': 'Status', 'nav.incidents': 'Incidents', 'nav.data': 'Monitor data', 'nav.app': 'Open app',
    'headline.default': 'CommonNote service status', 'headline.up': 'Latest status records are operational', 'headline.down': 'An outage has been reported', 'headline.degraded': 'Slow responses have been reported',
    'state.loading': 'Checking status…', 'state.unknown': 'Current status unconfirmed', 'state.up': 'Latest records operational', 'state.down': 'Outage in latest records', 'state.degraded': 'Delay in latest records',
    sub: 'External monitoring records, independent of the app server. Older records do not confirm current availability.',
    note: 'When a service stays healthy, its record timestamp may not change. Monitor runs and status records are shown separately.',
    refresh: 'Refresh', updated: 'Status record {time}', 'updated.none': 'No valid status record available',
    'site.api': 'Web & API', 'site.collab': 'Realtime editing server', 'site.downloads': 'App update feed',
    'site.up': 'Operational', 'site.down': 'Down', 'site.degraded': 'Slow', 'site.unknown': 'Unknown',
    record: 'Last record: {state} · {time}', 'record.none': 'No valid status record available.', 'record.stale': 'Older record · current status may differ',
    'monitor.success': 'Latest monitor run succeeded · {time}', 'monitor.failure': 'Latest monitor run incomplete · {time}', 'monitor.none': 'Latest monitor run unavailable', 'monitor.stale': 'Monitor update delayed',
    'strip.label': 'Recorded downtime over the last 90 days', 'strip.start': '90 days ago', 'strip.today': 'Today', 'strip.none': 'Before monitoring or unconfirmed', 'strip.clear': 'No downtime in aggregate records', 'strip.down': '{minutes} min recorded downtime',
    'stat.day': '24 h', 'stat.week': '7 d', 'stat.month': '30 d', 'stat.year': '1 y', resp: 'Response time · latest daily aggregate',
    'incidents.title': 'Incident history', 'incidents.empty': 'No open incidents or incidents closed in the last 90 days.',
    'incidents.error': 'Some incident history could not be loaded. Check the original GitHub records too.', 'incidents.partial': 'More history is available. See GitHub for the full record.',
    'incidents.open': 'Ongoing', 'incidents.closed': 'Closed after {minutes} min',
    'footer.default': 'Monitor data: GitHub Actions · schedules may be delayed', 'footer.since': 'Monitoring since {date} · GitHub Actions · schedules may be delayed', 'footer.issues': 'GitHub incident records', 'footer.privacy': 'Privacy',
    'feed.error': 'Refresh failed. Showing the last received records.', 'feed.empty': 'Status data is unavailable. Please try again shortly.',
    'rel.now': 'just now', 'rel.minutes': '{n} min ago', 'rel.hours': '{n} h ago', 'rel.days': '{n} d ago',
  },
}
export const translations = COPY
const known = (status) => ['up', 'down', 'degraded', 'unknown'].includes(status) ? status : 'unknown'
export function overallState(sites) {
  if (sites.some((site) => site.status === 'down')) return 'down'
  if (sites.length !== 3 || sites.some((site) => site.status === 'unknown' || site.stale)) return 'unknown'
  return sites.some((site) => site.status === 'degraded') ? 'degraded' : 'up'
}
export const formatPercent = (value) => typeof value === 'string' && /^\d{1,3}(?:\.\d+)?%$/.test(value) && Number(value.slice(0, -1)) <= 100 ? value.replace(/\.00%$/, '%') : '—'
export const formatMilliseconds = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${Math.round(value)} ms` : '—'
const finiteTime = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0
const dayKey = (date) => new Date(date + 9 * 3600_000).toISOString().slice(0, 10)
export function safeIssueUrl(incident) {
  const expected = `https://github.com/JAEYOONSUNG/commonnote-status/issues/${incident.number}`
  return Number.isSafeInteger(incident.number) && incident.number > 0 && String(incident.url).toLowerCase() === expected.toLowerCase() ? expected : null
}

export function createStatusPage(doc, { fetchImpl = globalThis.fetch, storage, now = () => Date.now() } = {}) {
  const $ = (id) => doc.getElementById(id)
  if (storage === undefined) { try { storage = globalThis.localStorage } catch { storage = null } }
  let lang = 'ko'
  try { lang = storage?.getItem('cn-status-lang') || ((globalThis.navigator?.language || 'ko').startsWith('ko') ? 'ko' : 'en') } catch { /* display still works in private mode */ }
  if (!COPY[lang]) lang = 'ko'
  const t = (key, values = {}) => (COPY[lang][key] ?? COPY.ko[key] ?? '').replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '—'))
  const relative = (at) => {
    const minutes = Math.max(0, Math.floor((now() - at) / 60_000))
    return minutes < 1 ? t('rel.now') : minutes < 60 ? t('rel.minutes', { n: minutes }) : minutes < 1440 ? t('rel.hours', { n: Math.floor(minutes / 60) }) : t('rel.days', { n: Math.floor(minutes / 1440) })
  }
  const locale = () => lang === 'ko' ? 'ko-KR' : 'en-US'
  const element = (tag, className, text) => {
    const node = doc.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }
  const siteName = (site) => t(site.slug === 'common-note-api' ? 'site.api' : site.slug === 'common-note-collaboration' ? 'site.collab' : 'site.downloads')
  let lastFeed = null
  let inflight = null
  let failed = false
  function staticCopy() {
    doc.documentElement.lang = lang
    doc.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n) })
    $('lang-toggle').textContent = lang === 'ko' ? 'EN' : 'KO'
    $('lang-toggle').setAttribute('aria-label', lang === 'ko' ? 'Switch to English' : '한국어로 보기')
    doc.querySelector('nav').setAttribute('aria-label', lang === 'ko' ? '페이지 메뉴' : 'Page navigation')
  }
  function card(site, feed) {
    const node = element('article', 'card'); node.dataset.state = known(site.status)
    const head = element('div', 'card-head'), label = element('div')
    label.append(element('h2', '', siteName(site)), element('p', 'url', site.url.replace(/^https:\/\//, '')))
    const badge = element('span', 'state'); badge.dataset.state = known(site.status)
    const dot = element('i'); dot.setAttribute('aria-hidden', 'true')
    badge.append(dot, doc.createTextNode(t(`site.${known(site.status)}`))); head.append(label, badge); node.append(head)
    const recorded = site.lastRecordedAt ?? site.observedAt
    const recordText = finiteTime(recorded) ? t('record', { state: t(`site.${known(site.recordedStatus ?? site.status)}`), time: relative(recorded) }) : t('record.none')
    node.append(element('p', 'record', `${recordText}${site.stale && finiteTime(recorded) ? ` · ${t('record.stale')}` : ''}`))
    const strip = element('div', 'strip'); strip.setAttribute('role', 'img'); strip.setAttribute('aria-label', t('strip.label'))
    const startAt = Date.parse(site.monitoringSince ?? feed.monitoringSince)
    const start = Number.isFinite(startAt) ? dayKey(startAt) : null
    const today = dayKey(now()), aggregateDay = finiteTime(feed.generatedAt) ? dayKey(feed.generatedAt) : null
    for (let i = 89; i >= 0; i--) {
      const day = dayKey(now() - i * 86_400_000), minutes = site.dailyMinutesDown?.[day]
      const available = start !== null && day >= start && aggregateDay !== null && day <= aggregateDay
      const state = !available || (day === today && site.stale) ? 'none' : minutes >= 60 ? 'down' : minutes > 0 ? 'slow' : 'up'
      const cell = element('span'); cell.dataset.k = day === today && state === 'up' ? 'today' : state
      cell.title = `${day} · ${state === 'none' ? t('strip.none') : minutes > 0 ? t('strip.down', { minutes: Math.round(minutes) }) : t('strip.clear')}`
      strip.append(cell)
    }
    const legend = element('div', 'strip-legend'); legend.append(element('span', '', t('strip.start')), element('span', '', t('strip.today')))
    node.append(strip, legend)
    const stats = element('div', 'stats')
    for (const period of ['Day', 'Week', 'Month', 'Year']) {
      const stat = element('div', 'stat'); stat.append(element('b', '', formatPercent(site[`uptime${period}`])), element('small', '', t(`stat.${period.toLowerCase()}`))); stats.append(stat)
    }
    const response = element('div', 'resp'); response.append(element('span', '', t('resp')), element('b', '', formatMilliseconds(site.timeDay)))
    node.append(stats, response)
    return node
  }
  function incidents(feed) {
    const box = $('incidents'); box.replaceChildren()
    if (!feed.incidentsAvailable || feed.incidentsComplete === false) box.append(element('p', 'incident-warning', t(!feed.incidentsAvailable ? 'incidents.error' : 'incidents.partial')))
    const list = Array.isArray(feed.incidents) ? feed.incidents : []
    if (!list.length) {
      if (feed.incidentsAvailable && feed.incidentsComplete !== false) box.append(element('div', 'empty', t('incidents.empty')))
      return
    }
    const timeline = element('div', 'timeline')
    for (const incident of list.slice(0, 400)) {
      const url = safeIssueUrl(incident)
      if (!url) continue
      const entry = element('div', 'inc'); entry.dataset.open = String(!incident.closedAt)
      const link = element('a', '', String(incident.title)); link.href = url; link.rel = 'noopener'
      const start = Date.parse(incident.openedAt), end = Date.parse(incident.closedAt)
      const duration = incident.closedAt && Number.isFinite(end) && end >= start ? t('incidents.closed', { minutes: Math.max(1, Math.round((end - start) / 60_000)) }) : t('incidents.open')
      const date = Number.isFinite(start) ? new Date(start).toLocaleString(locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
      entry.append(link, element('p', '', `${date} · ${duration}`)); timeline.append(entry)
    }
    box.append(timeline)
  }
  function render(raw) {
    if (!raw || !Array.isArray(raw.sites) || raw.sites.length !== 3 || !raw.sites.every((site, i) => site.url === SITES[i].url && site.slug === SITES[i].slug)) throw new Error('Invalid status feed')
    lastFeed = raw
    const feed = ageStatusFeed(raw, now()), state = overallState(feed.sites)
    staticCopy()
    $('overall').dataset.state = state === 'unknown' ? 'loading' : state
    $('overall-text').textContent = t(`state.${state}`)
    $('headline').textContent = t(state === 'unknown' ? 'headline.default' : `headline.${state}`)
    doc.title = `${t(`state.${state}`)} · CommonNote ${t('brand.status')}`
    $('updated').textContent = finiteTime(feed.observedAt) ? t('updated', { time: relative(feed.observedAt) }) : t('updated.none')
    const monitorState = feed.monitorAvailable && feed.monitorConclusion === 'success' ? 'success' : feed.monitorAvailable ? 'failure' : 'unknown'
    $('monitor').dataset.state = monitorState
    $('monitor').querySelector('span').textContent = monitorState === 'unknown' || !finiteTime(feed.monitorRunAt) ? t('monitor.none') : `${t(`monitor.${monitorState}`, { time: relative(feed.monitorRunAt) })}${feed.monitorStale ? ` · ${t('monitor.stale')}` : ''}`
    $('sites').replaceChildren(...feed.sites.map((site) => card(site, feed)))
    incidents(feed)
    const start = Date.parse(feed.monitoringSince)
    $('since').textContent = Number.isFinite(start) ? t('footer.since', { date: new Date(start).toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' }) }) : t('footer.default')
    $('error').hidden = !failed; $('error').textContent = failed ? t('feed.error') : ''
  }
  async function load() {
    if (inflight) return inflight
    $('refresh').disabled = true
    inflight = Promise.resolve().then(async () => {
      try {
        const response = await fetchImpl(new URL('./status-data.json', import.meta.url), { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8_000) })
        if (!response.ok) throw new Error('Status feed unavailable')
        const text = await response.text()
        if (text.length > 2_000_000) throw new Error('Status feed oversized')
        failed = false; render(JSON.parse(text))
      } catch {
        failed = true
        if (lastFeed) render(lastFeed)
        else {
          render({ generatedAt: now(), observedAt: null, monitoringSince: null, incidentsAvailable: false, incidentsComplete: false, incidents: [],
            sites: SITES.map((site) => ({ ...site, status: 'unknown', stale: true, observedAt: null, recordedStatus: 'unknown', lastRecordedAt: null, dailyMinutesDown: {} })) })
          lastFeed = null
          $('error').hidden = false; $('error').textContent = t('feed.empty')
        }
      } finally { $('refresh').disabled = false; inflight = null }
    })
    return inflight
  }
  staticCopy()
  $('lang-toggle').addEventListener('click', () => {
    lang = lang === 'ko' ? 'en' : 'ko'
    try { storage?.setItem('cn-status-lang', lang) } catch { /* language remains usable */ }
    staticCopy(); if (lastFeed) render(lastFeed)
    else if (failed) { $('overall-text').textContent = t('state.unknown'); $('error').textContent = t('feed.empty') }
  })
  $('refresh').addEventListener('click', load)
  return { load, render, age: () => { if (lastFeed) render(lastFeed) } }
}

export const statusPage = typeof document === 'undefined' ? null : createStatusPage(document)
if (statusPage) {
  void statusPage.load()
  setInterval(() => void statusPage.load(), 5 * 60_000)
  setInterval(statusPage.age, 30_000)
}
