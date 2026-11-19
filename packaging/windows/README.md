# Instalador de Ghost Cookie para Windows

El paquete instala el asistente y su motor local para la cuenta de Windows actual. Incluye el entorno de ejecución y crea una entrada en el menú Inicio. El asistente registra los IDs oficiales de Chrome y Edge cuando se abre y guarda la clave de Gemini en el Administrador de credenciales de Windows. Para retirar también la credencial al desinstalar, usa **Quitar clave** en la aplicación antes de iniciar la desinstalación.

## Compilar

Usa Windows x64, PowerShell 7.2 o posterior, Python 3.12 x64 con Tcl/Tk e Inno Setup 6.3 o posterior. Para firmar también hacen falta SignTool del SDK de Windows y una identidad Authenticode de la organización. Ejecuta estos comandos desde la raíz del repositorio.

~~~powershell
python -m pip install -r packaging/windows/requirements-build.txt

pwsh -NoProfile -NonInteractive -File packaging/windows/build.ps1 `
  -ChromeExtensionId $env:GHOSTCOOKIE_CHROME_STORE_ID `
  -EdgeExtensionId $env:GHOSTCOOKIE_EDGE_STORE_ID `
  -CertificateThumbprint $env:GHOSTCOOKIE_WINDOWS_SIGNING_THUMBPRINT
~~~

El certificado tiene que estar disponible en **CurrentUser\My** para la cuenta que ejecuta la compilación. La clave de firma se aprovisiona en la infraestructura de la organización. También se puede usar un servicio compatible con SignTool usando **-SigningDll RUTA_DLL -SigningMetadata RUTA_JSON** en lugar de **-CertificateThumbprint**. En ese caso configura la autenticación del servicio en el entorno de compilación. Los IDs de las tiendas se incorporan a ambos ejecutables.

El instalador y su archivo de suma SHA-256 aparecen en **dist/installers/**. El modo de publicación verifica la firma y el sello de tiempo de ambos ejecutables y del instalador. Inno Setup firma el desinstalador con la misma configuración. Para una compilación interna, pasa **-UnsignedDevelopment** junto a los IDs de prueba. El nombre resultante termina en **-unsigned-dev.exe**.

## Validar antes de distribuir

En una cuenta de Windows limpia, comprueba la firma, instala el paquete, abre el asistente y verifica la conexión desde la extensión en Chrome y Edge. Comprueba que ambos navegadores puedan obtener el estado del asistente. Ejecuta el desinstalador y comprueba que se retiren los registros de mensajería del asistente para esa cuenta.

~~~powershell
$installer = Get-ChildItem dist/installers/ghost-cookie-assistant-windows-x64-v*.exe |
  Where-Object Name -NotLike '*-unsigned-dev.exe' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
Get-AuthenticodeSignature -LiteralPath $installer.FullName | Format-List Status, SignerCertificate, TimeStamperCertificate
Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256
~~~

El objetivo de compilación es x64. La compatibilidad con Windows 11 en ARM64 se habilita mediante la emulación x64 del sistema y requiere una prueba específica antes de anunciarse. Consulta [Inno Setup](https://jrsoftware.org/inno-setup/) y [las opciones de firma de Windows](https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options).
