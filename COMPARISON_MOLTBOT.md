# DockBrain vs MoltBot - Análisis Comparativo

## 📊 Resumen Ejecutivo

**MoltBot** es el asistente de IA personal viral de 2026 con 30K+ estrellas en GitHub y una comunidad de 8.9K en Discord. Es un proyecto maduro con 13+ plataformas de mensajería y 100+ skills.

**DockBrain** es una implementación de referencia enfocada en seguridad, simplicidad y privacidad local. Actualmente en MVP.

---

## 🎯 MoltBot - Características Completas

### **1. Plataformas de Mensajería (13+)**
- ✅ WhatsApp
- ✅ Telegram (con comandos nativos, topics, HTML formatting)
- ✅ Slack
- ✅ Discord
- ✅ Google Chat
- ✅ Signal
- ✅ iMessage / BlueBubbles
- ✅ Microsoft Teams
- ✅ Matrix
- ✅ Zalo & Zalo Personal
- ✅ WebChat
- ✅ Apps nativas macOS/iOS/Android

**DockBrain**: Solo Telegram

---

### **2. Herramientas (Tools)**

#### **MoltBot tiene 30+ tools integrados:**

**Ejecución:**
- `exec` - Ejecutar comandos
- `bash` - Shell completo (con allowlist elevada)
- `process` - Gestión de procesos

**Archivos:**
- `read` - Leer archivos
- `write` - Escribir archivos
- `edit` - Editar archivos (reemplazos específicos)
- `apply_patch` - Aplicar parches

**Sesiones Multi-Agente:**
- `sessions_list` - Listar sesiones activas
- `sessions_history` - Historial de sesiones
- `sessions_send` - Enviar mensajes entre agentes
- `sessions_spawn` - Crear nuevas sesiones de agente
- `session_status` - Estado de sesión

**Memoria Persistente:**
- `memory_search` - Buscar en memorias almacenadas
- `memory_get` - Recuperar memorias específicas
- Sistema USER.md que crece con interacciones
- Directorio memory/ para largo plazo

**Automatización UI:**
- `browser` - Control completo de navegador (Puppeteer/Playwright)
  - CDP (Chrome DevTools Protocol)
  - Abrir tabs, leer páginas, click, escribir
  - Capturas, generar PDFs
  - Perfil aislado de Chrome/Brave/Edge
- `canvas` - Dibujo en canvas
- `cron` - Tareas programadas
- `tts` - Text-to-speech
- `image` - Generación/manipulación de imágenes

**Comunicación:**
- `message` - Enviar mensajes a cualquier canal
- `gateway` - Gestión de gateway
- Web fetch con protección SSRF
- Web search

**Otros:**
- `nodes` - Gestión de nodos

#### **DockBrain tiene 9 tools:**
1. `files_readonly` - Solo lectura (con filtro por extensión)
2. `reminders` - Crear/listar/eliminar recordatorios
3. `web_sandbox` - Fetch web con SSRF protection
4. `system_info` - Info del sistema
5. `email` - SMTP email
6. `gmail` - OAuth + Pub/Sub hooks
7. `codex_auth` - Auth con Codex
8. `network_tools` - Herramientas de red
9. `system_exec` - Ejecución segura de comandos Linux

**Faltante en DockBrain:**
- ❌ Escritura/edición de archivos
- ❌ Multi-agente (sessions)
- ❌ Memoria persistente
- ❌ Browser automation
- ❌ Canvas/Drawing
- ❌ TTS
- ❌ Image generation
- ❌ Cron/scheduled tasks
- ❌ Shell bash completo

---

### **3. Sistema de Skills**

**MoltBot Skills:**
- **MoltHub**: Registro público con 100+ skills
- Formato AgentSkills compatible (SKILL.md + YAML frontmatter)
- Vector search con embeddings
- Star/comment system con moderación
- CLI-friendly API
- Estructura: workspace/skills → ~/.clawdbot/skills → bundled skills
- **Skill Creator**: Genera Python scripts + PIL automáticamente

**DockBrain:**
- ❌ No tiene sistema de skills
- ❌ No hay registro público
- ❌ No hay extensibilidad via skills

---

### **4. Integraciones OAuth & APIs**

**MoltBot (50+ integraciones):**
- ✅ Gmail con Pub/Sub hooks
- ✅ Google Calendar (scheduling)
- ✅ Slack API
- ✅ Discord (guild/messaging/moderation)
- ✅ GitHub
- ✅ WhatsApp actions
- ✅ CRM systems
- ✅ Invoice generation
- ✅ Project management tools

**DockBrain:**
- ✅ Gmail OAuth + Pub/Sub (recién añadido, inspirado en MoltBot)
- ✅ SMTP email básico
- ✅ Codex auth
- ❌ Resto de integraciones

---

### **5. Seguridad & Sandboxing**

**MoltBot:**
- Docker sandboxes por sesión
- Sesión principal = full access
- Sesiones de grupo/canal = sandbox aislado
- Allowlist configurable por sandbox
- Default allowlist: bash, process, read, write, edit
- `tools.elevated` allowlists para operaciones privilegiadas

**DockBrain:**
- ✅ Pairing basado en tokens de un solo uso
- ✅ Permisos granulares por tool y action
- ✅ Confirmación para operaciones destructivas
- ✅ Audit logging completo
- ✅ Path traversal protection
- ✅ SSRF protection con domain allowlist
- ✅ Rate limiting por usuario
- ⚠️ No tiene sandboxing por sesión (single-user design)

**Ventaja DockBrain**: Modelo de permisos más granular con auditoría

---

### **6. Automatización**

**MoltBot:**
- ✅ Email automation (inbox zero, drafting)
- ✅ Calendar management
- ✅ Multi-agent routing
- ✅ Scheduled tasks (cron)
- ✅ Cross-platform messaging
- ✅ CRM integration
- ✅ Invoice generation
- ✅ Webhooks personalizados

**DockBrain:**
- ✅ Recordatorios básicos
- ✅ Gmail Pub/Sub hooks
- ❌ Cron tasks
- ❌ Multi-agent
- ❌ Webhooks personalizados

---

### **7. Arquitectura de Memoria**

**MoltBot:**
- **USER.md**: Perfil del usuario que crece con cada interacción
- **memory/**: Directorio de memorias a largo plazo
- **TOOLS.md**: Lista de tools disponibles
- Búsqueda semántica en memorias
- Contexto persistente entre sesiones

**DockBrain:**
- ❌ No tiene sistema de memoria persistente
- ✅ SQLite para datos estructurados (tasks, users, permisos)
- Cada sesión comienza de cero

---

### **8. Browser Automation**

**MoltBot:**
- Chrome DevTools Protocol (CDP) completo
- Playwright integration
- Perfil de navegador aislado
- Puede:
  - Abrir tabs y navegar
  - Leer contenido de páginas
  - Click y escribir
  - Tomar screenshots
  - Generar PDFs
  - Ejecutar JavaScript
  - Interceptar requests

**DockBrain:**
- ❌ No tiene browser automation
- Solo web fetch básico

---

### **9. Telegram Features Específicos**

**MoltBot:**
- ✅ Comandos nativos (/status, /reset, /model)
- ✅ Forum topics con sesiones aisladas
- ✅ Draft streaming (typing bubbles)
- ✅ Message chunking (4000 chars)
- ✅ HTML parse mode + Markdown
- ✅ Group chat con config por topic
- ✅ Media upload/download (5MB cap)

**DockBrain:**
- ✅ Comandos básicos (/help, /status, /pair)
- ❌ No forum topics
- ❌ No draft streaming
- ❌ No HTML formatting avanzado
- ❌ No group chat configurado
- ❌ No media handling

---

## 📈 Tabla Comparativa

| Característica | MoltBot | DockBrain | Gap |
|----------------|---------|-----------|-----|
| **Plataformas** | 13+ | 1 (Telegram) | 🔴 Critical |
| **Tools** | 30+ | 9 | 🟡 Medium |
| **Skills System** | ✅ 100+ public | ❌ None | 🔴 Critical |
| **Multi-Agent** | ✅ Yes | ❌ No | 🟡 Medium |
| **Memoria Persistente** | ✅ USER.md + memory/ | ❌ No | 🟡 Medium |
| **Filesystem** | Read/Write/Edit/Patch | Read-only | 🟡 Medium |
| **Shell** | Full bash/exec | ❌ Limited | 🟡 Medium |
| **Browser Automation** | ✅ CDP/Playwright | ❌ No | 🔴 Critical |
| **Scheduled Tasks** | ✅ Cron | Reminders only | 🟡 Medium |
| **Webhooks** | ✅ Custom + Gmail | Gmail only | 🟢 Low |
| **Canvas/Drawing** | ✅ Yes | ❌ No | 🟢 Low |
| **TTS** | ✅ Yes | ❌ No | 🟢 Low |
| **Image Tools** | ✅ Yes | ❌ No | 🟢 Low |
| **Sandboxing** | Docker per session | ❌ No | 🟡 Medium |
| **Security Model** | Allowlists | Granular permissions | 🟢 DockBrain mejor |
| **Audit Logging** | Basic | ✅ Full | 🟢 DockBrain mejor |
| **Plan-Execute-Verify** | No | ✅ Yes | 🟢 DockBrain mejor |
| **Local LLM** | No mention | ✅ Ollama | 🟢 DockBrain mejor |
| **Community** | 30K+ stars | Reference impl | 🔴 Critical |
| **Documentation** | Good | ✅ Excellent | 🟢 DockBrain mejor |

---

## 🎯 Roadmap: DockBrain → MoltBot Level

### **Fase 1: Fundamentos (MVP+)** ✅ ACTUAL
- [x] Telegram connector básico
- [x] Sistema de permisos granular
- [x] Audit logging
- [x] Files readonly
- [x] Reminders
- [x] Web sandbox
- [x] Gmail OAuth + hooks
- [x] SMTP email
- [x] Local LLM (Ollama)

### **Fase 2: Core Features (3-4 semanas)**
**Prioridad ALTA:**

1. **File Write/Edit** (1 semana)
   - Tool para escribir archivos
   - Tool para editar archivos (string replacement)
   - Permisos granulares (allow paths, deny patterns)
   - Confirmación obligatoria para escritura

2. **Sistema de Memoria** (1 semana)
   - USER.md con perfil persistente
   - memory/ directory para largo plazo
   - API para buscar/recuperar memorias
   - Auto-actualización del perfil

3. **Shell Execution** (1 semana)
   - Bash tool con allowlist
   - Protección contra comandos peligrosos
   - Timeout configurables
   - Log de ejecución

4. **Browser Automation** (1-2 semanas)
   - Playwright integration
   - CDP básico (navigate, read, screenshot)
   - Sandbox profile aislado
   - Permisos por dominio

### **Fase 3: Automatización Avanzada (2-3 semanas)**
**Prioridad MEDIA:**

1. **Cron/Scheduled Tasks** (1 semana)
   - Replace reminders con cron engine
   - Sintaxis crontab
   - Persistent scheduling
   - Task history

2. **Multi-Agent System** (1-2 semanas)
   - Session management
   - Agent spawning
   - Inter-agent messaging (sessions_send)
   - Session isolation

3. **Webhooks System** (1 semana)
   - Generic webhook receiver
   - Gmail Pub/Sub (ya existe)
   - Custom webhook routing
   - Webhook → Task mapping

### **Fase 4: Extensibilidad (2-3 semanas)**
**Prioridad MEDIA:**

1. **Skills System** (2 semanas)
   - SKILL.md format parser
   - Skills directory loading
   - Dynamic skill registration
   - Precedence system (workspace → user → bundled)

2. **Skills Registry** (1 semana)
   - Local skills repository
   - CLI para instalar skills
   - Skill metadata (version, author, dependencies)
   - Simple search (no vector search inicialmente)

### **Fase 5: Media & UI (1-2 semanas)**
**Prioridad BAJA:**

1. **Media Handling** (1 semana)
   - Telegram media upload/download
   - Image processing básico
   - File size limits
   - Storage management

2. **Canvas/Drawing** (opcional)
   - PIL integration
   - Basic drawing commands
   - Image generation

3. **TTS** (opcional)
   - Text-to-speech
   - Multiple voices
   - Audio file generation

### **Fase 6: Multi-Platform (FUTURO)**
**Prioridad BAJA - Post v1.0:**
- WhatsApp connector
- Discord connector
- Slack connector
- Signal connector

---

## 🚀 Quick Wins (Siguiente Sprint)

**Features que agregan más valor con menos esfuerzo:**

1. **File Write Tool** (2-3 días)
   - Enorme upgrade de utilidad
   - Código simple, usar las mismas protecciones que readonly
   - Permisos ya existen

2. **Shell Execution** (2-3 días)
   - Funcionalidad crítica para automatización
   - Usar allowlist similar a files
   - Timeout + sanitization

3. **Memoria Básica** (2-3 días)
   - USER.md file simple
   - Append-only inicialmente
   - Huge improvement en UX

4. **Cron Basic** (3-4 días)
   - Reemplaza reminders con algo más potente
   - Use node-cron
   - SQLite para persistence

**Total: ~2 semanas para 4x la funcionalidad**

---

## 💡 Ventajas Competitivas de DockBrain

**No copiar todo de MoltBot. Mantener:**

1. **Seguridad Superior**
   - Modelo de permisos más granular
   - Pairing con tokens únicos
   - Audit trail completo
   - Confirmaciones explícitas

2. **Simplicidad**
   - Codebase más limpio
   - Menos complejidad
   - Más fácil de auditar

3. **Privacidad Local**
   - Ollama support (MoltBot no lo menciona)
   - 100% offline capable
   - No telemetry

4. **Plan-Execute-Verify**
   - Ciclo de verificación único
   - Mayor reliability

5. **Documentación**
   - Security docs excelentes
   - Setup guides muy completos
   - Better onboarding

---

## 🎯 Posicionamiento Recomendado

**MoltBot** = "Do everything AI assistant for power users"
- 13 plataformas
- 100 skills
- Computer control completo
- Multi-agent

**DockBrain** = "Secure, private, auditable automation assistant"
- Security-first
- Privacy-focused (100% local con Ollama)
- Single-user design con permisos granulares
- Audit trail completo
- Plan-Execute-Verify cycle
- Self-hosted only

**Nicho**: Usuarios que priorizan seguridad, privacidad y auditabilidad sobre features.

---

## 📝 Conclusiones

### **Gap Analysis:**
- DockBrain está ~30% del camino hacia MoltBot en features
- Pero tiene ventajas en seguridad y documentación
- MVP sólido, listo para escalar

### **Recomendación:**
1. **Corto plazo (1 mes)**: Implementar Fase 2 completa
   - File write/edit
   - Shell execution
   - Memoria básica
   - Browser automation básico

2. **Medio plazo (2-3 meses)**: Fase 3 + Fase 4
   - Cron
   - Multi-agent
   - Skills system básico

3. **Largo plazo (6 meses)**: v1.0
   - Skills registry
   - 2-3 plataformas más (WhatsApp, Discord)
   - Media handling completo

### **Enfoque:**
No intentar ser clon de MoltBot.
**Posicionar como "MoltBot pero security-first y privacy-focused"**

---

## 🔗 Referencias

- MoltBot GitHub: https://github.com/moltbot/moltbot
- MoltBot Docs: https://docs.molt.bot
- MoltHub: https://molthub.com
- DockBrain: https://github.com/BaAlvaro/dockbrain
