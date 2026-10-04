import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/gloock/400.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/azeret-mono/400.css';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
