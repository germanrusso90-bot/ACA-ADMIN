# ACA Recuperos

Aplicación web para calcular y conservar recuperos económicos por estación ACA.

Producción: <https://aca-admin.web.app/> (Firebase Hosting).

## Continuar desde ChatGPT/Codex de escritorio

1. Abrir la carpeta raíz de este repositorio.
2. Pedir que lea `AGENTS.md` antes de modificar nada.
3. Trabajar sobre los módulos de `revision/`, no directamente sobre el HTML publicado.
4. Ejecutar `python3 assemble.py` para generar la candidata.
5. Validar antes de copiar `revision/index.html` a `index.html` y publicar.

## Archivos necesarios

- `AGENTS.md`: contexto, decisiones, seguridad, pruebas e historial.
- `revision/`: módulos fuente, candidata ensamblada y pruebas.
- `assemble.py`: ensambla los módulos y genera los archivos derivados.
- `index.html`: versión publicada. Se sube con `npx --prefix revision firebase deploy --only hosting --project aca-admin`, que publica solo `index.html` y `vendor/`.
- `firebase.json`: Firebase Hosting con cabeceras de seguridad (CSP, HSTS, `nosniff`, etc.).
- `vendor/`: pdf.js y SheetJS alojados junto a la app.
- `respaldo/respaldo-aca.html`: ya no funciona con las reglas actuales (lee sin sesión). El respaldo se hace con la sesión de Firebase CLI del propietario, fuera del repositorio.
- `formularios/`: formulario específico de condiciones económicas.
- `firestore.rules`: reglas activas/propuestas de Firestore.
- `acceso-google.html`: verificación aislada del ingreso con Google.

## Validación habitual

```bash
python3 assemble.py
node --check check.js
node formularios/check.cjs
cd revision
npm ci
npm test
npm run test:rules
```

Los respaldos reales, facturas, comprobantes, UID y credenciales no pertenecen al repositorio. La regresión con datos reales se ejecuta únicamente sobre una copia privada autorizada.
