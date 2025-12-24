// --- CONFIGURACIÓN DE CONEXIÓN ---
const API_URL = "https://script.google.com/macros/s/AKfycbzxdto8_T2I0KlH0sSs78MOG2GtYcQNzwBKS4XkuR3rKmogT9Kqql3_D918VYhO6sX4xg/exec"; 
const API_KEY = "AST_2025_SECURE"; // Debe coincidir con la del backend

let catalog = [];
let cart = [];
const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    fetchCatalog();
    
    // Filtro de búsqueda
    document.getElementById('search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = catalog.filter(p => 
            p.nombre.toLowerCase().includes(term) || 
            String(p.codigo).toLowerCase().includes(term)
        );
        renderGrid(filtered);
    });
});

// --- COMUNICACIÓN CON GOOGLE (CORE) ---
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
        alert("Error de conexión con el servidor A.S.T.");
        return { success: false };
    }
}

// --- LÓGICA DE NEGOCIO ---
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
        grid.innerHTML = '<p class="text-center text-muted">No se encontraron registros.</p>';
        return;
    }

    data.forEach(p => {
        const isService = p.tipo === 'SERVICIO';
        const webStatus = p.visibleWeb ? '<span class="text-success small">● WEB ON</span>' : '<span class="text-secondary small">● WEB OFF</span>';
        
        const html = `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="product-card h-100 p-3 d-flex flex-column">
                <div class="d-flex justify-content-between mb-2">
                    <span class="badge ${isService ? 'bg-warning text-dark' : 'bg-info text-dark'}">${p.tipo}</span>
                    ${webStatus}
                </div>
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

// --- CRUD PRODUCTOS ---
function openProductModal() {
    document.getElementById('prodForm').reset();
    document.getElementById('p-uuid').value = "";
    new bootstrap.Modal(document.getElementById('prodModal')).show();
}

function loadEditModal(uuid) {
    const p = catalog.find(x => x.uuid === uuid);
    if (!p) return;

    document.getElementById('p-uuid').value = p.uuid;
    document.getElementById('p-tipo').value = p.tipo;
    document.getElementById('p-codigo').value = p.codigo;
    document.getElementById('p-nombre').value = p.nombre;
    document.getElementById('p-specs').value = p.specs;
    document.getElementById('p-costo').value = p.costo;
    document.getElementById('p-precio').value = p.precio;
    document.getElementById('p-web').checked = p.visibleWeb;
    document.getElementById('p-imagen').value = p.imagen;
    
    new bootstrap.Modal(document.getElementById('prodModal')).show();
}

async function saveProduct() {
    const btn = document.querySelector('#prodModal .btn-cyan');
    btn.disabled = true; btn.innerText = "GUARDANDO...";

    const payload = {
        uuid: document.getElementById('p-uuid').value,
        tipo: document.getElementById('p-tipo').value,
        codigo: document.getElementById('p-codigo').value,
        nombre: document.getElementById('p-nombre').value,
        specs: document.getElementById('p-specs').value,
        costo: Number(document.getElementById('p-costo').value),
        precio: Number(document.getElementById('p-precio').value),
        iva: 19, 
        imagen: document.getElementById('p-imagen').value,
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

// --- CARRITO Y PDF ---
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
