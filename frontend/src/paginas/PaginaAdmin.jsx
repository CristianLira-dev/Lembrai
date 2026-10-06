import { useEffect, useState } from 'react';
import { api } from '../servicos/api';

export function PaginaAdmin() {
  const [dados, setDados] = useState({ webhooks: [], mensagens: [] });
  const [metricas, setMetricas] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [retorno, setRetorno] = useState('');
  const [erro, setErro] = useState('');
  async function carregar() { try { const resposta = (await api.diagnosticoAdmin()).data; setDados(resposta.falhas); setMetricas(resposta.metricas); } catch (e) { setErro(e.message); } }
  useEffect(() => { carregar(); }, []);
  async function reprocessar(id) { try { await api.reprocessarWebhook(id); setRetorno('Evento liberado para recuperação.'); await carregar(); } catch (e) { setErro(e.message); } }
  async function enviar(evento) { evento.preventDefault(); try { const resposta = await api.broadcastAdmin(mensagem); setRetorno(`Envio agendado para ${resposta.data.destinatarios} usuário(s).`); setMensagem(''); } catch (e) { setErro(e.message); } }
  return <><header className="cabecalho-pagina"><div><p className="etiqueta">Operação protegida</p><h1>Administração</h1><p className="subtitulo">Acompanhe falhas sem expor o conteúdo privado das conversas.</p></div></header>{erro ? <div className="alerta erro" role="alert">{erro}</div> : null}{retorno ? <div className="alerta sucesso" role="status">{retorno}</div> : null}<section className="grade-indicadores"><div className="cartao indicador"><strong>{metricas.usuarios || 0}</strong><span>Usuários</span></div><div className="cartao indicador"><strong>{metricas.tarefas || 0}</strong><span>Tarefas</span></div><div className="cartao indicador"><strong>{metricas.mensagens || 0}</strong><span>Mensagens</span></div><div className="cartao indicador"><strong>{metricas.mensagensFalhas || 0}</strong><span>Falhas de envio</span></div></section><div className="grade-conteudo"><section className="cartao painel"><div className="painel-cabecalho"><div><p className="etiqueta">Recuperação</p><h2>{dados.webhooks.length} webhook(s) com falha</h2></div></div><div className="lista">{dados.webhooks.map((item) => <div className="item-tarefa" key={item.id}><div className="item-tarefa-corpo"><strong>{item.tipoEvento}</strong><span>{new Date(item.recebidoEm).toLocaleString('pt-BR')}</span></div><button className="botao-mini" onClick={() => reprocessar(item.id)}>Reprocessar</button></div>)}</div></section><form className="cartao painel" onSubmit={enviar}><div className="painel-cabecalho"><div><p className="etiqueta">Comunicado</p><h2>Enviar para usuários ativos</h2></div></div><div className="campo"><label htmlFor="mensagem-broadcast">Mensagem</label><textarea id="mensagem-broadcast" required maxLength="1000" value={mensagem} onChange={(e) => setMensagem(e.target.value)} /></div><button className="botao primario">Agendar envio</button></form></div></>;
}
