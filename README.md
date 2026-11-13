# Portal SSTA

Sistema de gestión de seguridad y salud en el trabajo (SG-SST, Colombia) para
el celular y el computador: permisos de trabajo, ATS, inspecciones, charlas,
personal habilitado, comités, indicadores, plan anual, auditorías y el resto de
la Res. 0312 de 2019. Funciona sin señal y sincroniza cuando vuelve la conexión.

- **Sacar una versión y volver atrás:** [RELEASE.md](RELEASE.md).
- **Planes que se venden:** SG-SST Esencial (la base), SG-SST + Obra e Integral; «Obra» es un complemento,
  nunca va solo (`PLANES_PORTAL` y `COMPLEMENTOS_PORTAL` en `empresa-motor.js`). Precios, propuesta, contrato,
  encargo de datos y niveles de servicio: carpeta [`comercial/`](comercial/) (`node herramientas/comercial.js` arma los .docx y .pdf).
- **Instalar el portal para una empresa (o para varias desde un solo sitio):**
  [INSTALAR-NUEVA-EMPRESA.md](INSTALAR-NUEVA-EMPRESA.md).
- **Empresa nueva con un comando:** `node herramientas/instalar-empresa.js` (crea su servidor y la anota en tu
  lista). **¿En qué versión va cada cliente?** `node herramientas/actualizar-servidores.js clientes.json --estado`.
- **¿Cuánto aguanta el servidor de una empresa?** [PRUEBA-DE-CARGA.md](PRUEBA-DE-CARGA.md) y `node herramientas/carga.js`.
- **¿Te estás haciendo cargo de esto sin haberlo construido?** Lee
  [TRASPASO.md](TRASPASO.md): cómo está armado, por qué y dónde están los peligros.
- **Qué cambió en cada versión:** [CHANGELOG.md](CHANGELOG.md).

---

## Cómo está armado

| | Qué es | Dónde vive | Cómo se actualiza |
|---|---|---|---|
| **Sitio web** | Pantallas, PDF, funcionamiento sin señal | Un repositorio → GitHub Pages | Subiendo los archivos |
| **Servidor de cada empresa** | Guardado en Google Sheets, correos y avisos | Un proyecto de Google Apps Script en la cuenta de la empresa | `node herramientas/actualizar-servidores.js clientes.json` |

- `empresa.js` tiene los datos de la empresa (nombre, logo, códigos de los
  formatos, módulos activos). Se genera con `configurar-empresa.html`; los que
  trae de fábrica son de ejemplo («Tu empresa» o, en el sitio multiempresa, «Tu marca»).
- `config.js` trae las URL de servidor vacías: cada empresa pone la suya en su
  configuración (`servidor` / `apiToken`), nunca en el código.
- `servidor-unico/` es el Apps Script que se instala en cada empresa. **Es
  generado**: se arma con `node herramientas/armar-servidor-unico.js` a partir
  de `backends/`, que es el código fuente de cada módulo. No se edita a mano.
- `demo/` es la empresa de demostración (datos ficticios). El sitio demo **se
  genera** con `node herramientas/armar-demo.js <carpeta>`; no se edita a mano.
- `common.js` (lo que comparten todas las pantallas) **es generado**: su código vive en
  `fuente/common/`, un archivo por tema, y se une con `node herramientas/armar-common.js`.
  Se cambia la parte, nunca `common.js`. `fuente/` no se sube al sitio.
- [MAPA-DEL-CODIGO.md](MAPA-DEL-CODIGO.md) dice qué hay en cada archivo y qué pantallas lo usan
  (lo escribe `node herramientas/mapa.js`; se regenera solo al sacar una versión).
- **Este repositorio es la única fuente.** Todo lo demás (servidor único, sitio
  demo, la carpeta de entrega) sale de aquí con `node herramientas/empaquetar.js`.

---

## Antes de subir nada: correr las pruebas

```bash
node pruebas/pruebas.js
```

Revisa más de mil cosas en unos segundos: que las firmas no se pierdan, que los
servidores se comporten igual que el navegador, que no falte ningún archivo en
la caché, que todo compile y que en el código no quede ningún dato real
(correos, celulares, tokens, enlaces a formularios o carpetas de alguien).

**Si algo sale en rojo, no subas.** Requiere Node.js. Incluye las pruebas
unitarias (`pruebas/unitarias.js`) y la revisión de CSP en cada página.

Lint de seguridad (una vez: `cd herramientas/lint && npm install`):
`node herramientas/lint/revisar.js`. Licencias: `node herramientas/licencia.js llaves`
(una vez; la llave privada nunca va en el proyecto).

### Pruebas en un navegador de verdad

```bash
cd pruebas && npm install && npx playwright install chromium   # una sola vez
node navegador.js
```

Abre la empresa demo en Chromium con tamaño de celular y comprueba lo que
pruebas.js no puede ver: que las ~50 pantallas abran sin errores, que los 5
permisos se diligencien, firmen, guarden y verifiquen en el servidor, que
**todo** lo escrito (campos y firmas) llegue y se vea al abrir el permiso en
otro equipo, que sin señal quede una sola copia en cola y se envíe sola, y que
las firmas a pantalla completa no pasen de 50.000 caracteres.

---

## Trabajar con git (y que GitHub no publique nada en rojo)

El repositorio de GitHub es la única copia del portal: nada de zips por versión.
Cada cambio queda con fecha y motivo, y se puede deshacer.

1. Sube esta carpeta completa a tu repositorio (con `pruebas/`, `backends/`,
   `herramientas/` y `.github/`).
2. **Settings → Pages → Source: «GitHub Actions»** (una sola vez).
3. Desde ahí, cada vez que subas cambios GitHub corre las dos pruebas
   (`.github/workflows/pruebas.yml`). **Si alguna sale en rojo, no publica**: el
   sitio sigue como estaba y la subida aparece con ✗ en la pestaña *Actions*.
   Al publicar deja fuera lo de desarrollo (`backends/`, `pruebas/`,
   `herramientas/`, `TRASPASO.md`).

Para una versión nueva: `node herramientas/subir-version.js`, anota en
`CHANGELOG.md`, y sube con un mensaje que diga qué cambió:

```bash
git add -A && git commit -m "v111: lo que cambió" && git push
```

---

## Publicar una versión nueva del sitio

**Desde v165 es un solo comando** (ver [RELEASE.md](RELEASE.md), que también explica cómo volver atrás):
escribe la entrada en `CHANGELOG.md` y corre `node herramientas/publicar.js vNNN`. Sube la versión, recalcula
la CSP, corre lint y todas las pruebas, rehace la guía, arma y verifica la entrega. Si un paso falla, no hay versión.

Lo que hace por dentro, por si hay que hacerlo a mano:

1. **Si tocaste un `.html`, `.js`, `.css` o un ícono → `node herramientas/subir-version.js`.**
   Sube `CACHE_NAME` en `sw.js` y la versión visible de todas las pantallas a la vez.
   Sin esto los celulares siguen mostrando la versión vieja.
2. Anota los cambios en `CHANGELOG.md`.
3. `node herramientas/empaquetar.js`: corre las pruebas (se detiene si algo sale
   en rojo), regenera el servidor único y la demo, y deja la entrega en `../portal-vNNN/`.
4. Sube los archivos al repositorio. GitHub Pages publica en uno o dos minutos.
5. En el celular sale el aviso **«Hay una versión nueva»**; al aceptarlo se actualiza.

Para los servidores: `node herramientas/actualizar-servidores.js clientes.json`
(ver INSTALAR-NUEVA-EMPRESA.md). Al actualizar a mano, siempre **Nueva versión**
de la misma implementación, nunca «Nueva implementación» (cambia la URL).

---

## ATS interactivo: cómo mantener la base de conocimiento

Todo lo que el ATS sugiere sale de `ats-catalogo.js`. Es solo datos, así que
se puede ajustar sin tocar la pantalla:

- **Agregar un control** a un peligro: añadirlo a su lista `controles` con la
  letra de jerarquía (E eliminación, S sustitución, I ingeniería,
  A administrativo, P EPP).
- **Agregar un peligro**: copiar uno existente, darle un `id` nuevo y
  asignarle una de las 7 clases de la GTC 45.
- **Agregar una tarea tipo**: añadirla a `TAREAS` con los ids de sus peligros
  y, si aplica, las tareas que suelen seguirla (`siguiente`).

Después de editar: `node pruebas/pruebas.js` y subir `CACHE_NAME` en `sw.js`.

---

## Decisiones que conviene no deshacer

- **Las firmas se exportan a resolución acotada.** Google Sheets no admite más
  de 50.000 caracteres por celda. Sin el tope, las firmas de tablets grandes se
  perdían en silencio.
- **El servidor recalcula qué EPP está en MALO**, no confía en lo que manda el
  navegador. El correo de reposición debe corresponder a lo que quedó guardado.
- **Los datos de salud solo los ven Administrador y SST**, y las quejas de
  convivencia van cifradas. Lo hace cumplir el servidor, no la pantalla.
- **La bitácora (`Eventos`) registra también los intentos rechazados.** Un
  intento de tocar un permiso cerrado es justo lo que uno querría poder
  demostrar después.
- **Los `@media` no se centralizan.** Una regla dentro de un `@media` movida a
  global aplicaría siempre, y ese error no se ve hasta que alguien gira el
  celular o imprime.

---

## Si algo falla

| Síntoma | Revisar primero |
|---|---|
| Un arreglo «no sirvió» | ¿Subiste `CACHE_NAME`? ¿Aceptaste el aviso de versión nueva? |
| Las firmas no aparecen | Hoja **Firmas** del servidor: ¿hay filas para ese código? |
| «Token inválido» / «Clave inválida» / «Sesión vencida» | Token: ¿el `apiToken` coincide con su servidor (`verConfiguracion`)? Clave: la del usuario. Sesión: volver a entrar |
| Un registro no se guarda | Hoja **Eventos**: ahí queda el motivo del rechazo |
| La página no carga sin señal | ¿Está el archivo listado en `sw.js`? Lo verifican las pruebas |
| No se sabe qué falla en un celular | `estado.html` prueba cada servidor; `?debug=1` en un permiso muestra el panel de diagnóstico |
