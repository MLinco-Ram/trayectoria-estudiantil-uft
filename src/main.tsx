import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Limpieza de copias locales de versiones anteriores: los datos viven solo en MongoDB Atlas
['uft_te_users', 'uft_te_sessions', 'uft_te_reports', 'uft_te_notifications', 'uft_te_availabilities',
  'uft_te_student_requests', 'uft_te_smtp_settings', 'uft_session_user'].forEach(key => localStorage.removeItem(key));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
