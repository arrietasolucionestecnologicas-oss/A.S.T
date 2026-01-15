// --- CONFIGURACIÓN ---
// *** PEGA AQUÍ LA NUEVA URL QUE TE DIO GOOGLE APPS SCRIPT AL IMPLEMENTAR ***
const API_URL = "https://script.google.com/macros/s/AKfycby-ygELe9PCIzv-9QBpi1KY_dvUMFIhV6gP2SAFyqSo0L1LrvbAUxffQVZhVvJfDe1e8Q/exec";
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

// --- LÓGICA DE INSTALACIÓN PWA ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-install');
    if (installBtn) {
        installBtn.style.display = 'block';
    }
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
    
    // Reset tabs
    document.getElementById('tab-prod').className = 'nav-link';
    document.getElementById('tab-serv').className = 'nav-link';
    document.getElementById('tab-proj').className = 'nav-link';
    document.getElementById('tab-hist').className = 'nav-link';

    // Set active
    if(viewName === 'PRODUCTO') document.getElementById('tab-prod').className = 'nav-link active';
    if(viewName === 'SERVICIO') document.getElementById('tab-serv').className = 'nav-link active';
    if(viewName === 'PROYECTOS') document.getElementById('tab-proj').className = 'nav-link active';
    if(viewName === 'HISTORIAL') document.getElementById('tab-hist').className = 'nav-link active';

    // Hide all views
    document.getElementById('view-catalog').classList.add('hidden-section');
    document.getElementById('view-projects').classList.add('hidden-section');
    document.getElementById('view-history').classList.add('hidden-section');
    document.getElementById('fab-cart').style.display = 'none';
    document.getElementById('btn-main-add').style.display = 'none';

    // Show selected view
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

function renderGrid(data) {
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';
    
    if(data.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center mt-5">
                <i class="bi bi-box-seam text-secondary" style="font-size: 3rem;"></i>
                <p class="text-muted">No hay items registrados.</p>
            </div>`;
        return;
    }

    data.forEach(p => {
        const imgHtml = p.imagen ? `<div style="height:140px; overflow:hidden; border-radius:4px; margin-bottom:10px; background:#000;"><img src="${p.imagen}" style="width:100%; height:100%; object-fit:cover;"></div>` : '';
        const badgeCode = p.tipo === 'PRODUCTO' ? `<span class="badge bg-info text-dark">${p.codigo}</span>` : `<span class="badge bg-warning text-dark">SERVICIO</span>`;

        const html = `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="product-card h-100 p-3 d-flex flex-column">
                <div class="d-flex justify-content-between mb-2">
                    ${badgeCode}
                    ${p.visibleWeb ? '<span class="text-success small">● WEB ON</span>' : ''}
                </div>
                ${imgHtml}
                <h6 class="text-white fw-bold mb-1">${p.nombre}</h6>
                <small class="text-secondary mb-3 text-truncate">${p.specs || '---'}</small>
                
                <div class="mt-auto d-flex justify-content-between align-items-end">
                    <div>
                        <small class="text-muted" style="font-size:0.7rem">PRECIO</small>
                        <div class="text-cyan fw-bold fs-5">${fmt.format(p.precio)}</div>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary" onclick='loadEditModal("${p.uuid}")'><i class="bi bi-pencil-fill"></i></button>
                        <button class="btn btn-sm btn-cyan" onclick='addToCart("${p.uuid}")'><i class="bi bi-plus-lg"></i></button>
                        <button class="btn btn-sm btn-outline-light" onclick='shareProduct("${p.uuid}")'><i class="bi bi-share-fill"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
        grid.innerHTML += html;
    });
}

// --- FUNCIONES DE CATALOGO ---
function openProductModal() {
    document.getElementById('prodForm').reset();
    document.getElementById('p-uuid').value = "";
    document.getElementById('p-imagen-data').value = "";
    document.getElementById('p-tipo').value = currentView === 'HISTORIAL' ? 'PRODUCTO' : currentView;
    toggleFormFields();
    new bootstrap.Modal(document.getElementById('prodModal')).show();
}

function toggleFormFields() {
    const tipo = document.getElementById('p-tipo').value;
    const fieldsProd = document.getElementById('fields-producto');
    if (tipo === 'SERVICIO') {
        fieldsProd.classList.add('hidden-section'); 
    } else {
        fieldsProd.classList.remove('hidden-section');
    }
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

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// --- FUNCIONES CARRITO ---
function addToCart(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    const exist = cart.find(x => x.uuid === uuid);
    if(exist) exist.cantidad++;
    else cart.push({ ...p, cantidad: 1 });
    updateCartUI();
    // Feedback visual
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
        container.innerHTML += `
            <div class="row align-items-center border-bottom border-secondary py-2 g-2">
                <div class="col-12 text-white small">
                    <strong>${item.nombre}</strong> <span class="badge bg-secondary">${item.tipo}</span>
                </div>
                <div class="col-3">
                    <input type="number" class="form-control form-control-sm bg-dark text-white border-secondary p-1 text-center" 
                           value="${item.cantidad}" onchange="updateCartItem(${i}, 'qty', this.value)">
                </div>
                <div class="col-4">
                    <input type="number" class="form-control form-control-sm bg-dark text-cyan border-secondary p-1 text-end" 
                           value="${item.precio}" onchange="updateCartItem(${i}, 'price', this.value)">
                </div>
                <div class="col-3 text-end text-muted small">
                   ${fmt.format(item.precio * item.cantidad)}
                </div>
                <div class="col-2 text-end">
                    <button class="btn btn-sm text-danger" onclick="cart.splice(${i},1);updateCartUI()"><i class="bi bi-trash"></i></button>
                </div>
            </div>
        `;
    });

    const applyIva = document.getElementById('check-iva').checked;
    const ivaVal = applyIva ? (subtotal * 0.19) : 0;
    const total = subtotal + ivaVal;

    document.getElementById('iva-display').innerText = `IVA: ${fmt.format(ivaVal)}`;
    document.getElementById('cart-total').innerText = fmt.format(total);
}

function updateCartItem(index, field, value) {
    const val = Number(value);
    if (field === 'qty') {
        if (val <= 0) cart.splice(index, 1);
        else cart[index].cantidad = val;
    } else if (field === 'price') {
        cart[index].precio = val; 
    }
    updateCartUI();
}

async function openCart() {
    const selectExport = document.getElementById('cart-export-project');
    if (selectExport.options.length <= 1) { 
        if(projects.length === 0) {
            const res = await callApi('getProjects');
            if(res.success) projects = res.data;
        }
        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.text = `${p.nombreProyecto} (${p.cliente})`;
            selectExport.appendChild(opt);
        });
    }

    const selectImport = document.getElementById('cart-import-project');
    if (selectImport.options.length <= 1) {
        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.text = `${p.nombreProyecto} (${p.cliente})`;
            selectImport.appendChild(opt);
        });
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
            if(isCobrar) {
                cart.push({
                    uuid: item.idMov,
                    nombre: item.descripcion,
                    tipo: item.tipo,
                    specs: "Ítem importado de Proyecto", 
                    precio: item.venta,
                    cantidad: item.cantidad,
                    costo: item.costo 
                });
                count++;
            }
        });
        
        if(count > 0) {
            updateCartUI();
            alert(`${count} ítems importados al carrito.`);
        } else {
            alert("Este proyecto no tiene ítems marcados para cobrar.");
        }
    }
}

function sendWhatsApp() {
    const clienteInput = document.getElementById('c-nombre').value;
    
    if (cart.length === 0) return alert("El carrito está vacío. Agrega productos o servicios.");

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

    if (applyIva) {
        msg += `\nSubtotal: $${subtotal.toLocaleString()}`;
        msg += `\nIVA (19%): $${ivaVal.toLocaleString()}`;
    }
    msg += `\n*TOTAL: $${granTotal.toLocaleString()}*`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

async function generatePDF() {
    const cliente = {
        nombre: document.getElementById('c-nombre').value,
        nit: document.getElementById('c-nit').value,
        telefono: document.getElementById('c-tel').value
    };

    if(!cliente.nombre || cart.length === 0) return alert("Para generar PDF (Formal) se requiere el Nombre del Cliente.");

    const btn = document.querySelector('#cartModal .btn-success');
    btn.disabled = true; btn.innerHTML = "GENERANDO...";

    let subtotal = 0;
    cart.forEach(c => subtotal += (c.precio * c.cantidad));
    
    const applyIva = document.getElementById('check-iva').checked;
    const showSpecs = document.getElementById('check-specs').checked; 
    const ivaVal = applyIva ? (subtotal * 0.19) : 0;
    
    const projectIdToSync = document.getElementById('cart-export-project').value;

    const payload = {
        tipoDoc: document.getElementById('doc-type').value,
        cliente: cliente,
        items: cart.map(c => ({...c, subtotal: c.precio * c.cantidad})),
        totales: { subtotal: subtotal, iva: ivaVal, granTotal: subtotal + ivaVal },
        opciones: { mostrarDesc: showSpecs },
        projectId: projectIdToSync 
    };

    const res = await callApi('createDocument', payload);
    
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Generar PDF';
    
    if (res.success) {
        cart = []; updateCartUI();
        bootstrap.Modal.getInstance(document.getElementById('cartModal')).hide();
        setTimeout(() => {
            fetchClients();
            if(confirm(`Documento ${res.data.consecutivo} Generado. ¿Abrir?`)) {
                window.open(res.data.url, '_blank');
            }
        }, 500); 
    } else {
        alert("Error: " + res.error);
    }
}

// =========================================================
// === GESTIÓN DE PROYECTOS, CLIENTES Y HISTORIAL ===
// =========================================================

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

function autoFillClient(val, prefix) {
    const client = clients.find(c => c.nombre.toLowerCase() === val.toLowerCase());
    if (client) {
        const telInput = document.getElementById(prefix + '-contacto') || document.getElementById(prefix + '-tel');
        if (telInput) telInput.value = client.telefono || '';
        
        const nitInput = document.getElementById(prefix + '-nit');
        if (nitInput) nitInput.value = client.nit || '';
    }
}

// --- PROYECTOS Y DASHBOARD ---
async function fetchProjects() {
    const list = document.getElementById('projects-list');
    const dashboard = document.getElementById('projects-dashboard');
    list.innerHTML = '<div class="text-center text-muted mt-5"><div class="spinner-border spinner-border-sm"></div> Cargando trabajos...</div>';
    
    const res = await callApi('getProjects');
    list.innerHTML = '';

    if (res.success) {
        projects = res.data;
        if (projects.length === 0) {
            dashboard.classList.add('d-none'); 
            list.innerHTML = '<div class="text-center text-muted mt-5"><i class="bi bi-folder2-open fs-1"></i><p>No hay trabajos abiertos.</p></div>';
            return;
        }

        let gCobrado = 0, gGastos = 0, gUtilidad = 0;
        
        projects.forEach(p => {
            gCobrado += p.totalCobrado;
            gGastos += p.totalCostos;
            gUtilidad += p.utilidad;
        });

        dashboard.classList.remove('d-none');
        document.getElementById('kpi-cobrado').innerText = fmt.format(gCobrado);
        document.getElementById('kpi-gastos').innerText = fmt.format(gGastos);
        document.getElementById('kpi-utilidad').innerText = fmt.format(gUtilidad);
        
        const margenGlobal = gCobrado > 0 ? ((gUtilidad / gCobrado) * 100).toFixed(1) : 0;
        document.getElementById('kpi-margen').innerText = margenGlobal + "%";
        
        const kpiMargenEl = document.getElementById('kpi-margen');
        if(margenGlobal > 30) kpiMargenEl.className = "fw-bold text-success";
        else if(margenGlobal > 10) kpiMargenEl.className = "fw-bold text-warning";
        else kpiMargenEl.className = "fw-bold text-danger";


        projects.forEach(p => {
            const utilClase = p.utilidad >= 0 ? 'text-profit' : 'text-loss';
            
            const margen = p.totalCobrado > 0 ? ((p.utilidad / p.totalCobrado) * 100).toFixed(0) : 0;
            let badgeColor = "bg-secondary";
            if(p.totalCobrado > 0) {
                if(margen > 30) badgeColor = "bg-success";
                else if(margen > 10) badgeColor = "bg-warning text-dark";
                else badgeColor = "bg-danger";
            }

            const html = `
            <div class="project-card" onclick='openProjectDetails("${p.id}")'>
                <div class="d-flex justify-content-between mb-1">
                    <h6 class="text-cyan fw-bold m-0 text-truncate" style="max-width: 70%;">${p.nombreProyecto || 'Trabajo sin nombre'}</h6>
                    <span class="badge ${badgeColor} small" style="font-size:0.6rem">${margen}% RENT.</span>
                </div>
                <div class="d-flex justify-content-between small text-muted mb-2">
                    <span>${p.cliente}</span>
                    <span class="badge bg-dark border border-secondary">${p.estado}</span>
                </div>
                
                <div class="row g-0 text-center bg-dark p-2 rounded">
                    <div class="col-4 border-end border-secondary">
                        <small class="text-muted" style="font-size:10px">COBRADO</small>
                        <div class="text-white small fw-bold">${fmt.format(p.totalCobrado)}</div>
                    </div>
                    <div class="col-4 border-end border-secondary">
                        <small class="text-muted" style="font-size:10px">GASTOS</small>
                        <div class="text-danger small fw-bold">${fmt.format(p.totalCostos)}</div>
                    </div>
                    <div class="col-4">
                        <small class="text-muted" style="font-size:10px">UTILIDAD</small>
                        <div class="${utilClase} small fw-bold">${fmt.format(p.utilidad)}</div>
                    </div>
                </div>
            </div>`;
            list.innerHTML += html;
        });
    }
}

// --- HISTORIAL ---
async function fetchHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '<div class="text-center text-muted mt-5"><div class="spinner-border spinner-border-sm"></div> Cargando historial...</div>';
    
    const res = await callApi('getHistoryDocs');
    list.innerHTML = '';

    if (res.success) {
        historyDocs = res.data;
        if (historyDocs.length === 0) {
            list.innerHTML = '<div class="text-center text-muted mt-5"><i class="bi bi-clock-history fs-1"></i><p>Sin documentos.</p></div>';
            return;
        }

        historyDocs.forEach((doc, i) => {
            const canReload = (doc.jsonData && doc.jsonData.length > 5);
            const btnReload = canReload 
                ? `<button class="btn btn-sm btn-cyan" onclick="restoreDocument(${i})">Recargar <i class="bi bi-pencil-square"></i></button>` 
                : `<span class="badge bg-secondary">Sin datos</span>`;

            const html = `
            <div class="history-card">
                <div class="d-flex justify-content-between mb-1">
                    <h6 class="text-white fw-bold m-0">${doc.consecutivo}</h6>
                    <span class="badge bg-secondary small">${new Date(doc.fecha).toLocaleDateString()}</span>
                </div>
                <div class="d-flex justify-content-between small text-muted mb-2">
                    <span>${doc.cliente}</span>
                    <span class="text-cyan fw-bold">${fmt.format(doc.total)}</span>
                </div>
                <div class="d-flex justify-content-between gap-2">
                    <a href="${doc.url}" target="_blank" class="btn btn-sm btn-outline-light flex-grow-1"><i class="bi bi-eye"></i> Ver PDF</a>
                    ${btnReload}
                </div>
            </div>`;
            list.innerHTML += html;
        });
    }
}

function restoreDocument(index) {
    const doc = historyDocs[index];
    if(!doc || !doc.jsonData) return;

    try {
        const savedData = JSON.parse(doc.jsonData);
        
        cart = savedData.items.map(item => ({
            uuid: item.uuid || 'restored-'+Math.random(),
            nombre: item.nombre,
            tipo: item.tipo,
            specs: item.specs,
            precio: item.precio,
            cantidad: item.cantidad
        }));
        updateCartUI();

        document.getElementById('c-nombre').value = savedData.cliente.nombre || "";
        document.getElementById('c-nit').value = savedData.cliente.nit || "";
        document.getElementById('c-tel').value = savedData.cliente.telefono || "";
        document.getElementById('doc-type').value = savedData.tipoDoc || "Cotización";

        new bootstrap.Modal(document.getElementById('cartModal')).show();

    } catch (e) {
        console.error(e);
        alert("Error al restaurar datos del documento.");
    }
}

function openNewProjectModal() {
    document.getElementById('np-proyecto').value = "";
    document.getElementById('np-cliente').value = "";
    document.getElementById('np-contacto').value = "";
    new bootstrap.Modal(document.getElementById('newProjectModal')).show();
}

async function createNewProject() {
    const nombre = document.getElementById('np-proyecto').value;
    const cliente = document.getElementById('np-cliente').value;
    const contacto = document.getElementById('np-contacto').value;
    
    if(!nombre || !cliente) return alert("Escribe el nombre del trabajo y del cliente");
    
    const btn = document.querySelector('#newProjectModal .btn-cyan');
    btn.disabled = true; btn.innerText = "CREANDO...";
    
    const res = await callApi('createProject', { nombreProyecto: nombre, cliente, contacto });
    
    btn.disabled = false; btn.innerText = "CREAR CARPETA";
    
    if(res.success) {
        bootstrap.Modal.getInstance(document.getElementById('newProjectModal')).hide();
        fetchProjects();
        fetchClients(); 
    }
}

async function openProjectDetails(id) {
    currentProject = id;
    const modal = new bootstrap.Modal(document.getElementById('projectDetailModal'));
    modal.show();
    
    document.getElementById('pd-title').innerText = "Cargando...";
    document.getElementById('pd-subtitle').innerText = "";
    document.getElementById('pd-items-list').innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-cyan"></div></div>';
    
    const res = await callApi('getProjectDetails', { id: id });
    
    if(res.success) {
        const info = res.data.info;
        currentProjectData = info; 
        const items = res.data.items;
        currentProjectItems = items; 
        
        document.getElementById('pd-title').innerText = info.nombreProyecto || info.cliente;
        document.getElementById('pd-subtitle').innerText = info.cliente + " | " + info.estado;
        
        document.getElementById('pd-cobrado').innerText = fmt.format(info.totalCobrado);
        document.getElementById('pd-gastos').innerText = fmt.format(info.totalCostos);
        document.getElementById('pd-utilidad').innerText = fmt.format(info.utilidad);
        
        const listDiv = document.getElementById('pd-items-list');
        listDiv.innerHTML = '';
        
        if(items.length === 0) {
            listDiv.innerHTML = '<p class="text-center text-muted mt-4">Carpeta vacía. Agrega gastos o servicios.</p>';
        }
        
        items.forEach(item => {
            const isCobrar = (item.esCobrar === true || item.esCobrar === 'TRUE');
            const icon = isCobrar ? '<i class="bi bi-cash-coin text-success" title="Se cobra al cliente"></i>' : '<i class="bi bi-wallet2 text-danger" title="Gasto Interno"></i>';
            
            const actions = `
                <button class="btn btn-sm text-secondary" onclick='openEditItemModal("${item.idMov}")'><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm text-danger" onclick='deleteProjectItem("${item.idMov}")'><i class="bi bi-trash"></i></button>
            `;

            const html = `
            <div class="border-bottom border-secondary py-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                         <div class="d-flex align-items-center gap-2">
                            <span class="text-white fw-bold small">${item.descripcion}</span>
                            <span>${icon}</span>
                         </div>
                         <div class="d-flex gap-3 small text-muted mt-1">
                            <span>${item.cantidad} x ${fmt.format(item.costo)} <span class="text-danger" style="font-size:0.7em">(COSTO)</span></span>
                         </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="${isCobrar ? 'text-cyan fw-bold small' : 'text-secondary text-decoration-line-through small'}">
                            ${fmt.format(item.venta * item.cantidad)}
                        </span>
                        <div class="btn-group btn-group-sm ms-2">
                           ${actions}
                        </div>
                    </div>
                </div>
            </div>`;
            listDiv.innerHTML += html;
        });
    }
}

function openEditProjectModal() {
    if(!currentProjectData) return;
    
    document.getElementById('ep-id').value = currentProjectData.id;
    document.getElementById('ep-proyecto').value = currentProjectData.nombreProyecto;
    document.getElementById('ep-cliente').value = currentProjectData.cliente;
    document.getElementById('ep-contacto').value = currentProjectData.contacto;
    document.getElementById('ep-estado').value = currentProjectData.estado;
    
    bootstrap.Modal.getInstance(document.getElementById('projectDetailModal')).hide();
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
    
    const btn = document.querySelector('#editProjectModal .btn-cyan');
    btn.disabled = true; btn.innerText = "GUARDANDO...";
    
    const res = await callApi('updateProject', payload);
    btn.disabled = false; btn.innerText = "GUARDAR CAMBIOS";
    
    if(res.success) {
        bootstrap.Modal.getInstance(document.getElementById('editProjectModal')).hide();
        fetchProjects(); 
        fetchClients(); 
        openProjectDetails(payload.id); 
    }
}

async function deleteProject() {
    if(!confirm("¿Estás seguro de eliminar este Proyecto y todos sus gastos registrados? Esta acción no se puede deshacer.")) return;
    
    const res = await callApi('deleteProject', { id: currentProject });
    
    if(res.success) {
        bootstrap.Modal.getInstance(document.getElementById('projectDetailModal')).hide();
        fetchProjects();
    } else {
        alert("Error al eliminar");
    }
}

// --- EDICIÓN DE ITEMS ---

function openAddItemModal() {
    // Resetear formulario
    document.getElementById('ai-id').value = ""; 
    document.getElementById('ai-search').value = ""; // Limpiar buscador
    document.getElementById('ai-desc').value = "";
    document.getElementById('ai-prov').value = "";
    document.getElementById('ai-cant').value = "1";
    document.getElementById('ai-costo').value = "0";
    document.getElementById('ai-venta').value = "0";
    document.getElementById('ai-cobrar').checked = true;
    toggleVentaInput();
    
    // Llenar datalist (AUTOCOMPLETADO CATALOGO)
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
        
        if(item.tipo === 'PRODUCTO') document.getElementById('ai-tipo').value = 'MATERIAL';
        else document.getElementById('ai-tipo').value = 'MANO_OBRA';

        document.getElementById('ai-cobrar').checked = true;
        toggleVentaInput();
    }
}

function openEditItemModal(idMov) {
    const item = currentProjectItems.find(i => i.idMov === idMov);
    if(!item) return;

    document.getElementById('ai-id').value = item.idMov;
    document.getElementById('ai-search').value = ""; // No usamos buscador en edicion
    document.getElementById('ai-tipo').value = item.tipo;
    document.getElementById('ai-desc').value = item.descripcion;
    document.getElementById('ai-prov').value = item.proveedor;
    document.getElementById('ai-cant').value = item.cantidad;
    document.getElementById('ai-costo').value = item.costo;
    document.getElementById('ai-venta').value = item.venta;
    
    const isCobrar = (item.esCobrar === true || item.esCobrar === 'TRUE');
    document.getElementById('ai-cobrar').checked = isCobrar;
    toggleVentaInput();

    new bootstrap.Modal(document.getElementById('addItemModal')).show();
}

function toggleVentaInput() {
    const isChecked = document.getElementById('ai-cobrar').checked;
    const div = document.getElementById('div-venta');
    if(isChecked) {
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
        document.getElementById('ai-venta').value = 0;
    }
}

async function saveProjectItem() {
    const desc = document.getElementById('ai-desc').value;
    const idEdit = document.getElementById('ai-id').value; 
    
    if(!desc) return alert("Falta descripción");

    const payload = {
        projectId: currentProject,
        idMov: idEdit, 
        tipo: document.getElementById('ai-tipo').value,
        descripcion: desc,
        proveedor: document.getElementById('ai-prov').value,
        cantidad: Number(document.getElementById('ai-cant').value),
        costo: Number(document.getElementById('ai-costo').value),
        venta: Number(document.getElementById('ai-venta').value),
        esCobrar: document.getElementById('ai-cobrar').checked
    };

    const btn = document.querySelector('#addItemModal .btn-primary');
    btn.disabled = true; btn.innerText = "...";

    const action = idEdit ? 'updateProjectMovement' : 'addProjectMovement';
    
    const res = await callApi(action, payload);
    btn.disabled = false; btn.innerText = "REGISTRAR";

    if(res.success) {
        bootstrap.Modal.getInstance(document.getElementById('addItemModal')).hide();
        openProjectDetails(currentProject); 
        fetchProjects(); 
    }
}

async function deleteProjectItem(idMov) {
    if(!confirm("¿Borrar este ítem?")) return;
    
    const res = await callApi('deleteProjectMovement', { projectId: currentProject, idMov: idMov });
    
    if(res.success) {
        openProjectDetails(currentProject);
        fetchProjects();
    }
}

// --- FUNCIÓN PARA COMPARTIR EN WHATSAPP (ACTUALIZADA - UNICODE SEGURO) ---
function shareProduct(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    if(!p) return;

    // Generar enlace inteligente
    const backendUrl = API_URL; 
    const smartLink = `${backendUrl}?shareId=${uuid}`;
    
    // Limpieza de nombre segura para URL
    const cleanName = p.nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\.,\-\(\)]/g, '').trim();

    // Mensaje con Unicode Seguro
    const text = `Mira esta soluci\u00F3n de A.S.T.:\n*${cleanName}*\n${smartLink}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
