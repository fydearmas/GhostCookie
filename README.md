# 👻🍪 Ghost Cookie

**Extensión de Chrome para protección de privacidad**

Navega como un fantasma: bloquea trackers, gestiona cookies y protege tu privacidad.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## ✨ Características

- 🚫 **Bloqueo de Trackers**: Detecta y bloquea 50+ trackers conocidos (Google Analytics, Facebook Pixel, etc.)
- 📺 **Bloqueo de Anuncios de YouTube**: Bloquea y salta automáticamente anuncios en videos de YouTube
- 🍪 **Gestión de Cookies**: Visualiza, clasifica y elimina cookies fácilmente
- 🛡️ **Score de Privacidad**: Calcula un score de 0-100 basado en trackers y cookies del sitio
- 🏷️ **Clasificación Inteligente**: Categoriza cookies automáticamente (Esencial, Funcional, Tracking, Publicidad)
- 🤖 **IA Opcional**: Integración con Gemini API para análisis avanzado
- ⚡ **Tiempo Real**: Actualización automática de estadísticas cada 2 segundos
- 🎨 **UI Premium**: Interfaz moderna con tema oscuro y animaciones

---

## 📸 Capturas de Pantalla

### Popup Principal

- Vista de trackers bloqueados
- Gestión de cookies
- Score de privacidad

### Página de Opciones

- Configuración de funciones
- Integración con IA
- Gestión de datos

---

## 🚀 Instalación

### Instalación desde ZIP (Release v1.0.0)

1. Descarga o localiza el archivo `ghost-cookie-v1.0.0-final.zip`.
2. Descomprime el archivo en una carpeta de tu elección.
3. Abre Chrome y navega a `chrome://extensions/`.
4. Activa el **"Modo de desarrollador"** (interruptor en la esquina superior derecha).
5. Haz clic en el botón **"Cargar descomprimida"**.
6. Selecciona la carpeta donde descomprimiste los archivos.
7. ¡Listo! El icono 👻 aparecerá en tu barra de extensiones.

### Chrome Web Store (Próximamente)

La extensión ha sido empaquetada y está lista para publicación en la Chrome Web Store.

---

## 📖 Uso

### Bloqueo de Trackers

1. Navega a cualquier sitio web
2. El icono mostrará un **badge rojo** con el número de trackers bloqueados
3. Haz clic en el icono para ver la lista detallada

### Gestión de Cookies

1. Abre el popup de Ghost Cookie
2. Ve a la pestaña **"Cookies"**
3. Verás todas las cookies con su categoría (icono de color)
4. Elimina cookies individualmente (🗑️) o todas a la vez

### Score de Privacidad

El score se calcula automáticamente basándose en:

- Número de trackers bloqueados
- Cantidad de cookies
- Tipos de cookies (tracking, publicidad)

**Escala**:

- 🛡️ **80-100**: Excelente privacidad
- ✅ **60-79**: Buena privacidad
- ⚠️ **40-59**: Privacidad moderada
- 🚨 **0-39**: Baja privacidad

### Configuración

1. Haz clic en el icono ⚙️ en el popup
2. Configura:
   - Mostrar/ocultar score de privacidad
   - Activar/desactivar clasificación de cookies
   - (Opcional) Conectar API de Gemini para análisis avanzado

---

## 🏗️ Estructura del Proyecto

```
plugin_browser/
├── manifest.json              # Configuración de la extensión
├── icons/                     # Iconos (16, 32, 48, 128px)
├── popup/                     # Interfaz principal
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/                # Service worker
│   ├── service-worker.js
│   └── tracker-list.js
├── content/                   # Scripts inyectados
│   └── content.js
├── options/                   # Página de configuración
│   ├── options.html
│   ├── options.css
│   └── options.js
├── utils/                     # Utilidades
│   └── cookie-classifier.js
└── rules/                     # Reglas de bloqueo
    └── tracker_rules.json
```

---

## 🛠️ Tecnologías

- **Manifest V3**: Última versión de extensiones Chrome
- **JavaScript ES6+**: Módulos, async/await
- **Chrome APIs**:
  - `declarativeNetRequest` - Bloqueo eficiente
  - `webRequest` - Monitoreo de red
  - `cookies` - Gestión de cookies
  - `storage` - Persistencia de datos
- **CSS3**: Variables, gradients, animations

---

## 📊 Trackers Bloqueados

Ghost Cookie bloquea más de 50 trackers conocidos, incluyendo:

### Analytics

- Google Analytics
- Google Tag Manager
- Hotjar
- Mixpanel
- Amplitude
- Heap Analytics
- Microsoft Clarity
- FullStory
- Segment

### Publicidad

- Google Ads
- DoubleClick
- Criteo
- Taboola
- Outbrain
- AdRoll
- Amazon Ads
- PubMatic
- **YouTube Ads** (pre-roll, mid-roll, banners, overlays)

### Redes Sociales

- Facebook Pixel
- Twitter Ads
- LinkedIn Insight
- TikTok Pixel
- Pinterest Tag

Y muchos más...

---

## 🔐 Privacidad

Ghost Cookie respeta tu privacidad:

- ✅ **Sin telemetría**: No enviamos datos a servidores externos
- ✅ **Datos locales**: Toda la información se guarda localmente en tu navegador
- ✅ **Código abierto**: Puedes revisar todo el código
- ✅ **IA opcional**: La integración con Gemini es completamente opcional y usa tu propia API key

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas!

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Documentación

Para documentación técnica detallada, consulta:

- [DOCUMENTATION.md](./DOCUMENTATION.md) - Documentación completa del proyecto
- [CHANGELOG.md](./CHANGELOG.md) - Historial de cambios

---

## 🐛 Reportar Bugs

Si encuentras un bug, por favor abre un issue con:

- Descripción del problema
- Pasos para reproducirlo
- Versión de Chrome
- Capturas de pantalla (si aplica)

---

## 📜 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 👥 Equipo

**Franky Solutions**

- Desarrollo y diseño

---

## 🙏 Agradecimientos

- Iconos: Diseño personalizado
- Inspiración: Extensiones de privacidad existentes
- Comunidad: Usuarios y contribuidores

---

## 📞 Contacto

Para preguntas o sugerencias, contacta al equipo de desarrollo.
+55(11)980752959 Whatsapp

---

**¡Navega como un fantasma! 👻🍪**

_Protege tu privacidad mientras navegas por la web._
