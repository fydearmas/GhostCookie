# Avisos de redistribución del asistente

El empaquetado incorpora los textos de estas fuentes en el archivo de avisos que acompaña al binario.

- [CPython 3.12](https://github.com/python/cpython/blob/3.12/LICENSE). Se usa como respaldo si la distribución de Python no trae el texto de licencia en su carpeta.
- [Tcl 8.6](https://github.com/tcltk/tcl/blob/core-8-6-branch/license.terms) y [Tk 8.6](https://github.com/tcltk/tk/blob/core-8-6-branch/license.terms). Aplican al kit de la interfaz.
- [OpenSSL 3](https://github.com/openssl/openssl/blob/openssl-3.0.16/LICENSE.txt) y [libffi 3](https://github.com/libffi/libffi/blob/v3.4.8/LICENSE). Se incluyen con las bibliotecas nativas del runtime.
- [Inno Setup](https://jrsoftware.org/files/is/license.txt). Se incorpora al aviso de Windows.

Los avisos de Keyring, PyInstaller y sus dependencias se extraen de los metadatos de los paquetes instalados durante la compilación.
