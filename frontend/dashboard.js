
function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

let stockFlowChart = null;
let bestSellersDashChart = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboard();
});

async function loadDashboard() {
  let products;
  let sales;
  let tx;
  try {
    [products, sales, tx] = await Promise.all([
      apiClient.getProducts(),
      apiClient.getSales(),
      apiClient.getStockTransactions(),
    ]);
  } catch (e) {
    console.error(e);
    products = [];
    sales = [];
    tx = [];
  }

  const plist = products || [];
  const slist = sales || [];

  const transactionsForChart = (tx || []).map((row) => ({
    movement_type: row.movement_type,
    quantity: row.quantity,
    occurred_at: row.occurred_at,
  }));

  const totalProducts = plist.length;
  const lowStock = plist.filter((p) => (p.quantity ?? 0) <= (p.min_stock_level ?? 0)).length;
  const stockValue = plist.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.quantity || 0), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSales = slist.filter((s) => new Date(s.sale_date) >= monthStart);
  const monthRevenue = monthSales.reduce((sum, s) => sum + parseFloat(s.total_price || 0), 0);

  const el = (id, val) => {
    const n = document.getElementById(id);
    if (n) n.textContent = val;
  };

  el("kpi-total-products", String(totalProducts));
  el("kpi-low-stock", String(lowStock));
  el("kpi-stock-value", formatMoney(stockValue));
  el("kpi-total-sales", formatMoney(monthRevenue));

  renderDashboardCharts(slist, transactionsForChart);
  renderLowStockTable(plist);

  console.log("Dashboard loaded", { totalProducts, lowStock, stockValue, monthRevenue });
}

function renderDashboardCharts(salesList, transactions) {
  const stockEl = document.getElementById("stockChart");
  const bestEl = document.getElementById("bestSellersChart");
  if (typeof Chart === "undefined" || !stockEl || !bestEl) return;

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) });
  }

  const stockIn = {};
  const stockOut = {};
  months.forEach((m) => {
    stockIn[m.key] = 0;
    stockOut[m.key] = 0;
  });

  transactions.forEach((t) => {
    const d = new Date(t.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;//01
    if (stockIn[key] === undefined) return;
    const q = parseInt(t.quantity || 0, 10);
    if (t.movement_type === "IN") stockIn[key] += q;
    else if (t.movement_type === "OUT") stockOut[key] += q;
  });

  const labels = months.map((m) => m.label);
  if (stockFlowChart) stockFlowChart.destroy();
  stockFlowChart = new Chart(stockEl, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Stock In", data: months.map((m) => stockIn[m.key]), backgroundColor: "rgba(34, 197, 94, 0.65)" },
        { label: "Stock Out", data: months.map((m) => stockOut[m.key]), backgroundColor: "rgba(239, 68, 68, 0.55)" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#9aa0ae" } } },
      scales: {
        x: { ticks: { color: "#9aa0ae" }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#9aa0ae" }, grid: { color: "rgba(255,255,255,0.06)" } }
      }
    }
  });

  const byProduct = new Map();
  salesList.forEach((s) => {
    const n = s.products?.name || "Unknown";
    byProduct.set(n, (byProduct.get(n) || 0) + parseInt(s.quantity || 0, 10));
  });
  const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);//6 prd me te shitura

  if (bestSellersDashChart) bestSellersDashChart.destroy();
  bestSellersDashChart = new Chart(bestEl, {
    type: "bar",
    data: {
      labels: top.map((t) => t[0]),
      datasets: [{
        label: "Units sold",
        data: top.map((t) => t[1]),
        backgroundColor: "rgba(99, 102, 241, 0.7)"
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9aa0ae" }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#9aa0ae" }, grid: { display: false } }
      }
    }
  });
}

function renderLowStockTable(products) {
  const tbody = document.getElementById("low-stock-table-body");
  if (!tbody) return;

  const low = products
    .filter((p) => (p.quantity ?? 0) <= (p.min_stock_level ?? 0))//mer prd ku qunatity eshte me i vogel se low stock
    .sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));

  if (!low.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted">No low-stock items. You are fully stocked.</td></tr>';
    return;
  }

  tbody.innerHTML = low
    .map((p) => {
      const q = p.quantity ?? 0;
      const m = p.min_stock_level ?? 0;
      const status =
        q <= 0 ? '<span class="badge badge--danger">Out</span>' : '<span class="badge badge--warning">Low</span>';
      return `<tr>
        <td><strong>${escapeHtml(String(p.name || "—"))}</strong></td>
        <td class="text-muted">—</td>
        <td class="text-right">${q}</td>
        <td class="text-right">${m}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
