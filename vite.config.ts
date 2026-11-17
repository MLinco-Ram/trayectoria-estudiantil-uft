import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {readFileSync} from 'fs';

// Versión visible en la app: la de package.json (subir el último número en cada commit)
const appVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version;

// `npm run preview` sirve la app compilada con las mismas cabeceras de seguridad que vercel.json,
// para comprobar que la CSP no bloquea nada. (upgrade-insecure-requests y el host wss se omiten en local.)
function previewSecurityHeaders(): Record<string, string> {
  const cfg = JSON.parse(readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf-8'));
  const out: Record<string, string> = {};
  for (const h of cfg.headers?.[0]?.headers ?? []) {
    if (h.key === 'Access-Control-Allow-Origin' || h.key === 'Vary') continue;
    out[h.key] = h.key === 'Content-Security-Policy'
      ? h.value.replace('; upgrade-insecure-requests', '').replace(/ wss:\/\/[^;]+/, " ws://localhost:4173")
      : h.value;
  }
  return out;
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Librerías estables en archivos propios: el navegador las conserva en caché entre despliegues
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
            'vendor-realtime': ['socket.io-client'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
    preview: {
      port: 4173,
      headers: previewSecurityHeaders(),
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        '/socket.io': { target: 'http://localhost:3001', changeOrigin: true, ws: true },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          ws: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/dist/**', '**/.git/**']
      },
    },
  };
});
