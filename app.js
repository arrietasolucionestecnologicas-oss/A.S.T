// ==========================================
// A.S.T. ADMIN FRONTEND (V29 - FLUIDEZ EXTREMA & OPTIMISTIC UI)
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
let deferredPrompt; 

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

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
function loadLocalCache() {
    try {
        const c = localStorage.getItem('ast_catalog');
        const p = localStorage.getItem('ast_projects');
        const cl = localStorage.getItem('ast_clients');
        const h = localStorage.getItem('ast_history');
        const pr = localStorage.getItem('ast_proveedores');
        
        if (c) catalog = JSON.parse(c);
        if (p) projects = JSON.parse(p);
        if (cl) clients = JSON.parse(cl);
        if (h) historyDocs = JSON.parse(h);
        if (pr) proveedores = JSON.parse(pr);
    } catch (e) {
        console.error("Error reading cache", e);
    }
}

async function fetchAllDataBackground() {
    showSyncIndicator();
    const res = await callApi('getAllData');
    if (res.success) {
        catalog = res.data.catalog || [];
        projects = res.data.projects || [];
        clients = res.data.clients || [];
        historyDocs = res.data.historyDocs || [];
        proveedores = res.data.proveedores || [];
        
        localStorage.setItem('ast_catalog', JSON.stringify(catalog));
        localStorage.setItem('ast_projects', JSON.stringify(projects));
        localStorage.setItem('ast_clients', JSON.stringify(clients));
        localStorage.setItem('ast_history', JSON.stringify(historyDocs));
        localStorage.setItem('ast_proveedores', JSON.stringify(proveedores));
        
        if (currentView === 'PROYECTOS') { renderProjects(); calculateDashboard(); }
        else if (currentView === 'HISTORIAL') { renderHistory(); }
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
    updateClientsDatalist(); 
    updateProvidersDatalist();
    
    if(currentView === 'PROYECTOS') { renderProjects(); calculateDashboard(); }
    else if(currentView === 'HISTORIAL') { renderHistory(); }
    else if(currentView === 'PROVEEDORES') { renderProveedores(); }
    else {
        const filtered = catalog.filter(p => p.tipo === currentView);
        renderGrid(filtered);
    }
    
    fetchAllDataBackground(); 
    
    document.getElementById('search').addEventListener('input', (e) => {
        if(currentView === 'PROYECTOS' || currentView === 'HISTORIAL' || currentView === 'PROVEEDORES') return; 
        const term = e.target.value.toLowerCase();
        const filtered = catalog.filter(p => 
            p.tipo === currentView && 
            (p.nombre.toLowerCase().includes(term) || String(p.codigo).toLowerCase().includes(term))
        );
        renderGrid(filtered);
    });
});

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

async function saveProveedor() {
    const payload = {
        originalNombre: document.getElementById('prov-original').value,
        nombre: document.getElementById('prov-nombre').value,
        nit: document.getElementById('prov-nit').value,
        contacto: document.getElementById('prov-contacto').value,
        especialidad: document.getElementById('prov-especialidad').value
    };
    
    if(!payload.nombre) return alert("El nombre es obligatorio");

    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('editProveedorModal'));
    if(modalInstance) {
        modalInstance.hide();
        cleanBackdrops();
    }
    
    showToast("⏳ Actualizando proveedor...", "info");
    const res = await callApi('updateProveedor', payload);
    if(res.success) {
        showToast("✅ Proveedor actualizado.", "success");
        fetchAllDataBackground();
    } else {
        alert("Error: " + res.error);
    }
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
async function fetchProjects() {
    renderProjects();
    calculateDashboard();
}

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

async function createNewProject() {
    const payload = {
        nombreProyecto: document.getElementById('np-proyecto').value,
        cliente: document.getElementById('np-cliente').value,
        contacto: document.getElementById('np-contacto').value
    };
    if(!payload.nombreProyecto || !payload.cliente) return alert("Nombre y Cliente obligatorios");
    const btn = document.querySelector('#newProjectModal .btn-cyan');
    btn.disabled = true; btn.innerText = "...";
    
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('newProjectModal'));
    if(modalInstance) {
        modalInstance.hide();
        cleanBackdrops();
    }
    
    showToast("⏳ Creando carpeta de proyecto...", "info");
    btn.disabled = false; btn.innerText = "CREAR CARPETA";
    
    const res = await callApi('createProject', payload);
    if(res.success) {
        showToast("✅ Proyecto creado.", "success");
        fetchAllDataBackground();
    } else {
        alert("Error: " + res.error);
    }
}

// --- DETALLE DE PROYECTO ---
async function openProjectDetail(id) {
    currentProject = id;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('projectDetailModal')).show();
    
    const pInfo = projects.find(p => p.id === id);
    if (pInfo) {
        document.getElementById('pd-title').innerText = pInfo.nombreProyecto;
        document.getElementById('pd-subtitle').innerText = pInfo.cliente;
        document.getElementById('pd-cobrado').innerText = fmt.format(pInfo.totalCobrado);
        document.getElementById('pd-gastos').innerText = fmt.format(pInfo.totalCostos);
        document.getElementById('pd-utilidad').innerText = fmt.format(pInfo.utilidad);
        document.getElementById('pd-items-list').innerHTML = '<div class="text-center mt-3"><div class="spinner-border text-cyan spinner-border-sm"></div><div class="small text-muted mt-1">Cargando movimientos...</div></div>';
    }
    
    const res = await callApi('getProjectDetails', { id: id });
    if(res.success) {
        currentProjectData = res.data.info;
        currentProjectItems = res.data.items;
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

async function updateProject() {
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
    
    showToast("⏳ Actualizando proyecto...", "info");
    
    await callApi('updateProject', payload);
    showToast("✅ Proyecto actualizado.", "success");
    openProjectDetail(payload.id);
    fetchAllDataBackground(); 
}

async function deleteProject() {
    if(confirm("¿Eliminar este proyecto y todo su historial?")) {
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('projectDetailModal'));
        if(modalInstance) {
            modalInstance.hide();
            cleanBackdrops();
        }
        
        showToast("⏳ Eliminando proyecto...", "info");
        
        await callApi('deleteProject', { id: currentProject });
        showToast("✅ Proyecto eliminado.", "success");
        fetchAllDataBackground();
    }
}

// --- ITEMS DE PROYECTO ---
function openAddItemModal() {
    document.getElementById('ai-id').value = "";
    document.getElementById('ai-desc').value = "";
    document.getElementById('ai-prov').value = "";
    document.getElementById('ai-cant').value = 1;
    document.getElementById('ai-costo').value = 0;
    document.getElementById('ai-venta').value = 0;
    
    document.getElementById('ai-cobrar').checked = true;
    toggleVentaInput();
    
    document.querySelector('#addItemModal .modal-title').innerText = "Registrar Movimiento";
    document.querySelector('#addItemModal .btn-primary').innerText = "REGISTRAR";
    
    const dl = document.getElementById('list-catalog-items');
    dl.innerHTML = '';
    catalog.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.nombre;
        dl.appendChild(opt);
    });
    
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addItemModal')).show();
}

function openEditItemModal(idMov) {
    const item = currentProjectItems.find(x => x.idMov === idMov);
    if(!item) return;

    document.getElementById('ai-id').value = item.idMov;
    document.getElementById('ai-desc').value = item.descripcion;
    document.getElementById('ai-prov').value = item.proveedor || "";
    document.getElementById('ai-cant').value = item.cantidad;
    document.getElementById('ai-costo').value = item.costo;
    document.getElementById('ai-venta').value = item.venta;
    
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

function fillItemFromCatalog(name) {
    const item = catalog.find(p => p.nombre === name);
    if(item) {
        document.getElementById('ai-desc').value = item.nombre;
        document.getElementById('ai-costo').value = item.costo || 0;
        document.getElementById('ai-venta').value = item.precio || 0;
        const tipoSelect = document.getElementById('ai-tipo');
        if(item.tipo === 'SERVICIO') tipoSelect.value = 'MANO_OBRA';
        else tipoSelect.value = 'MATERIAL';
    }
}

function toggleVentaInput() {
    const isChecked = document.getElementById('ai-cobrar').checked;
    const div = document.getElementById('div-venta');
    if(isChecked) div.style.display = 'block';
    else div.style.display = 'none';
}

async function saveProjectItem() {
    const idMov = document.getElementById('ai-id').value;
    
    const payload = {
        projectId: currentProject,
        tipo: document.getElementById('ai-tipo').value,
        descripcion: document.getElementById('ai-desc').value,
        proveedor: document.getElementById('ai-prov').value,
        cantidad: Number(document.getElementById('ai-cant').value),
        costo: Number(document.getElementById('ai-costo').value),
        venta: Number(document.getElementById('ai-venta').value),
        esCobrar: document.getElementById('ai-cobrar').checked
    };
    
    if(!payload.descripcion) return alert("Descripción requerida");
    
    let action = 'addProjectMovement';
    if (idMov && idMov !== "") {
        payload.idMov = idMov;
        action = 'updateProjectMovement';
    }
    
    const btn = document.querySelector('#addItemModal .btn-primary');
    const originalText = btn.innerText;
    
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addItemModal'));
    if(modalInstance) {
        modalInstance.hide();
        cleanBackdrops();
    }
    
    showToast("⏳ Registrando movimiento...", "info");
    
    const res = await callApi(action, payload);
    
    btn.disabled = false; 
    btn.innerText = originalText;
    
    if(res.success) {
        showToast("✅ Movimiento guardado.", "success");
        openProjectDetail(currentProject);
        fetchAllDataBackground();
    } else {
        alert("Error: " + res.error);
    }
}

async function deleteProjectMovement(idMov) {
    if(confirm("¿Borrar movimiento?")) {
        showToast("⏳ Borrando movimiento...", "info");
        await callApi('deleteProjectMovement', { idMov: idMov, projectId: currentProject });
        showToast("✅ Movimiento borrado.", "success");
        openProjectDetail(currentProject);
        fetchAllDataBackground();
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

function reloadOrderFromHistory(index) {
    const doc = historyDocs[index];
    
    if(!doc.jsonData || doc.jsonData === "" || doc.jsonData === "undefined") {
        return alert("⚠️ Este documento es antiguo y no tiene datos recuperables.");
    }

    if(cart.length > 0) {
        if(!confirm("⚠️ Tu carrito actual se borrará para cargar esta cotización. ¿Continuar?")) return;
    }

    try {
        let safeJson = String(doc.jsonData);
        if (safeJson.startsWith('"') && safeJson.endsWith('"')) {
            safeJson = safeJson.slice(1, -1).replace(/""/g, '"');
        }
        safeJson = safeJson.replace(/[\r\n]+/g, " ");

        const orderData = JSON.parse(safeJson);
        cart = orderData.items || [];
        
        if(orderData.cliente) {
            document.getElementById('c-nombre').value = orderData.cliente.nombre || "";
            document.getElementById('c-nit').value = orderData.cliente.nit || "";
            document.getElementById('c-tel').value = orderData.cliente.telefono || "";
        }
        
        if(orderData.opciones) {
            const checkSpecs = document.getElementById('check-specs');
            if(checkSpecs) checkSpecs.checked = orderData.opciones.mostrarDesc;
            
            if(orderData.opciones.terminos) {
                const checkTerms = document.getElementById('check-terms');
                const termsArea = document.getElementById('terms-area');
                
                if(checkTerms && termsArea) {
                    checkTerms.checked = true;
                    termsArea.style.display = 'block';
                    termsArea.value = orderData.opciones.terminos;
                }
            }
        }
        
        updateCartUI();
        openCart();
        
        showToast(`✅ Cotización ${doc.consecutivo} cargada.`, "success");

    } catch(e) {
        console.error("Error leyendo JSON:", e);
        document.getElementById('c-nombre').value = doc.cliente || "";
        alert("⚠️ Hubo un detalle cargando los productos, pero recuperé el cliente.");
    }
}

async function convertQuoteToProject(index) {
    const doc = historyDocs[index];
    
    if(!doc.jsonData || doc.jsonData === "" || doc.jsonData === "undefined") {
        return alert("⚠️ Esta cotización es muy antigua y no tiene el detalle interno para poder convertirse automáticamente.");
    }

    if(!confirm(`¿Estás seguro de que el cliente aprobó la Cotización ${doc.consecutivo}?\n\nSe creará un Trabajo Activo con todos sus ítems.`)) return;

    try {
        let safeJson = String(doc.jsonData);
        if (safeJson.startsWith('"') && safeJson.endsWith('"')) {
            safeJson = safeJson.slice(1, -1).replace(/""/g, '"');
        }
        safeJson = safeJson.replace(/[\r\n]+/g, " ");

        const orderData = JSON.parse(safeJson);
        
        const payload = {
            nombreProyecto: `Ejecución ${doc.consecutivo}`,
            cliente: orderData.cliente ? orderData.cliente.nombre : doc.cliente,
            contacto: orderData.cliente ? orderData.cliente.telefono : "",
            items: orderData.items || []
        };

        showToast(`⏳ Creando proyecto desde ${doc.consecutivo}...`, "info");

        const res = await callApi('convertQuoteToProject', payload);

        if (res.success) {
            showToast(`✅ Proyecto creado exitosamente.`, "success");
            switchTab('PROYECTOS');
            fetchAllDataBackground().then(() => {
                openProjectDetail(res.data.projectId);
            });
            
        } else {
            alert("Error al convertir la cotización: " + res.error);
        }

    } catch(e) {
        console.error("Error leyendo JSON para conversión:", e);
        alert("⚠️ Error: Los datos internos de esta cotización están dañados y no se pueden migrar de forma automática.");
    }
}

function renderGrid(data) {
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';
    if(data.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center mt-5"><i class="bi bi-box-seam text-secondary" style="font-size: 3rem;"></i><p class="text-muted">No hay items registrados.</p></div>`;
        return;
    }
    data.forEach(p => {
        const imgHtml = p.imagen ? `<div style="height:140px; overflow:hidden; border-radius:4px; margin-bottom:10px; background:#000;"><img src="${p.imagen}" style="width:100%; height:100%; object-fit:cover;"></div>` : '';
        const badgeCode = p.tipo === 'PRODUCTO' ? `<span class="badge bg-info text-dark">${p.codigo}</span>` : `<span class="badge bg-warning text-dark">SERVICIO</span>`;
        const html = `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="product-card h-100 p-3 d-flex flex-column">
                <div class="d-flex justify-content-between mb-2">${badgeCode}${p.visibleWeb ? '<span class="text-success small">● WEB ON</span>' : ''}</div>
                ${imgHtml}
                <h6 class="text-white fw-bold mb-1">${p.nombre}</h6>
                <small class="text-secondary mb-3 text-truncate">${p.specs || '---'}</small>
                <div class="mt-auto d-flex justify-content-between align-items-end">
                    <div><small class="text-muted" style="font-size:0.7rem">PRECIO</small><div class="text-cyan fw-bold fs-5">${fmt.format(p.precio)}</div></div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary" onclick='loadEditModal("${p.uuid}")'><i class="bi bi-pencil-fill"></i></button>
                        <button class="btn btn-sm btn-cyan" onclick='addToCart("${p.uuid}")'><i class="bi bi-plus-lg"></i></button>
                        <button class="btn btn-sm btn-outline-success" onclick='shareProductDirectly("${p.uuid}")' title="Compartir a WhatsApp"><i class="bi bi-whatsapp"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
        grid.innerHTML += html;
    });
}

function openProductModal() {
    document.getElementById('prodForm').reset();
    document.getElementById('p-uuid').value = "";
    document.getElementById('p-imagen-data').value = "";
    document.getElementById('p-tipo').value = currentView === 'HISTORIAL' ? 'PRODUCTO' : currentView;
    document.getElementById('btn-github-publish').style.display = "none"; 
    document.getElementById('btn-cost-history').style.display = "none";
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
    document.getElementById('p-uuid').value = p.uuid;
    document.getElementById('p-tipo').value = p.tipo;
    toggleFormFields();
    document.getElementById('p-nombre').value = p.nombre;
    document.getElementById('p-specs').value = p.specs;
    document.getElementById('p-precio').value = p.precio;
    document.getElementById('p-web').checked = p.visibleWeb;
    document.getElementById('p-imagen-data').value = p.imagen;
    document.getElementById('p-imagen-file').value = "";
    
    const btnCostHistory = document.getElementById('btn-cost-history');
    if (p.tipo === 'PRODUCTO') {
        document.getElementById('p-categoria').value = p.categoria || "AUTOMATIZACION_APPS";
        document.getElementById('p-codigo').value = p.codigo;
        document.getElementById('p-costo').value = p.costo;
        if(btnCostHistory) btnCostHistory.style.display = "block";
    } else {
        if(btnCostHistory) btnCostHistory.style.display = "none";
    }
    
    document.getElementById('btn-github-publish').style.display = "block";
    bootstrap.Modal.getOrCreateInstance(document.getElementById('prodModal')).show();
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
    const payload = {
        uuid: document.getElementById('p-uuid').value,
        tipo: tipo,
        nombre: document.getElementById('p-nombre').value,
        specs: document.getElementById('p-specs').value,
        precio: Number(document.getElementById('p-precio').value),
        imagen: finalImage,
        visibleWeb: document.getElementById('p-web').checked,
        categoria: tipo==='PRODUCTO' ? document.getElementById('p-categoria').value : "",
        codigo: tipo==='PRODUCTO' ? document.getElementById('p-codigo').value : "",
        costo: tipo==='PRODUCTO' ? Number(document.getElementById('p-costo').value) : 0,
        iva: 19 
    };
    
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('prodModal'));
    if(modalInstance) {
        modalInstance.hide();
        cleanBackdrops();
    }
    
    showToast("⏳ Guardando producto en nube...", "info");
    btn.disabled = false; btn.innerText = "GUARDAR DATOS";
    
    const res = await callApi('upsertProduct', payload);
    if (res.success) {
        showToast("✅ Producto guardado con éxito.", "success");
        fetchAllDataBackground(); 
    } else {
        alert("Error: " + res.error);
    }
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
                 window.open(`https://wa.me/?text=${encodeURIComponent("Mira este producto:\n" + finalUrl)}`, '_blank');
            }
        });
    } else {
        alert("Error al publicar: " + res.error);
    }
}

// NUEVA FUNCIÓN: SHARE NATIVO (Estilo King's Shop)
async function shareProductDirectly(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    if (!p) return;
    
    if (!navigator.share) {
        alert("Tu navegador o dispositivo no soporta el envío directo de archivos. Usa el botón de GitHub.");
        return;
    }

    showToast("Preparando archivo...", "info");

    const precioStr = p.precio > 0 ? fmt.format(p.precio) : "Precio a Cotizar";
    
    // Limpieza de Emojis y Formato de Viñetas
    let specsLimpio = "Solución Profesional";
    if (p.specs) {
        let cleaned = p.specs.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
        let lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 1) {
            lines = lines.map(line => {
                line = line.replace(/^[-*•]\s*/, '');
                return '• ' + line;
            });
        }
        specsLimpio = lines.join('\n');
    }
    
    const textoShare = `🏢 *A.S.T. Soluciones Tecnológicas*\n-----------------------------------------\n📦 *Producto:* ${p.nombre}\n💰 *Valor:* ${precioStr}\n\n*Detalles Técnicos:*\n${specsLimpio}\n\nEscríbenos, será un gusto asesorarte en tu próximo proyecto.\n📞 *Contacto:* wa.me/573137713430`;

    try {
        if (p.imagen && p.imagen.startsWith('http')) {
            const response = await fetch(p.imagen);
            const blob = await response.blob();
            const file = new File([blob], "AST_Producto.jpg", { type: blob.type });

            await navigator.share({
                text: textoShare,
                files: [file]
            });
        } else {
            await navigator.share({
                text: textoShare
            });
        }
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error("Error compartiendo:", error);
            alert("No se pudo adjuntar la imagen. Se abrirá GitHub como respaldo.");
            publishToGitHub(); 
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
    const exist = cart.find(x => x.uuid === uuid);
    if(exist) exist.cantidad++;
    else cart.push({ ...p, cantidad: 1 });
    updateCartUI();
    const fab = document.getElementById('fab-cart');
    fab.style.transform = "scale(1.2)";
    setTimeout(()=>fab.style.transform = "scale(1)", 200);
}

async function openCart() {
    const selectExport = document.getElementById('cart-export-project');
    if (selectExport.options.length <= 1) { 
        projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.text = `${p.nombreProyecto} (${p.cliente})`; selectExport.appendChild(opt); });
    }
    const selectImport = document.getElementById('cart-import-project');
    if (selectImport.options.length <= 1) {
        projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.text = `${p.nombreProyecto} (${p.cliente})`; selectImport.appendChild(opt); });
    }
    
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
}

function updateCartSpec(index, value) {
    if(cart[index]) {
        cart[index].specs = value;
    }
}

function updateCartItem(index, field, value) {
    const val = Number(value);
    if (field === 'qty') { if (val <= 0) cart.splice(index, 1); else cart[index].cantidad = val; } 
    else if (field === 'price') { cart[index].precio = val; }
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
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
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

    const payload = { 
        tipoDoc: document.getElementById('doc-type').value, 
        cliente: cliente, 
        items: cart.map(c => ({
            ...c, 
            specs: c.specs, 
            subtotal: c.precio * c.cantidad
        })), 
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
        
        fetchAllDataBackground();
        
        setTimeout(() => { updateClientsDatalist(); if(confirm(`Documento ${res.data.consecutivo} Generado. ¿Abrir?`)) { window.open(res.data.url, '_blank'); } }, 500); 
    } else { alert("Error: " + res.error); }
}
