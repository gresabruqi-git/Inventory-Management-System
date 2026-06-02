

// 

let allCategories = [];
let editingCategoryId = null;
let deletingCategoryId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  setupFilters();
  setupCategoryModal();
  setupDeleteModal();
});

async function loadCategories() {
  const tbody = document.getElementById("categories-table-body");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Loading categories…</td></tr>';

  let categories;
  let products;
  try {
    [categories, products] = await Promise.all([
      apiClient.getCategories(),
      apiClient.getProducts(),
    ]);
  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-muted">Failed to load categories from the server.</td></tr>';
    return;
  }

  categories = [...(categories || [])].sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );

  // Count products per category
  const productCountMap = new Map();
  (products || []).forEach(p => {
    if (p.category_id) {
      productCountMap.set(p.category_id, (productCountMap.get(p.category_id) || 0) + 1);
    }
  });

  
  allCategories = (categories || []).map(cat => ({
    ...cat,
    productCount: productCountMap.get(cat.id) || 0
  }));

  renderCategories(allCategories);
}

function setupFilters() {
  const searchInput = document.getElementById("category-search");
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }
}

function applyFilters() {
  const searchValue = (document.getElementById("category-search")?.value || "")
    .toLowerCase()
    .trim();

  const filtered = allCategories.filter(cat => {
    const nameMatch = cat.name.toLowerCase().includes(searchValue);
    const descMatch = cat.description
      ? cat.description.toLowerCase().includes(searchValue)
      : false;
    return nameMatch || descMatch;
  });

  renderCategories(filtered);
}

function setupCategoryModal() { //krijimi i modalit te kategroive
  const backdrop = document.getElementById("category-modal-backdrop");
  const openBtn = document.getElementById("btn-new-category");
  const closeBtn = document.getElementById("category-modal-close");
  const cancelBtn = document.getElementById("category-modal-cancel");
  const saveBtn = document.getElementById("category-modal-save");

  if (!backdrop || !openBtn) return;

  openBtn.addEventListener("click", () => {
    editingCategoryId = null;
    resetCategoryModal();
    document.getElementById("category-modal-title").textContent = "New Category";
    backdrop.classList.add("modal-backdrop--visible");
  });

  const close = () => {
    backdrop.classList.remove("modal-backdrop--visible");
    editingCategoryId = null;
  };

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      await saveCategory();
    });
  }
}

function resetCategoryModal() {
  document.getElementById("modal-category-name").value = "";
  document.getElementById("modal-category-description").value = "";
  document.getElementById("category-modal-message").textContent = "";
  document
    .getElementById("category-modal-message")
    .classList.remove("auth-message--error", "auth-message--success");
}

function openEditModal(category) {
  editingCategoryId = category.id;
  document.getElementById("category-modal-title").textContent = "Edit Category";
  document.getElementById("modal-category-name").value = category.name || "";
  document.getElementById("modal-category-description").value = category.description || "";
  document.getElementById("category-modal-message").textContent = "";
  document
    .getElementById("category-modal-message")
    .classList.remove("auth-message--error", "auth-message--success");
  document.getElementById("category-modal-backdrop").classList.add("modal-backdrop--visible");
}

async function saveCategory() {
  const name = document.getElementById("modal-category-name").value.trim();
  const description = document.getElementById("modal-category-description").value.trim();
  const messageEl = document.getElementById("category-modal-message");

  messageEl.textContent = "";
  messageEl.classList.remove("auth-message--error", "auth-message--success");

  if (!name) {
    messageEl.textContent = "Please enter a category name.";
    messageEl.classList.add("auth-message--error");
    return;
  }

  try {
    if (editingCategoryId) {
      await apiClient.updateCategory(editingCategoryId, {
        name,
        description: description || null,
      });
    } else {
      await apiClient.createCategory({
        name,
        description: description || null,
      });
    }
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.message || "Failed to save category.";
    messageEl.classList.add("auth-message--error");
    return;
  }

  messageEl.textContent = editingCategoryId
    ? "Category updated successfully."
    : "Category created successfully.";
  messageEl.classList.add("auth-message--success");

  //Reload categories
  await loadCategories();

  //Close modal after short delay
  setTimeout(() => {
    const backdrop = document.getElementById("category-modal-backdrop");
    if (backdrop) backdrop.classList.remove("modal-backdrop--visible");
    editingCategoryId = null;
  }, 700);
}

function setupDeleteModal() {
  const backdrop = document.getElementById("delete-modal-backdrop");
  const closeBtn = document.getElementById("delete-modal-close");
  const cancelBtn = document.getElementById("delete-modal-cancel");
  const confirmBtn = document.getElementById("delete-modal-confirm");

  if (!backdrop) return;

  const close = () => {
    backdrop.classList.remove("modal-backdrop--visible");
    deletingCategoryId = null;
  };

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      await deleteCategory();
    });
  }
}

function openDeleteModal(category) {
  deletingCategoryId = category.id;
  const messageEl = document.getElementById("delete-modal-message");
  const errorEl = document.getElementById("delete-modal-error");

  errorEl.textContent = "";
  errorEl.classList.remove("auth-message--error");

  if (category.productCount > 0) {
    messageEl.innerHTML = `Cannot delete "<strong>${escapeHtml(category.name)}</strong>". This category has <strong>${category.productCount}</strong> product(s). Please reassign or remove those products first.`;
    document.getElementById("delete-modal-confirm").style.display = "none";
  } else {
    messageEl.innerHTML = `Are you sure you want to delete "<strong>${escapeHtml(category.name)}</strong>"? This action cannot be undone.`;
    document.getElementById("delete-modal-confirm").style.display = "inline-flex";
  }

  document.getElementById("delete-modal-backdrop").classList.add("modal-backdrop--visible");
}

async function deleteCategory() {
  if (!deletingCategoryId) return;

  const errorEl = document.getElementById("delete-modal-error");

  try {
    await apiClient.deleteCategory(deletingCategoryId);
  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message || "Failed to delete category.";
    errorEl.classList.add("auth-message--error");
    return;
  }

  // Reload categories
  await loadCategories();

  // Close modal
  const backdrop = document.getElementById("delete-modal-backdrop");
  if (backdrop) backdrop.classList.remove("modal-backdrop--visible");
  deletingCategoryId = null;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function renderCategories(categories) {
  const tbody = document.getElementById("categories-table-body");
  if (!tbody) return;

  if (!categories.length) {
    const searchValue = (document.getElementById("category-search")?.value || "")
      .toLowerCase()
      .trim();

    if (searchValue) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-muted">No categories found for "<strong>${escapeHtml(
        searchValue
      )}</strong>".</td></tr>`;
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-muted">No categories found. Create your first category!</td></tr>';
    }
    return;
  }

  tbody.innerHTML = "";

  categories.forEach(cat => {
    const tr = document.createElement("tr");
    const categoryName = escapeHtml(cat.name || "(Unnamed)");
    const description = cat.description
      ? escapeHtml(cat.description.length > 60 ? cat.description.substring(0, 60) + "..." : cat.description)
      : "—";
    const productCount = cat.productCount || 0;

    tr.innerHTML = `
      <td><strong style="color: #e5e7eb;">${categoryName}</strong></td>
      <td class="text-muted">${description}</td>
      <td class="text-right">
        <span class="text-muted">${productCount}</span>
      </td>
      <td class="text-muted">${formatDate(cat.created_at)}</td>
      <td>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn--ghost edit-category-btn" data-category-id="${cat.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" title="Edit">
            <i class="fa-solid fa-edit"></i>
          </button>
          <button class="btn btn--ghost delete-category-btn" data-category-id="${cat.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #f87171;" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;

    // Add event listeners
    const editBtn = tr.querySelector('.edit-category-btn');
    const deleteBtn = tr.querySelector('.delete-category-btn');

    if (editBtn) {
      editBtn.addEventListener('click', () => openEditModal(cat));
    }
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => openDeleteModal(cat));
    }

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

