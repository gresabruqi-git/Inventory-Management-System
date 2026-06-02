/**
 * REST client for the Inventory API (Node backend + SQL Server).
 * Uses relative /api URLs when the page is served from http://localhost:3000 (same as the API).
 * If you open HTML via Live Server, file://, or another port, requests go to http://localhost:3000.
 * Override anytime: window.API_BASE_URL = "http://host:port" (before this script loads).
 */
(function (global) {
  const TOKEN_KEY = "ims_token";

  function originBase() {
    if (typeof global.API_BASE_URL === "string" && global.API_BASE_URL.trim()) {
      return global.API_BASE_URL.replace(/\/$/, "");
    }
    if (typeof global.location === "undefined") return "";
    const { protocol, hostname, port } = global.location;
    // file:// or Live Server / other local static server → POST /api/* would 405; talk to Node instead
    if (protocol === "file:") return "http://localhost:3000";
    const isLoopback =
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    if (isLoopback && port && port !== "3000") return "http://localhost:3000";
    return "";
  }

  function apiUrl(path) {
    const p = path.startsWith("/") ? path : `/${path}`;
    const base = originBase();
    return base ? `${base}${p}` : p;
  }

  async function request(method, path, body) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const msg =
        data && typeof data === "object" && data.error
          ? data.error
          : typeof data === "string"
            ? data
            : res.statusText;
      throw new Error(msg || "Request failed");
    }
    return data;
  }

  const apiClient = {
    setToken(token) {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    },
    getToken() {
      return localStorage.getItem(TOKEN_KEY);
    },
    async login(email, password) {
      const data = await request("POST", "/api/auth/login", { email, password });
      if (data.token) this.setToken(data.token);
      return data;
    },
    async register(full_name, email, password) {
      return request("POST", "/api/auth/register", {
        full_name,
        email,
        password,
      });
    },
    async me() {
      return request("GET", "/api/auth/me");
    },
    async getCategories() {
      return request("GET", "/api/categories");
    },
    async createCategory(payload) {
      return request("POST", "/api/categories", payload);
    },
    async updateCategory(id, payload) {
      return request("PATCH", `/api/categories/${id}`, payload);
    },
    async deleteCategory(id) {
      return request("DELETE", `/api/categories/${id}`);
    },
    async getSuppliers() {
      return request("GET", "/api/suppliers");
    },
    async getProducts() {
      return request("GET", "/api/products");
    },
    async createProduct(payload) {
      return request("POST", "/api/products", payload);
    },
    async getStockTransactions() {
      return request("GET", "/api/stock-transactions");
    },
    async createStockTransaction(payload) {
      return request("POST", "/api/stock-transactions", payload);
    },
    async getSales() {
      return request("GET", "/api/sales");
    },
    async createSale(payload) {
      return request("POST", "/api/sales", payload);
    },
  };

  global.apiClient = apiClient;
})(typeof window !== "undefined" ? window : globalThis);
