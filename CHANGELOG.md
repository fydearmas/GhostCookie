# Historial de Cambios - Ghost Cookie

Todos los cambios notables en este proyecto serán documentados en este archivo.

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
