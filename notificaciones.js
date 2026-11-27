// A.S.T. — Recordatorios en el celular que llegan CON LA APP CERRADA.
// Antes: los avisos vencidos se programaban "3 segundos después de abrir la app" (por eso solo llegaban al abrirla).
// Ahora: cada vez que la app se abre, vuelve del fondo o cambia un pago/mantenimiento, se calculan los avisos de los próximos 45 días y se dejan
// programados en el sistema (alarma exacta, aunque el celular esté en reposo). Los pendientes se repiten cada 3 días a las 9:00 hasta que se resuelvan.
// Si algo se paga o se marca como hecho, se vuelve a calcular y los avisos que ya no aplican se cancelan.
(function () {
  'use strict';
  const HORIZONTE_DIAS = 45, CADA_DIAS = 3, MAX_AVISOS = 60, CANAL = 'ast-recordatorios', ORIGEN = 'ast-recordatorio';
  const LN = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
  const SIS = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.AstSistema;
  const nativo = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const aviso = (m, t) => { try { showToast(m, t || 'info'); } catch (e) { console.log(m); } };
  const MIN = 60000, DIA = 86400000;
  let enCurso = false, pendiente = false, ultimaCorrida = 0;

  // Hora fija 9:00 a.m. de un día dado (hora local del celular).
  function a9(fecha) { const d = new Date(fecha); d.setHours(9, 0, 0, 0); return d; }
  // Próximos avisos de un pendiente vencido: el primero en la próxima ventana (hoy 9:00 si aún no pasó, si no mañana 9:00) y luego cada CADA_DIAS días.
  function repetidos(desde, hasta) {
    const salida = []; let t = a9(desde); if (t.getTime() <= desde.getTime() + MIN) t = new Date(t.getTime() + DIA);
    for (; t.getTime() <= hasta.getTime(); t = new Date(t.getTime() + CADA_DIAS * DIA)) salida.push(new Date(t.getTime()));
    return salida;
  }
  const dinero = n => { try { return fmt.format(n); } catch (e) { return '$ ' + n; } };

  // Función PURA (se prueba sin celular): recibe los datos y la hora actual y devuelve la lista de avisos a programar.
  function planificar(pagos, mantenimientos, ahora) {
    const hasta = new Date(ahora.getTime() + HORIZONTE_DIAS * DIA), avisos = [];
    const poner = (clave, titulo, cuerpo, cuando) => { if (cuando.getTime() > ahora.getTime() && cuando.getTime() <= hasta.getTime()) avisos.push({ clave: clave, titulo: titulo, cuerpo: cuerpo, cuando: cuando }); };
    (pagos || []).forEach(p => {
      const nombre = p.nombreProyecto || 'Pago recurrente', det = 'Cuota de ' + dinero(p.monto) + ' (' + (p.periodo || '') + ') de ' + (p.cliente || '');
      const vence = a9(p.fechaVencimiento);
      if (vence.getTime() > ahora.getTime()) {
        poner('pago_' + p.idPago + '_dia', 'Pago pendiente — ' + nombre, det, vence);
        poner('pago_' + p.idPago + '_antes', 'Mañana vence un pago — ' + nombre, det, new Date(vence.getTime() - DIA));
      } else {
        repetidos(ahora, hasta).forEach((t, i) => poner('pago_' + p.idPago + '_v' + i, '⚠️ Pago vencido — ' + nombre, det + ' sigue pendiente.', t));
      }
    });
    (mantenimientos || []).forEach(m => {
      const cliente = m.cliente || 'Cliente', det = cliente + ': ' + (m.nombreProyecto || ''), prox = a9(m.proximaFecha), base = 'mantcam_' + m.id;
      poner(base + '_aviso', 'Mantenimiento de cámaras en 15 días', det + '. Coordina la visita.', new Date(prox.getTime() - 15 * DIA));
      if (prox.getTime() > ahora.getTime()) poner(base + '_dia', 'Hoy toca mantenimiento de cámaras', det, prox);
      else repetidos(ahora, hasta).forEach((t, i) => poner(base + '_v' + i, '⚠️ Mantenimiento de cámaras vencido', det + '.', t));
    });
    avisos.sort((a, b) => a.cuando - b.cuando);
    return avisos.slice(0, MAX_AVISOS);
  }
  const idDe = clave => (typeof hashToNotifId === 'function' ? hashToNotifId(clave) : Math.abs(clave.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)));

  async function permisos(pedir) {
    const ln = LN(); if (!ln) return { ok: false, notif: 'no-disponible' };
    let p = await ln.checkPermissions();
    if (p.display !== 'granted' && pedir) p = await ln.requestPermissions();
    let exacta = 'granted'; try { const e = await ln.checkExactNotificationSetting(); exacta = e.exact_alarm; } catch (e) {}
    return { ok: p.display === 'granted', notif: p.display, exacta: exacta };
  }
  async function crearCanal() { try { await LN().createChannel({ id: CANAL, name: 'Recordatorios de cobros y mantenimientos', description: 'Pagos pendientes y mantenimientos de cámaras', importance: 4, visibility: 1, vibration: true }); } catch (e) {} }
  async function cancelarMios() {
    const ln = LN(); let ids = [];
    try { const r = await ln.getPending(); ids = (r.notifications || []).filter(n => n.extra && n.extra.origen === ORIGEN).map(n => ({ id: n.id })); } catch (e) {}
    try { (JSON.parse(localStorage.getItem('ast_notif_ids') || '[]')).forEach(id => { if (!ids.some(x => x.id === id)) ids.push({ id: id }); }); } catch (e) {}
    if (ids.length) { try { await ln.cancel({ notifications: ids }); } catch (e) {} }
  }

  async function reprogramar(opciones) {
    opciones = opciones || {};
    if (!nativo() || !LN()) return { omitido: true };
    if (enCurso) { pendiente = true; return { enCurso: true }; }
    enCurso = true;
    try {
      const pm = await permisos(opciones.pedirPermisos !== false); if (!pm.ok) return { sinPermiso: true };
      await crearCanal();
      const [rp, rm] = await Promise.all([callApi('getPendingRecurringPayments', {}), callApi('getMantenimientosCamaras', {})]);
      // Si no hubo conexión no se tocan los avisos que ya estaban programados (mejor un aviso de más que ninguno).
      if (!(rp && rp.success) || !(rm && rm.success)) return { sinDatos: true };
      const lista = planificar(rp.data, rm.data, new Date());
      await cancelarMios();
      if (lista.length) await LN().schedule({ notifications: lista.map(a => ({ id: idDe(a.clave), title: a.titulo, body: a.cuerpo, channelId: CANAL, schedule: { at: a.cuando, allowWhileIdle: true }, extra: { origen: ORIGEN, clave: a.clave } })) });
      try { localStorage.setItem('ast_notif_ids', JSON.stringify(lista.map(a => idDe(a.clave)))); localStorage.setItem('ast_notif_ultima', String(Date.now())); } catch (e) {}
      ultimaCorrida = Date.now();
      return { programados: lista.length, proximo: lista[0] ? lista[0].cuando : null, exacta: pm.exacta };
    } catch (e) { console.error('reprogramar avisos', e); return { error: String(e) }; }
    finally { enCurso = false; if (pendiente) { pendiente = false; setTimeout(() => reprogramar({ pedirPermisos: false }), 2000); } }
  }

  // Estado para la pantalla «Avisos y recordatorios»
  async function estado() {
    const ln = LN(); if (!nativo() || !ln) return { nativo: false };
    const pm = await permisos(false); let pend = 0, prox = null;
    try { const r = await ln.getPending(); const mios = (r.notifications || []).filter(n => n.extra && n.extra.origen === ORIGEN); pend = mios.length; mios.forEach(n => { const t = n.schedule && n.schedule.at && new Date(n.schedule.at); if (t && (!prox || t < prox)) prox = t; }); } catch (e) {}
    let bateria = null; try { if (SIS()) bateria = (await SIS().estadoBateria()).sinRestriccion; } catch (e) {}
    return { nativo: true, notif: pm.notif, exacta: pm.exacta, programados: pend, proximo: prox, bateriaSinRestriccion: bateria };
  }
  async function probar() {
    const pm = await permisos(true); if (!pm.ok) { aviso('Primero permite las notificaciones de A.S.T. en los ajustes del celular.', 'danger'); return false; }
    await crearCanal(); const cuando = new Date(Date.now() + 60000);
    await LN().schedule({ notifications: [{ id: 987654, title: 'Prueba de A.S.T.', body: 'Si ves este aviso con la app cerrada, los recordatorios funcionan.', channelId: CANAL, schedule: { at: cuando, allowWhileIdle: true }, extra: { origen: 'ast-prueba' } }] });
    return true;
  }

  window.AST_NOTIF = { planificar: planificar, reprogramar: reprogramar, estado: estado, probar: probar, permisos: permisos };

  // Disparadores: al abrir (lo llama iniciarDatos), al volver del fondo (máx. 1 vez cada 20 min) y cuando cambia algo que afecta los avisos.
  const CAMBIA_AVISOS = /^(registerRecurringPayment|addInitialPayment|updateRecurringPayment|addRecurringPayment|deleteRecurringPayment|configureRecurringPayment|marcarMantenimientoCamarasRealizado|updateProject|deleteProject)$/;
  window.AST_NOTIF.alEscribir = accion => { if (CAMBIA_AVISOS.test(accion)) { clearTimeout(window.AST_NOTIF._t); window.AST_NOTIF._t = setTimeout(() => reprogramar({ pedirPermisos: false }), 3000); } };
  try { const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.addListener) A.addListener('appStateChange', s => { if (s && s.isActive && Date.now() - ultimaCorrida > 20 * MIN) reprogramar({ pedirPermisos: false }); }); } catch (e) {}

  // ---------- Pantalla «Avisos y recordatorios» (Más): estado, permisos y prueba con la app cerrada ----------
  window.avisosAST = async function () {
    const $ = id => document.getElementById(id);
    if (!$('avisos-modal')) {
      const d = document.createElement('div'); d.className = 'modal fade'; d.id = 'avisos-modal'; d.tabIndex = -1;
      d.innerHTML = '<div class="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down"><div class="modal-content bg-dark-panel border-cyan"><div class="modal-header border-secondary"><h5 class="modal-title text-cyan">Avisos y recordatorios</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button></div><div class="modal-body">' +
        '<div id="avisos-estado" class="f1-peq" role="status" style="margin-bottom:12px">Revisando…</div>' +
        '<button type="button" id="avisos-probar" class="btn btn-lg w-100 f1-btn-primario">Probar un aviso (llega en 1 minuto)</button><small class="f1-peq">Toca el botón, <b>cierra la app del todo</b> (deslízala de recientes) y espera 1 minuto. Si el aviso llega, todo está bien.</small>' +
        '<button type="button" id="avisos-notif" class="btn btn-lg w-100 f1-btn-sec" style="margin-top:10px">Permitir notificaciones</button>' +
        '<button type="button" id="avisos-exacta" class="btn btn-lg w-100 f1-btn-sec" style="margin-top:10px">Permitir alarmas exactas</button>' +
        '<button type="button" id="avisos-bateria" class="btn btn-lg w-100 f1-btn-sec" style="margin-top:10px">Quitar el ahorro de batería a A.S.T.</button>' +
        '<button type="button" id="avisos-ajustes" class="btn btn-lg w-100 f1-btn-sec" style="margin-top:10px">Abrir ajustes de notificaciones</button>' +
        '<button type="button" id="avisos-reprog" class="btn btn-lg w-100 f1-btn-sec" style="margin-top:10px">Recalcular avisos ahora</button>' +
        '<small class="f1-peq">Los avisos se programan en el celular para los próximos 45 días y se repiten cada 3 días a las 9:00 mientras algo siga pendiente. Si pagan o marcas algo como hecho, se recalculan solos. Si cambias de celular o borras los datos de la app, ábrela una vez para que se programen otra vez.</small></div></div></div>';
      document.body.appendChild(d);
      const f = x => x.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      async function pintar() {
        const e = await estado(), el = $('avisos-estado');
        if (!e.nativo) { el.innerHTML = 'Los avisos con la app cerrada solo funcionan en la <b>app Android</b> (APK), no en el navegador.'; return; }
        const si = '✅ ', no = '❌ ';
        el.innerHTML = (e.notif === 'granted' ? si : no) + 'Notificaciones: <b>' + (e.notif === 'granted' ? 'permitidas' : 'NO permitidas') + '</b><br>' +
          (e.exacta === 'granted' ? si : no) + 'Alarmas exactas: <b>' + (e.exacta === 'granted' ? 'permitidas' : 'NO permitidas (los avisos pueden retrasarse)') + '</b><br>' +
          (e.bateriaSinRestriccion === null ? '' : (e.bateriaSinRestriccion ? si : no) + 'Batería: <b>' + (e.bateriaSinRestriccion ? 'sin restricción' : 'con ahorro (el sistema puede frenar los avisos)') + '</b><br>') +
          '🔔 Avisos programados: <b>' + e.programados + '</b>' + (e.proximo ? ' · próximo: <b>' + f(e.proximo) + '</b>' : '');
      }
      window._avisosPintar = pintar;
      $('avisos-probar').onclick = async () => { if (await probar()) aviso('Aviso de prueba programado. Cierra la app y espera 1 minuto.'); pintar(); };
      $('avisos-notif').onclick = async () => { await permisos(true); await pintar(); if ((await estado()).notif !== 'granted' && SIS()) SIS().abrirAjustesNotificaciones(); };
      $('avisos-exacta').onclick = async () => { try { await LN().changeExactNotificationSetting(); } catch (e) {} setTimeout(pintar, 1500); };
      $('avisos-bateria').onclick = async () => { try { if (SIS()) await SIS().pedirSinRestriccionBateria(); else aviso('Esta función viene con la APK nueva.', 'danger'); } catch (e) { aviso('No se pudo abrir el ajuste.', 'danger'); } };
      $('avisos-ajustes').onclick = () => { try { SIS() ? SIS().abrirAjustesNotificaciones() : aviso('Esta función viene con la APK nueva.', 'danger'); } catch (e) {} };
      $('avisos-reprog').onclick = async () => { const r = await reprogramar({ pedirPermisos: true }); aviso(r.programados != null ? 'Avisos recalculados: ' + r.programados + ' programados.' : 'No se pudo recalcular (revisa permisos y conexión).', r.programados != null ? 'info' : 'danger'); pintar(); };
      d.addEventListener('shown.bs.modal', pintar);
    }
    bootstrap.Modal.getOrCreateInstance($('avisos-modal')).show();
  };
  if (typeof module !== 'undefined') module.exports = { planificar: planificar };
})();
