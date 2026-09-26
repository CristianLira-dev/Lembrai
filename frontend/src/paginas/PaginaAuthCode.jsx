import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { MarcaLembrai } from '../componentes/MarcaLembrai';
import { RotuloCampo } from '../componentes/RotuloCampo';

export function PaginaAuthCode() {
  const { confirmarCodigo, redefinirSenha, obterDesafioPendente, limparDesafio } = useAutenticacao();
  const navegar = useNavigate();
  const [desafio] = useState(() => obterDesafioPendente());
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const recuperacao = desafio?.finalidade === 'recuperacao';
  const destinoVoltar = recuperacao ? '/recuperar-senha' : desafio?.finalidade === 'cadastro' ? '/cadastro' : '/entrar';

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    if (!/^[A-Z0-9]{5}$/.test(codigo)) {
      setErro('Digite os 5 caracteres do código enviado por e-mail.');
      return;
    }
    if (recuperacao && novaSenha.length < 8) {
      setErro('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      if (recuperacao) {
        const resposta = await redefinirSenha(codigo, novaSenha);
        setSucesso(resposta.mensagem);
      } else {
        await confirmarCodigo(codigo);
        navegar('/painel', { replace: true });
      }
    } catch (erroApi) {
      setErro(erroApi.message || 'Não foi possível confirmar o código.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-autenticacao">
      <div className="autenticacao-apresentacao">
        <MarcaLembrai />
        <h1>Falta só<br /><em>confirmar.</em></h1>
        <p>Essa etapa protege sua conta e confirma que o endereço de e-mail pertence a você.</p>
        <span className="mantra">Cinco caracteres. Dez minutos.</span>
      </div>
      <div className="autenticacao-forma">
        <div className="caixa-autenticacao">
          <Link className="autenticacao-voltar" to={destinoVoltar} onClick={limparDesafio}>
            <span aria-hidden="true">←</span> Voltar
          </Link>
          <p className="etiqueta">Verificação de identidade</p>
          <h2>{recuperacao ? 'Crie uma nova senha' : 'Confira seu e-mail'}</h2>

          {sucesso ? (
            <>
              <div className="alerta sucesso" role="status">{sucesso}</div>
              <Link className="botao primario authcode-link" to="/entrar">Entrar na Lembraí →</Link>
            </>
          ) : !desafio ? (
            <>
              <div className="alerta erro" role="alert">Nenhum código pendente. Inicie a verificação novamente.</div>
              <Link className="botao primario authcode-link" to="/entrar">Voltar para entrar</Link>
            </>
          ) : (
            <>
              <p className="subtitulo">Enviamos um código para <strong>{desafio.email}</strong>. Ele expira em 10 minutos.</p>
              {erro && <div className="alerta erro" role="alert">{erro}</div>}
              <form onSubmit={enviar}>
                <div className="campo">
                  <RotuloCampo htmlFor="auth-code" obrigatorio>Código de verificação</RotuloCampo>
                  <input
                    className="authcode-input"
                    id="auth-code"
                    value={codigo}
                    onChange={(evento) => setCodigo(evento.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5))}
                    required autoFocus autoComplete="one-time-code" inputMode="text"
                    minLength="5" maxLength="5" pattern="[A-Z0-9]{5}" placeholder="A7K2P"
                  />
                  <small className="authcode-ajuda">Use letras e números exatamente como aparecem no e-mail.</small>
                </div>
                {recuperacao && (
                  <div className="campo">
                    <RotuloCampo htmlFor="nova-senha" obrigatorio>Nova senha</RotuloCampo>
                    <input
                      id="nova-senha" type="password" value={novaSenha}
                      onChange={(evento) => setNovaSenha(evento.target.value)}
                      required minLength="8" maxLength="128" autoComplete="new-password"
                      placeholder="No mínimo 8 caracteres"
                    />
                  </div>
                )}
                <button className="botao primario" disabled={enviando} type="submit">
                  {enviando ? 'Verificando...' : recuperacao ? 'Alterar minha senha →' : 'Confirmar e continuar →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
