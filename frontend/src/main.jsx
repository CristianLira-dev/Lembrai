import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ProvedorAutenticacao } from './contextos/ContextoAutenticacao';
import { RotasAplicacao } from './rotas/RotasAplicacao';
import './estilos/global.css';
import './estilos/app-2026.css';

ReactDOM.createRoot(document.getElementById('raiz')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProvedorAutenticacao>
        <RotasAplicacao />
      </ProvedorAutenticacao>
    </BrowserRouter>
  </React.StrictMode>
);
