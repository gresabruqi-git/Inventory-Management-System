// Sales management: Record sales and view sales history

let allSales = [];
let allProducts = [];
let productQuantityMap = new Map();
let productPriceMap = new Map();

let dailySalesChart = null;
let topProductsChart = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();
  await loadSales();
  setupFilters();
  setupSaleModal();
  setupSaleDetailsModal();
  setupExportCSV();
  updateSummaryCards();
  renderCharts();
  
  // Set default date range to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  document.getElementById("sales-date-from").value = thirtyDaysAgo.toISOString().split('T')[0];
  document.getElementById("sales-date-to").value = today.toISOString().split('T')[0];
});

async function loadProducts() {
  try {
    const products = await apiClient.getProducts();
    if (products) {
      allProducts = [...products].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      );
      productQuantityMap.clear();
      productPriceMap.clear();
      allProducts.forEach((p) => {
        const id = Number(p.id);
        productQuantityMap.set(id, Number(p.quantity) || 0);
        productPriceMap.set(id, Number(p.price) || 0);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadSales() {
  const tbody = document.getElementById("sales-table-body");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Loading sales…</td></tr>';

  let sales;
  try {
    sales = await apiClient.getSales();
  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-muted">Failed to load sales from the server.</td></tr>';
    return;
  }

  allSales = sales || [];
  applyFilters();
  updateSummaryCards();
  renderCharts();
}

function setupFilters() {
  const dateFrom = document.getElementById("sales-date-from");
  const dateTo = document.getElementById("sales-date-to");
  const productSearch = document.getElementById("sales-product-search");
  const filterToday = document.getElementById("filter-today");
  const filterWeek = document.getElementById("filter-week");
  const filterMonth = document.getElementById("filter-month");

  if (dateFrom) dateFrom.addEventListener("change", applyFilters);
  if (dateTo) dateTo.addEventListener("change", applyFilters);
  if (productSearch) productSearch.addEventListener("input", applyFilters);
  
  if (filterToday) {
    filterToday.addEventListener("click", () => {
      const today = new Date().toISOString().split('T')[0];
      document.getElementById("sales-date-from").value = today;
      document.getElementById("sales-date-to").value = today;
      applyFilters();
    });
  }
  
  if (filterWeek) {
    filterWeek.addEventListener("click", () => {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      document.getElementById("sales-date-from").value = weekAgo.toISOString().split('T')[0];
      document.getElementById("sales-date-to").value = today.toISOString().split('T')[0];
      applyFilters();
    });
  }
  
  if (filterMonth) {
    filterMonth.addEventListener("click", () => {
      const today = new Date();
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      document.getElementById("sales-date-from").value = monthAgo.toISOString().split('T')[0];
      document.getElementById("sales-date-to").value = today.toISOString().split('T')[0];
      applyFilters();
    });
  }
}

function applyFilters() {
  const dateFrom = document.getElementById("sales-date-from")?.value;
  const dateTo = document.getElementById("sales-date-to")?.value;
  const searchValue = (document.getElementById("sales-product-search")?.value || "")
    .toLowerCase()
    .trim();

  let filtered = allSales.filter(sale => {
    // Date filter
    if (dateFrom || dateTo) {
      const saleDate = new Date(sale.sale_date).toISOString().split('T')[0];
      if (dateFrom && saleDate < dateFrom) return false;
      if (dateTo && saleDate > dateTo) return false;
    }

    // Product search
    if (searchValue) {
      const productName = sale.products?.name || "";
      if (!productName.toLowerCase().includes(searchValue)) return false;
    }

    return true;
  });

  renderSales(filtered);
}

function updateSummaryCards() {
  const today = new Date().toISOString().split('T')[0];
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  // Today's sales
  const todaySales = allSales.filter(s => {
    const saleDate = new Date(s.sale_date).toISOString().split('T')[0];
    return saleDate === today;
  });
  const todayTotal = todaySales.reduce((sum, s) => sum + parseFloat(s.total_price || 0), 0);
  document.getElementById("kpi-today-sales").textContent = formatMoney(todayTotal);
  document.getElementById("kpi-today-count").textContent = `${todaySales.length} sales`;

  //month's sales
  const monthSales = allSales.filter(s => {
    const saleDate = new Date(s.sale_date).toISOString().split('T')[0];
    return saleDate >= startOfMonth;
  });
  const monthTotal = monthSales.reduce((sum, s) => sum + parseFloat(s.total_price || 0), 0);
  document.getElementById("kpi-month-sales").textContent = formatMoney(monthTotal);
  document.getElementById("kpi-month-count").textContent = `${monthSales.length} sales`;

  // Items sold this month
  const itemsSold = monthSales.reduce((sum, s) => sum + parseInt(s.quantity || 0), 0);
  document.getElementById("kpi-items-sold").textContent = itemsSold.toString();

  // Average sale
  const avgSale = monthSales.length > 0 ? monthTotal / monthSales.length : 0;
  document.getElementById("kpi-avg-sale").textContent = formatMoney(avgSale);
}

function setupSaleModal() {
  const backdrop = document.getElementById("sale-modal-backdrop");
  const openBtn = document.getElementById("btn-new-sale");
  const closeBtn = document.getElementById("sale-modal-close");
  const cancelBtn = document.getElementById("sale-modal-cancel");
  const saveBtn = document.getElementById("sale-modal-save");
  const productSelect = document.getElementById("modal-sale-product");
  const quantityInput = document.getElementById("modal-sale-quantity");
  const unitPriceInput = document.getElementById("modal-sale-unit-price");

  if (!backdrop || !openBtn) return;

  openBtn.addEventListener("click", () => {
    resetSaleModal();
    backdrop.classList.add("modal-backdrop--visible");
    loadProductOptions();
  });

  // Product selection - auto-fill price and show stock
  if (productSelect) {
    productSelect.addEventListener("change", (e) => {
      const pid = Number(e.target.value);
      if (pid) {
        const qty = productQuantityMap.get(pid) || 0;
        const price = productPriceMap.get(pid) || 0;
        unitPriceInput.value = price.toFixed(2);
        const infoEl = document.getElementById("modal-sale-product-info");
        if (infoEl) {
          infoEl.textContent = `Current stock: ${qty} units | Price: ${formatMoney(price)}`;
          if (qty === 0) {
            infoEl.style.color = "#f87171";
            infoEl.textContent += " (Out of stock!)";
          } else {
            infoEl.style.color = "#9ca3af";
          }
        }
        calculateTotal();
      } else {
        const infoEl = document.getElementById("modal-sale-product-info");
        if (infoEl) infoEl.textContent = "";
      }
    });
  }

  // Calculate total when quantity or unit price changes
  if (quantityInput) {
    quantityInput.addEventListener("input", calculateTotal);
  }
  if (unitPriceInput) {
    unitPriceInput.addEventListener("input", calculateTotal);
  }

  const close = () => {
    backdrop.classList.remove("modal-backdrop--visible");
  };

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      await saveSale();
    });
  }
}

function calculateTotal() {
  const quantity = parseFloat(document.getElementById("modal-sale-quantity").value || 0);
  const unitPrice = parseFloat(document.getElementById("modal-sale-unit-price").value || 0);
  const total = quantity * unitPrice;
  document.getElementById("modal-sale-total-price").value = formatMoney(total);
}

function resetSaleModal() {
  document.getElementById("modal-sale-product").value = "";
  document.getElementById("modal-sale-quantity").value = "";
  document.getElementById("modal-sale-unit-price").value = "";
  document.getElementById("modal-sale-total-price").value = "";
  document.getElementById("modal-sale-product-info").textContent = "";
  
  // Set default date to now
  const now = new Date();
  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  document.getElementById("modal-sale-date").value = localDateTime;
  
  document.getElementById("sale-modal-message").textContent = "";
  document
    .getElementById("sale-modal-message")
    .classList.remove("auth-message--error", "auth-message--success");
}

function loadProductOptions() {
  const select = document.getElementById("modal-sale-product");
  if (!select) return;

  select.innerHTML = '<option value="">Select a product</option>';
  allProducts.forEach(product => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = product.name;
    select.appendChild(option);
  });
}

async function saveSale() {
  const pid = Number(document.getElementById("modal-sale-product").value);
  const quantityValue = document.getElementById("modal-sale-quantity").value;
  const unitPriceValue = document.getElementById("modal-sale-unit-price").value;
  const dateValue = document.getElementById("modal-sale-date").value;
  const messageEl = document.getElementById("sale-modal-message");

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

  const currentQty = productQuantityMap.get(pid) || 0;
  if (quantity > currentQty) {
    messageEl.textContent = `Not enough stock. Available: ${currentQty} units.`;
    messageEl.classList.add("auth-message--error");
    return;
  }

  const unitPrice = parseFloat(unitPriceValue);
  if (!unitPrice || unitPrice <= 0) {
    messageEl.textContent = "Please enter a valid unit price (greater than 0).";
    messageEl.classList.add("auth-message--error");
    return;
  }

  try {
    const saleDate = dateValue
      ? new Date(dateValue).toISOString()
      : new Date().toISOString();

    await apiClient.createSale({
      product_id: pid,
      quantity,
      unit_price: unitPrice,
      sale_date: saleDate,
    });

    messageEl.textContent = "Sale recorded successfully.";
    messageEl.classList.add("auth-message--success");

    await loadProducts();
    await loadSales();
    renderCharts();

    setTimeout(() => {
      const backdrop = document.getElementById("sale-modal-backdrop");
      if (backdrop) backdrop.classList.remove("modal-backdrop--visible");
    }, 700);
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.message || "Failed to record sale.";
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

function formatMoney(value) {
  if (value == null || value === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function renderSales(sales) {
  const tbody = document.getElementById("sales-table-body");
  if (!tbody) return;

  if (!sales.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-muted">No sales found for the selected filters.</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  sales.forEach(sale => {
    const tr = document.createElement("tr");
    const productName = sale.products?.name || "(Unknown product)";
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => showSaleDetails(sale));

    tr.innerHTML = `
      <td class="text-muted">${formatDateTime(sale.sale_date)}</td>
      <td><strong style="color: #e5e7eb;">${escapeHtml(productName)}</strong></td>
      <td class="text-right"><strong style="color: #e5e7eb;">${sale.quantity}</strong></td>
      <td class="text-right">${formatMoney(sale.unit_price)}</td>
      <td class="text-right"><strong style="color: #22c55e;">${formatMoney(sale.total_price)}</strong></td>
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

function setupSaleDetailsModal() {
  const backdrop = document.getElementById("sale-details-backdrop");
  const closeBtn = document.getElementById("sale-details-close");
  if (!backdrop || !closeBtn) return;
  const close = () => backdrop.classList.remove("modal-backdrop--visible");
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
}

function showSaleDetails(sale) {
  const backdrop = document.getElementById("sale-details-backdrop");
  const body = document.getElementById("sale-details-body");
  if (!backdrop || !body) return;
  const p = sale.products?.name || "—";
  body.innerHTML = `
    <p><strong>Product</strong><br>${escapeHtml(p)}</p>
    <p><strong>Date</strong><br>${escapeHtml(formatDateTime(sale.sale_date))}</p>
    <p><strong>Quantity</strong><br>${sale.quantity}</p>
    <p><strong>Unit price</strong><br>${formatMoney(sale.unit_price)}</p>
    <p><strong>Total</strong><br>${formatMoney(sale.total_price)}</p>
  `;
  backdrop.classList.add("modal-backdrop--visible");
}

function setupExportCSV() {
  const btn = document.getElementById("btn-export-sales-csv");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const rows = [["Date", "Product", "Quantity", "Unit price", "Total"]];
    allSales.forEach((s) => {
      rows.push([
        formatDateTime(s.sale_date),
        s.products?.name || "",
        s.quantity,
        s.unit_price,
        s.total_price
      ]);
    });
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  });
}

function renderCharts() {
  const dailyEl = document.getElementById("sales-daily-chart");
  const topEl = document.getElementById("sales-top-chart");
  if (!dailyEl || !topEl || typeof Chart === "undefined") return;

  const last7 = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    last7[d.toISOString().split("T")[0]] = 0;
  }
  allSales.forEach((s) => {
    const key = new Date(s.sale_date).toISOString().split("T")[0];
    if (last7[key] !== undefined) {
      last7[key] += parseFloat(s.total_price || 0);
    }
  });
  const labels = Object.keys(last7);
  const rev = Object.values(last7);

  if (dailySalesChart) dailySalesChart.destroy();
  dailySalesChart = new Chart(dailyEl, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue",
          data: rev,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.15)",
          fill: true,
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9aa0ae" }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#9aa0ae" }, grid: { color: "rgba(255,255,255,0.06)" } }
      }
    }
  });

  const byProduct = new Map();
  allSales.forEach((s) => {
    const n = s.products?.name || "Unknown";
    byProduct.set(n, (byProduct.get(n) || 0) + parseInt(s.quantity || 0, 10));
  });
  const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (topProductsChart) topProductsChart.destroy();
  topProductsChart = new Chart(topEl, {
    type: "bar",
    data: {
      labels: top.map((t) => t[0]),
      datasets: [
        {
          label: "Qty sold",
          data: top.map((t) => t[1]),
          backgroundColor: "rgba(34, 197, 94, 0.55)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9aa0ae" }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#9aa0ae" }, grid: { color: "rgba(255,255,255,0.06)" } }
      }
    }
  });
}
