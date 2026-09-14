import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Backend port override: point the dev proxy at the sovereign backend.
// Defaults to the documented `node server.js` port (5000). If you run the
// backend on another port (e.g. $env:PORT=4100), set BACKEND_PORT to match.
const backendTarget = process.env.BACKEND_PORT
  ? `http://localhost:${process.env.BACKEND_PORT}`
  : 'http://localhost:5000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
})
