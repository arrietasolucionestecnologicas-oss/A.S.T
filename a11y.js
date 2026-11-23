// A.S.T. 2.1 — Accesibilidad: nombre para botones de solo ícono, etiqueta para campos sin etiqueta y «Cerrar» en los modales.
// Corre al cargar, al abrir cada modal y cuando la pantalla se redibuja (con un pequeño retraso para no gastar batería).
(function () {
  'use strict';
  const ICONOS = [
    [/bi-trash/, 'Eliminar'], [/bi-pencil|bi-pen\b/, 'Editar'], [/bi-share/, 'Compartir'], [/bi-x(-lg|-circle)?\b/, 'Cerrar'], [/bi-plus/, 'Agregar'], [/bi-eye/, 'Ver'],
    [/bi-whatsapp/, 'Enviar por WhatsApp'], [/bi-clock-history/, 'Ver historial'], [/bi-copy|bi-clipboard/, 'Copiar'], [/bi-download/, 'Descargar'], [/bi-file-earmark-pdf|bi-filetype-pdf/, 'Abrir PDF'],
    [/bi-arrow-repeat|bi-arrow-clockwise/, 'Actualizar'], [/bi-search/, 'Buscar'], [/bi-check/, 'Confirmar'], [/bi-link/, 'Copiar enlace'], [/bi-three-dots/, 'Más opciones'], [/bi-camera/, 'Cámara'],
    [/bi-calendar/, 'Fecha'], [/bi-chevron-left|bi-arrow-left/, 'Anterior'], [/bi-chevron-right|bi-arrow-right/, 'Siguiente'], [/bi-chevron-up|bi-arrow-up/, 'Subir'], [/bi-chevron-down|bi-arrow-down/, 'Bajar'],
    [/bi-gear|bi-sliders/, 'Configuración'], [/bi-cart/, 'Carrito'], [/bi-upload/, 'Subir archivo'], [/bi-printer/, 'Imprimir'], [/bi-telephone/, 'Llamar'], [/bi-geo/, 'Ubicación'], [/bi-star/, 'Destacar']
  ];
  const texto = e => (e && (e.innerText || e.textContent) || '').replace(/\s+/g, ' ').trim();
  function nombreDeIcono(b) {
    const i = b.querySelector('i[class*="bi-"]'); if (!i) return '';
    const c = i.className; for (const [re, n] of ICONOS) if (re.test(c)) return n; return '';
  }
  function etiquetaCampo(c) {
    if (c.id) { const l = document.querySelector('label[for="' + c.id + '"]'); if (l && texto(l)) return texto(l); }
    const envol = c.closest('label'); if (envol && texto(envol)) return texto(envol).slice(0, 60);
    let n = c.previousElementSibling; for (let k = 0; n && k < 3; k++, n = n.previousElementSibling) { if (n.matches('label,.small,small,.form-label') && texto(n)) return texto(n).slice(0, 60); }
    const caja = c.closest('.mb-3,.mb-2,.col,[class*="col-"],.form-group,.input-group,div'); if (caja) { const l = caja.querySelector('label,.small,small,.form-label'); if (l && texto(l) && !l.contains(c)) return texto(l).slice(0, 60); }
    if (c.placeholder) return c.placeholder; if (c.title) return c.title;
    return (c.name || c.id || '').replace(/[-_]+/g, ' ').trim();
  }
  function arreglar(raiz) {
    raiz = raiz || document;
    raiz.querySelectorAll('.btn-close:not([aria-label])').forEach(b => b.setAttribute('aria-label', 'Cerrar'));
    raiz.querySelectorAll('button:not([aria-label]):not([title]), a[href]:not([aria-label]):not([title]), [role=button]:not([aria-label]):not([title])').forEach(b => {
      if (texto(b)) return; const n = nombreDeIcono(b); if (n) b.setAttribute('aria-label', n);
    });
    raiz.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([aria-label]), select:not([aria-label]), textarea:not([aria-label])').forEach(c => {
      const hay = (c.id && document.querySelector('label[for="' + c.id + '"]')) || c.closest('label'); if (hay) return;
      const t = etiquetaCampo(c); if (t) c.setAttribute('aria-label', t);
    });
  }
  window.AST_A11Y = { arreglar: arreglar };
  let t = null; const programar = () => { clearTimeout(t); t = setTimeout(() => { try { arreglar(document); } catch (e) {} }, 250); };
  document.addEventListener('shown.bs.modal', programar);
  const iniciar = () => { arreglar(document); try { new MutationObserver(programar).observe(document.body, { childList: true, subtree: true }); } catch (e) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
