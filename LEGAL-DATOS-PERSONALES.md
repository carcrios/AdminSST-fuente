# Datos personales al vender el portal (Ley 1581 de 2012)

> Plantillas y lista de chequeo para revisar con un abogado. No reemplazan asesoría legal.

## Quién es quién

| Rol | Quién | Por qué |
|---|---|---|
| **Responsable del tratamiento** | Cada empresa cliente | Decide para qué se usan los datos de sus trabajadores (cumplir el SG-SST). |
| **Encargado del tratamiento** | Tú, quien presta el portal | Operas la plataforma por cuenta de la empresa: instalas, das soporte y, con tu consola, ves el estado de su servidor y le asignas tareas. |
| **Subencargado** | Google (Apps Script, Sheets, Drive) | Los datos quedan en la cuenta de Google **de la empresa**. Como Google procesa en servidores fuera de Colombia, hay una **transmisión internacional**; entre responsable y encargado se cubre con el contrato de transmisión (Decreto 1074 de 2015, arts. 2.2.2.25.5.1 y 2.2.2.25.5.2). |

## Lo que ya hace el portal

- **Autorización del trabajador** en la inducción, con dos casillas: datos generales (obligatoria) y datos sensibles de salud (voluntaria, art. 6 de la Ley 1581). Queda con la firma, la fecha y la versión del texto.
- **Aviso de privacidad** (`privacidad.html`) con el contenido mínimo del art. 2.2.2.25.3.3: responsable, encargado, datos, finalidad, derechos, contacto y política. Cada celular lo ve la primera vez que abre el portal. El correo de contacto y el enlace a la política se ponen en el configurador (paso 1).
- **Acceso por rol:** los datos de salud solo los ven Administrador y SST. Se guarda si la persona es apta y sus restricciones, nunca el diagnóstico.
- **Bitácora** de quién cambió qué y **respaldo semanal** en la cuenta de la empresa.
- Tu consola no lee los datos de los clientes. Solo usa el estado de su servidor, sus tareas y su configuración.

## Lo que falta firmar o publicar (no es código)

1. **Contrato de licencia y de transmisión de datos** con cada cliente. Puedes usar como base la cláusula de abajo.
2. **Política de tratamiento de datos** de cada empresa (art. 2.2.2.25.3.1). La publica la empresa, no tú. En el configurador va el enlace.
3. **Tu propia política** como encargado: cómo atiendes incidentes, quién de tu equipo tiene acceso y qué pasa con los datos al terminar el contrato.
4. **Registro Nacional de Bases de Datos (SIC):** lo inscribe la empresa si está obligada (según el Decreto 090 de 2018: sociedades con activos totales de más de 100.000 UVT y personas jurídicas de naturaleza pública).
5. **Incidentes de seguridad:** si se filtra la clave del portal, se cambia con `cambiarClave` en el Apps Script de la empresa. La llave de tu consola se cambia con `nuevaLlaveProveedor`. La empresa reporta el incidente a la SIC.

## Cláusula modelo de transmisión de datos personales

> **CLÁUSULA ___. TRANSMISIÓN DE DATOS PERSONALES.** EL CLIENTE, como Responsable del tratamiento, transmite a EL PROVEEDOR, como Encargado, los datos personales de sus trabajadores, contratistas y visitantes que se registren en el Portal SSTA. La única finalidad es prestar el servicio de la plataforma de gestión de seguridad y salud en el trabajo (instalación, soporte, actualización y asesoría). En cumplimiento del artículo 2.2.2.25.5.2 del Decreto 1074 de 2015, EL PROVEEDOR se obliga a:
> (i) tratar los datos solo según la política de tratamiento de EL CLIENTE y las finalidades que los titulares autorizaron;
> (ii) no usarlos para fines propios ni cederlos a terceros, salvo a los subencargados técnicos necesarios para el servicio (Google LLC, en la cuenta de Google de EL CLIENTE);
> (iii) guardar confidencialidad sobre los datos y aplicar medidas de seguridad para evitar su pérdida, consulta, uso o acceso no autorizado o fraudulento;
> (iv) acceder a la información de EL CLIENTE solo cuando sea necesario para el soporte y con su autorización;
> (v) informar a EL CLIENTE, dentro de las 24 horas siguientes a conocerlo, cualquier incidente de seguridad que afecte los datos;
> (vi) apoyar a EL CLIENTE en la atención de consultas y reclamos de los titulares;
> (vii) al terminar el contrato, entregarle a EL CLIENTE la información que esté en poder de EL PROVEEDOR y suprimir la que conserve, salvo deber legal de guardarla.
> Los datos permanecen en la cuenta de Google de EL CLIENTE. EL CLIENTE declara que cuenta con la autorización de los titulares y con su política de tratamiento.

## Para el piloto

Antes de vender en firme, prueba con una o dos empresas reales:

1. Instálala desde la consola (un solo flujo) y abre su enlace en **celulares Android sencillos**, con datos móviles y en obra.
2. **Sin señal:** llena un preoperacional y un reporte en modo avión y revisa que se envíen solos al volver la señal.
3. **Roles:** crea un supervisor, un SST y un rol de consulta, y revisa que cada uno vea solo lo suyo.
4. **Módulos:** apaga uno en la consola y revisa que desaparezca de su portal y que su servidor rechace registros de ese módulo.
5. **Vigilancia:** ejecuta `sgsst__instalarVigilancia` en tu servidor y revisa que al día siguiente llegue el correo si algo falla.
6. **Respaldo:** revisa que el domingo aparezca la copia en «Respaldos SG-SST» de su Drive.
7. Anota los tiempos de carga, lo que confundió a los usuarios y los errores. Corrígelos antes del segundo cliente.
