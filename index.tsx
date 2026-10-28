// fonts are served from our own domain (no Google Fonts) — kosher filters approve one clean domain
import '@fontsource/assistant/300.css';
import '@fontsource/assistant/400.css';
import '@fontsource/assistant/500.css';
import '@fontsource/assistant/600.css';
import '@fontsource/assistant/700.css';
import '@fontsource/assistant/800.css';
import '@fontsource/noto-serif-hebrew/200.css';
import '@fontsource/noto-serif-hebrew/300.css';
import '@fontsource/noto-serif-hebrew/400.css';
import '@fontsource/noto-serif-hebrew/500.css';
import '@fontsource/karantina/300.css';
import '@fontsource/karantina/400.css';
import '@fontsource/karantina/700.css';
import '@fontsource/secular-one/400.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './theme.css'; 
import App from './App';

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
