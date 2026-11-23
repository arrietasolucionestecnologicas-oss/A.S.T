// A.S.T. — Estructura de navegación v2: Inicio · Cotizar · Trabajos · Más (barra inferior). Reutiliza las vistas existentes (no reescribe la lógica de negocio).
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pesos = n => (typeof fmt !== 'undefined' ? fmt.format(Number(n) || 0) : '$ ' + (Number(n) || 0));
  const SECCION = { INICIO: 'inicio', PRODUCTO: 'cotizar', SERVICIO: 'cotizar', PROYECTOS: 'trabajos', HISTORIAL: 'trabajos', PROVEEDORES: 'mas', ESTIMADOR: 'mas', DASHBOARD: 'mas', MAS: 'mas', CLIENTES: 'mas' };
  const TITULO = { INICIO: 'Inicio', PRODUCTO: 'Cotizar', SERVICIO: 'Cotizar', PROYECTOS: 'Trabajos', HISTORIAL: 'Trabajos', PROVEEDORES: 'Proveedores', ESTIMADOR: 'Estimador', DASHBOARD: 'Dashboard financiero', MAS: 'Más', CLIENTES: 'Clientes' };
  const PROPIAS = ['INICIO', 'MAS', 'CLIENTES']; const EXISTENTES = ['view-catalog', 'view-projects', 'view-history', 'view-proveedores', 'view-estimador', 'view-dashboard'];
  let ultimaCotizar = 'PRODUCTO', ultimaTrabajos = 'PROYECTOS', actual = 'INICIO', firma = '', mant = { t: 0, d: [] };

  // ---- estructura base
  function construir() {
    if ($('ui-nav')) return;
    const nav = document.createElement('nav'); nav.id = 'ui-nav'; nav.setAttribute('aria-label', 'Navegación principal');
    nav.innerHTML = [['inicio', 'house-door', 'Inicio'], ['cotizar', 'receipt', 'Cotizar'], ['trabajos', 'briefcase', 'Trabajos'], ['mas', 'three-dots', 'Más']].map(a => '<button type="button" data-s="' + a[0] + '" aria-label="' + a[2] + '"><i class="bi bi-' + a[1] + '"></i><span>' + a[2] + '</span></button>').join('');
    document.body.appendChild(nav);
    nav.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const s = b.dataset.s; window.switchTab(s === 'inicio' ? 'INICIO' : s === 'cotizar' ? ultimaCotizar : s === 'trabajos' ? ultimaTrabajos : 'MAS'); }));
    ['grupo-catalogo', 'subnav-catalogo'].forEach(id => { const e = $(id); const r = e && e.closest('.row'); if (r) r.classList.add('ui-oculto'); });   // adiós a las 3 filas de navegación antigua
    const lg = $('libre-nombre'); if (lg) lg.parentElement.classList.add('ui-libre');                       // «Ítem libre»: nombre en su propia línea (antes quedaba truncado)
    const fi = document.querySelector('#fab-cart i'); if (fi) fi.className = 'bi bi-cart3';                  // el carrito ya no lleva el icono de PDF
    const bu = $('search'); if (bu) bu.placeholder = 'Buscar en esta lista';
    const ba = $('btn-main-add'); if (ba) { ba.setAttribute('aria-label', 'Nuevo producto o servicio'); ba.title = 'Nuevo producto o servicio'; }
    const marca = document.querySelector('.navbar .navbar-brand'); if (marca) { const t = document.createElement('span'); t.id = 'ui-titulo'; marca.after(t); }
    const raiz = $('view-dashboard').parentElement;
    ['view-inicio', 'view-mas', 'view-clientes'].forEach(id => { const d = document.createElement('div'); d.id = id; d.className = 'hidden-section'; raiz.appendChild(d); });
    const seg = document.createElement('div'); seg.id = 'ui-seg'; seg.className = 'ui-seg hidden-section'; raiz.insertBefore(seg, $('view-catalog'));
    const vol = document.createElement('button'); vol.id = 'ui-volver'; vol.type = 'button'; vol.className = 'btn btn-outline-cyan btn-sm mb-2 hidden-section'; vol.innerHTML = '<i class="bi bi-chevron-left"></i> Más'; vol.onclick = () => window.switchTab('MAS'); raiz.insertBefore(vol, $('view-catalog'));
  }

  // ---- navegación: se envuelve switchTab (la lógica de cada vista no cambia)
  const original = window.switchTab;
  window.switchTab = function (v) {
    construir();
    if (PROPIAS.indexOf(v) >= 0) { EXISTENTES.forEach(id => $(id).classList.add('hidden-section')); $('fab-cart').style.display = 'none'; $('btn-main-add').style.display = 'none'; ['view-inicio', 'view-mas', 'view-clientes'].forEach(id => $(id).classList.add('hidden-section')); try { currentView = v; } catch (e) {} }
    else { ['view-inicio', 'view-mas', 'view-clientes'].forEach(id => $(id).classList.add('hidden-section')); original(v); }
    actual = v; if (v === 'PRODUCTO' || v === 'SERVICIO') ultimaCotizar = v; if (v === 'PROYECTOS' || v === 'HISTORIAL') ultimaTrabajos = v;
    if (v === 'INICIO') { $('view-inicio').classList.remove('hidden-section'); pintarInicio(true); }
    if (v === 'MAS') { $('view-mas').classList.remove('hidden-section'); pintarMas(); }
    if (v === 'CLIENTES') { $('view-clientes').classList.remove('hidden-section'); pintarClientes(''); }
    sincronizar(v); window.scrollTo(0, 0);
  };
  function sincronizar(v) {
    const s = SECCION[v] || 'inicio';
    document.querySelectorAll('#ui-nav button').forEach(b => { b.classList.toggle('activo', b.dataset.s === s); b.setAttribute('aria-current', b.dataset.s === s ? 'page' : 'false'); });
    const t = $('ui-titulo'); if (t) t.textContent = TITULO[v] || '';
    const seg = $('ui-seg'), vol = $('ui-volver');
    const opciones = s === 'cotizar' ? [['PRODUCTO', 'Productos'], ['SERVICIO', 'Servicios']] : s === 'trabajos' ? [['PROYECTOS', 'Proyectos'], ['HISTORIAL', 'Historial']] : null;
    if (opciones) { seg.innerHTML = opciones.map(o => '<button type="button" data-v="' + o[0] + '" class="' + (o[0] === v ? 'activo' : '') + '">' + o[1] + '</button>').join(''); seg.querySelectorAll('button').forEach(b => b.onclick = () => window.switchTab(b.dataset.v)); seg.classList.remove('hidden-section'); } else seg.classList.add('hidden-section');
    vol.classList.toggle('hidden-section', !(s === 'mas' && v !== 'MAS'));
  }

  // ---- Inicio
  function saludo() { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }
  function accion(icono, titulo, sub, js, principal) { return '<button type="button" class="ui-accion' + (principal ? ' principal' : '') + '" onclick="' + js + '"><i class="bi bi-' + icono + '"></i><span>' + titulo + '<small>' + sub + '</small></span></button>'; }
  function pintarInicio(forzar) {
    const v = $('view-inicio'); if (!v || v.classList.contains('hidden-section')) return;
    const ps = (typeof projects !== 'undefined' ? projects : []), hs = (typeof historyDocs !== 'undefined' ? historyDocs : []), cs = (typeof clients !== 'undefined' ? clients : []);
    const f = [ps.length, hs.length, cs.length, mant.d.length].join('|'); if (!forzar && f === firma) return; firma = f;
    const abiertos = ps.filter(p => p.estado !== 'CERRADO'), cerrados = ps.filter(p => p.estado === 'CERRADO');
    const sum = (a, k) => a.reduce((s, p) => s + (Number(p[k]) || 0), 0);
    const docs = hs.slice(0, 5).map(d => '<button type="button" class="ui-fila" onclick="abrirPdfPrivado({consecutivo:\'' + esc(d.consecutivo) + '\'})"><i class="bi bi-file-earmark-text"></i><span class="txt"><b>' + esc(d.consecutivo) + ' · ' + esc(d.cliente) + '</b><span>' + esc(d.tipo || '') + '</span></span><span class="der">' + pesos(d.total) + '</span></button>').join('');
    const m = mant.d.filter(x => x.status !== 'OK').slice(0, 3).map(x => '<div class="ui-fila"><i class="bi bi-camera-video"></i><span class="txt"><b>' + esc(x.cliente) + '</b><span>' + esc(x.nombreProyecto) + '</span></span><span class="der ' + (x.status === 'VENCIDO' ? 'ui-aviso' : '') + '">' + (x.status === 'VENCIDO' ? 'Vencido' : 'En ' + Math.max(0, x.diasParaVencer) + ' d') + '</span></div>').join('');
    v.innerHTML = '<h1 class="ui-h">' + saludo() + '</h1>' +
      '<div class="ui-acciones">' + accion('receipt', 'Cotizar', 'Catálogo y carrito', "switchTab('PRODUCTO')", true) + accion('cash-coin', 'Cuenta de cobro', 'En menos de 1 minuto', 'abrirCuentaCobroRapida()') + accion('briefcase', 'Trabajos', ps.length + ' registrados', "switchTab('PROYECTOS')") + accion('people', 'Clientes', cs.length + ' registrados', "switchTab('CLIENTES')") + '</div>' +
      '<h2 class="ui-h2">Trabajos y cobros</h2><div class="ui-kpis"><div class="ui-kpi"><small>Cotizado en abiertos (' + abiertos.length + ')</small><b>' + pesos(sum(abiertos, 'totalCobrado')) + '</b><div class="nota">Aún no es venta</div></div><div class="ui-kpi"><small>Vendido en cerrados (' + cerrados.length + ')</small><b>' + pesos(sum(cerrados, 'totalCobrado')) + '</b></div><div class="ui-kpi"><small>Cobrado</small><b class="ui-ok">' + pesos(sum(ps, 'totalRecibido')) + '</b><div class="nota">Pagos registrados</div></div><div class="ui-kpi"><small>Pendiente por cobrar</small><b class="ui-aviso">' + pesos(cerrados.reduce((t, p) => t + Math.max(0, (Number(p.totalCobrado) || 0) - (Number(p.totalRecibido) || 0)), 0)) + '</b><div class="nota">Vendido menos cobrado</div></div></div>' +
      '<h2 class="ui-h2">Mantenimientos de cámaras</h2>' + (m ? '<div class="ui-lista">' + m + '</div>' : '<div class="ui-vacio"><b>Sin mantenimientos próximos</b>Aparecerán aquí 15 días antes de cumplirse los 6 meses.</div>') +
      '<h2 class="ui-h2">Últimos documentos</h2>' + (docs ? '<div class="ui-lista">' + docs + '</div>' : '<div class="ui-vacio"><b>Aún no hay documentos</b>Genera tu primera cotización o cuenta de cobro.</div>');
    if (Date.now() - mant.t > 60000) { mant.t = Date.now(); window.callApi('getMantenimientosCamaras', {}).then(r => { if (r && r.success && Array.isArray(r.data)) { mant.d = r.data; if (actual === 'INICIO') pintarInicio(false); } }); }
  }
  setInterval(() => { if (actual === 'INICIO') pintarInicio(false); }, 2500);

  // ---- Clientes (lista con búsqueda y contacto directo)
  function pintarClientes(q) {
    const v = $('view-clientes'); const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const lista = (typeof clients !== 'undefined' ? clients : []).filter(c => !q || norm(c.nombre + ' ' + c.nit + ' ' + c.telefono).indexOf(norm(q)) >= 0).slice(0, 80);
    v.innerHTML = '<h1 class="ui-h">Clientes</h1><input id="ui-cli-q" type="search" class="form-control mb-3" placeholder="Buscar por nombre, NIT o teléfono" value="' + esc(q) + '" autocomplete="off">' +
      (lista.length ? '<div class="ui-lista">' + lista.map(c => { const t = String(c.telefono || '').replace(/\D/g, '').slice(-10); return '<div class="ui-fila"><i class="bi bi-person"></i><span class="txt"><b>' + esc(c.nombre) + '</b><span>' + esc([c.nit, c.telefono].filter(Boolean).join(' · ') || 'sin NIT ni teléfono') + '</span></span>' + (t ? '<a class="btn btn-outline-cyan btn-sm" href="tel:' + t + '" aria-label="Llamar a ' + esc(c.nombre) + '"><i class="bi bi-telephone"></i></a><button type="button" class="btn btn-outline-cyan btn-sm" onclick="abrirWhatsAppTexto(\'' + t + '\',\'\')" aria-label="WhatsApp a ' + esc(c.nombre) + '"><i class="bi bi-whatsapp"></i></button>' : '') + '</div>'; }).join('') + '</div>' : '<div class="ui-vacio"><b>Sin resultados</b>Los clientes se crean al elegir «+ Nuevo» en una cotización o cuenta de cobro.</div>') +
      '<p class="ui-peq">Se muestran hasta 80 resultados. Escribe para filtrar.</p>';
    const i = $('ui-cli-q'); i.addEventListener('input', () => { const p = i.selectionStart; pintarClientes(i.value); const n = $('ui-cli-q'); n.focus(); n.setSelectionRange(p, p); });
  }

  // ---- Más
  function fila(icono, titulo, sub, js) { return '<button type="button" class="ui-fila" onclick="' + js + '"><i class="bi bi-' + icono + '"></i><span class="txt"><b>' + titulo + '</b><span>' + sub + '</span></span><i class="bi bi-chevron-right" style="color:var(--ui-texto-2)"></i></button>'; }
  function pintarMas() {
    $('view-mas').innerHTML = '<h1 class="ui-h">Más</h1><h2 class="ui-h2">Gestión</h2><div class="ui-lista">' + fila('people', 'Clientes', 'Contacto, NIT y teléfono', "switchTab('CLIENTES')") + fila('truck', 'Proveedores', 'Lugares de compra y contactos', "switchTab('PROVEEDORES')") + '</div>' +
      '<h2 class="ui-h2">Herramientas</h2><div class="ui-lista">' + fila('calculator', 'Estimador eléctrico, mano de obra y CCTV', 'Materiales y cobro por puntos', "switchTab('ESTIMADOR')") + fila('graph-up', 'Dashboard financiero', 'Ventas, gastos y utilidad por mes', "switchTab('DASHBOARD')") + fila('rulers', 'Levantamiento en campo', 'Se abre dentro de cada trabajo', "switchTab('PROYECTOS')") + '</div>' +
      '<h2 class="ui-h2">Cuenta</h2><div class="ui-lista">' + fila('key', 'Cambiar mi clave', 'Pon una que recuerdes', 'cambiarClaveAST()') + fila('box-arrow-right', 'Cerrar sesión', 'Versión ' + (window.AST_VERSION || ''), 'cerrarSesionAST()') + '</div>';
  }

  // ---- Pagos recibidos por trabajo (cobrado = pagos registrados; pendiente = vendido - cobrado)
  const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const fechaCorta = iso => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  /* PAGOS 2.1 */
  // Respaldo: si por caché llegara shell.js sin sync.js, la sección de pagos sigue funcionando por el camino de compatibilidad.
  if (!window.AST_SYNC) window.AST_SYNC = { pagos: {}, oyentesPagos: [], sucio: false, aceptar: () => true, guardarPagos: function (id, l) { this.pagos[id] = { lista: l || [] }; this.oyentesPagos.forEach(g => g(id)); return true; } };
  // El bloque "Cobros del trabajo" se arma UNA vez por trabajo; después solo cambian los números y las filas (el formulario conserva lo escrito).
  // Todo dato sale de AST_SYNC: la respuesta del servidor trae la lista de pagos y el trabajo con su revisión; una respuesta vieja se descarta ahí.
  const lista_ = id => (window.AST_SYNC.pagos[id] || {}).lista;
  const proyecto_ = id => (typeof projects !== 'undefined' ? projects : []).find(x => x.id === id) || {};
  function filaPago(x) { return '<div class="ui-fila" data-fila="' + esc(x.id) + '"><i class="bi bi-cash-coin"></i><span class="txt"><b>' + pesos(x.monto) + ' · ' + esc(x.medio) + '</b><span>' + fechaCorta(x.fecha) + (x.nota ? ' · ' + esc(x.nota) : '') + '</span></span><button type="button" class="btn btn-outline-secondary btn-sm" data-borrar="' + esc(x.id) + '" aria-label="Eliminar pago"><i class="bi bi-trash"></i></button></div>'; }
  function armarPagos(id) {
    const cuerpo = document.querySelector('#projectDetailModal .modal-body'); if (!cuerpo) return null;
    let box = $('ui-pagos'); if (box && box.dataset.id === id) return box;
    if (!box) { box = document.createElement('div'); box.id = 'ui-pagos'; box.className = 'ui-card'; cuerpo.insertBefore(box, cuerpo.firstChild); }
    box.dataset.id = id;
    box.innerHTML = '<h2 class="ui-h2" style="margin-top:0">Cobros del trabajo</h2><div class="ui-kpis"><div class="ui-kpi"><small id="ui-k1-l"></small><b id="ui-k1"></b></div><div class="ui-kpi"><small>Cobrado</small><b class="ui-ok" id="ui-k2"></b></div></div><div id="ui-k3"></div>' +
      '<div class="ui-lista mt-3" id="ui-pagos-lista"></div>' +
      /* PAGO RÁPIDO */ '<div id="ui-pago-rapido" class="mt-3"><div class="ui-peq mb-1">Registrar un pago recibido</div>' +
      '<select id="ui-pago-medio" class="form-select mb-2" aria-label="Medio de pago"><option>Efectivo</option><option>Transferencia</option><option>Nequi</option><option>Bre-B</option><option>Otro</option></select>' +
      '<button type="button" id="ui-pago-total" class="btn btn-cyan w-100 mb-2" style="display:none"></button>' +
      '<div class="d-flex gap-2 mb-2"><button type="button" id="ui-pago-mitad" class="btn btn-outline-cyan flex-fill" style="display:none"></button><button type="button" id="ui-pago-otro" class="btn btn-outline-secondary flex-fill">Otro monto…</button></div>' +
      '<div id="ui-pago-ok" class="ui-ok ui-peq" role="status"></div><div id="ui-pago-err" class="ui-aviso ui-peq" role="alert"></div>' +
      '<form id="ui-pago-form" class="mt-2" style="display:none"><input id="ui-pago-monto" class="form-control mb-2" inputmode="numeric" enterkeyhint="done" placeholder="Monto recibido (COP)" autocomplete="off" aria-label="Monto recibido"><input id="ui-pago-nota" class="form-control mb-2" placeholder="Nota (opcional)" maxlength="200" autocomplete="off" aria-label="Nota"><button class="btn btn-cyan w-100" type="submit">Registrar pago</button></form></div>';
    $('ui-pagos-lista').addEventListener('click', ev => { const b = ev.target.closest('[data-borrar]'); if (b) borrarPago(id, b); });
    $('ui-pago-form').addEventListener('submit', ev => { ev.preventDefault(); registrarPago(id, ev.target); });
    try { const m = localStorage.getItem('ast_medio_pago'); if (m) $('ui-pago-medio').value = m; } catch (e) {}
    $('ui-pago-medio').addEventListener('change', e => { try { localStorage.setItem('ast_medio_pago', e.target.value); } catch (x) {} });
    $('ui-pago-total').addEventListener('click', () => pagoRapido(id, 1));
    $('ui-pago-mitad').addEventListener('click', () => pagoRapido(id, 0.5));
    $('ui-pago-otro').addEventListener('click', () => { const fo = $('ui-pago-form'); fo.style.display = fo.style.display === 'none' ? 'block' : 'none'; const md = $('projectDetailModal'); if (fo.style.display === 'block') { md.classList.add('ui-escribiendo'); $('ui-pago-monto').focus(); setTimeout(() => { try { $('ui-pago-monto').scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 320); } else md.classList.remove('ui-escribiendo'); });
    const m = $('ui-pago-monto'); m.addEventListener('input', () => { const d = String(m.value).replace(/\D/g, ''); m.value = d ? Number(d).toLocaleString('es-CO') : ''; });   // 1130000 → 1.130.000 mientras se escribe
    const modal = $('projectDetailModal'); const visible = e => setTimeout(() => { try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 320);
    ['ui-pago-monto', 'ui-pago-nota'].forEach(i => { $(i).addEventListener('focus', e => { modal.classList.add('ui-escribiendo'); visible(e); }); $(i).addEventListener('blur', () => setTimeout(() => { if (!document.activeElement || !/^ui-pago-(monto|nota)$/.test(document.activeElement.id)) modal.classList.remove('ui-escribiendo'); }, 250)); });
    pintarPagos(id); return box;
  }
  // Actualiza SOLO lo que depende del cambio: Vendido/Cotizado, Cobrado, Pendiente y las filas (en el orden que manda el servidor).
  function pintarPagos(id) {
    const box = $('ui-pagos'); if (!box || box.dataset.id !== id) return;
    const p = proyecto_(id), lista = lista_(id), cerrado = p.estado === 'CERRADO', vendido = Number(p.totalCobrado) || 0;
    const recibido = lista ? lista.reduce((t, x) => t + x.monto, 0) : (Number(p.totalRecibido) || 0), pendiente = Math.max(0, vendido - recibido);
    const set = (i, t) => { const e = $(i); if (e && e.textContent !== t) e.textContent = t; };
    set('ui-k1-l', cerrado ? 'Vendido' : 'Cotizado'); set('ui-k1', pesos(vendido)); set('ui-k2', pesos(recibido));
    const k3 = (cerrado ? 'c' + (pendiente > 0 ? 'a' : 'b') + pendiente : 'n'); const caja = $('ui-k3');
    if (caja.dataset.k !== k3) { caja.dataset.k = k3; caja.innerHTML = cerrado ? '<div class="ui-kpi mt-2"><small>Pendiente por cobrar</small><b class="' + (pendiente > 0 ? 'ui-aviso' : 'ui-ok') + '">' + pesos(pendiente) + '</b><div class="nota">Un trabajo cerrado no significa dinero recibido: solo cuentan los pagos registrados.</div></div>' : '<p class="ui-peq mt-2">Registra aquí anticipos y abonos a medida que los recibas.</p>'; }
    const cont = $('ui-pagos-lista'); const firma = lista ? lista.map(x => x.id + ':' + x.monto + ':' + x.medio + ':' + x.nota).join('|') : '?';
    if (cont.dataset.f !== firma) { cont.dataset.f = firma; cont.innerHTML = !lista ? '<div class="ui-vacio" style="border:0"><b>Cargando pagos…</b></div>' : (lista.length ? lista.map(filaPago).join('') : '<div class="ui-vacio" style="border:0"><b>Sin pagos registrados</b>Aún no se ha recibido dinero de este trabajo.</div>'); }
    // Botones rápidos: solo cuando ya se cargaron los pagos y hay saldo pendiente
    const bt = $('ui-pago-total'), bm = $('ui-pago-mitad'); if (bt && bm) { const ver = !!lista && pendiente > 0; bt.style.display = ver ? 'block' : 'none'; bm.style.display = (ver && pendiente >= 2) ? 'block' : 'none'; bt.textContent = 'Pago completo · ' + pesos(pendiente); bm.textContent = '50 % · ' + pesos(Math.round(pendiente / 2)); }
  }
  window.AST_SYNC.oyentesPagos.push(pintarPagos);
  let pagoPendiente = null;   // identificador estable del intento en curso: reintentar el mismo monto NO duplica el pago (el servidor lo reconoce)
  const enVueloPago = {};
  function pagoRapido(id, fraccion) {   // un toque: el monto sale del saldo pendiente, no se digita
    const lista = lista_(id); if (!lista) return; const p = proyecto_(id); const pend = Math.max(0, (Number(p.totalCobrado) || 0) - lista.reduce((t, x) => t + x.monto, 0));
    const monto = fraccion === 1 ? pend : Math.round(pend * fraccion); if (!(monto > 0)) return;
    if (!confirm('¿Registrar ' + (fraccion === 1 ? 'el pago completo' : 'un pago del 50 %') + ' de ' + pesos(monto) + ' (' + $('ui-pago-medio').value + ')?')) return;
    enviarPago(id, monto, '', fraccion === 1 ? $('ui-pago-total') : $('ui-pago-mitad'));
  }
  async function registrarPago(id, form) {   // pago escrito a mano (parcial)
    const err = $('ui-pago-err'); err.textContent = ''; const monto = parseInt(String($('ui-pago-monto').value).replace(/\D/g, ''), 10) || 0;
    if (!(monto > 0)) { err.textContent = 'Escribe el monto recibido (mayor que cero).'; return; } if (monto > 999999999) { err.textContent = 'El monto es demasiado alto; revisa los ceros.'; return; }
    const p = proyecto_(id), lista = lista_(id) || [], pendiente = Math.max(0, (Number(p.totalCobrado) || 0) - lista.reduce((t, x) => t + x.monto, 0));
    if (p.estado === 'CERRADO' && monto > pendiente && !confirm('El pago supera el saldo pendiente (' + pesos(pendiente) + '). ¿Registrarlo de todos modos?')) return;
    enviarPago(id, monto, $('ui-pago-nota').value.trim(), form.querySelector('button[type=submit]'));
  }
  async function enviarPago(id, monto, nota, btn) {   // una sola ruta de guardado: doble toque ignorado, mismo identificador al reintentar, éxito solo con confirmación del servidor
    const err = $('ui-pago-err'), ok = $('ui-pago-ok'); err.textContent = ''; ok.textContent = ''; if (enVueloPago[id] || (btn && btn.disabled)) return; enVueloPago[id] = true;
    const botones = ['ui-pago-total', 'ui-pago-mitad', 'ui-pago-otro'].map($).concat(btn ? [btn] : []); const textos = botones.map(b => b && b.textContent); botones.forEach(b => { if (b) b.disabled = true; }); if (btn) btn.textContent = 'Guardando…';
    if (!pagoPendiente || pagoPendiente.k !== id + '|' + monto) pagoPendiente = { k: id + '|' + monto, id: uuid() };
    const d = await window.callApi('addProjectPayment', { idPago: pagoPendiente.id, projectId: id, monto: monto, medio: $('ui-pago-medio').value, nota: nota });
    botones.forEach((b, i) => { if (b) { b.disabled = false; b.textContent = textos[i]; } }); enVueloPago[id] = false; pintarPagos(id);
    if (!d.success) { err.textContent = d.codigo === 'SIN_RED' ? 'Sin conexión: no se pudo confirmar el guardado del pago. Toca de nuevo cuando vuelva la red: si ya se había guardado, no se duplica.' : d.error; return; }
    pagoPendiente = null; $('ui-pago-monto').value = ''; $('ui-pago-nota').value = ''; $('ui-pago-form').style.display = 'none'; $('projectDetailModal').classList.remove('ui-escribiendo');
    ok.textContent = '✓ Pago de ' + pesos(monto) + ' registrado'; setTimeout(() => { if (ok.textContent.indexOf('registrado') > 0) ok.textContent = ''; }, 3500);
    if (!(d.data && d.data.pagos)) await recargarPagos(id);   // servidor anterior a 2.1: no devuelve la lista
  }
  const borrando = {};
  async function borrarPago(id, b) {
    const pid = b.dataset.borrar; if (borrando[pid]) return; if (!confirm('¿Eliminar este pago? Esta acción no se puede deshacer.')) return;
    borrando[pid] = true; b.disabled = true;
    const d = await window.callApi('deleteProjectPayment', { id: pid, projectId: id }); delete borrando[pid]; b.disabled = false;
    if (!d.success) { aviso('No se pudo eliminar el pago: ' + d.error); return; }
    if (!(d.data && d.data.pagos)) await recargarPagos(id);
  }
  async function recargarPagos(id) {   // camino de compatibilidad con el servidor anterior (143)
    const r = await window.callApi('getProjectPayments', { projectId: id }); if (r && r.success) window.AST_SYNC.guardarPagos(id, r.data, undefined);
    window.AST_SYNC.sucio = true; if (typeof refreshProjectsOnly === 'function') await refreshProjectsOnly(); pintarPagos(id);
  }
  function aviso(m) { try { showToast(m, 'danger'); } catch (e) { alert(m); } }
  const abrirOriginal = window.openProjectDetail;
  window.openProjectDetail = async function (id) {
    const antes = abrirOriginal.apply(this, arguments);   // pide el detalle; la respuesta trae también los pagos (hook de AST_SYNC)
    try { armarPagos(id); } catch (e) { console.error('pagos', e); }
    const r = await antes;
    try { armarPagos(id); if (!lista_(id)) await recargarPagos(id); else pintarPagos(id); } catch (e) { console.error('pagos', e); }
    return r;
  };

  function iniciar() { construir(); window.switchTab('INICIO'); }
  const esperar = setInterval(() => { if (typeof callApi === 'function' && $('view-dashboard') && typeof switchTab === 'function') { clearInterval(esperar); iniciar(); } }, 150);
})();
