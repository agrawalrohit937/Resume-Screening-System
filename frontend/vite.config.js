import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ROUTE_SEO_PAGES = [
  {
    file: 'jobs.html',
    url: 'https://www.careershala.tech/jobs',
    title: 'Explore Tech Jobs & Developer Openings — CareerShala',
    description: 'Search thousands of verified remote, hybrid, and onsite tech jobs. Compare your resume with AI ATS matching and apply directly.',
  },
  {
    file: 'results.html',
    url: 'https://www.careershala.tech/results',
    title: 'Free AI ATS Resume Checker & Scanner — CareerShala',
    description: "Check your resume's ATS compatibility score against any job description with CareerShala's AI scanner. Identify missing skills and boost interview callbacks.",
  },
  {
    file: 'careers.html',
    url: 'https://www.careershala.tech/careers',
    title: 'Careers at CareerShala — Join the AI Career Platform Team',
    description: 'Explore high-impact engineering, AI research, and product roles at CareerShala. Build real-time AI mock interview engines, ATS optimizers, and verified developer portfolios.',
  },
  {
    file: 'login.html',
    url: 'https://www.careershala.tech/login',
    title: 'Sign In — CareerShala',
    description: 'Sign in to CareerShala to access your AI ATS resume scanner, mock interviews, developer portfolio, and job applications.',
  },
  {
    file: 'signup.html',
    url: 'https://www.careershala.tech/signup',
    title: 'Create Free Account — CareerShala',
    description: 'Join CareerShala for free. Optimize your resume for ATS, practice live AI mock interviews, and launch your verified developer portfolio.',
  },
]

function escapeHtmlAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Generates route-specific static HTML shells in dist/ so crawlers receive
 * unique titles, descriptions, canonicals, and WebPage JSON-LD per public route
 * instead of inheriting the homepage SoftwareApplication snippet.
 */
function routeSeoHtmlPlugin() {
  let outDir = 'dist'
  return {
    name: 'careershala-route-seo-html',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir || 'dist')
    },
    closeBundle() {
      const indexPath = path.join(outDir, 'index.html')
      if (!fs.existsSync(indexPath)) return
      const baseHtml = fs.readFileSync(indexPath, 'utf8')

      for (const page of ROUTE_SEO_PAGES) {
        const title = escapeHtmlAttr(page.title)
        const desc = escapeHtmlAttr(page.description)
        const url = escapeHtmlAttr(page.url)
        const routeJsonLd = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: page.title,
          description: page.description,
          url: page.url,
          isPartOf: { '@id': 'https://www.careershala.tech/#website' },
        })

        const html = baseHtml
          .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${url}" />`)
          .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
          .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${desc}" />`)
          .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${url}" />`)
          .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${title}" />`)
          .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${desc}" />`)
          .replace(/<meta\s+name="twitter:url"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:url" content="${url}" />`)
          .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${title}" />`)
          .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${desc}" />`)
          .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">\n  ${routeJsonLd}\n  </script>`)

        fs.writeFileSync(path.join(outDir, page.file), html, 'utf8')
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), routeSeoHtmlPlugin()],
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
  esbuild: {
    pure: ['console.log', 'console.debug'],
    drop: ['debugger'],
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
              normalized.includes('/jspdf/') ||
              normalized.includes('/html2canvas/')
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
