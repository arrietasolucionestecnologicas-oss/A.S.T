// ==========================================
// A.S.T. ADMIN FRONTEND (V33 - LATENCIA CERO & OPTIMISTIC UI)
// ==========================================
// *** PEGA AQUÍ TU URL DEL SCRIPT ***
const API_URL = "https://script.google.com/macros/s/AKfycbxpCp7aY4L48znjtqH_1svYzY6MjVY58bXxt3iZvyuPQwBBt0u7S32aXxxt9VVgtaHd/exec";
const API_KEY = "AST Web App 2026"; 

let catalog = [];
let cart = [];
let projects = []; 
let clients = []; 
let historyDocs = []; 
let proveedores = [];
let currentProject = null; 
let currentProjectData = null; 
let currentProjectItems = []; 
let currentView = 'PRODUCTO';
let currentCatalogView = 'cards';
let deferredPrompt; 
let bulkCart         = [];
let _bulkSearchTimer = null;

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// --- PUENTE DE NAVEGACIÓN EXTERNA (PDFs, WhatsApp, enlaces) ---
async function openExternalUrl(url) {
    if (window.Capacitor && window.Capacitor.Plugins.Browser) {
        await window.Capacitor.Plugins.Browser.open({ url });
    } else {
        window.open(url, '_blank');
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- SOLUCIÓN: MANEJO DEL BOTÓN ATRÁS EN MÓVILES (Evita Pantalla Negra) ---
document.addEventListener('show.bs.modal', function () {
    window.history.pushState({ modal: true }, "");
});

window.addEventListener('popstate', function (event) {
    const openModal = document.querySelector('.modal.show');
    if (openModal) {
        const modalInstance = bootstrap.Modal.getInstance(openModal);
        if (modalInstance) {
            modalInstance.hide();
        }
    }
});

function cleanBackdrops() {
    setTimeout(() => {
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }, 300);
}
// -------------------------------------------------------------------------

// --- SISTEMA DE FLUIDEZ EXTREMA (CACHÉ Y SINCRONIZACIÓN) ---
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function setCacheWithTimestamp(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem(key + '_ts', Date.now().toString());
    } catch(e) {
        console.error("Error escribiendo caché", e);
    }
}

function getCacheIfFresh(key) {
    try {
        const ts = localStorage.getItem(key + '_ts');
        if (!ts) return null;
        if (Date.now() - parseInt(ts) > CACHE_TTL_MS) return null;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch(e) {
        return null;
    }
}

function loadLocalCache() {
    try {
        const c  = getCacheIfFresh('ast_catalog');
        const p  = getCacheIfFresh('ast_projects');
        const cl = getCacheIfFresh('ast_clients');
        const h  = getCacheIfFresh('ast_history');
        const pr = getCacheIfFresh('ast_proveedores');

        if (c)  catalog     = c;
        if (p)  projects    = p;
        if (cl) clients     = cl;
        if (h)  historyDocs = h;
        if (pr) proveedores = pr;

        // Si alguna entidad expiró, la señalamos para refresh inmediato
        if (!c || !p || !cl || !h || !pr) {
            console.info("Caché expirada o ausente — se forzará sincronización.");
        }
    } catch(e) {
        console.error("Error leyendo caché", e);
    }
}

async function fetchAllDataBackground() {
    showSyncIndicator();
    const res = await callApi('getAllData');
    if (res.success) {
        catalog     = res.data.catalog     || [];
        projects    = res.data.projects    || [];
        clients     = res.data.clients     || [];
        historyDocs = res.data.historyDocs || [];
        proveedores = res.data.proveedores || [];

        // CAMBIO: usar setCacheWithTimestamp en lugar de setItem directo
        setCacheWithTimestamp('ast_catalog',     catalog);
        setCacheWithTimestamp('ast_projects',    projects);
        setCacheWithTimestamp('ast_clients',     clients);
        setCacheWithTimestamp('ast_history',     historyDocs);
        setCacheWithTimestamp('ast_proveedores', proveedores);

        if (currentView === 'PROYECTOS')        { renderProjects(); calculateDashboard(); }
        else if (currentView === 'HISTORIAL')   { renderHistory(); }
        else if (currentView === 'PROVEEDORES') { renderProveedores(); }
        else {
            const filtered = catalog.filter(p => p.tipo === currentView);
            renderGrid(filtered);
        }
        updateClientsDatalist();
        updateProvidersDatalist();
    }
    hideSyncIndicator();
}

async function refreshCatalogOnly() {
    const res = await callApi('getCatalogData');
    if (res.success) {
        catalog = res.data || [];
       setCacheWithTimestamp('ast_catalog', catalog);
        if (currentView === 'PRODUCTO' || currentView === 'SERVICIO') {
            renderGrid(catalog.filter(p => p.tipo === currentView));
        }
    }
}

async function refreshProjectsOnly() {
    const res = await callApi('getProjectsData');
    if (res.success) {
        projects = res.data || [];
        setCacheWithTimestamp('ast_projects', projects);
        if (currentView === 'PROYECTOS') {
            renderProjects();
            calculateDashboard();
        }
    }
}

async function refreshProveedoresOnly() {
    const res = await callApi('getProveedoresData');
    if (res.success) {
        proveedores = res.data || [];
        setCacheWithTimestamp('ast_proveedores', proveedores);;
        if (currentView === 'PROVEEDORES') {
            renderProveedores();
        }
        updateProvidersDatalist();
    }
}

async function refreshHistoryOnly() {
    const res = await callApi('getHistoryData');
    if (res.success) {
        historyDocs = res.data || [];
        setCacheWithTimestamp('ast_history', historyDocs);
        if (currentView === 'HISTORIAL') renderHistory();
    }
}

async function refreshClientsOnly() {
    const res = await callApi('getClientsData');
    if (res.success) {
        clients = res.data || [];
        setCacheWithTimestamp('ast_clients', clients);
        updateClientsDatalist();
    }
}

function showSyncIndicator() {
    let ind = document.getElementById('sync-indicator');
    if (!ind) {
        ind = document.createElement('div');
        ind.id = 'sync-indicator';
        ind.style.position = 'fixed';
        ind.style.top = '10px';
        ind.style.left = '50%';
        ind.style.transform = 'translateX(-50%)';
        ind.style.background = 'rgba(0, 164, 228, 0.9)';
        ind.style.color = '#fff';
        ind.style.padding = '4px 12px';
        ind.style.borderRadius = '20px';
        ind.style.fontSize = '11px';
        ind.style.zIndex = '9999';
        ind.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        ind.innerHTML = '<span class="spinner-border spinner-border-sm me-1" style="width: 0.8rem; height: 0.8rem; border-width: 0.15em;"></span> Sincronizando...';
        document.body.appendChild(ind);
    }
    ind.style.display = 'block';
}

function hideSyncIndicator() {
    const ind = document.getElementById('sync-indicator');
    if (ind) ind.style.display = 'none';
}

function setOfflineIndicator(visible) {
    const ind = document.getElementById('offline-indicator');
    if (ind) ind.style.display = visible ? 'block' : 'none';
}

if (window.Capacitor && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('backButton', () => {
        const openModals = Array.from(document.querySelectorAll('.modal.show'));
        if (openModals.length > 0) {
            let topModal = openModals[0];
            let maxZ = parseInt(window.getComputedStyle(topModal).zIndex) || 0;
            openModals.forEach(m => {
                let z = parseInt(window.getComputedStyle(m).zIndex) || 0;
                if (z > maxZ) { maxZ = z; topModal = m; }
            });
            const modalInstance = bootstrap.Modal.getInstance(topModal);
            if (modalInstance) modalInstance.hide();
        } else {
            const mainView = document.getElementById('view-catalog');
            if (mainView && mainView.classList.contains('hidden-section')) {
                switchTab('PRODUCTO');
            } else {
                window.Capacitor.Plugins.App.exitApp();
            }
        }
    });
}

function showToast(msg, type = 'info') {
    const existing = document.getElementById('ast-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.id = 'ast-toast';
    toast.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3 z-3`;
    toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => { if (document.getElementById('ast-toast')) toast.remove() }, 3000);
}
// -----------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    loadLocalCache();

    try {
        const savedCart = localStorage.getItem('ast_cart_draft');
        if (savedCart) { cart = JSON.parse(savedCart); updateCartUI(); }
    } catch (e) {
        console.error("Error restaurando carrito guardado", e);
    }

    updateClientsDatalist();
    updateProvidersDatalist();
    
    if(currentView === 'PROYECTOS') { renderProjects(); calculateDashboard(); }
    else if(currentView === 'HISTORIAL') { renderHistory(); }
    else if(currentView === 'PROVEEDORES') { renderProveedores(); }
    else {
        const filtered = catalog.filter(p => p.tipo === currentView);
        renderGrid(filtered);
    }

    if (window.Capacitor && window.Capacitor.Plugins.SplashScreen) {
        window.Capacitor.Plugins.SplashScreen.hide();
    }

    const initNetworkLogic = async () => {
        let isConnected = true;

        // 1. Detección nativa de hardware (Prioridad)
        if (window.Capacitor && window.Capacitor.Plugins.Network) {
            const status = await window.Capacitor.Plugins.Network.getStatus();
            isConnected = status.connected;

            window.Capacitor.Plugins.Network.addListener('networkStatusChange', status => {
                setOfflineIndicator(!status.connected);
                if (status.connected) fetchAllDataBackground();
            });
        }
        // 2. Fallback web para navegadores
        else {
            isConnected = navigator.onLine;
            window.addEventListener('online', () => { setOfflineIndicator(false); fetchAllDataBackground(); });
            window.addEventListener('offline', () => setOfflineIndicator(true));
        }

        // 3. Control visual
        setOfflineIndicator(!isConnected);

        // 4. Ejecución de seguridad incondicional:
        // Lanzamos la petición de todas formas. Si realmente no hay red,
        // la promesa fallará silenciosamente y el catálogo usará el caché local.
        fetchAllDataBackground();
    };
    initNetworkLogic();

document.getElementById('search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (currentView === 'PROYECTOS') {
            renderProjectsFiltered(term);
        } else if (currentView === 'HISTORIAL') {
            renderHistoryFiltered(term);
        } else if (currentView === 'PROVEEDORES') {
            return;
        } else {
            const filtered = catalog.filter(p =>
                p.tipo === currentView &&
                (
                    p.nombre.toLowerCase().includes(term) ||
                    String(p.codigo).toLowerCase().includes(term) ||
                    (p.specs && p.specs.toLowerCase().includes(term)) ||
                    (p.categoria && p.categoria.toLowerCase().includes(term))
                )
            );
            renderGrid(filtered);
        }
    });

}); // ← ESTE ES EL CIERRE DE DOMContentLoaded QUE FALTABA

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-install');
    if (installBtn) installBtn.style.display = 'block';
});

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        document.getElementById('btn-install').style.display = 'none';
    }
}

function switchTab(viewName) {
    currentView = viewName;

    // Limpiar buscador al cambiar de vista
    const searchEl = document.getElementById('search');
    if (searchEl) searchEl.value = '';

    document.getElementById('tab-prod').className = 'nav-link';
    document.getElementById('tab-serv').className = 'nav-link';
    document.getElementById('tab-proj').className = 'nav-link';
    document.getElementById('tab-hist').className = 'nav-link';
    document.getElementById('tab-prov').className = 'nav-link';

    if(viewName === 'PRODUCTO') document.getElementById('tab-prod').className = 'nav-link active';
    if(viewName === 'SERVICIO') document.getElementById('tab-serv').className = 'nav-link active';
    if(viewName === 'PROYECTOS') document.getElementById('tab-proj').className = 'nav-link active';
    if(viewName === 'HISTORIAL') document.getElementById('tab-hist').className = 'nav-link active';
    if(viewName === 'PROVEEDORES') document.getElementById('tab-prov').className = 'nav-link active';

    document.getElementById('view-catalog').classList.add('hidden-section');
    document.getElementById('view-projects').classList.add('hidden-section');
    document.getElementById('view-history').classList.add('hidden-section');
    document.getElementById('view-proveedores').classList.add('hidden-section');
    document.getElementById('fab-cart').style.display = 'none';
    document.getElementById('btn-main-add').style.display = 'none';

    if (viewName === 'PROYECTOS') {
        document.getElementById('view-projects').classList.remove('hidden-section');
        fetchProjects();
    }
    else if (viewName === 'HISTORIAL') {
        document.getElementById('view-history').classList.remove('hidden-section');
        fetchHistory();
    }
    else if (viewName === 'PROVEEDORES') {
        document.getElementById('view-proveedores').classList.remove('hidden-section');
        renderProveedores();
    }
    else {
        document.getElementById('view-catalog').classList.remove('hidden-section');
        document.getElementById('fab-cart').style.display = 'flex';
        document.getElementById('btn-main-add').style.display = 'block';
        const filtered = catalog.filter(p => p.tipo === currentView);
        renderGrid(filtered);
    }
}

function switchCatalogView(mode) {
    currentCatalogView = mode;
    document.getElementById('btn-view-cards').className = mode === 'cards'
        ? 'btn btn-sm btn-cyan'
        : 'btn btn-sm btn-outline-secondary';
    document.getElementById('btn-view-list').className = mode === 'list'
        ? 'btn btn-sm btn-cyan'
        : 'btn btn-sm btn-outline-secondary';
    const filtered = catalog.filter(p => p.tipo === currentView);
    renderGrid(filtered);
}
async function callApi(action, payload = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST', redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: action, auth: API_KEY, payload: payload })
        });
        const result = await response.json();
        document.getElementById('connection-status').className = 'status-dot bg-success';
        return result;
    } catch (error) {
        console.error("Error API:", error);
        document.getElementById('connection-status').className = 'status-dot bg-danger';
        return { success: false, error: error.message };
    }
}

async function fetchCatalog() {
    if(catalog.length > 0 && currentView !== 'PROYECTOS' && currentView !== 'HISTORIAL' && currentView !== 'PROVEEDORES') {
         switchTab(currentView); 
    }
}

// --- GESTIÓN DE CLIENTES ---
async function fetchClients() {
    updateClientsDatalist();
}

function updateClientsDatalist() {
    const datalist = document.getElementById('clients-datalist');
    if (!datalist) return;
    datalist.innerHTML = '';
    clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nombre;
        datalist.appendChild(opt);
    });
}

function autoFillClient(name, prefix) {
    const client = clients.find(c => c.nombre === name);
    if (client) {
        if (prefix === 'c') { 
            document.getElementById('c-nit').value = client.nit;
            document.getElementById('c-tel').value = client.telefono;
        } 
    }
}

// --- GESTIÓN DE PROVEEDORES ---
function updateProvidersDatalist() {
    const datalist = document.getElementById('providers-datalist');
    if (!datalist) return;
    datalist.innerHTML = '';
    proveedores.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.nombre;
        datalist.appendChild(opt);
    });
}

function renderProveedores() {
    const container = document.getElementById('proveedores-list');
    container.innerHTML = '';
    if (proveedores.length === 0) {
        container.innerHTML = '<div class="text-muted text-center mt-5">No hay proveedores registrados.</div>';
        return;
    }
    let listToRender = proveedores;
    const term = document.getElementById('search-prov') ? document.getElementById('search-prov').value.toLowerCase() : "";
    if (term) {
        listToRender = proveedores.filter(p => p.nombre.toLowerCase().includes(term));
    }
    listToRender.forEach((p, index) => {
        const actualIndex = proveedores.findIndex(x => x.nombre === p.nombre);
        const date = new Date(p.fecha).toLocaleDateString();
        const card = `
        <div class="project-card border-info">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h6 class="text-white fw-bold mb-1">${p.nombre}</h6>
                    <span class="badge bg-secondary">${p.especialidad || 'General'}</span>
                </div>
                <button class="btn btn-sm text-warning p-0" onclick="openEditProveedorModal(${actualIndex})" title="Editar Proveedor"><i class="bi bi-pencil-square"></i></button>
            </div>
            <div class="mt-2">
                <small class="text-cyan d-block mb-1">NIT: ${p.nit || '---'} | Tel: ${p.contacto || '---'}</small>
                <small class="text-muted" style="font-size:0.7rem;">Registrado: ${date}</small>
            </div>
        </div>`;
        container.innerHTML += card;
    });
}

function openEditProveedorModal(index) {
    const p = proveedores[index];
    if(!p) return;
    document.getElementById('prov-original').value = p.nombre;
    document.getElementById('prov-nombre').value = p.nombre;
    document.getElementById('prov-nit').value = p.nit || '';
    document.getElementById('prov-contacto').value = p.contacto || '';
    document.getElementById('prov-especialidad').value = p.especialidad || '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editProveedorModal')).show();
}
function openNewProveedorModal() {
    document.getElementById('prov-original').value    = "";
    document.getElementById('prov-nombre').value      = "";
    document.getElementById('prov-nit').value         = "";
    document.getElementById('prov-contacto').value    = "";
    document.getElementById('prov-especialidad').value = "";
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editProveedorModal')).show();
}
function saveProveedor() {
    const payload = {
        originalNombre: document.getElementById('prov-original').value,
        nombre:         document.getElementById('prov-nombre').value,
        nit:            document.getElementById('prov-nit').value,
        contacto:       document.getElementById('prov-contacto').value,
        especialidad:   document.getElementById('prov-especialidad').value
    };

    if (!payload.nombre) return alert("El nombre es obligatorio");

    const isNew = !payload.originalNombre || payload.originalNombre.trim() === "";

    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('editProveedorModal'));
    if (modalInstance) { modalInstance.hide(); cleanBackdrops(); }

    // OPTIMISTIC UPDATE
    if (isNew) {
        proveedores.push({
            nombre:       payload.nombre,
            nit:          payload.nit,
            contacto:     payload.contacto,
            especialidad: payload.especialidad,
            fecha:        new Date().toISOString()
        });
    } else {
        const idx = proveedores.findIndex(p => p.nombre.toLowerCase() === payload.originalNombre.toLowerCase());
        if (idx !== -1) proveedores[idx] = { ...proveedores[idx], ...payload };
    }

    renderProveedores();
    updateProvidersDatalist();

    showSyncIndicator();
    callApi('updateProveedor', payload).then(res => {
        hideSyncIndicator();
        // Chequear success tanto en outer como en inner data
        const ok = res.success && res.data && res.data.success !== false;
        if (ok) {
            refreshProveedoresOnly();
            showToast(isNew ? '✅ Proveedor creado' : '✅ Proveedor actualizado', 'success');
        } else {
            const errMsg = (res.data && res.data.error) ? res.data.error : res.error || "Error desconocido";
            showToast("Error: " + errMsg, "danger");
            refreshProveedoresOnly();
        }
    });
}

async function openCostHistory() {
    const nombreProd = document.getElementById('p-nombre').value;
    if (!nombreProd) return;
    document.getElementById('ch-title').innerText = nombreProd;
    const container = document.getElementById('ch-list');
    container.innerHTML = '<div class="text-center mt-3"><div class="spinner-border text-info spinner-border-sm"></div></div>';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('costHistoryModal')).show();
    
    const res = await callApi('getProductCostHistory', { nombre: nombreProd });
    container.innerHTML = '';
    if (res.success) {
        if (res.data.length === 0) {
            container.innerHTML = '<div class="text-muted text-center small mt-3">No hay compras registradas para este material.</div>';
        } else {
            res.data.forEach(item => {
                const date = new Date(item.fecha).toLocaleDateString();
                container.innerHTML += `
                <div class="d-flex justify-content-between align-items-center border-bottom border-secondary py-2">
                    <div>
                        <div class="text-white small fw-bold">${item.proveedor || 'Sin Proveedor'}</div>
                        <div class="text-muted" style="font-size:0.7rem;">${date} | Cant: ${item.cantidad}</div>
                    </div>
                    <div class="text-danger fw-bold small">${fmt.format(item.costo)}</div>
                </div>`;
            });
        }
    } else {
        container.innerHTML = `<div class="text-danger text-center small mt-3">Error: ${res.error}</div>`;
    }
}

// --- GESTIÓN DE PROYECTOS ---
function renderProjects() {
    const container = document.getElementById('projects-list');
    container.innerHTML = '';
    if (projects.length === 0) {
        container.innerHTML = '<div class="text-muted text-center mt-5">No hay trabajos activos.</div>';
        return;
    }
    projects.forEach(p => {
        const estadoClass = p.estado === 'ABIERTO' ? 'text-success' : 'text-secondary';
        const card = `
        <div class="project-card" onclick="openProjectDetail('${p.id}')">
            <div class="d-flex justify-content-between">
                <h6 class="text-white fw-bold mb-1">${p.nombreProyecto}</h6>
                <span class="badge bg-dark border border-secondary ${estadoClass}">${p.estado}</span>
            </div>
            <small class="text-cyan d-block mb-2">${p.cliente}</small>
            <div class="row g-0 text-center" style="font-size:0.75rem;">
                <div class="col-4 border-end border-secondary">
                    <span class="text-muted">COBRADO</span><br>
                    <span class="text-white">${fmt.format(p.totalCobrado)}</span>
                </div>
                <div class="col-4 border-end border-secondary">
                    <span class="text-muted">COSTOS</span><br>
                    <span class="text-danger">${fmt.format(p.totalCostos)}</span>
                </div>
                <div class="col-4">
                    <span class="text-muted">UTILIDAD</span><br>
                    <span class="${p.utilidad >= 0 ? 'text-profit' : 'text-loss'}">${fmt.format(p.utilidad)}</span>
                </div>
            </div>
        </div>`;
        container.innerHTML += card;
    });
}
async function fetchProjects() {
    renderProjects();
    calculateDashboard();
}

function renderProjectsFiltered(term) {
    const container = document.getElementById('projects-list');
    container.innerHTML = '';

    let lista = projects;
    if (term) {
        lista = projects.filter(p =>
            p.nombreProyecto.toLowerCase().includes(term) ||
            p.cliente.toLowerCase().includes(term) ||
            (p.contacto && p.contacto.toLowerCase().includes(term)) ||
            p.estado.toLowerCase().includes(term)
        );
    }

    if (lista.length === 0) {
        container.innerHTML = `<div class="text-muted text-center mt-5">Sin resultados para "<strong>${term}</strong>".</div>`;
        return;
    }

    lista.forEach(p => {
        const estadoClass = p.estado === 'ABIERTO' ? 'text-success' : 'text-secondary';
        container.innerHTML += `
        <div class="project-card" onclick="openProjectDetail('${p.id}')">
            <div class="d-flex justify-content-between">
                <h6 class="text-white fw-bold mb-1">${p.nombreProyecto}</h6>
                <span class="badge bg-dark border border-secondary ${estadoClass}">${p.estado}</span>
            </div>
            <small class="text-cyan d-block mb-2">${p.cliente}</small>
            <div class="row g-0 text-center" style="font-size:0.75rem;">
                <div class="col-4 border-end border-secondary">
                    <span class="text-muted">COBRADO</span><br>
                    <span class="text-white">${fmt.format(p.totalCobrado)}</span>
                </div>
                <div class="col-4 border-end border-secondary">
                    <span class="text-muted">COSTOS</span><br>
                    <span class="text-danger">${fmt.format(p.totalCostos)}</span>
                </div>
                <div class="col-4">
                    <span class="text-muted">UTILIDAD</span><br>
                    <span class="${p.utilidad >= 0 ? 'text-profit' : 'text-loss'}">${fmt.format(p.utilidad)}</span>
                </div>
            </div>
        </div>`;
    });
}

function renderHistoryFiltered(term) {
    const container = document.getElementById('history-list');
    container.innerHTML = '';

    let lista = historyDocs;
    if (term) {
        lista = historyDocs.filter(h =>
            h.cliente.toLowerCase().includes(term) ||
            h.consecutivo.toLowerCase().includes(term) ||
            h.tipo.toLowerCase().includes(term)
        );
    }

    if (lista.length === 0) {
        container.innerHTML = `<div class="text-muted text-center mt-5">Sin resultados para "<strong>${term}</strong>".</div>`;
        return;
    }

    lista.forEach(h => {
        const index = historyDocs.indexOf(h);
        const date = new Date(h.fecha).toLocaleDateString();
        let btnConvertir = '';
        if (h.tipo === 'Cotización') {
            btnConvertir = `<button class="btn btn-outline-info" onclick="convertQuoteToProject(${index})" title="Convertir a Proyecto"><i class="bi bi-briefcase-fill"></i></button>`;
        }
        container.innerHTML += `
        <div class="history-card">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="text-cyan fw-bold">${h.consecutivo}</div>
                    <div class="text-white small">${h.cliente}</div>
                    <div class="text-muted" style="font-size:0.7rem;">${date} | ${h.tipo}</div>
                </div>
                <div class="text-end d-flex flex-column align-items-end gap-1">
                    <div class="text-white fw-bold">${fmt.format(h.total)}</div>
                    <div class="btn-group btn-group-sm">
                        <a href="${h.url}" target="_blank" class="btn btn-outline-light" title="Ver PDF"><i class="bi bi-eye"></i></a>
                        <button class="btn btn-outline-warning" onclick="reloadOrderFromHistory(${index})" title="Cargar al Carrito"><i class="bi bi-pencil-square"></i></button>
                        ${btnConvertir}
                    </div>
                </div>
            </div>
        </div>`;
    });
}
function calculateDashboard() {
    let cobrado = 0, gastos = 0, utilidad = 0;
    projects.forEach(p => {
        if(p.estado === 'ABIERTO') {
            cobrado += p.totalCobrado;
            gastos += p.totalCostos;
            utilidad += p.utilidad;
        }
    });
    document.getElementById('kpi-cobrado').innerText = fmt.format(cobrado);
    document.getElementById('kpi-gastos').innerText = fmt.format(gastos);
    document.getElementById('kpi-utilidad').innerText = fmt.format(utilidad);
    const margen = cobrado > 0 ? ((utilidad / cobrado) * 100).toFixed(1) : 0;
    document.getElementById('kpi-margen').innerText = margen + "%";
    document.getElementById('projects-dashboard').classList.remove('d-none');
}

function openNewProjectModal() {
    document.getElementById('np-proyecto').value = "";
    document.getElementById('np-cliente').value = "";
    document.getElementById('np-contacto').value = "";
    bootstrap.Modal.getOrCreateInstance(document.getElementById('newProjectModal')).show();
}

function createNewProject() {
    const payload = {
        id: "PROJ-" + new Date().getTime(),
        nombreProyecto: document.getElementById('np-proyecto').value,
        cliente: document.getElementById('np-cliente').value,
        contacto: document.getElementById('np-contacto').value
    };
    if(!payload.nombreProyecto || !payload.cliente) return alert("Nombre y Cliente obligatorios");
    
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('newProjectModal'));
    if(modalInstance) {
        modalInstance.hide();
        cleanBackdrops();
    }
    
    // OPTIMISTIC UPDATE
    projects.unshift({
        id: payload.id,
        fecha: new Date().toISOString(),
        cliente: payload.cliente,
        nombreProyecto: payload.nombreProyecto,
        contacto: payload.contacto,
        estado: "ABIERTO",
        totalCobrado: 0,
        totalCostos: 0,
        utilidad: 0
    });
    renderProjects();
    calculateDashboard();
    
    showSyncIndicator();
    callApi('createProject', payload).then(res => {
        hideSyncIndicator();
        if(res.success) {
            refreshProjectsOnly();
        } else {
            showToast("Error de sincronización", "danger");
            refreshProjectsOnly();
        }
    });
}

// --- DETALLE DE PROYECTO ---
async function openProjectDetail(id) {
    currentProject = id;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('projectDetailModal')).show();

    const pInfo = projects.find(p => p.id === id);
    if (pInfo) {
        document.getElementById('pd-title').innerText    = pInfo.nombreProyecto;
        document.getElementById('pd-subtitle').innerText = pInfo.cliente;
        document.getElementById('pd-cobrado').innerText  = fmt.format(pInfo.totalCobrado);
        document.getElementById('pd-gastos').innerText   = fmt.format(pInfo.totalCostos);
        document.getElementById('pd-utilidad').innerText = fmt.format(pInfo.utilidad);
    }
    document.getElementById('pd-items-list').innerHTML = `
        <div class="text-center mt-3">
            <div class="spinner-border text-cyan spinner-border-sm"></div>
            <div class="small text-muted mt-1">Cargando movimientos...</div>
        </div>`;

    // Primer intento
    let res = await callApi('getProjectDetails', { id: id });

    // Si el backend aún no encuentra el proyecto (race condition),
    // esperar 1.5s y reintentar una vez
    if (!res.success || !res.data || !res.data.info) {
        await new Promise(r => setTimeout(r, 1500));
        res = await callApi('getProjectDetails', { id: id });
    }

    if (!res.success || !res.data || !res.data.info) {
        document.getElementById('pd-items-list').innerHTML = `
            <div class="text-center mt-4">
                <i class="bi bi-hourglass-split text-warning" style="font-size:2rem;"></i>
                <p class="text-muted small mt-2">El proyecto se está creando.<br>Cierra y vuelve a abrirlo en unos segundos.</p>
            </div>`;
        return;
    }

    currentProjectData  = res.data.info;
    currentProjectItems = res.data.items;
    if(res.success) {
        currentProjectData  = res.data.info;
        currentProjectItems = res.data.items;
        const pdSearch = document.getElementById('pd-search');
        if (pdSearch) pdSearch.value = '';
        renderProjectItems();
    }
}

function renderProjectItems() {
    document.getElementById('pd-title').innerText = currentProjectData.nombreProyecto;
    document.getElementById('pd-subtitle').innerText = currentProjectData.cliente;
    document.getElementById('pd-cobrado').innerText = fmt.format(currentProjectData.totalCobrado);
    document.getElementById('pd-gastos').innerText = fmt.format(currentProjectData.totalCostos);
    document.getElementById('pd-utilidad').innerText = fmt.format(currentProjectData.utilidad);
    
    const list = document.getElementById('pd-items-list');
    list.innerHTML = '';
    
    currentProjectItems.forEach(item => {
        const isCobrar = (item.esCobrar === true || item.esCobrar === 'TRUE');
        const badge = isCobrar ? '<span class="badge bg-success">COBRABLE</span>' : '<span class="badge bg-secondary">NO COBRABLE</span>';
        
        const html = `
        <div class="d-flex justify-content-between align-items-center border-bottom border-secondary py-2">
            <div class="overflow-hidden me-2">
                <div class="text-white small fw-bold text-truncate">${item.descripcion}</div>
                <div class="text-muted" style="font-size:0.7rem;">${item.tipo} | ${item.proveedor || '-'}</div>
                ${badge}
            </div>
            <div class="text-end" style="min-width: 80px;">
                <div class="text-danger small">-${fmt.format(item.costo * item.cantidad)}</div>
                ${isCobrar ? `<div class="text-success small">+${fmt.format(item.venta * item.cantidad)}</div>` : ''}
            </div>
            <div class="d-flex flex-column align-items-end ms-2 gap-1">
                <button class="btn btn-sm text-warning p-0" onclick="openEditItemModal('${item.idMov}')" title="Editar Movimiento"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm text-danger p-0" onclick="deleteProjectMovement('${item.idMov}')" title="Eliminar Movimiento"><i class="bi bi-trash"></i></button>
            </div>
        </div>`;
        list.innerHTML += html;
    });
}

function openEditProjectModal() {
    if(!currentProjectData) return;
    document.getElementById('ep-id').value = currentProjectData.id;
    document.getElementById('ep-proyecto').value = currentProjectData.nombreProyecto;
    document.getElementById('ep-cliente').value = currentProjectData.cliente;
    document.getElementById('ep-contacto').value = currentProjectData.contacto;
    document.getElementById('ep-estado').value = currentProjectData.estado;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editProjectModal')).show();
}

function updateProject() {
    const payload = {
        id: document.getElementById('ep-id').value,
        nombreProyecto: document.getElementById('ep-proyecto').value,
        cliente: document.getElementById('ep-cliente').value,
        contacto: document.getElementById('ep-contacto').value,
        estado: document.getElementById('ep-estado').value
    };
    
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('editProjectModal'));
    if(modalInstance) {
        modalInstance.hide();
        cleanBackdrops();
    }
    
    // OPTIMISTIC UPDATE
    const idx = projects.findIndex(p => p.id === payload.id);
    if (idx !== -1) projects[idx] = { ...projects[idx], ...payload };
    
    if (currentProjectData && currentProjectData.id === payload.id) {
        currentProjectData = { ...currentProjectData, ...payload };
        renderProjectItems();
    }
    renderProjects();
    calculateDashboard();
    
    showSyncIndicator();
    callApi('updateProject', payload).then(res => {
        hideSyncIndicator();
        if(res.success) refreshProjectsOnly();
        else refreshProjectsOnly();
    });
}

function deleteProject() {
    if(confirm("¿Eliminar este proyecto y todo su historial?")) {
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('projectDetailModal'));
        if(modalInstance) {
            modalInstance.hide();
            cleanBackdrops();
        }
        
        // OPTIMISTIC UPDATE
        const idx = projects.findIndex(p => p.id === currentProject);
        if (idx !== -1) projects.splice(idx, 1);
        renderProjects();
        calculateDashboard();
        
        showSyncIndicator();
        callApi('deleteProject', { id: currentProject }).then(res => {
            hideSyncIndicator();
            if(res.success) refreshProjectsOnly();
            else refreshProjectsOnly();
        });
    }
}

// --- ITEMS DE PROYECTO ---
function openAddItemModal() {
    document.getElementById('ai-id').value    = "";
    document.getElementById('ai-desc').value  = "";
    document.getElementById('ai-prov').value  = "";
    document.getElementById('ai-cant').value  = 1;
    document.getElementById('ai-costo').value = 0;
    document.getElementById('ai-venta').value = 0;
    document.getElementById('ai-horas').value  = 0;
    document.getElementById('ai-estado').value = 'PENDIENTE';
    document.getElementById('ai-nota').value   = '';
    document.getElementById('ai-search').value = '';

    const results  = document.getElementById('ai-search-results');
    const selected = document.getElementById('ai-selected-item');
    const compare  = document.getElementById('ai-provider-compare');
    if (results)  { results.style.display  = 'none'; results.innerHTML  = ''; }
    if (selected) { selected.style.display = 'none'; selected.innerHTML = ''; }
    if (compare)  { compare.style.display  = 'none'; compare.innerHTML  = ''; }

    document.getElementById('ai-cobrar').checked = true;
    toggleVentaInput();

    document.querySelector('#addItemModal .modal-title').innerText = "Registrar Movimiento";
    document.querySelector('#addItemModal .btn-primary').innerText = "REGISTRAR";

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addItemModal')).show();
}

function openEditItemModal(idMov) {
    const item = currentProjectItems.find(x => x.idMov === idMov);
    if (!item) return;

    document.getElementById('ai-id').value    = item.idMov;
    document.getElementById('ai-desc').value  = item.descripcion;
    document.getElementById('ai-prov').value  = item.proveedor || "";
    document.getElementById('ai-cant').value  = item.cantidad;
    document.getElementById('ai-costo').value = item.costo;
    document.getElementById('ai-venta').value = item.venta;
    document.getElementById('ai-horas').value  = item.horas       || 0;
    document.getElementById('ai-estado').value = item.estadoTarea || 'PENDIENTE';
    document.getElementById('ai-nota').value   = item.notaVisita  || '';
    document.getElementById('ai-search').value = '';

    const results  = document.getElementById('ai-search-results');
    const selected = document.getElementById('ai-selected-item');
    const compare  = document.getElementById('ai-provider-compare');
    if (results)  { results.style.display  = 'none'; results.innerHTML  = ''; }
    if (selected) { selected.style.display = 'none'; selected.innerHTML = ''; }
    if (compare)  { compare.style.display  = 'none'; compare.innerHTML  = ''; }

    const tipoSelect = document.getElementById('ai-tipo');
    if (tipoSelect.querySelector(`option[value="${item.tipo}"]`)) {
        tipoSelect.value = item.tipo;
    }

    const checkCobrar = document.getElementById('ai-cobrar');
    checkCobrar.checked = (item.esCobrar === true || item.esCobrar === 'TRUE');
    toggleVentaInput();

    document.querySelector('#addItemModal .modal-title').innerText = "Editar Movimiento";
    document.querySelector('#addItemModal .btn-primary').innerText = "GUARDAR CAMBIOS";

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addItemModal')).show();
}
// ==========================================
// BUSCADOR CATÁLOGO MÓVIL [ZONA-FE-02] v33.2
// Reemplaza <datalist> — funciona en Android
// ==========================================
// ==========================================
// BÚSQUEDA CON RELEVANCIA [ZONA-FE-02] v33.3
// Prioriza: empieza-con > contiene-en-nombre > contiene-en-specs/codigo
// Usa normalización de tildes para no fallar por acentos
// ==========================================
function _normalizeSearch(s) {
    return String(s || '').toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buscarEnCatalogoConRelevancia(term, limit) {
    const t = _normalizeSearch(term);
    if (!t) return [];

    const scored = [];
    catalog.forEach(p => {
        const nombre = _normalizeSearch(p.nombre);
        const codigo = _normalizeSearch(p.codigo || '');
        const specs  = _normalizeSearch(p.specs || '');

        let score = -1;
        if (nombre === t)                 score = 100;
        else if (nombre.startsWith(t))     score = 90;
        else if (codigo.startsWith(t))     score = 85;
        else if (nombre.includes(t))       score = 70;
        else if (codigo.includes(t))       score = 60;
        else if (specs.includes(t))        score = 40;

        if (score > -1) scored.push({ p, score, nombre });
    });

    scored.sort((a, b) => b.score - a.score || a.nombre.localeCompare(b.nombre));

    return scored.slice(0, limit || 15).map(s => s.p);
}


let _buscarTimer = null;

function buscarEnCatalogo(valor) {
    clearTimeout(_buscarTimer);
    const box = document.getElementById('ai-search-results');
    if (!box) return;

    if (!valor || valor.trim().length < 2) {
        box.style.display = 'none';
        box.innerHTML     = '';
        return;
    }

    _buscarTimer = setTimeout(() => {
        const matches = buscarEnCatalogoConRelevancia(valor, 15);

        if (matches.length === 0) {
            box.innerHTML     = `<div style="padding:12px; text-align:center; color:#4A6680; font-size:0.8rem;">Sin resultados para "${valor}"</div>`;
            box.style.display = 'block';
            return;
        }

        box.innerHTML = matches.map(p => {
            const badge = p.tipo === 'PRODUCTO'
                ? `<span style="background:#0dcaf0;color:#000;border-radius:3px;padding:1px 5px;font-size:0.55rem;font-weight:700;">${p.codigo}</span>`
                : `<span style="background:#ffc107;color:#000;border-radius:3px;padding:1px 5px;font-size:0.55rem;font-weight:700;">SERV</span>`;
            const precio = p.precio > 0 ? fmt.format(p.precio) : 'Cotizar';
            return `
            <div onclick="seleccionarDelCatalogo('${p.uuid}')"
                 style="padding:10px 14px; border-bottom:1px solid rgba(0,200,255,0.1);
                        cursor:pointer; display:flex; align-items:center; gap:10px;"
                 onmouseenter="this.style.background='rgba(0,200,255,0.08)'"
                 onmouseleave="this.style.background='transparent'">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                        ${badge}
                        <span style="font-size:0.82rem; font-weight:600; color:#fff;
                                     white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                                     max-width:180px;">${p.nombre}</span>
                    </div>
                    <div style="font-size:0.68rem; color:#4A6680; white-space:nowrap;
                                overflow:hidden; text-overflow:ellipsis;">
                        ${p.specs ? p.specs.substring(0, 60) + '...' : '—'}
                    </div>
                </div>
                <div style="flex-shrink:0; font-size:0.78rem; font-weight:700; color:#00C8FF;">
                    ${precio}
                </div>
            </div>`;
        }).join('');

        box.style.display = 'block';
    }, 300);
}

async function seleccionarDelCatalogo(uuid) {
    const p   = catalog.find(x => x.uuid === uuid);
    const box = document.getElementById('ai-search-results');
    const sel = document.getElementById('ai-selected-item');
    if (!p) return;

    // Cerrar resultados
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }

    // Mostrar seleccionado
    document.getElementById('ai-search').value = p.nombre;
    if (sel) {
        sel.style.display = 'block';
        sel.innerHTML = `<div style="background:rgba(0,200,255,0.08); border:1px solid rgba(0,200,255,0.25);
                                     border-radius:6px; padding:8px 12px; display:flex;
                                     align-items:center; justify-content:space-between;">
            <span style="font-size:0.78rem; color:#00C8FF; font-weight:600;">
                <i class="bi bi-check-circle-fill me-1"></i>${p.nombre}
            </span>
            <span style="font-size:0.72rem; color:#4A6680;">${p.codigo}</span>
        </div>`;
    }

    // Llenar campos
    document.getElementById('ai-desc').value  = p.nombre;
    document.getElementById('ai-costo').value = p.costo  || 0;
    document.getElementById('ai-venta').value = p.precio || 0;

    const tipoSelect = document.getElementById('ai-tipo');
    tipoSelect.value = p.tipo === 'SERVICIO' ? 'MANO_OBRA' : 'MATERIAL';

    // Comparador de proveedores
    if (p.tipo === 'PRODUCTO') {
        renderProviderCompare(null, true);
        const res = await callApi('getProviderPrices', { nombre: p.nombre });
        renderProviderCompare(res.success ? res.data : []);
    } else {
        renderProviderCompare([]);
    }
}

function limpiarBuscadorCatalogo() {
    document.getElementById('ai-search').value = '';
    const box = document.getElementById('ai-search-results');
    const sel = document.getElementById('ai-selected-item');
    const cmp = document.getElementById('ai-provider-compare');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    if (sel) { sel.style.display = 'none'; sel.innerHTML = ''; }
    if (cmp) { cmp.style.display = 'none'; cmp.innerHTML = ''; }
}

// Cerrar resultados al tocar fuera
document.addEventListener('click', function(e) {
    const search  = document.getElementById('ai-search');
    const results = document.getElementById('ai-search-results');
    if (!results) return;
    if (search && !search.contains(e.target) && !results.contains(e.target)) {
        results.style.display = 'none';
    }
});
async function fillItemFromCatalog(name) {
    const item = catalog.find(p => p.nombre === name);
    if (!item) return;

    document.getElementById('ai-desc').value  = item.nombre;
    document.getElementById('ai-costo').value = item.costo  || 0;
    document.getElementById('ai-venta').value = item.precio || 0;

    const tipoSelect = document.getElementById('ai-tipo');
    if (item.tipo === 'SERVICIO') tipoSelect.value = 'MANO_OBRA';
    else tipoSelect.value = 'MATERIAL';

    if (item.tipo === 'PRODUCTO') {
        renderProviderCompare(null, true);
        const res = await callApi('getProviderPrices', { nombre: item.nombre });
        renderProviderCompare(res.success ? res.data : []);
    } else {
        renderProviderCompare([]);
    }
}
// ==========================================
// COMPARADOR DE PROVEEDORES [ZONA-FE-02] v33.1
// ==========================================
function renderProviderCompare(data, loading = false) {
    const box = document.getElementById('ai-provider-compare');
    if (!box) return;

    if (loading) {
        box.style.display = 'block';
        box.innerHTML = `<div class="text-center py-1">
            <div class="spinner-border spinner-border-sm text-cyan" style="width:0.8rem;height:0.8rem;"></div>
            <small class="text-muted ms-1">Consultando precios...</small>
        </div>`;
        return;
    }

    if (!data || data.length === 0) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }

    const minCosto = Math.min(...data.map(p => p.costo));

    box.style.display = 'block';
    box.innerHTML = `
        <div class="p-2 rounded" style="background:#0a1628; border:1px solid #0d6efd; font-size:0.75rem;">
            <div class="text-info fw-bold mb-1">
                <i class="bi bi-bar-chart-fill"></i> Precios registrados por proveedor:
            </div>
            ${data.map(p => {
                const dias    = p.fecha ? Math.floor((Date.now() - new Date(p.fecha).getTime()) / 86400000) : '?';
                const esMenor = p.costo === minCosto && data.length > 1;
                return `
                <div class="d-flex justify-content-between align-items-center py-1 border-top border-secondary">
                    <div class="overflow-hidden me-2">
                        <span class="text-white">${p.proveedor}</span>
                        <small class="text-muted ms-1">· hace ${dias}d</small>
                        ${esMenor ? '<span class="badge bg-success ms-1" style="font-size:0.55rem;">MÁS ECONÓMICO</span>' : ''}
                    </div>
                    <div class="d-flex gap-1 align-items-center flex-shrink-0">
                        <span class="fw-bold ${esMenor ? 'text-success' : 'text-white'}">${fmt.format(p.costo)}</span>
                        <button class="btn btn-sm btn-outline-info py-0 px-2" style="font-size:0.65rem;"
                                onclick="usarProveedorPrecio('${p.proveedor.replace(/'/g, "\\'")}', ${p.costo})">
                            Usar
                        </button>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
}

function usarProveedorPrecio(proveedor, costo) {
    document.getElementById('ai-prov').value  = proveedor;
    document.getElementById('ai-costo').value = costo;
    showToast(`✅ ${proveedor} — ${fmt.format(costo)}`, 'success');
}

function toggleVentaInput() {
    const isChecked = document.getElementById('ai-cobrar').checked;
    const div = document.getElementById('div-venta');
    if(isChecked) div.style.display = 'block';
    else div.style.display = 'none';
}

function saveProjectItem() {
    let idMov  = document.getElementById('ai-id').value;
    const isNew = !idMov;
    if (isNew) idMov = generateUUID();

    const payload = {
        idMov:       idMov,
        projectId:   currentProject,
        tipo:        document.getElementById('ai-tipo').value,
        descripcion: document.getElementById('ai-desc').value,
        proveedor:   document.getElementById('ai-prov').value,
        cantidad:    Number(document.getElementById('ai-cant').value),
        costo:       Number(document.getElementById('ai-costo').value),
        venta:       Number(document.getElementById('ai-venta').value),
        esCobrar:    document.getElementById('ai-cobrar').checked,
        horas:       Number(document.getElementById('ai-horas').value)  || 0,
        estadoTarea: document.getElementById('ai-estado').value,
        notaVisita:  document.getElementById('ai-nota').value
    };

    if (!payload.descripcion) return alert("Descripción requerida");

    const action = isNew ? 'addProjectMovement' : 'updateProjectMovement';

    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addItemModal'));
    if (modalInstance) {
        modalInstance.hide();
        cleanBackdrops();
    }

    // OPTIMISTIC UPDATE
    if (isNew) {
        currentProjectItems.push({ ...payload, fecha: new Date().toISOString() });
    } else {
        const idx = currentProjectItems.findIndex(x => x.idMov === idMov);
        if (idx !== -1) currentProjectItems[idx] = { ...currentProjectItems[idx], ...payload };
    }

    // Recalcular totales locales
    let tCosto = 0, tVenta = 0;
    currentProjectItems.forEach(m => {
        tCosto += (m.costo * m.cantidad);
        if (m.esCobrar === true || m.esCobrar === 'TRUE') tVenta += (m.venta * m.cantidad);
    });
    currentProjectData.totalCostos  = tCosto;
    currentProjectData.totalCobrado = tVenta;
    currentProjectData.utilidad     = tVenta - tCosto;

    const projIdx = projects.findIndex(p => p.id === currentProject);
    if (projIdx !== -1) {
        projects[projIdx].totalCostos  = tCosto;
        projects[projIdx].totalCobrado = tVenta;
        projects[projIdx].utilidad     = tVenta - tCosto;
    }

    renderProjectItems();
    calculateDashboard();

    showSyncIndicator();
    callApi(action, payload).then(res => {
        hideSyncIndicator();
        if (res.success) {
            refreshProjectsOnly();
            if (payload.tipo === 'MATERIAL' && payload.costo > 0) refreshCatalogOnly();
            if (payload.proveedor) refreshProveedoresOnly();
        } else {
            showToast("Error de sincronización", "danger");
            openProjectDetail(currentProject);
        }
    });
}

function deleteProjectMovement(idMov) {
    if(confirm("¿Borrar movimiento?")) {
        // OPTIMISTIC UPDATE
        const idx = currentProjectItems.findIndex(x => x.idMov === idMov);
        if (idx !== -1) currentProjectItems.splice(idx, 1);
        
        let tCosto = 0, tVenta = 0;
        currentProjectItems.forEach(m => {
            tCosto += (m.costo * m.cantidad);
            if (m.esCobrar === true || m.esCobrar === 'TRUE') tVenta += (m.venta * m.cantidad);
        });
        currentProjectData.totalCostos = tCosto;
        currentProjectData.totalCobrado = tVenta;
        currentProjectData.utilidad = tVenta - tCosto;
        
        renderProjectItems();
        
        showSyncIndicator();
        callApi('deleteProjectMovement', { idMov: idMov, projectId: currentProject }).then(res => {
            hideSyncIndicator();
            if(res.success) {
                refreshProjectsOnly();
            } else {
                showToast("Error de sincronización", "danger");
                openProjectDetail(currentProject); 
            }
        });
    }
}

// --- HISTORIAL ---
async function fetchHistory() {
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    if (historyDocs.length === 0) {
        container.innerHTML = '<div class="text-muted text-center mt-5">Sin documentos generados.</div>';
        return;
    }
    historyDocs.forEach((h, index) => {
        const date = new Date(h.fecha).toLocaleDateString();
        
        let btnConvertir = '';
        if (h.tipo === 'Cotización') {
            btnConvertir = `<button class="btn btn-outline-info" onclick="convertQuoteToProject(${index})" title="Convertir a Trabajo/Proyecto"><i class="bi bi-briefcase-fill"></i></button>`;
        }
        
        const html = `
        <div class="history-card">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="text-cyan fw-bold">${h.consecutivo}</div>
                    <div class="text-white small">${h.cliente}</div>
                    <div class="text-muted" style="font-size:0.7rem;">${date} | ${h.tipo}</div>
                </div>
                <div class="text-end d-flex flex-column align-items-end gap-1">
                    <div class="text-white fw-bold">${fmt.format(h.total)}</div>
                    <div class="btn-group btn-group-sm">
                        <a href="${h.url}" target="_blank" class="btn btn-outline-light" title="Ver PDF"><i class="bi bi-eye"></i></a>
                        <button class="btn btn-outline-warning" onclick="reloadOrderFromHistory(${index})" title="Editar / Cargar al Carrito"><i class="bi bi-pencil-square"></i></button>
                        ${btnConvertir}
                    </div>
                </div>
            </div>
        </div>`;
        container.innerHTML += html;
    });
}
// ==========================================
// UTILIDAD: DECODIFICADOR DE PAYLOAD B64
// ==========================================
function decodeOrderPayload(jsonData) {
    if (!jsonData || jsonData === "" || jsonData === "undefined") {
        throw new Error("Este documento no tiene datos recuperables.");
    }

    let safeJson = String(jsonData);

    // Intentar decodificación Base64 UTF-8 primero
    if (!safeJson.trim().startsWith('{') && 
        !safeJson.trim().startsWith('"') && 
        !safeJson.trim().startsWith('[')) {
        const binString = atob(safeJson);
        const bytes = new Uint8Array(binString.length);
        for (let i = 0; i < binString.length; i++) {
            bytes[i] = binString.charCodeAt(i);
        }
        return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    }

    // Fallback: JSON plano o con comillas envolventes
    if (safeJson.startsWith('"') && safeJson.endsWith('"')) {
        safeJson = safeJson.slice(1, -1).replace(/""/g, '"');
    }
    return JSON.parse(safeJson.replace(/[\r\n]+/g, " "));
}
function reloadOrderFromHistory(index) {
    const doc = historyDocs[index];

    try {
        const orderData = decodeOrderPayload(doc.jsonData);

        if (cart.length > 0) {
            if (!confirm("⚠️ Tu carrito actual se borrará para cargar esta cotización. ¿Continuar?")) return;
        }

        cart = orderData.items || [];

        if (orderData.cliente) {
            document.getElementById('c-nombre').value = orderData.cliente.nombre   || "";
            document.getElementById('c-nit').value    = orderData.cliente.nit      || "";
            document.getElementById('c-tel').value    = orderData.cliente.telefono || "";
        }

        if (orderData.opciones) {
            const checkSpecs = document.getElementById('check-specs');
            if (checkSpecs) checkSpecs.checked = orderData.opciones.mostrarDesc;

            if (orderData.opciones.terminos) {
                const checkTerms = document.getElementById('check-terms');
                const termsArea  = document.getElementById('terms-area');
                if (checkTerms && termsArea) {
                    checkTerms.checked       = true;
                    termsArea.style.display  = 'block';
                    termsArea.value          = orderData.opciones.terminos;
                }
            }
        }

        updateCartUI();
        openCart();
        showToast(`✅ Cotización ${doc.consecutivo} cargada.`, "success");

    } catch(e) {
        console.error("Error leyendo JSON:", e);
        document.getElementById('c-nombre').value = doc.cliente || "";
        showToast("⚠️ Documento antiguo: se recuperó solo el cliente.", "warning");
    }
}

async function convertQuoteToProject(index) {
    const doc = historyDocs[index];

    if (!confirm(`¿El cliente aprobó la Cotización ${doc.consecutivo}?\n\nSe creará un Trabajo Activo con todos sus ítems.`)) return;

    try {
        const orderData = decodeOrderPayload(doc.jsonData);

        const payload = {
            nombreProyecto: `Ejecución ${doc.consecutivo}`,
            cliente:  orderData.cliente ? orderData.cliente.nombre   : doc.cliente,
            contacto: orderData.cliente ? orderData.cliente.telefono : "",
            items:    orderData.items || []
        };

        showToast(`⏳ Creando proyecto desde ${doc.consecutivo}...`, "info");
        const res = await callApi('convertQuoteToProject', payload);

        if (res.success) {
            showToast(`✅ Proyecto creado exitosamente.`, "success");
            switchTab('PROYECTOS');
            refreshProjectsOnly().then(() => openProjectDetail(res.data.projectId));
            refreshClientsOnly();
        } else {
            showToast("Error al convertir: " + res.error, "danger");
        }

    } catch(e) {
        console.error("Error en conversión:", e);
        showToast("⚠️ " + e.message, "danger");
    }
}

function renderGrid(data) {
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';

    if (data.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center mt-5">
            <i class="bi bi-box-seam text-secondary" style="font-size:3rem;"></i>
            <p class="text-muted">No hay items registrados.</p>
        </div>`;
        return;
    }

    const DIAS_PRECIO_VIEJO = 120;
    const ahora = Date.now();

    if (currentCatalogView === 'list') {
        grid.className = 'row g-0';
        const wrapper = document.createElement('div');
        wrapper.className = 'col-12';
        wrapper.style.cssText = 'border-top:1px solid #222;';

        data.forEach(p => {
            let precioViejo = false;
            let diasStr = '';
            if (p.fechaUltimoCosto) {
                const dias = Math.floor((ahora - new Date(p.fechaUltimoCosto).getTime()) / 86400000);
                if (dias > DIAS_PRECIO_VIEJO) { precioViejo = true; diasStr = dias + 'd'; }
            }

            // Badge corto para lista
            const codigo = p.tipo === 'PRODUCTO' ? p.codigo : 'SRV';
            const badgeColor = p.tipo === 'PRODUCTO' ? '#0dcaf0' : '#ffc107';
            const badgeTextColor = '#000';

            const margen = (p.tipo === 'PRODUCTO' && p.costo > 0 && p.precio > 0)
                ? Math.round(((p.precio - p.costo) / p.precio) * 100) + '%'
                : null;

            const precioColor = precioViejo ? '#ffc107' : 'var(--ast-cyan)';
            const clockIcon   = precioViejo
                ? `<i class="bi bi-clock-history" style="font-size:0.6rem;color:#ffc107;margin-left:2px;" title="${diasStr}"></i>`
                : '';
            const webDot = p.visibleWeb ? '● ' : '';

            const row = document.createElement('div');
            row.style.cssText = 'background:#1a1a1a; border-bottom:1px solid #222; padding:8px 10px;';
            row.innerHTML = `
                <!-- LÍNEA 1: código | nombre | precio | acción -->
                <div style="display:flex; align-items:center; gap:6px; min-width:0;">

                    <!-- Código compacto -->
                    <div style="flex-shrink:0; display:flex; flex-direction:column; gap:2px; align-items:flex-start;">
                        <span style="background:${badgeColor}; color:${badgeTextColor}; border-radius:4px; padding:1px 5px; font-size:0.6rem; font-weight:bold; white-space:nowrap;">${codigo}</span>
                        ${margen ? `<span style="background:#198754; color:#fff; border-radius:4px; padding:1px 4px; font-size:0.55rem; white-space:nowrap;">${margen}</span>` : ''}
                    </div>

                    <!-- Nombre (ocupa todo el espacio disponible) -->
                    <div style="flex:1; min-width:0; overflow:hidden;">
                        <div onclick='openViewModal("${p.uuid}")'
                             style="font-size:0.82rem; font-weight:bold; color:#fff; cursor:pointer;
                                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${webDot ? `<span style="color:#198754;font-size:0.7rem;">${webDot}</span>` : ''}${p.nombre}
                        </div>
                        <div style="font-size:0.68rem; color:#555; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${p.specs || '---'}
                        </div>
                    </div>

                    <!-- Precio -->
                    <div style="flex-shrink:0; text-align:right; min-width:72px;">
                        <div style="font-weight:bold; color:${precioColor}; font-size:0.82rem; white-space:nowrap;">
                            ${fmt.format(p.precio)}${clockIcon}
                        </div>
                    </div>

                    <!-- Botón ver (móvil) / botones completos (desktop) -->
                    <div style="flex-shrink:0;" class="d-sm-none">
                        <button onclick='openViewModal("${p.uuid}")'
                                style="background:transparent; border:1px solid #444; color:#aaa; border-radius:4px; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
                            <i class="bi bi-chevron-right" style="font-size:0.75rem;"></i>
                        </button>
                    </div>
                    <div class="d-none d-sm-flex" style="flex-shrink:0; gap:4px;">
                        <button class="btn btn-sm btn-outline-secondary" onclick='loadEditModal("${p.uuid}")'><i class="bi bi-pencil-fill"></i></button>
                        <button class="btn btn-sm btn-cyan"              onclick='addToCart("${p.uuid}")'><i class="bi bi-plus-lg"></i></button>
                        <button class="btn btn-sm btn-outline-success"   onclick='shareProductDirectly("${p.uuid}")'><i class="bi bi-whatsapp"></i></button>
                        <button class="btn btn-sm btn-outline-info"      onclick='openViewModal("${p.uuid}")'><i class="bi bi-eye"></i></button>
                    </div>
                </div>

                <!-- LÍNEA 2: botones acción — solo móvil -->
                <div class="d-flex d-sm-none" style="gap:6px; margin-top:6px;">
                    <button class="btn btn-sm btn-outline-secondary" style="flex:1;"
                            onclick='loadEditModal("${p.uuid}")'><i class="bi bi-pencil-fill"></i> Editar</button>
                    <button class="btn btn-sm btn-cyan" style="flex:1;"
                            onclick='addToCart("${p.uuid}")'><i class="bi bi-plus-lg"></i> Cotizar</button>
                    <button class="btn btn-sm btn-outline-success" style="flex:1;"
                            onclick='shareProductDirectly("${p.uuid}")'><i class="bi bi-whatsapp"></i></button>
                </div>`;

            wrapper.appendChild(row);
        });

        grid.appendChild(wrapper);

    } else {
        // ── VISTA CARDS ───────────────────────────────────────
        grid.className = 'row g-3';

        data.forEach(p => {
            let precioViejoBadge = '';
            let precioViejo = false;
            if (p.fechaUltimoCosto) {
                const diasDiff = Math.floor((ahora - new Date(p.fechaUltimoCosto).getTime()) / 86400000);
                if (diasDiff > DIAS_PRECIO_VIEJO) {
                    precioViejo = true;
                    precioViejoBadge = `<span class="badge bg-warning text-dark ms-1" style="font-size:0.6rem;" title="${diasDiff} días sin actualizar">
                        <i class="bi bi-clock-history"></i> ${diasDiff}d
                    </span>`;
                }
            }

            const imgHtml = p.imagen
                ? `<div onclick='openViewModal("${p.uuid}")'
                        style="height:140px;overflow:hidden;border-radius:4px;margin-bottom:10px;background:#000;cursor:zoom-in;position:relative;">
                       <img src="${p.imagen}" style="width:100%;height:100%;object-fit:cover;">
                       <div style="position:absolute;bottom:4px;right:4px;pointer-events:none;">
                           <span class="badge bg-dark bg-opacity-75 border border-secondary" style="font-size:0.6rem;">
                               <i class="bi bi-zoom-in"></i>
                           </span>
                       </div>
                   </div>`
                : '';

            const badgeCode = p.tipo === 'PRODUCTO'
                ? `<span class="badge bg-info text-dark">${p.codigo}</span>`
                : `<span class="badge bg-warning text-dark">SERVICIO</span>`;

            const marginHtml = (p.tipo === 'PRODUCTO' && p.costo > 0 && p.precio > 0)
                ? `<span class="badge bg-success ms-2" style="font-size:0.65rem;">${(((p.precio - p.costo) / p.precio) * 100).toFixed(0)}% MGN</span>`
                : '';

            const precioStyle = precioViejo ? 'color:#ffc107;' : '';

            grid.innerHTML += `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="product-card h-100 p-3 d-flex flex-column">
                    <div class="d-flex justify-content-between mb-2">
                        <div>${badgeCode}${marginHtml}${precioViejoBadge}</div>
                        ${p.visibleWeb ? '<span class="text-success small">● WEB ON</span>' : ''}${p.publicadoGitHub ? ' <span class="text-warning small"><i class="bi bi-cloud-check-fill"></i></span>' : ''}
                    </div>
                    ${imgHtml}
                    <h6 class="text-white fw-bold mb-1" onclick='openViewModal("${p.uuid}")' style="cursor:pointer;">${p.nombre}</h6>
                    <small class="text-secondary mb-3 text-truncate">${p.specs || '---'}</small>
                    <div class="mt-auto d-flex justify-content-between align-items-end">
                        <div>
                            <small class="text-muted" style="font-size:0.7rem">PRECIO</small>
                            <div class="fw-bold fs-5" style="${precioStyle}">${fmt.format(p.precio)}</div>
                            ${precioViejo ? `<small style="font-size:0.6rem;color:#ffc107;">Verificar costo</small>` : ''}
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-secondary" onclick='loadEditModal("${p.uuid}")'><i class="bi bi-pencil-fill"></i></button>
                            <button class="btn btn-sm btn-cyan"              onclick='addToCart("${p.uuid}")'><i class="bi bi-plus-lg"></i></button>
                            <button class="btn btn-sm btn-outline-success"   onclick='shareProductDirectly("${p.uuid}")'><i class="bi bi-whatsapp"></i></button>
                            <button class="btn btn-sm btn-outline-info"      onclick='openViewModal("${p.uuid}")'><i class="bi bi-eye"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        });
    }
}
function openProductModal() {
    document.getElementById('prodForm').reset();
    document.getElementById('p-uuid').value = "";
    document.getElementById('p-imagen-data').value = "";
    document.getElementById('p-tipo').value = currentView === 'HISTORIAL' ? 'PRODUCTO' : currentView;
    if (document.getElementById('p-proveedor')) document.getElementById('p-proveedor').value = "";
    document.getElementById('btn-github-publish').style.display = "none";
    document.getElementById('btn-cost-history').style.display = "none";

    const alertBox = document.getElementById('p-nombre-alert');
    if (alertBox) { alertBox.style.display = 'none'; alertBox.innerHTML = ''; }

    const section = document.getElementById('prod-provider-section');
    if (section) section.style.display = 'none';

    const btn = document.querySelector('#prodModal .btn-cyan');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-save"></i> GUARDAR DATOS'; }

    toggleFormFields();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('prodModal')).show();
}

function toggleFormFields() {
    const tipo = document.getElementById('p-tipo').value;
    const fieldsProd = document.getElementById('fields-producto');
    if (tipo === 'SERVICIO') fieldsProd.classList.add('hidden-section'); 
    else fieldsProd.classList.remove('hidden-section');
}

function loadEditModal(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    if (!p) return;

    const alertBox = document.getElementById('p-nombre-alert');
    if (alertBox) { alertBox.style.display = 'none'; alertBox.innerHTML = ''; }

    document.getElementById('p-uuid').value = p.uuid;
    document.getElementById('p-tipo').value = p.tipo;
    toggleFormFields();
    document.getElementById('p-nombre').value = p.nombre;
    document.getElementById('p-specs').value = p.specs;
    document.getElementById('p-precio').value = p.precio;
    document.getElementById('p-web').checked = p.visibleWeb;
    document.getElementById('p-imagen-data').value = p.imagen;
    document.getElementById('p-imagen-file').value = "";

    const btnSave = document.querySelector('#prodModal .btn-cyan');
    if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="bi bi-save"></i> GUARDAR DATOS'; }

    const btnCostHistory = document.getElementById('btn-cost-history');
    const section = document.getElementById('prod-provider-section');

    if (p.tipo === 'PRODUCTO') {
        document.getElementById('p-categoria').value = p.categoria || "AUTOMATIZACION_APPS";
        document.getElementById('p-codigo').value = p.codigo;
        document.getElementById('p-costo').value = p.costo;
        if (document.getElementById('p-proveedor')) document.getElementById('p-proveedor').value = p.proveedor || "";
        if (btnCostHistory) btnCostHistory.style.display = "block";
        if (section) section.style.display = 'block';
        loadProductProviderPrices(p.nombre);
    } else {
        if (btnCostHistory) btnCostHistory.style.display = "none";
        if (section) section.style.display = 'none';
    }

    document.getElementById('btn-github-publish').style.display = "block";
    bootstrap.Modal.getOrCreateInstance(document.getElementById('prodModal')).show();
}
// ==========================================
// MULTI-PROVEEDOR POR PRODUCTO [ZONA-FE-02] v33.1
// ==========================================
async function loadProductProviderPrices(nombre) {
    if (!nombre) return;
    renderProductProviderPrices(null, true);
    const res = await callApi('getProviderPrices', { nombre: nombre });
    renderProductProviderPrices(res.success ? res.data : []);
}

function renderProductProviderPrices(data, loading = false) {
    const box = document.getElementById('prod-provider-list');
    if (!box) return;

    if (loading) {
        box.innerHTML = `<div class="py-1">
            <div class="spinner-border spinner-border-sm text-cyan" style="width:0.8rem;height:0.8rem;"></div>
            <small class="text-muted ms-1">Cargando precios...</small>
        </div>`;
        return;
    }

    if (!data || data.length === 0) {
        box.innerHTML = '<div class="text-muted" style="font-size:0.75rem;">Sin precios registrados. Agrega el primero abajo.</div>';
        return;
    }

    const minCosto = Math.min(...data.map(p => p.costo));
    box.innerHTML = data.map(p => {
        const dias    = p.fecha ? Math.floor((Date.now() - new Date(p.fecha).getTime()) / 86400000) : '?';
        const esMenor = p.costo === minCosto && data.length > 1;
        return `
        <div class="d-flex justify-content-between align-items-center py-1 border-bottom border-secondary">
            <div class="overflow-hidden me-2">
                <span class="text-white" style="font-size:0.75rem;">${p.proveedor}</span>
                <small class="text-muted ms-1" style="font-size:0.65rem;">· hace ${dias}d</small>
                ${esMenor ? '<span class="badge bg-success ms-1" style="font-size:0.55rem;">MÁS ECONÓMICO</span>' : ''}
            </div>
            <div class="d-flex gap-1 align-items-center flex-shrink-0">
                <span class="fw-bold ${esMenor ? 'text-success' : 'text-white'}" style="font-size:0.75rem;">${fmt.format(p.costo)}</span>
                <button class="btn btn-sm btn-outline-info py-0 px-1" style="font-size:0.6rem;"
                        title="Establecer como proveedor principal"
                        onclick="useProviderAsMain('${p.proveedor.replace(/'/g, "\\'")}', ${p.costo})">
                    <i class="bi bi-star-fill"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

function useProviderAsMain(proveedor, costo) {
    if (document.getElementById('p-proveedor')) document.getElementById('p-proveedor').value = proveedor;
    document.getElementById('p-costo').value = costo;
    showToast(`✅ ${proveedor} establecido como principal`, 'success');
}

async function saveProductProviderPrice() {
    const nombre   = document.getElementById('p-nombre').value;
    const proveedor = document.getElementById('prod-prov-nombre').value.trim();
    const costo    = Number(document.getElementById('prod-prov-costo').value);

    if (!nombre)             return showToast('Primero guarda el nombre del producto', 'warning');
    if (!proveedor)          return showToast('Escribe el nombre del proveedor', 'warning');
    if (!costo || costo <= 0) return showToast('Escribe un precio válido', 'warning');

    const btn = document.querySelector('#prod-provider-section .btn-outline-cyan');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner-border spinner-border-sm" style="width:0.7rem;height:0.7rem;"></div>'; }

    const res = await callApi('addCatalogProviderPrice', { nombre, proveedor, costo });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-plus-lg"></i>'; }

    if (res.success && res.data && res.data.success !== false) {
        document.getElementById('prod-prov-nombre').value = '';
        document.getElementById('prod-prov-costo').value  = '';
        showToast('✅ Precio registrado', 'success');
        loadProductProviderPrices(nombre);
        refreshProveedoresOnly();
    } else {
        showToast('Error al guardar precio', 'danger');
    }
}
// ==========================================
// DETECCIÓN DE DUPLICADOS [ZONA-FE-02] v33.1
// ==========================================
function _normalizeForDup(s) {
    return String(s).toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function _similarityScore(a, b) {
    const na = _normalizeForDup(a);
    const nb = _normalizeForDup(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.85;
    const wordsA = new Set(na.split(" ").filter(w => w.length > 2));
    const wordsB = new Set(nb.split(" ").filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let common = 0;
    wordsA.forEach(w => { if (wordsB.has(w)) common++; });
    return common / Math.max(wordsA.size, wordsB.size);
}

let _dupTimer = null;
function checkDuplicateProduct(value) {
    clearTimeout(_dupTimer);
    const alertBox = document.getElementById('p-nombre-alert');
    if (!alertBox) return;
    if (!value || value.length < 3) { alertBox.style.display = 'none'; return; }

    _dupTimer = setTimeout(() => {
        const currentUuid = document.getElementById('p-uuid').value;
        const matches = catalog
            .filter(p => p.uuid !== currentUuid && _similarityScore(value, p.nombre) >= 0.7)
            .slice(0, 3);

        if (matches.length === 0) { alertBox.style.display = 'none'; return; }

        alertBox.style.display = 'block';
        alertBox.innerHTML = `
            <div class="p-2 rounded mt-1" style="background:#2a1f00; border:1px solid #ffc107; font-size:0.75rem;">
                <div class="text-warning fw-bold mb-1">
                    <i class="bi bi-exclamation-triangle-fill"></i> Productos similares en catálogo:
                </div>
                ${matches.map(m => `
                <div class="d-flex justify-content-between align-items-center py-1 border-top border-secondary">
                    <span class="text-white">${m.nombre}</span>
                    <div class="d-flex gap-1">
                        <span class="text-muted" style="font-size:0.65rem;">${fmt.format(m.precio)}</span>
                        <button class="btn btn-sm btn-outline-warning py-0 px-2" style="font-size:0.65rem;"
                                onclick="loadEditModal('${m.uuid}')">
                            <i class="bi bi-eye"></i> Ver
                        </button>
                    </div>
                </div>`).join('')}
            </div>`;
    }, 500);
}
async function saveProduct() {
    const btn = document.querySelector('#prodModal .btn-cyan');
    btn.disabled = true; btn.innerText = "PROCESANDO...";
    
    const fileInput = document.getElementById('p-imagen-file');
    let finalImage = document.getElementById('p-imagen-data').value; 
    if (fileInput && fileInput.files.length > 0) {
        try {
            btn.innerText = "SUBIENDO FOTO...";
            finalImage = await toBase64(fileInput.files[0]);
        } catch (e) {
            alert("Error imagen"); btn.disabled = false; return;
        }
    }
    
    const tipo = document.getElementById('p-tipo').value;
    let uuid = document.getElementById('p-uuid').value;
    const isNew = !uuid;
    if (isNew) uuid = generateUUID();
    
    const payload = {
        uuid: uuid,
        tipo: tipo,
        nombre: document.getElementById('p-nombre').value,
        specs: document.getElementById('p-specs').value,
        precio: Number(document.getElementById('p-precio').value),
        imagen: finalImage,
        visibleWeb: document.getElementById('p-web').checked,
        categoria: tipo==='PRODUCTO' ? document.getElementById('p-categoria').value : "",
        codigo: tipo==='PRODUCTO' ? document.getElementById('p-codigo').value : "SERV",
        costo: tipo==='PRODUCTO' ? Number(document.getElementById('p-costo').value) : 0,
        proveedor: tipo==='PRODUCTO' && document.getElementById('p-proveedor') ? document.getElementById('p-proveedor').value : "",
        iva: 19 
    };
    
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('prodModal'));
    if(modalInstance) {
        modalInstance.hide();
        cleanBackdrops();
    }
    
    // OPTIMISTIC UPDATE
    if (isNew) {
        catalog.unshift(payload);
    } else {
        const idx = catalog.findIndex(x => x.uuid === uuid);
        if (idx !== -1) catalog[idx] = payload;
    }
    
    if (currentView === tipo) {
        renderGrid(catalog.filter(p => p.tipo === currentView));
    }
    
    showSyncIndicator();
    callApi('upsertProduct', payload).then(res => {
        hideSyncIndicator();
        if (res.success) {
            refreshCatalogOnly(); 
            if (payload.proveedor) refreshProveedoresOnly();
        } else {
            showToast("Error al guardar en la nube: " + res.error, "danger");
            refreshCatalogOnly(); 
        }
    });
}

async function publishToGitHub() {
    const uuid = document.getElementById('p-uuid').value;
    const nombre = document.getElementById('p-nombre').value;
    const precio = Number(document.getElementById('p-precio').value);
    const specs = document.getElementById('p-specs').value;
    let imagen = document.getElementById('p-imagen-data').value;
    if (!uuid) return alert("Primero guarda el producto.");
    const btn = document.getElementById('btn-github-publish');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> PUBLICANDO EN GITHUB...';
    const precioFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(precio);
    const payload = {
        uuid: uuid,
        nombre: nombre,
        precioFmt: precio > 0 ? precioFmt : 'Cotizar',
        specs: specs,
        imagen: imagen
    };
    const res = await callApi('publishToGitHub', payload);
    btn.disabled = false;
    btn.innerHTML = originalText;
    if (res.success) {
        const finalUrl = res.data.url;
        navigator.clipboard.writeText(finalUrl).then(() => {
            if(confirm("✅ ¡Publicado en GitHub!\nEnlace copiado. ¿Compartir en WhatsApp ahora?")) {
                 const msgShare = `🏢 *A.S.T. Soluciones Tecnológicas*\n\nConoce más detalles y especificaciones aquí:\n${finalUrl}`;
                 openExternalUrl(`https://wa.me/?text=${encodeURIComponent(msgShare)}`);
            }
        });
    } else {
        alert("Error al publicar: " + res.error);
    }
}

// NUEVA FUNCIÓN: SHARE NATIVO (Estilo King's Shop Híbrido)
async function shareProductDirectly(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    if (!p) return;

    const hasCapacitorShare = window.Capacitor && window.Capacitor.Plugins.Share;
    if (!hasCapacitorShare && !navigator.share) {
        alert("Tu navegador o dispositivo no soporta el envío directo de archivos. Entra a editar y usa el botón de Publicar en Web (GitHub).");
        return;
    }

    showToast("Preparando archivo...", "info");

    const precioStr = (p.precio && p.precio > 0) ? fmt.format(p.precio) : "Precio a convenir";
    
    let specsLimpio = "Solución Profesional";
    if (p.specs) {
        let cleaned = p.specs.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
        let lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        lines = lines.map(line => {
            line = line.replace(/^[-*•]\s*/, ''); 
            return '• ' + line;
        });
        
        specsLimpio = lines.join('\n');
    }
    
    const urlWeb = `https://arrietasolucionestecnologicas-oss.github.io/web/?open=${p.uuid}`;
    
    const textoShare = `🏢 *A.S.T. Soluciones Tecnológicas*\n\n📦 *Ítem:* ${p.nombre}\n💰 *Valor:* ${precioStr}\n\n*Detalles Técnicos:*\n${specsLimpio}\n\nEscríbenos, será un gusto asesorarte en tu próximo proyecto.\n\n🌐 O visita nuestra página para conocer más servicios y productos:\n${urlWeb}`;

    try {
        if (window.Capacitor && window.Capacitor.Plugins.Share && window.Capacitor.Plugins.Filesystem) {
            try {
                if (p.imagen && p.imagen.startsWith('http')) {
                    const response = await fetch(p.imagen);
                    const blob = await response.blob();

                    // Promesa para convertir Blob a Base64 sin prefijo MIME
                    const blobToBase64 = (b) => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onerror = reject;
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(b);
                    });

                    const base64String = await blobToBase64(blob);
                    const fileName = 'share_' + Date.now() + '.jpg';

                    // Escribir archivo físico en el CACHE del dispositivo
                    const writeResult = await window.Capacitor.Plugins.Filesystem.writeFile({
                        path: fileName,
                        data: base64String,
                        directory: 'CACHE'
                    });

                    // Compartir usando la URI nativa del archivo
                    await window.Capacitor.Plugins.Share.share({
                        title: p.nombre,
                        text: textoShare,
                        url: urlWeb,
                        files: [writeResult.uri],
                        dialogTitle: 'Compartir producto'
                    });
                } else {
                    await window.Capacitor.Plugins.Share.share({
                        title: p.nombre,
                        text: textoShare,
                        url: urlWeb,
                        dialogTitle: 'Compartir producto'
                    });
                }
            } catch (e) {
                console.error("Error nativo al compartir imagen via Filesystem:", e);
                // Fallback a texto y url si falla el sistema de archivos
                await window.Capacitor.Plugins.Share.share({
                    title: p.nombre,
                    text: textoShare,
                    url: urlWeb,
                    dialogTitle: 'Compartir producto'
                });
            }
        } else if (navigator.share) {
            if (p.imagen && p.imagen.startsWith('http')) {
                const response = await fetch(p.imagen);
                const blob = await response.blob();
                const file = new File([blob], "AST_Catalogo.jpg", { type: blob.type });

                await navigator.share({
                    text: textoShare,
                    files: [file]
                });
            } else {
                await navigator.share({
                    text: textoShare
                });
            }
        }
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error("Error compartiendo:", error);
            alert("No se pudo adjuntar la imagen. Usa el botón de publicar en Web.");
        }
    }
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

function addToCart(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    if (!p) return;

    const DIAS_PRECIO_VIEJO = 120;
    if (p.fechaUltimoCosto) {
        const diasDiff = Math.floor((Date.now() - new Date(p.fechaUltimoCosto).getTime()) / 86400000);
        if (diasDiff > DIAS_PRECIO_VIEJO) {
            showToast(`⚠️ "${p.nombre}": costo sin actualizar hace ${diasDiff} días. Verifica antes de cotizar.`, 'warning');
        }
    }

    const exist = cart.find(x => x.uuid === uuid);
    if (exist) exist.cantidad++;
    else cart.push({ ...p, cantidad: 1 });

    updateCartUI();
    const fab = document.getElementById('fab-cart');
    fab.style.transform = "scale(1.2)";
    setTimeout(() => fab.style.transform = "scale(1)", 200);
}

async function openCart() {
    const selectExport = document.getElementById('cart-export-project');
    const selectImport = document.getElementById('cart-import-project');
    
    ['cart-export-project','cart-import-project'].forEach(id => {
        const sel = document.getElementById(id);
        const val = sel.value;
        sel.innerHTML = '<option value="">-- Sin vincular --</option>';
        projects.forEach(p => { 
            const opt = document.createElement('option'); 
            opt.value = p.id; 
            opt.text = `${p.nombreProyecto} (${p.cliente})`; 
            sel.appendChild(opt); 
        });
        sel.value = val;
    });
    
    const modalEl = document.getElementById('cartModal');
    if (!modalEl.classList.contains('show')) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
}

function updateCartUI() {
    document.getElementById('cart-count').innerText = cart.length;
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let subtotal = 0;
    
    cart.forEach((item, i) => {
        subtotal += (item.precio * item.cantidad);
        const descValue = item.specs || "";
        const safeDescValue = descValue.replace(/"/g, '"');
        
        container.innerHTML += `
        <div class="border-bottom border-secondary py-2">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <div class="text-white fw-bold small">${item.nombre}</div>
                <button class="btn btn-sm text-danger p-0" onclick="cart.splice(${i},1);updateCartUI()"><i class="bi bi-trash"></i></button>
            </div>
            
            <input type="text" class="form-control form-control-sm bg-dark text-secondary border-secondary mb-2" 
                   value="${safeDescValue}" placeholder="Descripción personalizada..." 
                   onchange="updateCartSpec(${i}, this.value)">
                   
            <div class="row g-1">
                <div class="col-4">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-secondary border-secondary text-white p-1">Cant</span>
                        <input type="number" class="form-control bg-dark text-white border-secondary text-center p-1" 
                               value="${item.cantidad}" onchange="updateCartItem(${i}, 'qty', this.value)">
                    </div>
                </div>
                <div class="col-5">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-secondary border-secondary text-white p-1">$</span>
                        <input type="number" class="form-control bg-dark text-cyan border-secondary text-end p-1" 
                               value="${item.precio}" onchange="updateCartItem(${i}, 'price', this.value)">
                    </div>
                </div>
                <div class="col-3 text-end align-self-center">
                    <small class="text-muted">${fmt.format(item.precio * item.cantidad)}</small>
                </div>
            </div>
        </div>`;
    });
    
    const applyIva = document.getElementById('check-iva').checked;
    const ivaVal = applyIva ? (subtotal * 0.19) : 0;
    const total = subtotal + ivaVal;
    document.getElementById('iva-display').innerText = `IVA: ${fmt.format(ivaVal)}`;
    document.getElementById('cart-total').innerText = fmt.format(total);

    localStorage.setItem('ast_cart_draft', JSON.stringify(cart));
}

function updateCartSpec(index, value) {
    if(cart[index]) {
        cart[index].specs = value;
    }
}

function updateCartItem(index, field, value) {
    let numValue = Number(value);
    if (isNaN(numValue) || numValue < 0) numValue = 0; // Evitar corrupción NaN
    if (field === 'qty') { if (numValue <= 0) cart.splice(index, 1); else cart[index].cantidad = numValue; }
    else if (field === 'price') { cart[index].precio = numValue; }
    updateCartUI();
}

function toggleTerms() {
    const check = document.getElementById('check-terms');
    const area = document.getElementById('terms-area');
    if (check.checked) {
        area.style.display = 'block';
        if(area.value === '') {
            area.value = "VALIDEZ DE LA OFERTA: 15 DÍAS.\nTIEMPO DE ENTREGA: A CONVENIR.\nFORMA DE PAGO: 50% ANTICIPO, 50% CONTRA ENTREGA.\nGARANTÍA: 12 MESES POR DEFECTOS DE FÁBRICA.";
        }
    } else {
        area.style.display = 'none';
    }
}

function sendWhatsApp() {
    const clienteInput = document.getElementById('c-nombre').value;
    if (cart.length === 0) return alert("Carrito vacío.");
    const saludo = clienteInput ? `Hola *${clienteInput}*` : `Hola`;
    let msg = `${saludo}, cotización preliminar *A.S.T.*:\n\n`;
    let subtotal = 0;
    cart.forEach(item => {
        const sub = item.precio * item.cantidad;
        subtotal += sub;
        msg += `▪ ${item.cantidad}x ${item.nombre}\n   $${item.precio.toLocaleString()} = $${sub.toLocaleString()}\n`;
    });
    const applyIva = document.getElementById('check-iva').checked;
    const ivaVal = applyIva ? (subtotal * 0.19) : 0;
    const granTotal = subtotal + ivaVal;
    if (applyIva) { msg += `\nSubtotal: $${subtotal.toLocaleString()}\nIVA (19%): $${ivaVal.toLocaleString()}`; }
    msg += `\n*TOTAL: $${granTotal.toLocaleString()}*`;
    openExternalUrl(`https://wa.me/?text=${encodeURIComponent(msg)}`);
}

async function generatePDF() {
    const cliente = { nombre: document.getElementById('c-nombre').value, nit: document.getElementById('c-nit').value, telefono: document.getElementById('c-tel').value };
    if(!cliente.nombre || cart.length === 0) return alert("Falta nombre cliente o carrito vacío.");
    
    const btn = document.querySelector('#cartModal .btn-success');
    btn.disabled = true; btn.innerHTML = "GENERANDO...";
    
    let subtotal = 0;
    cart.forEach(c => subtotal += (c.precio * c.cantidad));
    const applyIva = document.getElementById('check-iva').checked;
    const ivaVal = applyIva ? (subtotal * 0.19) : 0;
    const projectIdToSync = document.getElementById('cart-export-project').value;
    
    let includeTerms = false;
    let termsText = "";
    
    const termsCheck = document.getElementById('check-terms');
    if (termsCheck) {
        includeTerms = termsCheck.checked;
        if(includeTerms) {
            const termsArea = document.getElementById('terms-area');
            if(termsArea) termsText = termsArea.value;
        }
    }

    // Mapeo explícito: excluye 'costo' (interno/privado) del payload enviado al backend
    const safeItems = cart.map(c => ({
        uuid: c.uuid,
        nombre: c.nombre,
        cantidad: c.cantidad,
        precio: c.precio,
        specs: c.specs,
        subtotal: c.cantidad * c.precio
    }));

    const payload = {
        tipoDoc: document.getElementById('doc-type').value,
        cliente: cliente,
        items: safeItems,
        totales: { subtotal: subtotal, iva: ivaVal, granTotal: subtotal + ivaVal },
        opciones: { 
            mostrarDesc: true,
            terminos: termsText 
        }, 
        projectId: projectIdToSync 
    };
    
    const res = await callApi('createDocument', payload);
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Generar PDF';
    
    if (res.success) {
        cart = []; updateCartUI();
        const modalEl = document.getElementById('cartModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if(modalInstance) {
            modalInstance.hide();
            cleanBackdrops();
        }
        
        refreshHistoryOnly();
        refreshClientsOnly();
        if (projectIdToSync) refreshProjectsOnly();
        
        setTimeout(() => {
            updateClientsDatalist();
            let tel = document.getElementById('c-tel').value.trim().replace(/\D/g, '');
            if (tel.startsWith('57') && tel.length > 10) {
                tel = tel.substring(2);
            }

            if (tel.length >= 10) {
                const msg = `Hola, adjunto tu cotización: ${res.data.url}`;
                openExternalUrl(`https://wa.me/57${tel}?text=${encodeURIComponent(msg)}`);
            } else {
                // Fallback si el teléfono es inválido o muy corto
                openExternalUrl(res.data.url);
            }
        }, 500);
    } else { alert("Error: " + res.error); }
}
// ==========================================
// VISTA DETALLE + LIGHTBOX [ZONA-FE-02] v33.1
// UUID activo: dataset del nodo #viewProductModal.
// Sin variables globales nuevas.
// ==========================================

function openViewModal(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    if (!p) return;

    // Referencia activa en el DOM — no requiere variable global
    document.getElementById('viewProductModal').dataset.uuid = uuid;

    // Tipo / código
    const badge = document.getElementById('vp-tipo-badge');
    badge.textContent       = p.tipo === 'PRODUCTO' ? 'PRODUCTO' : 'SERVICIO';
    badge.style.background  = p.tipo === 'PRODUCTO' ? 'var(--ast-cyan)' : '#ffc107';
    badge.style.color       = '#000';
    document.getElementById('vp-codigo-badge').textContent = p.codigo || '---';

    // Imagen
    const img          = document.getElementById('vp-imagen');
    const placeholder  = document.getElementById('vp-img-placeholder');
    const hint         = document.getElementById('vp-expand-hint');
    const imgContainer = document.getElementById('vp-img-container');

    if (p.imagen) {
        img.src                   = p.imagen;
        img.style.display         = 'block';
        placeholder.style.display = 'none';
        hint.style.display        = 'block';
        imgContainer.style.cursor = 'zoom-in';
    } else {
        img.style.display         = 'none';
        placeholder.style.display = 'flex';
        hint.style.display        = 'none';
        imgContainer.style.cursor = 'default';
    }

    // Textos
    document.getElementById('vp-nombre').textContent = p.nombre;
    document.getElementById('vp-specs').textContent  = p.specs || 'Sin descripción.';
    document.getElementById('vp-precio').textContent = fmt.format(p.precio || 0);
    document.getElementById('vp-costo').textContent  = fmt.format(p.costo  || 0);

    // Badge web pública
    document.getElementById('vp-web-badge').style.display = p.visibleWeb ? 'block' : 'none';

    // Botón publicar: visible solo si el producto ya está persistido (tiene uuid)
    document.getElementById('vp-btn-publish').style.display = p.uuid ? 'block' : 'none';

    bootstrap.Modal.getOrCreateInstance(document.getElementById('viewProductModal')).show();
}

function switchToEditMode() {
    const uuid  = document.getElementById('viewProductModal').dataset.uuid;
    const modal = bootstrap.Modal.getInstance(document.getElementById('viewProductModal'));
    if (modal) { modal.hide(); cleanBackdrops(); }
    setTimeout(() => loadEditModal(uuid), 350);
}

function addToCartFromView() {
    const uuid = document.getElementById('viewProductModal').dataset.uuid;
    if (!uuid) return;
    addToCart(uuid);
    showToast('✅ Ítem agregado a la cotización', 'success');
}

function publishFromView() {
    const uuid  = document.getElementById('viewProductModal').dataset.uuid;
    if (!uuid) return;
    const modal = bootstrap.Modal.getInstance(document.getElementById('viewProductModal'));
    if (modal) { modal.hide(); cleanBackdrops(); }
    // Carga el modal de edición (llena los campos del prodModal)
    // luego dispara el botón de GitHub que ya tiene su propia lógica
    setTimeout(() => {
        loadEditModal(uuid);
        setTimeout(() => {
            const btn = document.getElementById('btn-github-publish');
            if (btn) btn.click();
        }, 350);
    }, 350);
}

function openLightbox() {
    const img = document.getElementById('vp-imagen');
    if (!img || img.style.display === 'none') return;
    document.getElementById('lightbox-img').src = img.src;
    document.getElementById('lightbox-overlay').style.display = 'flex';
}

function closeLightbox() {
    document.getElementById('lightbox-overlay').style.display = 'none';
}

// ==========================================
// COMPRA MASIVA EN ALMACÉN [ZONA-FE-02] v33.2
// ==========================================

function openBulkItemModal() {
    bulkCart = [];

    document.getElementById('bulk-search').value           = '';
    document.getElementById('bulk-proveedor').value        = '';
    document.getElementById('bulk-cobrar').checked         = true;
    document.getElementById('bulk-factura-desc').value     = '';
    document.getElementById('bulk-factura-costo').value    = 0;
    document.getElementById('bulk-factura-prov').value     = '';
    document.getElementById('bulk-factura-cobrar').checked = true;

    const box = document.getElementById('bulk-search-results');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }

    switchBulkTab('items');

    // Se abre APILADO sobre projectDetailModal — sin cerrarlo, igual que costHistoryModal
    bootstrap.Modal.getOrCreateInstance(document.getElementById('bulkItemModal')).show();
}

function buscarCatalogoBulk(valor) {
    clearTimeout(_bulkSearchTimer);
    const box = document.getElementById('bulk-search-results');
    if (!box) return;

    if (!valor || valor.trim().length < 2) {
        box.style.display = 'none';
        box.innerHTML     = '';
        return;
    }

    _bulkSearchTimer = setTimeout(() => {
        const matches = buscarEnCatalogoConRelevancia(valor, 15);

        if (matches.length === 0) {
            box.innerHTML     = `<div style="padding:14px; text-align:center; color:#4A6680; font-size:0.8rem;">Sin resultados para "${valor}"</div>`;
            box.style.display = 'block';
            return;
        }

        box.innerHTML = matches.map(p => {
            const enCarrito = bulkCart.find(x => x.uuid === p.uuid);
            const badge = p.tipo === 'PRODUCTO'
                ? `<span style="background:#0dcaf0;color:#000;border-radius:3px;padding:1px 5px;font-size:0.55rem;font-weight:700;">${p.codigo}</span>`
                : `<span style="background:#ffc107;color:#000;border-radius:3px;padding:1px 5px;font-size:0.55rem;font-weight:700;">SERV</span>`;
            const icono = enCarrito
                ? `<i class="bi bi-check-circle-fill" style="color:#00E676;font-size:1.1rem;"></i>`
                : `<i class="bi bi-plus-circle" style="color:#00C8FF;font-size:1.1rem;"></i>`;

            return `
            <div onclick="agregarItemBulk('${p.uuid}')"
                 style="padding:10px 14px; border-bottom:1px solid rgba(0,200,255,0.08);
                        cursor:pointer; display:flex; align-items:center; gap:10px;
                        background:${enCarrito ? 'rgba(0,230,118,0.05)' : 'transparent'};"
                 onmouseenter="this.style.background='rgba(0,200,255,0.08)'"
                 onmouseleave="this.style.background='${enCarrito ? 'rgba(0,230,118,0.05)' : 'transparent'}'">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                        ${badge}
                        <span style="font-size:0.83rem; font-weight:600; color:#fff;
                                     white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                                     max-width:180px;">${p.nombre}</span>
                    </div>
                    <div style="font-size:0.67rem; color:#4A6680;">
                        Costo: ${fmt.format(p.costo || 0)} &nbsp;|&nbsp; Precio: ${p.precio > 0 ? fmt.format(p.precio) : 'Cotizar'}
                    </div>
                </div>
                <div style="flex-shrink:0;">${icono}</div>
            </div>`;
        }).join('');

        box.style.display = 'block';
    }, 200);
}

function agregarItemBulk(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    if (!p) return;

    const existe = bulkCart.find(x => x.uuid === uuid);
    if (existe) {
        existe.cantidad++;
    } else {
        bulkCart.push({
            uuid:     p.uuid,
            nombre:   p.nombre,
            tipo:     p.tipo,
            codigo:   p.codigo || '',
            cantidad: 1,
            costo:    p.costo  || 0,
            venta:    p.precio || 0
        });
        // Auto-fill proveedor del catálogo si el campo está vacío
        const provInput = document.getElementById('bulk-proveedor');
        if (provInput && !provInput.value.trim() && p.proveedor) {
            provInput.value = p.proveedor;
        }
    }

    // Cerrar resultados y limpiar buscador
    const box = document.getElementById('bulk-search-results');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    document.getElementById('bulk-search').value = '';

    actualizarListaBulk();
}

function actualizarListaBulk() {
    const container  = document.getElementById('bulk-cart-list');
    const totalEl    = document.getElementById('bulk-total');
    const countLabel = document.getElementById('bulk-count-label');
    const btn        = document.getElementById('bulk-register-btn');

    if (bulkCart.length === 0) {
        container.innerHTML = `
            <div style="padding:40px; text-align:center; color:#4A6680;">
                <i class="bi bi-cart" style="font-size:2.5rem;"></i>
                <p style="font-size:0.85rem; margin-top:10px;">
                    Busca y agrega productos arriba<br>
                    <span style="font-size:0.75rem;">Puedes editar cantidad, costo y precio de cada uno</span>
                </p>
            </div>`;
        if (totalEl)    totalEl.innerText    = '$0';
        if (countLabel) countLabel.innerText = '0 ítems';
        if (btn)        btn.disabled         = true;
        return;
    }

    let totalCosto = 0;
    container.innerHTML = bulkCart.map((item, idx) => {
        totalCosto += item.costo * item.cantidad;
        const bgRow = idx % 2 === 0 ? '#071726' : '#050f1a';
        return `
        <div style="padding:10px 12px; border-bottom:1px solid #1a2a3a; background:${bgRow};">

            <!-- Nombre + eliminar -->
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.83rem; font-weight:600; color:#fff;
                                white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${item.nombre}
                    </div>
                    <div style="font-size:0.63rem; color:#4A6680;">${item.codigo}</div>
                </div>
                <button onclick="eliminarItemBulk('${item.uuid}')"
                        style="background:transparent; border:1px solid rgba(255,68,68,0.3);
                               color:#ff4444; border-radius:4px; padding:2px 8px;
                               font-size:0.75rem; cursor:pointer; flex-shrink:0;">
                    <i class="bi bi-trash"></i>
                </button>
            </div>

            <!-- Controles: cantidad + costo + precio -->
            <div style="display:grid; grid-template-columns:auto 1fr 1fr; gap:8px; align-items:end;">

                <!-- Cantidad -->
                <div>
                    <div style="font-size:0.58rem; color:#aaa; margin-bottom:3px;">CANT</div>
                    <div style="display:flex; align-items:center; background:#0A1628;
                                border:1px solid #2a3a4a; border-radius:6px; overflow:hidden;">
                        <button onclick="cambiarCantidadBulk('${item.uuid}', -1)"
                                style="background:transparent; border:none; color:#aaa;
                                       width:30px; height:32px; font-size:1.1rem;
                                       cursor:pointer; flex-shrink:0;">−</button>
                        <input type="number" value="${item.cantidad}" min="1"
                               onchange="setCantidadBulk('${item.uuid}', this.value)"
                               style="width:36px; background:transparent; border:none;
                                      color:#fff; text-align:center; font-size:0.85rem;
                                      font-weight:700; padding:0;">
                        <button onclick="cambiarCantidadBulk('${item.uuid}', 1)"
                                style="background:transparent; border:none; color:#00C8FF;
                                       width:30px; height:32px; font-size:1.1rem;
                                       cursor:pointer; flex-shrink:0;">+</button>
                    </div>
                </div>

                <!-- Costo -->
                <div>
                    <div style="font-size:0.58rem; color:#ff6b6b; margin-bottom:3px;">COSTO UNIT</div>
                    <input type="number" value="${item.costo}"
                           onchange="setCostoBulk('${item.uuid}', this.value)"
                           style="width:100%; background:#0A1628;
                                  border:1px solid rgba(255,107,107,0.4);
                                  border-radius:6px; color:#ff9999;
                                  font-size:0.8rem; padding:5px 8px; font-weight:600;">
                </div>

                <!-- Precio venta -->
                <div>
                    <div style="font-size:0.58rem; color:#00C8FF; margin-bottom:3px;">PRECIO VENTA</div>
                    <input type="number" value="${item.venta}"
                           onchange="setPrecioBulk('${item.uuid}', this.value)"
                           style="width:100%; background:#0A1628;
                                  border:1px solid rgba(0,200,255,0.3);
                                  border-radius:6px; color:#00C8FF;
                                  font-size:0.8rem; padding:5px 8px; font-weight:600;">
                </div>
            </div>

            <!-- Subtotal -->
            <div style="text-align:right; font-size:0.68rem; color:#4A6680; margin-top:5px;">
                Subtotal costo:
                <span style="color:#ff9999; font-weight:600;">
                    ${fmt.format(item.costo * item.cantidad)}
                </span>
            </div>
        </div>`;
    }).join('');

    if (totalEl)    totalEl.innerText    = fmt.format(totalCosto);
    if (countLabel) countLabel.innerText = `${bulkCart.length} ítem${bulkCart.length !== 1 ? 's' : ''}`;
    if (btn)        btn.disabled         = false;
}

function cambiarCantidadBulk(uuid, delta) {
    const item = bulkCart.find(x => x.uuid === uuid);
    if (!item) return;
    item.cantidad = Math.max(1, item.cantidad + delta);
    actualizarListaBulk();
}

function setCantidadBulk(uuid, val) {
    const item = bulkCart.find(x => x.uuid === uuid);
    if (!item) return;
    const n = parseInt(val);
    item.cantidad = (!n || n < 1) ? 1 : n;
    actualizarListaBulk();
}

function setCostoBulk(uuid, val) {
    const item = bulkCart.find(x => x.uuid === uuid);
    if (item) { item.costo = Number(val) || 0; actualizarListaBulk(); }
}

function setPrecioBulk(uuid, val) {
    const item = bulkCart.find(x => x.uuid === uuid);
    if (item) { item.venta = Number(val) || 0; actualizarListaBulk(); }
}

function eliminarItemBulk(uuid) {
    bulkCart = bulkCart.filter(x => x.uuid !== uuid);
    actualizarListaBulk();
}

function switchBulkTab(tab) {
    const panelItems   = document.getElementById('bulk-panel-items');
    const panelFactura = document.getElementById('bulk-panel-factura');
    const tabItems     = document.getElementById('bulk-tab-items');
    const tabFactura   = document.getElementById('bulk-tab-factura');
    const btn          = document.getElementById('bulk-register-btn');
    const countLabel   = document.getElementById('bulk-count-label');

    if (tab === 'items') {
        panelItems.style.display   = 'flex';
        panelFactura.style.display = 'none';

        tabItems.style.borderBottomColor   = '#00C8FF';
        tabItems.style.color               = '#00C8FF';
        tabItems.style.background          = '#071726';
        tabFactura.style.borderBottomColor = 'transparent';
        tabFactura.style.color             = '#4A6680';
        tabFactura.style.background        = '#050f1a';

        actualizarListaBulk();
    } else {
        panelItems.style.display   = 'none';
        panelFactura.style.display = 'block';

        tabItems.style.borderBottomColor   = 'transparent';
        tabItems.style.color               = '#4A6680';
        tabItems.style.background          = '#050f1a';
        tabFactura.style.borderBottomColor = '#00C8FF';
        tabFactura.style.color             = '#00C8FF';
        tabFactura.style.background        = '#071726';

        btn.disabled         = false;
        countLabel.innerText = 'factura completa';
    }
}
async function registrarComprasMasivas() {
    const tabFactura  = document.getElementById('bulk-tab-factura');
    const modoFactura = tabFactura && tabFactura.style.color === 'rgb(0, 200, 255)';

    const btn = document.getElementById('bulk-register-btn');

    // ── MODO FACTURA TOTAL ────────────────────────────────────
    if (modoFactura) {
        const desc      = document.getElementById('bulk-factura-desc').value.trim();
        const costo     = Number(document.getElementById('bulk-factura-costo').value) || 0;
        const proveedor = document.getElementById('bulk-factura-prov').value.trim();
        const cobrar    = document.getElementById('bulk-factura-cobrar').checked;

        if (!desc)  return showToast('Escribe una descripción', 'warning');
        if (!costo) return showToast('Escribe el total pagado', 'warning');

        btn.disabled  = true;
        btn.innerHTML = `<div class="spinner-border spinner-border-sm me-2"
                             style="width:0.9rem;height:0.9rem;border-width:0.15em;"></div>
                         Registrando...`;

        const payload = {
            idMov:       generateUUID(),
            projectId:   currentProject,
            tipo:        'MATERIAL',
            descripcion: desc,
            proveedor:   proveedor,
            cantidad:    1,
            costo:       costo,
            venta:       cobrar ? costo : 0,
            esCobrar:    cobrar,
            horas:       0,
            estadoTarea: 'HECHO',
            notaVisita:  ''
        };

        currentProjectItems.push({ ...payload, fecha: new Date().toISOString() });
        let tCosto = 0, tVenta = 0;
        currentProjectItems.forEach(m => {
            tCosto += m.costo * m.cantidad;
            if (m.esCobrar === true || m.esCobrar === 'TRUE') tVenta += m.venta * m.cantidad;
        });
        currentProjectData.totalCostos  = tCosto;
        currentProjectData.totalCobrado = tVenta;
        currentProjectData.utilidad     = tVenta - tCosto;
        const pIdx = projects.findIndex(p => p.id === currentProject);
        if (pIdx !== -1) {
            projects[pIdx].totalCostos  = tCosto;
            projects[pIdx].totalCobrado = tVenta;
            projects[pIdx].utilidad     = tVenta - tCosto;
        }
        renderProjectItems();
        calculateDashboard();

        const mi = bootstrap.Modal.getInstance(document.getElementById('bulkItemModal'));
        if (mi) mi.hide();

        const res = await callApi('addProjectMovement', payload);
        if (res.success) {
            showToast('✅ Factura registrada correctamente', 'success');
        } else {
            showToast('⚠️ Error al guardar — verifica conexión', 'warning');
        }
        refreshProjectsOnly();
        if (proveedor) refreshProveedoresOnly();
        return;
    }

    // ── MODO POR ÍTEM ────────────────────────────────────────
    if (bulkCart.length === 0) return;

    const proveedor = document.getElementById('bulk-proveedor').value.trim();
    const cobrar    = document.getElementById('bulk-cobrar').checked;
    const total     = bulkCart.length;

    btn.disabled  = true;
    btn.innerHTML = `<div class="spinner-border spinner-border-sm me-2"
                         style="width:0.9rem;height:0.9rem;border-width:0.15em;"></div>
                     Registrando ${total} ítem${total !== 1 ? 's' : ''}...`;

    const nuevosMovs = bulkCart.map(item => ({
        idMov:       generateUUID(),
        fecha:       new Date().toISOString(),
        tipo:        item.tipo === 'SERVICIO' ? 'MANO_OBRA' : 'MATERIAL',
        descripcion: item.nombre,
        proveedor:   proveedor,
        cantidad:    item.cantidad,
        costo:       item.costo,
        venta:       item.venta,
        esCobrar:    cobrar,
        horas:       0,
        estadoTarea: 'PENDIENTE',
        notaVisita:  ''
    }));

    nuevosMovs.forEach(m => currentProjectItems.push(m));

    let tCosto = 0, tVenta = 0;
    currentProjectItems.forEach(m => {
        tCosto += m.costo * m.cantidad;
        if (m.esCobrar === true || m.esCobrar === 'TRUE') tVenta += m.venta * m.cantidad;
    });
    currentProjectData.totalCostos  = tCosto;
    currentProjectData.totalCobrado = tVenta;
    currentProjectData.utilidad     = tVenta - tCosto;
    const projIdx = projects.findIndex(p => p.id === currentProject);
    if (projIdx !== -1) {
        projects[projIdx].totalCostos  = tCosto;
        projects[projIdx].totalCobrado = tVenta;
        projects[projIdx].utilidad     = tVenta - tCosto;
    }
    renderProjectItems();
    calculateDashboard();

    const mi = bootstrap.Modal.getInstance(document.getElementById('bulkItemModal'));
    if (mi) mi.hide();

    showToast(`⏳ Guardando ${total} ítems...`, 'info');

    const resultados = await Promise.all(
        bulkCart.map(item => callApi('addProjectMovement', {
            idMov:       generateUUID(),
            projectId:   currentProject,
            tipo:        item.tipo === 'SERVICIO' ? 'MANO_OBRA' : 'MATERIAL',
            descripcion: item.nombre,
            proveedor:   proveedor,
            cantidad:    item.cantidad,
            costo:       item.costo,
            venta:       item.venta,
            esCobrar:    cobrar,
            horas:       0,
            estadoTarea: 'PENDIENTE',
            notaVisita:  ''
        }))
    );

    const errores = resultados.filter(r => !r.success).length;
    if (errores === 0) {
        showToast(`✅ ${total} ítem${total !== 1 ? 's' : ''} registrados`, 'success');
    } else {
        showToast(`⚠️ ${errores} con error — verifica conexión`, 'warning');
    }

    bulkCart = [];
    refreshProjectsOnly();
    if (proveedor) refreshProveedoresOnly();
}
// ==========================================
// BUSCADOR DE MOVIMIENTOS EN PROYECTO
// ==========================================
function filtrarMovimientosProyecto(term) {
    var list = document.getElementById('pd-items-list');
    if (!list) return;

    if (!term || term.trim() === '') {
        renderProjectItems();
        return;
    }

    var t = term.toLowerCase().trim();
    var filtrados = currentProjectItems.filter(function(item) {
        return item.descripcion.toLowerCase().indexOf(t) !== -1
            || (item.proveedor  && item.proveedor.toLowerCase().indexOf(t)  !== -1)
            || (item.tipo       && item.tipo.toLowerCase().indexOf(t)       !== -1)
            || (item.notaVisita && item.notaVisita.toLowerCase().indexOf(t) !== -1);
    });

    if (filtrados.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:30px;color:#4A6680;">'
            + '<i class="bi bi-search" style="font-size:1.8rem;"></i>'
            + '<p style="font-size:0.83rem;margin-top:8px;">Sin resultados para <b style="color:#fff;">'
            + term + '</b></p></div>';
        return;
    }

    var estadoMap = {
        'PENDIENTE':   { color: '#ffc107', icon: 'bi-clock',         label: 'Pendiente'   },
        'EN_PROGRESO': { color: '#0dcaf0', icon: 'bi-tools',         label: 'En Progreso' },
        'HECHO':       { color: '#198754', icon: 'bi-check2-circle', label: 'Hecho'       }
    };

    var html = '';

    for (var i = 0; i < filtrados.length; i++) {
        var item     = filtrados[i];
        var cobrar   = (item.esCobrar === true || item.esCobrar === 'TRUE');
        var eKey     = item.estadoTarea || 'PENDIENTE';
        var estado   = estadoMap[eKey] || estadoMap['PENDIENTE'];

        var cobraBadge = cobrar
            ? '<span style="font-size:0.6rem;color:#198754;border:1px solid #198754;border-radius:3px;padding:1px 5px;">COBRABLE</span>'
            : '<span style="font-size:0.6rem;color:#666;border:1px solid #444;border-radius:3px;padding:1px 5px;">INTERNO</span>';

        var estBadge = '<span style="font-size:0.6rem;color:' + estado.color
            + ';border:1px solid ' + estado.color
            + ';border-radius:3px;padding:1px 5px;">'
            + '<i class="bi ' + estado.icon + '"></i> ' + estado.label + '</span>';

        var horasHtml = (item.horas && Number(item.horas) > 0)
            ? '<span class="text-muted" style="font-size:0.65rem;"><i class="bi bi-clock"></i> ' + item.horas + 'h</span>'
            : '';

        var notaHtml = item.notaVisita
            ? '<div style="font-size:0.65rem;font-style:italic;color:#666;border-left:2px solid #333;padding-left:6px;margin-top:4px;">'
              + item.notaVisita + '</div>'
            : '';

        var ventaHtml = cobrar
            ? '<div class="text-success small">+' + fmt.format(item.venta * item.cantidad) + '</div>'
            : '';

        html += '<div class="border-bottom border-secondary py-2 px-1">';
        html +=   '<div class="d-flex justify-content-between align-items-start">';
        html +=     '<div class="overflow-hidden me-2 flex-grow-1">';
        html +=       '<div class="text-white small fw-bold">' + item.descripcion + '</div>';
        html +=       '<div class="d-flex align-items-center gap-2 flex-wrap mt-1" style="font-size:0.65rem;">';
        html +=         '<span class="text-muted">' + item.tipo + ' | ' + (item.proveedor || '-') + '</span>';
        html +=         estBadge + horasHtml + cobraBadge;
        html +=       '</div>';
        html +=       notaHtml;
        html +=     '</div>';
        html +=     '<div class="d-flex flex-column align-items-end gap-1 ms-2" style="min-width:75px;">';
        html +=       '<div class="text-danger small">-' + fmt.format(item.costo * item.cantidad) + '</div>';
        html +=       ventaHtml;
        html +=       '<div class="d-flex gap-2 mt-1">';
        html +=         '<button class="btn btn-sm text-warning p-0" onclick="openEditItemModal(\'' + item.idMov + '\')"><i class="bi bi-pencil-square"></i></button>';
        html +=         '<button class="btn btn-sm text-danger p-0" onclick="deleteProjectMovement(\'' + item.idMov + '\')"><i class="bi bi-trash"></i></button>';
        html +=       '</div>';
        html +=     '</div>';
        html +=   '</div>';
        html += '</div>';
    }

    list.innerHTML = html;
}

// ==========================================
// GENERAR COTIZACIÓN DESDE PROYECTO [ZONA-FE-02] v33.3
// ==========================================
function generateQuoteFromProject() {
    if (!currentProjectData || !currentProjectItems) return;

    const cobrables = currentProjectItems.filter(item =>
        item.esCobrar === true || item.esCobrar === 'TRUE'
    );

    if (cobrables.length === 0) {
        showToast('⚠️ Este proyecto no tiene ítems marcados como cobrables', 'warning');
        return;
    }

    if (cart.length > 0) {
        if (!confirm('⚠️ Tu carrito actual se reemplazará con los ítems de este proyecto. ¿Continuar?')) return;
    }

    // Convertir movimientos del proyecto al formato del carrito
    cart = cobrables.map(item => ({
        uuid:   generateUUID(),
        nombre: item.descripcion,
        specs:  item.notaVisita || '',
        precio: item.venta,
        cantidad: item.cantidad,
        tipo:   item.tipo === 'MANO_OBRA' ? 'SERVICIO' : 'PRODUCTO'
    }));

    // Autocompletar cliente desde el proyecto
    document.getElementById('c-nombre').value = currentProjectData.cliente || '';
    document.getElementById('c-nit').value    = '';
    document.getElementById('c-tel').value    = currentProjectData.contacto || '';

    // Vincular automáticamente al proyecto para que el PDF se sincronice de vuelta
    setTimeout(() => {
        const exportSelect = document.getElementById('cart-export-project');
        if (exportSelect) exportSelect.value = currentProject;
    }, 100);

    // Cerrar proyecto y abrir carrito
    const projModal = bootstrap.Modal.getInstance(document.getElementById('projectDetailModal'));
    if (projModal) projModal.hide();

    setTimeout(() => {
        updateCartUI();
        openCart();
        showToast(`✅ ${cobrables.length} ítem${cobrables.length !== 1 ? 's' : ''} cargado${cobrables.length !== 1 ? 's' : ''} al carrito`, 'success');
    }, 350);
}
