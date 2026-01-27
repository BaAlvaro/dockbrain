# Setup para GitHub

## Preparar el Repositorio

### 1. Inicializar Git (si no lo has hecho)

```bash
cd C:\Users\deatw\Desktop\Dockbrain
git init
git add .
git commit -m "Initial commit: DockBrain MVP with Ollama support"
```

### 2. Crear Repositorio en GitHub

1. Ve a https://github.com/new
2. Nombre: `dockbrain`
3. Descripción: `Local-first task automation assistant with security by default. Supports Ollama, OpenAI, and more.`
4. **Público** o **Privado** (tú eliges)
5. **NO** marcar "Add a README" (ya tenemos uno)
6. **NO** marcar "Add .gitignore" (ya tenemos uno)
7. **NO** marcar "Choose a license" (ya tenemos MIT)
8. Click "Create repository"

### 3. Conectar y Subir

```bash
# Añadir remote (reemplaza BaAlvaro con tu username de GitHub)
git remote add origin https://github.com/BaAlvaro/dockbrain.git

# Verificar remote
git remote -v

# Subir a GitHub
git branch -M main
git push -u origin main
```

### 4. Configurar GitHub (Opcional pero Recomendado)

#### a) Añadir Topics

En GitHub → Settings → Topics, añade:
- `telegram`
- `ai`
- `ollama`
- `automation`
- `typescript`
- `security`
- `local-first`
- `llm`

#### b) Habilitar Issues y Discussions

En Settings:
- ✅ Issues
- ✅ Discussions

#### c) Añadir About

En la página principal del repo, edita "About":
```
🤖 Local-first task automation assistant for Telegram. Secure by default with Ollama (local LLMs) support. Run AI privately on your VPS!
```

Website: (tu dominio o déjalo vacío)

#### d) Crear Release v0.1.0

```bash
# Crear tag
git tag -a v0.1.0 -m "Initial release: MVP with Ollama support"

# Subir tag
git push origin v0.1.0
```

En GitHub → Releases → "Create a new release":
- Tag: `v0.1.0`
- Title: `DockBrain v0.1.0 - Initial Release`
- Description:
  ```markdown
  ## 🎉 First Release!

  DockBrain is a local-first task automation assistant for Telegram with security by default.

  ### ✨ Features

  - 🔒 Secure by default (granular permissions, audit logging)
  - 🦙 Ollama support (run AI locally and free!)
  - 🤖 OpenAI support
  - 📱 Telegram integration
  - 🐧 Linux support (Ubuntu, Debian, CentOS, Arch)
  - 🪟 Windows support
  - 🐳 Docker support
  - 🔄 Plan → Execute → Verify cycle

  ### 🚀 Quick Start

  #### Linux (VPS):
  ```bash
  curl -fsSL https://raw.githubusercontent.com/BaAlvaro/dockbrain/main/install.sh | sudo bash
  ```

  #### Docker:
  ```bash
  docker-compose up -d
  ```

  See [README.md](https://github.com/BaAlvaro/dockbrain#readme) for full documentation.

  ### 📚 Documentation

  - [README.md](README.md) - Complete documentation
  - [SETUP_WINDOWS.md](SETUP_WINDOWS.md) - Windows setup
  - [SETUP_LINUX.md](SETUP_LINUX.md) - Linux/VPS setup
  - [SECURITY.md](SECURITY.md) - Security model

  ### 🛠️ Tools Included (MVP)

  - `files_readonly` - Read files in safe directory
  - `reminders` - Create/list/delete reminders
  - `web_sandbox` - Fetch content from allowed URLs
  - `system_info` - Get system information

  ### 🙏 Thanks

  Built with Claude AI using the Claude Code CLI.
  ```

#### e) Añadir README Badge

Edita README.md y añade al principio:

```markdown
# DockBrain

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-20%2B-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)
```

### 5. Actualizar URLs en Archivos

Reemplaza `BaAlvaro` en estos archivos:

```bash
# En Windows PowerShell:
$files = @(
    "README.md",
    "SETUP_LINUX.md",
    "package.json",
    "GITHUB_SETUP.md"
)

foreach ($file in $files) {
    (Get-Content $file) -replace 'BaAlvaro', 'tu-username-real' | Set-Content $file
}

git add .
git commit -m "Update GitHub username in URLs"
git push
```

### 6. Probar Instalación desde GitHub

#### En una VPS limpia:

```bash
curl -fsSL https://raw.githubusercontent.com/BaAlvaro/dockbrain/main/install.sh | sudo bash
```

#### Con Docker:

```bash
git clone https://github.com/BaAlvaro/dockbrain.git
cd dockbrain
cp .env.example .env
nano .env
docker-compose up -d
```

### 7. Añadir Colaboradores (Opcional)

Settings → Collaborators → Add people

### 8. Configurar Protección de Branch (Opcional)

Settings → Branches → Add rule:
- Branch name pattern: `main`
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging

### 9. Configurar Secrets para GitHub Actions

Settings → Secrets and variables → Actions → New repository secret:

(Si usas Docker Hub en vez de GitHub Container Registry)
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

## Promoción del Proyecto

### Reddit
- r/selfhosted
- r/opensource
- r/programming
- r/telegramBots

### Hacker News
https://news.ycombinator.com/submit

### Product Hunt
https://www.producthunt.com/

### Twitter/X
```
🚀 Just released DockBrain - a local-first task automation assistant for Telegram!

✨ Features:
- 🦙 Free local AI with Ollama
- 🔒 Security by default
- 🐳 Docker ready
- 🐧 Linux + 🪟 Windows support

Check it out: https://github.com/BaAlvaro/dockbrain

#opensource #ai #telegram #ollama
```

## Mantenimiento

### Actualizar Dependencias

```bash
npm update
npm audit fix
git add package*.json
git commit -m "chore: update dependencies"
git push
```

### Crear Nueva Release

```bash
# Actualizar version en package.json
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.1 → 0.2.0
npm version major  # 0.2.0 → 1.0.0

# Esto crea el tag automáticamente
git push
git push --tags
```

Luego crea el release en GitHub web interface.

## Recibir Contribuciones

1. Revisa Pull Requests en la pestaña "Pull requests"
2. Comenta, sugiere cambios, aprueba
3. Mergea cuando esté listo
4. Agradece al contribuidor!

---

**¡Tu proyecto está listo para GitHub! 🎉**
