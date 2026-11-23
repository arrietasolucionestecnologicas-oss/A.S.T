// A.S.T. Fase 1 (aislado): sesión, selector de clientes, cuenta de cobro rápida, carrito por tipo de documento, ayudas móviles.
// Se carga DESPUÉS de app.js y sustituye funciones concretas (no se reescribe app.js).
(function () {
  'use strict';
  const VERSION = '1.4-fase1';
  window.AST_VERSION = VERSION;
  const PUBLICAS = ['login', 'getPublicCatalog', 'version'];
  const CON_CONFIRMAR = ['deleteProduct', 'deleteProject', 'deleteDocument'];
  const SESION_ERR = ['NO_AUTENTICADO', 'SESION_VENCIDA', 'SESION_REVOCADA'];
  const $ = id => document.getElementById(id);
  const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const nativo = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const plug = n => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins[n];
  const aviso = (m, t) => { try { showToast(m, t || 'info'); } catch (e) { console.log(m); } };

  // ---------- 1. Token de sesión: Keystore de Android (SecureStoragePlugin) en la app; sessionStorage (o localStorage si se pide recordar) en la web ----------
  let tokenMem = null;
  async function guardarToken(t, recordar) {
    tokenMem = t;
    try { if (nativo() && plug('SecureStoragePlugin')) await plug('SecureStoragePlugin').set({ key: 'ast_token', value: t }); else (recordar ? localStorage : sessionStorage).setItem('ast_token', t); } catch (e) { console.error('guardarToken', e); }
  }
  async function leerToken() {
    if (tokenMem) return tokenMem;
    try { if (nativo() && plug('SecureStoragePlugin')) { const r = await plug('SecureStoragePlugin').get({ key: 'ast_token' }); tokenMem = r && r.value || null; } else tokenMem = sessionStorage.getItem('ast_token') || localStorage.getItem('ast_token'); } catch (e) { tokenMem = null; }
    return tokenMem;
  }
  async function borrarToken() {
    tokenMem = null;
    try { if (nativo() && plug('SecureStoragePlugin')) await plug('SecureStoragePlugin').remove({ key: 'ast_token' }); } catch (e) {}
    try { sessionStorage.removeItem('ast_token'); localStorage.removeItem('ast_token'); } catch (e) {}
  }

  // ---------- 2. callApi con sesión. El contrato de errores es {success:false, error:{codigo,mensaje}}; aquí se aplana a error (texto) + codigo para no romper los llamadores actuales ----------
  let enLogin = false, cola = [];
  window.callApi = async function (action, payload) {
    payload = Object.assign({}, payload || {});
    if (action === 'createDocument' && !payload.idSolicitud) payload.idSolicitud = uuid();
    if (CON_CONFIRMAR.indexOf(action) >= 0) payload.confirmar = true;    // todas las rutas de la interfaz piden confirmación antes de llamar
    const token = PUBLICAS.indexOf(action) >= 0 ? null : await leerToken();
    if (!token && PUBLICAS.indexOf(action) < 0) { mostrarLogin(); return { success: false, error: 'Inicia sesión.', codigo: 'NO_AUTENTICADO' }; }
    try {
      const resp = await fetch(window.API_URL_ACTIVA || API_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, token: token, payload: payload }) });
      const r = await resp.json();
      const dot = $('connection-status'); if (dot) dot.className = 'status-dot bg-success';
      if (r && r.success === false && r.error && typeof r.error === 'object') {
        const c = r.error.codigo; const out = { success: false, error: r.error.mensaje || 'Error', codigo: c, extra: r.error };
        if (SESION_ERR.indexOf(c) >= 0) { await borrarToken(); mostrarLogin(r.error.mensaje); } else if (c === 'APP_OBSOLETA') mostrarObsoleta(r.error.mensaje);
        return out;
      }
      return r;
    } catch (e) {
      console.error('Error API:', e); const dot = $('connection-status'); if (dot) dot.className = 'status-dot bg-danger';
      return { success: false, error: 'Sin conexión con el servidor.', codigo: 'SIN_RED' };
    }
  };

  // ---------- 3. Pantalla de acceso ----------
  // El "focus trap" de los modales de Bootstrap le quitaba el foco al buscador (el teclado no se abría): se detiene focusin antes de que llegue a document.
  function crearOverlay(id, html) { let o = $(id); if (!o) { o = document.createElement('div'); o.id = id; o.className = 'f1-overlay'; o.addEventListener('focusin', e => e.stopPropagation()); document.body.appendChild(o); } o.innerHTML = html; o.style.display = 'flex'; return o; }
  function mostrarObsoleta(msg) { crearOverlay('f1-obsoleta', '<div class="f1-card"><h2>Actualiza la app</h2><p>' + (msg || 'Esta versión ya no tiene acceso.') + '</p><p class="f1-peq">Versión instalada: ' + VERSION + '</p></div>'); }
  function mostrarLogin(msg) {
    if (!msg) { try { msg = localStorage.getItem('ast_aviso_login') || ''; localStorage.removeItem('ast_aviso_login'); } catch (e) {} }
    if (enLogin) { const e = $('f1-login-msg'); if (e && msg) e.textContent = msg; return; }
    enLogin = true;
    const o = crearOverlay('f1-login', '<form class="f1-card" id="f1-login-form" autocomplete="on"><h2>A.S.T.</h2><p class="f1-peq">Ingresa para continuar</p>' +
      '<label for="f1-user">Usuario</label><input id="f1-user" name="username" type="text" autocomplete="username" autocapitalize="none" value="admin" required>' +
      '<label for="f1-pass">Clave</label><input id="f1-pass" name="password" type="password" autocomplete="current-password" required>' +
      '<label class="f1-chk"><input type="checkbox" id="f1-rec"> Recordar en este dispositivo (web)</label>' +
      '<div id="f1-login-msg" class="f1-error" role="alert">' + (msg || '') + '</div><button id="f1-entrar" class="btn btn-lg w-100 f1-btn-primario" type="submit">Entrar</button><p class="f1-peq">Versión ' + VERSION + '</p></form>');
    $('f1-login-form').addEventListener('submit', async ev => {
      ev.preventDefault(); const b = $('f1-entrar'); if (b.disabled) return; b.disabled = true; b.textContent = 'Entrando…'; $('f1-login-msg').textContent = '';
      const r = await window.callApi('login', { usuario: $('f1-user').value, clave: $('f1-pass').value, dispositivo: (nativo() ? 'app-android ' : 'web ') + VERSION });
      b.disabled = false; b.textContent = 'Entrar';
      if (r.success) { await guardarToken(r.data.token, $('f1-rec').checked); $('f1-pass').value = ''; o.style.display = 'none'; enLogin = false; iniciarDatos(); }
      else $('f1-login-msg').textContent = r.codigo === 'DEMASIADOS_INTENTOS' ? 'Demasiados intentos. Espera ' + Math.ceil(((r.extra && r.extra.reintentarEnSeg) || 900) / 60) + ' min.' : r.error;
    });
  }
  function iniciarDatos() { try { fetchAllDataBackground(); scheduleRecurringPaymentReminders(); scheduleCameraMaintenanceReminders(); } catch (e) { console.error(e); } }
  window.cerrarSesionAST = async function () {
    if (!confirm('¿Cerrar sesión en este dispositivo?')) return;
    await window.callApi('logout', {}); await borrarToken();
    Object.keys(localStorage).filter(k => k.indexOf('ast_') === 0 && k !== 'ast_token').forEach(k => localStorage.removeItem(k)); location.reload();
  };

  // ---------- 3b. Cambiar mi clave (la inicial es larga y aleatoria; aquí el dueño pone una que recuerde) ----------
  window.cambiarClaveAST = function () {
    if (!$('f1-clave-modal')) {
      const d = document.createElement('div'); d.className = 'modal fade'; d.id = 'f1-clave-modal'; d.tabIndex = -1;
      d.innerHTML = '<div class="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down"><div class="modal-content bg-dark-panel border-cyan"><div class="modal-header border-secondary"><h5 class="modal-title text-cyan">Cambiar mi clave</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body">' +
        '<form id="f1-clave-form" autocomplete="off"><div class="f1-paso"><label for="f1-clave-act">Clave actual</label><input type="password" id="f1-clave-act" autocomplete="current-password"></div>' +
        '<div class="f1-paso"><label for="f1-clave-nueva">Clave nueva (mínimo 16 caracteres)</label><input type="password" id="f1-clave-nueva" autocomplete="new-password"><small class="f1-peq">Una frase fácil de recordar sirve: varias palabras juntas, con 16 o más caracteres, mejor que una clave corta con símbolos.</small></div>' +
        '<div class="f1-paso"><label for="f1-clave-rep">Repite la clave nueva</label><input type="password" id="f1-clave-rep" autocomplete="new-password"></div>' +
        '<label class="f1-peq" style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" id="f1-clave-ver"> Mostrar las claves</label>' +
        '<div id="f1-clave-msg" class="f1-error" role="alert"></div><button type="submit" id="f1-clave-ok" class="btn btn-lg w-100 f1-btn-primario">Guardar clave nueva</button><small class="f1-peq">Al cambiarla se cierra la sesión en todos tus dispositivos y entras de nuevo con la clave nueva.</small></form></div></div></div>';
      document.body.appendChild(d);
      $('f1-clave-ver').onchange = e => ['f1-clave-act', 'f1-clave-nueva', 'f1-clave-rep'].forEach(i => { $(i).type = e.target.checked ? 'text' : 'password'; });
      $('f1-clave-form').addEventListener('submit', async ev => {
        ev.preventDefault(); const m = $('f1-clave-msg'), b = $('f1-clave-ok'); if (b.disabled) return; m.textContent = '';
        const a = $('f1-clave-act').value, n = $('f1-clave-nueva').value, r = $('f1-clave-rep').value;
        if (!a) { m.textContent = 'Escribe tu clave actual.'; return; }
        if (n.length < 16) { m.textContent = 'La clave nueva debe tener al menos 16 caracteres (ahora tiene ' + n.length + ').'; return; }
        if (n !== r) { m.textContent = 'Las dos claves nuevas no coinciden.'; return; }
        if (n === a) { m.textContent = 'La clave nueva debe ser distinta de la actual.'; return; }
        b.disabled = true; b.textContent = 'Guardando…';
        const res = await window.callApi('cambiarClave', { claveActual: a, claveNueva: n });
        b.disabled = false; b.textContent = 'Guardar clave nueva';
        if (!res.success) { m.textContent = res.codigo === 'CREDENCIALES_INVALIDAS' ? 'La clave actual no es correcta.' : (res.error || 'No se pudo cambiar la clave.'); return; }
        await borrarToken(); try { localStorage.setItem('ast_aviso_login', 'Clave cambiada. Entra con la clave nueva.'); } catch (e) {}
        Object.keys(localStorage).filter(k => k.indexOf('ast_') === 0 && k !== 'ast_aviso_login').forEach(k => localStorage.removeItem(k)); location.reload();
      });
    }
    $('f1-clave-form').reset(); $('f1-clave-msg').textContent = ''; bootstrap.Modal.getOrCreateInstance($('f1-clave-modal')).show();
  };

  // ---------- 4. Documentos privados: se abren/comparten bajo demanda (sin enlace público) ----------
  function b64aBlob(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: 'application/pdf' }); }
  async function compartirOAbrir(ref, compartir) {
    aviso('Preparando el documento…');
    const r = await window.callApi('getDocumentoPdf', ref); if (!r.success) return aviso('No se pudo abrir: ' + r.error, 'danger');
    try {
      if (nativo() && plug('Filesystem') && plug('Share')) {
        const f = await plug('Filesystem').writeFile({ path: r.data.nombre.replace(/[^\w.\- ]/g, '_'), data: r.data.base64, directory: 'CACHE' });
        await plug('Share').share({ title: r.data.nombre, url: f.uri, dialogTitle: compartir ? 'Enviar documento' : 'Abrir documento' });
      } else window.open(URL.createObjectURL(b64aBlob(r.data.base64)), '_blank');
    } catch (e) { if (!/cancel/i.test(String(e))) aviso('No se pudo abrir el PDF.', 'danger'); }
  }
  window.abrirPdfPrivado = ref => compartirOAbrir(ref, false);
  window.enviarPdfPrivado = ref => compartirOAbrir(ref, true);
  const _openExt = window.openExternalUrl;
  window.openExternalUrl = function (url) { const m = String(url || '').match(/drive\.google\.com\/file\/d\/([^/?#]+)/); if (m) return compartirOAbrir({ fileId: m[1] }, false); return _openExt ? _openExt(url) : window.open(url, '_blank'); };
  async function enviarEnlaceWhatsApp(consecutivo, telefono, texto) {
    const r = await window.callApi('compartirDocumento', { consecutivo: consecutivo }); if (!r.success) return aviso('No se pudo crear el enlace: ' + r.error, 'danger');
    abrirWhatsAppTexto(String(telefono || '').replace(/\D/g, '').slice(-10), texto + ' ' + r.data.url);
  }

  // ---------- 5. Selector de clientes ----------
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(s ?a ?s|s\.a\.s|ltda|e ?u|sa)\b\.?/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const dig = s => String(s || '').replace(/\D/g, '');
  let cbCliente = null;
  function buscarClientes(q) {
    const qn = norm(q), qd = dig(q), toks = qn.split(' ').filter(Boolean);
    const lista = (typeof clients !== 'undefined' ? clients : []);
    if (!toks.length && qd.length < 3) return lista.slice(0, 40);
    return lista.filter(c => { const n = norm(c.nombre); return (toks.length && toks.every(t => n.indexOf(t) >= 0)) || (qd.length >= 3 && (dig(c.nit).indexOf(qd) >= 0 || dig(c.telefono).indexOf(qd) >= 0)); }).slice(0, 40);
  }
  function buscarDuplicado(nombre, nit) {
    const nn = norm(nombre), nd = dig(nit); return (typeof clients !== 'undefined' ? clients : []).find(c => (nn && norm(c.nombre) === nn) || (nd.length >= 5 && dig(c.nit) === nd));
  }
  function pintarResultados() {
    const q = $('f1-cl-q').value, res = buscarClientes(q), box = $('f1-cl-res');
    box.innerHTML = res.length ? res.map((c, i) => '<button type="button" class="f1-cl-item" data-i="' + i + '"><b>' + esc1(c.nombre) + '</b><span>' + esc1([c.nit, c.telefono].filter(Boolean).join(' · ') || 'sin NIT ni teléfono') + '</span></button>').join('') : '<p class="f1-vacio">Sin resultados para «' + esc1(q) + '». Usa «+ Cliente nuevo».</p>';
    box.querySelectorAll('.f1-cl-item').forEach(b => b.addEventListener('click', () => elegir(res[+b.dataset.i])));
  }
  const esc1 = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function elegir(c) { const f = cbCliente; cerrarSelector(); if (f) f(c); }
  function cerrarSelector() { const o = $('f1-cliente'); if (o) o.style.display = 'none'; document.body.classList.remove('f1-sin-scroll'); }
  window.abrirSelectorCliente = function (alElegir) {
    cbCliente = alElegir;
    const o = crearOverlay('f1-cliente', '<div class="f1-hoja" role="dialog" aria-label="Elegir cliente"><div class="f1-hoja-cab"><button type="button" id="f1-cl-x" class="f1-icono" aria-label="Cerrar">✕</button>' +
      '<input id="f1-cl-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Buscar por nombre, NIT o teléfono"><button type="button" id="f1-cl-nuevo" class="f1-btn-primario">+ Nuevo</button></div>' +
      '<div id="f1-cl-res" class="f1-cl-res"></div>' +
      '<form id="f1-cl-form" class="f1-cl-form" style="display:none"><h3>Cliente nuevo</h3><input id="f1-n-nom" placeholder="Nombre o razón social *" autocomplete="off"><input id="f1-n-nit" placeholder="NIT o cédula (opcional)" inputmode="numeric" autocomplete="off"><input id="f1-n-tel" placeholder="Teléfono (opcional)" inputmode="tel" autocomplete="off">' +
      '<div id="f1-n-msg" class="f1-error" role="alert"></div><div id="f1-n-dup"></div><button type="submit" class="f1-btn-primario">Guardar y usar</button><button type="button" id="f1-n-cancel" class="f1-btn-sec">Volver a la lista</button></form></div>');
    document.body.classList.add('f1-sin-scroll');
    $('f1-cl-x').onclick = cerrarSelector; $('f1-cl-q').addEventListener('input', pintarResultados);
    $('f1-cl-nuevo').onclick = () => { $('f1-cl-res').style.display = 'none'; $('f1-cl-form').style.display = 'flex'; $('f1-n-nom').value = $('f1-cl-q').value; $('f1-n-nom').focus(); };
    $('f1-n-cancel').onclick = () => { $('f1-cl-form').style.display = 'none'; $('f1-cl-res').style.display = 'block'; };
    $('f1-cl-form').addEventListener('submit', ev => {
      ev.preventDefault(); const nom = $('f1-n-nom').value.trim().replace(/\s+/g, ' '), nit = $('f1-n-nit').value.trim(), tel = $('f1-n-tel').value.trim(), msg = $('f1-n-msg'); $('f1-n-dup').innerHTML = ''; msg.textContent = '';
      if (nom.length < 3) { msg.textContent = 'Escribe el nombre del cliente (mínimo 3 letras).'; return; }
      if (nit && dig(nit).length < 5) { msg.textContent = 'El NIT o cédula parece incompleto.'; return; }
      if (tel && (dig(tel).length < 7 || dig(tel).length > 12)) { msg.textContent = 'El teléfono debe tener entre 7 y 12 dígitos.'; return; }
      const dup = buscarDuplicado(nom, nit);
      if (dup) { msg.textContent = 'Ya existe un cliente igual o parecido: ' + dup.nombre; $('f1-n-dup').innerHTML = '<button type="button" id="f1-n-usar" class="f1-btn-sec">Usar «' + esc1(dup.nombre) + '»</button>'; $('f1-n-usar').onclick = () => elegir(dup); return; }
      const nuevo = { nombre: nom, nit: nit, telefono: tel }; if (typeof clients !== 'undefined') clients.unshift(nuevo); elegir(nuevo);
    });
    pintarResultados(); setTimeout(() => $('f1-cl-q').focus(), 150);
  };
  function aplicarCliente(prefijo, input, c) {
    input.value = c.nombre;
    if (prefijo === 'c') { $('c-nit').value = c.nit || ''; $('c-tel').value = c.telefono || ''; }
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function engancharSelectores() {
    [['c-nombre', 'c'], ['np-cliente', 'np'], ['ep-cliente', 'ep']].forEach(([id, p]) => {
      const el = $(id); if (!el || el.dataset.f1) return; el.dataset.f1 = '1'; el.removeAttribute('list'); el.readOnly = true; el.setAttribute('inputmode', 'none'); el.placeholder = 'Toca para elegir o crear cliente'; el.classList.add('f1-campo-toque');
      el.addEventListener('click', () => window.abrirSelectorCliente(c => aplicarCliente(p, el, c)));
    });
  }

  // ---------- 6. Cuenta de cobro rápida ----------
  const monto = s => { const d = dig(s); return d ? parseInt(d, 10) : 0; };
  const pesos = n => (typeof fmt !== 'undefined' ? fmt.format(n) : '$ ' + n);
  const itemVacio = () => ({ uuid: uuid(), concepto: '', cantidad: 1, valor: 0 });
  const est = { cliente: null, items: [itemVacio()], valor: 0, abonos: 0, idSolicitud: null, huella: '', enVuelo: false, resultado: null };
  const totalItems = () => est.items.reduce((t, i) => t + (i.cantidad || 0) * (i.valor || 0), 0);
  const resumenConceptos = () => est.items.map(i => i.concepto.trim()).filter(Boolean).join('; ');
  function huella() { return JSON.stringify([est.cliente && est.cliente.nombre, est.items.map(i => [i.concepto, i.cantidad, i.valor]), est.abonos]); }
  function leerItemsDelForm() {   // sincroniza lo escrito en pantalla con el estado (antes de agregar/quitar un ítem)
    document.querySelectorAll('#ccr-items .ccr-item').forEach((el, k) => { const it = est.items[k]; if (!it) return; it.concepto = el.querySelector('.ccr-concepto').value; it.cantidad = monto(el.querySelector('.ccr-cant').value) || 0; it.valor = monto(el.querySelector('.ccr-val').value); });
  }
  function pintarItemsCCR() {
    $('ccr-items').innerHTML = est.items.map((it, k) => '<div class="f1-tarjeta ccr-item" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center"><small>Ítem ' + (k + 1) + '</small>' + (est.items.length > 1 ? '<button type="button" class="btn btn-sm btn-outline-danger ccr-quitar" data-k="' + k + '" aria-label="Quitar ítem ' + (k + 1) + '" style="min-height:44px;min-width:44px">Quitar</button>' : '') + '</div>' +
      '<label>Concepto</label><textarea class="ccr-concepto" rows="2" maxlength="300" placeholder="Ej: Cambio de breaker y revisión de tablero">' + esc1(it.concepto) + '</textarea>' +
      '<div style="display:flex;gap:8px"><div style="flex:1"><label>Cantidad</label><input class="ccr-cant" inputmode="numeric" autocomplete="off" value="' + (it.cantidad || '') + '"></div><div style="flex:2"><label>Valor unitario (COP)</label><input class="ccr-val" inputmode="numeric" autocomplete="off" placeholder="0" value="' + (it.valor || '') + '"></div></div>' +
      '<small class="ccr-sub"></small></div>').join('');
    document.querySelectorAll('#ccr-items .ccr-quitar').forEach(b => b.onclick = () => { leerItemsDelForm(); est.items.splice(Number(b.dataset.k), 1); pintarItemsCCR(); actCCR(); });
    document.querySelectorAll('#ccr-items input, #ccr-items textarea').forEach(e => e.addEventListener('input', actCCR));
    actCCR();
  }
  function actCCR() {
    leerItemsDelForm(); est.valor = totalItems(); est.abonos = monto(($('ccr-abonos') || {}).value);
    document.querySelectorAll('#ccr-items .ccr-item').forEach((el, k) => { const it = est.items[k]; el.querySelector('.ccr-sub').innerHTML = 'Subtotal <b>' + pesos((it.cantidad || 0) * (it.valor || 0)) + '</b>'; });
    const r = $('ccr-res'); if (r) r.innerHTML = 'Valor total <b>' + pesos(est.valor) + '</b> · Abonos <b>' + pesos(est.abonos) + '</b> · Saldo pendiente <b>' + pesos(Math.max(0, est.valor - est.abonos)) + '</b>';
  }
  function crearModalCCR() {
    if ($('ccrModal')) return;
    const d = document.createElement('div'); d.className = 'modal fade'; d.id = 'ccrModal'; d.tabIndex = -1;
    d.innerHTML = '<div class="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down"><div class="modal-content bg-dark-panel border-cyan"><div class="modal-header border-secondary"><h5 class="modal-title text-cyan">Cuenta de cobro rápida</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body" id="ccr-cuerpo"></div></div></div>';
    document.body.appendChild(d);
  }
  function pintarCCR(paso) {
    const c = $('ccr-cuerpo'), saldo = est.valor - est.abonos;
    if (paso === 'form') {
      c.innerHTML = '<div class="f1-paso"><label>1. Cliente</label><button type="button" id="ccr-cli" class="f1-campo-boton">' + (est.cliente ? '<b>' + esc1(est.cliente.nombre) + '</b><span>' + esc1([est.cliente.nit, est.cliente.telefono].filter(Boolean).join(' · ')) + '</span>' : 'Toca para elegir o crear cliente') + '</button></div>' +
        '<div class="f1-paso"><label>2. Qué se cobra (puedes agregar varios ítems)</label><div id="ccr-items"></div><button type="button" id="ccr-agregar" class="btn btn-lg w-100 f1-btn-sec">+ Agregar otro ítem</button></div>' +
        '<div class="f1-paso"><label for="ccr-abonos">3. Abonos recibidos (opcional)</label><input id="ccr-abonos" inputmode="numeric" autocomplete="off" placeholder="0" value="' + (est.abonos || '') + '"></div>' +
        '<div class="f1-resumen" id="ccr-res"></div><div id="ccr-err" class="f1-error" role="alert"></div><button type="button" id="ccr-revisar" class="btn btn-lg w-100 f1-btn-primario">Revisar</button>';
      $('ccr-cli').onclick = () => { leerItemsDelForm(); window.abrirSelectorCliente(cl => { est.cliente = cl; pintarCCR('form'); }); };
      pintarItemsCCR(); $('ccr-abonos').addEventListener('input', actCCR);
      $('ccr-agregar').onclick = () => { leerItemsDelForm(); if (est.items.length >= 15) { $('ccr-err').textContent = 'Máximo 15 ítems por cuenta de cobro.'; return; } est.items.push(itemVacio()); pintarItemsCCR(); const ult = document.querySelectorAll('#ccr-items .ccr-concepto'); if (ult.length) ult[ult.length - 1].focus(); };
      $('ccr-revisar').onclick = () => { actCCR(); const e = validarCCR(); if (e) { $('ccr-err').textContent = e; return; } if (est.huella !== huella()) { est.idSolicitud = uuid(); est.huella = huella(); } pintarCCR('revisar'); };
    } else if (paso === 'revisar') {
      c.innerHTML = '<div class="f1-tarjeta"><div><small>Cliente</small><b>' + esc1(est.cliente.nombre) + '</b></div><div><small>Ítems</small>' + est.items.map(i => '<b style="display:block">' + esc1(i.concepto.trim()) + ' — ' + i.cantidad + ' × ' + pesos(i.valor) + ' = ' + pesos(i.cantidad * i.valor) + '</b>').join('') + '</div><div><small>Valor total</small><b>' + pesos(est.valor) + '</b></div><div><small>Abonos recibidos</small><b>' + pesos(est.abonos) + '</b></div><div class="f1-saldo"><small>Saldo pendiente</small><b>' + pesos(saldo) + '</b></div></div>' +
        '<p class="f1-peq">Es una cuenta de cobro de persona natural. No es una factura electrónica y no incluye IVA.</p><div id="ccr-err" class="f1-error" role="alert"></div>' +
        '<button type="button" id="ccr-generar" class="btn btn-lg w-100 f1-btn-primario">Generar PDF</button><button type="button" id="ccr-volver" class="btn btn-lg w-100 f1-btn-sec">Volver a editar</button>';
      $('ccr-volver').onclick = () => pintarCCR('form'); $('ccr-generar').onclick = generarCCR;
    } else {
      const r = est.resultado, tel = est.cliente.telefono;
      c.innerHTML = '<div class="f1-ok"><h3>✅ ' + esc1(r.consecutivo) + ' generada</h3><p>' + esc1(est.cliente.nombre) + ' · saldo pendiente <b>' + pesos(saldo) + '</b></p></div>' +
        '<button type="button" id="ccr-ver" class="btn btn-lg w-100 f1-btn-sec">Ver PDF</button><button type="button" id="ccr-enviar" class="btn btn-lg w-100 f1-btn-primario">Enviar PDF (WhatsApp u otra app)</button>' +
        '<button type="button" id="ccr-enlace" class="btn btn-lg w-100 f1-btn-sec">Enviar enlace por WhatsApp</button><small class="f1-peq">El enlace hace público ese documento para quien lo reciba; el PDF directo no.</small><button type="button" id="ccr-nueva" class="btn btn-lg w-100 f1-btn-sec">Otra cuenta de cobro</button>';
      $('ccr-ver').onclick = () => window.abrirPdfPrivado({ consecutivo: r.consecutivo }); $('ccr-enviar').onclick = () => window.enviarPdfPrivado({ consecutivo: r.consecutivo });
      $('ccr-enlace').onclick = () => enviarEnlaceWhatsApp(r.consecutivo, tel, 'Hola' + (est.cliente.nombre ? ' ' + est.cliente.nombre : '') + ', te envío la cuenta de cobro ' + r.consecutivo + ' por ' + pesos(est.valor) + (est.abonos ? ' (abonos ' + pesos(est.abonos) + ', saldo ' + pesos(saldo) + ')' : '') + ':');
      $('ccr-nueva').onclick = () => { Object.assign(est, { cliente: null, items: [itemVacio()], valor: 0, abonos: 0, idSolicitud: null, huella: '', resultado: null }); pintarCCR('form'); };
    }
  }
  function validarCCR() {
    if (!est.cliente || !est.cliente.nombre) return 'Elige o crea el cliente.';
    for (let k = 0; k < est.items.length; k++) { const i = est.items[k], n = est.items.length > 1 ? 'Ítem ' + (k + 1) + ': ' : '';
      if (i.concepto.trim().length < 3) return n + 'describe lo que se cobra (mínimo 3 letras).';
      if (!(i.cantidad >= 1)) return n + 'la cantidad debe ser 1 o más.';
      if (!(i.valor > 0)) return n + 'escribe el valor unitario (mayor que cero).'; }
    if (!(est.valor > 0)) return 'Escribe el valor a cobrar (mayor que cero).'; if (est.valor > 999999999) return 'El valor es demasiado alto; revisa los ceros.';
    if (est.abonos < 0) return 'Los abonos no pueden ser negativos.'; if (est.abonos >= est.valor && est.abonos > 0) return 'Los abonos no pueden ser iguales ni mayores al valor: no habría saldo por cobrar.';
    return '';
  }
  async function generarCCR() {
    if (est.enVuelo) return; est.enVuelo = true; const b = $('ccr-generar'); b.disabled = true; b.textContent = 'Generando…'; $('ccr-err').textContent = '';
    const v = est.valor, c = est.cliente;
    const payload = { idSolicitud: est.idSolicitud, tipoDoc: 'Cuenta de Cobro', cliente: { nombre: c.nombre, nit: c.nit || '', telefono: c.telefono || '' },
      items: est.items.map(i => ({ uuid: i.uuid, nombre: i.concepto.trim(), cantidad: i.cantidad, precio: i.valor, specs: '', subtotal: i.cantidad * i.valor })), totales: { subtotal: v, iva: 0, granTotal: v },
      opciones: { mostrarDesc: true, terminos: '', planPago: null, abonos: est.abonos, emisorPersonaNatural: false } };
    const r = await window.callApi('createDocument', payload);
    est.enVuelo = false;
    if (!r.success) { b.disabled = false; b.textContent = 'Reintentar (no se duplicará)'; $('ccr-err').textContent = (r.codigo === 'SIN_RED' ? 'No hay conexión. Cuando vuelva, toca Reintentar: el documento no se repetirá.' : r.error); return; }
    est.resultado = r.data; try { refreshHistoryOnly(); refreshClientsOnly(); } catch (e) {} pintarCCR('listo');
  }
  window.abrirCuentaCobroRapida = function () { crearModalCCR(); pintarCCR('form'); bootstrap.Modal.getOrCreateInstance($('ccrModal')).show(); };
  function botonInicio() {
    if ($('f1-btn-ccr')) return; const ref = Array.from(document.querySelectorAll('button')).find(b => /Cat[aá]logo/.test(b.textContent) && b.getAttribute('onclick'));
    if (!ref) return; const b = document.createElement('button'); b.id = 'f1-btn-ccr'; b.type = 'button'; b.className = 'btn w-100 f1-btn-ccr'; b.textContent = '🧾 Cuenta de cobro rápida'; b.onclick = window.abrirCuentaCobroRapida;
    ref.parentElement.parentElement.insertBefore(b, ref.parentElement);
  }

  // ---------- 7. Carrito según el tipo de documento ----------
  function adaptarCarrito() {
    const t = $('doc-type'); if (!t) return; const cobro = t.value === 'Cuenta de Cobro';
    const ocultar = [$('check-alcance') && $('check-alcance').closest('.d-flex'), $('alcance-plantilla-row'), $('alcance-area'), $('check-terms') && $('check-terms').closest('.form-check'), $('terms-area'), $('check-iva') && $('check-iva').closest('.form-check'), $('check-plan-pago') && $('check-plan-pago').closest('.form-check'), $('plan-pago-area'), $('plantilla-bloque')];
    ocultar.forEach(e => { if (e) e.classList.toggle('f1-oculto', cobro); });
    document.querySelectorAll('#cartModal .f1-seg button').forEach(b => b.classList.toggle('activo', b.dataset.v === t.value));
    const h = $('f1-ayuda-cobro'); if (h) h.style.display = cobro ? 'block' : 'none';
  }
  function prepararCarrito() {
    const cuerpo = document.querySelector('#cartModal .modal-body'); if (!cuerpo || $('f1-seg')) return;
    const seg = document.createElement('div'); seg.id = 'f1-seg'; seg.className = 'f1-seg mb-3'; seg.innerHTML = '<label class="small text-muted d-block mb-1">Tipo de documento</label><div><button type="button" data-v="Cotización">Cotización</button><button type="button" data-v="Cuenta de Cobro">Cuenta de cobro</button></div><small id="f1-ayuda-cobro" class="text-secondary" style="display:none">Cuenta de cobro: IVA, alcance, términos y plan de pago no aplican. Para cobrar una sola actividad usa «Cuenta de cobro rápida» en la pantalla principal.</small>';
    cuerpo.insertBefore(seg, cuerpo.firstChild);
    seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const t = $('doc-type'); t.value = b.dataset.v; t.dispatchEvent(new Event('change', { bubbles: true })); adaptarCarrito(); }));
    const t = $('doc-type'); t.style.display = 'none'; t.parentElement.classList.remove('justify-content-between'); t.parentElement.classList.add('justify-content-end');
    t.addEventListener('change', adaptarCarrito); adaptarCarrito();
  }

  // ---------- 8. Ayudas móviles: teclado, zoom, pestaña activa visible ----------
  function ayudasMoviles() {
    // MEDIDO en el Android real: con el teclado abierto el área de la página (innerHeight) NO se reduce; solo se reduce la parte visible (visualViewport).
    // Por eso se calcula la altura del teclado (--f1-kb) para dar espacio al final de los formularios y se desplaza el campo enfocado al área VISIBLE.
    const vv = window.visualViewport;
    const padreDesplazable = el => { let p = el.parentElement; while (p && p !== document.body) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p; p = p.parentElement; } return document.scrollingElement; };
    const mostrarCampo = el => { if (!vv || !el) return; const r = el.getBoundingClientRect(), arriba = vv.offsetTop + 8, abajo = vv.offsetTop + vv.height - 12; let d = 0; if (r.bottom > abajo) d = r.bottom - abajo; else if (r.top < arriba) d = r.top - arriba; if (d) padreDesplazable(el).scrollTop += d; };
    document.addEventListener('focusin', e => { const el = e.target; if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName) && !el.readOnly) setTimeout(() => mostrarCampo(el), 350); });
    if (vv) { const set = () => { const root = document.documentElement.style; root.setProperty('--f1-vvh', vv.height + 'px'); root.setProperty('--f1-kb', Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + 'px'); const a = document.activeElement; if (a && /INPUT|TEXTAREA/.test(a.tagName) && !a.readOnly) mostrarCampo(a); }; vv.addEventListener('resize', set); vv.addEventListener('scroll', set); set(); }
    const mv = document.querySelector('meta[name=viewport]'); if (mv) mv.setAttribute('content', 'width=device-width, initial-scale=1.0');
  }

  function iniciar() {
    ayudasMoviles(); engancharSelectores(); botonInicio(); prepararCarrito();
    const ob = new MutationObserver(() => { engancharSelectores(); botonInicio(); prepararCarrito(); }); ob.observe(document.body, { childList: true, subtree: true });
    const pie = document.createElement('div'); pie.className = 'f1-version'; pie.innerHTML = 'v' + VERSION + ' · <a href="#" id="f1-salir">Cerrar sesión</a>'; document.body.appendChild(pie); $('f1-salir').onclick = ev => { ev.preventDefault(); window.cerrarSesionAST(); };
    leerToken().then(t => { if (!t) mostrarLogin(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
