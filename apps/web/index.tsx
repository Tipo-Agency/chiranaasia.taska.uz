import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { runSeed } from './seed/mockData';

/**
 * Локальное демо localStorage: только DEV и явный флаг VITE_ENABLE_DEMO_SEED=true|1
 * (без «тихого» сида в production).
 */
const demoSeedEnabled =
  import.meta.env.DEV &&
  (import.meta.env.VITE_ENABLE_DEMO_SEED === 'true' || import.meta.env.VITE_ENABLE_DEMO_SEED === '1');
if (demoSeedEnabled) {
  runSeed();
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);