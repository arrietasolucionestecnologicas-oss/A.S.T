// --- CONFIGURACIÓN ---
const API_URL = "https://script.google.com/macros/s/AKfycbxLayXPyMofzgr6sbh8o5dB57Gg_jKIJGlIo8peFhojmklaE1xkzSssXsH4dhIHMKbfgA/exec"; 
const API_KEY = "AST_2025_SECURE"; 

let catalog = [];
let cart = [];
const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

document.addEventListener('DOMContentLoaded', () => {
    fetchCatalog();
    
    document.getElementById('search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = catalog.filter(p => 
            p.nombre.toLowerCase().includes(term) || 
            String(p.codigo).toLowerCase().includes(term)
        );
        renderGrid(filtered);
    });
});

async function callApi(action, payload = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: action,
                auth: API_KEY,
                payload: payload
            })
        });
        
        const result = await response.json();
        document.getElementById('connection-status').className = 'status-dot bg-success';
        return result;

    } catch (error) {
        console.error("Error API:", error);
        document.getElementById('connection-status').className = 'status-dot bg-danger';
        document.getElementById('catalog-grid').innerHTML = '<div class="col-12 text-center text-danger mt-5"><i class="bi bi-wifi-off fs-1"></i><p>Error de conexión con el Servidor.</p></div>';
        return { success: false, error: error.message };
    }
}

async function fetchCatalog() {
    const res = await callApi('getAdminCatalog');
    if (res.success) {
        catalog = res.data;
        renderGrid(catalog);
    }
}

function renderGrid(data) {
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';
    
    if(data.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center mt-5">
                <i class="bi bi-box-seam text-secondary" style="font-size: 3rem;"></i>
                <p class="text-muted">La base de datos está vacía.</p>
                <button class="btn btn-outline-cyan btn-sm" onclick="openProductModal()">
                    <i class="bi bi-plus-lg"></i> Crear primer ítem
                </button>
            </div>`;
        return;
    }

    data.forEach(p => {
        const isService = p.tipo === 'SERVICIO';
        const webStatus = p.visibleWeb ? '<span class="text-success small">● WEB ON</span>' : '<span class="text-secondary small">● WEB OFF</span>';
        
        const imgHtml = p.imagen ? `<div style="height:140px; overflow:hidden; border-radius:4px; margin-bottom:10px; background:#000;"><img src="${p.imagen}" style="width:100%; height:100%; object-fit:cover;"></div>` : '';

        // Mostramos el Código generado en la tarjeta
        const html = `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="product-card h-100 p-3 d-flex flex-column">
                <div class="d-flex justify-content-between mb-2">
                    <span class="badge ${isService ? 'bg-warning text-dark' : 'bg-info text-dark'}">${p.codigo || 'NEW'}</span>
                    ${webStatus}
                </div>
                ${imgHtml}
                <h6 class="text-white fw-bold mb-1">${p.nombre}</h6>
                <small class="text-secondary mb-3 text-truncate">${p.specs || '---'}</small>
                
                <div class="mt-auto d-flex justify-content-between align-items-end">
                    <div>
                        <small class="text-muted" style="font-size:0.7rem">VENTA</small>
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
    document.getElementById('p-codigo').value = "Autogenerado"; // Visual feedback
    new bootstrap.Modal(document.getElementById('prodModal')).show();
}

function loadEditModal(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    if (!p) return;

    document.getElementById('p-uuid').value = p.uuid;
    document.getElementById('p-tipo').value = p.tipo;
    // Cargar Categoría y Código
    document.getElementById('p-categoria').value = p.categoria || "AUTOMATIZACION_APPS";
    document.getElementById('p-codigo').value = p.codigo;
    
    document.getElementById('p-nombre').value = p.nombre;
    document.getElementById('p-specs').value = p.specs;
    document.getElementById('p-costo').value = p.costo;
    document.getElementById('p-precio').value = p.precio;
    document.getElementById('p-web').checked = p.visibleWeb;
    
    document.getElementById('p-imagen-data').value = p.imagen; 
    document.getElementById('p-imagen-file').value = ""; 
    
    new bootstrap.Modal(document.getElementById('prodModal')).show();
}

async function saveProduct() {
    const btn = document.querySelector('#prodModal .btn-cyan');
    btn.disabled = true; btn.innerText = "PROCESANDO...";

    const fileInput = document.getElementById('p-imagen-file');
    let finalImage = document.getElementById('p-imagen-data').value; 

    if (fileInput.files.length > 0) {
        try {
            btn.innerText = "SUBIENDO FOTO...";
            finalImage = await toBase64(fileInput.files[0]);
        } catch (e) {
            alert("Error al procesar la imagen: " + e);
            btn.disabled = false; btn.innerText = "GUARDAR DATOS";
            return;
        }
    }

    const payload = {
        uuid: document.getElementById('p-uuid').value,
        tipo: document.getElementById('p-tipo').value,
        categoria: document.getElementById('p-categoria').value, // NUEVO CAMPO ENVIADO
        codigo: document.getElementById('p-codigo').value, // Se envía (vacío si es nuevo)
        nombre: document.getElementById('p-nombre').value,
        specs: document.getElementById('p-specs').value,
        costo: Number(document.getElementById('p-costo').value),
        precio: Number(document.getElementById('p-precio').value),
        iva: 19, 
        imagen: finalImage, 
        visibleWeb: document.getElementById('p-web').checked
    };

    const res = await callApi('upsertProduct', payload);
    btn.disabled = false; btn.innerText = "GUARDAR DATOS";

    if (res.success) {
        bootstrap.Modal.getInstance(document.getElementById('prodModal')).hide();
        fetchCatalog(); 
    } else {
        alert("Error al guardar: " + res.error);
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
    let total = 0;

    cart.forEach((item, i) => {
        total += (item.precio * item.cantidad);
        container.innerHTML += `
            <div class="d-flex justify-content-between align-items-center border-bottom border-secondary py-2">
                <div class="text-white small">
                    <strong>${item.nombre}</strong><br>
                    ${fmt.format(item.precio)} x ${item.cantidad}
                </div>
                <button class="btn btn-sm text-danger" onclick="cart.splice(${i},1);updateCartUI()"><i class="bi bi-trash"></i></button>
            </div>
        `;
    });
    document.getElementById('cart-total').innerText = fmt.format(total);
}

function openCart() {
    new bootstrap.Modal(document.getElementById('cartModal')).show();
}

async function generatePDF() {
    const cliente = {
        nombre: document.getElementById('c-nombre').value,
        nit: document.getElementById('c-nit').value,
        telefono: document.getElementById('c-tel').value
    };

    if(!cliente.nombre || cart.length === 0) return alert("Falta Cliente o Items");

    const btn = document.querySelector('#cartModal .btn-success');
    btn.disabled = true; btn.innerHTML = "GENERANDO...";

    let sub = 0;
    cart.forEach(c => sub += (c.precio * c.cantidad));
    const iva = sub * 0.19; 

    const payload = {
        tipoDoc: document.getElementById('doc-type').value,
        cliente: cliente,
        items: cart.map(c => ({...c, subtotal: c.precio * c.cantidad})),
        totales: { subtotal: sub, iva: iva, granTotal: sub + iva }
    };

    const res = await callApi('createDocument', payload);
    
    btn.disabled = false; btn.innerHTML = "GENERAR PDF";
    
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
