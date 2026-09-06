const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const ambiente = require('../configuracao/ambiente');

async function gerarHashSenha(senha) {
  return bcrypt.hash(senha, 12);
}

function obterChaveCriptografia() {
  if (!ambiente.chaveCriptografiaTokens) return null;
  const chave = Buffer.from(ambiente.chaveCriptografiaTokens, 'hex');
  if (chave.length !== 32) throw new Error('CHAVE_CRIPTOGRAFIA_TOKENS deve conter 32 bytes em hexadecimal');
  return chave;
}

function criptografar(valor) {
  if (!valor) return null;
  const chave = obterChaveCriptografia();
  if (!chave) return valor;
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', chave, iv);
  const conteudo = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [iv, tag, conteudo].map((parte) => parte.toString('base64url')).join('.');
}

function descriptografar(valor) {
  if (!valor) return null;
  const chave = obterChaveCriptografia();
  if (!chave || !valor.includes('.')) return valor;
  const [ivTexto, tagTexto, conteudoTexto] = valor.split('.');
  const decifra = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(ivTexto, 'base64url'));
  decifra.setAuthTag(Buffer.from(tagTexto, 'base64url'));
  return Buffer.concat([decifra.update(Buffer.from(conteudoTexto, 'base64url')), decifra.final()]).toString('utf8');
}

function removerSegredos(usuario) {
  if (!usuario) return usuario;
  const { senhaCriptografada, ...publico } = usuario;
  return publico;
}

module.exports = { gerarHashSenha, criptografar, descriptografar, removerSegredos };
