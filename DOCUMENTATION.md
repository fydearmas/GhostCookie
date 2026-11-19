# Ghost Cookie · Documentación técnica

## Componentes

- **Manifest V3.** Chrome aplica los filtros de red estáticos. Los dominios en pausa se guardan como reglas dinámicas de excepción. Chrome 145 incorpora la condición por dominio de la página superior que permite que la pausa cubra también las solicitudes de sus iframes.
- **Service worker.** Valida los mensajes por remitente y documento de Chrome. Mantiene estado de actividad en memoria de sesión por pestaña y documento. Al abrir o actualizar el popup consulta las coincidencias de reglas y cuenta solo acciones de bloqueo de las listas de anuncios y rastreo. El navegador asocia las coincidencias de bloqueo al documento activo. El panel muestra **Sin datos** si no puede consultar las coincidencias, y **0** si la consulta confirma que no hay bloqueos.
- **Scripts de página.** Reciben una política confirmada por el worker. Aplican filtros CSS reversibles y observan elementos dinámicos. Las detecciones de patrones se muestran en su propia métrica. Los filtros se aplican visualmente al documento principal.
- **Cookies.** El worker obtiene el almacén y la partición de la pestaña, limita el alcance al host actual y sus dominios aplicables y devuelve metadatos al popup. El borrado expira cookies por su identidad de dominio, ruta, almacén y partición, y verifica cuántas siguen presentes.
- **Reputación.** Las coincidencias de la lista local de PhishDestroy redirigen la navegación principal a un aviso con prioridad sobre la pausa por sitio. En páginas accesibles, la reputación y las señales de HTTPS, caracteres internacionales y similitud ortográfica con algunas marcas se pueden consultar en el panel. Las señales aisladas son informativas.
- **Asistente de Gemini.** Native Messaging se concede de forma opcional. El programa local acepta solo recuentos y códigos de un esquema cerrado y usa el llavero del usuario. La extensión recibe texto, que inserta como contenido de texto. No hay un servicio de Ghost Cookie que reciba las claves.

## Reglas y actualizaciones

[EasyList y EasyPrivacy](rules/THIRD_PARTY_NOTICES.md) se compilan desde una revisión fijada. La lista de reputación usa la [fuente primaria con contenido verificado de PhishDestroy](https://github.com/phishdestroy/destroylist#content-verified-feeds), con revisión y SHA-256 en [reputation/source.json](reputation/source.json). El archivo de reglas resultante incluye el [aviso del proveedor](reputation/PHISHDESTROY-LICENSE.txt).

El flujo **Refresh Ghost Cookie filter lists** del repositorio de desarrollo privado prepara actualizaciones los lunes a las 09:23 en São Paulo y admite ejecución manual. Fija la revisión y el SHA-256 de cada fuente, reutiliza los compiladores y prueba el ZIP en Chrome y Edge. Si las pruebas pasan y hay una revisión nueva, propone los cambios en un PR para revisión humana. Los recuentos están en el PR y las reglas añadidas y retiradas en el archivo `changes.json` de la ejecución de Actions. Si ya hay un PR de listas abierto, publica el informe en Actions y conserva esa propuesta para revisión.

Las propuestas se revisan en el repositorio de desarrollo. Cuando se integra una propuesta en su rama principal, el código aprobado se replica en el repositorio público. La actualización publicada en las tiendas entrega a cada usuario las listas nuevas. Ajustes muestra la fecha de cada copia instalada.

Para preparar las listas localmente, ejecuta `node scripts/update-lists.mjs` en una rama limpia. El informe se guarda en `dist/list-update`. Revisa los cambios generados antes de integrarlos. Si falla la descarga, la compilación o la comparación, el script conserva los archivos instalados.

[Distribución](BUILD_README.md) · [Asistente local](native/README.md)
