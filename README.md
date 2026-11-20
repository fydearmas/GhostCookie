# Ghost Cookie 1.3.1

Extensión de escritorio para **Chrome y Microsoft Edge** con soporte para las reglas de Manifest V3 de Chromium 145 o posterior. Bloquea anuncios y rastreadores, muestra la actividad de la página y advierte sobre sitios que coinciden con la lista local de reputación.

## Instalar

Las versiones distribuidas en tiendas se instalan desde la ficha de cada navegador. Para una instalación descomprimida de desarrollo:

1. Extrae **ghost-cookie-v1.3.1.zip** en una carpeta fija.
2. Abre la página de extensiones de Chrome en **chrome://extensions/**.
3. Activa **Modo de desarrollador**, pulsa **Cargar descomprimida** y elige la carpeta que contiene **manifest.json**.
4. Abre una página nueva o recarga la pestaña donde quieras usar el filtro visual. Fija el icono de Ghost Cookie si quieres abrir el panel desde la barra.

Si ya usabas una instalación descomprimida, actualiza su carpeta original y pulsa **Recargar** en la tarjeta de Ghost Cookie para conservar el ID de la extensión.

## Protección y privacidad

- **Anuncios y rastreadores.** Ghost Cookie usa reglas de Chrome, un subconjunto compilado de EasyList y EasyPrivacy y filtros visuales reversibles. El panel muestra solicitudes bloqueadas, rastreadores detectados y elementos filtrados. En YouTube, el filtro puede ocultar elementos e intentar pulsar el botón de salto cuando el reproductor lo muestra.
- **Filtro regional.** En **Ajustes → Protección**, activa el filtro de AdGuard para sitios en español y portugués. Es opcional. La fecha de su revisión aparece en **Listas instaladas**.
- **Pausa.** La pausa por sitio cubre su dominio y subdominios para anuncios y rastreo. **Este sitio no funciona** pausa el filtrado de la pestaña y recarga la página. Puedes reanudar manualmente o salir del dominio. Los avisos de reputación siguen activos durante ambas pausas. El interruptor general de Ajustes controla todos los filtros y avisos.
- **Cookies.** El panel permite borrar las cookies del sitio actual, incluidas las disponibles en la partición de esa página. Las categorías son estimaciones basadas en el nombre de la cookie.
- **Reputación.** La lista de PhishDestroy se consulta en el equipo y se actualiza con las versiones de la extensión. **Sin amenazas conocidas** significa que la lista incluida carece de una coincidencia. El filtro de anuncios tampoco puede abarcar todo rastreo, publicidad integrada en el contenido o técnicas de identificación.
- **Datos.** Los recuentos y detecciones se guardan durante la sesión por pestaña. La extensión conserva las preferencias y los dominios que pongas en pausa. Los filtros y avisos funcionan sin enviar el historial de navegación.

[Documentación técnica](DOCUMENTATION.md) · [Empaquetado y verificación](BUILD_README.md) · [Cambios de la versión](CHANGELOG.md) · [Licencia MIT del código de Ghost Cookie](LICENSE) · [Avisos de terceros](rules/THIRD_PARTY_NOTICES.md)
