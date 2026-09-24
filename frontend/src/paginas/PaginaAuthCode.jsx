import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { MarcaLembrai } from '../componentes/MarcaLembrai';
import { RotuloCampo } from '../componentes/RotuloCampo';

export function PaginaAuthCode() {
  const { confirmarCodigo, obterDesafioPendente, limparDesafio } = useAutenticacao();
  const navegar = useNavigate();
  const [desafio] = useState(() => obterDesafioPendente());
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const destinoVoltar = desafio?.finalidade === 'cadastro' ? '/cadastro' : '/entrar';

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    if (!/^[A-Z0-9]{5}$/.test(codigo)) {
      setErro('Digite os 5 caracteres do código enviado por e-mail.');
      return;
    }
    setEnviando(true);
    try {
      await confirmarCodigo(codigo);
      navegar('/painel', { replace: true });
    } catch (erroApi) {
      setErro(erroApi.message || 'Não foi possível confirmar o código.');
    } finally {
      setEnviando(false);
    }
  }

  function voltar() {
    limparDesafio();
  }

  return (
    <div className="tela-autenticacao">
      <div className="autenticacao-apresentacao">
        <MarcaLembrai />
        <h1>Falta só<br /><em>confirmar.</em></h1>
        <p>Essa etapa protege seu espaço e confirma que o endereço de e-mail informado pertence a você.</p>
        <span className="mantra">Cinco caracteres. Dez minutos.</span>
      </div>

      <div className="autenticacao-forma">
        <div className="caixa-autenticacao">
          <Link className="autenticacao-voltar" to={destinoVoltar} onClick={voltar}>
            <span aria-hidden="true">←</span> Voltar e corrigir os dados
          </Link>
          <p className="etiqueta">Verificação de identidade</p>
          <h2>Confira seu e-mail</h2>

          {!desafio ? (
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
                    name="auth_code"
                    value={codigo}
                    onChange={(evento) => setCodigo(evento.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5))}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode="text"
                    minLength="5"
                    maxLength="5"
                    pattern="[A-Z0-9]{5}"
                    aria-describedby="auth-code-ajuda"
                    placeholder="A7K2P"
                  />
                  <small id="auth-code-ajuda" className="authcode-ajuda">Use letras e números exatamente como aparecem no e-mail.</small>
                </div>
                <button className="botao primario" disabled={enviando} type="submit">
                  {enviando ? 'Verificando...' : 'Confirmar e continuar →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
