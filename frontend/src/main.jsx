import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Note: React StrictMode is intentionally omitted. This app is heavily
// three.js/WebGL based, and StrictMode's dev-only double-mount double-creates
// every WebGL canvas (hero + automation = 4 transient GPU contexts at load),
// which churns/evicts contexts on weaker industrial hardware and causes the
// "3D flashes and disappears" symptom. Production builds never double-invoke.
createRoot(document.getElementById('root')).render(
  <App />
);
