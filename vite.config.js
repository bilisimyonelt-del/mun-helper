import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'MUN Kriz Yardımcısı',
        short_name: 'MUN Kriz',
        description: 'Model United Nations kriz komitesi yardımcısı',
        lang: 'tr',
        theme_color: '#1f2937',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Uygulama kabuğunu (HTML/JS/CSS) çevrimdışı kullanım için önbelleğe al.
        // Veri (Supabase) önbelleği uygulama içinde localStorage ile ayrıca yönetilir.
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
      }
    })
  ]
});
