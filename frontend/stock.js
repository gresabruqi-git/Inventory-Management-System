

let allTransactions = [];
let allProducts = [];
let currentMovementType = "IN"; // mundet"IN" ose "OUT"
let productQuantityMap = new Map(); 

document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();
  await loadStockTransactions();
  setupFilters();
  setupStockModal();
  
  // Set default date range to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  document.getElementById("stock-date-from").value = thirtyDaysAgo.toISOString().split('T')[0];
  document.getElementById("stock-date-to").value = today.toISOString().split('T')[0];
});

async function loadProducts() {
  try {
    const products = await apiClient.getProducts();
    if (products) {
      allProducts = [...products].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      );
      productQuantityMap.clear();
      allProducts.forEach((p) => {
        const id = Number(p.id);
        productQuantityMap.set(id, Number(p.quantity) || 0);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadStockTransactions() {
  const tbody = document.getElementById("stock-transactions-table-body");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Loading stock transactions…</td></tr>';

  let transactions;
  try {
    transactions = await apiClient.getStockTransactions();
  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-muted">Failed to load stock transactions from the server.</td></tr>';
    return;
  }

  allTransactions = transactions || [];
  applyFilters();
}

function setupFilters() {
  const dateFrom = document.getElementById("stock-date-from");
  const dateTo = document.getElementById("stock-date-to");
  const typeFilter = document.getElementById("stock-movement-type-filter");
  const productSearch = document.getElementById("stock-product-search");

  if (dateFrom) dateFrom.addEventListener("change", applyFilters);
  if (dateTo) dateTo.addEventListener("change", applyFilters);
  if (typeFilter) typeFilter.addEventListener("change", applyFilters);
  if (productSearch) productSearch.addEventListener("input", applyFilters);
}

function applyFilters() {
  const dateFrom = document.getElementById("stock-date-from")?.value;
  const dateTo = document.getElementById("stock-date-to")?.value;
  const typeValue = document.getElementById("stock-movement-type-filter")?.value || "ALL";
  const searchValue = (document.getElementById("stock-product-search")?.value || "")
    .toLowerCase()
    .trim();

  let filtered = allTransactions.filter(tx => {
    // Date filter
    if (dateFrom || dateTo) {
      const txDate = new Date(tx.occurred_at).toISOString().split('T')[0];//data e transaction 
      if (dateFrom && txDate < dateFrom) return false;
      if (dateTo && txDate > dateTo) return false;
    }

    // Type filter
    if (typeValue !== "ALL" && tx.movement_type !== typeValue) return false;

    // Product search
    if (searchValue) {
      const productName = tx.products?.name || "";
      if (!productName.toLowerCase().includes(searchValue)) return false;
    }

    return true;
  });

  renderTransactions(filtered);
}

function setupStockModal() {
  const backdrop = document.getElementById("stock-modal-backdrop");
  const stockInBtn = document.getElementById("btn-stock-in");
  const stockOutBtn = document.getElementById("btn-stock-out");
  const closeBtn = document.getElementById("stock-modal-close");
  const cancelBtn = document.getElementById("stock-modal-cancel");
  const saveBtn = document.getElementById("stock-modal-save");
  const productSelect = document.getElementById("modal-stock-product");

  if (!backdrop) return;

  // Stock In button
  if (stockInBtn) {
    stockInBtn.addEventListener("click", () => {
      currentMovementType = "IN";
      resetStockModal();
      document.getElementById("stock-modal-title").textContent = "Stock In";
      backdrop.classList.add("modal-backdrop--visible");
      loadProductOptions();
    });
  }

  // Stock Out button
  if (stockOutBtn) {
    stockOutBtn.addEventListener("click", () => {
      currentMovementType = "OUT";
      resetStockModal();
      document.getElementById("stock-modal-title").textContent = "Stock Out";
      backdrop.classList.add("modal-backdrop--visible");
      loadProductOptions();
    });
  }

  // QUANTITY E TAHSME 
  if (productSelect) {
    productSelect.addEventListener("change", (e) => {
      const pid = Number(e.target.value);
      if (pid) {
        const qty = productQuantityMap.get(pid) || 0;
        const qtyEl = document.getElementById("modal-stock-current-qty");
        if (qtyEl) {
          qtyEl.textContent = `Current stock: ${qty} units`;//SA UNITS KA
          if (currentMovementType === "OUT" && qty === 0) {
            qtyEl.style.color = "#f87171";
            qtyEl.textContent += " (Out of stock!)";
          } else {
            qtyEl.style.color = "#9ca3af";
          }
        }
      } else {
        const qtyEl = document.getElementById("modal-stock-current-qty");
        if (qtyEl) qtyEl.textContent = "";
      }
    });
  }

  const close = () => {
    backdrop.classList.remove("modal-backdrop--visible");
  };

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      await saveStockMovement();
    });
  }
}

function resetStockModal() {
  document.getElementById("modal-stock-product").value = "";
  document.getElementById("modal-stock-quantity").value = "";
  document.getElementById("modal-stock-reason").value = "";
  document.getElementById("modal-stock-current-qty").textContent = "";
  
  // Set default date to now
  const now = new Date();
  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  document.getElementById("modal-stock-date").value = localDateTime;
  
  document.getElementById("stock-modal-message").textContent = "";
  document
    .getElementById("stock-modal-message")
    .classList.remove("auth-message--error", "auth-message--success");
}
//krijon dropdown list per userin
function loadProductOptions() {
  const select = document.getElementById("modal-stock-product");
  if (!select) return;

  select.innerHTML = '<option value="">Select a product</option>';
  allProducts.forEach(product => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = product.name;
    select.appendChild(option);
  });
}

async function saveStockMovement() {
  const pid = Number(document.getElementById("modal-stock-product").value);
  const quantityValue = document.getElementById("modal-stock-quantity").value;
  const reason = document.getElementById("modal-stock-reason").value;
  const dateValue = document.getElementById("modal-stock-date").value;
  const messageEl = document.getElementById("stock-modal-message");

  messageEl.textContent = "";
  messageEl.classList.remove("auth-message--error", "auth-message--success");

  if (!pid) {
    messageEl.textContent = "Please select a product.";
    messageEl.classList.add("auth-message--error");
    return;
  }

  const quantity = parseInt(quantityValue, 10);
  if (!quantity || quantity <= 0) {
    messageEl.textContent = "Please enter a valid quantity (greater than 0).";
    messageEl.classList.add("auth-message--error");
    return;
  }

  // For Stock Out, validate available quantity
  if (currentMovementType === "OUT") {
    const currentQty = productQuantityMap.get(pid) || 0;
    if (quantity > currentQty) {
      messageEl.textContent = `Not enough stock. Available: ${currentQty} units.`;
      messageEl.classList.add("auth-message--error");
      return;
    }
  }
//stoku aktual +in ose -out
  try {
    const occurredAt = dateValue
      ? new Date(dateValue).toISOString()
      : new Date().toISOString();

    await apiClient.createStockTransaction({
      product_id: pid,
      movement_type: currentMovementType,
      quantity,
      reason: reason?.trim() || null,
      occurred_at: occurredAt,
    });

    messageEl.textContent = `Stock ${currentMovementType === "IN" ? "added" : "removed"} successfully.`;
    messageEl.classList.add("auth-message--success");

    await loadProducts();
    await loadStockTransactions();

    setTimeout(() => {
      const backdrop = document.getElementById("stock-modal-backdrop");
      if (backdrop) backdrop.classList.remove("modal-backdrop--visible");
    }, 700);
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.message || "Failed to record stock movement.";
    messageEl.classList.add("auth-message--error");
  }
}

function formatDateTime(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderTransactions(transactions) {
  const tbody = document.getElementById("stock-transactions-table-body");
  if (!tbody) return;

  if (!transactions.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-muted">No stock transactions found for the selected filters.</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  transactions.forEach(tx => {
    const tr = document.createElement("tr");
    const productName = tx.products?.name || "(Unknown product)";
    const movementType = tx.movement_type;
    const typeBadge = movementType === "IN"
      ? '<span class="badge badge--success">Stock In</span>'
      : '<span class="badge badge--danger">Stock Out</span>';
    const reason = tx.reason || "—";

    tr.innerHTML = `
      <td class="text-muted">${formatDateTime(tx.occurred_at)}</td>
      <td><strong style="color: #e5e7eb;">${escapeHtml(productName)}</strong></td>
      <td>${typeBadge}</td>
      <td class="text-right"><strong style="color: #e5e7eb;">${tx.quantity}</strong></td>
      <td class="text-muted">${escapeHtml(reason)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

