# Empaquetar Ghost Cookie

Desde la raíz del repositorio, con Node.js y Python 3.10 o posterior:

~~~sh
npm run build
~~~

El comando empaqueta una copia del código y las listas compiladas. Genera el ZIP de la extensión y un archivo de sumas SHA-256 en **dist/**. Se pueden comparar ejecuciones consecutivas del build sin modificar los archivos fuente.

El ZIP de la extensión se carga descomprimido en Chrome. Conserva la suma SHA-256 junto con el ZIP. Las guías y el historial de cambios se consultan en el repositorio. El ZIP de la extensión incluye las licencias y los avisos de procedencia. El filtro regional incluye la copia de su fuente utilizada y los scripts para reproducirlo.

## Verificación

~~~sh
npm test
~~~

`npm test` comprueba que el filtro regional se puede reproducir con la fuente incluida. Prueba la extensión descomprimida en un perfil de Chrome de pruebas. Comprueba que la pausa restaura el contenido visual sin recargar el documento, que las solicitudes bloqueadas aparecen separadas de las detecciones, que las cookies normales y particionadas se pueden borrar y que la navegación hacia un destino de reputación de prueba muestra el aviso. Verifica que la pausa de diagnóstico recarga la pestaña y conserva los avisos de phishing.

La [matriz de páginas de prueba](TEST_PAGES.md) incluye casos públicos y comprobaciones locales reproducibles para Chrome y Edge.

Consulta [los avisos de terceros](rules/THIRD_PARTY_NOTICES.md) y [la documentación técnica](DOCUMENTATION.md) para regenerar o actualizar los datos. En Linux, `bash scripts/verify-extension.sh` empaqueta y prueba el ZIP en perfiles temporales de Chrome y Edge.

Para preparar el envío a las tiendas, consulta [la ficha y los pasos de certificación](packaging/store/LISTING.md).
