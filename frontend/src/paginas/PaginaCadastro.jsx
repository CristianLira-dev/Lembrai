import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { IconeWhatsApp } from '../componentes/IconeWhatsApp';
import { MarcaLembrai } from '../componentes/MarcaLembrai';
import { RotuloCampo } from '../componentes/RotuloCampo';
import { formatarWhatsApp } from '../utilitarios/telefone';

export function PaginaCadastro() {
  const { cadastrar, confirmarEmail, reenviarCodigo } = useAutenticacao();
  const navegar = useNavigate();

  const [dados, setDados] = useState({
    nome: '',
    email: '',
    telefone: '',
    senha: ''
  });
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [emailConfirmacao, setEmailConfirmacao] = useState(() => sessionStorage.getItem('lembrai_email_confirmacao') || '');

  const alterar = (evento) => {
    const { name, value } = evento.target;

    setDados((dadosAtuais) => ({
      ...dadosAtuais,
      [name]: name === 'telefone' ? formatarWhatsApp(value) : value
    }));
  };

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setMensagem('');

    const telefone = dados.telefone.replace(/\D/g, '');

    if (telefone.length < 8 || telefone.length > 15) {
      setErro('Informe um número de WhatsApp válido.');
      return;
    }

    if (dados.senha.length < 8) {
      setErro('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setEnviando(true);

    try {
      const resultado = await cadastrar({
        ...dados,
        telefone
      });

      if (resultado.confirmarEmail) {
        const email = dados.email.trim().toLowerCase();
        sessionStorage.setItem('lembrai_email_confirmacao', email);
        setEmailConfirmacao(email);
        setMensagem('Enviamos um código de 6 dígitos para seu e-mail.');
        setDados((atual) => ({ ...atual, senha: '' }));
      } else {
        navegar('/painel', { replace: true });
      }
    } catch (erroApi) {
      setErro(erroApi.message || 'Não foi possível criar sua conta.');
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar(evento) {
    evento.preventDefault();
    setErro('');
    setMensagem('');
    if (!/^\d{6}$/.test(codigo)) {
      setErro('Informe o código de 6 dígitos enviado por e-mail.');
      return;
    }
    setEnviando(true);
    try {
      await confirmarEmail(emailConfirmacao, codigo);
      sessionStorage.removeItem('lembrai_email_confirmacao');
      navegar('/painel', { replace: true });
    } catch (erroApi) {
      setErro(erroApi.message || 'Não foi possível confirmar seu e-mail.');
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    setErro('');
    setMensagem('');
    setReenviando(true);
    try {
      await reenviarCodigo(emailConfirmacao);
      setMensagem('Enviamos um novo código. Confira também a pasta de spam.');
    } catch (erroApi) {
      setErro(erroApi.message || 'Não foi possível reenviar o código.');
    } finally {
      setReenviando(false);
    }
  }

  function trocarEmail() {
    sessionStorage.removeItem('lembrai_email_confirmacao');
    setEmailConfirmacao('');
    setCodigo('');
    setErro('');
    setMensagem('');
  }

  return (
    <div className="tela-autenticacao">
      <div className="autenticacao-apresentacao">
        <MarcaLembrai />

        <h1>
          Menos
          <br />
          <em>correria.</em>
        </h1>

        <p>
          Seu assistente acadêmico vive no WhatsApp e no seu painel. Crie sua
          conta e comece a tirar as tarefas da cabeça com a Lembraí.
        </p>

        <span className="mantra">Clareza para o que vem depois.</span>
      </div>

      <div className="autenticacao-forma">
        <div className="caixa-autenticacao">
          <p className="etiqueta">{emailConfirmacao ? 'Confirme seu e-mail' : 'Comece por aqui'}</p>
          <h2>{emailConfirmacao ? 'Digite o código' : 'Crie seu espaço'}</h2>

          <p className="subtitulo">
            {emailConfirmacao
              ? <>Enviamos um código de 6 dígitos para <strong>{emailConfirmacao}</strong>.</>
              : 'Uma conta para suas tarefas, calendários e lembretes na Lembraí.'}
          </p>

          {erro && (
            <div className="alerta erro" role="alert">
              {erro}
            </div>
          )}

          {mensagem && <div className="alerta" role="status">{mensagem}</div>}

          {emailConfirmacao ? (
            <form onSubmit={confirmar}>
              <div className="campo campo-codigo">
                <RotuloCampo htmlFor="codigo" obrigatorio>Código de confirmação</RotuloCampo>
                <input
                  id="codigo"
                  name="codigo"
                  value={codigo}
                  onChange={(evento) => setCodigo(evento.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  minLength="6"
                  maxLength="6"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </div>
              <button className="botao primario" disabled={enviando} type="submit">
                {enviando ? 'Confirmando...' : 'Confirmar e entrar →'}
              </button>
              <button className="botao secundario" disabled={reenviando} type="button" onClick={reenviar}>
                {reenviando ? 'Reenviando...' : 'Reenviar código'}
              </button>
              <button className="botao-link" type="button" onClick={trocarEmail}>Usar outro e-mail</button>
            </form>
          ) : <form onSubmit={enviar}>
            <div className="campo">
              <RotuloCampo htmlFor="nome" obrigatorio>
                Como podemos chamar você?
              </RotuloCampo>

              <input
                id="nome"
                name="nome"
                value={dados.nome}
                onChange={alterar}
                required
                minLength="2"
                autoComplete="name"
                placeholder="Seu nome"
              />
            </div>

            <div className="campo">
              <RotuloCampo htmlFor="email" obrigatorio>
                E-mail
              </RotuloCampo>

              <input
                id="email"
                name="email"
                type="email"
                value={dados.email}
                onChange={alterar}
                required
                autoComplete="email"
                placeholder="voce@universidade.com"
              />
            </div>

            <div className="campo">
              <RotuloCampo htmlFor="telefone" obrigatorio>
                <span className="icone-whatsapp">
                  <IconeWhatsApp tamanho={16} />
                </span>
                WhatsApp
              </RotuloCampo>

              <input
                id="telefone"
                name="telefone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={dados.telefone}
                onChange={alterar}
                required
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="campo">
              <RotuloCampo htmlFor="senha" obrigatorio>
                Crie uma senha
              </RotuloCampo>

              <input
                id="senha"
                name="senha"
                type="password"
                value={dados.senha}
                onChange={alterar}
                required
                minLength="8"
                autoComplete="new-password"
                placeholder="No mínimo 8 caracteres"
              />
            </div>

            <button
              className="botao primario"
              disabled={enviando}
              type="submit"
            >
              {enviando ? 'Criando...' : 'Criar meu espaço →'}
            </button>
          </form>}

          <p className="link-autenticacao">
            Já tem uma conta? <Link to="/entrar">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
