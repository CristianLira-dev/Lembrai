process.env.USAR_BANCO_MEMORIA = 'true';
process.env.USAR_FILAS_MEMORIA = 'true';
process.env.AMBIENTE = 'desenvolvimento';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RepositorioMemoria } = require('../src/repositorios/repositorio-dados');
const { gerarSessoes } = require('../src/controladores/estudos-controlador');
const { criptografar, descriptografar } = require('../src/utilitarios/seguranca');

test('gera sessões somente nos dias escolhidos até o prazo', () => {
  const sessoes = gerarSessoes({ titulo: 'Algoritmos', dataLimite: new Date(Date.now() + 14 * 86400000), minutosPorSessao: 45, diasSemana: [1, 3, 5] });
  assert.ok(sessoes.length >= 3);
  assert.ok(sessoes.every((sessao) => [1, 3, 5].includes(new Date(sessao.agendadaPara).getDay())));
  assert.ok(sessoes.every((sessao) => sessao.duracaoMinutos === 45));
});

test('exportação remove o marcador de senha do perfil', async () => {
  const repositorio = new RepositorioMemoria();
  await repositorio.criarUsuario({ id: 'u1', nome: 'Aluno', email: 'a@b.com', telefone: '5511999999999', senhaCriptografada: 'nao-exportar' });
  const exportacao = await repositorio.exportarDados('u1');
  assert.equal('senhaCriptografada' in exportacao.usuario, false);
});

test('criptografia de tokens mantém ida e volta no desenvolvimento', () => {
  const valor = 'token-teste';
  assert.equal(descriptografar(criptografar(valor)), valor);
});
