import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = process.cwd()
const cifsDir = path.resolve(rootDir, 'public', 'cifs')
const generatedDir = path.resolve(rootDir, 'generated_cofs')

const listCifFiles = async (dir, prefix, source) => {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    const files = entries.filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.cif'))

    const withMeta = await Promise.all(
      files.map(async (f) => {
        try {
          const stat = await fs.promises.stat(path.join(dir, f.name))
          return {
            name: f.name.replace(/\.cif$/i, ''),
            path: `${prefix}/${f.name}`,
            source,
            mtimeMs: stat.mtimeMs,
          }
        } catch {
          return {
            name: f.name.replace(/\.cif$/i, ''),
            path: `${prefix}/${f.name}`,
            source,
            mtimeMs: 0,
          }
        }
      }),
    )

    return withMeta.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0))
  } catch (error) {
    return []
  }
}

const sendJson = (res, payload, statusCode = 200) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const serveGeneratedFile = async (urlPath, req, res) => {
  const relative = urlPath.replace('/generated_cofs/', '')
  const decoded = decodeURIComponent(relative)
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '')
  const targetPath = path.join(generatedDir, normalized)

  if (!targetPath.startsWith(generatedDir)) {
    res.statusCode = 403
    res.end('Forbidden')
    return true
  }

  try {
    await fs.promises.access(targetPath, fs.constants.R_OK)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    if (req.method === 'HEAD') {
      res.end()
    } else {
      fs.createReadStream(targetPath).pipe(res)
    }
  } catch (error) {
    res.statusCode = 404
    res.end('Not found')
  }

  return true
}

const runGenerator = () =>
  new Promise((resolve, reject) => {
    const pythonCmd = process.env.PYTHON || 'python3'
    const scriptPath = path.resolve(rootDir, 'random_cof_generator.py')

    const child = spawn(pythonCmd, [scriptPath, '--json', '--quiet'], { cwd: rootDir })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Generator timed out'))
    }, 60000)

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        const rawMessage = stderr.trim() || stdout.trim() || `Generator exited with code ${code}`
        const message = rawMessage.split('\n').slice(-1)[0] || rawMessage
        return reject(new Error(message))
      }

      const lines = stdout.trim().split('\n').filter(Boolean)
      const payload = lines.length ? lines[lines.length - 1] : '{}'
      try {
        resolve(JSON.parse(payload))
      } catch (error) {
        reject(new Error('Could not parse generator output'))
      }
    })
  })

const createApiMiddleware = () => async (req, res, next) => {
  const urlPath = (req.url || '').split('?')[0]
  if (!urlPath) return next()

  if (urlPath.startsWith('/generated_cofs/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end('Method not allowed')
      return
    }
    await serveGeneratedFile(urlPath, req, res)
    return
  }

  if (urlPath === '/api/generate-cof') {
    if (req.method !== 'POST') {
      return sendJson(res, { error: 'Method not allowed' }, 405)
    }
    try {
      const result = await runGenerator()
      if (!result?.ok) {
        throw new Error(result?.error || 'Generator failed')
      }
      const relativePath = result.path
        ? `/${path.relative(rootDir, result.path).replace(/\\/g, '/')}`
        : null
      const normalizedPath =
        relativePath && relativePath.startsWith('/generated_cofs')
          ? relativePath
          : `/generated_cofs/${result.filename || 'cof.cif'}`

      let mtimeMs = Date.now()
      try {
        const stat = await fs.promises.stat(path.join(rootDir, normalizedPath.replace(/^\//, '')))
        mtimeMs = stat.mtimeMs
      } catch (e) {
        // fallback to now
      }

      const filePayload = {
        name: result.filename?.replace(/\.cif$/i, '') || result.cof_string || 'generated-cof',
        path: normalizedPath,
        source: 'generated',
        mtimeMs,
      }

      return sendJson(res, { file: filePayload, raw: result })
    } catch (error) {
      return sendJson(res, { error: error.message }, 500)
    }
  }

  if (urlPath.startsWith('/api/generated-cifs')) {
    try {
      const generatedFiles = await listCifFiles(generatedDir, '/generated_cofs', 'generated')
      return sendJson(res, { files: generatedFiles })
    } catch (error) {
      return sendJson(res, { files: [], error: 'Failed to read generated COFs' }, 500)
    }
  }

  if (urlPath.startsWith('/api/cifs')) {
    try {
      const [generatedFiles, cifsFiles] = await Promise.all([
        listCifFiles(generatedDir, '/generated_cofs', 'generated'),
        listCifFiles(cifsDir, '/cifs', 'library'),
      ])
      const payload = [...generatedFiles, ...cifsFiles].sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0))
      return sendJson(res, { files: payload })
    } catch (error) {
      return sendJson(res, { files: [], error: 'Failed to read CIF directories' }, 500)
    }
  }

  return next()
}

const cifsListPlugin = () => {
  const middleware = createApiMiddleware()

  return {
    name: 'cifs-list-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), cifsListPlugin()],
  server: {
    port: 5173,
  },
})
