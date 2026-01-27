# DockBrain - Referencia Rápida

## 🚀 Instalación Rápida

### Windows
```powershell
npm install
npm run build
npm start
```

### Linux VPS (Automático)
```bash
curl -fsSL https://raw.githubusercontent.com/BaAlvaro/dockbrain/main/install.sh | sudo bash
```

### Docker
```bash
docker-compose up -d
```

---

## 🎛️ Comandos Comunes

### Desarrollo
```bash
npm run dev          # Modo desarrollo (auto-reload)
npm run build        # Compilar TypeScript
npm start            # Iniciar producción
npm test             # Ejecutar tests
npm run lint         # Linter
```

### Linux (Systemd)
```bash
sudo systemctl start dockbrain     # Iniciar
sudo systemctl stop dockbrain      # Detener
sudo systemctl restart dockbrain   # Reiniciar
sudo systemctl status dockbrain    # Estado
sudo journalctl -u dockbrain -f    # Ver logs
```

### Docker
```bash
docker-compose up -d               # Iniciar
docker-compose down                # Detener
docker-compose logs -f             # Ver logs
docker-compose restart dockbrain   # Reiniciar solo DockBrain
docker-compose exec dockbrain sh   # Shell en contenedor
```

---

## 🔑 API - Pairing

### Crear Token
```bash
curl -X POST http://localhost:3000/api/v1/pairing/tokens \
  -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ttl_minutes": 60}'
```

### Listar Tokens Activos
```bash
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  http://localhost:3000/api/v1/pairing/tokens
```

---

## 👥 API - Usuarios

### Listar Usuarios
```bash
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  http://localhost:3000/api/v1/users
```

### Desactivar Usuario
```bash
curl -X PATCH http://localhost:3000/api/v1/users/1 \
  -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
```

### Eliminar Usuario
```bash
curl -X DELETE http://localhost:3000/api/v1/users/1 \
  -H "Authorization: Bearer TU_ADMIN_TOKEN"
```

---

## 🔐 API - Permisos

### Ver Permisos de Usuario
```bash
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  http://localhost:3000/api/v1/users/1/permissions
```

### Dar Permisos Completos
```bash
curl -X PUT http://localhost:3000/api/v1/users/1/permissions \
  -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": [
      {"tool_name": "system_info", "action": "*", "granted": true},
      {"tool_name": "reminders", "action": "*", "granted": true},
      {"tool_name": "files_readonly", "action": "*", "granted": true},
      {"tool_name": "web_sandbox", "action": "fetch", "granted": true}
    ]
  }'
```

---

## 📋 API - Tareas

### Listar Tareas Activas
```bash
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  "http://localhost:3000/api/v1/tasks?status=active"
```

### Ver Detalle de Tarea
```bash
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  http://localhost:3000/api/v1/tasks/TASK_ID
```

---

## 📊 API - Auditoría

### Ver Logs de Usuario
```bash
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  "http://localhost:3000/api/v1/audit?user_id=1&limit=50"
```

### Ver Logs por Rango de Tiempo
```bash
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  "http://localhost:3000/api/v1/audit?from=1706500000&to=1706600000"
```

---

## 🦙 Ollama

### Instalar Ollama
```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Descargar de https://ollama.com/download
```

### Comandos Ollama
```bash
ollama list                  # Ver modelos instalados
ollama pull llama3.2         # Descargar modelo
ollama run llama3.2          # Probar modelo
ollama rm llama3.2           # Eliminar modelo
systemctl status ollama      # Estado del servicio (Linux)
```

### Modelos Recomendados
```bash
ollama pull llama3.2         # 2GB - Balance perfecto
ollama pull phi3             # 2.3GB - Más rápido
ollama pull mistral          # 4GB - Más inteligente
ollama pull llama3.1         # 4.7GB - Máxima calidad
```

---

## 📱 Telegram

### Comandos del Bot
```
/pair <token>     - Emparejar cuenta
/help             - Ver ayuda
/status           - Ver estado
```

### Ejemplos de Uso
```
Recuérdame mañana a las 10am comprar leche
Muéstrame mis recordatorios
Lee el archivo notas.txt
Busca información sobre IA en Wikipedia
Muéstrame info del sistema
```

---

## 🔧 Troubleshooting

### Ver Logs
```bash
# Linux (systemd)
sudo journalctl -u dockbrain -f

# Docker
docker-compose logs -f dockbrain

# Archivo
tail -f data/logs/dockbrain.log
```

### Reiniciar Todo
```bash
# Linux
sudo systemctl restart dockbrain ollama

# Docker
docker-compose restart
```

### Limpiar y Reinstalar
```bash
# Backup
tar -czf dockbrain-backup.tar.gz data/

# Limpiar
rm -rf node_modules package-lock.json dist/

# Reinstalar
npm install
npm run build
npm start
```

---

## 💾 Backup

### Crear Backup
```bash
tar -czf dockbrain-backup-$(date +%Y%m%d).tar.gz data/
```

### Restaurar Backup
```bash
sudo systemctl stop dockbrain  # o docker-compose down
tar -xzf dockbrain-backup-20240127.tar.gz
sudo systemctl start dockbrain  # o docker-compose up -d
```

---

## 🌐 Puertos

- `3000` - API HTTP de DockBrain
- `11434` - Ollama API

### Abrir Puertos (Linux)
```bash
# UFW
sudo ufw allow 3000/tcp

# Firewalld
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 🔑 Variables de Entorno Importantes

```env
TELEGRAM_BOT_TOKEN=        # Token del bot
ADMIN_API_TOKEN=           # Token para API
LLM_PROVIDER=ollama        # openai, ollama, mock
OLLAMA_MODEL=llama3.2      # Modelo a usar
API_HOST=0.0.0.0          # 0.0.0.0 para VPS, 127.0.0.1 para local
```

---

## 📖 Documentación Completa

- [README.md](README.md) - Documentación completa
- [SETUP_WINDOWS.md](SETUP_WINDOWS.md) - Instalación Windows
- [SETUP_LINUX.md](SETUP_LINUX.md) - Instalación Linux/VPS
- [SECURITY.md](SECURITY.md) - Modelo de seguridad
- [CONTRIBUTING.md](CONTRIBUTING.md) - Cómo contribuir

---

## 🆘 Ayuda

**Bot no responde:**
1. Verificar logs: `sudo journalctl -u dockbrain -f`
2. Verificar token: `cat .env | grep TELEGRAM`
3. Probar token: `curl https://api.telegram.org/botTU_TOKEN/getMe`

**Error de permisos:**
1. Ver permisos: `GET /api/v1/users/1/permissions`
2. Dar permisos: `PUT /api/v1/users/1/permissions`

**Ollama no funciona:**
1. Estado: `systemctl status ollama`
2. Reiniciar: `systemctl restart ollama`
3. Probar: `ollama run llama3.2`

**Base de datos corrupta:**
1. Backup: `cp data/dockbrain.db data/dockbrain.db.backup`
2. Recrear: `rm data/dockbrain.db && npm start`

---

**Atajos útiles:**

```bash
# Ver todo de una vez
alias dockbrain-status='sudo systemctl status dockbrain && docker ps | grep dockbrain'
alias dockbrain-logs='sudo journalctl -u dockbrain -f'
alias dockbrain-restart='sudo systemctl restart dockbrain && sudo systemctl restart ollama'
```

Añade a tu `~/.bashrc` o `~/.zshrc`
