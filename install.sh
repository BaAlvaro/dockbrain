#!/bin/bash
set -e

# DockBrain Installation Script for Linux
# Supports Ubuntu/Debian, CentOS/RHEL, and Arch Linux

echo "================================"
echo "DockBrain Installation Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS. Please install manually.${NC}"
    exit 1
fi

echo -e "${BLUE}Detected OS: $OS $OS_VERSION${NC}"
echo ""

# Check if running as root (needed for system-wide installation)
if [ "$EUID" -eq 0 ]; then
    INSTALL_DIR="/opt/dockbrain"
    SYSTEMD_SERVICE=true
    echo -e "${YELLOW}Running as root. Will install to $INSTALL_DIR and create systemd service.${NC}"
else
    INSTALL_DIR="$HOME/dockbrain"
    SYSTEMD_SERVICE=false
    echo -e "${YELLOW}Running as user. Will install to $INSTALL_DIR. No systemd service.${NC}"
fi
echo ""

# Function to install Node.js
install_nodejs() {
    echo -e "${BLUE}Installing Node.js 20.x LTS...${NC}"

    case $OS in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
            ;;
        centos|rhel|rocky|almalinux)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
            yum install -y nodejs
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm nodejs npm
            ;;
        *)
            echo -e "${RED}Unsupported OS for automatic Node.js installation.${NC}"
            echo "Please install Node.js 20.x manually from https://nodejs.org/"
            exit 1
            ;;
    esac
}

# Function to install Ollama
install_ollama() {
    echo -e "${BLUE}Installing Ollama...${NC}"
    curl -fsSL https://ollama.com/install.sh | sh

    # Start Ollama service if systemd is available
    if command -v systemctl &> /dev/null; then
        systemctl enable ollama
        systemctl start ollama
        echo -e "${GREEN}Ollama service started and enabled.${NC}"
    fi
}

# Function to install Codex CLI
install_codex_cli() {
    echo -e "${BLUE}Installing Codex CLI...${NC}"
    npm i -g @openai/codex
}

# Update or append env var in .env
set_env_var() {
    local key="$1"
    local value="$2"
    local file=".env"
    if grep -q "^${key}=" "$file"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# Enable Codex auth tool in default config
enable_codex_auth_config() {
    if [ -f "$INSTALL_DIR/config/default.yaml" ]; then
        perl -0777 -i -pe 's/(codex_auth:\n\s*enabled:\s*)false/\1true/' "$INSTALL_DIR/config/default.yaml" || true
    fi
}

# Prompt for LLM provider and optional Codex login
prompt_llm_provider() {
    echo ""
    echo -e "${BLUE}Select LLM provider:${NC}"
    echo "  1) OpenAI API"
    echo "  2) Ollama (local)"
    echo "  3) Mock (no LLM)"
    echo "  4) Codex login (ChatGPT account for Codex CLI)"
    echo "  5) Google Gemini API"
    echo "  6) OpenRouter (free models)"
    read -p "Choose [1-6] (default: 1): " -n 1 -r
    echo ""
    CHOICE=${REPLY:-1}

    case $CHOICE in
        2)
            set_env_var "LLM_PROVIDER" "ollama"
            ;;
        3)
            set_env_var "LLM_PROVIDER" "mock"
            ;;
        4)
            set_env_var "LLM_PROVIDER" "openai"
            enable_codex_auth_config
            echo -e "${YELLOW}Codex login will authenticate the Codex CLI. DockBrain still needs an OpenAI API key unless you use Ollama.${NC}"
            if ! command -v codex &> /dev/null; then
                read -p "Install Codex CLI now? (y/n) " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    install_codex_cli
                fi
            fi
            if command -v codex &> /dev/null; then
                echo -e "${BLUE}Starting Codex login (device auth). Follow the link and enter the code.${NC}"
                codex login --device-auth || true
            else
                echo -e "${YELLOW}Codex CLI not installed. You can install later with: npm i -g @openai/codex${NC}"
            fi
            ;;
        5)
            set_env_var "LLM_PROVIDER" "gemini"
            read -p "Enter GEMINI_API_KEY: " GEMINI_KEY
            echo ""
            if [ -n "$GEMINI_KEY" ]; then
                set_env_var "GEMINI_API_KEY" "$GEMINI_KEY"
            else
                echo -e "${YELLOW}GEMINI_API_KEY not set. You can add it later in .env.${NC}"
            fi
            read -p "Enter GEMINI_MODEL (default: gemini-2.5-flash): " GEMINI_MODEL
            echo ""
            if [ -n "$GEMINI_MODEL" ]; then
                set_env_var "GEMINI_MODEL" "$GEMINI_MODEL"
            else
                set_env_var "GEMINI_MODEL" "gemini-2.5-flash"
            fi
            ;;
        6)
            set_env_var "LLM_PROVIDER" "openrouter"
            read -p "Enter OPENROUTER_API_KEY: " OPENROUTER_KEY
            echo ""
            if [ -n "$OPENROUTER_KEY" ]; then
                set_env_var "OPENROUTER_API_KEY" "$OPENROUTER_KEY"
            else
                echo -e "${YELLOW}OPENROUTER_API_KEY not set. You can add it later in .env.${NC}"
            fi

            echo -e "${BLUE}Fetching models from OpenRouter...${NC}"
            OPENROUTER_MODELS_RAW=$(OPENROUTER_API_KEY="$OPENROUTER_KEY" python3 - <<'PY'
import json, os, sys, urllib.request
key = os.environ.get("OPENROUTER_API_KEY")
if not key:
    sys.exit(0)
req = urllib.request.Request(
    "https://openrouter.ai/api/v1/models",
    headers={"Authorization": f"Bearer {key}"}
)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.load(resp)
except Exception:
    sys.exit(0)
items = data.get("data", data)
if not isinstance(items, list):
    sys.exit(0)
for item in items:
    model_id = item.get("id") or item.get("model")
    if model_id:
        print(model_id)
PY
)
            FREE_MODELS=$(printf "%s\n" "$OPENROUTER_MODELS_RAW" | grep ":free" || true)
            LIST_MODELS="${FREE_MODELS:-$OPENROUTER_MODELS_RAW}"

            if [ -n "$LIST_MODELS" ]; then
                if [ -n "$FREE_MODELS" ]; then
                    echo -e "${GREEN}Free models:${NC}"
                else
                    echo -e "${YELLOW}No free models detected. Showing all available models:${NC}"
                fi
                IFS=$'\n' read -r -d '' -a MODEL_LIST <<< "$LIST_MODELS"$'\0'
                for i in "${!MODEL_LIST[@]}"; do
                    printf "  %d) %s\n" $((i+1)) "${MODEL_LIST[$i]}"
                done
                read -p "Choose models (e.g. 1,3) or press Enter to skip: " MODEL_SELECTION
                echo ""
                if [ -n "$MODEL_SELECTION" ]; then
                    IFS=',' read -ra IDX <<< "$MODEL_SELECTION"
                    SELECTED=()
                    for raw in "${IDX[@]}"; do
                        idx=$(echo "$raw" | tr -d ' ')
                        if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -gt 0 ] && [ "$idx" -le "${#MODEL_LIST[@]}" ]; then
                            SELECTED+=("${MODEL_LIST[$((idx-1))]}")
                        fi
                    done
                    if [ "${#SELECTED[@]}" -gt 0 ]; then
                        set_env_var "OPENROUTER_MODELS" "$(IFS=,; echo "${SELECTED[*]}")"
                        set_env_var "OPENROUTER_MODEL" "${SELECTED[0]}"
                    fi
                fi
            fi

            if ! grep -q "^OPENROUTER_MODEL=" .env; then
                read -p "Enter OpenRouter model (example: google/gemini-2.5-flash-preview:free): " OR_MODEL
                echo ""
                if [ -n "$OR_MODEL" ]; then
                    set_env_var "OPENROUTER_MODEL" "$OR_MODEL"
                else
                    set_env_var "OPENROUTER_MODEL" "google/gemini-2.5-flash-preview:free"
                fi
            fi

            read -p "Set OPENROUTER_REFERER (optional, recommended): " OR_REFERER
            echo ""
            if [ -n "$OR_REFERER" ]; then
                set_env_var "OPENROUTER_REFERER" "$OR_REFERER"
            fi
            set_env_var "OPENROUTER_TITLE" "DockBrain"
            ;;
        *)
            set_env_var "LLM_PROVIDER" "openai"
            ;;
    esac
}

# Function to install build tools
install_build_tools() {
    echo -e "${BLUE}Installing build tools...${NC}"

    case $OS in
        ubuntu|debian)
            apt-get update
            apt-get install -y build-essential python3 git curl
            ;;
        centos|rhel|rocky|almalinux)
            yum groupinstall -y "Development Tools"
            yum install -y python3 git curl
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm base-devel python git curl
            ;;
    esac
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found.${NC}"
    read -p "Install Node.js 20.x LTS? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ "$EUID" -ne 0 ]; then
            echo -e "${RED}Need root privileges to install Node.js. Please run with sudo.${NC}"
            exit 1
        fi
        install_build_tools
        install_nodejs
    else
        echo -e "${RED}Node.js is required. Exiting.${NC}"
        exit 1
    fi
else
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        echo -e "${YELLOW}Node.js version is $NODE_VERSION, but 20.x-21.x is required.${NC}"
        read -p "Upgrade to Node.js 20.x LTS? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [ "$EUID" -ne 0 ]; then
                echo -e "${RED}Need root privileges to install Node.js. Please run with sudo.${NC}"
                exit 1
            fi
            install_build_tools
            install_nodejs
        else
            echo -e "${RED}Node.js 20.x-21.x is required. Exiting.${NC}"
            exit 1
        fi
    elif [ "$NODE_VERSION" -ge 22 ]; then
        echo -e "${YELLOW}Node.js version is $(node -v), but better-sqlite3 requires 20.x-21.x${NC}"
        echo -e "${YELLOW}Node.js 22+ doesn't have prebuilt binaries yet.${NC}"
        read -p "Downgrade to Node.js 20.x LTS? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [ "$EUID" -ne 0 ]; then
                echo -e "${RED}Need root privileges to install Node.js. Please run with sudo.${NC}"
                exit 1
            fi
            install_build_tools
            install_nodejs
        else
            echo -e "${RED}Node.js 20.x-21.x is required. Exiting.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}Node.js $(node -v) found.${NC}"
    fi
fi

# Resolve Node.js binary path (used for systemd ExecStart)
NODE_BIN=$(command -v node || true)

# Always ensure build tools are installed (needed for native module compilation)
if [ "$EUID" -eq 0 ]; then
    echo ""
    echo -e "${BLUE}Ensuring build tools are installed...${NC}"
    install_build_tools
fi

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo ""
    echo -e "${YELLOW}Ollama not found.${NC}"
    read -p "Install Ollama for local LLMs? (recommended) (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ "$EUID" -ne 0 ]; then
            echo -e "${RED}Need root privileges to install Ollama. Please run with sudo.${NC}"
            exit 1
        fi
        install_ollama

        # Pull default model
        echo ""
        read -p "Download Llama 3.2 model (~2GB)? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ollama pull llama3.2
            echo -e "${GREEN}Llama 3.2 downloaded successfully.${NC}"
        fi
    fi
else
    echo -e "${GREEN}Ollama $(ollama --version) found.${NC}"
fi

# Create installation directory
echo ""
echo -e "${BLUE}Creating installation directory: $INSTALL_DIR${NC}"
mkdir -p "$INSTALL_DIR"

# Copy files
if [ "$(pwd)" != "$INSTALL_DIR" ]; then
    echo -e "${BLUE}Copying DockBrain files...${NC}"
    cp -r ./* "$INSTALL_DIR/" 2>/dev/null || true
fi

cd "$INSTALL_DIR"

# Install dependencies
echo ""
echo -e "${BLUE}Installing Node.js dependencies...${NC}"
npm install

# Build TypeScript
echo ""
echo -e "${BLUE}Building TypeScript...${NC}"
npm run build

# Create data directories
echo ""
echo -e "${BLUE}Creating data directories...${NC}"
mkdir -p data/logs
mkdir -p data/safe_root

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo -e "${BLUE}Creating .env file...${NC}"
    cp .env.example .env

    # Generate admin token
    ADMIN_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

    # Update .env with generated token
    sed -i "s/your_admin_api_token_here/$ADMIN_TOKEN/" .env

    prompt_llm_provider

    echo -e "${GREEN}.env file created with admin token.${NC}"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Edit $INSTALL_DIR/.env and add your Telegram bot token:${NC}"
    echo -e "${YELLOW}Get it from @BotFather on Telegram${NC}"
    echo ""
    echo -e "${BLUE}Your admin API token: ${GREEN}$ADMIN_TOKEN${NC}"
    echo -e "${YELLOW}Save this token! You'll need it to manage DockBrain via HTTP API.${NC}"
    echo ""
else
    echo -e "${GREEN}.env file already exists.${NC}"
    read -p "Reconfigure LLM provider? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        prompt_llm_provider
    else
        echo -e "${YELLOW}Skipping LLM provider configuration.${NC}"
    fi
fi

# Create systemd service if running as root
if [ "$SYSTEMD_SERVICE" = true ]; then
    echo ""
    echo -e "${BLUE}Creating systemd service...${NC}"

    # Determine which user to run as
    if [ -n "$SUDO_USER" ]; then
        SERVICE_USER="$SUDO_USER"
    else
        SERVICE_USER="root"
    fi

    if [ -z "$NODE_BIN" ]; then
        echo -e "${RED}Cannot locate Node.js binary. Aborting systemd setup.${NC}"
        exit 1
    fi

    cat > /etc/systemd/system/dockbrain.service <<EOF
[Unit]
Description=DockBrain - Local-first task automation assistant
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_BIN $INSTALL_DIR/dist/src/main.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dockbrain
EnvironmentFile=-$INSTALL_DIR/.env

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR/data

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload

    echo -e "${GREEN}Systemd service created.${NC}"
    systemctl enable dockbrain
    systemctl restart dockbrain || true
    echo ""
    echo -e "${BLUE}Service commands:${NC}"
    echo "  Start:   sudo systemctl start dockbrain"
    echo "  Stop:    sudo systemctl stop dockbrain"
    echo "  Status:  sudo systemctl status dockbrain"
    echo "  Enable:  sudo systemctl enable dockbrain (start on boot)"
    echo "  Logs:    sudo journalctl -u dockbrain -f"
fi

# Set correct permissions
echo ""
echo -e "${BLUE}Setting permissions...${NC}"
if [ "$SYSTEMD_SERVICE" = true ] && [ -n "$SUDO_USER" ]; then
    chown -R "$SUDO_USER:$SUDO_USER" "$INSTALL_DIR"
fi
chmod 600 "$INSTALL_DIR/.env" 2>/dev/null || true
chmod 700 "$INSTALL_DIR/data" 2>/dev/null || true

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. Edit configuration:"
echo "   nano $INSTALL_DIR/.env"
echo ""
echo "2. Add your Telegram bot token (get from @BotFather)"
echo ""
echo "3. Start DockBrain:"
if [ "$SYSTEMD_SERVICE" = true ]; then
    echo "   sudo systemctl start dockbrain"
    echo "   sudo journalctl -u dockbrain -f  # View logs"
else
    echo "   cd $INSTALL_DIR"
    echo "   npm start"
fi
echo ""
echo "4. Create pairing token:"
echo "   curl -X POST http://localhost:3000/api/v1/pairing/tokens \\"
echo "     -H \"Authorization: Bearer $ADMIN_TOKEN\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"ttl_minutes\": 60}'"
echo ""
echo "5. In Telegram, send: /pair <token>"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  Setup: $INSTALL_DIR/SETUP_LINUX.md"
echo "  README: $INSTALL_DIR/README.md"
echo "  Security: $INSTALL_DIR/SECURITY.md"
echo ""
echo -e "${GREEN}Happy automating! 🚀${NC}"
