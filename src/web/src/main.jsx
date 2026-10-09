import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Ponto de entrada: liga o componente raiz ao <div id="root"> do index.html.
// StrictMode, em desenvolvimento, executa efeitos duas vezes para expor limpezas em falta.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
