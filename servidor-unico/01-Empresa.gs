/* ============================================================
   01-Empresa.gs — Datos de la empresa (lo ÚNICO que se edita)
   ------------------------------------------------------------
   Escribe aquí el nombre de la empresa y los correos de SST. Las
   actualizaciones del portal reemplazan los demás archivos, nunca este.
   Si cambias algo: Implementar → Gestionar implementaciones → Nueva versión.
   ============================================================ */

const EMPRESA_NOMBRE = 'ESCRIBE AQUÍ EL NOMBRE DE LA EMPRESA';
// Correos que reciben avisos (permisos sin cerrar, reposición de EPP, revisiones).
const CORREOS_SSTA = ['correo-sst@empresa.com'];
// Quién recibe por WhatsApp la foto de un EPP en mal estado (sale en el correo de reposición).
const CONTACTO_EPP = { nombre: 'Responsable de SST', whatsapp: '' };
