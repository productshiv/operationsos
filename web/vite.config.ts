import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Where the harness runs. In dev the browser cannot call it directly (CORS), so we proxy
// same-origin requests under /tf to it. Override with TRUEFORGE_TARGET if it runs elsewhere.
const HARNESS_TARGET = process.env.TRUEFORGE_TARGET ?? 'http://localhost:8790'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tf': {
        target: HARNESS_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tf/, ''),
      },
    },
  },
})
