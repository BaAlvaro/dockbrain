# Guía de Instalación en Linux

DockBrain en Linux es super fácil de instalar con nuestro script automático. Compatible con Ubuntu, Debian, CentOS, RHEL, y Arch Linux.

---

## 🚀 Instalación Automática (Recomendado)

### Opción 1: Instalación del Sistema (con sudo)

Instala DockBrain en `/opt/dockbrain` como servicio systemd:

```bash
cd /tmp
git clone https://github.com/BaAlvaro/dockbrain.git
cd dockbrain
chmod +x install.sh
sudo ./install.sh
```

**Esto instalará:**
- Node.js 20.x LTS (si no está instalado)
- Ollama (opcional, para LLMs locales)
- DockBrain en `/opt/dockbrain`
- Servicio systemd para auto-inicio

### Opción 2: Instalación de Usuario (sin sudo)

Instala DockBrain en `~/dockbrain` sin servicio:

```bash
cd ~
git clone https://github.com/BaAlvaro/dockbrain.git
cd dockbrain
chmod +x install.sh
./install.sh
```

---

## 🐳 Instalación con Docker (VPS Recomendado)

La forma más fácil y segura para VPS:

### Requisitos previos

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Instalación

```bash
git clone https://github.com/BaAlvaro/dockbrain.git
cd dockbrain

# Copiar y editar configuración
cp .env.example .env
nano .env  # Añade tu token de Telegram y configura LLM

# Iniciar con Docker Compose
docker-compose up -d

# Ver logs
docker-compose logs -f
```

**Servicios incluidos:**
- DockBrain
- Ollama (opcional, comentar si no usas)

---

## 📋 Instalación Manual (Paso a Paso)

### 1. Instalar Node.js 20.x LTS

#### Ubuntu/Debian:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs build-essential
```

#### CentOS/RHEL/Rocky:
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs gcc-c++ make
```

#### Arch Linux:
```bash
sudo pacman -S nodejs npm base-devel
```

Verificar:
```bash
node -v  # Debería mostrar v20.x.x
npm -v
```

### 2. Instalar Ollama (Opcional pero Recomendado)

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Iniciar Ollama
sudo systemctl enable ollama
sudo systemctl start ollama

# Descargar modelo
ollama pull llama3.2
```

### 3. Clonar y Configurar DockBrain

```bash
git clone https://github.com/BaAlvaro/dockbrain.git
cd dockbrain

# Instalar dependencias
npm install

# Compilar TypeScript
npm run build

# Crear directorios de datos
mkdir -p data/logs data/safe_root

# Configurar variables de entorno
cp .env.example .env
nano .env
```

### 4. Configurar .env

```env
# Token de Telegram (obtener de @BotFather)
TELEGRAM_BOT_TOKEN=tu_token_aqui

# Token de admin (generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ADMIN_API_TOKEN=tu_token_admin_aqui

# Configuración de LLM
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# O usa OpenAI:
# LLM_PROVIDER=openai
# OPENAI_API_KEY=tu_api_key

# Rutas (dejar por defecto)
DATABASE_PATH=./data/dockbrain.db
LOGS_DIR=./data/logs
SAFE_ROOT_DIR=./data/safe_root

# API
API_HOST=0.0.0.0  # IMPORTANTE: 0.0.0.0 para VPS, 127.0.0.1 para local
API_PORT=3000
```

### 5. Iniciar DockBrain

#### Modo manual:
```bash
npm start
```

#### Como servicio systemd:

Crear archivo de servicio:
```bash
sudo nano /etc/systemd/system/dockbrain.service
```

Contenido:
```ini
[Unit]
Description=DockBrain - Local-first task automation assistant
After=network.target

[Service]
Type=simple
User=BaAlvaro
WorkingDirectory=/ruta/a/dockbrain
ExecStart=/usr/bin/node /ruta/a/dockbrain/dist/main.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/ruta/a/dockbrain/data

[Install]
WantedBy=multi-user.target
```

Activar servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dockbrain
sudo systemctl start dockbrain

# Ver estado
sudo systemctl status dockbrain

# Ver logs
sudo journalctl -u dockbrain -f
```

---

## 🔒 Configuración de Firewall (VPS)

### UFW (Ubuntu/Debian):
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # DockBrain API (opcional, solo si necesitas acceso remoto)
sudo ufw enable
```

### Firewalld (CentOS/RHEL):
```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

**IMPORTANTE:** Si la API está en `0.0.0.0:3000`, considera usar un reverse proxy (nginx) con HTTPS.

---

## 🔐 Reverse Proxy con Nginx (Recomendado para VPS)

### 1. Instalar Nginx

```bash
# Ubuntu/Debian
sudo apt-get install nginx certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install nginx certbot python3-certbot-nginx
```

### 2. Configurar sitio

```bash
sudo nano /etc/nginx/sites-available/dockbrain
```

Contenido:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
}
```

Activar:
```bash
sudo ln -s /etc/nginx/sites-available/dockbrain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Configurar HTTPS con Let's Encrypt

```bash
sudo certbot --nginx -d tu-dominio.com
```

Ahora la API está en: `https://tu-dominio.com/api/v1/...`

**Cambia en .env:**
```env
API_HOST=127.0.0.1  # Solo local, nginx hace proxy
```

---

## 🎯 Uso Diario

### Comandos del servicio

```bash
# Iniciar
sudo systemctl start dockbrain

# Detener
sudo systemctl stop dockbrain

# Reiniciar
sudo systemctl restart dockbrain

# Ver estado
sudo systemctl status dockbrain

# Ver logs en tiempo real
sudo journalctl -u dockbrain -f

# Ver últimos 100 logs
sudo journalctl -u dockbrain -n 100

# Logs desde fecha
sudo journalctl -u dockbrain --since "2024-01-27 10:00"
```

### Comandos Docker

```bash
# Iniciar
docker-compose up -d

# Detener
docker-compose down

# Ver logs
docker-compose logs -f

# Reiniciar solo DockBrain
docker-compose restart dockbrain

# Reconstruir imagen
docker-compose build
docker-compose up -d
```

---

## 🚀 Emparejar Cuenta

### 1. Crear token de emparejamiento

```bash
# Desde el servidor
curl -X POST http://localhost:3000/api/v1/pairing/tokens \
  -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ttl_minutes": 60}'
```

Respuesta:
```json
{
  "token": "AbCdEfGh12345678XyZ1234",
  "expires_at": 1706544000
}
```

### 2. Emparejar en Telegram

Abre Telegram y envía a tu bot:
```
/pair AbCdEfGh12345678XyZ1234
```

---

## 📊 Monitoreo

### Ver uso de recursos

```bash
# CPU y memoria de DockBrain
ps aux | grep dockbrain

# Con systemd
systemctl status dockbrain

# Con Docker
docker stats dockbrain
```

### Ver tamaño de base de datos

```bash
ls -lh data/dockbrain.db
```

### Backup de datos

```bash
# Detener servicio
sudo systemctl stop dockbrain

# Backup
tar -czf dockbrain-backup-$(date +%Y%m%d).tar.gz data/

# Reiniciar
sudo systemctl start dockbrain
```

---

## 🔧 Solución de Problemas

### DockBrain no inicia

```bash
# Ver logs completos
sudo journalctl -u dockbrain -n 200

# Verificar permisos
ls -la /opt/dockbrain/data/

# Verificar configuración
cat /opt/dockbrain/.env

# Probar manualmente
cd /opt/dockbrain
npm start
```

### Ollama no responde

```bash
# Estado del servicio
sudo systemctl status ollama

# Reiniciar Ollama
sudo systemctl restart ollama

# Verificar modelos
ollama list

# Probar modelo
ollama run llama3.2
```

### Error de permisos de base de datos

```bash
# Arreglar permisos
sudo chown -R BaAlvaro:BaAlvaro /opt/dockbrain/data
chmod 700 /opt/dockbrain/data
chmod 600 /opt/dockbrain/data/dockbrain.db
```

### Puerto 3000 ya en uso

```bash
# Ver qué usa el puerto
sudo lsof -i :3000

# Cambiar puerto en .env
nano /opt/dockbrain/.env
# Cambiar API_PORT=3001
```

### Bot de Telegram no responde

1. Verificar token: `cat .env | grep TELEGRAM`
2. Ver logs: `sudo journalctl -u dockbrain -f`
3. Verificar conectividad: `curl https://api.telegram.org/botTU_TOKEN/getMe`

---

## 🎨 Actualizar DockBrain

### Instalación manual:

```bash
cd /opt/dockbrain
git pull
npm install
npm run build
sudo systemctl restart dockbrain
```

### Docker:

```bash
cd /ruta/a/dockbrain
git pull
docker-compose build
docker-compose up -d
```

---

## 🌐 Acceso Remoto Seguro

Para gestionar DockBrain desde otro servidor:

### Opción 1: SSH Tunnel

```bash
# Desde tu PC local
ssh -L 3000:localhost:3000 usuario@tu-vps.com

# Ahora puedes acceder a: http://localhost:3000
```

### Opción 2: VPN (WireGuard)

Más seguro que exponer puerto 3000.

### Opción 3: Cloudflare Tunnel

Gratis y seguro:
```bash
# Instalar cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Crear tunnel
cloudflared tunnel login
cloudflared tunnel create dockbrain
cloudflared tunnel route dns dockbrain api.tu-dominio.com

# Configurar
sudo nano ~/.cloudflared/config.yml
```

---

## 💡 Tips para VPS

1. **Usa Docker** para aislar DockBrain
2. **Configura firewall** (UFW o firewalld)
3. **Habilita fail2ban** para SSH
4. **Usa nginx** como reverse proxy con HTTPS
5. **Backups automáticos** con cron:
   ```bash
   # Añadir a crontab
   0 2 * * * tar -czf /backup/dockbrain-$(date +\%Y\%m\%d).tar.gz /opt/dockbrain/data/
   ```
6. **Monitorea recursos** con htop o netdata
7. **Logs rotativos** con logrotate

---

## 🆘 Soporte

- **Logs:** `sudo journalctl -u dockbrain -f`
- **Documentación:** [README.md](README.md)
- **Seguridad:** [SECURITY.md](SECURITY.md)
- **Issues:** GitHub issues

---

**¡DockBrain corriendo en tu VPS! 🚀**
