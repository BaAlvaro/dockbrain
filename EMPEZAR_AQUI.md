# 🚀 EMPEZAR AQUÍ - Subir DockBrain a GitHub

## Opción 1: Automático (RECOMENDADO)

### En Windows (PowerShell):

```powershell
cd C:\Users\deatw\Desktop\Dockbrain
.\setup-github.ps1
```

### En Linux/Mac:

```bash
cd ~/dockbrain  # o donde esté tu proyecto
chmod +x setup-github.sh
./setup-github.sh
```

**El script hará TODO automáticamente:**
- ✅ Actualizar URLs con tu username
- ✅ Inicializar Git
- ✅ Hacer commit
- ✅ Conectar con GitHub
- ✅ Subir el código
- ✅ Crear tag v0.1.0

---

## Opción 2: Manual

### Paso 1: Crear repo en GitHub

1. Ve a: https://github.com/new
2. **Nombre:** `dockbrain`
3. **Público** ✓
4. **NO** marques: README, .gitignore, License
5. Click "Create repository"

### Paso 2: Subir código

```bash
cd C:\Users\deatw\Desktop\Dockbrain

# Inicializar Git
git init
git add .
git commit -m "feat: initial release with Ollama support"

# Conectar con GitHub (reemplaza TU_USUARIO)
git remote add origin https://github.com/TU_USUARIO/dockbrain.git
git branch -M main
git push -u origin main

# Crear tag
git tag -a v0.1.0 -m "Initial release"
git push origin v0.1.0
```

### Paso 3: Actualizar URLs

Busca y reemplaza `TU_USUARIO` con tu username real en:
- README.md
- SETUP_LINUX.md
- package.json
- GITHUB_SETUP.md
- QUICK_REFERENCE.md

Luego:
```bash
git add .
git commit -m "docs: update GitHub URLs"
git push
```

---

## 📋 Después de Subir

### 1. Crear el Release v0.1.0

Ve a: `https://github.com/TU_USUARIO/dockbrain/releases/new`

- **Tag:** v0.1.0
- **Title:** DockBrain v0.1.0 - Initial Release 🎉
- **Description:** Copia de [GITHUB_SETUP.md](GITHUB_SETUP.md)

### 2. Configurar Topics

Ve a: `https://github.com/TU_USUARIO/dockbrain`

Click en ⚙️ junto al About → Topics:
```
telegram, ai, ollama, automation, typescript, security, local-first, llm
```

### 3. Probar en tu VPS

```bash
# SSH a tu VPS
ssh usuario@tu-vps.com

# Instalación automática
curl -fsSL https://raw.githubusercontent.com/TU_USUARIO/dockbrain/main/install.sh | sudo bash

# O con Docker
git clone https://github.com/TU_USUARIO/dockbrain.git
cd dockbrain
cp .env.example .env
nano .env  # Configurar TELEGRAM_BOT_TOKEN
docker-compose up -d
```

---

## 🆘 Problemas Comunes

### "Git no es reconocido como comando"

Instala Git: https://git-scm.com/download/win

### "Permission denied (publickey)"

Necesitas configurar autenticación. Dos opciones:

**A) Token de acceso personal:**
1. Ve a: https://github.com/settings/tokens
2. Generate new token (classic)
3. Marca: `repo` (todos los permisos)
4. Genera y **GUARDA EL TOKEN**
5. Cuando hagas `git push`, usa el token como password

**B) SSH (más permanente):**
```bash
# Generar clave SSH
ssh-keygen -t ed25519 -C "tu@email.com"

# Copiar clave pública
cat ~/.ssh/id_ed25519.pub

# Añadirla en: https://github.com/settings/keys
```

### "Repository not found"

Asegúrate de haber creado el repo en GitHub primero.

---

## 📚 Siguiente Paso

Una vez subido, lee:
- [SETUP_LINUX.md](SETUP_LINUX.md) - Para VPS
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Comandos útiles
- [GITHUB_SETUP.md](GITHUB_SETUP.md) - Config avanzada

---

## ✨ ¡Listo!

Tu comando de instalación será:

```bash
curl -fsSL https://raw.githubusercontent.com/TU_USUARIO/dockbrain/main/install.sh | sudo bash
```

**¡DockBrain en producción! 🎉**
