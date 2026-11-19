# Privacidad y permisos de Ghost Cookie

Ghost Cookie puede leer la actividad necesaria para aplicar filtros y gestionar cookies del sitio. Al abrir el popup, muestra los metadatos de cookies y el recuento de bloqueos de la página actual. El historial de actividad se conserva en la sesión de Chrome y se descarta al cerrar la pestaña o terminar la sesión.

## Permisos de Chrome

- **Acceso a páginas HTTP y HTTPS.** Permite aplicar filtros visuales, redirigir destinos reportados a una advertencia local y gestionar cookies de sitios visitados.
- **Cookies.** Consulta las cookies del sitio y las elimina cuando lo solicitas.
- **Pestaña activa.** Permite consultar coincidencias de reglas cuando interactúas con el icono.
- **Navegación y almacenamiento.** Distinguen documentos de una misma pestaña, guardan preferencias y conservan temporalmente la actividad de cada documento.
- **Reglas declarativas.** Chrome procesa los bloqueos y las excepciones. El filtro de red usa las listas que se incluyen en cada versión.
- **Mensajería nativa opcional.** Conecta Chrome con el asistente local cuando lo autorizas en Ajustes.

## Asistente local

Cada usuario instala el asistente por separado y configura su propia credencial en el llavero del sistema. Cuando se solicita un análisis, el asistente envía a Google Gemini recuentos y códigos de señales de reputación. Google aplica la cuota y las condiciones de la cuenta asociada a la clave. Los valores de cookies, las URLs y el contenido de las páginas permanecen en Chrome.

Puedes quitar el permiso en Ajustes y retirar la credencial con **remove-key** desde la terminal. [Guía del asistente](native/README.md)

## Datos que se comparten

Franky Solutions distribuye Ghost Cookie. La extensión aplica localmente los filtros de publicidad, rastreo y reputación. Los eventos de actividad de cada pestaña se guardan durante la sesión del navegador. Las preferencias y excepciones de sitios se conservan en el dispositivo.

Si eliges usar Gemini, el asistente se comunica directamente con Google al solicitar un análisis. Comparte recuentos de actividad, coincidencia de reputación y códigos de señales. Google procesa la solicitud bajo las condiciones de la cuenta de Gemini de cada usuario. El llavero del sistema conserva la credencial. Puedes retirar el permiso en los ajustes y eliminar la clave desde el asistente.

El uso de información obtenido mediante las APIs del navegador sigue los requisitos de Uso Limitado aplicables de Chrome Web Store. [Política de Uso Limitado](https://developer.chrome.com/docs/webstore/program-policies/limited-use)

Para consultas sobre privacidad, utiliza el contacto oficial de [Franky Solutions](https://frankysolutions.com.br/).
