import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { runSeed } from './seed/mockData';

/** Опциональный сид mock-данных в localStorage: только DEV + VITE_ENABLE_DEMO_SEED. */
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