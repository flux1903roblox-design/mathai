import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/assistant';
import '@fontsource/secular-one';
import 'katex/dist/katex.min.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/motion.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
