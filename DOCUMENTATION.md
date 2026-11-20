# Ghost Cookie · Documentación técnica

## Componentes

- **Manifest V3.** Chrome aplica los filtros de red estáticos. Los dominios en pausa se guardan como reglas dinámicas de excepción. La pausa de diagnóstico usa reglas de sesión limitadas a la pestaña y al dominio, y termina al navegar a otro dominio o cerrar la pestaña. Chrome 145 incorpora la condición por dominio de la página superior que permite que la pausa cubra también las solicitudes de sus iframes.
- **Service worker.** Valida los mensajes por remitente y documento de Chrome. Mantiene estado de actividad en memoria de sesión por pestaña y documento. Al abrir o actualizar el popup consulta las coincidencias de reglas y cuenta solo acciones de bloqueo de las listas de anuncios y rastreo. El navegador asocia las coincidencias de bloqueo al documento activo. El panel muestra **Sin datos** si no puede consultar las coincidencias, y **0** si la consulta confirma que no hay bloqueos.
- **Scripts de página.** Reciben una política confirmada por el worker. Aplican filtros CSS reversibles y observan elementos dinámicos. Las detecciones de patrones se muestran por categoría y dominio observado. Los bloqueos se agrupan por lista cuando el navegador devuelve datos. Los filtros se aplican visualmente al documento principal.
- **Filtro regional.** El conjunto `adguard_es_pt` viene empaquetado y desactivado. Ajustes conserva la preferencia con la protección en pausa y la reaplica al reanudar. El navegador evalúa las reglas de red y el worker entrega al script de página solo los selectores locales del dominio.
- **Cookies.** El worker obtiene el almacén y la partición de la pestaña, limita el alcance al host actual y sus dominios aplicables y devuelve metadatos al popup. El borrado expira cookies por su identidad de dominio, ruta, almacén y partición, y verifica cuántas siguen presentes.
- **Reputación.** Las coincidencias de la lista local de PhishDestroy redirigen la navegación principal a un aviso con prioridad sobre la pausa por sitio. En páginas accesibles, la reputación y las señales de HTTPS, caracteres internacionales y similitud ortográfica con algunas marcas se pueden consultar en el panel. Las señales aisladas son informativas.

## Reglas y actualizaciones

El [filtro regional](rules/adguard-es-pt/README.md) se compila desde el texto oficial de AdGuard fijado con versión, fecha y SHA-256. El ZIP contiene la fuente, sus avisos y los scripts que permiten reproducir esa adaptación.

[EasyList y EasyPrivacy](rules/THIRD_PARTY_NOTICES.md) se compilan desde una revisión fijada. La lista de reputación usa la [fuente primaria con contenido verificado de PhishDestroy](https://github.com/phishdestroy/destroylist#content-verified-feeds), con revisión y SHA-256 en [reputation/source.json](reputation/source.json). El archivo de reglas resultante incluye el [aviso del proveedor](reputation/PHISHDESTROY-LICENSE.txt).

El flujo **Refresh Ghost Cookie filter lists** del repositorio de desarrollo privado prepara actualizaciones los lunes a las 09:23 en São Paulo y admite ejecución manual. Fija la revisión o versión y el SHA-256 de EasyList, EasyPrivacy, PhishDestroy y el filtro regional de AdGuard, reutiliza los compiladores y prueba el ZIP en Chrome y Edge. Si las pruebas pasan y hay una revisión nueva, propone los cambios en un PR para revisión humana. Los recuentos están en el PR y las reglas añadidas y retiradas en el archivo `changes.json` de la ejecución de Actions. Si ya hay un PR de listas abierto, publica el informe en Actions y conserva esa propuesta para revisión.

El check **Verify Ghost Cookie / Verify ZIP in Chrome and Edge** prueba el ZIP de cada PR contra `main`. El flujo de listas se ejecuta por horario o en forma manual y abre un PR cuando encuentra cambios. Las propuestas se revisan en el repositorio de desarrollo. Cuando se integra una propuesta en su rama principal, el código aprobado se replica en el repositorio público. La actualización publicada en las tiendas entrega a cada usuario las listas nuevas. Ajustes muestra la fecha de cada copia instalada.

Para preparar las listas localmente, ejecuta `node scripts/update-lists.mjs` en una rama limpia. El informe se guarda en `dist/list-update`. Revisa los cambios generados antes de integrarlos. Si falla la descarga, la compilación o la comparación, el script conserva los archivos instalados.

[Distribución](BUILD_README.md)
