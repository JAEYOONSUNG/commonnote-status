import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { loadStatusFeed, SITES } from '../status-web/status-data.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'status-web')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
function sourceFiles(directory = source) {
  return fs.readdirSync(directory).sort().flatMap((name) => {
    const filename = path.join(directory, name), stat = fs.lstatSync(filename)
    if (stat.isSymbolicLink()) throw new Error('Symlinks are not publishable')
    if (stat.isDirectory()) return sourceFiles(filename)
    if (!stat.isFile()) throw new Error('Only regular static files are publishable')
    return [filename]
  })
}
export function buildStatusSite(outputDirectory, feed, revision = 'local') {
  const output = path.resolve(outputDirectory)
  if (output === root || output === source || root.startsWith(output + path.sep) || output.startsWith(source + path.sep)) throw new Error('Unsafe output directory')
  if (fs.existsSync(output) && (fs.lstatSync(output).isSymbolicLink() || fs.readdirSync(output).length)) throw new Error('Output must be an empty directory')
  if (!/^(?:local|[a-f0-9]{40})$/.test(revision)) throw new Error('Invalid revision')
  if (!feed || !Array.isArray(feed.sites) || feed.sites.length !== SITES.length || !feed.sites.every((site, i) => site.url === SITES[i].url && site.slug === SITES[i].slug)) throw new Error('Invalid feed identity')
  const files = sourceFiles()
  const required = ['index.html', 'status.js', 'status.css', 'status-data.mjs', 'assets/favicon.svg', 'assets/icon-192.png', 'assets/fonts/pretendard/pretendard.css', 'assets/fonts/pretendard/LICENSE.txt']
  for (const name of required) if (!files.includes(path.join(source, name))) throw new Error(`Missing required asset: ${name}`)
  fs.mkdirSync(output, { recursive: true })
  const manifest = {}
  for (const filename of files) {
    const relative = path.relative(source, filename).split(path.sep).join('/')
    const destination = path.join(output, relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(filename, destination)
    manifest[relative] = sha256(fs.readFileSync(destination))
  }
  const sourceHash = sha256(JSON.stringify(manifest))
  fs.writeFileSync(path.join(output, 'status-data.json'), JSON.stringify(feed))
  fs.writeFileSync(path.join(output, 'build-info.json'), JSON.stringify({ revision, sourceHash, generatedAt: feed.generatedAt, files: manifest }))
  fs.writeFileSync(path.join(output, '.nojekyll'), '')
  return { revision, sourceHash, files: Object.keys(manifest).length }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2]
  if (!output) throw new Error('Usage: node scripts/build-status.mjs <empty-output-directory> [--fixture <feed.json>]')
  const fixture = process.argv.indexOf('--fixture')
  const feed = fixture >= 0 ? JSON.parse(fs.readFileSync(process.argv[fixture + 1], 'utf8')) : await loadStatusFeed({ fetchImpl: (url, options) => {
    const headers = new Headers(options.headers)
    // The ephemeral CI token is sent only to this public repo's GitHub API,
    // never to raw content, monitored app URLs, or published browser assets.
    if (process.env.GITHUB_TOKEN && String(url).startsWith('https://api.github.com/repos/JAEYOONSUNG/commonnote-status/')) headers.set('authorization', `Bearer ${process.env.GITHUB_TOKEN}`)
    headers.set('user-agent', 'CommonNote-independent-status')
    return fetch(url, { ...options, headers })
  } })
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const built = buildStatusSite(output, feed, revision)
  console.log(JSON.stringify({ ...built, sites: feed.sites.length, monitorAvailable: feed.monitorAvailable, incidentsAvailable: feed.incidentsAvailable }))
}
