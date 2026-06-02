

let allProducts = [];
let allSales = [];
let allCategories = [];
let allSuppliers = [];
let salesReportChart = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadAllData();
  setupTabs();
  setupExports();
  renderInventoryReport();
  renderSalesReport();
  renderLowStockReport();
});

async function loadAllData() {
  try {
    const [products, sales, categories, suppliers] = await Promise.all([
      apiClient.getProducts(),
      apiClient.getSales(),
      apiClient.getCategories(),
      apiClient.getSuppliers(),
    ]);
    allProducts = products || [];
    allSales = sales || [];
    allCategories = categories || [];
    allSuppliers = suppliers || [];
  } catch (e) {
    console.error(e);
    allProducts = [];
    allSales = [];
    allCategories = [];
    allSuppliers = [];
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll(".report-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove("report-tab--active"));
      tab.classList.add("report-tab--active");
      
      // Show/hide sections
      document.querySelectorAll(".report-section").forEach(section => {
        section.style.display = "none";
      });
      document.getElementById(`report-${tabName}`).style.display = "block";
    });
  });
}

function setupExports() {
  document.getElementById("export-inventory").addEventListener("click", () => exportInventoryReport());
  document.getElementById("export-sales").addEventListener("click", () => exportSalesReport());
  document.getElementById("export-low-stock").addEventListener("click", () => exportLowStockReport());
  
  document.getElementById("sales-report-period").addEventListener("change", () => {
    renderSalesReport();
  });
}

function renderInventoryReport() {
  const tbody = document.getElementById("inventory-report-body");
  if (!tbody) return;

  // Create maps for quick lookup
  const categoryMap = new Map(allCategories.map(c => [c.id, c.name]));
  const supplierMap = new Map(allSuppliers.map(s => [s.id, s.name]));

  if (!allProducts.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-muted">No products found.</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  allProducts.forEach(product => {
    const tr = document.createElement("tr");
    const categoryName = product.category_id ? (categoryMap.get(product.category_id) || "—") : "—";
    const supplierName = product.supplier_id ? (supplierMap.get(product.supplier_id) || "—") : "—";
    const stockValue = (product.price || 0) * (product.quantity || 0);
    const status = computeStatus(product);

    tr.innerHTML = `
      <td><strong style="color: #e5e7eb;">${escapeHtml(product.name || "(Unnamed)")}</strong></td>
      <td class="text-muted">${escapeHtml(categoryName)}</td>
      <td class="text-muted">${escapeHtml(supplierName)}</td>
      <td class="text-right">${formatMoney(product.price)}</td>
      <td class="text-right"><strong style="color: #e5e7eb;">${product.quantity || 0}</strong></td>
      <td class="text-right">${product.min_stock_level || 0}</td>
      <td class="text-right">${formatMoney(stockValue)}</td>
      <td>${renderStatusBadge(status)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function renderSalesReport() {
  const period = document.getElementById("sales-report-period").value;
  const tbody = document.getElementById("sales-report-body");
  const header = document.getElementById("sales-report-period-header");
  
  if (!tbody) return;

  if (period === "daily") {
    header.textContent = "Date";
    renderDailySalesReport(tbody);
  } else {
    header.textContent = "Month";
    renderMonthlySalesReport(tbody);
  }
}

function renderDailySalesReport(tbody) {
  // Group sales by date
  const dailySales = {};
  allSales.forEach(sale => {
    const date = new Date(sale.sale_date).toISOString().split('T')[0];
    if (!dailySales[date]) {
      dailySales[date] = { count: 0, items: 0, revenue: 0 };
    }//GRUPON SISPAS KTYRE 
    dailySales[date].count++;
    dailySales[date].items += parseInt(sale.quantity || 0);
    dailySales[date].revenue += parseFloat(sale.total_price || 0);
  });

  // Sort by date (newest first)
  const sorted = Object.entries(dailySales)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30); // Last 30 days

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted">No sales data available.</td></tr>';
    renderSalesChart([], []);
    return;
  }

  tbody.innerHTML = "";
  const labels = [];
  const data = [];

  sorted.forEach(([date, stats]) => {
    const tr = document.createElement("tr");
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    
    labels.unshift(formattedDate);
    data.unshift(stats.revenue);

    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td class="text-right">${stats.count}</td>
      <td class="text-right">${stats.items}</td>
      <td class="text-right"><strong style="color: #22c55e;">${formatMoney(stats.revenue)}</strong></td>
    `;

    tbody.appendChild(tr);
  });

  renderSalesChart(labels, data);
}

function renderMonthlySalesReport(tbody) {
  // Group sales by month
  const monthlySales = {};
  allSales.forEach(sale => {
    const date = new Date(sale.sale_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlySales[monthKey]) {
      monthlySales[monthKey] = { count: 0, items: 0, revenue: 0 };
    }
    monthlySales[monthKey].count++;
    monthlySales[monthKey].items += parseInt(sale.quantity || 0);
    monthlySales[monthKey].revenue += parseFloat(sale.total_price || 0);
  });

  // Sort by month (newest first)
  const sorted = Object.entries(monthlySales)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12); // Last 12 months

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted">No sales data available.</td></tr>';
    renderSalesChart([], []);
    return;
  }

  tbody.innerHTML = "";
  const labels = [];
  const data = [];

  sorted.forEach(([monthKey, stats]) => {
    const tr = document.createElement("tr");
    const [year, month] = monthKey.split('-');
    const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    
    labels.unshift(monthName);
    data.unshift(stats.revenue);

    tr.innerHTML = `
      <td>${monthName}</td>
      <td class="text-right">${stats.count}</td>
      <td class="text-right">${stats.items}</td>
      <td class="text-right"><strong style="color: #22c55e;">${formatMoney(stats.revenue)}</strong></td>
    `;

    tbody.appendChild(tr);
  });

  renderSalesChart(labels, data);
}

function renderSalesChart(labels, data) {
  const ctx = document.getElementById("sales-report-chart");
  if (!ctx) return;

  if (salesReportChart) {
    salesReportChart.destroy();
  }

  const period = document.getElementById("sales-report-period").value;
  const chartType = period === "daily" ? "line" : "bar";

  salesReportChart = new Chart(ctx, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [{
        label: "Revenue",
        data: data,
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: period === "daily" ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.8)",
        tension: period === "daily" ? 0.4 : 0,
        fill: period === "daily"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return "$" + value.toFixed(0);
            },
            color: "#9ca3af"
          },
          grid: {
            color: "rgba(148, 163, 184, 0.1)"
          }
        },
        x: {
          ticks: {
            color: "#9ca3af"
          },
          grid: {
            color: "rgba(148, 163, 184, 0.1)"
          }
        }
      }
    }
  });
}

function renderLowStockReport() {
  const tbody = document.getElementById("low-stock-report-body");
  if (!tbody) return;

  // Filter products that are at or below minimum stock level
  const lowStockProducts = allProducts.filter(p => {
    const qty = p.quantity || 0;
    const min = p.min_stock_level || 0;
    return qty <= min;
  });

  if (!lowStockProducts.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No products are currently low in stock. Great job!</td></tr>';
    return;
  }

  // Create maps for quick lookup
  const categoryMap = new Map(allCategories.map(c => [c.id, c.name]));

  tbody.innerHTML = "";

  // Sort by how critical (most critical first)
  lowStockProducts.sort((a, b) => {
    const aQty = a.quantity || 0;
    const bQty = b.quantity || 0;
    return aQty - bQty;//a<b;a>b ...
  });

  lowStockProducts.forEach(product => {
    const tr = document.createElement("tr");
    const categoryName = product.category_id ? (categoryMap.get(product.category_id) || "—") : "—";
    const qty = product.quantity || 0;
    const min = product.min_stock_level || 0;
    const difference = qty - min;
    const status = computeStatus(product);

    tr.innerHTML = `
      <td><strong style="color: #e5e7eb;">${escapeHtml(product.name || "(Unnamed)")}</strong></td>
      <td class="text-muted">${escapeHtml(categoryName)}</td>
      <td class="text-right"><strong style="color: ${qty === 0 ? '#f87171' : '#fbbf24'};">${qty}</strong></td>
      <td class="text-right">${min}</td>
      <td class="text-right" style="color: ${difference < 0 ? '#f87171' : '#9ca3af'};">${difference >= 0 ? '+' : ''}${difference}</td>
      <td>${renderStatusBadge(status)}</td>
    `;

    tbody.appendChild(tr);
  });
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

function exportInventoryReport() { //csv file
  const categoryMap = new Map(allCategories.map(c => [c.id, c.name]));
  const supplierMap = new Map(allSuppliers.map(s => [s.id, s.name]));

  const headers = ["Product", "Category", "Supplier", "Price", "Quantity", "Min Level", "Stock Value", "Status"];
  const rows = allProducts.map(p => {
    const categoryName = p.category_id ? (categoryMap.get(p.category_id) || "") : "";
    const supplierName = p.supplier_id ? (supplierMap.get(p.supplier_id) || "") : "";
    const stockValue = (p.price || 0) * (p.quantity || 0);
    const status = computeStatus(p);
    return [
      p.name || "",
      categoryName,
      supplierName,
      p.price || 0,
      p.quantity || 0,
      p.min_stock_level || 0,
      stockValue,
      status === "OUT_OF_STOCK" ? "Out of stock" : status === "LOW_STOCK" ? "Low stock" : "In stock"
    ];
  });

  exportToCSV("inventory_report", headers, rows);
}

function exportSalesReport() {
  const period = document.getElementById("sales-report-period").value;
  const headers = period === "daily" 
    ? ["Date", "Sales Count", "Items Sold", "Total Revenue"]
    : ["Month", "Sales Count", "Items Sold", "Total Revenue"];

  let rows = [];
  if (period === "daily") {
    const dailySales = {};
    allSales.forEach(sale => {
      const date = new Date(sale.sale_date).toISOString().split('T')[0];
      if (!dailySales[date]) {
        dailySales[date] = { count: 0, items: 0, revenue: 0 };
      }
      dailySales[date].count++;
      dailySales[date].items += parseInt(sale.quantity || 0);
      dailySales[date].revenue += parseFloat(sale.total_price || 0);
    });
    rows = Object.entries(dailySales)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, stats]) => [
        new Date(date).toLocaleDateString("en-US"),
        stats.count,
        stats.items,
        stats.revenue
      ]);
  } else {
    const monthlySales = {};
    allSales.forEach(sale => {
      const date = new Date(sale.sale_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlySales[monthKey]) {
        monthlySales[monthKey] = { count: 0, items: 0, revenue: 0 };
      }
      monthlySales[monthKey].count++;
      monthlySales[monthKey].items += parseInt(sale.quantity || 0);
      monthlySales[monthKey].revenue += parseFloat(sale.total_price || 0);
    });
    rows = Object.entries(monthlySales)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, stats]) => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
        return [monthName, stats.count, stats.items, stats.revenue];
      });
  }

  exportToCSV(`sales_report_${period}`, headers, rows);
}

function exportLowStockReport() {
  const categoryMap = new Map(allCategories.map(c => [c.id, c.name]));
  const lowStockProducts = allProducts.filter(p => {
    const qty = p.quantity || 0;
    const min = p.min_stock_level || 0;
    return qty <= min;
  });

  const headers = ["Product", "Category", "Current Quantity", "Min Level", "Difference", "Status"];
  const rows = lowStockProducts.map(p => {
    const categoryName = p.category_id ? (categoryMap.get(p.category_id) || "") : "";
    const qty = p.quantity || 0;
    const min = p.min_stock_level || 0;
    const difference = qty - min;
    const status = computeStatus(p);
    return [
      p.name || "",
      categoryName,
      qty,
      min,
      difference,
      status === "OUT_OF_STOCK" ? "Out of stock" : "Low stock"
    ];
  });

  exportToCSV("low_stock_report", headers, rows);
}

function exportToCSV(filename, headers, rows) {
  if (!rows.length) {
    alert("No data to export.");
    return;
  }
//pergatitja e file 
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatMoney(value) {
  if (value == null || value === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
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

