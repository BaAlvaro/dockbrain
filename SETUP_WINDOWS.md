# Guía de Instalación en Windows (Paso a Paso)

## 🎯 Objetivo

Instalar y ejecutar DockBrain en Windows, con soporte para LLMs locales (Ollama).

---

## ✅ PASO 1: Solucionar el Error de Instalación

### Problema
El error `gyp ERR! find VS` ocurre porque `better-sqlite3` necesita compilar código nativo y requiere Visual Studio en Windows.

### ✨ Solución Recomendada: Usar Node.js LTS 20.x

Node.js 24.x es muy reciente y no tiene binarios precompilados. La solución más simple es usar Node.js 20.x LTS.

#### 1.1 Desinstalar Node.js 24.x

1. Presiona `Win + I` para abrir Configuración
2. Ve a **Apps** → **Aplicaciones instaladas**
3. Busca **Node.js** en la lista
4. Haz clic en los tres puntos → **Desinstalar**
5. Confirma la desinstalación

#### 1.2 Instalar Node.js 20.x LTS

1. Abre tu navegador y ve a: https://nodejs.org/en/download/
2. Descarga **"20.x LTS (Recommended for Most Users)"** - Windows Installer (.msi) x64
3. Ejecuta el instalador descargado
4. Acepta todos los valores por defecto
5. **IMPORTANTE:** Marca la casilla "Automatically install the necessary tools" (instala Python y herramientas de compilación automáticamente)
6. Completa la instalación

#### 1.3 Verificar la Instalación

Abre una **nueva** terminal PowerShell y verifica:

```powershell
node -v
# Debería mostrar: v20.x.x

npm -v
# Debería mostrar: 10.x.x
```

#### 1.4 Limpiar e Instalar Dependencias

```powershell
cd C:\Users\deatw\Desktop\Dockbrain

# Eliminar instalación fallida anterior
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# Instalar de nuevo
npm install
```

**¡Debería instalar correctamente ahora!**

---

## 🦙 PASO 2: Instalar Ollama (LLM Local)

Ollama te permite ejecutar modelos de IA **completamente gratis y sin conexión a internet** en tu propia computadora.

### 2.1 Descargar e Instalar Ollama

1. Ve a: https://ollama.com/download
2. Descarga **Ollama for Windows**
3. Ejecuta el instalador
4. Sigue los pasos (instalación automática)

### 2.2 Verificar que Ollama Está Corriendo

Después de instalar, Ollama se ejecuta automáticamente en segundo plano.

Para verificar, abre PowerShell y ejecuta:

```powershell
ollama --version
# Debería mostrar: ollama version x.x.x
```

### 2.3 Descargar un Modelo

Ollama necesita descargar modelos de IA. Te recomiendo estos modelos por orden de calidad:

#### Opción 1: Llama 3.2 (Recomendado - Balance calidad/velocidad)
```powershell
ollama pull llama3.2
```
**Tamaño:** ~2GB | **RAM requerida:** 8GB

#### Opción 2: Llama 3.1 (Mayor calidad)
```powershell
ollama pull llama3.1
```
**Tamaño:** ~4.7GB | **RAM requerida:** 16GB

#### Opción 3: Mistral (Más rápido)
```powershell
ollama pull mistral
```
**Tamaño:** ~4GB | **RAM requerida:** 8GB

#### Opción 4: Phi-3 Mini (El más ligero)
```powershell
ollama pull phi3
```
**Tamaño:** ~2.3GB | **RAM requerida:** 4GB

**Espera a que descargue** (puede tomar varios minutos dependiendo de tu internet).

### 2.4 Probar Ollama

```powershell
ollama run llama3.2
```

Deberías ver un prompt donde puedes chatear con el modelo. Escribe algo como:

```
>>> Hola, ¿cómo estás?
```

Presiona `Ctrl+D` o escribe `/bye` para salir.

### 2.5 Verificar que el Servidor Está Activo

```powershell
curl http://localhost:11434
```

Debería responder: `Ollama is running`

---

## 🔧 PASO 3: Configurar DockBrain

### 3.1 Obtener Token de Telegram

1. Abre Telegram en tu celular o computadora
2. Busca el bot **@BotFather**
3. Envía el comando: `/newbot`
4. Sigue las instrucciones:
   - Nombre del bot: `DockBrain` (o el que prefieras)
   - Username del bot: `tu_dockbrain_bot` (debe terminar en `_bot`)
5. **Guarda el token** que te da (algo como: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 3.2 Generar Token de Admin

En PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copia el resultado** (un string largo de caracteres aleatorios).

### 3.3 Configurar Variables de Entorno

1. Copia el archivo de ejemplo:

```powershell
Copy-Item .env.example .env
```

2. Abre el archivo `.env` con tu editor preferido (Notepad, VSCode, etc.):

```powershell
notepad .env
```

3. Edita las variables:

```env
# Telegram Bot Token (lo obtuviste de @BotFather)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Admin API Token (el que generaste arriba)
ADMIN_API_TOKEN=tu_token_aleatorio_muy_largo_aqui

# Configuración de LLM - USA OLLAMA
LLM_PROVIDER=ollama

# NO necesitas OpenAI API Key si usas Ollama
# OPENAI_API_KEY=

# Configuración de Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# El resto déjalo como está
DATABASE_PATH=./data/dockbrain.db
LOGS_DIR=./data/logs
SAFE_ROOT_DIR=./data/safe_root
API_HOST=127.0.0.1
API_PORT=3000
NODE_ENV=development
```

4. **Guarda el archivo** y ciérralo.

---

## 🚀 PASO 4: Compilar y Ejecutar DockBrain

### 4.1 Compilar TypeScript

```powershell
npm run build
```

Deberías ver:
```
Successfully compiled X files
```

### 4.2 Iniciar DockBrain

```powershell
npm start
```

Deberías ver algo como:

```
{"level":"info","msg":"Starting DockBrain..."}
{"level":"info","msg":"Configuration loaded"}
{"level":"info","msg":"Database initialized"}
{"level":"info","msg":"Using Ollama LLM provider","model":"llama3.2","baseUrl":"http://localhost:11434"}
{"level":"info","msg":"Tool registry initialized","tools":["files_readonly","reminders","web_sandbox","system_info"]}
{"level":"info","msg":"API server started","host":"127.0.0.1","port":3000}
{"level":"info","msg":"Starting Telegram bot"}
{"level":"info","msg":"DockBrain started successfully"}
```

**¡DockBrain está corriendo!**

---

## 🔗 PASO 5: Emparejar tu Cuenta de Telegram

### 5.1 Crear Token de Emparejamiento

**Abre otra terminal PowerShell** (deja la anterior corriendo) y ejecuta:

```powershell
$adminToken = "TU_ADMIN_API_TOKEN_AQUI"  # Reemplaza con tu token del .env

curl -X POST http://localhost:3000/api/v1/pairing/tokens `
  -H "Authorization: Bearer $adminToken" `
  -H "Content-Type: application/json" `
  -d '{\"ttl_minutes\": 60}'
```

Respuesta esperada:
```json
{
  "token": "AbCdEfGh12345678XyZ1234",
  "expires_at": 1706544000
}
```

**Copia el token** que te devolvió.

### 5.2 Emparejar en Telegram

1. Abre Telegram
2. Busca tu bot por el username que le pusiste (ej: `@tu_dockbrain_bot`)
3. Envía el comando:

```
/pair AbCdEfGh12345678XyZ1234
```

(Reemplaza con el token que copiaste)

Deberías recibir:

```
Successfully paired! 🎉

You now have access to basic commands.
Type /help to see what you can do.
```

---

## ✨ PASO 6: ¡Probar DockBrain!

### Crear un Recordatorio

```
Recuérdame mañana a las 10am que tengo reunión
```

El bot responderá con algo como:

```
He creado un recordatorio para el 28/01/2026 a las 10:00 AM.
```

### Ver tus Recordatorios

```
Muéstrame mis recordatorios
```

### Información del Sistema

```
Muéstrame información del sistema
```

### Buscar Contenido Web

```
Busca información sobre inteligencia artificial en Wikipedia
```

---

## 🛠️ Comandos Útiles

### Modo Desarrollo (Auto-reload)

Si quieres hacer cambios al código:

```powershell
npm run dev
```

Esto reiniciará automáticamente cuando hagas cambios.

### Ver Logs

```powershell
Get-Content .\data\logs\dockbrain.log -Tail 50 -Wait
```

### Ejecutar Tests

```powershell
npm test
```

### Detener DockBrain

En la terminal donde está corriendo, presiona `Ctrl+C`.

---

## 🎨 PASO 7: Dar Más Permisos (Opcional)

Por defecto, solo tienes permisos para:
- Ver información del sistema
- Crear/listar recordatorios

Para dar acceso a **archivos y web**:

### 7.1 Encontrar tu User ID

```powershell
$adminToken = "TU_ADMIN_API_TOKEN"

curl -H "Authorization: Bearer $adminToken" http://localhost:3000/api/v1/users
```

Verás algo como:
```json
{
  "users": [
    {
      "id": 1,
      "telegram_chat_id": "123456789",
      "display_name": "Tu Nombre"
    }
  ]
}
```

**Anota el `id`** (probablemente sea `1`).

### 7.2 Otorgar Permisos

```powershell
$adminToken = "TU_ADMIN_API_TOKEN"
$userId = 1  # Reemplaza con tu ID

$body = @{
  permissions = @(
    @{
      tool_name = "files_readonly"
      action = "read"
      granted = $true
      requires_confirmation = $false
    },
    @{
      tool_name = "files_readonly"
      action = "list"
      granted = $true
      requires_confirmation = $false
    },
    @{
      tool_name = "reminders"
      action = "*"
      granted = $true
      requires_confirmation = $false
    },
    @{
      tool_name = "web_sandbox"
      action = "fetch"
      granted = $true
      requires_confirmation = $false
    },
    @{
      tool_name = "system_info"
      action = "*"
      granted = $true
      requires_confirmation = $false
    }
  )
} | ConvertTo-Json -Depth 3

curl -X PUT "http://localhost:3000/api/v1/users/$userId/permissions" `
  -H "Authorization: Bearer $adminToken" `
  -H "Content-Type: application/json" `
  -d $body
```

Ahora podrás:
- Leer archivos en `./data/safe_root/`
- Obtener contenido de sitios web permitidos

---

## 🔧 Solución de Problemas

### El bot no responde

1. Verifica que DockBrain está corriendo (debería estar en la terminal)
2. Revisa los logs: `Get-Content .\data\logs\dockbrain.log -Tail 20`
3. Verifica que estás emparejado: envía `/status` al bot

### Ollama no funciona

1. Verifica que está corriendo: `ollama list`
2. Reinicia el servicio de Ollama:
   ```powershell
   # En Windows, Ollama corre como servicio. Reinicia desde:
   # Administrador de Tareas → Servicios → Ollama → Reiniciar
   ```
3. Prueba con otro modelo más ligero: `ollama pull phi3`

### Errores de permisos

1. Otorga permisos como se mostró en el Paso 7
2. Verifica tus permisos: `GET /api/v1/users/:id/permissions`

### Error "Task failed"

1. Revisa los logs para ver el error exacto
2. Si es error de LLM, verifica que Ollama tiene el modelo descargado:
   ```powershell
   ollama list
   ```

---

## 🎯 Próximos Pasos

1. **Prueba diferentes modelos de Ollama** para ver cuál funciona mejor en tu computadora
2. **Lee la documentación completa** en [README.md](README.md)
3. **Revisa el modelo de seguridad** en [SECURITY.md](SECURITY.md)
4. **Personaliza las herramientas** según tus necesidades

---

## 📊 Comparación de Modelos Ollama

| Modelo | Tamaño | RAM Mínima | Velocidad | Calidad | Recomendado Para |
|--------|--------|------------|-----------|---------|------------------|
| phi3 | 2.3GB | 4GB | ⚡⚡⚡ | ⭐⭐⭐ | PCs con poca RAM |
| llama3.2 | 2GB | 8GB | ⚡⚡ | ⭐⭐⭐⭐ | Balance perfecto |
| mistral | 4GB | 8GB | ⚡⚡ | ⭐⭐⭐⭐ | Tareas complejas |
| llama3.1 | 4.7GB | 16GB | ⚡ | ⭐⭐⭐⭐⭐ | Máxima calidad |

---

## ❓ Preguntas Frecuentes

### ¿Ollama es gratis?
Sí, completamente gratis y open source.

### ¿Necesito internet?
Solo para descargar los modelos inicialmente. Después funciona 100% offline.

### ¿Puedo usar OpenAI en lugar de Ollama?
Sí, solo cambia en `.env`:
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=tu_api_key
```

### ¿Qué tan privado es?
Con Ollama, **todo se ejecuta localmente**. Ningún dato sale de tu computadora.

### ¿Cuánto espacio necesito?
- DockBrain: ~500MB
- Ollama + modelo llama3.2: ~3GB
- **Total:** ~4GB libres en disco

---

**¡Listo! Ahora tienes un asistente de IA completamente privado corriendo en tu computadora. 🎉**
