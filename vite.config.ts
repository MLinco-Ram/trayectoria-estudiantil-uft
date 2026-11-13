import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {execSync} from 'child_process';

// Versión visible en la app: commit corto + fecha/hora de compilación (hora de Chile)
const commitSha = (process.env.VERCEL_GIT_COMMIT_SHA || (() => {
  try { return execSync('git rev-parse HEAD').toString().trim(); } catch { return 'dev'; }
})()).slice(0, 7);
const buildTime = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date());

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(`${commitSha} · ${buildTime}`),
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
