# Privacidad y permisos de Ghost Cookie 1.3.1

Si tu extensión todavía muestra la versión 1.3.0, consulta [la política de esa versión](https://github.com/fydearmas/GhostCookie/blob/aa3e82405c314c5ed69fe0b2b1c9e04f053cda91/PROTECTION.md).

Ghost Cookie puede leer la actividad necesaria para aplicar filtros y gestionar cookies del sitio. Al abrir el popup, muestra los metadatos de cookies y el recuento de bloqueos de la página actual. La actividad se conserva en la sesión de Chrome y se descarta al cerrar la pestaña o terminar la sesión.

## Permisos de Chrome

- **Acceso a páginas HTTP y HTTPS.** Permite aplicar filtros visuales, redirigir destinos reportados a una advertencia local y gestionar cookies de sitios visitados.
- **Cookies.** Consulta las cookies del sitio y las elimina cuando lo solicitas.
- **Pestaña activa.** Permite consultar coincidencias de reglas cuando interactúas con el icono.
- **Navegación y almacenamiento.** Distinguen documentos de una misma pestaña, guardan preferencias y conservan temporalmente la actividad de cada documento.
- **Reglas declarativas.** Chrome procesa los bloqueos y las excepciones. El filtro de red usa las listas empaquetadas, incluido el filtro regional si lo activas.

## Procesamiento local

Franky Solutions distribuye Ghost Cookie. La extensión aplica localmente los filtros de publicidad, rastreo y reputación. Los eventos de actividad de cada pestaña se guardan durante la sesión del navegador. El panel calcula su explicación en el equipo. Los filtros se actualizan al instalar una nueva versión desde la tienda. La extensión procesa la URL del documento activo y señales del contenido para aplicar los filtros. Consulta las cookies del sitio para listar sus metadatos y borrarlas a petición del usuario. Los valores de las cookies permanecen en el navegador. El enlace para reportar problemas abre el formulario de GitHub en blanco. El filtro regional y las métricas funcionan sin transferir datos de navegación a servicios externos. Las preferencias y excepciones de sitios se conservan en el dispositivo.

El uso de información obtenido mediante las APIs del navegador sigue los requisitos de Uso Limitado aplicables de Chrome Web Store. [Política de Uso Limitado](https://developer.chrome.com/docs/webstore/program-policies/limited-use)

Para consultas sobre privacidad, utiliza el contacto oficial de [Franky Solutions](https://frankysolutions.com.br/).
