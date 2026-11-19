# Asistente local de Ghost Cookie

La IA es opcional y usa la clave y cuota de la cuenta Gemini de cada usuario. El asistente guarda la clave en el llavero de la cuenta del sistema operativo. El navegador recibe un estado de conexión y el texto del análisis. Los bloqueos, las cookies y las comprobaciones de reputación funcionan con la extensión sola.

## Asistente gráfico para Chrome y Edge

Con el instalador de Windows o macOS, abre **Asistente de Ghost Cookie** desde tu sesión. La aplicación registra el asistente para Chrome y Edge con los identificadores oficiales incluidos en la compilación. Pega tu clave en el campo oculto y pulsa **Guardar clave**. Abre los ajustes de la extensión y activa el asistente. El campo permite sustituir la credencial y el botón **Quitar clave** la elimina del llavero.

El mismo ejecutable que lee el llavero para responder a Chrome o Edge también escribe la credencial desde la aplicación gráfica. macOS usa el ítem de Keychain del usuario y Windows usa el Administrador de credenciales. La primera ejecución registra el asistente con los permisos de la sesión del usuario. Al quitar la aplicación puedes optar por borrar la clave desde la aplicación antes de desinstalar.

## Instalar desde una terminal

Para Linux o una copia de desarrollo necesitas Python 3.10 o posterior, Chrome o Microsoft Edge de escritorio y un llavero del sistema disponible. En Linux, el escritorio debe ofrecer Secret Service en la sesión del usuario, como GNOME Keyring. La instalación se ejecuta con tu usuario habitual. Conserva el entorno de Python instalado mientras uses el asistente.

Carga la extensión de Ghost Cookie y copia su identificador de 32 letras desde `chrome://extensions/` o `edge://extensions/`. Abre una terminal en la carpeta `native` del paquete. Sustituye `ID_DE_GHOST_COOKIE` por el identificador que copiaste. Añade `--browser edge` a `install` para registrarlo en Edge. Puedes ejecutar `install` una vez por navegador con el ID correspondiente.

**Linux y macOS**

```sh
python3 -m venv "$HOME/.ghostcookie-python"
"$HOME/.ghostcookie-python/bin/python" -m pip install -r requirements.txt
"$HOME/.ghostcookie-python/bin/python" -I assistant.py install ID_DE_GHOST_COOKIE
"$HOME/.ghostcookie-python/bin/python" -I assistant.py set-key
```

**Windows (PowerShell)**

```powershell
py -3 -m venv "$HOME\.ghostcookie-python"
& "$HOME\.ghostcookie-python\Scripts\python.exe" -m pip install -r requirements.txt
& "$HOME\.ghostcookie-python\Scripts\python.exe" -I assistant.py install ID_DE_GHOST_COOKIE
& "$HOME\.ghostcookie-python\Scripts\python.exe" -I assistant.py set-key
```

Pega tu clave de [Google AI Studio](https://aistudio.google.com/api-keys) cuando la terminal muestre `Clave de Gemini`. La entrada queda oculta. Abre los ajustes de Ghost Cookie para comprobar la conexión y luego pulsa **Analizar sitio** en el popup. La comprobación de conexión verifica el llavero. La primera llamada al proveedor ocurre al solicitar un análisis.

Si usas Chromium o Chrome for Testing, añade `--browser chromium` o `--browser chrome-for-testing` al comando `install`. Para usar un directorio de datos personalizado en Linux o macOS, añade `--browser-user-data-dir RUTA`. Una copia descomprimida de la extensión puede cambiar de ID si la mueves de carpeta. Registra el nuevo ID si el navegador muestra uno diferente. El registro desde la terminal conserva un ID por navegador y cuenta del sistema.

## Datos enviados y mantenimiento

Al solicitar un análisis, el asistente envía a la API de Gemini tres recuentos, el resultado de reputación y los códigos de las señales observadas. Los dominios, las URLs completas, las cookies individuales y el contenido de la página se quedan en el navegador. El asistente se conecta directamente a Gemini por HTTPS. La clave se usa en el encabezado de autenticación de esa conexión.

Para cambiar la clave, ejecuta `set-key` de nuevo. Para cambiar el modelo, repite `install ID_DE_GHOST_COOKIE --model MODELO`. Esta versión usa `gemini-3.6-flash` por defecto. Ejecuta `status` para ver si hay una clave guardada. Si compartes el equipo y quieres credenciales separadas, usa una cuenta del sistema operativo por persona.

Para retirar el asistente, ejecuta `remove-key` y luego `uninstall`, usando las mismas opciones de navegador o directorio que usaste al instalar. `remove-key` borra la credencial del llavero. `uninstall` elimina el registro que usa Chrome.

[Native Messaging de Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) · [Native Messaging de Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging) · [Modelo Gemini 3.6 Flash](https://aistudio.google.com/docs/models/gemini-3.6-flash) · [Seguridad de API keys de Gemini](https://aistudio.google.com/docs/api-key#security)
