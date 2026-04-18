import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const srcMark = resolve(root, '../Graffík/logo_purple_on_trans.png')
const srcWordmark = resolve(root, '../Graffík/workmark_purple_on_trans.png')

const CHROME_BG = { r: 29, g: 33, b: 37, alpha: 1 }

async function ensureDir(p) {
  await mkdir(dirname(p), { recursive: true })
}

async function run() {
  const markPng = resolve(root, 'public/brand/mark.png')
  const wordmarkPng = resolve(root, 'public/brand/wordmark.png')
  const icon192 = resolve(root, 'public/icons/icon-192.png')
  const icon512 = resolve(root, 'public/icons/icon-512.png')
  const appleTouch = resolve(root, 'public/icons/apple-touch-icon.png')
  const favicon = resolve(root, 'public/brand/favicon-32.png')

  await Promise.all([
    ensureDir(markPng),
    ensureDir(icon192),
  ])

  await sharp(srcMark)
    .resize({ width: 512, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(markPng)
  console.log('wrote', markPng)

  await sharp(srcWordmark)
    .resize({ width: 800, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(wordmarkPng)
  console.log('wrote', wordmarkPng)

  for (const { size, out } of [
    { size: 192, out: icon192 },
    { size: 512, out: icon512 },
    { size: 180, out: appleTouch },
  ]) {
    await sharp(srcMark)
      .flatten({ background: CHROME_BG })
      .resize({ width: size, height: size, fit: 'contain', background: CHROME_BG })
      .png({ compressionLevel: 9 })
      .toFile(out)
    console.log('wrote', out)
  }

  await sharp(srcMark)
    .resize({ width: 64, height: 64, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(favicon)
  console.log('wrote', favicon)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
