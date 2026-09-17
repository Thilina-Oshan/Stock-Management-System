/* ==========================================================================
   Stockroom — Inventory Management Dashboard
   All DOM interactions: sidebar toggle, theme switch, table search/filter,
   pagination, add-product modal + image preview, delete confirmation,
   and Chart.js analytics.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     0. Small helpers
     ------------------------------------------------------------------------ */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------------------
     1. Sidebar toggle (desktop collapse + mobile slide-in)
     ------------------------------------------------------------------------ */
  const appShell   = $(".app-shell");
  const sidebar    = $("#sidebar");
  const overlay    = $("#sidebarOverlay");
  const toggleBtn  = $("#sidebarToggle");

  function isMobileViewport() {
    return window.matchMedia("(max-width: 991.98px)").matches;
  }

  function toggleSidebar() {
    if (isMobileViewport()) {
      sidebar.classList.toggle("is-mobile-open");
      overlay.classList.toggle("is-visible", sidebar.classList.contains("is-mobile-open"));
    } else {
      appShell.classList.toggle("sidebar-collapsed");
      sidebar.classList.toggle("is-collapsed");
      localStorage.setItem(
        "stockroom-sidebar-collapsed",
        appShell.classList.contains("sidebar-collapsed") ? "1" : "0"
      );
    }
  }

  function closeMobileSidebar() {
    sidebar.classList.remove("is-mobile-open");
    overlay.classList.remove("is-visible");
  }

  if (toggleBtn) toggleBtn.addEventListener("click", toggleSidebar);
  if (overlay) overlay.addEventListener("click", closeMobileSidebar);

  // Restore collapsed state on desktop
  if (localStorage.getItem("stockroom-sidebar-collapsed") === "1" && !isMobileViewport()) {
    appShell.classList.add("sidebar-collapsed");
    sidebar.classList.add("is-collapsed");
  }

  // Close mobile sidebar automatically when a nav link is tapped
  $$(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      $$(".nav-link").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      if (isMobileViewport()) closeMobileSidebar();
    });
  });

  // Reset transform state when resizing across the breakpoint
  window.addEventListener("resize", () => {
    if (!isMobileViewport()) {
      overlay.classList.remove("is-visible");
      sidebar.classList.remove("is-mobile-open");
    }
  });

  /* ------------------------------------------------------------------------
     2. Dark / light mode toggle
     ------------------------------------------------------------------------ */
  const THEME_KEY = "stockroom-theme";
  const themeSwitch = $("#themeSwitch");
  const rootEl = document.documentElement;

  function applyTheme(theme) {
    rootEl.setAttribute("data-theme", theme);
    if (themeSwitch) themeSwitch.checked = theme === "dark";
    // Keep Chart.js in sync if charts are already drawn
    if (window.__stockroomCharts) {
      window.__stockroomCharts.forEach((chart) => updateChartTheme(chart));
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      applyTheme(saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light");
    }
  }

  if (themeSwitch) {
    themeSwitch.addEventListener("change", () => {
      const next = themeSwitch.checked ? "dark" : "light";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }

  initTheme();

  /* ------------------------------------------------------------------------
     3. Product table: search, category filter, status filter, pagination
     ------------------------------------------------------------------------ */
  const searchInput   = $("#productSearch");
  const categoryFilter = $("#categoryFilter");
  const statusFilter   = $("#statusFilter");
  const tableBody      = $("#productTableBody");
  const rowsPerPageEl  = $("#rowsPerPage");
  const paginationEl   = $("#tablePagination");
  const resultsCountEl = $("#resultsCount");

  let currentPage = 1;

  function getAllRows() {
    return tableBody ? $$("tr", tableBody) : [];
  }

  function getFilteredRows() {
    const term = (searchInput?.value || "").trim().toLowerCase();
    const category = categoryFilter?.value || "all";
    const status = statusFilter?.value || "all";

    return getAllRows().filter((row) => {
      const name = row.dataset.name?.toLowerCase() || "";
      const sku = row.dataset.sku?.toLowerCase() || "";
      const rowCategory = row.dataset.category || "";
      const rowStatus = row.dataset.status || "";

      const matchesTerm = !term || name.includes(term) || sku.includes(term);
      const matchesCategory = category === "all" || rowCategory === category;
      const matchesStatus = status === "all" || rowStatus === status;

      return matchesTerm && matchesCategory && matchesStatus;
    });
  }

  function renderTable() {
    const filtered = getFilteredRows();
    const perPage = parseInt(rowsPerPageEl?.value || "8", 10);
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    currentPage = Math.min(currentPage, totalPages);

    // Hide all rows first
    getAllRows().forEach((row) => row.classList.add("is-hidden"));

    // Show the rows belonging to the current page
    const start = (currentPage - 1) * perPage;
    const pageRows = filtered.slice(start, start + perPage);
    pageRows.forEach((row) => row.classList.remove("is-hidden"));

    renderPagination(filtered.length, perPage, totalPages);
    renderResultsCount(filtered.length);
  }

  function renderResultsCount(total) {
    if (!resultsCountEl) return;
    if (total === 0) {
      resultsCountEl.textContent = "No products match your filters";
    } else {
      const perPage = parseInt(rowsPerPageEl?.value || "8", 10);
      const start = (currentPage - 1) * perPage + 1;
      const end = Math.min(currentPage * perPage, total);
      resultsCountEl.textContent = `Showing ${start}–${end} of ${total} products`;
    }
  }

  function renderPagination(total, perPage, totalPages) {
    if (!paginationEl) return;
    paginationEl.innerHTML = "";

    const makeBtn = (label, page, opts = {}) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "page-btn" + (opts.active ? " active" : "");
      btn.textContent = label;
      btn.disabled = !!opts.disabled;
      btn.addEventListener("click", () => {
        currentPage = page;
        renderTable();
      });
      return btn;
    };

    paginationEl.appendChild(
      makeBtn("‹", Math.max(1, currentPage - 1), { disabled: currentPage === 1 })
    );

    for (let i = 1; i <= totalPages; i++) {
      paginationEl.appendChild(makeBtn(String(i), i, { active: i === currentPage }));
    }

    paginationEl.appendChild(
      makeBtn("›", Math.min(totalPages, currentPage + 1), { disabled: currentPage === totalPages })
    );
  }

  [searchInput, categoryFilter, statusFilter, rowsPerPageEl].forEach((el) => {
    if (!el) return;
    const evt = el.tagName === "INPUT" ? "input" : "change";
    el.addEventListener(evt, () => {
      currentPage = 1;
      renderTable();
    });
  });

  renderTable();

  /* ------------------------------------------------------------------------
     4. Quick Add / Edit Product modal — image preview + save behavior
     ------------------------------------------------------------------------ */
  const productForm      = $("#productForm");
  const imageInput       = $("#productImageInput");
  const imageDropZone    = $("#imageDropZone");
  const imagePreview     = $("#imagePreview");
  const modalTitle       = $("#addProductModalLabel");
  const saveProductBtn   = $("#saveProductBtn");
  const addProductModalEl = $("#addProductModal");
  const addProductModal  = addProductModalEl ? new bootstrap.Modal(addProductModalEl) : null;

  if (imageDropZone && imageInput) {
    imageDropZone.addEventListener("click", () => imageInput.click());

    imageInput.addEventListener("change", () => {
      const file = imageInput.files && imageInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove("d-none");
        $("#imageDropText")?.classList.add("d-none");
      };
      reader.readAsDataURL(file);
    });
  }

  function resetProductForm() {
    productForm?.reset();
    imagePreview?.classList.add("d-none");
    $("#imageDropText")?.classList.remove("d-none");
    if (modalTitle) modalTitle.textContent = "Add product";
    if (saveProductBtn) saveProductBtn.textContent = "Save product";
  }

  $("#openAddProductBtn")?.addEventListener("click", () => {
    resetProductForm();
    addProductModal?.show();
  });
  $("#openAddProductBtnHeader")?.addEventListener("click", () => {
    resetProductForm();
    addProductModal?.show();
  });

  // Reset the form each time the modal is fully hidden (covers the "x" / backdrop close too)
  addProductModalEl?.addEventListener("hidden.bs.modal", resetProductForm);

  // Edit buttons pre-fill the modal from the row's data
  $$(".js-edit-product").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      if (!row) return;
      resetProductForm();
      if (modalTitle) modalTitle.textContent = "Edit product";
      if (saveProductBtn) saveProductBtn.textContent = "Update product";
      $("#productNameInput").value = row.dataset.name || "";
      $("#productSkuInput").value = row.dataset.sku || "";
      $("#productCategoryInput").value = row.dataset.category || "";
      $("#productPriceInput").value = row.dataset.price || "";
      $("#productQtyInput").value = row.dataset.qty || "";
      const thumbImg = row.querySelector(".product-cell__thumb img");
      if (thumbImg) {
        imagePreview.src = thumbImg.src;
        imagePreview.classList.remove("d-none");
        $("#imageDropText")?.classList.add("d-none");
      }
      addProductModal?.show();
    });
  });

  productForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!productForm.checkValidity()) {
      productForm.classList.add("was-validated");
      return;
    }
    addProductModal?.hide();
    showToast("Product saved", `${$("#productNameInput").value || "Product"} was saved successfully.`, "good");
  });

  /* ------------------------------------------------------------------------
     5. Delete confirmation
     ------------------------------------------------------------------------ */
  const deleteModalEl = $("#deleteConfirmModal");
  const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
  const deleteTargetName = $("#deleteTargetName");
  const confirmDeleteBtn = $("#confirmDeleteBtn");
  let rowPendingDelete = null;

  $$(".js-delete-product").forEach((btn) => {
    btn.addEventListener("click", () => {
      rowPendingDelete = btn.closest("tr");
      if (deleteTargetName) {
        deleteTargetName.textContent = rowPendingDelete?.dataset.name || "this product";
      }
      deleteModal?.show();
    });
  });

  confirmDeleteBtn?.addEventListener("click", () => {
    const name = rowPendingDelete?.dataset.name || "Product";
    rowPendingDelete?.remove();
    deleteModal?.hide();
    renderTable();
    showToast("Product deleted", `${name} was removed from inventory.`, "warn");
  });

  /* ------------------------------------------------------------------------
     6. View product (lightweight read-only glance)
     ------------------------------------------------------------------------ */
  const viewModalEl = $("#viewProductModal");
  const viewModal = viewModalEl ? new bootstrap.Modal(viewModalEl) : null;

  $$(".js-view-product").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      if (!row) return;
      $("#viewProductName").textContent = row.dataset.name || "—";
      $("#viewProductSku").textContent = row.dataset.sku || "—";
      $("#viewProductCategory").textContent = row.dataset.category || "—";
      $("#viewProductPrice").textContent = row.dataset.price ? `$${Number(row.dataset.price).toFixed(2)}` : "—";
      $("#viewProductQty").textContent = row.dataset.qty || "—";
      const thumbImg = row.querySelector(".product-cell__thumb img");
      const viewImg = $("#viewProductImage");
      if (viewImg) {
        if (thumbImg) {
          viewImg.src = thumbImg.src;
          viewImg.classList.remove("d-none");
        } else {
          viewImg.classList.add("d-none");
        }
      }
      viewModal?.show();
    });
  });

  /* ------------------------------------------------------------------------
     7. Toasts
     ------------------------------------------------------------------------ */
  function showToast(title, message, variant = "brand") {
    const container = $("#toastContainer");
    if (!container) return;

    const icon = { good: "fa-circle-check", warn: "fa-triangle-exclamation", brand: "fa-circle-info" }[variant];
    const color = { good: "var(--good-500)", warn: "var(--warn-500)", brand: "var(--brand-500)" }[variant];

    const toastEl = document.createElement("div");
    toastEl.className = "toast align-items-center";
    toastEl.setAttribute("role", "alert");
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body d-flex align-items-start gap-2">
          <i class="fa-solid ${icon} mt-1" style="color:${color}"></i>
          <div>
            <div class="fw-semibold">${title}</div>
            <div class="text-secondary" style="font-size:0.8rem;">${message}</div>
          </div>
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>`;
    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 3800 });
    toast.show();
    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
  }

  /* ------------------------------------------------------------------------
     8. Charts (Stock Movement + Sales Trend)
     ------------------------------------------------------------------------ */
  function chartTextColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim() || "#5b6b82";
  }
  function chartGridColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#e2e7ee";
  }

  function updateChartTheme(chart) {
    const textColor = chartTextColor();
    const gridColor = chartGridColor();
    if (chart.options.scales?.x) {
      chart.options.scales.x.ticks.color = textColor;
      chart.options.scales.x.grid.color = gridColor;
    }
    if (chart.options.scales?.y) {
      chart.options.scales.y.ticks.color = textColor;
      chart.options.scales.y.grid.color = gridColor;
    }
    if (chart.options.plugins?.legend?.labels) {
      chart.options.plugins.legend.labels.color = textColor;
    }
    chart.update();
  }

  function initCharts() {
    if (typeof Chart === "undefined") return;
    window.__stockroomCharts = [];

    const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    const textColor = chartTextColor();
    const gridColor = chartGridColor();

    const sharedGrid = { color: gridColor };
    const sharedTicks = { color: textColor, font: { family: "Inter", size: 11 } };

    // Stock Movement — In vs Out
    const stockCtx = $("#stockMovementChart");
    if (stockCtx) {
      const stockChart = new Chart(stockCtx, {
        type: "bar",
        data: {
          labels: months,
          datasets: [
            {
              label: "Stock In",
              data: [420, 380, 510, 460, 540, 610],
              backgroundColor: "#2f6f4e",
              borderRadius: 4,
              maxBarThickness: 22,
            },
            {
              label: "Stock Out",
              data: [310, 340, 360, 390, 420, 470],
              backgroundColor: "#c4622d",
              borderRadius: 4,
              maxBarThickness: 22,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", align: "end", labels: { color: textColor, usePointStyle: true, boxWidth: 8, font: { family: "Inter", size: 11 } } },
          },
          scales: {
            x: { grid: { display: false }, ticks: sharedTicks },
            y: { grid: sharedGrid, ticks: sharedTicks, beginAtZero: true },
          },
        },
      });
      window.__stockroomCharts.push(stockChart);
    }

    // Sales Trend — Revenue line
    const salesCtx = $("#salesTrendChart");
    if (salesCtx) {
      const salesChart = new Chart(salesCtx, {
        type: "line",
        data: {
          labels: months,
          datasets: [
            {
              label: "Revenue ($k)",
              data: [38, 41, 47, 44, 52, 61],
              borderColor: "#1f3a5f",
              backgroundColor: "rgba(31, 58, 95, 0.12)",
              tension: 0.35,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: "#1f3a5f",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: { grid: { display: false }, ticks: sharedTicks },
            y: { grid: sharedGrid, ticks: sharedTicks, beginAtZero: true },
          },
        },
      });
      window.__stockroomCharts.push(salesChart);
    }
  }

  document.addEventListener("DOMContentLoaded", initCharts);
})();
