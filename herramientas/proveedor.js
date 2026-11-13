#!/usr/bin/env node
/* ============================================================
   herramientas/proveedor.js — Tus herramientas de proveedor, en tu computador (v175)
   ------------------------------------------------------------
   La consola, el configurador, el panel del asesor y el instalador ya no
   están en el sitio público. Para usarlos, desde la carpeta del proyecto:

     node herramientas/proveedor.js            → abre la consola (admin.html)
     node herramientas/proveedor.js configurar → abre el configurador
     node herramientas/proveedor.js instalar   → abre el instalador

   Levanta un servidor solo en tu computador (http://localhost:8765) que
   sirve esta carpeta. Nada sale a internet salvo las llamadas que las
   páginas ya hacen a los servidores de tus clientes.
   ============================================================ */
const http = require('http'),
  fs = require('fs'),
  path = require('path');
const RAIZ = path.join(__dirname, '..'),
  PUERTO = Number(process.env.PUERTO || 8765);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.gs': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const PAGINAS = { consola: 'admin.html', configurar: 'configurar-empresa.html', instalar: 'instalar.html', asesor: 'asesor.html' };
const NUNCA = /^(backends|pruebas|herramientas|comercial|fuente|node_modules|\.git)(\/|$)/;

const srv = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'admin.html';
  if (u.indexOf('..') !== -1 || NUNCA.test(u)) {
    res.writeHead(403);
    return res.end('No disponible');
  }
  const f = path.join(RAIZ, u);
  fs.readFile(f, (err, b) => {
    if (err) {
      res.writeHead(404);
      return res.end('No existe: ' + u);
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(b);
  });
});
srv.listen(PUERTO, '127.0.0.1', () => {
  const pag = PAGINAS[process.argv[2]] || PAGINAS.consola,
    url = 'http://localhost:' + PUERTO + '/' + pag;
  console.log('Herramientas del proveedor en ' + url + '  (Ctrl+C para cerrar)');
  const abrir = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    require('child_process').spawn(abrir[0], abrir[1], { stdio: 'ignore', detached: true }).unref();
  } catch (e) {}
});
