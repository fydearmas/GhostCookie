# EasyList y EasyPrivacy

Las reglas de red de `easylist.json` y `easyprivacy.json` y los selectores de
`cosmetic-selectors.js` son adaptaciones de **The EasyList authors**
([easylist.to](https://easylist.to/)). Estos tres archivos se redistribuyen bajo
[Creative Commons Attribution-ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-sa/3.0/).
El [aviso de licencia de EasyList](https://easylist.to/pages/licence.html)
permite elegir esa licencia para las adaptaciones.

La revisión y el SHA-256 del archivo fuente están en `easylist.lock.json`.
El [árbol de origen en GitHub](https://github.com/easylist/easylist/tree/7d321d4a41d4315284d4f8d73ae1f7a7fa515224)
incluye las reglas originales y las plantillas.

## Compilación y cobertura

`scripts/compile-filters.mjs` verifica el SHA-256 del archivo antes de extraer
sus plantillas y compila las tres adaptaciones de forma determinista. Descarga
el archivo indicado en `easylist.lock.json` y ejecuta el comando desde la raíz
del repositorio con Node.js 20 o superior y `tar`.

```sh
node scripts/compile-filters.mjs /ruta/al/easylist.tar.gz
node scripts/compile-filters.mjs --check /ruta/al/easylist.tar.gz
```

Las reglas de red incluyen condiciones por dominio y ruta, tipos de recurso,
contexto de primera o tercera parte y excepciones con opciones compatibles.
Los bloqueos de dominios completos sin contexto explícito se limitan a tercera
parte. Las reglas ordinarias se aplican a subrecursos para evitar bloquear
navegaciones. Las excepciones de compatibilidad preceden a los bloqueos.

La compilación omite sintaxis sin traducción segura en este subconjunto,
incluidas expresiones regulares, redirecciones, opciones para otras
extensiones y patrones sin un dominio de destino anclado. Los selectores
empaquetados son filtros visuales acotados de clases e identificadores, con
dos selectores por atributo de AdSense. Se respetan las excepciones admitidas
por dominio. El archivo generado contiene datos de selección y se empaqueta
sin instrucciones ejecutables de la lista original.

Para actualizar, revisa el nuevo commit de origen, calcula el SHA-256 de su
archivo, ajusta el archivo de bloqueo y el enlace de atribución, regenera los
archivos y comprueba cobertura y compatibilidad en Chrome antes de publicar.
La extensión usa las reglas empaquetadas, con actualizaciones junto a cada
lanzamiento.
