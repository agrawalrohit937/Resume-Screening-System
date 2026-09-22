import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'react-router-dom',
      '@react-oauth/google',
      'framer-motion',
      'react-hot-toast',
      'lucide-react'
    ],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      '@react-oauth/google',
      'framer-motion',
      'lucide-react',
      'axios',
      'react-hot-toast',
      'recharts',
      'date-fns',
      'canvas-confetti',
    ],
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const normalized = id.replace(/\\/g, '/')
            // Core React ecosystem and router MUST stay in the same chunk to guarantee a single ReactCurrentDispatcher
            if (
              normalized.includes('/react/') ||
              normalized.includes('/react-dom/') ||
              normalized.includes('/scheduler/') ||
              normalized.includes('/react-router/') ||
              normalized.includes('/react-router-dom/') ||
              normalized.includes('/@react-oauth/') ||
              normalized.includes('/use-sync-external-store/')
            ) {
              return 'vendor-react-core'
            }
            if (normalized.includes('/framer-motion/')) {
              return 'vendor-framer'
            }
            if (normalized.includes('/recharts/') || normalized.includes('/d3-')) {
              return 'vendor-charts'
            }
            if (normalized.includes('/lucide-react/') || normalized.includes('/react-icons/')) {
              return 'vendor-icons'
            }
            if (
              normalized.includes('/pdfjs-dist/') ||
              normalized.includes('/jspdf/') ||
              normalized.includes('/html2canvas/') ||
              normalized.includes('/mammoth/')
            ) {
              return 'vendor-pdf'
            }
            if (
              normalized.includes('/axios/') ||
              normalized.includes('/date-fns/') ||
              normalized.includes('/react-hot-toast/') ||
              normalized.includes('/clsx/')
            ) {
              return 'vendor-utils'
            }
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none", 
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
