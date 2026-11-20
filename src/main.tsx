import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Limpieza de copias locales de versiones anteriores: los datos viven solo en MongoDB Atlas
['uft_te_users', 'uft_te_sessions', 'uft_te_reports', 'uft_te_notifications', 'uft_te_availabilities',
  'uft_te_student_requests', 'uft_te_smtp_settings', 'uft_session_user'].forEach(key => localStorage.removeItem(key));

// App instalable (PWA): solo en producción, para no interferir con la recarga en caliente de Vite
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('No se pudo registrar el service worker:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
