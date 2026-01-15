// --- CONFIGURACIÓN ---
// *** PEGA AQUÍ LA NUEVA URL QUE TE DIO GOOGLE APPS SCRIPT AL IMPLEMENTAR ***
const API_URL = "https://script.google.com/macros/s/AKfycbxLayXPyMofzgr6sbh8o5dB57Gg_jKIJGlIo8peFhojmklaE1xkzSssXsH4dhIHMKbfgA/exec";
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
        alert("Error al publicar: " + (res.error || "Desconocido. Revisa si creaste la carpeta 'share' en GitHub."));
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
