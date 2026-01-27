#!/bin/bash
# Quick VPS deployment script for DockBrain

set -e

echo "================================"
echo "DockBrain VPS Quick Deployment"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo ./deploy-vps.sh${NC}"
    exit 1
fi

# Ask for deployment method
echo -e "${BLUE}Choose deployment method:${NC}"
echo "1) Docker (recommended for VPS)"
echo "2) Native (systemd service)"
echo ""
read -p "Enter choice (1 or 2): " deploy_method

if [ "$deploy_method" = "1" ]; then
    echo ""
    echo -e "${BLUE}Installing Docker...${NC}"

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
    fi

    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi

    echo -e "${GREEN}Docker installed.${NC}"
    echo ""

    # Configure .env
    if [ ! -f .env ]; then
        echo -e "${BLUE}Creating .env file...${NC}"
        cp .env.example .env

        # Generate admin token
        ADMIN_TOKEN=$(openssl rand -hex 32)
        sed -i "s/your_admin_api_token_here/$ADMIN_TOKEN/" .env

        # Set Ollama as default
        sed -i 's/LLM_PROVIDER=openai/LLM_PROVIDER=ollama/' .env

        # Set API to bind to all interfaces for Docker
        echo "" >> .env
        echo "# Docker networking" >> .env
        echo "API_HOST=0.0.0.0" >> .env

        echo -e "${GREEN}.env created.${NC}"
        echo ""
        echo -e "${YELLOW}Edit .env and add your Telegram bot token!${NC}"
        echo -e "${BLUE}Admin token: ${GREEN}$ADMIN_TOKEN${NC}"
        echo ""
        read -p "Press Enter after editing .env..."
    fi

    # Start with Docker Compose
    echo ""
    echo -e "${BLUE}Starting DockBrain with Docker...${NC}"
    docker-compose up -d

    echo ""
    echo -e "${GREEN}DockBrain deployed!${NC}"
    echo ""
    echo "View logs: docker-compose logs -f"
    echo "Stop: docker-compose down"
    echo ""

elif [ "$deploy_method" = "2" ]; then
    # Native installation
    echo ""
    echo -e "${BLUE}Running native installation...${NC}"
    ./install.sh

    echo ""
    echo -e "${GREEN}DockBrain installed as systemd service!${NC}"
    echo ""
    echo "Start: sudo systemctl start dockbrain"
    echo "Status: sudo systemctl status dockbrain"
    echo "Logs: sudo journalctl -u dockbrain -f"
    echo ""
else
    echo -e "${RED}Invalid choice.${NC}"
    exit 1
fi

# Configure firewall
echo ""
read -p "Configure firewall (UFW)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp
        ufw --force enable
        echo -e "${GREEN}Firewall configured (SSH allowed).${NC}"
    else
        echo -e "${YELLOW}UFW not found. Install with: apt-get install ufw${NC}"
    fi
fi

# Pull Ollama model
echo ""
if command -v ollama &> /dev/null || [ "$deploy_method" = "1" ]; then
    read -p "Download Llama 3.2 model (~2GB)? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ "$deploy_method" = "1" ]; then
            docker-compose exec ollama ollama pull llama3.2
        else
            ollama pull llama3.2
        fi
        echo -e "${GREEN}Model downloaded.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. Get pairing token:"
if [ "$deploy_method" = "1" ]; then
    echo "   docker-compose exec dockbrain node -e \\"
    echo "     \"fetch('http://localhost:3000/api/v1/pairing/tokens', {method:'POST',headers:{'Authorization':'Bearer $ADMIN_TOKEN','Content-Type':'application/json'},body:'{\\\"ttl_minutes\\\":60}'}).then(r=>r.json()).then(console.log)\""
else
    echo "   curl -X POST http://localhost:3000/api/v1/pairing/tokens \\"
    echo "     -H 'Authorization: Bearer $ADMIN_TOKEN' \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"ttl_minutes\": 60}'"
fi
echo ""
echo "2. In Telegram: /pair <token>"
echo ""
echo -e "${YELLOW}Admin API token (save this!): ${GREEN}$ADMIN_TOKEN${NC}"
echo ""
