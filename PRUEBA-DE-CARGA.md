# Prueba de carga del servidor SG-SST

Qué tanto aguanta el servidor de una empresa (Apps Script + Google Sheets) y cómo volver a medirlo.

## Cómo se mide

| Herramienta | Dónde corre | Qué dice |
|---|---|---|
| `node herramientas/carga.js` | Tu computador, sin Google | Cuánto le pide cada operación a la hoja (llamadas, celdas) y cuánto pesa la respuesta, de 1.000 a 50.000 registros. No da segundos. |
| `herramientas/carga-en-google.gs` | Un Apps Script **de prueba** | Los segundos reales de cada operación. Instrucciones arriba del archivo. |
| `node herramientas/carga-concurrente.js` | Tu computador contra el servidor de prueba | Qué pasa con 20 guardados a la vez y cuánto tardan las lecturas de punta a punta. |

Nunca se corre una prueba de carga contra el servidor de una empresa: escribe registros.

## Resultado en el simulador (v168, datos inventados)

Mezcla: 45 % preoperacionales, 20 % inspecciones, 12 % reportes, 10 % acciones, 8 % inducciones, 5 % exámenes, y 500 personas.

| Registros activos | Guardar un reporte | Plan de acción, lista completa | Plan de acción, solo cambios |
|---|---|---|---|
| 1.000 | 21 llamadas | 12.768 celdas · 0,1 MB | 4.292 celdas · 2 KB |
| 5.000 | 21 llamadas | 66.528 celdas · 1,0 MB | 22.212 celdas · 2 KB |
| 10.000 | 21 llamadas | 133.728 celdas · 2,0 MB | 44.612 celdas · 2 KB |
| 25.000 | 21 llamadas | 335.328 celdas · 5,2 MB | 111.812 celdas · 2 KB |
| 50.000 | 21 llamadas | 671.328 celdas · 10,5 MB | 223.812 celdas · 2 KB |

- **Guardar no crece** con el tamaño de la base: las mismas llamadas con 1.000 que con 50.000.
- **La lista completa** se pide una vez al día por celular y por lista (y la primera vez). El resto del día viajan solo los cambios.
- **Los tipos con datos de salud** no dejan copia en el celular, así que siempre piden la lista completa.
- **Los pendientes del inicio** siguen leyendo la hoja completa en el servidor (la respuesta es corta si hay pocas cosas abiertas).
- Celdas por registro: unas 47. El tope de Google es de 10 millones por libro: unos 210.000 registros sin contar firmas ni fotos.

## Lo que falta medir

Los segundos reales en Google y el comportamiento con guardados simultáneos. Con esos dos números se fija el
tamaño máximo por plan en el Anexo 1. Mientras tanto, la regla prudente: hasta 10.000 registros activos por
empresa, con el archivo anual (`archivarAniosAnteriores`) hecho cada enero.
