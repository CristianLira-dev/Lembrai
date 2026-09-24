import { useState } from 'react';
import { IconeWhatsApp } from '../componentes/IconeWhatsApp';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { formatarWhatsApp } from '../utilitarios/telefone';

export function PaginaConfiguracoes() {
  const { usuario } = useAutenticacao();
  const [salvo, setSalvo] = useState(false);
  const [mensagemWhatsApp, setMensagemWhatsApp] = useState('');
  const [notificacoes, setNotificacoes] = useState(true);
  const [antecedencia, setAntecedencia] = useState('1 dia antes');
  const possuiWhatsApp = Boolean(usuario?.telefone);
  const telefoneFormatado = possuiWhatsApp ? formatarWhatsApp(usuario.telefone) : '';

  function salvar(evento) {
    evento.preventDefault();
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 2400);
  }

  function gerenciarWhatsApp() {
    setMensagemWhatsApp(possuiWhatsApp ? 'Seu WhatsApp já está vinculado à Lembraí e pronto para receber lembretes.' : 'Cadastre um número de WhatsApp para ativar esta conexão.');
  }

  return <div className="pagina-configuracoes">
    <div className="cabecalho-pagina">
      <div><p className="etiqueta">Preferências</p><h1>Configurações</h1><p className="subtitulo">Ajuste como a Lembraí acompanha sua rotina acadêmica.</p></div>
    </div>
    {salvo && <div className="alerta sucesso" role="status">Preferências salvas nesta sessão.</div>}
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
        <label className="configuracao-linha"><span><strong>Receber lembretes</strong><small>Ativar avisos antes dos seus prazos.</small></span><input className="interruptor" type="checkbox" checked={notificacoes} onChange={(evento) => setNotificacoes(evento.target.checked)} /></label>
        <div className="campo"><label htmlFor="antecedencia">Antecedência padrão</label><select id="antecedencia" value={antecedencia} onChange={(evento) => setAntecedencia(evento.target.value)}><option>1 dia antes</option><option>2 dias antes</option><option>1 hora antes</option></select></div>
        <div className="acoes-formulario"><button className="botao primario" type="submit">Salvar preferências</button></div>
      </form>
      <section className="cartao painel conta-configuracoes"><div className="painel-cabecalho"><div><p className="etiqueta">Sua conta</p><h2>Privacidade e dados</h2></div></div><p>A Lembraí usa suas preferências para organizar tarefas, calendários e lembretes. Você pode desconectar integrações a qualquer momento.</p><div className="status-conta"><span className="ponto-status conectado" /> Conta protegida por autenticação</div></section>
    </div>
  </div>;
}
