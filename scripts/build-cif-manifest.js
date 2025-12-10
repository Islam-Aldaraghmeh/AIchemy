import fs from 'fs'
import path from 'path'

const root = process.cwd()
const cifsDir = path.resolve(root, 'public', 'cifs')
const outputPath = path.resolve(root, 'src', 'cifManifest.json')

const toManifestEntry = (filename) => {
  const name = filename.replace(/\.cif$/i, '')
  return {
    name,
    path: `/cifs/${filename}`,
    source: 'library',
  }
}

const buildManifest = async () => {
  try {
    await fs.promises.access(cifsDir, fs.constants.R_OK)
  } catch (err) {
    await fs.promises.mkdir(cifsDir, { recursive: true })
  }

  const entries = await fs.promises.readdir(cifsDir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.cif'))
    .map((entry) => toManifestEntry(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  const json = `${JSON.stringify(files, null, 2)}\n`
  await fs.promises.writeFile(outputPath, json, 'utf8')
  console.log(`Built CIF manifest with ${files.length} entries at ${path.relative(root, outputPath)}`)
}

buildManifest().catch((err) => {
  console.error('Failed to build CIF manifest', err)
  process.exit(1)
})
