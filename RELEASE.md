# Sacar una versión (y volver atrás)

Una versión sale con **un solo comando**. Si un paso falla, no hay versión: no se decide a mano.

## Una vez por equipo

```bash
cd pruebas && npm install && npx playwright install chromium && cd ..
cd herramientas/lint && npm ci && cd ../..
(cd herramientas && npm i --no-save --prefix . terser@5 clean-css@5 docx)
git config core.hooksPath herramientas/git-hooks     # revisión rápida antes de cada commit
```

## Cada versión

1. Escribe en `CHANGELOG.md`, arriba, la entrada `## vNNN — qué cambió` con la lista en español.
   Es lo único que se hace a mano.
2. Corre:

   ```bash
   node herramientas/publicar.js vNNN
   ```

   En orden, y se detiene en el primer error:

   | Paso | Qué hace |
   |---|---|
   | 1 | Revisa que el CHANGELOG tenga la entrada de vNNN (con `--git`, que no haya cambios sin commit) |
   | 2 | Sube la versión en todos lados, arma `common.js` desde `fuente/common/`, recalcula la CSP de cada página, regenera el servidor y el mapa del código |
   | 3 | Lint de seguridad (ESLint) |
   | 4 | Pruebas del código y pruebas de lógica |
   | 5 | Si cambiaron las pantallas del instalador, vuelve a tomar las capturas; genera la guía |
   | 6 | Arma la entrega y corre las pruebas en navegador sobre el sitio **minificado** |
   | 6b | Arma los documentos comerciales en Word y PDF (carpeta `COMERCIAL/` del paquete; ver abajo) |
   | 7 | `verificar-release.js --paquete`: versión igual en todos lados, CSP, núcleo sin señal, servidor igual al de `backends/`, guía de esta versión, paquete sin archivos internos y en tandas de menos de 100 archivos |
   | 8 | Deja `../portal-vNNN/` y `../portal-vNNN.zip` (el .zip lo arma Node: funciona igual en Windows) |

   Opciones: `--git` (exige árbol limpio y al final hace commit y la etiqueta `vNNN`),
   `--push` (además sube; GitHub Actions corre las pruebas y publica), `--salida <carpeta>`.

3. Sube el sitio (`PASO-2-SITIO`). Si el CHANGELOG pide servidor: `node herramientas/actualizar-servidores.js clientes.json`
   los actualiza todos (o pega `PASO-1-SERVIDOR` en cada empresa, como dice la guía). Antes y después,
   `… clientes.json --estado` dice en qué versión va cada una.

## Documentos comerciales

Propuesta, contrato y anexos se editan en `comercial/*.md` (nunca van al sitio público). Para armarlos sueltos:
`node herramientas/comercial.js [carpeta]` → Word y, si está LibreOffice, PDF, con la versión, la fecha,
«Página X de Y» y el bloque de firmas. La tabla de módulos por plan del Anexo 1 sale de `PLANES_PORTAL`:
si cambias un plan en el código, el contrato cambia solo. Marcas que se pueden usar en los .md:
`{{VERSION}}`, `{{FECHA}}`, `{{ANIO}}`, `{{FIRMAS}}`, `{{MODULOS_POR_PLAN}}`.

## Lo que revisa GitHub en cada subida

- Pruebas del código y lógica, con ESLint instalado (`npm ci` en `herramientas/lint`).
- `verificar-release.js`: si el servidor generado no coincide con `backends/`, falla.
- Pruebas en navegador con Chromium. **Si algo sale en rojo, no publica.**
- Pruebas en **WebKit** (el motor de Safari en iPhone): por ahora avisan pero no frenan la publicación.
  Cuando salgan en verde varias veces seguidas, quita `continue-on-error` del job `iphone` en
  `.github/workflows/pruebas.yml`. Para correrlas en tu equipo:
  `npx playwright install webkit` y `SSTA_MOTOR=webkit node pruebas/navegador.js`.
- Dependencias con vulnerabilidades conocidas y que no se haya colado un token o una llave privada (aviso).

## Volver a la versión anterior

Si una versión sale mal en los celulares:

1. **Sitio:** sube de nuevo la carpeta `PASO-2-SITIO` de la versión anterior (el zip `portal-vNNN.zip`
   anterior), o con git: `git checkout vANTERIOR -- . && git commit -m "volver a vANTERIOR" && git push`.
   **Importante:** antes de subir, corre `node herramientas/subir-version.js` para que la versión
   «vieja» salga con un número **mayor**. Si no, los celulares no ven el cambio (el service worker solo
   se actualiza cuando sube `CACHE_NAME`).
2. **Servidor:** en el Apps Script de cada empresa, **Implementar → Gestionar implementaciones → ✏️ →
   Versión:** elige la versión anterior → **Implementar**. La URL no cambia. Nunca «Nueva implementación».
3. Anota en el CHANGELOG qué pasó y qué se devolvió.

Los datos no se pierden al volver atrás: viven en las hojas de cada empresa, no en el código.

## Antes de cada commit (automático con el hook)

```bash
node herramientas/armar-common.js --check
node herramientas/csp.js --check
node herramientas/verificar-release.js --rapido --sin-guia
```
