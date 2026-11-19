# Asistente de Ghost Cookie para macOS

Genera un instalador para Apple Silicon en un equipo arm64 y otro para Intel en un equipo x86_64. Cada paquete contiene la aplicación gráfica, el proceso de mensajería nativa y su entorno de ejecución. Se instala en **Aplicaciones → Ghost Cookie Assistant**.

Al abrir el asistente, el usuario configura su propia clave de Gemini. La aplicación registra los dos IDs oficiales en los perfiles de usuario de Chrome y Edge. Los registros se escriben en nombre del usuario que abre la aplicación. Para usar el asistente, abre los ajustes de la extensión, autorízalo y pulsa **Comprobar**. [Mensajería nativa de Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) · [Mensajería nativa de Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging)

## Compilar en macOS

Usa Python 3 con Tkinter y con la misma arquitectura del equipo de compilación. Instala las herramientas de línea de comandos de Xcode. Desde la raíz del repositorio, instala las dependencias en un entorno virtual de compilación.

~~~sh
python3 -m venv .venv-macos
. .venv-macos/bin/activate
python -m pip install -r native/requirements.txt -r packaging/macos/build-requirements.txt
~~~

Prepara un archivo JSON llamado **official-extension-ids.json** con los campos **chrome** y **edge** y los IDs que muestran las tiendas. Cada valor debe tener 32 letras entre **a** y **p**. Usa los IDs definitivos de las fichas de Chrome Web Store y Edge Add-ons para una compilación de distribución. El archivo contiene identificadores públicos y queda integrado en el instalador. [Identidad de una extensión de Chrome](https://developer.chrome.com/docs/extensions/reference/manifest/key) · [IDs de ambas tiendas en Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging#extension-ids-required-for-both-stores)

### Compilación firmada para distribuir

El llavero de compilación debe contener las identidades **Developer ID Application** y **Developer ID Installer** con sus claves privadas. Configura las variables **MACOS_APPLICATION_IDENTITY** y **MACOS_INSTALLER_IDENTITY** con los nombres completos. Define **MACOS_NOTARY_PROFILE** con un perfil de `notarytool` ya configurado. Si el perfil está en un llavero específico, indica su ubicación mediante **MACOS_NOTARY_KEYCHAIN**. [Notarización de Apple](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)

~~~sh
PYTHON=python bash packaging/macos/build.sh /ruta/official-extension-ids.json
~~~

El script comprueba las firmas y la arquitectura de la aplicación, firma el paquete, espera la respuesta de Apple y valida el ticket de notarización adjunto antes de copiarlo a **dist/**. Los archivos tienen los nombres **ghost-cookie-assistant-vVERSION-macos-arm64.pkg** y **ghost-cookie-assistant-vVERSION-macos-x86_64.pkg**.

### Compilación local de prueba

~~~sh
PYTHON=python bash packaging/macos/build.sh --unsigned /ruta/official-extension-ids.json
~~~

El nombre termina en **-unsigned.pkg**. Esta variante usa firma ad hoc en la aplicación y está destinada al equipo de compilación.

## Verificar e instalar

Comprueba el paquete de distribución y su ticket antes de probarlo en un equipo limpio de la arquitectura correspondiente.

~~~sh
pkgutil --check-signature /ruta/al/instalador.pkg
xcrun stapler validate /ruta/al/instalador.pkg
spctl --assess --type install --verbose=2 /ruta/al/instalador.pkg
~~~

Tras instalar, verifica la conexión y ejecuta un análisis desde ambas extensiones. Para retirar el asistente, elimina primero la clave desde su ventana y borra los registros del usuario con este comando. Luego mueve la aplicación a la papelera.

~~~sh
"/Applications/Ghost Cookie Assistant.app/Contents/MacOS/ghostcookie-host" unregister-published
~~~
