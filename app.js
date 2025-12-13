// --- CONFIGURACIÓN ---
const API_URL = "https://script.google.com/macros/s/AKfycbw1Ybr3bX_uJj-NHp9pTCe90EIaRLuNwCnwaJ-7cpdQEdA2VMbiGXxfvzlTImp8pts_6w/exec"; 

// --- CONFIGURACIÓN ---
const API_URL = "PEGAR_AQUI_TU_URL_DE_APPS_SCRIPT"; 

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
        document.getElementById('product-grid').innerHTML = `<p class="text-danger text-center">Error de conexión. Verifica tu internet y la URL del Script.</p>`;
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
        const imgHtml = prod.imagen 
            ? `<img src="${prod.imagen}" alt="${prod.nombre}">` 
            : `<i class="bi bi-box-seam no-image-placeholder"></i>`;

        // OJO: Usamos encodeURIComponent para pasar strings seguros en el onclick
        const prodDataSafe = encodeURIComponent(JSON.stringify(prod));

        const html = `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="card product-card h-100">
                     <div class="position-absolute top-0 end-0 p-2 z-2">
                        <button class="btn btn-sm btn-light rounded-circle shadow-sm" style="width:30px; height:30px; padding:0;" onclick="openEditProductModal('${prodDataSafe}')">
                            <i class="bi bi-pencil-fill text-warning" style="font-size: 0.8rem;"></i>
                        </button>
                    </div>

                    <div class="card-img-top-wrapper border-bottom" onclick="addToCart('${prod.nombre}')">
                        ${imgHtml}
                    </div>
                    <div class="card-body p-2 d-flex flex-column" onclick="addToCart('${prod.nombre}')">
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

// --- LÓGICA DE EDICIÓN DE PRODUCTO (CRUD) ---
function openEditProductModal(prodDataEncoded) {
    const prod = JSON.parse(decodeURIComponent(prodDataEncoded));
    
    document.getElementById('edit-original-name').value = prod.nombre;
    document.getElementById('edit-name').value = prod.nombre;
    document.getElementById('edit-specs').value = prod.specs;
    document.getElementById('edit-price').value = prod.precio;
    document.getElementById('edit-image').value = prod.imagen || "";

    new bootstrap.Modal(document.getElementById('editProductModal')).show();
}

async function saveProductChanges() {
    const originalName = document.getElementById('edit-original-name').value;
    const name = document.getElementById('edit-name').value.trim();
    const specs = document.getElementById('edit-specs').value.trim();
    const price = parseFloat(document.getElementById('edit-price').value);
    const image = document.getElementById('edit-image').value.trim();

    if (!name || isNaN(price)) {
        alert("Nombre y precio son obligatorios.");
        return;
    }

    const spinner = document.getElementById('edit-loading-msg');
    spinner.classList.remove('d-none');

    const payload = {
        action: 'updateProduct',
        payload: {
            originalName: originalName,
            nombre: name,
            specs: specs,
            precio: price,
            imagen: image
        }
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.success) {
            alert("Producto actualizado correctamente.");
            bootstrap.Modal.getInstance(document.getElementById('editProductModal')).hide();
            await loadCatalog(); // Recarga inmediata
        } else {
            alert("Error: " + result.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e);
    } finally {
        spinner.classList.add('d-none');
    }
}


// --- LÓGICA DEL CARRITO ---
function addToCart(productName) {
    const product = catalog.find(p => p.nombre === productName);
    // Clonamos para independencia total en el carrito
    cart.push({ ...product, cantidad: 1 });
    updateCartUI();
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
        
        // Renderizado de imagen miniatura en carrito
        const thumbHtml = item.imagen 
            ? `<img src="${item.imagen}" class="rounded" style="width:40px; height:40px; object-fit:cover; cursor:pointer;" onclick="updateCartImage(${index})">`
            : `<div class="bg-light rounded d-flex align-items-center justify-content-center" style="width:40px; height:40px; cursor:pointer;" onclick="updateCartImage(${index})"><i class="bi bi-camera text-muted"></i></div>`;

        container.innerHTML += `
            <div class="d-flex flex-column mb-3 border-bottom pb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="d-flex" style="flex: 1; margin-right: 10px;">
                        ${thumbHtml}
                        <div class="ms-2">
                            <h6 class="mb-0 fw-bold text-truncate" style="max-width: 150px;">${item.nombre}</h6>
                            <small class="text-primary" style="font-size:0.75rem;">Clic en foto para editar</small>
                        </div>
                    </div>
                    
                    <div class="d-flex align-items-center bg-light rounded px-2" style="height: 32px;">
                        <i class="bi bi-dash-circle text-muted" style="cursor:pointer;" onclick="changeQty(${index}, -1)"></i>
                        <input type="text" class="quantity-control mx-1" value="${item.cantidad}" readonly style="width:25px; text-align:center; border:none; background:transparent;">
                        <i class="bi bi-plus-circle text-primary" style="cursor:pointer;" onclick="changeQty(${index}, 1)"></i>
                    </div>
                </div>
                
                <div class="mt-2">
                     <textarea class="form-control form-control-sm" rows="2" placeholder="Descripción / Detalles..." onchange="updateCartSpecs(this, ${index})">${item.specs || ''}</textarea>
                </div>

                <div class="mt-2 d-flex align-items-center justify-content-end">
                    <span class="small me-2 text-muted">Unitario:</span>
                    <input type="number" 
                           class="form-control form-control-sm" 
                           value="${item.precio}" 
                           onchange="updateCartPrice(this, ${index})" 
                           style="width: 120px;">
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

// FUNCIONES DE EDICIÓN EN CARRITO
function updateCartPrice(input, index) {
    const newPrice = parseFloat(input.value);
    if(isNaN(newPrice) || newPrice < 0) {
        alert("Precio inválido");
        input.value = cart[index].precio; 
        return;
    }
    cart[index].precio = newPrice;
    renderCart();
}

function updateCartSpecs(textarea, index) {
    cart[index].specs = textarea.value;
}

function updateCartImage(index) {
    const currentUrl = cart[index].imagen || "";
    const newUrl = prompt("Ingresa la URL de la imagen para este producto:", currentUrl);
    
    if (newUrl !== null) {
        cart[index].imagen = newUrl.trim();
        renderCart();
    }
}

// --- LÓGICA DE ITEM MANUAL ---
function openManualItemModal() {
    new bootstrap.Modal(document.getElementById('manualItemModal')).show();
}

function addManualItem() {
    const nameInput = document.getElementById('manual-name');
    const specsInput = document.getElementById('manual-specs');
    const priceInput = document.getElementById('manual-price');
    const imgInput = document.getElementById('manual-image');

    const name = nameInput.value.trim();
    const specs = specsInput.value.trim();
    const price = parseFloat(priceInput.value);
    const img = imgInput.value.trim();

    if (!name || isNaN(price)) {
        alert("El Nombre y el Precio son obligatorios.");
        return;
    }

    const newItem = {
        nombre: name,
        precio: price,
        specs: specs,
        cantidad: 1,
        imagen: img || null 
    };

    cart.push(newItem);
    
    nameInput.value = '';
    specsInput.value = '';
    priceInput.value = '';
    imgInput.value = '';
    
    bootstrap.Modal.getInstance(document.getElementById('manualItemModal')).hide();
    updateCartUI();
    
    alert("¡Item agregado! Recuerda: Se guardará en tu catálogo cuando generes el documento.");
}

// --- PROCESAR PEDIDO ---
async function processOrder(mode) {
    const name = document.getElementById('client-name').value.trim();
    
    if (!name || cart.length === 0) {
        alert("Error: El carrito está vacío o falta el nombre del cliente.");
        return;
    }

    const loading = document.getElementById('loading-msg');
    loading.classList.remove('d-none');
    
    const docType = document.getElementById('doc-type').value; 
    const includeTax = document.getElementById('tax-toggle').checked;
    
    const subtotal = cart.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    const tax = includeTax ? subtotal * 0.19 : 0;
    const granTotal = subtotal + tax;

    const orderData = {
        action: 'createDocument', 
        payload: {
            tipoDocumento: docType,
            cliente: {
                nombre: name,
                nit: document.getElementById('client-nit').value || "",
                telefono: document.getElementById('client-phone').value || ""
            },
            items: cart.map(i => ({
                nombre: i.nombre,
                cantidad: i.cantidad,
                precio: i.precio,
                specs: i.specs || "",
                imagen: i.imagen || "",
                subtotal: i.cantidad * i.precio
            })),
            totales: {
                subtotal: subtotal,
                iva: tax,
                granTotal: granTotal
            }
        }
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();

        if (result.success) {
            cart = [];
            updateCartUI();
            bootstrap.Modal.getInstance(document.getElementById('cartModal')).hide();
            
            // RECARGA INMEDIATA (Auto-aprendizaje visual)
            await loadCatalog();
            // ---------------------------------------------

            if (mode === 'whatsapp') {
                const emoji = docType === 'Cuenta de Cobro' ? '✅' : '📄';
                const msg = `Hola *${name}*, ${emoji} adjunto tu *${docType}* N° *${result.consecutivo}*.\n\nPuedes descargarla aquí:\n${result.pdfUrl}`;
                const wsUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                window.open(wsUrl, '_blank');
            } else {
                const confirmMsg = `¡${docType} ${result.consecutivo} generado!\n\nSe ha actualizado el catálogo con los productos nuevos.\n\n¿Abrir PDF?`;
                if(confirm(confirmMsg)) {
                    window.open(result.pdfUrl, '_blank');
                }
            }
        } else {
            alert("Error del servidor: " + result.error);
        }

    } catch (e) {
        console.error(e);
        alert("Error de conexión. Revisa que la URL del Script sea correcta.");
    } finally {
        loading.classList.add('d-none');
    }
}

function formatCurrency(num) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
}
