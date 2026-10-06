import { useEffect, useState } from 'react';
import { api } from '../servicos/api';

const INICIAL = { titulo: '', materia: '', objetivo: '', dataLimite: '', minutosPorSessao: 45, diasSemana: [1, 2, 3, 4, 5] };

export function PaginaEstudos() {
  const [planos, setPlanos] = useState([]);
  const [formulario, setFormulario] = useState(INICIAL);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function carregar() { try { setPlanos((await api.planosEstudo()).data.planos); } catch (e) { setErro(e.message); } }
  useEffect(() => { carregar(); }, []);
  async function criar(evento) {
    evento.preventDefault(); setSalvando(true); setErro('');
    try { await api.criarPlanoEstudo(formulario); setFormulario(INICIAL); await carregar(); }
    catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }
  async function concluirSessao(id) { try { await api.concluirSessaoEstudo(id); await carregar(); } catch (e) { setErro(e.message); } }
  return <><header className="cabecalho-pagina"><div><p className="etiqueta">Preparação com antecedência</p><h1>Planos de estudo</h1><p className="subtitulo">Transforme um assunto grande em sessões pequenas e possíveis.</p></div></header>
    {erro ? <div className="alerta erro" role="alert">{erro}</div> : null}
    <div className="grade-conteudo estudos-grade"><form className="cartao painel" onSubmit={criar}><div className="painel-cabecalho"><div><p className="etiqueta">Novo plano</p><h2>O que você quer aprender?</h2></div></div><div className="campo"><label htmlFor="estudo-titulo">Assunto</label><input id="estudo-titulo" required value={formulario.titulo} onChange={(e) => setFormulario((atual) => ({ ...atual, titulo: e.target.value }))} placeholder="Ex.: Conversão de binário" /></div><div className="campo"><label htmlFor="estudo-materia">Matéria</label><input id="estudo-materia" value={formulario.materia} onChange={(e) => setFormulario((atual) => ({ ...atual, materia: e.target.value }))} /></div><div className="campo"><label htmlFor="estudo-data">Estudar até</label><input id="estudo-data" type="date" required value={formulario.dataLimite} onChange={(e) => setFormulario((atual) => ({ ...atual, dataLimite: e.target.value }))} /></div><div className="campo"><label htmlFor="estudo-duracao">Minutos por sessão</label><input id="estudo-duracao" type="number" min="15" max="240" value={formulario.minutosPorSessao} onChange={(e) => setFormulario((atual) => ({ ...atual, minutosPorSessao: Number(e.target.value) }))} /></div><button className="botao primario" disabled={salvando}>{salvando ? 'Criando...' : 'Criar plano'}</button></form>
      <section className="cartao painel"><div className="painel-cabecalho"><div><p className="etiqueta">Sua preparação</p><h2>{planos.length} plano(s)</h2></div></div><div className="lista">{planos.length ? planos.map((plano) => <article className="plano-estudo" key={plano.id}><div><strong>{plano.titulo}</strong><p className="subtitulo">{plano.materia || 'Estudo livre'} · até {new Date(plano.dataLimite).toLocaleDateString('pt-BR')}</p></div><div className="lista sessoes-estudo">{(plano.sessoes || []).map((sessao) => <div className="item-tarefa" key={sessao.id}><div className="item-tarefa-corpo"><strong>{sessao.titulo}</strong><span>{sessao.duracaoMinutos} min · {new Date(sessao.agendadaPara).toLocaleString('pt-BR')}</span></div>{sessao.status !== 'concluida' ? <button className="botao-mini" onClick={() => concluirSessao(sessao.id)}>Concluir</button> : <span className="badge concluida">Concluída</span>}</div>)}</div></article>) : <div className="estado-vazio">Crie um plano e a Lembraí distribuirá sessões até a data escolhida.</div>}</div></section></div></>;
}
