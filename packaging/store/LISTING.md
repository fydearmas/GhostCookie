# Ficha de Ghost Cookie

## Configuración común

- Nombre **Ghost Cookie**
- Idioma principal **Español**
- Descripción corta **Bloquea anuncios y rastreadores, gestiona cookies y recibe avisos de phishing con Ghost Cookie.**
- Página de soporte **https://github.com/fydearmas/GhostCookie/issues**
- Política de privacidad **https://github.com/fydearmas/GhostCookie/blob/main/PROTECTION.md**
- Ayuda del asistente **https://github.com/fydearmas/GhostCookie/releases**
- Icono **icons/icon128.png**

## Descripción de la ficha

Ghost Cookie ayuda a reducir el rastreo de tu navegación. Usa EasyList y EasyPrivacy para bloquear solicitudes y ocultar elementos publicitarios. El panel del sitio muestra qué solicitudes se bloquearon, qué rastreadores se detectaron y qué elementos se filtraron. Puedes pausar el filtrado en un sitio para recuperar su funcionamiento.

Consulta y elimina las cookies del sitio. Cuando una navegación coincide con la lista local de sitios reportados por phishing o fraude, Ghost Cookie muestra un aviso antes de contactar con el destino.

El análisis con Gemini es opcional. Requiere instalar el asistente de escritorio y autorizar la conexión. Configuras tu propia clave en el asistente, que la guarda en el llavero del sistema. Cuando solicitas un análisis, el asistente envía a Google recuentos de actividad y señales de reputación. Cada cuenta de Gemini conserva su cuota y facturación.

## Justificación de permisos

| Permiso | Justificación |
| --- | --- |
| Acceso a sitios HTTP y HTTPS | Aplica filtros visuales, aplica el aviso antes de visitar dominios reportados y permite la gestión de cookies. |
| Cookies | Muestra los metadatos de las cookies del sitio y elimina las seleccionadas. |
| Pestaña activa y navegación | Calcula la actividad del documento actual y verifica que las acciones se apliquen a la página que muestra el panel. |
| Almacenamiento | Conserva preferencias y estadísticas temporales durante la sesión. |
| Reglas declarativas | Chrome o Edge evalúan las reglas de bloqueo y los avisos de phishing. |
| Mensajería nativa opcional | Conecta el asistente instalado cuando el usuario solicita autorizar esa función. |

## Pruebas de certificación

1. Abre un sitio HTTP o HTTPS y abre el popup de Ghost Cookie.
2. Comprueba que muestra el dominio, la reputación y las métricas de la página. Prueba **Pausar en este sitio** y **Reanudar en este sitio**.
3. Abre **Cookies** en una página que haya creado una cookie de prueba y comprueba que el popup permite eliminarla.
4. El asistente de IA se instala por separado desde Releases. Tras abrirlo y guardar una clave propia de Gemini, el permiso opcional de mensajería nativa se concede desde **Ajustes**. **Comprobar** muestra el estado del asistente. **Analizar con IA** solicita un análisis.

## Archivos para los paneles

- Sube **dist/ghost-cookie-v1.3.0.zip** como paquete de la extensión.
- Sube **settings-es.png** como captura de escritorio y **tile-440x280.png** para la imagen promocional de Chrome Web Store.
- Comprueba que el enlace de privacidad y el de descargas se pueden abrir sin iniciar sesión antes de enviar a revisión. El asistente se publica como artefacto de GitHub Releases.

[Chrome Web Store](https://developer.chrome.com/docs/webstore/publish) · [Microsoft Edge Add-ons](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
