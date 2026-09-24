import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { PaginaLanding } from '../paginas/PaginaLanding';
import { PaginaEntrada } from '../paginas/PaginaEntrada';
import { PaginaCadastro } from '../paginas/PaginaCadastro';
import { PaginaAuthCode } from '../paginas/PaginaAuthCode';
import { PaginaPainel } from '../paginas/PaginaPainel';
import { PaginaTarefas } from '../paginas/PaginaTarefas';
import { PaginaNovaTarefa } from '../paginas/PaginaNovaTarefa';
import { PaginaDetalheTarefa } from '../paginas/PaginaDetalheTarefa';
import { PaginaCalendario } from '../paginas/PaginaCalendario';
import { PaginaIntegracoes } from '../paginas/PaginaIntegracoes';
import { PaginaNotificacoes } from '../paginas/PaginaNotificacoes';
import { PaginaConfiguracoes } from '../paginas/PaginaConfiguracoes';
import { LayoutPrivado } from '../componentes/LayoutPrivado';

function RotaPrivada() {
  const { autenticado, carregando } = useAutenticacao();
  if (carregando) return <div className="tela-carregando"><span className="marca-carregando">✦ Lembraí</span><span>Carregando seu espaço...</span></div>;
  return autenticado ? <Outlet /> : <Navigate to="/entrar" replace />;
}

function RotaPublica({ children }) {
  const { autenticado, carregando } = useAutenticacao();
  if (carregando) return <div className="tela-carregando"><span className="marca-carregando">✦ Lembraí</span><span>Carregando...</span></div>;
  return autenticado ? <Navigate to="/painel" replace /> : children;
}

export function RotasAplicacao() {
  return (
    <Routes>
      <Route path="/" element={<PaginaLanding />} />
      <Route path="/entrar" element={<RotaPublica><PaginaEntrada /></RotaPublica>} />
      <Route path="/login" element={<RotaPublica><PaginaEntrada /></RotaPublica>} />
      <Route path="/cadastro" element={<RotaPublica><PaginaCadastro /></RotaPublica>} />
      <Route path="/authcode" element={<RotaPublica><PaginaAuthCode /></RotaPublica>} />
      <Route element={<RotaPrivada />}>
        <Route element={<LayoutPrivado />}>
          <Route path="/painel" element={<PaginaPainel />} />
          <Route path="/dashboard" element={<PaginaPainel />} />
          <Route path="/tarefas" element={<PaginaTarefas />} />
          <Route path="/tarefas/nova" element={<PaginaNovaTarefa />} />
          <Route path="/tarefas/:id" element={<PaginaDetalheTarefa />} />
          <Route path="/calendario" element={<PaginaCalendario />} />
          <Route path="/integracoes" element={<PaginaIntegracoes />} />
          <Route path="/notificacoes" element={<PaginaNotificacoes />} />
          <Route path="/configuracoes" element={<PaginaConfiguracoes />} />
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
