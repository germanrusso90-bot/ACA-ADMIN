# AGENTS.md - Recuperos ACA

## Objetivo del proyecto

Aplicación web para calcular, documentar y conservar recuperos económicos por estación ACA. Debe soportar condiciones particulares por CR, archivos adjuntos, historial, liquidaciones YER y acceso con Google.

Sitio actual: `https://germanrusso90-bot.github.io/ACA-ADMIN/`

Backend: Firebase proyecto `aca-admin` (Authentication + Cloud Firestore).

Administrador inicial: configurado manualmente en Firebase. No guardar su correo ni UID dentro del repositorio.

## Principios no negociables

1. No borrar, migrar ni reemplazar datos históricos automáticamente.
2. Antes de modificar producción, conservar el respaldo completo aportado por el titular.
3. No subir respaldos, facturas, credenciales, UID, tokens ni datos privados a GitHub.
4. No desplegar reglas y HTML incompatibles por separado.
5. Toda estación solo puede leer y escribir documentos de su CR.
6. Las condiciones económicas deben versionarse. Una nueva condición no recalcula registros anteriores.
7. Cada registro calculado guarda una copia de la condición aplicada y del importe resultante.
8. Ante conflicto entre sesiones, bloquear la sobrescritura y pedir conciliación.
9. El borrado físico está prohibido; usar archivado lógico o una versión correctiva.
10. No inventar porcentajes, litros, bases ni impuestos. Si falta información, dejar pendiente y preguntar.

## Estaciones relevantes

| Estación | CR | Tratamiento |
|---|---:|---|
| Cipolletti | 3531 | Sus datos históricos y adjuntos son válidos y deben conservarse. |
| Colonia 25 de Mayo | 3611 | Solo YER histórico es válido. Los demás datos antiguos fueron pruebas y no deben usarse, copiarse ni borrarse. Las operaciones no YER nuevas usan un espacio separado. |

## Datos confirmados de Cipolletti

- Full: 12% sobre facturación menos cigarrillos.
- Canon: 400 litros de Nafta Súper más IVA 21%.
- YER por porcentaje de venta, sin descontar IVA ni otros conceptos:
  - Infinia Diesel: 6,83%.
  - Súper: 9,01%.
  - Infinia: 9,89%.
  - Diesel 500: 6,12%.
- Hotel histórico admite factura y nota de crédito separada. No recalcular cargas existentes.
- Los recuperos de servicios y sus adjuntos están incluidos en el respaldo y deben permanecer accesibles.

## Colonia 25 de Mayo: confirmado

- Responsable y Gmail fueron informados por fuera del repositorio. No publicarlos. El correo por sí solo no habilita acceso; la persona debe ingresar con Google y ser aprobada por el administrador.
- Full: 6% sobre facturación menos cigarrillos.
- Agua: no se recupera y debe quedar desactivada.
- YER: una única modalidad para los cuatro productos, actualmente porcentaje de venta:
  - Infinia Diesel: 6,34%.
  - Súper: 9,85%.
  - Infinia: 10,62%.
  - Diesel 500: 5,72%.
- Hotel: reciben factura desde Buenos Aires y efectúan el cobro mediante código 23. Falta definir la base exacta y el tratamiento de notas de crédito.
- Comisión de tarjetas: existe como recupero propio mediante factura mensual desde Buenos Aires. Falta confirmar la base exacta.

## Colonia 25 de Mayo: no cargar hasta aclarar

1. Energía quedó desmarcada, pero la observación indica que se cobra al concesionario.
2. Energía selecciona “total menos IVA menos percepciones”, pero la observación dice “incluyendo percepciones”. Confirmar la fórmula exacta.
3. Teléfono indica “total de factura menos IVA”, pero también contiene el valor 27. Confirmar si es 100% menos IVA o 27% de una base.
4. Teléfono menciona dos líneas. Deben poder cargarse separadamente si tienen facturas, cuentas o cálculos distintos.
5. Canon usa precio de Nafta Súper e IVA 21%, pero falta la cantidad de litros.
6. Hotel: confirmar si se recupera factura completa, si se descuenta IVA, si existen notas de crédito y si además hay porcentaje de facturación.
7. Comisión de tarjetas: confirmar si se recupera factura completa, neto de IVA u otra base.
8. El PDF impreso recorta observaciones y no es importable. Solicitar el JSON descargado por el formulario o transcribir solo después de resolver las contradicciones.

## Fórmulas soportadas

### Full

`(facturación - cigarrillos) × porcentaje`

Los cigarrillos siempre se descuentan.

### YER

- Porcentaje: `importe de venta × porcentaje / 100`, sin deducciones.
- Pesos por litro: `litros × comisión fija`.
- En el formulario de Colonia, la modalidad es única para los cuatro productos, aunque cada producto mantiene su valor.

### Recuperos configurables

- Porcentaje de una base.
- Importe de factura.
- Factura más porcentaje, sobre bases descriptas para evitar duplicación.
- Litros pactados por precio de combustible.
- Importe total menos IVA menos percepciones.
- Deducciones opcionales de IVA, percepciones e intereses en modalidades compatibles.
- IVA adicional configurable cuando corresponda.

### Hotel

- Factura, porcentaje o combinación.
- Nota de crédito opcional con número, fecha y adjunto independiente.
- Rechazar una nota de crédito superior al recupero calculado.

## Acceso y seguridad

- Inicio de sesión mediante Google y correo verificado.
- `admins/{uid}` con `enabled: true` habilita administración.
- `access/{uid}` vincula una cuenta con un único CR y puede revocarse sin borrar datos.
- Nuevas personas crean una solicitud en `accessRequests/{uid}` y esperan aprobación.
- El administrador puede gestionar accesos y condiciones, pero no obtiene lectura general de las operaciones de todas las estaciones.
- Un administrador solo entra a “Mi estación” si también posee un documento `access` válido.
- Las reglas deben denegar: acceso anónimo, correo no verificado, cuenta pendiente/revocada, lectura cruzada entre CR, listado general de `kv`, autoaprobación y borrado físico.

## Persistencia y claves

- Colección principal histórica: `kv`.
- Las claves se prefijan por CR.
- YER de Colonia mantiene sus claves originales.
- Las operaciones no YER nuevas de Colonia usan `cr3611:operativo-v2:*` para no leer los datos de prueba antiguos.
- Cipolletti conserva compatibilidad con claves heredadas.
- Hasta v4.3.8, los valores grandes se fragmentaban (`--chunk--`) y se verificaban con SHA-256. Esos documentos se siguen leyendo igual y no se migran.
- Desde v4.3.9 (`revision/storage.js`, escrituras nuevas):
  - los valores de 64 KB o más se guardan comprimidos con gzip como `Bytes` dentro del mismo documento (`enc`, `z`, `bytes`, `sha256`);
  - el contenido de los adjuntos (`dataUrl`) va a un blob por estación (`crXXXX--blob--<sha256>` y sus `--part--N`), comprimido cuando conviene. El documento del adjunto guarda nombre, tipo y la huella (`blob`). El mismo archivo se guarda una sola vez, y una subida cortada se completa con el mismo nombre al reintentar;
  - todas las escrituras llevan `fmt: 2`. Las reglas no dejan que una versión anterior sobrescriba un documento comprimido, porque lo leería como vacío.
- Copia previa: una por documento y por día. La primera modificación del día conserva cómo había quedado antes; los cambios del mismo día no generan copias nuevas. Las referencias a archivos y a fragmentos siempre conservan copia.
- Las colas antiguas de sincronización no deben reproducirse automáticamente en Colonia.

## Archivos y estructura de trabajo

- `index.html`: copia publicada por GitHub Pages.
- `revision/index.html`: candidata ensamblada. Después de validar, copiarla a la raíz para publicar.
- `revision/storage.js`: persistencia, fragmentación, integridad, conflictos y respaldo previo.
- `revision/economic.js`: condiciones, fórmulas, formulario e historial económico.
- `revision/yer-rates.js`: lógica de comisiones YER.
- `revision/access.js`: Google, solicitudes, aprobación y panel administrador.
- `revision/firestore.rules`: reglas propuestas/probadas.
- `formularios/formulario-colonia.html`: formulario independiente para Colonia.
- `assemble.py`: ensambla los módulos anteriores dentro de `revision/index.html` y regenera el formulario genérico.
- `revision/pruebas.cjs`: pruebas funcionales con DOM simulado.
- `revision/pruebas-reglas.cjs`: pruebas de reglas con Firestore Emulator.
- La regresión contra el respaldo real se conserva en el entorno privado de auditoría, sin publicar el respaldo en GitHub.
- `respaldo/respaldo-aca.html`: respaldo de lectura de `kv` con doble lectura y verificación.
- `vendor/`: pdf.js (build legacy) y SheetJS alojados junto a la app, en carpetas con la versión en el nombre. Se cargan a demanda desde `revision/index.html` (`loadPdfjs`, `loadXLSX`); para actualizarlos, agregar la carpeta nueva y cambiar la ruta.

El archivo original subido por el usuario debe permanecer sin modificaciones en `upload/index.html`.

## Flujo obligatorio para modificar código

1. Inspeccionar el estado actual y preservar cambios ajenos.
2. Editar los módulos fuente, no solamente el HTML ensamblado.
3. Ejecutar `python3 assemble.py` desde la raíz.
4. Si cambia el formulario de Colonia, regenerarlo y verificarlo.
5. Ejecutar comprobación de sintaxis.
6. Ejecutar las pruebas funcionales.
7. Ejecutar las pruebas de reglas si se cambia autenticación, permisos o estructura de claves.
8. Ejecutar la regresión con respaldo si se cambia carga, lectura, períodos, fórmulas o migración.
9. Revisar visualmente formularios y pantallas modificadas.
10. Publicar únicamente después de verificar el respaldo y coordinar el cambio.
11. Antes de finalizar, actualizar el historial de este `AGENTS.md` con la fecha, el cambio realizado, los archivos afectados, las pruebas ejecutadas y si llegó o no a producción.

## Comandos de validación

Desde la raíz del proyecto:

```bash
python3 assemble.py
node --check check.js
node formularios/check.cjs
```

Desde `revision/`:

```bash
npm ci
npm test
npm run test:rules
```

Las pruebas de reglas deben usar únicamente el proyecto ficticio y emulador local configurados. Nunca apuntar una prueba destructiva a `aca-admin`.
La regresión con datos reales se ejecuta solamente cuando el respaldo privado está disponible fuera del repositorio.

## Estado de pruebas conocido

- 46 pruebas funcionales aprobadas en la candidata v4.3.9.
- 27 pruebas de reglas aprobadas en Firestore Emulator.
- Regresión de v4.3.9 contra el mismo respaldo: 19/19 pantallas iguales a las de v4.3.8, adjuntos abiertos sin fallas y ninguna escritura al recorrerla.
- Regresión de v4.3.8 contra el respaldo del 27/10/2026, cargado solo en el emulador local:
  - 19/19 pantallas iguales a las de v4.3.7;
  - adjuntos abiertos sin fallas;
  - 26 PDF con el mismo resultado de `parseHotelPDF`, `parseCheckPDF` y la búsqueda de totales;
  - 10 Excel con las mismas celdas y los mismos resultados de `processVentasExcel`, `processEverilioExcel` y `parseVentas`;
  - 9 JPEG iguales.
- Las 10 regresiones privadas anteriores (última corrida: v4.3.7) no están en este equipo.
- El respaldo del 27/10/2026 contiene 558 documentos (unos 230 MB):
  - Cipolletti: 306 (64 datos, 142 fragmentos y 100 copias previas);
  - Colonia: 250 (16 datos, 177 fragmentos y 57 copias previas);
  - otros CR: 2.

Actualizar estos números cuando se agreguen pruebas. No conservar cifras obsoletas.

## Despliegue

- Hosting actual: GitHub Pages. Vercel no es necesario en esta etapa.
- No reemplazar producción sin respaldo y prueba de ingreso Google.
- Si cambian reglas y cliente, coordinar el orden para evitar una ventana incompatible.
- Después de publicar: forzar recarga, ingresar con Google, abrir Cipolletti, revisar recuperos históricos, abrir adjuntos y realizar una carga controlada.
- Colonia no se activa hasta resolver sus condiciones ambiguas, importar una configuración revisada y aprobar su cuenta Google.

## Fuera de alcance actual

- Estadísticas y tableros consolidados.
- Restauración automática del respaldo.
- Correos y notificaciones automáticas.
- Procesamiento servidor de archivos grandes.
- Migración a Vercel u otro backend.

## Criterios para futuras ampliaciones

- Si aparece un impuesto, descuento, tope o fórmula nueva, agregarlo como modalidad explícita con pruebas; no esconderlo en una observación.
- Si un servicio tiene varios medidores o líneas, modelar un concepto por cada uno.
- Si una corrección afecta un período cerrado, crear una versión o registro rectificativo con trazabilidad.
- No deducir condiciones contractuales a partir de un importe histórico aislado.
- Mantener Cancelaciones y Checks comunes a todas las estaciones, pero probar con archivos reales antes de certificar cambios.

## Historial de cambios

### 2026-09-29

- Se incorporó la obligación de documentar en este archivo todos los cambios, validaciones y despliegues del proyecto.
- Se diagnosticó un error de recuperación de adjuntos de Full: la carga actual guarda comprobantes con una clave basada en el período de pantalla (`file:AAAA-MM:full.comprobanteTransferencia`), mientras que la vista histórica los busca con otra convención (`file:full:comp:AAAA-MM`).
- El respaldo verificado confirma que los PDF/JPG históricos continúan guardados; el problema está en la búsqueda de la clave, no en la pérdida del archivo.
- Estado al cierre de ese diagnóstico: corrección todavía no implementada.

### 2026-10-02

- Se implementó v4.3.4 para recuperar los adjuntos de Full guardados con las dos convenciones históricas de claves, sin migrarlos, borrarlos ni reescribirlos.
- Los adjuntos nuevos de Full usan una clave única por período real y tipo; su clave queda registrada en los metadatos del comprobante.
- Se corrigió la carga de comprobantes sobre filas históricas vacías para que también cree y conserve la referencia de la fila.
- Archivos modificados: `index.html`, `revision/index.html`, `revision/pruebas.cjs`, `revision/pruebas.json`, `revision/package.json`, `revision/package-lock.json` y este `AGENTS.md`.
- Validaciones aprobadas: sintaxis, formulario, 33 pruebas funcionales, 20 pruebas de reglas y 10 regresiones contra el respaldo completo de 67 documentos.
- Para el corte hacia ChatGPT de escritorio, el repositorio debe incluir todo el árbol fuente: `revision/`, `assemble.py`, `formularios/`, reglas, pruebas y documentación. Los respaldos y comprobantes privados quedan excluidos.
- Estado: candidata validada; publicación y verificación de producción pendientes dentro de este mismo corte.

### 2026-10-07

- Se identificó mediante captura el origen del aviso repetitivo “El navegador no pudo guardar el respaldo local”: el almacenamiento local estaba lleno por copias de caché grandes, aunque la escritura posterior en Firebase sí finalizaba correctamente.
- Se implementó v4.3.6: el autoguardado agrupa pulsaciones durante 1 segundo, conserva el último valor y fuerza el guardado pendiente antes de cambiar de período, cerrar sesión, ocultar o abandonar la pestaña.
- Durante una escritura normal el indicador muestra “Guardando en la nube”; el estado rojo queda reservado para fallos reales. Se eliminó el popup repetitivo por cuota local.
- La aplicación ya no duplica en `localStorage` valores de caché mayores a 250.000 caracteres. Si falta espacio para una cola, elimina únicamente cachés vencidas o copias de adjuntos que no estén protegidas por ninguna cola pendiente; no borra documentos ni archivos de Firebase.
- Si fallan al mismo tiempo el respaldo local y Firebase, se conserva la cola en memoria y aparece un aviso persistente para no cerrar la ventana y reintentar.
- Archivos modificados: `index.html`, `revision/index.html`, `revision/access.js`, `revision/pruebas.cjs`, `revision/pruebas.json`, `revision/package.json`, `revision/package-lock.json` y este `AGENTS.md`.
- Validaciones aprobadas: ensamblado, sintaxis, formulario, 36 pruebas funcionales, 20 pruebas de reglas y 10 regresiones contra el respaldo completo de 67 documentos.
- Se integró el intento de autoguardado subido directamente a GitHub el 05/10/2026, conservando su protección al ocultar/cerrar la pestaña dentro de la solución v4.3.6 y manteniendo todo el árbol fuente.
- Estado: v4.3.6 publicada en `main` el 07/10/2026. GitHub Pages completó el despliegue del commit `8e9561a` y la pantalla pública confirmó `v4.3.6 — revisión 07/10/2026`.
- Se confirmó que una carga de Ventas Especiales no estaba bloqueada: los Excel reales pesan aproximadamente entre 10 y 12 MB y el programa conserva el original, por lo que debía fragmentarlo en unas 30 partes y subirlas secuencialmente.
- Se preparó v4.3.7 para cargar y recuperar hasta cuatro fragmentos en paralelo, manteniendo el manifiesto final, la verificación SHA-256, la detección de conflictos y las claves existentes sin migraciones.
- La pantalla de espera ahora informa la etapa de lectura, análisis, preparación, subida y guardado del período; durante archivos fragmentados muestra porcentaje y cantidad de partes, para no confundir una transferencia lenta con un bloqueo.
- Archivos modificados: `index.html`, `revision/index.html`, `revision/storage.js`, `revision/pruebas.cjs`, `revision/pruebas.json`, `revision/package.json`, `revision/package-lock.json` y este `AGENTS.md`.
- Validaciones aprobadas: ensamblado, sintaxis, formulario, 37 pruebas funcionales, 20 pruebas de reglas y 10 regresiones contra la copia íntegra del respaldo de 67 documentos.
- Estado: v4.3.7 publicada en `main` el 07/10/2026 mediante el commit `a9c984c`. GitHub Pages informó la compilación como `built` y la pantalla pública confirmó `v4.3.7 — revisión 07/10/2026`.

### 2026-10-27

- Auditoría completa de la v4.3.7 publicada (base de datos y escala a 14 estaciones, seguridad, privacidad, accesibilidad, usabilidad, rendimiento y Core Web Vitals) con las guías Modern Web Guidance de Google y `Requisitos-frontend.md`.
- Informe privado fuera del repositorio: `ACA-RECUPEROS/auditoria/2026-10-27-auditoria.md`. No subirlo mientras el repositorio sea público.
- Copia de trabajo del repositorio en `ACA-RECUPEROS/ACA-ADMIN/` (clon de `main`, sin cambios de código).
- Validaciones: 37/37 pruebas funcionales y 20/20 de reglas en el emulador; 6 pruebas de reglas adicionales solo en el emulador (no incorporadas); axe-core y recorrido con teclado en todas las pestañas sobre emulador con datos ficticios; Lighthouse sobre el sitio publicado. Producción solo se leyó.
- Pendientes de decisión del titular: mudar el hosting a Firebase Hosting para hacer privado el repositorio, política de copias del autoguardado, conservación del Excel original de YER, plan cuando se llene el GB gratuito, Excel de Colonia como base del modelo por estación.
- Estado: sin cambios de código ni despliegue.

### 2026-10-27 — v4.3.8 (etapa urgente de la auditoría)

- pdf.js 3.11.174 (CVE-2024-4367) reemplazado por pdf.js 6.4.299, build legacy para computadoras con navegadores viejos, alojado en `vendor/`. Se carga solo al leer un PDF. Todas las lecturas pasan por `openPdf`, con `isEvalSupported:false` y una copia de los bytes, porque pdf.js transfiere el original a su worker.
- SheetJS 0.18.5 (CVE-2023-30533 y CVE-2024-22363) reemplazado por 0.20.3, descargado de `cdn.sheetjs.com` y alojado en `vendor/`. Se precarga sin bloquear después de ingresar a la estación. Cada lectura, visor o exportación de Excel espera `loadXLSX()`.
- Ninguna biblioteca bloquea la pantalla de ingreso. Lighthouse local: celular 80 → 97 (LCP 3,8 → 1,2 s); computadora 97 → 100; 372 → 103 KB.
- Reglas:
  - las copias previas (`--backup--`) y los fragmentos (`--chunk--`, `--part--`) solo se crean; se acepta un reintento idéntico, pero no un cambio;
  - los documentos operativos solo admiten los campos que escribe `storage.js` y valores de hasta 700.000 caracteres;
  - los fragmentos admiten como máximo 640.000 caracteres;
  - el administrador ya no puede crear ni modificar su propio `access/{uid}`. Su acceso a una estación se cambia desde la consola de Firebase.
- Próxima etapa: control del espacio que usa cada estación, junto con el rediseño del almacenamiento.
- «Salir» borra la caché local (`_ttl:crXXXX:*`) de la estación y del CR que estaba abierto en administración. Se conservan las claves que figuren en cualquier cola de sincronización, las colas mismas y las claves de formato viejo (`crXXXX:*`).
- Archivos modificados:
  - `revision/index.html`, `revision/economic.js`, `revision/yer-rates.js`, `revision/access.js`;
  - `revision/firestore.rules` y `firestore.rules` (iguales);
  - `revision/formulario-condiciones.html` (regenerado);
  - `revision/pruebas.cjs`, `revision/pruebas-reglas.cjs` y sus `.json`;
  - `revision/package.json` y `revision/package-lock.json`;
  - `vendor/` (nuevo) y este `AGENTS.md`.
- `index.html` de la raíz se actualizó al publicar. No cambió `formularios/formulario-colonia.html`, que no usa ese código.
- Validaciones aprobadas: ensamblado, sintaxis, formulario, 40/40 pruebas funcionales y 24/24 de reglas. En Windows, `assemble.py` se corrió con `PYTHONUTF8=1`; sin eso, Python lee con cp1252 y falla.
- Prueba completa en Chrome contra el emulador con las reglas nuevas y datos ficticios:
  - ingreso;
  - lectura de un PDF con pdf.js 6;
  - factura de Hotel;
  - Excel YER de 2 MB (2.689 operaciones, 8 fragmentos);
  - dos autoguardados con su copia previa;
  - «Salir» sin caché.
- La v4.3.7 publicada también funcionó completa con las reglas nuevas: se pueden publicar primero las reglas y después la app.
- Publicación aprobada por el titular el 27/10/2026, en este orden:
  1. **Respaldo completo** con la sesión de Firebase CLI del titular, solo lectura: dos lecturas coincidentes con SHA-256, más accesos y reglas vigentes. Se guardó fuera del repositorio, en `ACA-RECUPEROS/respaldos-privados/`. La herramienta `respaldo/respaldo-aca.html` ya no funciona: lee sin sesión y las reglas actuales lo impiden.
  2. **Regresión con ese respaldo** en el emulador local: sin diferencias (ver «Estado de pruebas conocido»).
  3. **Reglas:**
     - las publicadas eran idénticas a `firestore.rules` de `main` (v4.3.7);
     - `firebase deploy --only firestore:rules` sobre `aca-admin`, publicado el 27/10/2026 15:31 UTC;
     - se verificó que lo publicado coincide con el archivo y que el acceso anónimo sigue devolviendo 403.
  4. **App:** `revision/index.html` copiada a `index.html` y subida junto con `vendor/` en el commit `f9f22b5`. GitHub Pages lo publicó y la pantalla pública confirmó `v4.3.8 — revisión 27/10/2026`.
- Comprobado en el sitio publicado, sin iniciar sesión:
  - los archivos de `vendor/` se sirven como JavaScript y son idénticos a los verificados;
  - pdf.js leyó un PDF de prueba y SheetJS cargó la 0.20.3;
  - ninguna biblioteca se descarga antes de ingresar.
- Lighthouse en línea:
  - celular: rendimiento 100 (antes 68), LCP 1,4 s (antes 5,1 s);
  - computadora: rendimiento 100, LCP 0,3 s;
  - 109 KB (antes 378 KB).
- El único 404 es `/favicon.ico` en la raíz de github.io, que ya faltaba antes.
- Pendiente del titular: ingresar con Google en producción, abrir Cipolletti, revisar los históricos, abrir adjuntos y hacer una carga controlada de un PDF y un Excel.
- Visto en las pruebas, ya existía en v4.3.7: si se toca «Salir» mientras Checks todavía lee meses, la consola muestra un aviso de lectura cancelada. No escribe ni pierde nada.

### 2026-10-27 — v4.3.9 (almacenamiento)

- Origen, medido sobre el respaldo del 27/10/2026 (558 documentos, unos 230 MB):
  - 63 MB de versiones viejas de los datos de YER: cada guardado de un mes de más de 700 KB volvía a fragmentarlo entero;
  - 48 MB de versiones reemplazadas de archivos;
  - 27,5 MB de fragmentos huérfanos de dos subidas cortadas de Ventas Especiales (2 y 7 de octubre);
  - 48 MB de archivos vigentes y 18 MB de copias previas de YER.
  - 157 copias previas: con «una por día» habrían sido 16.
- Cambios (aprobados por el titular: «archivos comprimidos sin duplicados y menos copias del autoguardado»):
  - compresión gzip de los valores de 64 KB o más;
  - blobs por huella para el contenido de los adjuntos;
  - una copia previa por documento y por día;
  - marca `fmt: 2`;
  - reglas para los formatos nuevos, más la protección contra versiones anteriores.
  - Lo existente no se migra ni se borra.
- Medido con la misma carga real en el emulador local (v4.3.8 → v4.3.9):
  - volver a subir los 43 adjuntos reales de Cipolletti: 47,7 MB → 7,8 MB;
  - el mismo Excel YER de 13,8 MB subido dos veces: +18,5 MB → +0 MB;
  - 10 autoguardados del YER de julio (918 KB): 30 documentos y 12,0 MB → 1 documento y 0,17 MB;
  - los 43 archivos se leen idénticos.
  - Desde la pantalla, el Excel YER de prueba de 2 MB pasó de 8 fragmentos y 3,8 s a 1 blob y 2,0 s.
- Archivos modificados:
  - `revision/storage.js`;
  - `revision/index.html` (importa `Bytes` y la versión);
  - `revision/firestore.rules` y `firestore.rules`;
  - `revision/pruebas.cjs`, `revision/pruebas-reglas.cjs` y sus `.json`;
  - `revision/package.json`, `revision/package-lock.json` y este `AGENTS.md`.
- Validaciones aprobadas: ensamblado, sintaxis, formulario, 46/46 pruebas funcionales y 27/27 de reglas, regresión con datos reales (19/19 pantallas) y recorrido en Chrome (PDF, Excel YER, autoguardado y salida).
- Publicación aprobada por el titular el 27/10/2026, en este orden:
  1. **Respaldo** con la sesión de Firebase CLI del titular: 561 documentos, dos lecturas coincidentes, guardado en `ACA-RECUPEROS/respaldos-privados/`.
  2. **Reglas:**
     - las publicadas eran idénticas a `firestore.rules` de v4.3.8;
     - publicación de las nuevas el 27/10/2026 16:11 UTC (compatibles con v4.3.8: aceptan sus escrituras);
     - se verificó que lo publicado coincide con el archivo y que el acceso anónimo sigue devolviendo 403.
  3. **App:** `revision/index.html` copiada a `index.html` y subida.
- Falta que las estaciones recarguen con Ctrl+F5 para dejar la v4.3.8.
- Pendiente de decisión: los 27,5 MB de fragmentos huérfanos y las versiones viejas siguen ocupando espacio. Sacarlos de la base exige una excepción explícita al principio de no borrar, con respaldo previo.
