// A.S.T. 2.1 — Sincronización: revisiones por trabajo, respuestas viejas descartadas, actualización parcial y letrero de estado.
// Se carga después de app.js y antes de fase1.js. fase1.js llama a AST_SYNC desde callApi; shell.js lo usa para los pagos.
(function () {
  'use strict';
  const S = window.AST_SYNC = { revs: {}, pagos: {}, sucio: false, listaCargada: false, ultimaCarga: 0, escrituras: 0, segundoPlano: 0, oyentesPagos: [] };
  const ES_LECTURA = /^(get|preview|version|evaluar|login|logout)/;
  const afecta = /^(createProject|updateProject|addProjectMovement|updateProjectMovement|deleteProjectMovement|marcarMovimientosFacturados|updateProjectChecklist|addProjectPayment|deleteProjectPayment|convertQuoteToProject|createDocument|registerRecurringPayment|addInitialPayment|updateRecurringPayment|addRecurringPayment|configureRecurringPayment|deleteProject)$/;

  // ------------------------------------------------------------------ revisiones por trabajo
  // Regla: una respuesta con revisión MENOR a la ya aplicada para ese trabajo es vieja y se descarta. Sin revisión (servidor anterior) se acepta.
  S.aceptar = function (id, rev) {
    if (rev === undefined || rev === null) return true;
    const k = S.revs[id]; if (k !== undefined && rev < k) return false;
    S.revs[id] = rev; return true;
  };
  let pintarTimer = null;
  function programarPintado() {
    if (pintarTimer) return;
    pintarTimer = setTimeout(function () {
      pintarTimer = null;
      try { if (typeof currentView !== 'undefined' && currentView === 'PROYECTOS') { renderProjects(); calculateDashboard(); } } catch (e) { console.error(e); }
      try { setCacheWithTimestamp('ast_projects', projects); } catch (e) {}
    }, 40);
  }
  // Mezcla UN trabajo devuelto por el servidor (tras una escritura o al abrir su detalle). Devuelve false si era viejo.
  S.fusionarProyecto = function (p) {
    if (!p || !p.id || !S.aceptar(p.id, p.rev)) return false;
    const i = projects.findIndex(x => x.id === p.id);
    if (i >= 0) projects[i] = Object.assign({}, projects[i], p); else projects.unshift(p);
    try {
      if (typeof currentProjectData !== 'undefined' && currentProjectData && currentProjectData.id === p.id) {
        Object.assign(currentProjectData, p);
        const m = document.getElementById('projectDetailModal');
        if (m && m.classList.contains('show')) renderProjectItems();
      }
    } catch (e) { console.error(e); }
    programarPintado(); S.oyentesPagos.forEach(function (g) { try { g(p.id); } catch (e) {} }); return true;
  };
  // Aplica una LISTA completa de trabajos: cada trabajo solo si su revisión no es anterior a la ya aplicada.
  S.aplicarLista = function (lista) {
    const nuevos = (lista || []).map(p => S.aceptar(p.id, p.rev) ? p : (projects.find(q => q.id === p.id) || p));
    projects.length = 0; nuevos.forEach(x => projects.push(x));
    S.listaCargada = true; S.sucio = false; S.ultimaCarga = Date.now(); programarPintado();
  };
  // ------------------------------------------------------------------ pagos del trabajo (cache en memoria, orden por fecha descendente)
  S.guardarPagos = function (id, lista, rev) {
    if (!S.aceptar(id, rev)) return false;
    S.pagos[id] = { lista: lista || [], rev: rev };
    S.oyentesPagos.forEach(f => { try { f(id); } catch (e) { console.error(e); } });
    return true;
  };
  // ------------------------------------------------------------------ gancho de fase1.js: toda respuesta con datos del trabajo se aplica aquí
  S.alRecibir = function (action, r) {
    const d = r && r.data;
    if (!r) return;
    if (r.success === false) { if (!ES_LECTURA.test(action) && afecta.test(action)) S.sucio = true; return; }   // una escritura fallida (o sin red) pudo o no aplicarse: se vuelve a leer
    if (d && d.proyecto) { S.fusionarProyecto(d.proyecto); if (d.pagos) S.guardarPagos(d.proyecto.id, d.pagos, d.rev); }
    else if (d && d.info && d.info.id && action === 'getProjectDetails') { S.aceptar(d.info.id, d.rev); if (d.pagos) S.pagos[d.info.id] = { lista: d.pagos, rev: d.rev }; }
    if (!ES_LECTURA.test(action) && afecta.test(action)) {
      if (!(d && d.proyecto)) S.sucio = true;                    // la escritura no devolvió el trabajo: la lista hay que volver a pedirla
      try { invalidarDashboard_(); } catch (e) {}                // el Dashboard depende de pagos y cierres
    }
  };

  // ------------------------------------------------------------------ letrero de estado (no bloquea; distingue guardando / sincronizando / error / sin conexión)
  const ESTILOS = {
    sync: ['rgba(11,45,74,.94)', '#9fd8ff', 'Sincronizando…'], guardando: ['rgba(11,45,74,.97)', '#ffffff', 'Guardando…'],
    ok: ['rgba(14,94,56,.97)', '#ffffff', '✓ Guardado'], error: ['rgba(140,28,40,.98)', '#ffffff', 'No se guardó'], offline: ['rgba(118,72,6,.98)', '#ffffff', 'Sin conexión']
  };
  let chipEl = null, fallo = null, mostrarGuardando = false, timerG = null, timerS = null, mostrarSync = false, okHasta = 0, timerOk = null, expiraSync = null;
  function chip() {
    if (chipEl) return chipEl;
    chipEl = document.createElement('div'); chipEl.id = 'ast-chip'; chipEl.setAttribute('role', 'status'); chipEl.setAttribute('aria-live', 'polite');
    chipEl.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translateX(-50%);z-index:9999;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.35);display:none;max-width:92vw;text-align:center;pointer-events:none';
    chipEl.addEventListener('click', function () { if (fallo) { fallo = null; pintar(); } });
    document.body.appendChild(chipEl); return chipEl;
  }
  function pintar() {
    const c = chip(); let est = 'idle', txt = '';
    if (fallo) { est = fallo.sinRed ? 'offline' : 'error'; txt = fallo.txt; }
    else if (S.escrituras > 0 && mostrarGuardando) est = 'guardando';
    else if (S.segundoPlano > 0 && mostrarSync) est = 'sync';
    else if (Date.now() < okHasta) est = 'ok';
    if (est === 'idle') { c.style.display = 'none'; c.dataset.estado = 'idle'; return; }
    const e = ESTILOS[est]; c.dataset.estado = est; c.style.background = e[0]; c.style.color = e[1]; c.textContent = txt || e[2];
    c.style.pointerEvents = (est === 'error' || est === 'offline') ? 'auto' : 'none'; c.style.display = 'block';
  }
  S.escrituraInicia = function () {
    S.escrituras++;
    if (S.escrituras === 1) { mostrarGuardando = false; clearTimeout(timerG); timerG = setTimeout(function () { mostrarGuardando = true; pintar(); }, 500); }
  };
  S.escrituraFin = function (action, r) {
    S.escrituras = Math.max(0, S.escrituras - 1);
    if (S.escrituras === 0) { clearTimeout(timerG); const visto = mostrarGuardando; mostrarGuardando = false; if (r && r.success !== false) { fallo = null; if (visto) { okHasta = Date.now() + 1400; clearTimeout(timerOk); timerOk = setTimeout(pintar, 1450); } } }
    if (r && r.success === false) {
      const sinRed = r.codigo === 'SIN_RED';
      if (!(r.codigo === 'NO_AUTENTICADO' || r.codigo === 'SESION_VENCIDA' || r.codigo === 'SESION_REVOCADA')) fallo = { sinRed: sinRed, txt: sinRed ? 'Sin conexión: no se pudo confirmar el guardado. Toca para cerrar y reintenta.' : 'No se guardó: ' + String(r.error || 'error').slice(0, 90) + ' (toca para cerrar)' };
    }
    pintar();
  };
  // Los refrescos de fondo (los que ya existían llaman a showSyncIndicator/hideSyncIndicator): solo se ven si tardan más de 1,5 s.
  window.showSyncIndicator = function () {
    S.segundoPlano++;
    if (S.segundoPlano === 1) {
      mostrarSync = false; clearTimeout(timerS); timerS = setTimeout(function () { mostrarSync = true; pintar(); }, 1500);
      clearTimeout(expiraSync); expiraSync = setTimeout(function () { S.segundoPlano = 0; pintar(); }, 25000);   // seguridad: nunca queda pegado
    }
  };
  window.hideSyncIndicator = function () {
    S.segundoPlano = Math.max(0, S.segundoPlano - 1);
    if (S.segundoPlano === 0) { clearTimeout(timerS); clearTimeout(expiraSync); mostrarSync = false; }
    pintar();
  };
  // Al volver la red: se quita el aviso de «sin conexión» y, si hubo escrituras fallidas, se vuelve a leer lo del servidor.
  window.addEventListener('online', function () { fallo = null; pintar(); if (S.sucio) { try { fetchAllDataBackground(true); } catch (e) {} } });
  // Al volver a la app tras varios minutos, se actualiza en silencio (otro dispositivo pudo haber escrito).
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && S.ultimaCarga && Date.now() - S.ultimaCarga > 5 * 60000) { try { fetchAllDataBackground(true); } catch (e) {} }
  });
})();
