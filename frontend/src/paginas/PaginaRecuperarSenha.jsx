import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { MarcaLembrai } from '../componentes/MarcaLembrai';
import { RotuloCampo } from '../componentes/RotuloCampo';

export function PaginaRecuperarSenha() {
  const { solicitarRecuperacao } = useAutenticacao();
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await solicitarRecuperacao(email);
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
        <MarcaLembrai /><h1>Recupere seu<br /><em>acesso.</em></h1>
        <p>Vamos enviar um código de cinco caracteres para o e-mail da sua conta.</p>
      </div>
      <div className="autenticacao-forma"><div className="caixa-autenticacao">
        <Link className="autenticacao-voltar" to="/entrar">← Voltar para entrar</Link>
        <p className="etiqueta">Recuperação de senha</p><h2>Qual é seu e-mail?</h2>
        <p className="subtitulo">Se houver uma conta vinculada, você receberá o código em alguns instantes.</p>
        {erro && <div className="alerta erro" role="alert">{erro}</div>}
        <form onSubmit={enviar}>
          <div className="campo"><RotuloCampo htmlFor="email-recuperacao" obrigatorio>E-mail</RotuloCampo>
            <input id="email-recuperacao" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <button className="botao primario" disabled={enviando} type="submit">{enviando ? 'Enviando...' : 'Enviar código →'}</button>
        </form>
      </div></div>
    </div>
  );
}
