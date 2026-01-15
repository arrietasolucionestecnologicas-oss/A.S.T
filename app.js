// ==========================================
// A.S.T. ADMIN FRONTEND (V22 - FULL RESTORATION)
// ==========================================
// *** PEGA AQUÍ LA NUEVA URL DE GOOGLE APPS SCRIPT AL IMPLEMENTAR ***
const API_URL = "AQUI_PEGA_TU_NUEVA_URL_DEL_SCRIPT";
const API_KEY = "AST_2025_SECURE"; 

let catalog = [];
let cart = [];
let projects = []; 
let clients = []; 
let historyDocs = []; 
let currentProject = null; 
let currentProjectData = null; 
let currentProjectItems = []; 
let currentView = 'PRODUCTO'; 
let deferredPrompt; 

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

document.addEventListener('DOMContentLoaded', () => {
    fetchCatalog();
    fetchClients(); 
    
    document.getElementById('search').addEventListener('input', (e) => {
        if(currentView === 'PROYECTOS' || currentView === 'HISTORIAL') return; 
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

    if(viewName === 'PRODUCTO') document.getElementById('tab-prod').className = 'nav-link active';
    if(viewName === 'SERVICIO') document.getElementById('tab-serv').className = 'nav-link active';
    if(viewName === 'PROYECTOS') document.getElementById('tab-proj').className = 'nav-link active';
    if(viewName === 'HISTORIAL') document.getElementById('tab-hist').className = 'nav-link active';

    document.getElementById('view-catalog').classList.add('hidden-section');
    document.getElementById('view-projects').classList.add('hidden-section');
    document.getElementById('view-history').classList.add('hidden-section');
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
    const res = await callApi('getAdminCatalog');
    if (res.success) {
        catalog = res.data;
        if(currentView !== 'PROYECTOS' && currentView !== 'HISTORIAL') {
             switchTab(currentView); 
        }
    }
}

// --- GESTIÓN DE CLIENTES ---
async function fetchClients() {
    const res = await callApi('getClients');
    if (res.success) {
        clients = res.data;
        const datalist = document.getElementById('clients-datalist');
        datalist.innerHTML = '';
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.nombre;
            datalist.appendChild(opt);
        });
    }
}

function autoFillClient(name, prefix) {
    const client = clients.find(c => c.nombre === name);
    if (client) {
        if (prefix === 'c') { // Carrito
            document.getElementById('c-nit').value = client.nit;
            document.getElementById('c-tel').value = client.telefono;
        } 
    }
}

// --- GESTIÓN DE PROYECTOS (ESTO FALTABA) ---
async function fetchProjects() {
    const container = document.getElementById('projects-list');
    container.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-cyan"></div></div>';
    
    const res = await callApi('getProjects');
    
    if(res.success) {
        projects = res.data;
        renderProjects();
        calculateDashboard();
    } else {
        container.innerHTML = `<div class="text-danger text-center">Error al cargar proyectos</div>`;
    }
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
    new bootstrap.Modal(document.getElementById('newProjectModal')).show();
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
    
    const res = await callApi('createProject', payload);
    btn.disabled = false; btn.innerText = "CREAR CARPETA";
    
    if(res.success) {
        bootstrap.Modal.getInstance(document.getElementById('newProjectModal')).hide();
        fetchProjects();
    }
}

// --- DETALLE DE PROYECTO ---
async function openProjectDetail(id) {
    currentProject = id;
    const modal = new bootstrap.Modal(document.getElementById('projectDetailModal'));
    modal.show();
    
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
            <button class="btn btn-sm text-secondary" onclick="deleteProjectMovement('${item.idMov}')"><i class="bi bi-trash"></i></button>
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
    new bootstrap.Modal(document.getElementById('editProjectModal')).show();
}

async function updateProject() {
    const payload = {
        id: document.getElementById('ep-id').value,
        nombreProyecto: document.getElementById('ep-proyecto').value,
        cliente: document.getElementById('ep-cliente').value,
        contacto: document.getElementById('ep-contacto').value,
        estado: document.getElementById('ep-estado').value
    };
    await callApi('updateProject', payload);
    bootstrap.Modal.getInstance(document.getElementById('editProjectModal')).hide();
    openProjectDetail(payload.id); // Recargar
    fetchProjects(); // Actualizar lista atrás
}

async function deleteProject() {
    if(confirm("¿Eliminar este proyecto y todo su historial?")) {
        await callApi('deleteProject', { id: currentProject });
        bootstrap.Modal.getInstance(document.getElementById('projectDetailModal')).hide();
        fetchProjects();
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
    
    // Llenar datalist del catálogo
    const dl = document.getElementById('list-catalog-items');
    dl.innerHTML = '';
    catalog.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.nombre;
        dl.appendChild(opt);
    });
    
    new bootstrap.Modal(document.getElementById('addItemModal')).show();
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
    
    const res = await callApi('addProjectMovement', payload);
    if(res.success) {
        bootstrap.Modal.getInstance(document.getElementById('addItemModal')).hide();
        openProjectDetail(currentProject);
        fetchProjects();
    }
}

async function deleteProjectMovement(idMov) {
    if(confirm("¿Borrar movimiento?")) {
        await callApi('deleteProjectMovement', { idMov: idMov, projectId: currentProject });
        openProjectDetail(currentProject);
        fetchProjects();
    }
}

// --- HISTORIAL ---
async function fetchHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-cyan"></div></div>';
    
    const res = await callApi('getHistoryDocs');
    
    if(res.success) {
        historyDocs = res.data;
        renderHistory();
    } else {
        container.innerHTML = `<div class="text-danger text-center">Error historial</div>`;
    }
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    
    if (historyDocs.length === 0) {
        container.innerHTML = '<div class="text-muted text-center mt-5">Sin documentos generados.</div>';
        return;
    }

    historyDocs.forEach(h => {
        const date = new Date(h.fecha).toLocaleDateString();
        const html = `
        <div class="history-card">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="text-cyan fw-bold">${h.consecutivo}</div>
                    <div class="text-white small">${h.cliente}</div>
                    <div class="text-muted" style="font-size:0.7rem;">${date} | ${h.tipo}</div>
                </div>
                <div class="text-end">
                    <div class="text-white fw-bold">${fmt.format(h.total)}</div>
                    <a href="${h.url}" target="_blank" class="btn btn-sm btn-outline-light mt-1"><i class="bi bi-file-earmark-pdf"></i> Ver</a>
                </div>
            </div>
        </div>`;
        container.innerHTML += html;
    });
}

// --- RENDER GRID (PRODUCTOS/CATALOGO) ---
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
                        <button class="btn btn-sm btn-outline-light" onclick='loadEditModal("${p.uuid}")' title="Abrir para Publicar"><i class="bi bi-share-fill"></i></button>
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
    toggleFormFields();
    new bootstrap.Modal(document.getElementById('prodModal')).show();
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

    if (p.tipo === 'PRODUCTO') {
        document.getElementById('p-categoria').value = p.categoria || "AUTOMATIZACION_APPS";
        document.getElementById('p-codigo').value = p.codigo;
        document.getElementById('p-costo').value = p.costo;
    }
    
    document.getElementById('btn-github-publish').style.display = "block";
    
    new bootstrap.Modal(document.getElementById('prodModal')).show();
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

    const res = await callApi('upsertProduct', payload);
    btn.disabled = false; btn.innerText = "GUARDAR DATOS";

    if (res.success) {
        bootstrap.Modal.getInstance(document.getElementById('prodModal')).hide();
        fetchCatalog(); 
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
function updateCartUI() {
    document.getElementById('cart-count').innerText = cart.length;
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let subtotal = 0;
    cart.forEach((item, i) => {
        subtotal += (item.precio * item.cantidad);
        container.innerHTML += `<div class="row align-items-center border-bottom border-secondary py-2 g-2"><div class="col-12 text-white small"><strong>${item.nombre}</strong> <span class="badge bg-secondary">${item.tipo}</span></div><div class="col-3"><input type="number" class="form-control form-control-sm bg-dark text-white border-secondary p-1 text-center" value="${item.cantidad}" onchange="updateCartItem(${i}, 'qty', this.value)"></div><div class="col-4"><input type="number" class="form-control form-control-sm bg-dark text-cyan border-secondary p-1 text-end" value="${item.precio}" onchange="updateCartItem(${i}, 'price', this.value)"></div><div class="col-3 text-end text-muted small">${fmt.format(item.precio * item.cantidad)}</div><div class="col-2 text-end"><button class="btn btn-sm text-danger" onclick="cart.splice(${i},1);updateCartUI()"><i class="bi bi-trash"></i></button></div></div>`;
    });
    const applyIva = document.getElementById('check-iva').checked;
    const ivaVal = applyIva ? (subtotal * 0.19) : 0;
    const total = subtotal + ivaVal;
    document.getElementById('iva-display').innerText = `IVA: ${fmt.format(ivaVal)}`;
    document.getElementById('cart-total').innerText = fmt.format(total);
}
function updateCartItem(index, field, value) {
    const val = Number(value);
    if (field === 'qty') { if (val <= 0) cart.splice(index, 1); else cart[index].cantidad = val; } 
    else if (field === 'price') { cart[index].precio = val; }
    updateCartUI();
}
async function openCart() {
    const selectExport = document.getElementById('cart-export-project');
    if (selectExport.options.length <= 1) { 
        if(projects.length === 0) { const res = await callApi('getProjects'); if(res.success) projects = res.data; }
        projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.text = `${p.nombreProyecto} (${p.cliente})`; selectExport.appendChild(opt); });
    }
    const selectImport = document.getElementById('cart-import-project');
    if (selectImport.options.length <= 1) {
        projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.text = `${p.nombreProyecto} (${p.cliente})`; selectImport.appendChild(opt); });
    }
    new bootstrap.Modal(document.getElementById('cartModal')).show();
}
async function importFromProject() {
    const projectId = document.getElementById('cart-import-project').value;
    if(!projectId) return alert("Selecciona un proyecto primero");
    const btn = document.querySelector('#cart-import-project + button');
    btn.disabled = true; btn.innerText = "...";
    const res = await callApi('getProjectDetails', { id: projectId });
    btn.disabled = false; btn.innerText = "Importar";
    if(res.success) {
        const items = res.data.items;
        let count = 0;
        items.forEach(item => {
            const isCobrar = (item.esCobrar === true || item.esCobrar === 'TRUE');
            if(isCobrar) { cart.push({ uuid: item.idMov, nombre: item.descripcion, tipo: item.tipo, specs: "Ítem importado", precio: item.venta, cantidad: item.cantidad, costo: item.costo }); count++; }
        });
        if(count > 0) { updateCartUI(); alert(`${count} ítems importados.`); } else { alert("Este proyecto no tiene ítems para cobrar."); }
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
    const showSpecs = document.getElementById('check-specs').checked; 
    const ivaVal = applyIva ? (subtotal * 0.19) : 0;
    const projectIdToSync = document.getElementById('cart-export-project').value;
    const payload = { tipoDoc: document.getElementById('doc-type').value, cliente: cliente, items: cart.map(c => ({...c, subtotal: c.precio * c.cantidad})), totales: { subtotal: subtotal, iva: ivaVal, granTotal: subtotal + ivaVal }, opciones: { mostrarDesc: showSpecs }, projectId: projectIdToSync };
    const res = await callApi('createDocument', payload);
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Generar PDF';
    if (res.success) {
        cart = []; updateCartUI();
        bootstrap.Modal.getInstance(document.getElementById('cartModal')).hide();
        setTimeout(() => { fetchClients(); if(confirm(`Documento ${res.data.consecutivo} Generado. ¿Abrir?`)) { window.open(res.data.url, '_blank'); } }, 500); 
    } else { alert("Error: " + res.error); }
}
