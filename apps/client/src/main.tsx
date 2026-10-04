import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/gloock/400.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/azeret-mono/400.css';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';
import { RoleProvider } from './role';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RoleProvider>
      <App />
    </RoleProvider>
  </StrictMode>
);
