# Ficha y envío de Ghost Cookie 1.3.1

La actualización se carga en las fichas existentes. Usa `dist/ghost-cookie-v1.3.1.zip` en ambas tiendas y comprueba su suma con `dist/ghost-cookie-v1.3.1-SHA256SUMS.txt`. Verifica que la réplica de `main` ya incluye la política y los avisos de licencia antes de enviar los formularios.

## Identidad y enlaces

| Campo | Valor |
| --- | --- |
| Nombre | Ghost Cookie |
| Idioma de la ficha | Español (`es`) |
| Versión del paquete | `1.3.1` |
| Página del proyecto | `https://github.com/fydearmas/GhostCookie` |
| Soporte | `https://github.com/fydearmas/GhostCookie/issues` |
| Política de privacidad | `https://github.com/fydearmas/GhostCookie/blob/main/PROTECTION.md` |
| Código y licencia del filtro regional | `https://github.com/fydearmas/GhostCookie/tree/main/rules/adguard-es-pt` |

[Chrome Web Store Developer Dashboard de Ghost Cookie](https://chrome.google.com/webstore/devconsole/879ab13b-c40b-44f5-b219-31e9b5bbbade/ndpnnfnhkddkjjjoekljpjiomlppbcmh/edit) · [Microsoft Partner Center de Ghost Cookie](https://partner.microsoft.com/en-us/dashboard/microsoftedge/f2224d70-5d0c-4332-8778-24f21c9ce910/packages/dashboard)

## Texto de la ficha

### Descripción corta del manifiesto

Bloquea anuncios y rastreadores, gestiona cookies y recibe avisos locales de phishing.

### Descripción larga en español

Ghost Cookie reduce la publicidad y el rastreo en Chrome y Microsoft Edge con listas de bloqueo que el navegador aplica en el equipo. Usa EasyList y EasyPrivacy para bloquear solicitudes y ocultar elementos publicitarios. En Ajustes puedes activar el filtro adicional AdGuard Español/Portugués para sitios en español y portugués.

El panel distingue las solicitudes bloqueadas, los rastreadores detectados y los elementos ocultos. También muestra las cookies del sitio y te permite eliminar las que selecciones. Si un sitio falla, puedes pausar el filtrado y recargar solo esa pestaña, y reanudarlo con un clic.

Si una navegación coincide con la lista local de PhishDestroy, Ghost Cookie muestra un aviso de phishing antes de contactar con el destino. La pausa del filtrado por sitio o pestaña conserva esos avisos. Los filtros, la consulta de reputación y las explicaciones del panel se procesan en el navegador. Ajustes muestra la fecha de las listas instaladas.

### Finalidad única para Privacidad

Proteger la privacidad al navegar mediante el bloqueo local de anuncios y rastreadores, la gestión de cookies del sitio activo y avisos de destinos reportados por phishing.

## Chrome Web Store

| Pantalla | Qué revisar o actualizar |
| --- | --- |
| **Package** | Usa **Upload New Package** en la ficha existente y verifica la versión 1.3.1. |
| **Store listing** | Pega la descripción larga en **Spanish – es**, revisa la categoría **Privacy & Security** y comprueba los enlaces. Sustituye cualquier captura del asistente anterior por `settings-es.png` de **1280 × 800**. El icono requerido está en `icons/icon128.png`. La imagen promocional opcional está en `tile-440x280.png`. |
| **Privacy** | Usa la finalidad única y las justificaciones de abajo. La 1.3.1 elimina `nativeMessaging`. Revisa las declaraciones de datos frente a la política actualizada y al acceso local a cookies, actividad y contenido. Indica **No** a código remoto. Comprueba el enlace público de privacidad. |
| **Test instructions** | Pega el texto de certificación de esta guía. Se puede probar en una página pública. |
| **Distribution y envío** | Verifica visibilidad pública y regiones. Pulsa **Submit for review** y elige si se publica al aprobarse o si queda en **Ready to publish**. Tras publicar, abre la ficha pública y comprueba la versión. |

[Actualizar una extensión](https://developer.chrome.com/docs/webstore/update) · [Datos, permisos y privacidad](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/) · [Descripción y materiales gráficos](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)

## Microsoft Edge Add-ons

| Pantalla | Qué revisar o actualizar |
| --- | --- |
| **Extension overview / Packages** | Abre la extensión existente, inicia la actualización y sustituye el ZIP. Comprueba que el manifiesto se reconoce como 1.3.1. |
| **Availability y Properties** | Revisa visibilidad pública, mercados, categoría y enlaces. Conserva la distribución elegida en la ficha. |
| **Privacy** | Actualiza la finalidad y las justificaciones según el manifiesto nuevo. Indica **No** a código remoto. Revisa las casillas de datos y las certificaciones frente al apartado siguiente. Comprueba el enlace público de privacidad. |
| **Store listings → Spanish → Edit details** | Pega la descripción larga. La descripción corta sale del manifiesto. Usa el icono de **128 × 128** como mínimo y sustituye las capturas del asistente por `settings-es.png` de **1280 × 800**. `tile-440x280.png` es opcional. |
| **Notes for certification y Publish** | Pega los pasos de abajo y guarda. **Publish** envía a certificación. Comprueba **In the Store** y la versión que muestra la ficha pública tras aprobarse. |

[Actualizar una extensión en Partner Center](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension) · [Campos de privacidad, ficha y certificación](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)

## Justificaciones de permisos

| Campo del manifiesto | Texto sugerido |
| --- | --- |
| `host_permissions` en HTTP y HTTPS | Aplica filtros visuales a los sitios visitados, evalúa señales de rastreo y permite gestionar las cookies de la pestaña activa. |
| `cookies` | Consulta las cookies aplicables al sitio activo, muestra sus metadatos y elimina las seleccionadas por el usuario, incluidas las particionadas disponibles. |
| `activeTab` | Al pulsar el icono, consulta las coincidencias de bloqueo de la pestaña activa para el panel de actividad. |
| `webNavigation` | Identifica el documento de la pestaña, mantiene las métricas asociadas a la página y termina la pausa de diagnóstico al cambiar de dominio. |
| `storage` | Guarda en el navegador las preferencias y las pausas por dominio. Conserva la actividad de cada documento durante la sesión. |
| `declarativeNetRequest` | Aplica los conjuntos de reglas empaquetados para anuncios, rastreo y phishing, y las excepciones que el usuario activa. |

El panel utiliza localmente la dirección del documento activo, señales de su contenido y actividad de filtrado. El permiso de cookies permite acceder a cookies del sitio, incluidas las de sesión. El panel muestra nombres, dominios, rutas y categorías estimadas. La extensión 1.3.1 no transmite esa información a Franky Solutions ni a los proveedores de listas. En el formulario se debe distinguir el acceso local descrito en la política de cualquier recogida o transferencia externa que pregunte el campo. La desaparición del permiso del asistente no cambia el alcance del permiso de cookies.

Las listas se descargan y compilan en el proceso de desarrollo. El ZIP incluye los datos ya compilados y la fuente del filtro regional para que se pueda reproducir. El navegador carga los conjuntos empaquetados. Revisa las certificaciones de uso limitado en ambas tiendas con la [política de la versión](../../PROTECTION.md) visible antes de enviar.

## Texto para certificación

Ghost Cookie 1.3.1 incorpora un filtro regional opcional de AdGuard para sitios en español y portugués. También añade diagnóstico por pestaña y explicaciones locales de los bloqueos y la reputación. Esta versión retiró el asistente anterior y su permiso de mensajería nativa. Se puede probar con sitios públicos y con cookies de un perfil de pruebas, sin credenciales.

1. Entra en cualquier página HTTP o HTTPS y abre Ghost Cookie desde la barra de extensiones. Comprueba el dominio, el estado, la reputación y las métricas de la página.
2. Abre **Ajustes → Protección**. Comprueba que **Filtro adicional para sitios en español y portugués** empieza desactivado en un perfil nuevo. Actívalo, verifica la fecha de AdGuard en **Listas instaladas** y vuelve a desactivarlo para comprobar el control. Recarga la página para volver a medir las peticiones de red.
3. En el panel, abre **Este sitio no funciona** y pulsa **Pausar y recargar**. Vuelve a abrir el panel y verifica **En pausa en esta pestaña**. Pulsa **Reanudar y recargar**.
4. Abre **Cookies** en un sitio con una cookie de prueba y elimina la cookie seleccionada. Confirma que desaparece del panel.
5. Para pruebas reproducibles de bloqueo, reversión de filtros, cookies particionadas y phishing simulado en loopback, consulta la [matriz de pruebas de Ghost Cookie](https://github.com/fydearmas/GhostCookie/blob/main/TEST_PAGES.md).
