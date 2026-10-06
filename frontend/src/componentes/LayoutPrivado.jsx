import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { MarcaLembrai } from './MarcaLembrai';

const links = [
  { to: '/painel', rotulo: 'Hoje', icone: '⌂' },
  { to: '/tarefas', rotulo: 'Minhas tarefas', icone: '✓' },
  { to: '/estudos', rotulo: 'Planos de estudo', icone: '✦' },
  { to: '/calendario', rotulo: 'Calendário', icone: '□' },
  { to: '/notificacoes', rotulo: 'Lembretes', icone: '◌' }
];

export function LayoutPrivado() {
  const { usuario, sair } = useAutenticacao();
  const [saindo, setSaindo] = useState(false);
  const [erroSaida, setErroSaida] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);
  const [criacaoAberta, setCriacaoAberta] = useState(false);
  async function encerrarSessao() {
    setSaindo(true);
    setErroSaida('');
    try { await sair(); } catch (erro) { setErroSaida(erro.message); }
    finally { setSaindo(false); }
  }
  return (
    <div className="aplicacao">
      <header className="cabecalho-mobile"><MarcaLembrai /><button className="botao-icone" onClick={() => setMenuAberto(!menuAberto)} aria-label="Abrir menu">☰</button></header>
      {menuAberto && <button className="menu-overlay" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}
      <aside className={`barra-lateral ${menuAberto ? 'aberta' : ''}`}>
        <div className="marca-area"><MarcaLembrai /><button className="fechar-menu" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">×</button></div>
        <p className="marca-subtitulo">assistente acadêmico</p>
        <button className="botao primario botao-criar-lateral" onClick={() => setCriacaoAberta(true)}><span>＋</span> Criar novo</button>
        <span className="navegacao-titulo">Organização</span>
        <nav className="navegacao" aria-label="Navegação do painel">
          {links.map((link) => <NavLink key={link.to} to={link.to} onClick={() => setMenuAberto(false)} className={({ isActive }) => isActive ? 'navegacao-link ativo' : 'navegacao-link'}><span aria-hidden="true">{link.icone}</span>{link.rotulo}</NavLink>)}
          <span className="navegacao-titulo navegacao-titulo-secundario">Conta</span>
          <NavLink to="/integracoes" onClick={() => setMenuAberto(false)} className={({ isActive }) => isActive ? 'navegacao-link ativo' : 'navegacao-link'}><span aria-hidden="true">◎</span>Integrações</NavLink>
          <NavLink to="/configuracoes" onClick={() => setMenuAberto(false)} className={({ isActive }) => isActive ? 'navegacao-link ativo' : 'navegacao-link'}><span aria-hidden="true">⚙</span>Configurações</NavLink>
          {usuario?.administrador ? <NavLink to="/admin" className={({ isActive }) => isActive ? 'navegacao-link ativo' : 'navegacao-link'}><span aria-hidden="true">⚑</span>Administração</NavLink> : null}
        </nav>
        <div className="barra-lateral-rodape">
          <div className="avatar pequeno">{usuario?.nome?.slice(0, 1).toUpperCase() || 'E'}</div>
          <div className="usuario-resumo"><strong>{usuario?.nome || 'Estudante'}</strong><span>{usuario?.email || 'conta acadêmica'}</span></div>
          <button className="botao-icone" onClick={encerrarSessao} disabled={saindo} title="Sair" aria-label="Sair da conta">↪</button>
        </div>
        {erroSaida && <p role="alert">{erroSaida}</p>}
      </aside>
      <main className="conteudo-principal"><Outlet /></main>
      <button className="acao-flutuante" onClick={() => setCriacaoAberta(true)} aria-label="Criar novo item">＋</button>
      {criacaoAberta && <><button className="drawer-overlay" aria-label="Fechar criação rápida" onClick={() => setCriacaoAberta(false)} /><aside className="drawer-criacao" aria-label="Criação rápida"><div className="drawer-topo"><div><p className="etiqueta">Captura rápida</p><h2>O que você quer organizar?</h2></div><button className="botao-icone" onClick={() => setCriacaoAberta(false)} aria-label="Fechar">×</button></div><p className="subtitulo">Registre agora. A Lembraí ajuda você a não esquecer depois.</p><div className="opcoes-criacao"><Link to="/tarefas/nova" onClick={() => setCriacaoAberta(false)}><span className="opcao-icone pink">✓</span><span><strong>Nova tarefa</strong><small>Trabalho, prova ou atividade com prazo</small></span><b>›</b></Link><Link to="/tarefas/nova" onClick={() => setCriacaoAberta(false)}><span className="opcao-icone mint">◷</span><span><strong>Novo lembrete</strong><small>Um aviso rápido para a hora certa</small></span><b>›</b></Link><Link to="/estudos" onClick={() => setCriacaoAberta(false)}><span className="opcao-icone violeta">✦</span><span><strong>Plano de estudo</strong><small>Organize uma sessão de foco</small></span><b>›</b></Link></div><div className="drawer-dica"><span>⌁</span><p><strong>Dica rápida</strong>Você também pode mandar uma mensagem para a Lembrí pelo WhatsApp.</p></div></aside></>}
    </div>
  );
}
