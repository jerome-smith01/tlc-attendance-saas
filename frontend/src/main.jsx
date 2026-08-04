import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';  // Must be first — sets tokens for all components
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
