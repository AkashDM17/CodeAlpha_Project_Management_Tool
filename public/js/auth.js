/**
 * TaskFlow Authentication Controller
 * Handles user login, registration, demo 1-click accounts, and session validation
 */

const Auth = {
  init() {
    this.bindEvents();
    this.checkSession();
  },

  bindEvents() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // Auth tab toggles
    const tabLogin = document.getElementById('tab-login-btn');
    const tabRegister = document.getElementById('tab-register-btn');
    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => this.switchTab('login'));
      tabRegister.addEventListener('click', () => this.switchTab('register'));
    }

    // Demo user quick login buttons
    const demoBtns = document.querySelectorAll('[data-demo-user]');
    demoBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.dataset.demoEmail;
        const password = btn.dataset.demoPassword || 'Demo123';
        this.quickLogin(email, password);
      });
    });

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Global auth expiration listener
    window.addEventListener('auth:expired', () => {
      App.showToast('Your session has expired. Please log in again.', 'warning');
      this.showAuthModal();
    });
  },

  switchTab(tab) {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    const tabLogin = document.getElementById('tab-login-btn');
    const tabRegister = document.getElementById('tab-register-btn');

    if (tab === 'login') {
      loginCard.classList.remove('hidden');
      registerCard.classList.add('hidden');
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
    } else {
      loginCard.classList.add('hidden');
      registerCard.classList.remove('hidden');
      tabLogin.classList.remove('active');
      tabRegister.classList.add('active');
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const identifierInput = document.getElementById('login-identifier');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit-btn');
    const errorEl = document.getElementById('login-error');

    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;

    if (!identifier || !password) {
      this.showError(errorEl, 'Please enter email/username and password');
      return;
    }

    this.setLoading(submitBtn, true, 'Signing in...');
    this.clearError(errorEl);

    try {
      const response = await API.login(identifier, password);
      if (response.success && response.data) {
        API.setToken(response.data.token);
        API.setCurrentUser(response.data.user);

        App.showToast(`Welcome back, ${response.data.user.name}!`, 'success');
        this.hideAuthModal();

        // Connect socket & boot app
        SocketManager.init();
        App.onUserLoggedIn(response.data.user);
      }
    } catch (err) {
      this.showError(errorEl, err.message || 'Login failed.');
    } finally {
      this.setLoading(submitBtn, false, 'Sign In');
    }
  },

  async quickLogin(email, password) {
    const loginCard = document.getElementById('login-card');
    if (loginCard.classList.contains('hidden')) {
      this.switchTab('login');
    }
    const identifierInput = document.getElementById('login-identifier');
    const passwordInput = document.getElementById('login-password');
    identifierInput.value = email;
    passwordInput.value = password;

    const fakeEvent = { preventDefault: () => {} };
    await this.handleLogin(fakeEvent);
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const submitBtn = document.getElementById('register-submit-btn');
    const errorEl = document.getElementById('register-error');

    if (!name || !username || !email || !password || !confirmPassword) {
      this.showError(errorEl, 'Please complete all fields.');
      return;
    }

    if (password !== confirmPassword) {
      this.showError(errorEl, 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      this.showError(errorEl, 'Password must be at least 6 characters.');
      return;
    }

    this.setLoading(submitBtn, true, 'Creating account...');
    this.clearError(errorEl);

    try {
      const response = await API.register(name, username, email, password, confirmPassword);
      if (response.success && response.data) {
        API.setToken(response.data.token);
        API.setCurrentUser(response.data.user);

        App.showToast(`Account created! Welcome, ${response.data.user.name}`, 'success');
        this.hideAuthModal();

        SocketManager.init();
        App.onUserLoggedIn(response.data.user);
      }
    } catch (err) {
      this.showError(errorEl, err.message || 'Registration failed.');
    } finally {
      this.setLoading(submitBtn, false, 'Create Account');
    }
  },

  async checkSession() {
    const token = API.getToken();
    if (!token) {
      this.showAuthModal();
      return;
    }

    try {
      const response = await API.getMe();
      if (response.success && response.data) {
        API.setCurrentUser(response.data.user);
        SocketManager.init();
        App.onUserLoggedIn(response.data.user);
        this.hideAuthModal();
      } else {
        this.handleLogout();
      }
    } catch (err) {
      console.warn('[Auth] Session check failed, requiring login');
      this.handleLogout();
    }
  },

  handleLogout() {
    API.clearAuth();
    SocketManager.disconnect();
    this.showAuthModal();
    App.showToast('You have been logged out.', 'info');
    App.onUserLoggedOut();
  },

  showAuthModal() {
    const authOverlay = document.getElementById('auth-overlay');
    const appShell = document.getElementById('app-shell');
    if (authOverlay) authOverlay.classList.remove('hidden');
    if (appShell) appShell.classList.add('blurred');
  },

  hideAuthModal() {
    const authOverlay = document.getElementById('auth-overlay');
    const appShell = document.getElementById('app-shell');
    if (authOverlay) authOverlay.classList.add('hidden');
    if (appShell) appShell.classList.remove('blurred');
  },

  showError(element, message) {
    if (element) {
      element.textContent = message;
      element.classList.remove('hidden');
    }
  },

  clearError(element) {
    if (element) {
      element.textContent = '';
      element.classList.add('hidden');
    }
  },

  setLoading(button, isLoading, text) {
    if (button) {
      button.disabled = isLoading;
      button.innerHTML = isLoading
        ? `<span class="spinner-sm"></span> <span>${text}</span>`
        : `<span>${text}</span>`;
    }
  }
};
