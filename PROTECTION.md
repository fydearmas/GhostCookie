# Ghost Cookie - Guía de Protección de Código

## 🛡️ Medidas de Protección Implementadas

### 1. Marcas de Agua Digitales (Digital Watermarks)

Cada archivo JavaScript contiene:

- **Build ID único**: Identificador de compilación
- **Watermark**: Marca única `GC-[timestamp]`
- **Integrity Hash**: Hash SHA-256 de cada archivo
- **Copyright Header**: Información de derechos de autor

### 2. Ofuscación Ligera

El código puede ser minificado y ofuscado usando Terser:

- Variables renombradas a nombres cortos
- Espacios en blanco eliminados
- Comentarios removidos
- Código comprimido

---

## 📦 Proceso de Build

### Instalación de Dependencias

```bash
cd c:\Users\fydea\Documents\GitHub\plugin_browser
npm install
```

### Paso 1: Añadir Marcas de Agua

```bash
node build.js
```

Esto agregará:

- Headers de copyright a todos los archivos JS
- Marcas de agua inline
- Archivo `build-info.json` con hashes de integridad

### Paso 2: Ofuscar Código (Opcional)

```bash
npm run obfuscate
```

Esto creará versiones minificadas:

- `popup/popup.min.js`
- `background/service-worker.min.js`
- `content/content.min.js`
- `options/options.min.js`

### Paso 3: Actualizar Manifest (si usas versiones minificadas)

Si decides usar las versiones ofuscadas, actualiza `manifest.json`:

```json
{
  "action": {
    "default_popup": "popup/popup.html"
  },
  "background": {
    "service_worker": "background/service-worker.min.js"
  },
  "content_scripts": [
    {
      "js": ["content/content.min.js"]
    }
  ]
}
```

Y actualiza los `<script>` tags en HTML:

- `popup.html`: `<script src="popup.min.js">`
- `options.html`: `<script src="options.min.js">`

---

## 🔍 Verificación de Integridad

### Archivo build-info.json

Después de ejecutar `node build.js`, se genera `build-info.json`:

```json
{
  "version": "1.0.0",
  "buildId": "abc123",
  "watermark": "GC-abc123",
  "timestamp": "2025-12-09T...",
  "integrity": {
    "popup/popup.js": "sha256hash...",
    "background/service-worker.js": "sha256hash..."
  }
}
```

Este archivo te permite:

1. Verificar que nadie modificó tus archivos
2. Rastrear builds específicos
3. Probar autoría del código

---

## 🚨 Detección de Copias No Autorizadas

### Cómo Identificar Copias

1. **Busca tu watermark**: Cada archivo tiene `GC-[buildId]`
2. **Verifica hashes**: Compara con `build-info.json`
3. **Revisa copyright headers**: Deben estar presentes

### Si Encuentras una Copia

1. Documenta la evidencia (screenshots, URLs)
2. Compara watermarks y build IDs
3. Contacta al infractor
4. Si es necesario, reporta a Chrome Web Store

---

## ⚖️ Consideraciones Legales

### Copyright Header

Todos los archivos incluyen:

```javascript
/**
 * Ghost Cookie v1.0.0
 * Copyright (c) 2025 Ghost Cookie Team
 *
 * This code is protected by copyright.
 * Unauthorized use is prohibited.
 */
```

### Licencia

Crea un archivo `LICENSE` con tu licencia preferida:

- **Propietaria**: Todos los derechos reservados
- **MIT**: Código abierto con atribución
- **GPL**: Código abierto con copyleft

---

## 📋 Checklist de Protección

Antes de publicar:

- [ ] Ejecutar `node build.js` para añadir watermarks
- [ ] (Opcional) Ejecutar `npm run obfuscate` para minificar
- [ ] Verificar que `build-info.json` se generó
- [ ] Guardar `build-info.json` en lugar seguro
- [ ] Añadir archivo `LICENSE`
- [ ] Documentar versión y build ID
- [ ] Hacer backup del código fuente original

---

## 🔐 Mejores Prácticas

1. **Nunca publiques el código fuente sin watermarks**
2. **Guarda build-info.json de cada versión**
3. **Usa Git tags para versiones**: `git tag v1.0.0`
4. **Mantén registro de builds**: Fecha, versión, hash
5. **Considera publicar en Chrome Web Store**: Mayor protección

---

## 🛠️ Scripts Disponibles

```bash
# Añadir watermarks
node build.js

# Ofuscar todo el código
npm run obfuscate

# Ofuscar archivos individuales
npm run obfuscate:popup
npm run obfuscate:background
npm run obfuscate:content
npm run obfuscate:options
```

---

## ⚠️ Advertencias

### Limitaciones de la Ofuscación

- **No es encriptación**: El código sigue siendo legible
- **Puede dificultar debugging**: Usa versiones no-ofuscadas para desarrollo
- **Chrome puede rechazar**: Ofuscación excesiva es sospechosa

### Recomendaciones

- **Desarrollo**: Usa código sin ofuscar
- **Testing**: Prueba con código sin ofuscar
- **Producción**: Usa código con watermarks (ofuscación opcional)

---

## 📞 Soporte

Si detectas uso no autorizado de tu código:

1. Documenta la evidencia
2. Verifica watermarks y hashes
3. Contacta al infractor
4. Reporta a las autoridades correspondientes

---

**Recuerda**: La mejor protección es publicar en Chrome Web Store y mantener tu código actualizado con mejoras constantes.
