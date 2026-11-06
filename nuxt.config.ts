// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui'
  ],

  css: ['~/assets/css/main.css'],

  // Browser tab icon: the SVG for modern browsers, with an .ico fallback
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' }
      ]
    }
  },

  // Disable Server Side Rendering -- Tauri serves a static, client-rendered app
  ssr: false,

  // Bundle the icons we use so the app works offline (no Iconify API calls)
  icon: {
    provider: 'none',
    clientBundle: {
      scan: true,
      includeCustomCollections: true
    }
  },

  // In development, fetch icons that were added since the dev server started
  // (and so aren't in its bundle yet) from the Iconify API. Builds bundle every
  // icon and work offline.
  $development: {
    icon: {
      provider: 'iconify'
    }
  },

  // Don't load fonts from Google at runtime
  fonts: {
    providers: {
      google: false,
      googleicons: false
    }
  },

  // Make the dev server reachable from a Tauri mobile device/emulator
  devServer: {
    host: process.env.TAURI_DEV_HOST || 'localhost'
  },

  // Configure Vite for better compatibility with Tauri
  vite: {
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
    optimizeDeps: {
      include: [
        '@tauri-apps/api/core',
        '@tauri-apps/plugin-opener',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'octokit'      ]
    },
    server: {
      strictPort: true,
    },
  },

  // Ignore Tauri's Rust sources when watching for changes
  ignore: ['**/src-tauri/**']
})
