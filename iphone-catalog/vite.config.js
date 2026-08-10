import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import chaosServerErrors from './vite-chaos-server.js'
import chaosSlowResponses from './vite-chaos-slow.js'

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_CHAOS_JSON': JSON.stringify(process.env.VITE_CHAOS_JSON || ''),
  },
  plugins: [react(), chaosServerErrors(), chaosSlowResponses()],
})