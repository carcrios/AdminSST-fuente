/* Vuelve a escribir en index.html la lista corta de los preoperacionales base
   (nombre, código y grupo), para que el inicio no tenga que cargar preop-base.js.
   Uso: node herramientas/indice-preop.js   (lo corre también subir-version.js) */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
function actualizar() {
  const B = require(path.join(RAIZ, 'preop-base.js'));
  const ind = JSON.stringify(B.map((f) => ({ id: f.id, nombre: f.nombre, codigo: f.codigo || '', grupo: f.grupo })));
  const ix = path.join(RAIZ, 'index.html'); let s = fs.readFileSync(ix, 'utf8');
  const n = s.replace(/const PREOP_BASE_INDICE = \[.*?\];/, () => 'const PREOP_BASE_INDICE = ' + ind + ';');
  if (n !== s) fs.writeFileSync(ix, n);
  return B.length;
}
if (require.main === module) console.log('Inicio: ' + actualizar() + ' preoperacionales base.');
module.exports = { actualizar };
