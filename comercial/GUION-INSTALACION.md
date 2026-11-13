# Guion de instalación con el cliente (videollamada de 45 minutos)

> **Privado.** Este documento es tuyo (está en `comercial/`, nunca se publica).
> La instalación la haces **tú**, con el cliente conectado y compartiendo pantalla.
> El cliente no instala nada solo: así no se asusta, no se equivoca de cuenta y el
> servidor (`Portal-SSTA.gs`) nunca sale de tus manos.

## Antes de la llamada (el día anterior)

- [ ] Envíale al cliente el **video corto** («La pantalla de Google que dice "no es seguro"», guion abajo) y pídele que lo vea.
- [ ] Pídele que tenga a mano:
  - la **cuenta de Google de la empresa** (por ejemplo `sst@empresa.com`), con la clave. **No** una cuenta personal;
  - el **NIT**, el logo y los correos que reciben los avisos;
  - el **listado del personal** en Excel (nombre, documento, cargo) y, si lo tiene, el **listado maestro de documentos**.
- [ ] Ten listo en tu computador:
  - la carpeta del proyecto (el repositorio privado `AdminSST-fuente`), al día;
  - la **licencia firmada** para su NIT: `node herramientas/licencia.js firmar --empresa "…" --nit … --plan "…" --hasta AAAA-MM-DD`.
- [ ] Agenda 45 minutos y deja 15 de colchón.

## La llamada, minuto a minuto

| Minuto | Qué haces | Qué le dices al cliente |
|---|---|---|
| 0–5 | Saludo y objetivo. | «Hoy dejamos el portal funcionando con sus datos en el Google Drive de su empresa. Usted solo va a hacer dos clics de permiso; lo demás lo hago yo.» |
| 5–10 | El cliente entra a **script.google.com** con la cuenta de la empresa y te **comparte el proyecto como Editor** (o tú lo creas con `herramientas/instalar-empresa.js` entrando con la cuenta de la empresa). | «Todo queda en su cuenta: los datos son de ustedes, no míos.» |
| 10–15 | Pegas el servidor y llenas `01-Empresa` (nombre, correos, contacto de EPP). | — |
| 15–20 | **El momento delicado:** el cliente ejecuta **instalar** y aparece la pantalla de Google. Le recuerdas el video. Clic en *Configuración avanzada* → *Ir a Portal SSTA* → **Permitir**. | Ver «Qué decir en la pantalla "no es seguro"». |
| 20–25 | Publicas la aplicación web (*Ejecutar como: Yo · Acceso: Cualquier usuario*) y ejecutas **verConfiguracion**. | «Esta es la dirección de su servidor. La clave del portal se la dejo por escrito; no la envíe por chat.» |
| 25–35 | Abres tus herramientas: `node herramientas/proveedor.js configurar`. Pones nombre, NIT, logo, plan y **licencia**. Subes el personal desde Excel. | «Con el plan Micro 7 verá solo 8 módulos: lo justo para los 7 estándares.» |
| 35–42 | Recorrido: **Por dónde iniciar** (el siguiente paso), un reporte de prueba, la **guía flotante** («?») y el inicio de Gestión. | «Si se pierde, toque el botón "?" y pregúntele.» |
| 42–45 | Cierre: quién es el administrador, qué viene (primer mes acompañado), cómo pedir ayuda. Pruebas en 🩺 **Estado**. | «Mañana le escribo para ver cómo le fue con el primer registro.» |

## Qué decir en la pantalla «no es seguro»

Google muestra **«Google no verificó esta aplicación»** (o *«This app isn't verified»*) cuando un programa
pide permisos sobre una cuenta y **no está publicado en la tienda de Google**. El portal no está en la tienda
porque es **privado de su empresa**: vive en su propia cuenta y nadie más lo usa.

> «Esa advertencia sale con cualquier programa propio de una empresa que no está en la tienda de Google.
> El programa es suyo, está en su cuenta y lo que pide es poder crear y escribir en sus hojas de Google
> y enviar los correos de avisos. Por eso le damos *Configuración avanzada → Ir a Portal SSTA → Permitir*.
> Solo se hace esta vez.»

Si el cliente duda: no insistas. Muéstrale en la misma pantalla los permisos que pide y recuérdale que
puede quitarlos cuando quiera en **myaccount.google.com → Seguridad → Aplicaciones de terceros**.

## Guion del video corto (60 a 90 segundos)

**Título:** «Antes de instalar: la pantalla de Google que dice "no es seguro"»

1. **(0–10 s)** «Hola. Mañana instalamos su portal de SST. En un momento Google le va a mostrar una advertencia. Es normal y le explico por qué.»
2. **(10–35 s)** *(Pantalla grabada de la advertencia.)* «Google muestra esto con cualquier programa que no esté en su tienda. Su portal no está en la tienda porque es privado: vive en la cuenta de Google de su empresa y solo ustedes lo usan.»
3. **(35–60 s)** *(Clic en Configuración avanzada → Ir a Portal SSTA → Permitir.)* «Le damos aquí, en "Configuración avanzada", luego en "Ir a Portal SSTA" y en "Permitir". Lo que pide es poder guardar los registros en sus hojas de Google y enviarle los avisos por correo.»
4. **(60–80 s)** «Sus datos se quedan en su cuenta; ni yo ni nadie más los tiene. Y si algún día quiere, puede quitar el permiso desde su cuenta de Google.»
5. **(80–90 s)** «Nos vemos en la instalación. Cualquier duda, escríbame.»

**Grabación:** pantalla del computador con el cursor visible, voz tranquila, sin música. Súbelo como
«no listado» y envíale el enlace al cliente el día anterior.

## Después de la llamada

- [ ] Anota la empresa en tu `clientes.json` (para las actualizaciones con `actualizar-servidores.js`).
- [ ] Agrega la empresa a tu consola (`node herramientas/proveedor.js`).
- [ ] Escríbele al día siguiente.
- [ ] A los 30 días: revisa en la consola el **uso por módulo** y las **preguntas que la guía no supo responder**.
