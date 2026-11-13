/* ============================================================
   cifrado.js — Reserva de las quejas del Comité de Convivencia
   ------------------------------------------------------------
   El contenido de cada queja (nombres, hechos, actuaciones, acuerdos) se
   cifra EN EL CELULAR con la clave del comité antes de salir:
     · AES-GCM de 256 bits (Web Crypto, el estándar del navegador).
     · La llave sale de la clave con PBKDF2-SHA256 (310.000 vueltas) y una
       "sal" aleatoria del comité: adivinar la clave probando es muy lento.
     · El servidor y la hoja de Google solo ven texto ilegible.
   Si el comité pierde la clave, las quejas NO se pueden recuperar: nadie
   (ni el administrador del portal) tiene otra copia.
   ============================================================ */
const Cifrado = (function () {
  const ITER = 310000;
  const VERIFICADOR = 'ssta-convivencia-ok';
  const sub = () => {
    const c = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;
    if (!c) throw new Error('Este navegador no permite cifrar (se necesita https o un navegador actualizado).');
    return c;
  };
  const azar = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
  function aB64(buf) {
    const b = new Uint8Array(buf); let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function deB64(t) { const s = atob(String(t || '')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  const hex = (b) => Array.prototype.map.call(b, (x) => ('0' + x.toString(16)).slice(-2)).join('');

  /* De la clave salen 512 bits (PBKDF2): los primeros 256 son la llave AES
     (nunca sale del celular) y los otros 256 son la "prueba" que el servidor
     pide para aceptar escrituras de quejas o cambios de clave. Con la prueba
     no se puede descifrar nada: son bloques independientes de PBKDF2. */
  async function derivar(clave, saltB64, iter) {
    const base = await sub().importKey('raw', new TextEncoder().encode(String(clave).normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await sub().deriveBits({ name: 'PBKDF2', salt: deB64(saltB64), iterations: iter || ITER, hash: 'SHA-256' }, base, 512));
    const key = await sub().importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    return { key, prueba: aB64(bits.slice(32)) };
  }
  /** llave = {kid, key, prueba}: el texto se cifra y se marca con el kid de ESA llave. */
  async function cifrarCon(llave, obj) {
    const iv = azar(12);
    const data = await sub().encrypt({ name: 'AES-GCM', iv }, llave.key, new TextEncoder().encode(JSON.stringify(obj)));
    return { v: 1, kid: llave.kid, iv: aB64(iv), data: aB64(data) };
  }
  async function descifrarCon(llave, blob) {
    if (blob.kid && llave.kid && blob.kid !== llave.kid) throw new Error('Esta queja está cifrada con otra clave del comité.');
    const plano = await sub().decrypt({ name: 'AES-GCM', iv: deB64(blob.iv) }, llave.key, deB64(blob.data));
    return JSON.parse(new TextDecoder().decode(plano));
  }
  /** Regla mínima: 10 caracteres con letras y números (es lo único que protege las quejas). */
  function claveDebil(clave) {
    const c = String(clave || '');
    if (c.length < 10) return 'Mínimo 10 caracteres.';
    if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) || !/\d/.test(c)) return 'Combina letras y números.';
    return '';
  }
  /** Clave nueva: devuelve {config (va al servidor), llave {kid, key, prueba} (queda en memoria)}. */
  async function crear(clave) {
    const d = claveDebil(clave); if (d) throw new Error(d);
    const kid = hex(azar(6)), salt = aB64(azar(16));
    const k = await derivar(clave, salt, ITER);
    const llave = { kid, key: k.key, prueba: k.prueba };
    const verif = await cifrarCon(llave, VERIFICADOR);
    return { config: { kid, salt, iter: ITER, verif: { iv: verif.iv, data: verif.data } }, llave };
  }
  /** Comprueba la clave con el verificador del comité. Devuelve la llave o lanza error. */
  async function abrir(clave, config) {
    if (!config || !config.salt || !config.verif) throw new Error('El comité todavía no tiene clave.');
    const k = await derivar(clave, config.salt, config.iter);
    const llave = { kid: config.kid, key: k.key, prueba: k.prueba };
    let ok = false;
    try { ok = (await descifrarCon(llave, config.verif)) === VERIFICADOR; } catch (e) { ok = false; }
    if (!ok) throw new Error('Clave incorrecta.');
    return llave;
  }
  /* ── v128: buzón reservado ──
     El trabajador no conoce la clave del comité, así que su queja se cifra con la LLAVE PÚBLICA
     del comité (RSA-OAEP 3072 + AES-GCM 256): cualquiera puede cifrar, pero solo se descifra con la
     llave privada, que el servidor guarda cifrada con la clave del comité. */
  const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
  async function huella(pub) { const d = await sub().digest('SHA-256', new TextEncoder().encode(String(pub.n))); return hex(new Uint8Array(d)).slice(0, 16); }
  /** Par nuevo del buzón: { publica (JWK, va al servidor tal cual), privadaCifrada (con la llave del comité), privada (CryptoKey en memoria) }. */
  async function parBuzon(llave) {
    const par = await sub().generateKey(Object.assign({ modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]) }, RSA), true, ['encrypt', 'decrypt']);
    const pub = await sub().exportKey('jwk', par.publicKey), pri = await sub().exportKey('jwk', par.privateKey);
    return { publica: { kty: 'RSA', n: pub.n, e: pub.e, alg: 'RSA-OAEP-256', ext: true }, privadaCifrada: await cifrarCon(llave, pri), privada: par.privateKey };
  }
  /** Abre la llave privada del buzón con la llave del comité. */
  async function abrirBuzon(llave, privadaCifrada) {
    const jwk = await descifrarCon(llave, privadaCifrada);
    return sub().importKey('jwk', jwk, RSA, false, ['decrypt']);
  }
  /** Vuelve a cifrar la llave privada con otra llave del comité (cambio de clave). */
  async function recifrarBuzon(llaveVieja, llaveNueva, privadaCifrada) { return cifrarCon(llaveNueva, await descifrarCon(llaveVieja, privadaCifrada)); }
  /** Lo que manda el formulario público: {v, kp, ek, iv, data}. */
  async function cifrarParaBuzon(publica, obj) {
    const pk = await sub().importKey('jwk', Object.assign({ key_ops: ['encrypt'] }, publica), RSA, false, ['encrypt']);
    const aes = await sub().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = azar(12);
    const data = await sub().encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(obj)));
    const ek = await sub().encrypt(RSA, pk, await sub().exportKey('raw', aes));
    return { v: 1, kp: await huella(publica), ek: aB64(ek), iv: aB64(iv), data: aB64(data) };
  }
  async function descifrarBuzon(privada, blob) {
    const raw = await sub().decrypt(RSA, privada, deB64(blob.ek));
    const aes = await sub().importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
    const plano = await sub().decrypt({ name: 'AES-GCM', iv: deB64(blob.iv) }, aes, deB64(blob.data));
    return JSON.parse(new TextDecoder().decode(plano));
  }
  return { ITER, crear, abrir, cifrar: cifrarCon, descifrar: descifrarCon, claveDebil, parBuzon, abrirBuzon, recifrarBuzon, cifrarParaBuzon, descifrarBuzon, huella, _b64: { aB64, deB64 } };
})();
