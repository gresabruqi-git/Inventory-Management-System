

let allProducts = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();
  setupFilters();
  setupProductModal();
});

async function loadProducts() {
  const tbody = document.getElementById("products-table-body");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-muted">Loading products…</td></tr>';

  let products;
  let categories;
  let suppliers;
  try {
    [products, categories, suppliers] = await Promise.all([
      apiClient.getProducts(),
      apiClient.getCategories(),
      apiClient.getSuppliers(),
    ]);
  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-muted">Failed to load products from the server.</td></tr>';
    return;
  }

  const categoryMap = new Map((categories || []).map((c) => [c.id, c.name]));
  const supplierMap = new Map((suppliers || []).map((s) => [s.id, s.name]));

  allProducts = (products || []).map((p) => ({
    ...p,
    categoryName: p.category_id ? (categoryMap.get(p.category_id) || "—") : "—",
    supplierName: p.supplier_id ? (supplierMap.get(p.supplier_id) || "—") : "—"
  }));

  renderProducts(allProducts);
}

function setupFilters() {
  const searchInput = document.getElementById("product-search");
  const statusSelect = document.getElementById("product-status-filter");

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }
  if (statusSelect) {
    statusSelect.addEventListener("change", applyFilters);
  }
}

function applyFilters() {
  const searchValue = (document.getElementById("product-search")?.value || "")
    .toLowerCase()
    .trim();
  const statusValue =
    document.getElementById("product-status-filter")?.value || "ALL";

  const filtered = allProducts.filter((p) => {
    const textMatch =
      p.name.toLowerCase().includes(searchValue);

    const status = computeStatus(p);

    const statusMatch =
      statusValue === "ALL" ? true : status === statusValue;

    return textMatch && statusMatch;
  });

  renderProducts(filtered);
}

function setupProductModal() {
  const backdrop = document.getElementById("product-modal-backdrop");
  const openBtn = document.getElementById("btn-new-product");
  const closeBtn = document.getElementById("product-modal-close");
  const cancelBtn = document.getElementById("product-modal-cancel");
  const saveBtn = document.getElementById("product-modal-save");

  if (!backdrop || !openBtn) return;

  openBtn.addEventListener("click", () => {
    resetProductModal();
    backdrop.classList.add("modal-backdrop--visible");
    loadModalOptions();
  });

  const close = () => {
    backdrop.classList.remove("modal-backdrop--visible");
  };

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      await saveNewProduct();
    });
  }
}

function resetProductModal() {
  document.getElementById("modal-product-name").value = "";
  document.getElementById("modal-product-price").value = "";
  document.getElementById("modal-product-quantity").value = "";
  document.getElementById("modal-product-min").value = "";
  document.getElementById("product-modal-message").textContent = "";
  document
    .getElementById("product-modal-message")
    .classList.remove("auth-message--error", "auth-message--success");
}

async function loadModalOptions() {
  const categorySelect = document.getElementById("modal-product-category");
  const supplierSelect = document.getElementById("modal-product-supplier");

  if (categorySelect) {
    try {
      const categories = await apiClient.getCategories();
      const sorted = [...(categories || [])].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      );
      categorySelect.innerHTML =
        '<option value="">Select category</option>' +
        sorted.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    } catch (e) {
      console.error(e);
    }
  }

  if (supplierSelect) {
    try {
      const suppliers = await apiClient.getSuppliers();
      const sorted = [...(suppliers || [])].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      );
      supplierSelect.innerHTML =
        '<option value="">Select supplier</option>' +
        sorted.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
    } catch (e) {
      console.error(e);
    }
  }
}

async function saveNewProduct() {
  const name = document.getElementById("modal-product-name").value.trim();
  const categoryId = document.getElementById("modal-product-category").value;
  const supplierId = document.getElementById("modal-product-supplier").value;
  const priceValue = document.getElementById("modal-product-price").value;
  const qtyValue = document.getElementById("modal-product-quantity").value;
  const minValue = document.getElementById("modal-product-min").value;
  const messageEl = document.getElementById("product-modal-message");

  messageEl.textContent = "";
  messageEl.classList.remove("auth-message--error", "auth-message--success");

  if (!name) {
    messageEl.textContent = "Please enter a product name.";
    messageEl.classList.add("auth-message--error");
    return;
  }

  const price = Number(priceValue || 0);
  const quantity = Number(qtyValue || 0);
  const minStock = Number(minValue || 0);

  if (price < 0 || quantity < 0 || minStock < 0) {
    messageEl.textContent = "Price, quantity and minimum level must be ≥ 0.";
    messageEl.classList.add("auth-message--error");
    return;
  }

  try {
    await apiClient.createProduct({
      name,
      category_id: categoryId || null,
      supplier_id: supplierId || null,
      price,
      quantity,
      min_stock_level: minStock,
    });
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.message || "Failed to save product.";
    messageEl.classList.add("auth-message--error");
    return;
  }

  messageEl.textContent = "Product created successfully.";
  messageEl.classList.add("auth-message--success");

  await loadProducts();

  setTimeout(() => {
    const backdrop = document.getElementById("product-modal-backdrop");
    if (backdrop) backdrop.classList.remove("modal-backdrop--visible");
  }, 700);
}
function computeStatus(product) {
  const qty = product.quantity ?? 0;
  const min = product.min_stock_level ?? 0;

  if (qty <= 0) return "OUT_OF_STOCK";
  if (qty <= min) return "LOW_STOCK";
  return "IN_STOCK";
}

function renderStatusBadge(status) {
  switch (status) {
    case "OUT_OF_STOCK":
      return '<span class="badge badge--danger">Out of stock</span>';
    case "LOW_STOCK":
      return '<span class="badge badge--warning">Low stock</span>';
    default:
      return '<span class="badge badge--success">In stock</span>';
  }
}

function formatMoney(value) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,//dy nr 
  }).format(Number(value));
}

function renderProducts(products) {
  const tbody = document.getElementById("products-table-body");
  if (!tbody) return;

  if (!products.length) {
    const searchValue =
      (document.getElementById("product-search")?.value || "")
        .toLowerCase()
        .trim();

    if (searchValue) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted">No products found for "<strong>${escapeHtml(
        searchValue
      )}</strong>".</td></tr>`;
    } else {
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-muted">No products found.</td></tr>';
    }
    return;
  }

  tbody.innerHTML = "";

  products.forEach((p) => {
    const tr = document.createElement("tr");
    const productName =
      (p.name && String(p.name).trim().length > 0)
        ? escapeHtml(p.name)
        : "(Unnamed product)";
    
    const categoryName = p.categoryName || "—";
    const supplierName = p.supplierName || "—";
    const status = computeStatus(p);
    const qty = p.quantity ?? 0;
    const stockValue = (p.price ?? 0) * qty;

    tr.innerHTML = `
      <td>${productName}</td>
      <td class="text-muted">${escapeHtml(categoryName)}</td>
      <td class="text-muted">${escapeHtml(supplierName)}</td>
      <td class="text-right">${formatMoney(p.price)}</td>
      <td class="text-right">${qty}</td>
      <td class="text-right">${p.min_stock_level ?? 0}</td>
      <td class="text-right">${formatMoney(stockValue)}</td>
      <td>${renderStatusBadge(status)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  if (str == null || str === "") return "";
  return String(str).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}



