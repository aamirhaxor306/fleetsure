/**
 * Removes emoji and emoji-like symbols from UI/source strings.
 * Run from repo root: node scripts/strip-emojis.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const TARGET_DIRS = [
  path.join(ROOT, 'client', 'src'),
  path.join(ROOT, 'public'),
  path.join(ROOT, 'client', 'public'),
  path.join(ROOT, 'server', 'services'),
  path.join(ROOT, 'server', 'routes'),
  path.join(ROOT, 'server', 'data'),
]

const EXT = new Set(['.jsx', '.js', '.html', '.ts', '.tsx'])

// Emoji sequences + common dingbats used in the app
const RE = new RegExp(
  [
    '\\p{Extended_Pictographic}',
    '\\uFE0F', // variation selector
    '\\u200D', // ZWJ
    '[\\u203C\\u2049\\u2122\\u2139]',
    '[\\u2194-\\u2199\\u21A9\\u21AA]',
    '[\\u231A\\u231B]',
    '[\\u2328\\u23CF]',
    '[\\u23E9-\\u23F3\\u23F8-\\u23FA]',
    '[\\u24C2]',
    '[\\u25AA\\u25AB\\u25B6\\u25C0\\u25FB-\\u25FE]',
    '[\\u2600-\\u27BF]', // misc symbols & dingbats (includes ✓✗ in some ranges — careful)
    '[\\u2934\\u2935]',
    '[\\u2B05-\\u2B07\\u2B1B\\u2B1C\\u2B50\\u2B55]',
    '[\\u3030\\u303D]',
    '[\\u3297\\u3299]',
  ].join('|'),
  'gu'
)

function stripContent(s) {
  let out = s.replace(RE, '')
  // trim trailing spaces per line only (do not collapse indentation)
  out = out.split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n')
  return out
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, files)
    else if (EXT.has(path.extname(name))) files.push(p)
  }
  return files
}

let changed = 0
for (const dir of TARGET_DIRS) {
  for (const file of walk(dir)) {
    const raw = fs.readFileSync(file, 'utf8')
    const next = stripContent(raw)
    if (next !== raw) {
      fs.writeFileSync(file, next, 'utf8')
      changed++
      console.log('updated', path.relative(ROOT, file))
    }
  }
}
console.log('done, files changed:', changed)
