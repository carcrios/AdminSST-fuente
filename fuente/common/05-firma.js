/**
 * SignaturePad: lienzo táctil de firma (dibujar, deshacer trazo, borrar,
 * cargar una firma ya guardada). Antes esta misma lógica (~80 líneas)
 * vivía copiada y pegada en permiso-core.js Y en personal-autorizado.html
 * por separado — un arreglo hecho en un lado (como el bug de firmas que
 * quedaban invisibles al restaurar varias de golpe) había que acordarse
 * de repetirlo a mano en el otro. Ahora vive en un solo lugar y ambos
 * consumidores comparten la misma implementación.
 *
 * Cada página que la usa crea SU PROPIO manager (no hay estado global
 * compartido entre, por ejemplo, un permiso y el anexo de personal):
 *
 *   const sigMgr = SignaturePad.createManager({
 *     statusIdFor: (canvasId) => 'status_' + canvasId  // opcional, este es el default
 *   });
 *   sigMgr.setup(canvasEl);
 *   sigMgr.pads['idDelCanvas'].setDataUrl(firmaGuardada);
 *   sigMgr.refreshIn(contenedor); // ver nota de refreshSize más abajo
 *
 * IMPORTANTE sobre restaurar firmas guardadas en lote (varias filas a la
 * vez, ej. varios ejecutantes de un permiso ya abierto): llama primero
 * refreshIn()/setup() para que el lienzo tenga su tamaño real, y solo
 * después dibuja la firma con setDataUrl — si el <canvas> todavía no está
 * visible (contenedor recién mostrado, sección aún colapsada) su tamaño
 * puede ser 0x0 en ese instante y la firma se "dibuja" en un lienzo sin
 * tamaño, quedando invisible aunque el dato sí se guardó bien.
 */
const SignaturePad = {
  createManager(opts) {
    opts = opts || {};
    const statusIdFor = opts.statusIdFor || ((id) => 'status_' + id);
    const signedLabel = opts.signedLabel || 'Firmado ✓';
    const unsignedLabel = opts.unsignedLabel || 'Sin firmar';
    const pads = {};

    function markSigned(id) {
      const el = document.getElementById(statusIdFor(id));
      if (el) { el.textContent = signedLabel; el.classList.add('done', 'signed'); }
      const c = document.getElementById(id);
      if (c) c.classList.add('con-firma'); // quita la pista "Toca aquí para firmar"
    }
    function markUnsigned(id) {
      const el = document.getElementById(statusIdFor(id));
      if (el) { el.textContent = unsignedLabel; el.classList.remove('done', 'signed'); }
      const c = document.getElementById(id);
      if (c) c.classList.remove('con-firma');
    }

    function setup(canvas) {
      if (canvas.dataset.sigInit) return; // este MISMO elemento ya tiene sus listeners
      canvas.dataset.sigInit = '1';
      // En celular, tocar el recuadro abre la firma a pantalla completa (ver
      // FirmaCompleta). Se registra ANTES que los de dibujo para poder frenar
      // el trazo en el recuadro pequeño. En tablet o computador no hace nada.
      if (!canvas.dataset.completa) {
        canvas.addEventListener('touchstart', (e) => {
          if (canvas.dataset.locked === '1' || !FirmaCompleta.usar()) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          FirmaCompleta.abrir(canvas, pads[canvas.id]);
        }, { passive: false });
      }
      // willReadFrequently: true — le dice al navegador desde el inicio que este
      // lienzo se va a LEER seguido (getImageData para el historial de "deshacer",
      // toDataURL al guardar), no solo dibujar. Sin esto, el navegador por defecto
      // asume que el canvas es para dibujar-y-mostrar nada más, y lo maneja con
      // memoria de video (GPU) — en dispositivos con poca memoria y varias firmas
      // abiertas a la vez en la misma pantalla (los 5-6 recuadros de un permiso),
      // esa memoria de video puede liberarse en segundo plano para los lienzos que
      // quedan fuera de pantalla mientras se sigue llenando el formulario, dejando
      // el dibujo en blanco silenciosamente aunque el estado siga diciendo
      // "Firmado ✓" (ese estado es solo texto, no depende del contenido del
      // lienzo). Con willReadFrequently, el navegador usa memoria normal (CPU) en
      // vez de memoria de video, evitando ese vaciado.
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // Historial para "deshacer trazo".
      // ANTES se guardaba una FOTO completa del lienzo por cada trazo (hasta 15).
      // En una tablet de pantalla densa cada foto pesa ~7 MB sin comprimir, así
      // que un solo recuadro podía ocupar ~108 MB y un permiso con 9 firmas casi
      // 1 GB — suficiente para que el navegador matara y recargara la pestaña sin
      // avisar. Ahora se guardan los TRAZOS (las coordenadas por donde pasó el
      // dedo) y el lienzo se redibuja: unos pocos kilobytes, sin tope práctico,
      // y el deshacer queda exacto en vez de aproximado.
      let strokes = [];      // trazos dibujados en esta sesión, en píxeles CSS
      let baseImage = null;  // firma ya existente restaurada de fondo (si la hay)
      function redibujar() {
        const ratio = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (baseImage) {
          ctx.drawImage(baseImage, 0, 0, canvas.width / ratio, canvas.height / ratio);
        }
        strokes.forEach((s) => {
          if (!s.length) return;
          ctx.beginPath();
          ctx.moveTo(s[0][0], s[0][1]);
          if (s.length === 1) ctx.lineTo(s[0][0], s[0][1]); // toque suelto: punto
          else for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
          ctx.stroke();
        });
      }
      // Tamaño en pantalla (px CSS) para el que está armada la imagen interna.
      // Si el recuadro cambia de tamaño y la imagen interna no, el navegador la
      // estira para llenarlo y la raya ya no sale debajo del dedo.
      let tamCss = { w: 0, h: 0 };
      function resize() {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // aún oculto, se reintentará al mostrarse
        const ratio = window.devicePixelRatio || 1;
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1f2a33';
        tamCss = { w: rect.width, h: rect.height };
      }
      resize();

      /**
       * Deja la imagen interna del tamaño exacto del recuadro, conservando lo
       * ya firmado. SÍNCRONO a propósito: se llama al tocar el lienzo, y si
       * restaurara la firma en diferido (como antes, con una imagen que carga
       * después) podía borrar el trazo que se acababa de empezar.
       * Los trazos están guardados como coordenadas, así que se reescalan a la
       * nueva medida sin perder calidad ni el historial de "deshacer".
       */
      function ajustarTamano(forzar) {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const igual = Math.abs(r.width - tamCss.w) < 0.5 && Math.abs(r.height - tamCss.h) < 0.5;
        if (igual && !forzar) return;
        if (tamCss.w && tamCss.h && !igual) {
          const sx = r.width / tamCss.w;
          const sy = r.height / tamCss.h;
          strokes = strokes.map((s) => s.map(([x, y]) => [x * sx, y * sy]));
        }
        resize();
        redibujar();
      }

      // Vigila el tamaño REAL del recuadro, no el evento de girar: cubre el
      // giro (que en muchos Android termina después de que el evento avisa),
      // una sección que se despliega, la barra de desplazamiento que aparece…
      if (typeof ResizeObserver !== 'undefined') {
        let espera = null;
        new ResizeObserver(() => {
          clearTimeout(espera);
          espera = setTimeout(() => { if (!drawing) ajustarTamano(false); }, 60);
        }).observe(canvas);
      }
      let drawing = false, hasInk = false, lastX = 0, lastY = 0;
      function pos(e) {
        const r = canvas.getBoundingClientRect();
        const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
        return [cx, cy];
      }
      function start(e) {
        if (canvas.dataset.locked === '1') return;
        e.preventDefault();
        // Antes de poner el primer punto se confirma que la imagen interna
        // coincide con el recuadro. Es la garantía final: pase lo que pase con
        // los giros, el trazo sale donde está el dedo.
        ajustarTamano(false);
        const [x, y] = pos(e);
        strokes.push([[x, y]]); // arranca un trazo nuevo
        drawing = true;
        [lastX, lastY] = [x, y];
      }
      function move(e) {
        if (!drawing || canvas.dataset.locked === '1') return;
        e.preventDefault();
        const [x, y] = pos(e);
        // Se dibuja el segmento de una vez (rápido) Y se guarda el punto, para
        // poder redibujar el trazo completo si luego se deshace otro.
        const actual = strokes[strokes.length - 1];
        if (actual) actual.push([x, y]);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        [lastX, lastY] = [x, y];
        hasInk = true;
        markSigned(canvas.id);
      }
      function end() { drawing = false; }
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);
      // Si el sistema interrumpe el toque (una llamada, un gesto del borde),
      // antes el lienzo se quedaba "dibujando" y el siguiente toque unía los
      // dos trazos con una raya recta.
      canvas.addEventListener('touchcancel', end);

      /* Exporta la firma a una resolución acotada.
         POR QUÉ: el lienzo en pantalla se crea a (ancho CSS × devicePixelRatio).
         En una tablet grande de alta densidad eso da un lienzo enorme, y el PNG
         resultante puede superar los 50.000 caracteres — que es el MÁXIMO que
         Google Sheets admite en una sola celda. El backend guarda cada firma en
         una celda (hoja "Firmas", columna C), así que al pasarse, esa escritura
         falla y la firma se pierde EN SILENCIO: la fila del permiso ya quedó
         guardada con los nombres, pero sin las imágenes. Ese era el motivo de
         que las firmas hechas desde el computador (≈18-49k) sí quedaran y las
         de la tablet (≈63-117k) no.
         Se reduce el tamaño hasta quedar cómodamente bajo el límite. Una firma
         es un trazo simple, así que bajar la resolución no afecta su lectura ni
         su validez como constancia. */
      function exportarFirmaAcotada() {
        const MAX_CARACTERES = 45000; // margen de seguridad bajo el tope de 50.000
        const ANCHO_OBJETIVO = 700;   // px reales; suficiente para un trazo nítido
        let escala = Math.min(1, ANCHO_OBJETIVO / (canvas.width || 1));
        let ultima = null;
        for (let intento = 0; intento < 6; intento++) {
          const w = Math.max(1, Math.round(canvas.width * escala));
          const h = Math.max(1, Math.round(canvas.height * escala));
          const tmp = document.createElement('canvas');
          tmp.width = w;
          tmp.height = h;
          const tctx = tmp.getContext('2d');
          tctx.drawImage(canvas, 0, 0, w, h);
          ultima = tmp.toDataURL('image/png');
          if (ultima.length <= MAX_CARACTERES) return ultima;
          escala *= 0.75; // todavía muy grande: se reduce otro poco y se reintenta
        }
        return ultima;
      }

      pads[canvas.id] = {
        clear: () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          strokes = [];
          baseImage = null;
          hasInk = false;
          markUnsigned(canvas.id);
        },
        undo: () => {
          // Quita el último trazo y redibuja el resto sobre la firma de fondo
          // (si el permiso traía una firma ya guardada, esa no se puede deshacer:
          // deshacer solo aplica a lo dibujado en esta sesión).
          strokes.pop();
          redibujar();
          if (!strokes.length && !baseImage) {
            hasInk = false;
            markUnsigned(canvas.id);
          }
        },
        getDataUrl: () => (hasInk ? exportarFirmaAcotada() : null),
        setDataUrl: (url) => {
          if (!url) return;
          hasInk = true;
          markSigned(canvas.id);
          const img = new Image();
          img.onload = () => {
            // Pasa a ser el fondo sobre el que se dibujan los trazos nuevos.
            baseImage = img;
            strokes = [];
            redibujar();
          };
          img.src = url;
        },
        hasInk: () => hasInk,
        /** Trazos de esta sesión, en px CSS, con la medida del lienzo donde se hicieron. */
        getStrokes: () => ({
          strokes: strokes.map((t) => t.map((pt) => [pt[0], pt[1]])),
          w: tamCss.w,
          h: tamCss.h,
          base: !!baseImage
        }),
        /**
         * Reemplaza lo firmado por estos trazos, ajustados a ESTE lienzo sin
         * deformarlos: se escala igual a lo ancho y a lo alto (una firma hecha
         * en pantalla completa horizontal no queda aplastada en un recuadro
         * vertical) y se centra. Nunca se agranda más allá del trazo original.
         */
        setStrokes: (lista) => {
          ajustarTamano(false);
          const pts = [];
          (lista || []).forEach((t) => t.forEach((pt) => pts.push(pt)));
          baseImage = null;
          if (!pts.length) {
            strokes = [];
            hasInk = false;
            redibujar();
            markUnsigned(canvas.id);
            return;
          }
          const xs = pts.map((pt) => pt[0]), ys = pts.map((pt) => pt[1]);
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
          const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);
          const margen = 10;
          const k = Math.min((tamCss.w - 2 * margen) / bw, (tamCss.h - 2 * margen) / bh, 1);
          const dx = (tamCss.w - bw * k) / 2 - minX * k;
          const dy = (tamCss.h - bh * k) / 2 - minY * k;
          strokes = lista.map((t) => t.map((pt) => [pt[0] * k + dx, pt[1] * k + dy]));
          hasInk = true;
          redibujar();
          markSigned(canvas.id);
        },
        // ⚠️ A diferencia de la versión anterior (donde solo el manejador de
        // rotación de pantalla preservaba la firma), refreshSize() SIEMPRE
        // guarda la firma actual antes de redimensionar y la vuelve a
        // dibujar después — fijar canvas.width/height limpia el bitmap, así
        // que sin esto, cualquier llamado a refreshIn() sobre un canvas ya
        // firmado borraría la firma en silencio (el estado seguiría
        // diciendo "Firmado ✓" pero el lienzo quedaría en blanco). Ahora es
        // seguro llamarlo en cualquier momento, sin importar el orden.
        // Usa la copia a resolución completa (no la recortada de getDataUrl),
        // para que girar la pantalla varias veces no degrade la firma.
        refreshSize: () => ajustarTamano(true)
      };
      if (!canvas.dataset.completa) canvas._pad = pads[canvas.id];   // v140: «Firmar sin dibujar» lo usa
    }

    function refreshIn(container) {
      if (!container) return;
      container.querySelectorAll('canvas.pad, canvas.mini-pad').forEach((c) => {
        if (pads[c.id]) pads[c.id].refreshSize();
      });
    }

    /** Registra el reintento de tamaño al girar el celular (con espera para
     *  no recalcular a medio giro). Llamar una sola vez por manager. */
    function bindOrientationChange() {
      // Solo reajusta el tamaño de los lienzos al girar. Volver al recuadro
      // que se estaba firmando lo hace AnclaGiro (más abajo), que funciona
      // en todas las páginas aunque no tengan lienzos.
      let timer = null;
      window.addEventListener('orientationchange', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          Object.keys(pads).forEach((id) => pads[id].refreshSize());
        }, 120);
      });
    }

    return { pads, setup, refreshIn, bindOrientationChange };
  },
  /** Bloquea un lienzo (modo consulta / permiso ya cerrado) — no depende
   *  del manager, se puede llamar directo sobre el <canvas>. */
  lock(canvas) {
    canvas.dataset.locked = '1';
    canvas.classList.add('locked');
  }
};

/**
 * ScrollProgress: barra fina y fija arriba de la pantalla que muestra
 * cuánto lleva recorrido el usuario del formulario — información real
