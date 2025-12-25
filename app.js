// --- CONFIGURACIÓN ---
const API_URL = "https://script.google.com/macros/s/AKfycbxLayXPyMofzgr6sbh8o5dB57Gg_jKIJGlIo8peFhojmklaE1xkzSssXsH4dhIHMKbfgA/exec"; 
const API_KEY = "AST_2025_SECURE"; 

let catalog = [];
let cart = [];
let currentView = 'PRODUCTO'; 
let deferredPrompt; // Para la instalación PWA

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

document.addEventListener('DOMContentLoaded', () => {
    fetchCatalog();
    document.getElementById('search').addEventListener('input', (e) => {
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
    // Prevenir que el navegador muestre su propio mini-infobar inmediatamente
    e.preventDefault();
    deferredPrompt = e;
    // Mostrar nuestro botón de instalación
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
    document.getElementById('tab-prod').className = viewName === 'PRODUCTO' ? 'nav-link active' : 'nav-link';
    document.getElementById('tab-serv').className = viewName === 'SERVICIO' ? 'nav-link active' : 'nav-link';
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
        document.getElementById('catalog-grid').innerHTML = '<div class="col-12 text-center text-danger mt-5"><i class="bi bi-wifi-off fs-1"></i><p>Error de conexión.</p></div>';
        return { success: false, error: error.message };
    }
}

async function fetchCatalog() {
    const res = await callApi('getAdminCatalog');
    if (res.success) {
        catalog = res.data;
        switchTab(currentView); 
    }
}

function renderGrid(data) {
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';
    
    if(data.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center mt-5">
                <i class="bi bi-box-seam text-secondary" style="font-size: 3rem;"></i>
                <p class="text-muted">No hay ${currentView === 'PRODUCTO' ? 'productos' : 'servicios'} registrados.</p>
                <button class="btn btn-outline-cyan btn-sm" onclick="openProductModal()">
                    <i class="bi bi-plus-lg"></i> Crear Nuevo
                </button>
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
    document.getElementById('p-tipo').value = currentView;
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

function addToCart(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    const exist = cart.find(x => x.uuid === uuid);
    if(exist) exist.cantidad++;
    else cart.push({ ...p, cantidad: 1 });
    updateCartUI();
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

function openCart() {
    new bootstrap.Modal(document.getElementById('cartModal')).show();
}

function sendWhatsApp() {
    // CAMBIO: El nombre del cliente ya no es obligatorio para WhatsApp
    const clienteInput = document.getElementById('c-nombre').value;
    
    // Solo validamos que haya items en el carrito
    if (cart.length === 0) return alert("El carrito está vacío. Agrega productos o servicios.");

    // Saludo condicional: si no hay nombre, saludo genérico
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
    // Para PDF sí mantenemos la validación estricta (Documento Formal)
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
    const ivaVal = applyIva ? (subtotal * 0.19) : 0;

    const payload = {
        tipoDoc: document.getElementById('doc-type').value,
        cliente: cliente,
        items: cart.map(c => ({...c, subtotal: c.precio * c.cantidad})),
        totales: { subtotal: subtotal, iva: ivaVal, granTotal: subtotal + ivaVal }
    };

    const res = await callApi('createDocument', payload);
    
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Generar PDF';
    
    if (res.success) {
        cart = []; updateCartUI();
        bootstrap.Modal.getInstance(document.getElementById('cartModal')).hide();
        if(confirm(`Documento ${res.data.consecutivo} Generado. ¿Abrir?`)) {
            window.open(res.data.url, '_blank');
        }
    } else {
        alert("Error: " + res.error);
    }
}
