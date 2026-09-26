import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { MarcaLembrai } from '../componentes/MarcaLembrai';
import { RotuloCampo } from '../componentes/RotuloCampo';

export function PaginaConfirmarEmail() {
  const { reenviarConfirmacao } = useAutenticacao();
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await reenviarConfirmacao(email);
      navegar('/authcode');
    } catch (erroApi) {
      setErro(erroApi.message || 'Não foi possível enviar o código.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-autenticacao">
      <div className="autenticacao-apresentacao">
        <MarcaLembrai /><h1>Confirme seu<br /><em>e-mail.</em></h1>
        <p>Solicite outro código para terminar a criação da sua conta.</p>
      </div>
      <div className="autenticacao-forma"><div className="caixa-autenticacao">
        <Link className="autenticacao-voltar" to="/entrar">← Voltar para entrar</Link>
        <p className="etiqueta">Confirmação de e-mail</p><h2>Reenviar código</h2>
        <p className="subtitulo">Informe o mesmo e-mail usado no cadastro.</p>
        {erro && <div className="alerta erro" role="alert">{erro}</div>}
        <form onSubmit={enviar}>
          <div className="campo"><RotuloCampo htmlFor="email-confirmacao" obrigatorio>E-mail</RotuloCampo>
            <input id="email-confirmacao" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <button className="botao primario" disabled={enviando} type="submit">{enviando ? 'Enviando...' : 'Reenviar código →'}</button>
        </form>
      </div></div>
    </div>
  );
}
