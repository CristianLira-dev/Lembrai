import { useEffect, useState } from 'react';
import { IconeWhatsApp } from '../componentes/IconeWhatsApp';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { formatarWhatsApp } from '../utilitarios/telefone';
import { api } from '../servicos/api';

export function PaginaConfiguracoes() {
  const { usuario } = useAutenticacao();
  const [salvo, setSalvo] = useState(false);
  const [mensagemWhatsApp, setMensagemWhatsApp] = useState('');
  const [erro, setErro] = useState('');
  const [preferencias, setPreferencias] = useState({ notificacoesAtivas: true, horarioLembretes: '07:27', frequenciaResumo: 'diario', antecedenciasLembrete: [1440] });
  const possuiWhatsApp = Boolean(usuario?.telefone);
  const telefoneFormatado = possuiWhatsApp ? formatarWhatsApp(usuario.telefone) : '';

  useEffect(() => { api.preferencias().then((resposta) => setPreferencias((atual) => ({ ...atual, ...resposta.data.preferencias }))).catch((e) => setErro(e.message)); }, []);

  async function salvar(evento) {
    evento.preventDefault();
    setErro('');
    try { await api.salvarPreferencias(preferencias); setSalvo(true); }
    catch (e) { setErro(e.message); }
    window.setTimeout(() => setSalvo(false), 2400);
  }

  async function exportar() {
    try {
      const resposta = await api.exportarDados();
      const url = URL.createObjectURL(new Blob([JSON.stringify(resposta.data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'meus-dados-lembrai.json'; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setErro(e.message); }
  }

  async function excluirConta() {
    if (!window.confirm('Deseja solicitar a exclusão da conta? Os lembretes serão desativados imediatamente.')) return;
    try { const resposta = await api.solicitarExclusao(); setMensagemWhatsApp(resposta.data.mensagem); } catch (e) { setErro(e.message); }
  }

  function gerenciarWhatsApp() {
    setMensagemWhatsApp(possuiWhatsApp ? 'Seu WhatsApp já está vinculado à Lembraí e pronto para receber lembretes.' : 'Cadastre um número de WhatsApp para ativar esta conexão.');
  }

  return <div className="pagina-configuracoes">
    <div className="cabecalho-pagina">
      <div><p className="etiqueta">Preferências</p><h1>Configurações</h1><p className="subtitulo">Ajuste como a Lembraí acompanha sua rotina acadêmica.</p></div>
    </div>
    {salvo && <div className="alerta sucesso" role="status">Preferências salvas na sua conta.</div>}
    {erro && <div className="alerta erro" role="alert">{erro}</div>}
    <div className="configuracoes-grid">
      <section className="cartao painel configuracao-whatsapp" aria-labelledby="titulo-whatsapp">
        <div className="painel-cabecalho"><div><p className="etiqueta">Canal de lembretes</p><h2 id="titulo-whatsapp">Conectar com o WhatsApp</h2><p className="subtitulo">Receba seus prazos e confirme tarefas direto na conversa com a Lembraí.</p></div></div>
        <div className="configuracao-whatsapp-conteudo">
          <div>
            <div className="configuracao-whatsapp-identidade"><div className="logo-provedor whatsapp"><IconeWhatsApp tamanho={22} /></div><div><strong>{possuiWhatsApp ? 'WhatsApp vinculado' : 'WhatsApp não conectado'}</strong><small>{possuiWhatsApp ? 'Seu número cadastrado está pronto para receber lembretes.' : 'Cadastre um número para ativar os lembretes por WhatsApp.'}</small></div></div>
            <div className="status-conta"><span className={`ponto-status ${possuiWhatsApp ? 'conectado' : ''}`} />{possuiWhatsApp ? 'Conexão ativa' : 'Aguardando número'}</div>
          </div>
          <div className="configuracao-whatsapp-acao"><div className="campo"><label htmlFor="telefone-configuracoes">Número do WhatsApp</label><input id="telefone-configuracoes" type="tel" value={telefoneFormatado} placeholder="Número não cadastrado" readOnly /></div><button className="botao primario" type="button" onClick={gerenciarWhatsApp}>{possuiWhatsApp ? 'WhatsApp conectado' : 'Conectar WhatsApp →'}</button>{mensagemWhatsApp && <p className="mensagem-configuracao" role="status">{mensagemWhatsApp}</p>}</div>
        </div>
      </section>
      <form className="cartao painel formulario-configuracoes" onSubmit={salvar}>
        <div className="painel-cabecalho"><div><p className="etiqueta">Lembretes</p><h2>Como a Lembraí avisa você</h2></div></div>
        <label className="configuracao-linha"><span><strong>Receber lembretes</strong><small>Ativar avisos antes dos seus prazos.</small></span><input className="interruptor" type="checkbox" checked={preferencias.notificacoesAtivas} onChange={(evento) => setPreferencias((atual) => ({ ...atual, notificacoesAtivas: evento.target.checked }))} /></label>
        <div className="campo"><label htmlFor="horario-resumo">Horário do resumo</label><input id="horario-resumo" type="time" value={preferencias.horarioLembretes || '07:27'} onChange={(evento) => setPreferencias((atual) => ({ ...atual, horarioLembretes: evento.target.value }))} /></div>
        <div className="campo"><label htmlFor="frequencia-resumo">Frequência do resumo</label><select id="frequencia-resumo" value={preferencias.frequenciaResumo || 'diario'} onChange={(evento) => setPreferencias((atual) => ({ ...atual, frequenciaResumo: evento.target.value }))}><option value="diario">Todos os dias</option><option value="dias_uteis">Somente dias úteis</option><option value="desativado">Desativado</option></select></div>
        <div className="formulario-grid"><div className="campo"><label htmlFor="silencio-inicio">Não avisar depois de</label><input id="silencio-inicio" type="time" value={preferencias.horarioSilencioInicio || ''} onChange={(evento) => setPreferencias((atual) => ({ ...atual, horarioSilencioInicio: evento.target.value || null }))} /></div><div className="campo"><label htmlFor="silencio-fim">Voltar a avisar às</label><input id="silencio-fim" type="time" value={preferencias.horarioSilencioFim || ''} onChange={(evento) => setPreferencias((atual) => ({ ...atual, horarioSilencioFim: evento.target.value || null }))} /></div></div>
        <div className="campo"><label htmlFor="antecedencia">Antecedência padrão</label><select id="antecedencia" value={preferencias.antecedenciasLembrete?.[0] || 1440} onChange={(evento) => setPreferencias((atual) => ({ ...atual, antecedenciasLembrete: [Number(evento.target.value)] }))}><option value="10080">1 semana antes</option><option value="4320">3 dias antes</option><option value="2880">2 dias antes</option><option value="1440">1 dia antes</option><option value="60">1 hora antes</option></select></div>
        <div className="acoes-formulario"><button className="botao primario" type="submit">Salvar preferências</button></div>
      </form>
      <section className="cartao painel conta-configuracoes"><div className="painel-cabecalho"><div><p className="etiqueta">Sua conta</p><h2>Privacidade e dados</h2></div></div><p>A Lembraí guarda somente os dados necessários para organizar tarefas, estudos e lembretes.</p><div className="acoes"><button className="botao secundario" type="button" onClick={exportar}>Exportar meus dados</button><button className="botao perigo" type="button" onClick={excluirConta}>Solicitar exclusão</button></div></section>
    </div>
  </div>;
}
