$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot

function Testar-Comando($comando, $nome) {
  if (-not (Get-Command $comando -ErrorAction SilentlyContinue)) {
    throw "Dependência não encontrada: $nome. Instale-a e tente novamente."
  }
}

Testar-Comando 'node' 'Node.js 20 ou superior'
Testar-Comando 'npm' 'npm'
Testar-Comando 'python' 'Python 3.11 ou superior'

if (-not (Test-Path "$raiz\chatbot\.venv\Scripts\python.exe")) {
  Write-Host 'Criando ambiente virtual do chatbot...' -ForegroundColor Yellow
  Push-Location "$raiz\chatbot"
  python -m venv .venv
  & .\.venv\Scripts\python.exe -m pip install -r requisitos.txt
  Pop-Location
}

if (-not (Test-Path "$raiz\backend\node_modules")) {
  Write-Host 'Instalando dependências do backend...' -ForegroundColor Yellow
  Push-Location "$raiz\backend"
  npm install
  Pop-Location
}

if (-not (Test-Path "$raiz\frontend\node_modules")) {
  Write-Host 'Instalando dependências do frontend...' -ForegroundColor Yellow
  Push-Location "$raiz\frontend"
  npm install
  Pop-Location
}

$janelaChatbot = "Set-Location '$raiz\chatbot'; & '.\.venv\Scripts\Activate.ps1'; `$env:TOKEN_SERVICO_INTERNO='desenvolvimento-token-interno'; python -m uvicorn aplicativo.principal:aplicacao --reload --port 8000"
$janelaBackend = "Set-Location '$raiz\backend'; `$env:USAR_BANCO_MEMORIA='true'; `$env:USAR_FILAS_MEMORIA='true'; `$env:MODO_WHATSAPP='simulado'; `$env:TOKEN_SERVICO_INTERNO='desenvolvimento-token-interno'; npm run desenvolvimento:memoria"
$janelaFrontend = "Set-Location '$raiz\frontend'; `$env:VITE_URL_API='http://localhost:3000/api'; npm run desenvolvimento"

Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $janelaChatbot
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $janelaBackend
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $janelaFrontend

Write-Host ''
Write-Host 'Serviços iniciados em janelas separadas:' -ForegroundColor Green
Write-Host 'Painel:   http://localhost:5173'
Write-Host 'Backend:  http://localhost:3000/api/saude'
Write-Host 'Chatbot:  http://localhost:8000/api/saude'
Write-Host ''
Write-Host 'Para encerrar, feche as três janelas do PowerShell.' -ForegroundColor Cyan
