import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarcaLembrai } from '../componentes/MarcaLembrai';

const icones = {
  spark: <><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.9 8.9 0 0 1-3.6-.8L4 20l1.8-4.1A7.3 7.3 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" /></>,
  brain: <><path d="M9.5 4.4A3 3 0 0 1 15 6a3 3 0 0 1 2 5.2 3 3 0 0 1-2.5 5.2A3 3 0 0 1 9 18a3 3 0 0 1-3-4 3 3 0 0 1 .7-5.7A3 3 0 0 1 9.5 4.4Z" /><path d="M12 5v13M8 8.5h4M12 13h4M8.5 16h3.5" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3v5M16 3v5M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  bell: <><path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 22h4" /></>,
  book: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z" /><path d="M5 5v16.5M9 6h7M9 10h7" /></>,
  bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  play: <path d="m9 6 9 6-9 6V6Z" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  external: <><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>
};

function Icon({ name, size = 18, stroke = 1.7 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{icones[name]}</svg>;
}

function LogoPlaceholder({ compact = false }) {
  return <MarcaLembrai variante="landing" compact={compact} />;
}

function PhoneMockup({ step = 5, compact = false }) {
  const mostrarResposta = step >= 1;
  const mostrarAgenda = step >= 2;
  const mostrarEvento = step >= 3;
  const mostrarLembrete = step >= 4;
  const mostrarFinal = step >= 5;
  return <div className={`phone-wrap ${compact ? 'compact' : ''}`}>
    <div className="phone-glow" />
    <div className="phone-shell">
      <div className="phone-notch"><span /></div>
      <div className="phone-topbar"><div className="phone-profile"><span className="phone-avatar"><Icon name="spark" size={12} /></span><span><strong>Lembraí</strong><small>online agora</small></span></div><span className="phone-more">•••</span></div>
      <div className="phone-body">
        <div className="phone-date">Hoje, 09:41</div>
        <div className="phone-message user-message"><span>Tenho um trabalho de programação para sexta.</span><small>09:42 ✓✓</small></div>
        {mostrarResposta && <div className="phone-message assistant-message"><span>Entendi. Trabalho de Programação para sexta-feira.</span><small>09:42</small></div>}
        {mostrarAgenda && <div className="phone-action-card"><div className="phone-action-head"><span className="phone-action-icon"><Icon name="calendar" size={14} /></span><span><strong>Adicionando à sua agenda...</strong><small>Conferindo os detalhes</small></span></div><div className="phone-loading"><span /><span /><span /></div></div>}
        {mostrarEvento && <div className="phone-event-card"><span className="phone-event-check"><Icon name="check" size={14} /></span><span><strong>Evento criado</strong><small>Trabalho de Programação · sex, 23:59</small></span></div>}
        {mostrarLembrete && <div className="phone-reminder"><Icon name="bell" size={13} /><span>Lembrete configurado para 1 dia antes</span></div>}
        {mostrarFinal && <div className="phone-message assistant-message final-message"><span>Pronto. Eu te aviso antes do prazo.</span><small>09:43</small></div>}
      </div>
      <div className="phone-composer"><span>Mensagem</span><span className="phone-send"><Icon name="arrow" size={13} /></span></div>
    </div>
  </div>;
}

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const atualizar = () => setScrolled(window.scrollY > 22); window.addEventListener('scroll', atualizar, { passive: true }); atualizar(); return () => window.removeEventListener('scroll', atualizar); }, []);
  const fechar = () => setMenuOpen(false);
  return <header className={`landing-header ${scrolled ? 'scrolled' : ''}`}><div className="landing-container header-inner"><a href="#produto" onClick={fechar} aria-label="Ir para o início"><LogoPlaceholder /></a><nav className={menuOpen ? 'landing-nav open' : 'landing-nav'} aria-label="Navegação principal"><a href="#produto" onClick={fechar}>Produto</a><a href="#como-funciona" onClick={fechar}>Como funciona</a><a href="#recursos" onClick={fechar}>Recursos</a><a href="#precos" onClick={fechar}>Preços</a><a href="#faq" onClick={fechar}>FAQ</a></nav><div className="header-actions"><Link className="landing-button small primary" to="/cadastro">Começar agora <Icon name="arrow" size={14} /></Link><button className="mobile-menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen}><Icon name={menuOpen ? 'close' : 'menu'} size={20} /></button></div></div></header>;
}

function Reveal({ children, className = '' }) {
  return <div className={`landing-reveal ${className}`}>{children}</div>;
}

const recursos = [
  { icon: 'chat', title: 'WhatsApp', text: 'Organize tudo conversando naturalmente com o assistente.' },
  { icon: 'brain', title: 'Inteligência artificial', text: 'Entenda datas, horários, matérias e tarefas sem comandos rígidos.' },
  { icon: 'calendar', title: 'Calendários', text: 'Conecte suas agendas e mantenha tudo no lugar certo.' },
  { icon: 'bell', title: 'Lembretes', text: 'Receba um aviso antes de perder um prazo importante.' },
  { icon: 'book', title: 'Organização acadêmica', text: 'Provas, trabalhos e compromissos em uma só visão.' },
  { icon: 'bolt', title: 'Captura instantânea', text: 'Você não precisa abrir um aplicativo para registrar uma tarefa.' }
];

const perguntas = [
  ['O assistente funciona pelo WhatsApp?', 'Sim. O WhatsApp é o principal canal de interação com o assistente.'],
  ['Preciso instalar algum aplicativo?', 'Não. A experiência principal acontece pelo WhatsApp e o painel web acompanha tudo.'],
  ['Posso conectar meu calendário?', 'Sim. O sistema foi pensado para trabalhar com diferentes serviços de calendário.'],
  ['O assistente entende mensagens naturais?', 'Sim. Você pode escrever normalmente, como falaria com uma pessoa.'],
  ['Quanto custa?', 'O primeiro mês é gratuito. Depois, o plano passa a custar R$ 9,99/mês.'],
  ['Posso cancelar?', 'Sim. O usuário pode cancelar a assinatura conforme as condições apresentadas no processo de contratação.']
];

export function PaginaLanding() {
  const [showcaseStep, setShowcaseStep] = useState(0);
  const [faqAberto, setFaqAberto] = useState(0);
  const showcaseRef = useRef(null);

  useEffect(() => {
    const elementos = document.querySelectorAll('.landing-reveal');
    const observer = new IntersectionObserver((entradas) => entradas.forEach((entrada) => { if (entrada.isIntersecting) entrada.target.classList.add('visible'); }), { threshold: 0.12 });
    elementos.forEach((elemento) => observer.observe(elemento));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const secao = showcaseRef.current;
    if (!secao) return undefined;
    let frame = 0;
    const atualizar = () => {
      frame = 0;
      const referencia = window.innerHeight * 0.5;
      const passos = Array.from(secao.querySelectorAll('.story-step'));
      const maisProximo = passos.reduce((selecionado, passo, indice) => {
        const area = passo.getBoundingClientRect();
        const distancia = Math.abs(area.top + area.height / 2 - referencia);
        return distancia < selecionado.distancia ? { indice, distancia } : selecionado;
      }, { indice: 0, distancia: Number.POSITIVE_INFINITY });
      setShowcaseStep(maisProximo.indice);
    };
    const aoRolar = () => { if (!frame) frame = window.requestAnimationFrame(atualizar); };
    window.addEventListener('scroll', aoRolar, { passive: true }); atualizar();
    return () => { window.removeEventListener('scroll', aoRolar); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  const etapas = ['Você manda a mensagem.', 'O assistente entende.', 'A agenda recebe o evento.', 'O evento fica organizado.', 'O lembrete é configurado.', 'Você segue tranquilo.'];

  return <div className="landing-page">
    <Header />
    <main>
      <section className="landing-hero" id="produto"><div className="landing-container hero-grid"><Reveal className="hero-copy"><p className="landing-eyebrow"><span className="eyebrow-pulse" /> Assistente acadêmico no WhatsApp</p><h1>Você fala.<br /><span>O assistente organiza.</span></h1><p className="hero-subtitle">Seu assistente acadêmico inteligente direto no WhatsApp. Organize tarefas, provas e trabalhos, conecte suas agendas e receba lembretes antes dos prazos.</p><div className="hero-actions"><Link className="landing-button primary" to="/cadastro">Começar agora <Icon name="arrow" size={16} /></Link><a className="landing-text-button" href="#como-funciona"><span className="play-icon"><Icon name="play" size={12} /></span> Ver como funciona</a></div><p className="hero-trust"><Icon name="check" size={13} /> Sem cartão de crédito para começar <span /> 1 mês grátis</p></Reveal><Reveal className="hero-visual"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="floating-tag calendar-tag"><span className="floating-icon mint"><Icon name="calendar" size={14} /></span><span><strong>Calendário</strong><small>sincronizado</small></span></div><div className="floating-tag ai-tag"><span className="floating-icon pink"><Icon name="spark" size={14} /></span><span><strong>IA</strong><small>entendeu</small></span></div><div className="floating-tag task-tag"><span className="floating-check"><Icon name="check" size={12} /></span><span><strong>Tarefa criada</strong><small>no prazo</small></span></div><PhoneMockup /></Reveal></div></section>

      <section className="credibility-section"><div className="landing-container credibility-inner"><p className="credibility-lead">Seu novo jeito de organizar<br /><span>a vida acadêmica.</span></p><div className="credibility-items"><div><span className="credibility-icon"><Icon name="chat" size={17} /></span><span><strong>WhatsApp</strong><small><Icon name="check" size={11} /> Integrado</small></span></div><div><span className="credibility-icon"><Icon name="calendar" size={17} /></span><span><strong>Calendários</strong><small>Google · Outlook · Apple</small></span></div><div><span className="credibility-icon"><Icon name="brain" size={17} /></span><span><strong>IA</strong><small><Icon name="check" size={11} /> Inteligente</small></span></div><div><span className="credibility-icon"><Icon name="bell" size={17} /></span><span><strong>Lembretes</strong><small><Icon name="check" size={11} /> Automáticos</small></span></div></div></div></section>

      <section className="how-section landing-section" id="como-funciona"><div className="landing-container"><Reveal className="section-intro centered"><p className="landing-eyebrow">Como funciona</p><h2>Da mensagem à tranquilidade<br /><span>em quatro passos.</span></h2><p>Sem tutorial. Sem formulário longo. Só a conversa que você já teria.</p></Reveal><div className="steps-flow"><div className="steps-line" />{[['01', 'Fale', 'Mande uma mensagem pelo WhatsApp.', 'Tenho trabalho de programação para sexta.', 'chat'], ['02', 'O assistente entende', 'A inteligência identifica tarefa, matéria e prazo.', 'Trabalho · Programação · sexta', 'brain'], ['03', 'Organize', 'O evento é adicionado à sua agenda.', 'Evento adicionado', 'calendar'], ['04', 'Lembre', 'Você recebe um aviso antes do prazo.', 'Lembrete configurado', 'bell']].map(([numero, titulo, texto, destaque, icone], indice) => <Reveal className="step-item" key={numero}><span className="step-number">{numero}</span><span className="step-icon"><Icon name={icone} size={20} /></span><div><h3>{titulo}</h3><p>{texto}</p><code>{destaque}</code></div>{indice < 3 && <span className="step-arrow"><Icon name="arrow" size={15} /></span>}</Reveal>)}</div></div></section>

      <section className="story-section" id="experiencia" ref={showcaseRef}><div className="landing-container story-grid"><div className="story-visual"><div className="story-sticky"><p className="landing-eyebrow">Veja acontecendo</p><PhoneMockup step={showcaseStep} compact /><div className="story-status"><span className="story-status-dot" /> {etapas[showcaseStep]}</div></div></div><div className="story-content"><p className="landing-eyebrow">Uma conversa que resolve</p><h2>Do “lembrei agora”<br /><span>ao “está resolvido”.</span></h2><p className="story-description">Role para acompanhar a conversa. O assistente transforma uma frase rápida em um compromisso que você pode confiar.</p><div className="story-steps">{etapas.map((etapa, indice) => <div className={`story-step ${showcaseStep === indice ? 'active' : ''}`} key={etapa}><span className="story-step-index">0{indice + 1}</span><div><strong>{etapa}</strong><p>{['“Tenho um trabalho de programação sexta.”', 'Data, matéria e intenção identificadas.', 'Conferindo seus calendários conectados.', 'Trabalho de Programação · sexta-feira.', 'Aviso programado para um dia antes.', '“Pronto. Eu te aviso antes do prazo.”'][indice]}</p></div></div>)}</div></div></div></section>

      <section className="problem-section landing-section"><div className="landing-container problem-grid"><Reveal><p className="landing-eyebrow">O problema</p><h2>A faculdade não avisa<br /><span>quando você esquece.</span></h2></Reveal><Reveal className="problem-copy"><p>Você não precisa de mais um lugar para visitar. Precisa de um lugar que lembre por você.</p><div className="problem-quotes"><span>“Eu jurava que era semana que vem.”</span><span>“Esqueci completamente desse trabalho.”</span><span>“Onde eu anotei isso?”</span><span>“Tinha prova hoje?”</span></div><div className="solution-callout"><span className="solution-mark"><Icon name="spark" size={15} /></span><span><strong>A Lembraí transforma mensagens rápidas</strong><small>em compromissos organizados e lembretes automáticos.</small></span></div></Reveal></div></section>

      <section className="features-section landing-section" id="recursos"><div className="landing-container"><Reveal className="section-intro"><p className="landing-eyebrow">Tudo no mesmo lugar</p><h2>Feito para o ritmo<br /><span>da sua faculdade.</span></h2><p>Menos tempo organizando. Mais tempo vivendo o semestre.</p></Reveal><div className="features-grid">{recursos.map((recurso) => <Reveal className="feature-card" key={recurso.title}><span className="feature-icon"><Icon name={recurso.icon} size={20} /></span><h3>{recurso.title}</h3><p>{recurso.text}</p><span className="feature-arrow"><Icon name="arrow" size={15} /></span></Reveal>)}</div></div></section>

      <section className="calendar-section landing-section"><div className="landing-container calendar-grid"><Reveal className="calendar-copy"><p className="landing-eyebrow">Calendários conectados</p><h2>Todas as suas agendas.<br /><span>Um único assistente.</span></h2><p>Seus compromissos ficam sincronizados para você não precisar conferir três lugares diferentes.</p><Link className="landing-text-button" to="/cadastro">Conectar meu calendário <Icon name="arrow" size={15} /></Link></Reveal><Reveal className="calendar-diagram"><div className="calendar-node top-node"><span className="provider-logo google">G</span><span>Google Calendar</span><span className="node-plus">+</span></div><div className="calendar-node"><span className="provider-logo outlook">O</span><span>Outlook Calendar</span><span className="node-plus">+</span></div><div className="calendar-node"><span className="provider-logo apple">A</span><span>Apple Calendar</span><span className="node-plus">+</span></div><div className="diagram-line"><span className="diagram-dot" /></div><div className="calendar-node assistant-node"><span className="assistant-node-icon"><Icon name="spark" size={16} /></span><span><strong>Lembraí</strong><small>organiza tudo</small></span></div><div className="diagram-line"><span className="diagram-dot" /></div><div className="calendar-result"><Icon name="check" size={16} /><span>Uma agenda organizada</span></div></Reveal></div></section>

      <section className="ai-section landing-section"><div className="landing-container ai-grid"><Reveal className="ai-visual"><span className="ai-ring ring-one" /><span className="ai-ring ring-two" /><span className="ai-core"><Icon name="spark" size={35} /></span><span className="ai-chip chip-one">O que tenho amanhã?</span><span className="ai-chip chip-two">Me lembra dois dias antes.</span><span className="ai-chip chip-three">Muda minha prova para sexta.</span><span className="ai-chip chip-four">Quais tarefas estão atrasadas?</span></Reveal><Reveal className="ai-copy"><p className="landing-eyebrow">Inteligência sem esforço</p><h2>Você não precisa aprender<br /><span>a usar o assistente.</span></h2><p>É só conversar. A Lembraí entende o que você quis dizer e organiza o próximo passo.</p><div className="ai-quote"><span className="quote-mark">“</span><span>Escreva do jeito que você fala.<br /><strong>O assistente entende.</strong></span></div></Reveal></div></section>

      <section className="benefits-section landing-section"><div className="landing-container"><Reveal className="section-intro centered"><p className="landing-eyebrow">O que muda</p><h2>Mais espaço para<br /><span>o que importa.</span></h2></Reveal><div className="benefits-row"><Reveal className="benefit-item"><strong>Menos</strong><span>esquecimentos.</span></Reveal><Reveal className="benefit-item accent"><strong>Mais</strong><span>organização.</span></Reveal><Reveal className="benefit-item"><strong>Mais</strong><span>tempo.</span></Reveal><Reveal className="benefit-item"><strong>Mais</strong><span>tranquilidade.</span></Reveal></div></div></section>

      <section className="pricing-section landing-section" id="precos"><div className="landing-container"><Reveal className="section-intro centered"><p className="landing-eyebrow">Planos simples</p><h2>Comece sem pensar<br /><span>demais.</span></h2><p>Um mês para sentir a diferença. Depois, você decide.</p></Reveal><Reveal className="beta-notice"><span className="beta-notice-icon"><Icon name="spark" size={19} /></span><div><strong>Fase beta com acesso gratuito</strong><p>A Lembraí ainda está em desenvolvimento e disponível gratuitamente durante a fase de testes. Nas próximas atualizações, os planos pagos serão liberados, e os usuários beta receberão benefícios e descontos exclusivos na versão paga.</p></div></Reveal><div className="pricing-grid"><Reveal className="price-card"><p className="price-label">Plano 01</p><h3>Grátis</h3><p className="price-description">Experimente o assistente gratuitamente por 1 mês.</p><div className="price-value"><strong>R$ 0</strong><span>no primeiro mês</span></div><p className="price-note">1 mês grátis. Depois, R$ 9,99/mês.</p><Link className="landing-button secondary full" to="/cadastro">Começar grátis <Icon name="arrow" size={15} /></Link><ul><li><Icon name="check" size={14} /> Assistente pelo WhatsApp</li><li><Icon name="check" size={14} /> Tarefas e lembretes</li><li><Icon name="check" size={14} /> Dashboard completo</li></ul></Reveal><Reveal className="price-card featured"><span className="price-ribbon">Mais completo</span><p className="price-label">Plano 02</p><h3>Pro</h3><p className="price-description">Tudo o que você precisa para nunca mais perder um prazo.</p><div className="price-value"><strong>R$ 9,99</strong><span>/mês</span></div><p className="price-note">Comece gratuitamente por 1 mês.</p><Link className="landing-button primary full" to="/cadastro">Assinar plano Pro <Icon name="arrow" size={15} /></Link><ul><li><Icon name="check" size={14} /> Assistente pelo WhatsApp</li><li><Icon name="check" size={14} /> Tarefas ilimitadas</li><li><Icon name="check" size={14} /> Calendários integrados</li><li><Icon name="check" size={14} /> Sincronização e recursos avançados</li></ul></Reveal></div></div></section>

      <section className="faq-section landing-section" id="faq"><div className="landing-container faq-grid"><Reveal className="faq-intro"><p className="landing-eyebrow">Perguntas frequentes</p><h2>O que você quer<br /><span>saber primeiro?</span></h2><p>Confira as principais informações sobre a Lembraí.</p></Reveal><Reveal className="faq-list">{perguntas.map(([pergunta, resposta], indice) => <div className={`faq-item ${faqAberto === indice ? 'open' : ''}`} key={pergunta}><button type="button" onClick={() => setFaqAberto(faqAberto === indice ? -1 : indice)} aria-expanded={faqAberto === indice}><span>{pergunta}</span><span className="faq-toggle"><Icon name={faqAberto === indice ? 'minus' : 'plus'} size={14} /></span></button>{faqAberto === indice && <p>{resposta}</p>}</div>)}</Reveal></div></section>

      <section className="final-cta-section"><div className="landing-container final-cta-inner"><div className="final-cta-copy"><p className="landing-eyebrow">Seu próximo semestre começa aqui</p><h2>Pare de lembrar<br /><span>das tarefas.</span></h2><p>Deixe o assistente lembrar por você.</p><Link className="landing-button primary" to="/cadastro">Começar gratuitamente <Icon name="arrow" size={16} /></Link><small>1 mês grátis. Depois R$ 9,99/mês.</small></div><div className="final-cta-visual"><PhoneMockup compact /><span className="final-orbit orbit-a" /><span className="final-orbit orbit-b" /></div></div></section>
    </main>
    <footer className="landing-footer"><div className="landing-container"><div className="footer-main"><div className="footer-brand"><LogoPlaceholder /><p>Seu assistente acadêmico<br />direto no WhatsApp.</p></div><div className="footer-links"><div><strong>Produto</strong><a href="#como-funciona">Como funciona</a><a href="#recursos">Recursos</a><a href="#precos">Preços</a><a href="#faq">FAQ</a></div><div><strong>Acesso</strong><Link to="/entrada">Entrar</Link><Link to="/cadastro">Criar conta</Link></div></div></div><div className="footer-bottom"><span>© 2026 Lembraí. Todos os direitos reservados.</span><span>Feito para quem tem coisa demais para lembrar.</span></div></div></footer>
  </div>;
}
