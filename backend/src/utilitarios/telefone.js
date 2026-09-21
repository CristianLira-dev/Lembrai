function normalizarTelefone(valor = '') {
  let numeros = String(valor).replace(/\D/g, '');
  // Cadastro brasileiro sem DDI: DDD (2) + número (8 ou 9).
  if (numeros.length === 10 || numeros.length === 11) numeros = '55' + numeros;
  return numeros;
}

module.exports = { normalizarTelefone };
