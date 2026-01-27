# Script de Setup para GitHub - DockBrain
# Ejecutar en PowerShell: .\setup-github.ps1

Write-Host "================================" -ForegroundColor Blue
Write-Host "  DockBrain - GitHub Setup" -ForegroundColor Blue
Write-Host "================================" -ForegroundColor Blue
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: Ejecuta este script desde el directorio de DockBrain" -ForegroundColor Red
    exit 1
}

# Pedir username de GitHub
Write-Host "Paso 1: Configuracion inicial" -ForegroundColor Green
Write-Host ""
$githubUser = Read-Host "Ingresa tu username de GitHub"

if ([string]::IsNullOrWhiteSpace($githubUser)) {
    Write-Host "ERROR: El username no puede estar vacio" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Actualizando URLs en los archivos..." -ForegroundColor Yellow

# Actualizar URLs en archivos
$files = @(
    "README.md",
    "SETUP_LINUX.md",
    "package.json",
    "GITHUB_SETUP.md",
    "QUICK_REFERENCE.md"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $content = $content -replace 'TU_USUARIO', $githubUser
        Set-Content $file $content -NoNewline
        Write-Host "  OK $file actualizado" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Paso 2: Inicializando Git" -ForegroundColor Green
Write-Host ""

# Verificar si Git está instalado
$gitInstalled = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitInstalled) {
    Write-Host "ERROR: Git no esta instalado. Descargalo de https://git-scm.com/" -ForegroundColor Red
    exit 1
}

# Inicializar Git si no está inicializado
if (-not (Test-Path ".git")) {
    git init
    Write-Host "  OK Git inicializado" -ForegroundColor Green
} else {
    Write-Host "  OK Git ya esta inicializado" -ForegroundColor Green
}

Write-Host ""
Write-Host "Paso 3: Haciendo commit inicial" -ForegroundColor Green
Write-Host ""

# Add all files
git add .
Write-Host "  OK Archivos anadidos" -ForegroundColor Green

# Commit
git commit -m "feat: initial release - DockBrain MVP with Linux and Ollama support"
Write-Host "  OK Commit creado" -ForegroundColor Green

Write-Host ""
Write-Host "Paso 4: Crear repositorio en GitHub" -ForegroundColor Green
Write-Host ""
Write-Host "Abre tu navegador y ve a:" -ForegroundColor Yellow
Write-Host "https://github.com/new" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configura el repositorio:" -ForegroundColor Yellow
Write-Host "  - Repository name: dockbrain" -ForegroundColor White
Write-Host "  - Description: Local-first task automation assistant for Telegram with Ollama support" -ForegroundColor White
Write-Host "  - Public: SI (recomendado)" -ForegroundColor White
Write-Host "  - NO marques: Add a README, .gitignore, o license" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Has creado el repositorio en GitHub? (s/n)"

if ($confirm -ne "s" -and $confirm -ne "S") {
    Write-Host ""
    Write-Host "Cuando hayas creado el repositorio, ejecuta:" -ForegroundColor Yellow
    Write-Host "  git remote add origin https://github.com/$githubUser/dockbrain.git" -ForegroundColor Cyan
    Write-Host "  git branch -M main" -ForegroundColor Cyan
    Write-Host "  git push -u origin main" -ForegroundColor Cyan
    exit 0
}

Write-Host ""
Write-Host "Paso 5: Conectando con GitHub" -ForegroundColor Green
Write-Host ""

# Añadir remote
$remoteUrl = "https://github.com/$githubUser/dockbrain.git"

git remote remove origin 2>$null
git remote add origin $remoteUrl
Write-Host "  OK Remote anadido: $remoteUrl" -ForegroundColor Green

# Renombrar branch a main
git branch -M main
Write-Host "  OK Branch renombrado a 'main'" -ForegroundColor Green

Write-Host ""
Write-Host "Paso 6: Subiendo a GitHub" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE: Si te pide usuario y password:" -ForegroundColor Yellow
Write-Host "  - Username: tu username de GitHub" -ForegroundColor White
Write-Host "  - Password: usa un token de acceso personal (no tu password real)" -ForegroundColor White
Write-Host "  - Para crear token: https://github.com/settings/tokens" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona Enter para continuar..." -ForegroundColor Yellow
Read-Host

# Push
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  OK Codigo subido exitosamente!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERROR al hacer push. Posibles causas:" -ForegroundColor Red
    Write-Host "  1. El repositorio no existe en GitHub" -ForegroundColor Yellow
    Write-Host "  2. No tienes permisos (necesitas token de acceso)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Solucion:" -ForegroundColor Yellow
    Write-Host "  1. Ve a: https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host "  2. Generate new token (classic)" -ForegroundColor Cyan
    Write-Host "  3. Marca: repo (todos los permisos)" -ForegroundColor Cyan
    Write-Host "  4. Genera y copia el token" -ForegroundColor Cyan
    Write-Host "  5. Cuando hagas push, usa el token como password" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Luego ejecuta:" -ForegroundColor Yellow
    Write-Host "  git push -u origin main" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "Paso 7: Crear Release v0.1.0" -ForegroundColor Green
Write-Host ""

# Crear tag
git tag -a v0.1.0 -m "Initial release: DockBrain MVP with Ollama support"
git push origin v0.1.0
Write-Host "  OK Tag v0.1.0 creado y subido" -ForegroundColor Green

Write-Host ""
Write-Host "================================" -ForegroundColor Blue
Write-Host "  SETUP COMPLETO!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Tu repositorio:" -ForegroundColor Yellow
Write-Host "  https://github.com/$githubUser/dockbrain" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Crear el primer Release:" -ForegroundColor White
Write-Host "   https://github.com/$githubUser/dockbrain/releases/new" -ForegroundColor Cyan
Write-Host "   - Tag: v0.1.0" -ForegroundColor Gray
Write-Host "   - Title: DockBrain v0.1.0 - Initial Release" -ForegroundColor Gray
Write-Host "   - Ver GITHUB_SETUP.md para la descripcion" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Configurar Topics (etiquetas):" -ForegroundColor White
Write-Host "   https://github.com/$githubUser/dockbrain/settings" -ForegroundColor Cyan
Write-Host "   Anadir: telegram, ai, ollama, automation, typescript, security" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Probar instalacion en tu VPS:" -ForegroundColor White
Write-Host "   curl -fsSL https://raw.githubusercontent.com/$githubUser/dockbrain/main/install.sh | sudo bash" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Compartir tu proyecto:" -ForegroundColor White
Write-Host "   - Reddit: r/selfhosted, r/opensource" -ForegroundColor Gray
Write-Host "   - Twitter/X con #opensource #ai #ollama" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentacion:" -ForegroundColor Yellow
Write-Host "  README.md - Documentacion completa" -ForegroundColor Gray
Write-Host "  GITHUB_SETUP.md - Configuracion avanzada de GitHub" -ForegroundColor Gray
Write-Host "  SETUP_LINUX.md - Instalacion en Linux/VPS" -ForegroundColor Gray
Write-Host ""
Write-Host "Gracias por usar DockBrain!" -ForegroundColor Green
Write-Host ""
