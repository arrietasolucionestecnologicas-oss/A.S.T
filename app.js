// --- CONFIGURACIÓN ---
const API_URL = "https://script.google.com/macros/s/AKfycbw1Ybr3bX_uJj-NHp9pTCe90EIaRLuNwCnwaJ-7cpdQEdA2VMbiGXxfvzlTImp8pts_6w/exec"; 

let catalog = [];
let cart = [];

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    loadCatalog();
    
    // Buscador
    document.getElementById('search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = catalog.filter(p => 
            p.nombre.toLowerCase().includes(term) || 
            String(p.specs).toLowerCase().includes(term)
        );
        renderCatalog(filtered);
    });
});

// --- LÓGICA DE CATÁLOGO ---
async function loadCatalog() {
    try {
        const response = await fetch(`${API_URL}?action=getCatalog`);
        const result = await response.json();
        
        if (result.success) {
            catalog = result.data;
            renderCatalog(catalog);
        } else {
            alert("Error cargando productos: " + result.error);
        }
    } catch (e) {
        console.error(e);
        document.getElementById('product-grid').innerHTML = `<p class="text-danger text-center">Error de conexión. Verifica tu internet.</p>`;
    }
}

function renderCatalog(products) {
    const container = document.getElementById('product-grid');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p class="text-center text-muted col-12">No hay productos que coincidan.</p>';
        return;
    }

    products.forEach(prod => {
        // Manejo de imagen o placeholder
        const imgHtml = prod.imagen 
            ? `<img src="${prod.imagen}" alt="${prod.nombre}">` 
            : `<i class="bi bi-box-seam no-image-placeholder"></i>`;

        const html = `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="card product-card h-100" onclick="addToCart('${prod.nombre}')">
                    <div class="card-img-top-wrapper border-bottom">
                        ${imgHtml}
                    </div>
                    <div class="card-body p-2 d-flex flex-column">
                        <h6 class="card-title text-truncate mb-1" style="font-size: 0.9rem;">${prod.nombre}</h6>
                        <small class="text-muted mb-2 d-none d-sm-block text-truncate">${prod.specs}</small>
                        <div class="mt-auto d-flex justify-content-between align-items-center">
                            <span class="price-tag">${formatCurrency(prod.precio)}</span>
                            <button class="btn btn-sm btn-outline-primary rounded-circle">
                                <i class="bi bi-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- LÓGICA DEL CARRITO ---
function addToCart(productName) {
    const product = catalog.find(p => p.nombre === productName);
    const existing = cart.find(item => item.nombre === productName);

    if (existing) {
        existing.cantidad++;
    } else {
        cart.push({ ...product, cantidad: 1 });
    }
    updateCartUI();
    
    // Feedback visual pequeño
    const btn = event.currentTarget.querySelector('.btn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check"></i>';
    btn.classList.replace('btn-outline-primary', 'btn-success');
    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.classList.replace('btn-success', 'btn-outline-primary');
    }, 800);
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('cart-count').innerText = count;
}

function openCart() {
    renderCart();
    new bootstrap.Modal(document.getElementById('cartModal')).show();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    
    let subtotal = 0;
    const includeTax = document.getElementById('tax-toggle').checked;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Tu carrito está vacío.</p>';
    }

    cart.forEach((item, index) => {
        subtotal += item.precio * item.cantidad;
        container.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <div style="flex: 1;">
                    <h6 class="mb-0 text-truncate" style="max-width: 180px;">${item.nombre}</h6>
                    <small class="text-primary">${formatCurrency(item.precio)}</small>
                </div>
                <div class="d-flex align-items-center bg-light rounded px-2">
                    <i class="bi bi-dash-circle text-muted" style="cursor:pointer;" onclick="changeQty(${index}, -1)"></i>
                    <input type="text" class="quantity-control" value="${item.cantidad}" readonly>
                    <i class="bi bi-plus-circle text-primary" style="cursor:pointer;" onclick="changeQty(${index}, 1)"></i>
                </div>
            </div>
        `;
    });

    const tax = includeTax ? subtotal * 0.19 : 0;
    const total = subtotal + tax;

    document.getElementById('cart-subtotal').innerText = formatCurrency(subtotal);
    document.getElementById('cart-tax').innerText = formatCurrency(tax);
    document.getElementById('cart-total').innerText = formatCurrency(total);
}

function changeQty(index, delta) {
    cart[index].cantidad += delta;
    if (cart[index].cantidad <= 0) cart.splice(index, 1);
    renderCart();
    updateCartUI();
}

// --- PROCESAR PEDIDO ---
async function processOrder() {
    const name = document.getElementById('client-name').value.trim();
    if (!name || cart.length === 0) {
        alert("Por favor agrega productos y escribe el nombre del cliente.");
        return;
    }

    const loading = document.getElementById('loading-msg');
    loading.classList.remove('d-none');
    
    const includeTax = document.getElementById('tax-toggle').checked;
    const subtotal = cart.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    const tax = includeTax ? subtotal * 0.19 : 0;

    const orderData = {
        action: 'createQuote',
        payload: {
            cliente: {
                nombre: name,
                nit: document.getElementById('client-nit').value,
                telefono: document.getElementById('client-phone').value
            },
            items: cart.map(i => ({
                nombre: i.nombre,
                cantidad: i.cantidad,
                precio: i.precio,
                specs: i.specs,
                subtotal: i.cantidad * i.precio
            })),
            totales: {
                subtotal: subtotal,
                iva: tax,
                granTotal: subtotal + tax
            }
        }
    };

    try {
        // Enviar al Backend (Google Apps Script)
        // Usamos mode: 'no-cors' si hay problemas, pero idealmente normal
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();

        if (result.success) {
            // Generar enlace WhatsApp
            const msg = `Hola *${name}*, te envío la cotización *${result.consecutivo}* generada electrónicamente.\n\nPuedes descargarla aquí:\n${result.pdfUrl}`;
            const wsUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
            
            // Limpiar y redirigir
            cart = [];
            updateCartUI();
            bootstrap.Modal.getInstance(document.getElementById('cartModal')).hide();
            window.open(wsUrl, '_blank');
        } else {
            alert("Error del servidor: " + result.error);
        }

    } catch (e) {
        console.error(e);
        alert("Error de conexión. Revisa la consola.");
    } finally {
        loading.classList.add('d-none');
    }
}

function formatCurrency(num) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
}
