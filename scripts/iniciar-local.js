const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '..');
const chatbot = path.join(raiz, 'chatbot');
const backend = path.join(raiz, 'backend');
const frontend = path.join(raiz, 'frontend');
const windows = process.platform === 'win32';
const npm = windows ? 'npm.cmd' : 'npm';
const python = windows ? 'python' : 'python3';
const pythonVirtual = windows
  ? path.join(chatbot, '.venv', 'Scripts', 'python.exe')
  : path.join(chatbot, '.venv', 'bin', 'python');
const processos = [];

function executar(comando, argumentos, opcoes) {
  const resultado = spawnSync(comando, argumentos, { stdio: 'inherit', shell: windows, ...opcoes });
  if (resultado.error || resultado.status !== 0) {
    throw resultado.error || new Error(`Comando falhou: ${comando} ${argumentos.join(' ')}`);
  }
}

function preparar() {
  if (!fs.existsSync(pythonVirtual)) {
    console.log('Criando ambiente virtual do chatbot...');
    executar(python, ['-m', 'venv', '.venv'], { cwd: chatbot });
    executar(pythonVirtual, ['-m', 'pip', 'install', '-r', 'requisitos.txt'], { cwd: chatbot });
  }
  if (!fs.existsSync(path.join(backend, 'node_modules'))) {
    console.log('Instalando dependências do backend...');
    executar(npm, ['install'], { cwd: backend });
  }
  if (!fs.existsSync(path.join(frontend, 'node_modules'))) {
    console.log('Instalando dependências do frontend...');
    executar(npm, ['install'], { cwd: frontend });
  }
}

function iniciar(comando, argumentos, cwd, ambiente) {
  const processo = spawn(comando, argumentos, {
    cwd,
    env: { ...process.env, ...ambiente },
    stdio: 'inherit',
    shell: windows
  });
  processos.push(processo);
  processo.on('error', (erro) => console.error(`Falha ao iniciar ${comando}:`, erro.message));
  return processo;
}

function encerrar() {
  processos.forEach((processo) => processo.kill());
  process.exit();
}

try {
  const semRedis = process.argv.includes('sem-redis');
  preparar();
  iniciar(pythonVirtual, ['-m', 'uvicorn', 'aplicativo.principal:aplicacao', '--reload', '--port', '8000'], chatbot, { TOKEN_SERVICO_INTERNO: 'desenvolvimento-token-interno' });
  iniciar(npm, ['run', semRedis ? 'desenvolvimento:sem-redis' : 'desenvolvimento:memoria'], backend, {
    PORTA_BACKEND: '3000',
    TOKEN_SERVICO_INTERNO: 'desenvolvimento-token-interno',
    ...(semRedis ? { USAR_BANCO_MEMORIA: 'false', USAR_FILAS_MEMORIA: 'true' } : {})
  });
  iniciar(npm, ['run', 'desenvolvimento'], frontend, { VITE_URL_API: 'http://localhost:3000/api' });
  console.log('\nServiços iniciados:');
  console.log('Painel:  http://localhost:5173');
  console.log('API:     http://localhost:3000/api/saude');
  console.log('Chatbot: http://localhost:8000/docs');
  console.log(semRedis ? 'Banco:   PostgreSQL/Supabase; processamento direto sem Redis' : 'Banco:   memória; WhatsApp simulado');
  console.log('\nPressione Ctrl+C para encerrar.\n');
} catch (erro) {
  console.error(`\nNão foi possível iniciar o ambiente local: ${erro.message}`);
  process.exitCode = 1;
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
