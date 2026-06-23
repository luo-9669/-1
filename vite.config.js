import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { handleApiRequest } from './server/mock-api.mjs'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    {
      name: 'liuchengtong-local-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api')) {
            handleApiRequest(req, res)
            return
          }
          next()
        })
      }
    }
  ],
  server: {
    port: 5288,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(@vue|vue)\//.test(id)) return 'vue-vendor'
          if (id.includes('/jszip/') || id.includes('/file-saver/')) return 'document-vendor'
          if (id.includes('/playwright-core/') || id.includes('/single-file-cli/')) return 'automation-vendor'
          return 'vendor'
        }
      }
    }
  }
})
