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
- Valores grandes se fragmentan y verifican mediante SHA-256. El manifiesto se publica al final.
- Antes de reemplazar un documento se conserva su versión previa.
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

- 36 pruebas funcionales aprobadas en la candidata v4.3.6.
- 20 pruebas de reglas aprobadas en Firestore Emulator.
- 10 pruebas de regresión aprobadas contra la copia del respaldo.
- El respaldo verificado contenía 67 documentos: 53 de Cipolletti, 12 de Colonia y 2 de otros CR.
- Se verificaron 42 adjuntos de forma estructural: 28 PDF, 5 XLSX y 9 JPEG. Esto no equivale a revisión visual de todos los archivos.

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
