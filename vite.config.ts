import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@corprealm/xo': path.join(root, 'src/xo/rules.ts') },
  },
  server: {
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
})
