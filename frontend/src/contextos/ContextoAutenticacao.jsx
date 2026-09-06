import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../servicos/api';
import { exigirSupabase, supabase } from '../servicos/supabase';

const ContextoAutenticacao = createContext(null);

export function ProvedorAutenticacao({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erroSessao, setErroSessao] = useState('');
  const estado = useRef({ versao: 0, token: null, usuario: null, promessa: null });

  const sincronizarSessao = useCallback((sessao) => {
    const atual = estado.current;
    if (!sessao) {
      estado.current = { versao: atual.versao + 1, token: null, usuario: null, promessa: null };
      setUsuario(null);
      setCarregando(false);
      return Promise.resolve(null);
    }
    if (atual.token === sessao.access_token && atual.promessa) return atual.promessa;
    if (atual.usuario?.id === sessao.user.id) {
      atual.token = sessao.access_token;
      return Promise.resolve(atual.usuario);
    }
    const versao = atual.versao + 1;
    estado.current = { versao, token: sessao.access_token, usuario: null, promessa: null };
    setUsuario(null);
    setCarregando(true);
    setErroSessao('');
    // Token explícito: nenhuma chamada ao SDK dentro de onAuthStateChange.
    const promessa = api.eu(sessao.access_token).then(({ data }) => {
      if (estado.current.versao !== versao) return null;
      estado.current.usuario = data.usuario;
      setUsuario(data.usuario);
      return data.usuario;
    }).catch((erro) => {
      if (estado.current.versao === versao) {
        estado.current.token = null;
        setErroSessao(erro.message);
      }
      throw erro;
    }).finally(() => {
      if (estado.current.versao === versao) setCarregando(false);
    });
    estado.current.promessa = promessa;
    return promessa;
  }, []);

  useEffect(() => {
    localStorage.removeItem('assistente_token');
    if (!supabase) {
      setErroSessao('Autenticação indisponível. Configure a conexão com o Supabase.');
      setCarregando(false);
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      sincronizarSessao(sessao).catch(() => {});
    });
    const expirada = () => {
      sincronizarSessao(null);
      setErroSessao('Sua sessão expirou. Entre novamente.');
    };
    window.addEventListener('sessao-expirada', expirada);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('sessao-expirada', expirada);
      estado.current = { versao: estado.current.versao + 1, token: null, usuario: null, promessa: null };
    };
  }, [sincronizarSessao]);

  async function aceitarSessao(sessao) {
    if (!sessao?.access_token || !sessao?.refresh_token) throw new Error('Não foi possível iniciar sua sessão.');
    const { data, error } = await exigirSupabase().auth.setSession({
      access_token: sessao.access_token, refresh_token: sessao.refresh_token
    });
    if (error) throw new Error('Não foi possível iniciar sua sessão. Tente entrar novamente.');
    return sincronizarSessao(data.session);
  }

  async function entrar(dados) {
    exigirSupabase();
    setErroSessao('');
    const resposta = await api.entrar(dados);
    await aceitarSessao(resposta.data.sessao);
  }

  async function cadastrar(dados) {
    exigirSupabase();
    setErroSessao('');
    const resposta = await api.cadastrar(dados);
    if (resposta.data.sessao) await aceitarSessao(resposta.data.sessao);
    return { confirmarEmail: resposta.data.confirmarEmail };
  }

  async function sair() {
    const { error } = await exigirSupabase().auth.signOut({ scope: 'local' });
    if (error) throw new Error('Não foi possível encerrar a sessão. Tente novamente.');
    await sincronizarSessao(null);
    setErroSessao('');
  }

  const valor = useMemo(() => ({
    usuario, carregando, erroSessao, autenticado: Boolean(usuario), entrar, cadastrar, sair
  }), [usuario, carregando, erroSessao]);
  return <ContextoAutenticacao.Provider value={valor}>{children}</ContextoAutenticacao.Provider>;
}

export function useAutenticacao() {
  const contexto = useContext(ContextoAutenticacao);
  if (!contexto) throw new Error('useAutenticacao deve ser usado dentro de ProvedorAutenticacao');
  return contexto;
}
