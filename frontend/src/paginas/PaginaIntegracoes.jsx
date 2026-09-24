import { useEffect, useState } from 'react';
import { api } from '../servicos/api';

const descricoes = { google: { nome: 'Google Calendar', inicial: 'G', classe: 'google', texto: 'Sincronize provas, trabalhos e prazos com sua agenda Google.' }, outlook: { nome: 'Outlook Calendar', inicial: 'O', classe: 'outlook', texto: 'Leve seu planejamento acadêmico para o calendário Microsoft.' }, ics: { nome: 'ICS / WebCal', inicial: '↗', classe: 'ics', texto: 'Conecte outros calendários por um endereço compatível.' } };

export function PaginaIntegracoes() {
  const [conexoes, setConexoes] = useState([]);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  async function carregar() { try { const resposta = await api.conexoesCalendario(); setConexoes(resposta.data.conexoes); } catch (erroApi) { setErro(erroApi.message); } }
  useEffect(() => { carregar(); }, []);
  async function conectar(provedor) { setErro(''); setMensagem(''); try { const resposta = await api.conectarCalendario(provedor); if (resposta.data.url) window.location.href = resposta.data.url; else if (provedor === 'ics') { await api.conectarCalendario('ics'); setMensagem('ICS ficou disponível para configuração.'); } else setMensagem(resposta.data.mensagem); } catch (erroApi) { setErro(erroApi.message); } }
  async function sincronizar(provedor) { try { await api.sincronizarCalendario(provedor); setMensagem(`${descricoes[provedor].nome} sincronizado.`); carregar(); } catch (erroApi) { setErro(erroApi.message); } }
  async function desconectar(provedor) { try { await api.desconectarCalendario(provedor); carregar(); } catch (erroApi) { setErro(erroApi.message); } }
  return <><header className="cabecalho-pagina"><div><p className="etiqueta">Lembraí · tudo conversa entre si</p><h1>Integrações</h1><p className="subtitulo">Conecte seus calendários. A Lembraí cuida da ponte.</p></div></header>{erro && <div className="alerta erro" role="alert">A Lembraí não conseguiu atualizar a integração: {erro}</div>}{mensagem && <div className="alerta sucesso" role="status">{mensagem}</div>}<div className="grade-integracoes">{Object.keys(descricoes).map((provedor) => { const info = descricoes[provedor]; const conexao = conexoes.find((item) => item.provedor === provedor); const conectado = conexao?.status === 'conectado'; return <div className="cartao cartao-integracao" key={provedor}><div className={`logo-provedor ${info.classe}`}>{info.inicial}</div><h3>{info.nome}</h3><p>{info.texto}</p><div className="status-integracao"><span className={`ponto-status ${conectado ? 'conectado' : ''}`} />{conectado ? `Conectado${conexao.emailConta ? ` · ${conexao.emailConta}` : ''}` : 'Não conectado'}</div>{conectado ? <div className="acoes"><button className="botao secundario" onClick={() => sincronizar(provedor)}>Sincronizar</button><button className="botao perigo" onClick={() => desconectar(provedor)}>Desconectar</button></div> : <button className="botao primario" onClick={() => conectar(provedor)}>{provedor === 'ics' ? 'Configurar' : 'Conectar →'}</button>}</div>; })}</div></>;
}
