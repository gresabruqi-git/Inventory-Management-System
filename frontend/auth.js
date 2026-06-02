

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const tabs = document.querySelectorAll(".auth-tab");
const messageEl = document.getElementById("auth-message");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach((t) => t.classList.remove("auth-tab--active"));
    tab.classList.add("auth-tab--active");

    if (target === "login") {
      loginForm.classList.remove("auth-form--hidden");
      registerForm.classList.add("auth-form--hidden");
      messageEl.textContent = "";
    } else {
      loginForm.classList.add("auth-form--hidden");
      registerForm.classList.remove("auth-form--hidden");
      messageEl.textContent = "";
    }
  });
});

document.getElementById("login-submit").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  messageEl.textContent = "";

  if (!email || !password) {
    messageEl.textContent = "Please enter email and password.";
    messageEl.classList.add("auth-message--error");
    return;
  }

  try {
    await apiClient.login(email, password);
    window.location.href = "index.html";
  } catch (err) {
    messageEl.textContent = err.message || "Sign in failed.";
    messageEl.classList.add("auth-message--error");
  }
});

document
  .getElementById("register-submit")
  .addEventListener("click", async () => {
    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;

    messageEl.textContent = "";

    if (!name || !email || !password) {
      messageEl.textContent = "Please fill in all fields.";
      messageEl.classList.add("auth-message--error");
      return;
    }

    try {
      await apiClient.register(name, email, password);
      messageEl.textContent =
        "Registration successful. You can sign in now.";
      messageEl.classList.remove("auth-message--error");
      messageEl.classList.add("auth-message--success");
    } catch (err) {
      messageEl.textContent = err.message || "Registration failed.";
      messageEl.classList.add("auth-message--error");
    }
  });

