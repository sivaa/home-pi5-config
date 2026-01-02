/**
 * Main entry point for Dashboard React
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MQTTProvider } from '@/providers/MQTTProvider';
import { App } from '@/App';
import '@/styles/globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <MQTTProvider>
      <App />
    </MQTTProvider>
  </StrictMode>
);
