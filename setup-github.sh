#!/bin/bash
# Script de Setup para GitHub - DockBrain
# Ejecutar: chmod +x setup-github.sh && ./setup-github.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  DockBrain - GitHub Setup${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}ERROR: Ejecuta este script desde el directorio de DockBrain${NC}"
    exit 1
fi

# Pedir username de GitHub
echo -e "${GREEN}Paso 1: Configuración inicial${NC}"
echo ""
read -p "Ingresa tu username de GitHub: " github_user

if [ -z "$github_user" ]; then
    echo -e "${RED}ERROR: El username no puede estar vacío${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Actualizando URLs en los archivos...${NC}"

# Actualizar URLs en archivos
files=("README.md" "SETUP_LINUX.md" "package.json" "GITHUB_SETUP.md" "QUICK_REFERENCE.md")

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        sed -i "s/TU_USUARIO/$github_user/g" "$file" 2>/dev/null || \
        sed -i '' "s/TU_USUARIO/$github_user/g" "$file" 2>/dev/null
        echo -e "  ${GREEN}✓${NC} $file actualizado"
    fi
done

echo ""
echo -e "${GREEN}Paso 2: Inicializando Git${NC}"
echo ""

# Verificar si Git está instalado
if ! command -v git &> /dev/null; then
    echo -e "${RED}ERROR: Git no está instalado${NC}"
    exit 1
fi

# Inicializar Git si no está inicializado
if [ ! -d ".git" ]; then
    git init
    echo -e "  ${GREEN}✓${NC} Git inicializado"
else
    echo -e "  ${GREEN}✓${NC} Git ya está inicializado"
fi

echo ""
echo -e "${GREEN}Paso 3: Haciendo commit inicial${NC}"
echo ""

# Add all files
git add .
echo -e "  ${GREEN}✓${NC} Archivos añadidos"

# Commit
git commit -m "feat: initial release - DockBrain MVP with Linux and Ollama support"
echo -e "  ${GREEN}✓${NC} Commit creado"

echo ""
echo -e "${GREEN}Paso 4: Crear repositorio en GitHub${NC}"
echo ""
echo -e "${YELLOW}Abre tu navegador y ve a:${NC}"
echo -e "${CYAN}https://github.com/new${NC}"
echo ""
echo -e "${YELLOW}Configura el repositorio:${NC}"
echo -e "  - Repository name: ${GRAY}dockbrain${NC}"
echo -e "  - Description: ${GRAY}🤖 Local-first task automation assistant for Telegram. Secure by default with Ollama support.${NC}"
echo -e "  - Public: ${GRAY}✓ (recomendado)${NC}"
echo -e "  - NO marques: ${GRAY}Add a README, .gitignore, o license${NC}"
echo ""

read -p "¿Has creado el repositorio en GitHub? (s/n) " confirm

if [ "$confirm" != "s" ] && [ "$confirm" != "S" ]; then
    echo ""
    echo -e "${YELLOW}Cuando hayas creado el repositorio, ejecuta:${NC}"
    echo -e "  ${CYAN}git remote add origin https://github.com/$github_user/dockbrain.git${NC}"
    echo -e "  ${CYAN}git branch -M main${NC}"
    echo -e "  ${CYAN}git push -u origin main${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Paso 5: Conectando con GitHub${NC}"
echo ""

# Añadir remote
remote_url="https://github.com/$github_user/dockbrain.git"

git remote remove origin 2>/dev/null || true
git remote add origin "$remote_url"
echo -e "  ${GREEN}✓${NC} Remote añadido: $remote_url"

# Renombrar branch a main
git branch -M main
echo -e "  ${GREEN}✓${NC} Branch renombrado a 'main'"

echo ""
echo -e "${GREEN}Paso 6: Subiendo a GitHub${NC}"
echo ""
echo -e "${YELLOW}Presiona Enter para continuar o Ctrl+C para cancelar...${NC}"
read

# Push
if git push -u origin main; then
    echo ""
    echo -e "  ${GREEN}✓${NC} Código subido exitosamente!"
else
    echo ""
    echo -e "${RED}ERROR al hacer push. Posibles causas:${NC}"
    echo -e "  ${YELLOW}1. El repositorio no existe en GitHub${NC}"
    echo -e "  ${YELLOW}2. No tienes permisos (necesitas autenticación)${NC}"
    echo ""
    echo -e "${YELLOW}Solución:${NC}"
    echo -e "  ${CYAN}1. Ve a: https://github.com/settings/tokens${NC}"
    echo -e "  ${CYAN}2. Generate new token (classic)${NC}"
    echo -e "  ${CYAN}3. Marca: repo (todos los permisos)${NC}"
    echo -e "  ${CYAN}4. Genera y copia el token${NC}"
    echo -e "  ${CYAN}5. Cuando hagas push, usa el token como password${NC}"
    echo ""
    echo -e "${YELLOW}Luego ejecuta:${NC}"
    echo -e "  ${CYAN}git push -u origin main${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Paso 7: Crear Release v0.1.0${NC}"
echo ""

# Crear tag
git tag -a v0.1.0 -m "Initial release: DockBrain MVP with Ollama support"
git push origin v0.1.0
echo -e "  ${GREEN}✓${NC} Tag v0.1.0 creado y subido"

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}  ¡SETUP COMPLETO! 🎉${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "${YELLOW}Tu repositorio:${NC}"
echo -e "  ${CYAN}https://github.com/$github_user/dockbrain${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo ""
echo -e "${NC}1. Crear el primer Release:${NC}"
echo -e "   ${CYAN}https://github.com/$github_user/dockbrain/releases/new${NC}"
echo -e "   ${GRAY}- Tag: v0.1.0${NC}"
echo -e "   ${GRAY}- Title: DockBrain v0.1.0 - Initial Release 🎉${NC}"
echo -e "   ${GRAY}- Ver GITHUB_SETUP.md para la descripción${NC}"
echo ""
echo -e "${NC}2. Configurar Topics (etiquetas):${NC}"
echo -e "   ${CYAN}https://github.com/$github_user/dockbrain/settings${NC}"
echo -e "   ${GRAY}Añadir: telegram, ai, ollama, automation, typescript, security${NC}"
echo ""
echo -e "${NC}3. Probar instalación en tu VPS:${NC}"
echo -e "   ${CYAN}curl -fsSL https://raw.githubusercontent.com/$github_user/dockbrain/main/install.sh | sudo bash${NC}"
echo ""
echo -e "${NC}4. Compartir tu proyecto:${NC}"
echo -e "   ${GRAY}- Reddit: r/selfhosted, r/opensource${NC}"
echo -e "   ${GRAY}- Twitter/X con #opensource #ai #ollama${NC}"
echo ""
echo -e "${YELLOW}Documentación:${NC}"
echo -e "  ${GRAY}README.md - Documentación completa${NC}"
echo -e "  ${GRAY}GITHUB_SETUP.md - Configuración avanzada de GitHub${NC}"
echo -e "  ${GRAY}SETUP_LINUX.md - Instalación en Linux/VPS${NC}"
echo ""
echo -e "${GREEN}¡Gracias por usar DockBrain! 🚀${NC}"
echo ""
