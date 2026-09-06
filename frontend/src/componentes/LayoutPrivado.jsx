import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { MarcaLembrai } from './MarcaLembrai';

const links = [
  { to: '/painel', rotulo: 'Visão geral', icone: '⌂' },
  { to: '/tarefas', rotulo: 'Tarefas', icone: '✓' },
  { to: '/calendario', rotulo: 'Calendário', icone: '◫' },
  { to: '/integracoes', rotulo: 'Integrações', icone: '◎' },
  { to: '/notificacoes', rotulo: 'Notificações', icone: '◔' },
  { to: '/configuracoes', rotulo: 'Configurações', icone: '⚙' }
];

export function LayoutPrivado() {
  const { usuario, sair } = useAutenticacao();
  const [saindo, setSaindo] = useState(false);
  const [erroSaida, setErroSaida] = useState('');
  async function encerrarSessao() {
    setSaindo(true);
    setErroSaida('');
    try { await sair(); } catch (erro) { setErroSaida(erro.message); }
    finally { setSaindo(false); }
  }
  return (
    <div className="aplicacao">
      <aside className="barra-lateral">
        <MarcaLembrai />
        <p className="marca-subtitulo">seu espaço acadêmico</p>
        <nav className="navegacao" aria-label="Navegação do painel">
          {links.map((link) => <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? 'navegacao-link ativo' : 'navegacao-link'}><span aria-hidden="true">{link.icone}</span>{link.rotulo}</NavLink>)}
        </nav>
        <div className="barra-lateral-rodape">
          <div className="avatar pequeno">{usuario?.nome?.slice(0, 1).toUpperCase() || 'E'}</div>
          <div className="usuario-resumo"><strong>{usuario?.nome || 'Estudante'}</strong><span>{usuario?.email || 'conta acadêmica'}</span></div>
          <button className="botao-icone" onClick={encerrarSessao} disabled={saindo} title="Sair" aria-label="Sair da conta">↪</button>
        </div>
        {erroSaida && <p role="alert">{erroSaida}</p>}
      </aside>
      <main className="conteudo-principal"><Outlet /></main>
    </div>
  );
}
