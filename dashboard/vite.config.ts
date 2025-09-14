import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This makes the server accessible on your local network
    host: '0.0.0.0', 
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})