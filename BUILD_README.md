# Empaquetar Ghost Cookie

Desde la raíz del repositorio, con Node.js y Python 3.10 o posterior:

~~~sh
npm run build
~~~

El comando empaqueta una copia del código y las listas compiladas. Genera los ZIP de la extensión y el asistente y un archivo de sumas SHA-256 en **dist/**. Se pueden comparar ejecuciones consecutivas del build sin modificar los archivos fuente.

El ZIP de la extensión se carga descomprimido en Chrome. El ZIP del asistente se instala por separado según **native/README.md**. Conserva ambas sumas SHA-256 junto con los paquetes que distribuyas.

## Verificación

~~~sh
npm test
python3 -B -m unittest discover -s native -v
~~~

La segunda línea es la alternativa directa al comando de npm. En Windows usa **py -3** para invocar Python.

Prueba la extensión descomprimida en un perfil de Chrome de pruebas. Comprueba que la pausa restaura el contenido visual sin recargar el documento, que las solicitudes bloqueadas aparecen separadas de las detecciones, que las cookies normales y particionadas se pueden borrar y que la navegación hacia un destino de reputación de prueba muestra el aviso. Para validar el asistente, registra el ID del perfil de prueba y usa la comprobación de Ajustes antes de solicitar un análisis.

Consulta [el aviso de EasyList](rules/THIRD_PARTY_NOTICES.md) y [la documentación técnica](DOCUMENTATION.md) para regenerar o actualizar los datos.

Para preparar los instaladores de escritorio, obtener las firmas y cargar a las tiendas, consulta [el proceso de publicación](packaging/RELEASING.md).
