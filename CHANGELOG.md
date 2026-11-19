# Historial de Cambios - Ghost Cookie

Todos los cambios notables en este proyecto serán documentados en este archivo.

---

## [1.3.1]

- Retirados del repositorio el ZIP de la 1.0.0, la caché de Chrome y archivos de desarrollo en desuso.
- El ZIP de la extensión incluye los archivos de ejecución y los avisos de licencias y de procedencia. Las guías se consultan en GitHub.

## [1.3.0] - 2026-11-18

- Configuración gráfica del asistente de Gemini para Windows y macOS y registro para Chrome y Microsoft Edge.
- Distribución del asistente con instaladores por plataforma y verificación de firma.
- Ajustes de la extensión con descarga del asistente, diagnóstico de conexión e ID para instalaciones de desarrollo.

## [1.2.0] - 2026-11-18

- Protección por sitio y global, con filtros visuales reversibles y confirmación de reglas activas.
- EasyList y EasyPrivacy compiladas y lista de reputación local de PhishDestroy con aviso de navegación.
- Nuevo popup con métricas independientes, estado de reputación y controles accesibles.
- Gestión de cookies particionadas y verificación del borrado.
- Asistente opcional por Native Messaging para usar la clave y cuenta de Gemini de cada usuario desde el llavero del sistema. La actualización elimina las claves que guardaba la extensión anterior.
- Chrome 145 como versión mínima y paquetes separados para la extensión y el asistente.

## [1.1.0] - 2025-12-16

### 🎉 Nueva Funcionalidad: Bloqueo de Anuncios de YouTube

#### ✨ Características Añadidas

**Bloqueo de Anuncios de YouTube**

- Bloqueo automático de anuncios pre-roll (antes del video)
- Bloqueo de anuncios mid-roll (durante el video)
- Bloqueo de anuncios post-roll (después del video)
- Eliminación de banners publicitarios en la página
- Eliminación de overlays en los videos
- Auto-skip de anuncios cuando sea posible
- Aceleración de anuncios no saltables

**Content Script Específico para YouTube**

- Nuevo archivo `content/youtube-adblocker.js`
- Detección y eliminación de elementos de anuncios del DOM
- MutationObserver para detectar anuncios dinámicos
- Monitoreo del estado del player de video
- Inyección de CSS para ocultar elementos publicitarios

**Reglas de Red Actualizadas**

- 10 nuevas reglas en `tracker_rules.json` (IDs 31-40)
- Bloqueo de dominios de anuncios de YouTube:
  - `youtube.com/api/stats/ads`
  - `youtube.com/pagead/`
  - `youtube.com/ptracking`
  - `youtube.com/get_midroll_info`
  - `s.ytimg.com/yts/jsbin/www-pagead`
  - Y más...

**Interfaz de Usuario Mejorada**

- Indicador especial cuando se está en YouTube
- Estadísticas específicas de anuncios de YouTube bloqueados
- Icono 📺 para identificar YouTube
- Contador de anuncios bloqueados en tiempo real

**Service Worker Actualizado**

- Nuevos patrones de detección para YouTube Ads
- Categorización especial para anuncios de YouTube
- Monitoreo de requests relacionados con publicidad

#### 🔧 Cambios Técnicos

- Actualizado `manifest.json` con content script específico para YouTube
- Añadidos 5 nuevos patrones de tracker en `service-worker.js`
- Mejorado `popup.js` con función `showYouTubeIndicator()`
- Añadidos estilos CSS para el indicador de YouTube en `popup.css`

#### 📁 Archivos Modificados

```
plugin_browser/
├── manifest.json                 # Añadido content script para YouTube
├── content/
│   └── youtube-adblocker.js     # NUEVO - Bloqueador específico de YouTube
├── background/
│   └── service-worker.js        # Añadidos patrones de YouTube
├── popup/
│   ├── popup.js                 # Añadida función showYouTubeIndicator()
│   └── popup.css                # Añadidos estilos para indicador de YouTube
└── rules/
    └── tracker_rules.json       # Añadidas 10 reglas para YouTube (31-40)
```

#### 📝 Notas

- El bloqueo de YouTube es automático y no requiere configuración
- YouTube puede detectar el bloqueador en algunos casos
- La funcionalidad de rastreadores existente no se ve afectada
- Incremento de ~5-10KB en el tamaño del plugin

---

## [1.0.0] - 2025-12-09

### 🎉 Lanzamiento Inicial

Primera versión de Ghost Cookie con todas las funcionalidades principales.

### ✨ Características Añadidas

#### Bloqueo de Trackers

- Implementado sistema de bloqueo con `declarativeNetRequest`
- Base de datos de 50+ trackers conocidos
- Detección en tiempo real con `webRequest`
- Detección de trackers inline con content script
- Badge dinámico mostrando trackers bloqueados

#### Gestión de Cookies

- Visualización de todas las cookies del sitio actual
- Clasificación automática en 4 categorías:
  - 🔒 Esencial
  - ⚙️ Funcional
  - 📊 Tracking
  - 📢 Publicidad
- Eliminación individual de cookies
- Botón "Eliminar Todas" con confirmación visual
- Animaciones de eliminación

#### Score de Privacidad

- Cálculo automático basado en:
  - Número de trackers bloqueados
  - Cantidad de cookies
  - Tipos de cookies detectadas
- Escala de 0-100 con 4 niveles:
  - 🛡️ Excelente (80-100)
  - ✅ Bueno (60-79)
  - ⚠️ Moderado (40-59)
  - 🚨 Bajo (0-39)
- Barra de progreso visual con colores dinámicos

#### Interfaz de Usuario

- Popup principal con diseño premium
- Tema oscuro con gradientes y glassmorphism
- Sistema de pestañas (Trackers / Cookies)
- Auto-refresh cada 2 segundos
- Animaciones y transiciones suaves
- Toggle de protección ON/OFF
- Botón de configuración (⚙️) en header

#### Página de Opciones

- Configuración de funciones:
  - Mostrar/ocultar score de privacidad
  - Activar/desactivar clasificación de cookies
- Integración opcional con Gemini AI:
  - Campo para API key
  - Botón de prueba de conexión
  - Visibilidad de API key (mostrar/ocultar)
- Gestión de datos:
  - Botón para borrar todos los datos
- Diseño consistente con el popup

#### Clasificador Inteligente

- Sistema de reglas sin IA para clasificación de cookies
- Base de datos de cookies conocidas con explicaciones
- Patrones de detección para categorización automática
- Función de cálculo de privacy score

#### Content Script

- Escaneo de scripts inline
- Detección de scripts externos
- Identificación de píxeles de tracking
- Observer para contenido dinámico
- Comunicación con service worker

### 🎨 Diseño

#### Iconos

- Icono personalizado: Fantasma comiendo cookie 👻🍪
- 4 tamaños: 16x16, 32x32, 48x48, 128x128
- Formato PNG optimizado

#### Colores

- Tema oscuro principal
- Gradientes violeta/púrpura para acentos
- Código de colores para categorías:
  - Verde: Esencial
  - Azul: Funcional
  - Naranja: Tracking
  - Rojo: Publicidad/Bloqueado

#### Tipografía

- Fuente: Segoe UI (sistema)
- Tamaños jerárquicos
- Uso de gradientes en títulos

### 🔧 Técnico

#### Arquitectura

- Manifest V3
- Service Worker como background script
- ES6 Modules
- Comunicación con `chrome.runtime.sendMessage()`
- Storage local para persistencia

#### APIs Utilizadas

- `declarativeNetRequest`: Bloqueo de trackers
- `webRequest`: Monitoreo de red
- `cookies`: Gestión de cookies
- `storage`: Configuración y estadísticas
- `tabs`: Información de pestañas
- `action`: Badge y popup

#### Permisos

- `cookies`: Leer y eliminar cookies
- `storage`: Guardar datos localmente
- `activeTab`: Acceder a pestaña activa
- `tabs`: Info de pestañas
- `webRequest`: Monitorear requests
- `declarativeNetRequest`: Bloquear trackers
- `<all_urls>`: Funcionar en todos los sitios

### 📁 Archivos Creados

```
plugin_browser/
├── manifest.json
├── README.md
├── DOCUMENTATION.md
├── CHANGELOG.md
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/
│   ├── service-worker.js
│   └── tracker-list.js
├── content/
│   └── content.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── utils/
│   └── cookie-classifier.js
└── rules/
    └── tracker_rules.json
```

### 🐛 Bugs Conocidos

Ninguno reportado en esta versión.

### 📝 Notas

- La integración con Gemini AI es completamente opcional
- Todos los datos se guardan localmente
- No se envía información a servidores externos
- Compatible con Chrome 88+

---

## [Próximas Versiones]

### Planificado para v1.1.0

- [ ] Gráficos de estadísticas
- [ ] Historial de bloqueos
- [ ] Exportar/importar configuración
- [ ] Lista blanca de sitios

### Planificado para v1.2.0

- [ ] Detección de trackers desconocidos
- [ ] Recomendaciones personalizadas

### Planificado para v2.0.0

- [ ] Bloqueo automático de cookies
- [ ] Modo incógnito mejorado
- [ ] Sincronización entre dispositivos

---

## Formato

Este changelog sigue el formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

### Tipos de Cambios

- **Añadido**: Para nuevas características
- **Cambiado**: Para cambios en funcionalidades existentes
- **Obsoleto**: Para características que serán eliminadas
- **Eliminado**: Para características eliminadas
- **Corregido**: Para corrección de bugs
- **Seguridad**: Para vulnerabilidades

---

**Ghost Cookie Team** - 2025
