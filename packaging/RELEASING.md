# Publicar Ghost Cookie

El código original de Ghost Cookie está bajo [MIT](../LICENSE). La extensión distribuye adaptaciones de EasyList y EasyPrivacy con [sus propios avisos](../rules/THIRD_PARTY_NOTICES.md) y conserva la atribución de PhishDestroy. Los instaladores incluyen el aviso de los componentes de ejecución que empaquetan.

## Identificadores y compilación

El borrador de Chrome Web Store tiene el ID **ndpnnfnhkddkjjjoekljpjiomlppbcmh**. El ID de Microsoft Edge se obtiene después de completar la inscripción y crear la ficha en Partner Center.

1. Ejecuta **npm run build** para generar el ZIP de la extensión. Cárgalo como borrador de Ghost Cookie en Chrome Web Store y Microsoft Partner Center. Si ya existe una ficha, usa su ID. En Microsoft, utiliza el ID de la extensión que usa el navegador. El identificador de producto de Partner Center es un dato diferente.
2. Configura las variables **GHOSTCOOKIE_CHROME_STORE_ID** y **GHOSTCOOKIE_EDGE_STORE_ID** en GitHub. Los IDs son públicos. Las compilaciones firmadas se realizan desde **main** mediante el flujo **Ghost Cookie desktop packages**, con **signed** activado.
3. Descarga los artefactos resultantes y verifica la firma de Windows y la notarización de macOS antes de adjuntar los instaladores a GitHub Releases. Conserva las sumas SHA‑256 y el ZIP de código fuente para instalaciones manuales.
4. Prueba Chrome y Edge en Windows y macOS con los paquetes instalados. Comprueba el inicio por primera vez, el guardado y borrado de la clave en el llavero, la autorización de la extensión, un análisis con una clave de prueba y la desinstalación. Registra las versiones y arquitecturas probadas.
5. Abre las fichas de las tiendas, verifica que las URLs de privacidad, soporte e instaladores sean públicas y completa la información de [la ficha](store/LISTING.md). Presenta a revisión la versión aprobada. La revisión y el momento de publicación dependen de cada tienda.

[Ventana de publicación de Chrome](https://chrome.google.com/webstore/devconsole) · [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview)

## Material de firma

El flujo de GitHub usa el entorno **desktop-signing**. Configura allí los siguientes valores. Las claves privadas, contraseñas y archivos de firma se agregan como secretos en ese entorno o se aprovisionan en un servicio de firma de la organización.

| Plataforma | Variables | Secretos |
| --- | --- | --- |
| Windows | **WINDOWS_SIGNING_THUMBPRINT** | **WINDOWS_SIGNING_PFX_BASE64**, **WINDOWS_SIGNING_PFX_PASSWORD** |
| macOS | **MACOS_APPLICATION_IDENTITY**, **MACOS_INSTALLER_IDENTITY**, **MACOS_NOTARY_KEY_ID**, **MACOS_NOTARY_ISSUER** | **MACOS_SIGNING_P12_BASE64**, **MACOS_SIGNING_P12_PASSWORD**, **MACOS_NOTARY_API_KEY_BASE64** |

El PKCS#12 de macOS debe incluir **Developer ID Application** y **Developer ID Installer**. El perfil de notarización usa una clave de equipo de App Store Connect. Si la firma de Windows se realiza mediante un servicio compatible con SignTool, usa la alternativa descrita en la guía de Windows. El flujo se ejecuta sin firma en ramas **codex/release-***. Las compilaciones de prueba generan paquetes etiquetados como **unsigned** con IDs de prueba cuando faltan los oficiales.

[Compilar para Windows](windows/README.md) · [Compilar para macOS](macos/README.md)
