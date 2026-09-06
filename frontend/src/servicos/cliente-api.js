export function criarClienteApi({ urlBase, obterToken, renovarToken, invalidarSessao, executarFetch = fetch }) {
  return async function requisitar(caminho, { metodo = 'GET', dados, params, publico = false, token: tokenExplicito } = {}) {
    const url = new URL(`${urlBase.replace(/\/$/, '')}${caminho}`);
    Object.entries(params || {}).forEach(([chave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(chave, String(valor));
    });
    let token = publico ? null : tokenExplicito ?? await obterToken();

    async function enviar() {
      try {
        return await executarFetch(url.toString(), {
          method: metodo,
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(dados !== undefined ? { 'Content-Type': 'application/json' } : {})
          },
          ...(dados !== undefined ? { body: JSON.stringify(dados) } : {})
        });
      } catch {
        throw new Error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
      }
    }

    let resposta = await enviar();
    if (resposta.status === 401 && token && !publico && tokenExplicito === undefined) {
      const novoToken = await renovarToken(token);
      if (novoToken) { token = novoToken; resposta = await enviar(); }
      if (resposta.status === 401) await invalidarSessao(token);
    }
    const corpo = (resposta.headers.get('content-type') || '').includes('application/json')
      ? await resposta.json().catch(() => ({})) : {};
    if (!resposta.ok) {
      throw Object.assign(new Error(corpo.erro || 'Não foi possível concluir a operação.'), { status: resposta.status });
    }
    return { data: corpo };
  };
}
