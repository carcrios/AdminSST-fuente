#!/usr/bin/env node
/* ============================================================
   herramientas/licencia.js — Llaves y licencias del Portal SSTA (v162)
   ------------------------------------------------------------
   1) Una sola vez:   node herramientas/licencia.js llaves
      Crea el par de llaves ECDSA P-256. La PRIVADA queda en
      ~/.ssta-licencia-privada.json (FUERA del proyecto: nunca se publica
      ni se empaqueta) y la PÚBLICA se escribe en licencia.js.
   2) Por cliente:    node herramientas/licencia.js firmar --empresa "Fritos JS S.A.S." \
                        --nit 900123456-7 --plan "SG-SST completo" --hasta 2027-12-31 [--modulos a,b,c]
      Imprime la licencia (un texto) para pegar en Configurar empresa → Licencia.
   3) Revisar una:    node herramientas/licencia.js ver <licencia>
   ============================================================ */
const fs = require('fs'), path = require('path'), os = require('os'), { webcrypto: c } = require('crypto');
const PRIV = process.env.SSTA_LICENCIA_PRIVADA || path.join(os.homedir(), '.ssta-licencia-privada.json');
const PUB_JS = path.join(__dirname, '..', 'licencia.js');
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i === -1 ? '' : process.argv[i + 1] || ''; };
(async () => {
  const cmd = process.argv[2];
  if (cmd === 'llaves') {
    if (fs.existsSync(PRIV) && !process.argv.includes('--reemplazar')) { console.log('Ya existen llaves en ' + PRIV + ' (usa --reemplazar para crear otras; las licencias viejas dejarán de servir).'); process.exit(1); }
    const k = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const priv = await c.subtle.exportKey('jwk', k.privateKey), pub = await c.subtle.exportKey('jwk', k.publicKey);
    fs.writeFileSync(PRIV, JSON.stringify(priv), { mode: 0o600 });
    const t = fs.readFileSync(PUB_JS, 'utf8').replace(/const LICENCIA_LLAVE_PUBLICA = [^;]*;/, 'const LICENCIA_LLAVE_PUBLICA = ' + JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }) + ';');
    fs.writeFileSync(PUB_JS, t);
    console.log('Llave privada: ' + PRIV + ' (guárdala con respaldo; NO la compartas).\nLlave pública escrita en licencia.js. Vuelve a publicar el sitio.');
  } else if (cmd === 'firmar') {
    const priv = JSON.parse(fs.readFileSync(PRIV, 'utf8'));
    const datos = { empresa: arg('empresa'), nit: arg('nit'), plan: arg('plan') || 'SG-SST completo', modulos: arg('modulos') ? arg('modulos').split(',') : undefined, desde: arg('desde') || new Date().toISOString().slice(0, 10), hasta: arg('hasta'), emitida: new Date().toISOString().slice(0, 10) };
    if (!datos.empresa || !datos.nit || !/^\d{4}-\d{2}-\d{2}$/.test(datos.hasta)) { console.log('Faltan --empresa, --nit o --hasta AAAA-MM-DD'); process.exit(1); }
    const k = await c.subtle.importKey('jwk', priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const cuerpo = b64u(Buffer.from(JSON.stringify(datos), 'utf8'));
    const firma = await c.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, new TextEncoder().encode(cuerpo));
    console.log(cuerpo + '.' + b64u(firma));
  } else if (cmd === 'ver') {
    const p = String(process.argv[3] || '').split('.'); console.log(JSON.parse(Buffer.from(p[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')));
  } else console.log('Uso: llaves | firmar --empresa … --nit … --hasta AAAA-MM-DD [--plan …] [--modulos …] | ver <licencia>');
})();
