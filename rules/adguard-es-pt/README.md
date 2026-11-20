# AdGuard Español/Portugués

Ghost Cookie adapta el filtro Español/Portugués, desarrollado por AdGuard y sus colaboradores. El conjunto regional se publica bajo [GPL-3.0](LICENSE.txt). El [repositorio de AdGuard](https://github.com/AdguardTeam/AdguardFilters) incluye las fuentes originales y la información de autoría.

`source.txt` es la copia del filtro Chromium de AdGuard que alimenta esta compilación. Ghost Cookie normaliza los saltos de línea y los espacios al final de cada línea. `source.json` registra la URL oficial, la versión, la fecha, la licencia y el SHA-256 del texto normalizado. El ZIP incluye ambos archivos, la licencia y los scripts que generan los datos de filtrado.

`network.json` traduce el subconjunto de bloqueos y excepciones admitidos a reglas declarativas de Chromium. `cosmetic.json` contiene selectores CSS acotados a dominios y sus excepciones. El compilador descarta las directivas propias de AdGuard y las reglas que requieren ejecutar código de la lista. En Ghost Cookie, los datos regionales se activan desde **Ajustes → Protección**.

Para regenerar la revisión incluida, ejecuta estos comandos desde la raíz del repositorio o del ZIP descomprimido con Node.js 20 o posterior.

```sh
node scripts/compile-regional.mjs
node scripts/compile-regional.mjs --check
```
