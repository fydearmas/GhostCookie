# Páginas de prueba de Ghost Cookie

Usa perfiles separados de Chrome y Edge con Ghost Cookie como único bloqueador. Mantén los ajustes propios del navegador iguales entre comparaciones. Registra la versión de Ghost Cookie, el navegador, el sistema operativo y el resultado de cada caso. Las pruebas locales tienen resultados esperados fijos. En sitios públicos, compara la misma página con la protección activa y en pausa.

## Páginas públicas

| Caso | Página | Pasos y resultado esperado |
| --- | --- | --- |
| P01 · Anuncios y rastreo | [Test Ad Block de d3ward](https://d3ward.com/adblock) | Compara las solicitudes de anuncios y rastreo en **Red** de DevTools. Repite en pausa con la caché desactivada. Las solicitudes cubiertas por las reglas deben quedar bloqueadas con la protección activa. Registra solicitudes concretas. El porcentaje del sitio incluye filtros propios de su prueba y sirve como referencia. |
| P02 · Compatibilidad en una página con publicidad | [The Guardian](https://www.theguardian.com/international) | Abre un artículo disponible y prueba navegación, imágenes y desplazamiento. Conserva la misma elección de consentimiento en las dos pasadas. El contenido principal debe ser usable con la protección activa. Si se carga publicidad en el perfil de prueba, compara las solicitudes con la protección en pausa. |
| P03 · YouTube | [Big Buck Bunny en YouTube](https://www.youtube.com/watch?v=aqz-KE-bpKQ) | Reproduce, pausa, salta a otro minuto y prueba pantalla completa. Si aparece una superposición compatible, verifica que se oculta. Si el reproductor muestra un botón visible y habilitado de **Saltar anuncio**, verifica el salto. Si no aparece ese escenario, márcalo como **No observado**. |
| P04 · Navegación legítima | [Wikipedia](https://es.wikipedia.org/wiki/Cookie_(inform%C3%A1tica)) | Abre y despliega el popup con el teclado, sigue dos enlaces y comprueba que el artículo sigue visible y que las métricas corresponden al documento actual. No debe aparecer el aviso de sitio reportado. |
| P05 · Cookies en HTTPS | [HTTPBin, cookies de prueba](https://httpbin.org/cookies) | En un perfil de pruebas, crea `ghostcookie_qa=1` con `Path=/` desde **Aplicación → Cookies** de DevTools. Comprueba que aparece en Ghost Cookie, bórrala individualmente y recarga `/cookies`. La cookie de prueba debe desaparecer. Repite con una cookie particionada de prueba en HTTPS y verifica la columna **Partition Key** de DevTools antes de borrarla. |

## Páginas locales y controles de regresión

El script usa el ZIP descomprimido, un servidor en loopback y un perfil temporal. Construye los escenarios en cada ejecución y dirige los nombres de las pruebas a ese servidor. Para el caso de phishing toma una coincidencia de la lista empaquetada y comprueba que el navegador muestra el aviso de Ghost Cookie antes de que el servidor reciba una petición para ese destino.

| Caso | Página o flujo | Resultado esperado |
| --- | --- | --- |
| L01 · Bloqueo y filtro visual | Portada local `ghostcookie-smoke.test` | Se bloquean las dos solicitudes simuladas de anuncios y rastreo. Se oculta el anuncio de prueba y el contenido principal sigue visible. El popup recoge los rastreadores detectados. |
| L02 · Pausa del sitio | Misma portada | Pausar restaura el anuncio visual sin recargar y deja pasar una solicitud de prueba nueva. Reanudar oculta de nuevo el anuncio. |
| L03 · Reputación | Portada HTTP y destino de la lista simulado en loopback | HTTP aparece como señal informativa. Navegar a una coincidencia de la lista abre el aviso local de phishing, con cero peticiones al destino de prueba. |
| L04 · Cookies | Portada local y `localhost/cookies` | El popup borra una cookie de sesión. En la segunda página distingue cookies `HttpOnly` del mismo nombre por ruta y etiqueta la cookie particionada. Borrar una ruta conserva la otra. El borrado total elimina las cookies de la partición HTTP y conserva una cookie del mismo nombre en la partición HTTPS. |
| L05 · Ajustes globales | Ajustes de Ghost Cookie | Desactivar protección muestra **En pausa global** y deshabilita los cuatro conjuntos de reglas. Reactivarla los restaura. Gemini empieza como integración opcional. |
| L06 · Contador de bloqueos | Portada local y dos páginas de control | Las dos coincidencias siguen en el contador al reconstruir el registro del documento. Una navegación nueva sin coincidencias muestra **0** y la consulta sin permiso temporal muestra **Sin datos**. |
| L07 · Listas y pausas | Ajustes de Ghost Cookie | Las fechas coinciden con los metadatos en el ZIP. Reanudar un dominio deja la otra pausa en vigor. |
| M01 · Aislamiento | Wikipedia y HTTPBin en pestañas distintas | Pausa solo un sitio y confirma que el otro sigue activo. Crea una cookie ficticia en cada sitio de prueba y comprueba que borrarla en uno deja la del otro. Cambia de pestaña y verifica que no se mezclan las métricas. |
| M02 · Actualización | Pausa un sitio en 1.3.0 y actualiza a 1.3.1 en el mismo perfil | Se conservan el ID, la pausa y la preferencia de clasificación de cookies. Para paquetes descomprimidos, reemplaza el contenido en la misma carpeta y pulsa **Recargar**. |
| M03 · Gemini | Wikipedia y **Ajustes → Asistente local de Gemini** | Comprueba permiso sin conceder, asistente conectado sin clave y asistente configurado. Con una clave propia, solicita un análisis y verifica que aparece la respuesta. Quita el permiso y comprueba que el análisis queda deshabilitado. Repite con Chrome y Edge y con el instalador o registro de cada sistema compatible. |

### Ejecutar las pruebas locales

Desde la raíz del proyecto, con Node.js, Python y navegadores que admitan el protocolo de pruebas de extensiones de Chromium. Estos comandos usan los binarios habituales en Linux. Sustituye el nombre del ZIP por la versión que estés evaluando.

```sh
npm test
npm run build
python3 -m zipfile -e dist/ghost-cookie-v1.3.1.zip dist/qa-1.3.1
node tests/browser-smoke.mjs "$(command -v google-chrome)" dist/qa-1.3.1
node tests/browser-smoke.mjs "$(command -v microsoft-edge)" dist/qa-1.3.1
```

Las pruebas de Python verifican el protocolo del asistente, el rechazo de solicitudes de gestión de claves desde el navegador y el uso de la clave en el encabezado hacia el proveedor. En M03 usa una clave de prueba y guarda solo el resultado del análisis o el código de error. Consulta la [guía del asistente](native/README.md).

### Regresión corregida en la 1.3.1

El fallo se reprodujo en el caso L04 con la 1.3.0. La corrección se verificó en Chrome 158 y Edge 157. El script comprueba tanto el borrado de la cookie particionada en `http://localhost` como la conservación de la cookie del mismo nombre en la partición HTTPS.

Registra cada ejecución con **Caso**, **Navegador y versión**, **Resultado** y **Evidencia**. Para un fallo, anota los pasos y el estado de la protección. Para publicidad variable, anota la URL y la solicitud o elemento observado.
