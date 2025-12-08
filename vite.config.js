import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const cifsListPlugin = () => ({
  name: 'cifs-list-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/cifs')) return next()
      try {
        const cifsDir = path.resolve(process.cwd(), 'public', 'cifs')
        const files = await fs.promises.readdir(cifsDir, { withFileTypes: true })
        const payload = files
          .filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.cif'))
          .map((f) => ({
            name: f.name.replace(/\\.cif$/i, ''),
            path: `/cifs/${f.name}`,
          }))
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ files: payload }))
      } catch (error) {
        console.error('Error listing CIFs:', error)
        res.statusCode = 500
        res.end(JSON.stringify({ files: [], error: 'Failed to read CIF directory' }))
      }
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/cifs')) return next()
      try {
        const cifsDir = path.resolve(process.cwd(), 'public', 'cifs')
        const files = await fs.promises.readdir(cifsDir, { withFileTypes: true })
        const payload = files
          .filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.cif'))
          .map((f) => ({
            name: f.name.replace(/\\.cif$/i, ''),
            path: `/cifs/${f.name}`,
          }))
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ files: payload }))
      } catch (error) {
        console.error('Error listing CIFs:', error)
        res.statusCode = 500
        res.end(JSON.stringify({ files: [], error: 'Failed to read CIF directory' }))
      }
    })
  },
})

export default defineConfig({
  plugins: [react(), cifsListPlugin()],
  server: {
    port: 5173,
  },
})
