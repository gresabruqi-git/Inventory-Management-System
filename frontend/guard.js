
document.addEventListener("DOMContentLoaded", async () => {
  const token = apiClient.getToken();
  if (!token) {
    window.location.href = "auth.html";
    return;
  }
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      apiClient.setToken(null);
      window.location.href = "auth.html";
    });
  }
  try {
    const { user } = await apiClient.me();
    const nameEl = document.getElementById("current-user-name");
    const emailEl = document.getElementById("current-user-email");
    const avEl = document.getElementById("current-user-avatar");
    const display = user.full_name || user.email?.split("@")[0] || "User";
    if (nameEl) nameEl.textContent = display;
    if (emailEl) emailEl.textContent = user.email || "";
    if (avEl) avEl.textContent = display.charAt(0).toUpperCase();
  } catch {
    apiClient.setToken(null);
    window.location.href = "auth.html";
  }
});
