import { i18n } from './i18n.js';
import { StorageService, AUTHORIZED_OFFICERS, INDIAN_PORTS, ANTARCTICA_STATIONS, POLAR_VESSELS, EXPEDITION_ROUTES, CONSIGNMENT_STEPS, getConsignmentStep } from './data.js';
import { AuthAPI, ExpeditionsAPI, CargoAPI, InventoryAPI, PersonnelAPI, UsersAPI, AuditLogsAPI, FieldAPI, EmergencyAPI, DatabaseAdapter, exportTableToCsv, showNotification } from './api.js';
import { ROLES, ROLE_LABELS, ROLE_BADGE_CLASSES, PERMISSIONS, ROLE_PERMISSIONS, ROLE_VIEWS, hasPermission, canAccessView, getPermittedViews } from './permissions.js';
import { renderRoleDashboard } from './dashboard-views.js';
import { AnalyticsEngine } from './analytics.js';

class IceTrackApp {
  constructor() {
    this.currentLang = 'en';
    this.currentUser = null;
    this.currentOfficer = null;
    this.authorizedOfficers = AUTHORIZED_OFFICERS;
    this.timerInterval = null;
    this.analyticsEngine = null;

    // Geospatial Mapping Mode ('detailed' or 'globe')
    this.mapMode = 'detailed';
    this.detailedMap = null;
    this.dashboardMap = null;
    this.currentDetailedLayer = null;
    this.detailedLayers = {};

    // 3D Rotatable Polar Operations Globe State
    this.globe = {
      projection: null,
      svg: null,
      path: null,
      countries: null,
      currentRotation: [-75, 5, 0],
      currentScale: 280,
      baseScale: 280,
      isAutoRotating: false,
      autoRotateTimer: null,
      showGraticule: true,
      selectedTarget: null,
      isDragging: false,
      initialized: false,
      elements: {}
    };

    try {
      this.init();
    } catch (e) {
      console.warn('Non-fatal initialization warning in IceTrackApp:', e);
    }
  }

  init() {
    try { StorageService.init(); } catch (e) { console.warn('StorageService init warning:', e); }
    try {
      this.currentLang = StorageService.getLang();
      this.applyLanguage(this.currentLang);
    } catch (e) { console.warn('Language init warning:', e); }

    try { this.bindAuthEvents(); } catch (e) { console.warn('bindAuthEvents warning:', e); }
    try { this.bindNavigation(); } catch (e) { console.warn('bindNavigation warning:', e); }
    try { this.bindLanguageSwitch(); } catch (e) { console.warn('bindLanguageSwitch warning:', e); }
    try { this.initGovPortalUtilities(); } catch (e) { console.warn('initGovPortalUtilities warning:', e); }
    try { this.initWireframeCarousel(); } catch (e) { console.warn('initWireframeCarousel warning:', e); }
    try { this.updateClock(); } catch (e) { console.warn('updateClock warning:', e); }

    // Initialize the Analytics Engine
    try {
      this.analyticsEngine = new AnalyticsEngine();
      this.analyticsEngine.init();
    } catch (e) {
      console.warn('AnalyticsEngine init warning:', e);
    }

    // Restore or initialize active officer session from secure storage
    try {
      const savedUser = StorageService.getItem('icetrack_active_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.email && parsed.role) {
          this.currentOfficer = parsed;
          this.currentUser = parsed.role;
        }
      }
    } catch (e) {
      console.warn('Officer restore warning:', e);
    }

    if (this.currentOfficer && this.currentUser) {
      try {
        this.updateOfficerUI();
        this.applyRoleNavigationRestrictions();
      } catch (e) {
        console.warn('updateOfficerUI warning:', e);
      }
    }
  }

  // --- Auth & Language ---

  bindAuthEvents() {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const oldLogoutBtn = document.getElementById('oldLogoutBtn');

    if (loginForm && !loginForm.hasAttribute('data-bound')) {
      loginForm.setAttribute('data-bound', 'true');
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleLoginSubmit();
      });
    }

    if (logoutBtn && !logoutBtn.hasAttribute('data-bound')) {
      logoutBtn.setAttribute('data-bound', 'true');
      logoutBtn.addEventListener('click', () => this.logout());
    }
    if (oldLogoutBtn && !oldLogoutBtn.hasAttribute('data-bound')) {
      oldLogoutBtn.setAttribute('data-bound', 'true');
      oldLogoutBtn.addEventListener('click', () => this.logout());
    }

    // Password visibility toggle
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    if (togglePasswordBtn && !togglePasswordBtn.hasAttribute('data-bound')) {
      togglePasswordBtn.setAttribute('data-bound', 'true');
      togglePasswordBtn.addEventListener('click', (e) => {
        if (typeof window.toggleLoginPassword === 'function') {
          window.toggleLoginPassword(e);
        } else {
          const passInput = document.getElementById('loginPassword');
          const icon = document.getElementById('togglePasswordIcon');
          if (passInput) {
            if (passInput.type === 'password') {
              passInput.type = 'text';
              if (icon) icon.className = 'fa-solid fa-eye-slash';
            } else {
              passInput.type = 'password';
              if (icon) icon.className = 'fa-solid fa-eye';
            }
          }
        }
      });
    }
    const formCreateUser = document.getElementById('formCreateUser');
    if (formCreateUser && !formCreateUser.hasAttribute('data-bound')) {
      formCreateUser.setAttribute('data-bound', 'true');
      formCreateUser.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleCreateUserSubmit(e);
      });
    }
    const formUpdateLocation = document.getElementById('formUpdateLocation');
    if (formUpdateLocation && !formUpdateLocation.hasAttribute('data-bound')) {
      formUpdateLocation.setAttribute('data-bound', 'true');
      formUpdateLocation.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleUpdateLocationSubmit(e);
      });
    }
    const formReportProblem = document.getElementById('formReportProblem');
    if (formReportProblem && !formReportProblem.hasAttribute('data-bound')) {
      formReportProblem.setAttribute('data-bound', 'true');
      formReportProblem.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleReportProblemSubmit(e);
      });
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async handleLoginSubmit() {
    if (this._isLoggingIn) return;
    this._isLoggingIn = true;

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const roleInput = document.getElementById('loginRole');
    const userSelectMenu = document.getElementById('userSelectMenu');
    const alertBox = document.getElementById('loginAlert');

    const enteredEmail = (emailInput?.value || '').trim();
    const enteredPassword = (passwordInput?.value || '').trim();

    // Check for empty fields
    if (!enteredEmail || !enteredPassword) {
      this._isLoggingIn = false;
      this.showLoginError('Please enter both your official email ID and security password.');
      if (!enteredEmail && emailInput) {
        emailInput.focus();
      } else if (passwordInput) {
        passwordInput.focus();
      }
      return;
    }

    // Strictly authorize ONLY the official accounts provided by user
    const officialAuthorizedAccounts = {
      'a@gmail.com': { role: 'admin', pass: 'Admin@2026' },
      'e@gmail.com': { role: 'manager', pass: 'EM@2026' },
      'f@gmail.com': { role: 'field_officer', pass: 'FO@2026' },
      'l@gmail.com': { role: 'logistics_officer', pass: 'LO@2026' }
    };

    const targetAccount = officialAuthorizedAccounts[enteredEmail.toLowerCase()];
    if (!targetAccount) {
      this._isLoggingIn = false;
      this.showLoginError('Access Denied: Unauthorized Personnel. Email ID not registered in polar directory.');
      if (passwordInput) {
        passwordInput.value = '';
      }
      return;
    }

    if (enteredPassword !== targetAccount.pass) {
      this._isLoggingIn = false;
      this.showLoginError('Invalid security password. Access Denied: Unauthorized Personnel.');
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
      return;
    }

    try {
      // Pass verified credentials to AuthAPI
      const loginRes = await AuthAPI.login(enteredEmail, enteredPassword, targetAccount.role);
      const user = loginRes?.user || (loginRes?.role ? loginRes : null);
      if (user && user.role) {
        if (alertBox) alertBox.classList.add('d-none');
        if (passwordInput) passwordInput.value = '';
        this.login(user.role, user);
        showNotification(`Welcome back, ${user.name} (${user.designation || user.role}). Session secure.`, 'success', 'Identity Verified');
        return;
      }
    } catch (err) {
      console.warn('Authentication error:', err);
      const msg = err?.message || 'Access Denied: Unauthorized Personnel.';
      this.showLoginError(msg);
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
      return;
    } finally {
      setTimeout(() => {
        this._isLoggingIn = false;
      }, 1000);
    }

    // Invalid credentials fallback
    this.showLoginError('Invalid Email or Password. Access Denied: Unauthorized Personnel.');
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.focus();
    }
  }

  showLoginError(message) {
    const alertBox = document.getElementById('loginAlert');
    const alertText = document.getElementById('loginAlertText');

    if (alertBox && alertText) {
      alertText.textContent = message;
      alertBox.classList.remove('d-none');
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  login(role, officer = null) {
    this.currentUser = role;
    this.currentOfficer = officer || this.authorizedOfficers[0];

    // Store in persistent safe storage
    try {
      StorageService.setItem('icetrack_user_email', this.currentOfficer.email);
      StorageService.setItem('icetrack_user_name', this.currentOfficer.name);
      StorageService.setItem('icetrack_user_role', role);
      StorageService.setItem('icetrack_active_user', JSON.stringify(this.currentOfficer));
    } catch (e) {
      console.warn('StorageService session warning:', e);
    }

    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');

    if (loginSection) {
      loginSection.classList.remove('active');
      loginSection.classList.add('d-none');
      loginSection.style.setProperty('display', 'none', 'important');
    }
    
    if (appSection) {
      appSection.classList.remove('d-none');
      appSection.style.setProperty('display', 'flex', 'important');
    }

    try {
      this.updateOfficerUI(role);
      this.applyRoleNavigationRestrictions();
      this.renderRoleSpecificDashboard();
    } catch (e) {
      console.warn('Officer UI update warning:', e);
    }

    try {
      this.renderAll();
    } catch (e) {
      console.warn('renderAll execution warning:', e);
    }

    try {
      this.switchView('dashboard');
    } catch (e) {
      console.warn('Dashboard view switch warning:', e);
    }
  }

  logout() {
    this.currentUser = null;
    this.currentOfficer = null;
    try {
      AuthAPI.logout().catch(() => {});
      StorageService.removeItem('icetrack_user_role');
      StorageService.removeItem('icetrack_user_email');
      StorageService.removeItem('icetrack_user_name');
      StorageService.removeItem('icetrack_active_user');
      StorageService.removeItem('icetrack_auth_token');
    } catch {
      // ignore
    }

    const wheelWrapper = document.getElementById('commandWheel');
    if (wheelWrapper) {
      wheelWrapper.classList.remove('active');
    }

    const appSection = document.getElementById('appSection');
    const loginSection = document.getElementById('loginSection');

    if (appSection) {
      appSection.classList.add('d-none');
      appSection.style.setProperty('display', 'none', 'important');
    }
    if (loginSection) {
      loginSection.classList.remove('d-none');
      loginSection.classList.add('active');
      loginSection.style.setProperty('display', 'block', 'important');
    }

    const alertBox = document.getElementById('loginAlert');
    if (alertBox) alertBox.classList.add('d-none');

    const roleContainer = document.getElementById('roleDashboardContainer');
    if (roleContainer) roleContainer.innerHTML = '';

    const emailInput = document.getElementById('loginEmail');
    if (emailInput) emailInput.value = '';
    const passInput = document.getElementById('loginPassword');
    if (passInput) passInput.value = '';
    const userMenu = document.getElementById('userSelectMenu');
    if (userMenu) userMenu.value = '';
  }

  updateOfficerUI(role = this.currentUser) {
    if (!this.currentOfficer) return;

    const roleName = ROLE_LABELS[role] || this.currentOfficer.designation || 'Polar Officer';
    const roleBadgeClass = ROLE_BADGE_CLASSES[role] || 'bg-secondary';

    const displayRole = document.getElementById('displayRole');
    if (displayRole) {
      displayRole.innerHTML = `<span class="badge ${roleBadgeClass}">${this.currentOfficer.designation || roleName}</span>`;
    }

    // Update officer display info in navigation and headers
    const displayOfficerName = document.getElementById('displayOfficerName');
    if (displayOfficerName) displayOfficerName.textContent = this.currentOfficer.name;

    const displayOfficerEmail = document.getElementById('displayOfficerEmail');
    if (displayOfficerEmail) displayOfficerEmail.textContent = this.currentOfficer.email;

    const topbarUserName = document.getElementById('topbarUserName');
    if (topbarUserName) topbarUserName.textContent = this.currentOfficer.name;

    const topbarUserEmail = document.getElementById('topbarUserEmail');
    if (topbarUserEmail) {
      topbarUserEmail.innerHTML = `<span class="badge ${roleBadgeClass} me-1" style="font-size: 10px;">${roleName}</span> <span class="text-muted">${this.currentOfficer.station || ''}</span>`;
    }

    const topbarUserAvatar = document.getElementById('topbarUserAvatar');
    if (topbarUserAvatar) topbarUserAvatar.textContent = (this.currentOfficer.name || 'O').charAt(0).toUpperCase();

    // Update homepage hero section user email and role badge
    const homepageHeroUserEmail = document.getElementById('homepageHeroUserEmail');
    if (homepageHeroUserEmail) homepageHeroUserEmail.textContent = this.currentOfficer.email;

    const homepageHeroRoleBadge = document.getElementById('homepageHeroRoleBadge');
    if (homepageHeroRoleBadge) {
      homepageHeroRoleBadge.innerHTML = `<span class="badge ${roleBadgeClass}">${this.currentOfficer.designation || roleName}</span>`;
    }

    // Update homepage identity card in sidebar
    const homepageCardUserName = document.getElementById('homepageCardUserName');
    if (homepageCardUserName) homepageCardUserName.textContent = this.currentOfficer.name;

    const homepageCardUserEmail = document.getElementById('homepageCardUserEmail');
    if (homepageCardUserEmail) homepageCardUserEmail.textContent = this.currentOfficer.email;

    const homepageCardAvatar = document.getElementById('homepageCardAvatar');
    if (homepageCardAvatar) homepageCardAvatar.textContent = (this.currentOfficer.name || 'O').charAt(0).toUpperCase();

    const homepageCardClearance = document.getElementById('homepageCardClearance');
    if (homepageCardClearance) homepageCardClearance.textContent = `${this.currentOfficer.clearance || 'Level 3'} (${this.currentOfficer.station || 'Maitri'})`;
  }

  bindLanguageSwitch() {
    const btn = document.getElementById('langSwitchBtn');
    const topCheckbox = document.getElementById('topLangSwitchCheckbox');
    
    // Set initial toggle state based on current language
    if (topCheckbox) {
        topCheckbox.checked = this.currentLang === 'hi';
    }

    const toggleLang = () => {
        this.currentLang = this.currentLang === 'en' ? 'hi' : 'en';
        StorageService.setLang(this.currentLang);
        this.applyLanguage(this.currentLang);
        this.renderAll();
        
        // Sync checkbox if it exists
        if (topCheckbox) {
            topCheckbox.checked = this.currentLang === 'hi';
        }
    };

    if (btn) {
      btn.addEventListener('click', toggleLang);
    }
    if (topCheckbox) {
      topCheckbox.addEventListener('change', toggleLang);
    }
  }

  applyLanguage(lang) {
    const dict = i18n[lang];
    if (!dict) return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    const langLabel = document.getElementById('currentLangLabel');
    if (langLabel) {
      langLabel.textContent = lang === 'en' ? 'ENG' : 'HIN';
    }
    const topLangLabel = document.getElementById('topCurrentLangLabel');
    if (topLangLabel) {
      topLangLabel.textContent = lang === 'en' ? 'ENG' : 'HIN';
    }
  }

  updateClock() {
    const clockEl = document.getElementById('globalTime');
    const istEl = document.getElementById('dashLiveIST');
    const utcEl = document.getElementById('dashLiveUTC');

    const updateTimes = () => {
      const now = new Date();
      if (clockEl) {
        clockEl.textContent = now.toISOString().substring(11, 19) + ' UTC';
      }
      if (istEl) {
        istEl.textContent = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
      }
      if (utcEl) {
        utcEl.textContent = now.toISOString().substring(11, 19) + ' UTC';
      }
    };

    updateTimes();
    this.timerInterval = setInterval(updateTimes, 1000);
  }

  // --- Navigation & View Management ---

  bindNavigation() {
    document.querySelectorAll('.nav-link[data-target], .module-chip[data-target], .gov-top-nav-btn[data-target]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.currentTarget.getAttribute('data-target');
        this.switchView(target);
      });
    });

    const mobileToggle = document.getElementById('mobileMenuToggle');
    if (mobileToggle) {
      mobileToggle.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('show');
      });
    }

    // Close sidebar on mobile when clicking a link
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      link.addEventListener('click', () => {
        if(window.innerWidth <= 768) {
          document.querySelector('.sidebar').classList.remove('show');
        }
      });
    });

    // --- Command Wheel Logic (Mahoraga Floating Wheel) ---
    const wheelWrapper = document.getElementById('commandWheel');
    const wheelBtn = document.getElementById('commandWheelBtn');

    if (wheelBtn && wheelWrapper) {
      wheelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        wheelWrapper.classList.toggle('active');
      });
      // Close wheel when clicking outside
      document.addEventListener('click', (e) => {
        if (!wheelWrapper.contains(e.target)) {
          wheelWrapper.classList.remove('active');
        }
      });
    }

    // Expose global quickNavigate helper
    window.quickNavigate = (viewId) => this.quickNavigate(viewId);

    // --- Mode Switcher (Detailed Map vs 3D Globe) ---
    const btnDetailed = document.getElementById('btnModeDetailed');
    const btnGlobe = document.getElementById('btnModeGlobe');
    if (btnDetailed) {
      btnDetailed.addEventListener('click', () => this.setMapMode('detailed'));
    }
    if (btnGlobe) {
      btnGlobe.addEventListener('click', () => this.setMapMode('globe'));
    }
  }

  quickNavigate(viewId) {
    const wheelWrapper = document.getElementById('commandWheel');
    if (wheelWrapper) wheelWrapper.classList.remove('active');

    // If currently on landing / login section, transition to application first
    if (!this.currentUser) {
      const defaultOfficer = this.authorizedOfficers[0];
      this.login(defaultOfficer.defaultRole || 'manager', defaultOfficer);
    }
    this.switchView(viewId);
  }

  switchView(viewId) {
    // RBAC Route Protection Gate
    if (this.currentUser && !canAccessView(this.currentUser, viewId)) {
      const roleLabel = ROLE_LABELS[this.currentUser] || this.currentUser;
      this.showAccessDenied(viewId, `Your authenticated clearance (${roleLabel}) is restricted from accessing the ${viewId.toUpperCase()} module under institutional security protocol.`);
      return;
    }

    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
      if (view.id !== `view-${viewId}`) {
        view.classList.remove('active');
        setTimeout(() => {
          if (!view.classList.contains('active')) {
             view.classList.add('d-none');
          }
        }, 300); // small delay for animation if needed
      }
    });

    // Remove active class from nav links & top buttons
    document.querySelectorAll('.nav-link, .gov-top-nav-btn').forEach(link => {
      link.classList.remove('active');
    });

    // Show target view
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
      targetView.classList.remove('d-none');
      // small delay to allow display:block to apply before animating opacity
      setTimeout(() => {
        targetView.classList.add('active');
        if (viewId === 'dashboard') {
          this.renderRoleSpecificDashboard();
          this.renderWireframeSlide();
          if (this.dashboardMap) {
            setTimeout(() => this.dashboardMap?.invalidateSize(), 80);
          } else {
            this.initDashboardMap();
          }
        } else if (viewId === 'map') {
          if (this.mapMode === 'detailed') {
            if (!this.detailedMap) {
              this.initDetailedMap();
            } else {
              setTimeout(() => this.detailedMap?.invalidateSize(), 80);
            }
          } else {
            if (!this.globe.initialized) {
              this.initGlobe();
            } else {
              this.resizeGlobe();
            }
          }
        } else if (viewId === 'analytics') {
          if (!this.analyticsEngine) {
            this.analyticsEngine = new AnalyticsEngine();
          }
          this.analyticsEngine.init();
        }
      }, 50);
    }

    // Activate corresponding nav links
    document.querySelectorAll(`.nav-link[data-target="${viewId}"], .gov-top-nav-btn[data-target="${viewId}"]`).forEach(link => {
      link.classList.add('active');
    });
    const targetLink = document.querySelector(`.nav-link[data-target="${viewId}"]`);
    if (targetLink) {
      // Update page title
      const pageTitle = document.getElementById('pageTitle');
      if (pageTitle) {
        pageTitle.textContent = targetLink.textContent.trim();
      }
    }
  }

  showAccessDenied(attemptedModule, reason) {
    const officerName = this.currentOfficer?.name || 'Unauthenticated Officer';
    const officerRole = this.currentUser || 'Guest';

    const nameEl = document.getElementById('deniedOfficerName');
    const roleEl = document.getElementById('deniedOfficerRole');
    const modEl = document.getElementById('deniedAttemptedModule');
    const expEl = document.getElementById('accessDeniedExplanation');

    if (nameEl) nameEl.textContent = officerName;
    if (roleEl) {
      roleEl.textContent = (ROLE_LABELS[officerRole] || officerRole).toUpperCase();
      roleEl.className = `badge ${ROLE_BADGE_CLASSES[officerRole] || 'bg-secondary'}`;
    }
    if (modEl) modEl.textContent = String(attemptedModule).toUpperCase();
    if (expEl && reason) {
      expEl.textContent = reason;
    }

    const modalEl = document.getElementById('modalAccessDenied');
    if (modalEl && typeof bootstrap !== 'undefined') {
      const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  applyRoleNavigationRestrictions() {
    const role = this.currentUser;
    if (!role) return;

    // Filter sidebar and topbar nav links
    document.querySelectorAll('[data-target]').forEach(el => {
      const target = el.getAttribute('data-target');
      if (!target) return;
      if (canAccessView(role, target)) {
        el.classList.remove('d-none');
        if (el.closest('.nav-item')) {
          el.closest('.nav-item').classList.remove('d-none');
        }
        if (el.closest('.gov-top-nav-item')) {
          el.closest('.gov-top-nav-item').classList.remove('d-none');
        }
      } else {
        el.classList.add('d-none');
        if (el.closest('.nav-item')) {
          el.closest('.nav-item').classList.add('d-none');
        }
        if (el.closest('.gov-top-nav-item')) {
          el.closest('.gov-top-nav-item').classList.add('d-none');
        }
      }
    });

    // Wireframe drawer navigation links filtering
    document.querySelectorAll('.wireframe-drawer-link').forEach(link => {
      const onclick = link.getAttribute('onclick') || '';
      const match = onclick.match(/drawerNavigate\(['"]([^'"]+)['"]\)/);
      if (match && match[1]) {
        const target = match[1];
        if (canAccessView(role, target)) {
          link.classList.remove('d-none');
        } else {
          link.classList.add('d-none');
        }
      }
    });

    // Expeditions: If user cannot create missions, hide planning form & expand table
    const colPlanExp = document.getElementById('colPlanExpedition');
    const colExpTable = document.getElementById('colExpeditionsTable');
    const expBanner = document.getElementById('expeditionReadOnlyBanner');
    const btnPlanExp = document.getElementById('btnPlanExpedition') || document.querySelector('[data-bs-target="#modalPlanExpedition"]');

    if (hasPermission(role, 'expeditions.create')) {
      if (colPlanExp) colPlanExp.classList.remove('d-none');
      if (colExpTable) {
        colExpTable.classList.remove('col-lg-12');
        colExpTable.classList.add('col-lg-8');
      }
      if (expBanner) expBanner.classList.add('d-none');
      if (btnPlanExp) btnPlanExp.classList.remove('d-none');
    } else {
      if (colPlanExp) colPlanExp.classList.add('d-none');
      if (colExpTable) {
        colExpTable.classList.remove('col-lg-8');
        colExpTable.classList.add('col-lg-12');
      }
      if (expBanner) expBanner.classList.remove('d-none');
      if (btnPlanExp) btnPlanExp.classList.add('d-none');
    }

    // Cargo action controls
    const btnAddCargo = document.getElementById('btnRegisterCargo') || document.querySelector('[data-bs-target="#modalAddCargo"]');
    if (btnAddCargo) {
      if (hasPermission(role, 'cargo.create')) {
        btnAddCargo.classList.remove('d-none');
      } else {
        btnAddCargo.classList.add('d-none');
      }
    }

    const btnUpdateCargo = document.getElementById('btnUpdateCargo');
    if (btnUpdateCargo) {
      if (hasPermission(role, 'cargo.update') && hasPermission(role, 'cargo.dispatch')) {
        btnUpdateCargo.classList.remove('d-none');
      } else {
        btnUpdateCargo.classList.add('d-none');
      }
    }

    // Inventory action controls
    const btnAddInventory = document.getElementById('btnAddInventory') || document.querySelector('[data-bs-target="#modalAddInventory"]');
    if (btnAddInventory) {
      if (hasPermission(role, 'inventory.manage')) {
        btnAddInventory.classList.remove('d-none');
      } else {
        btnAddInventory.classList.add('d-none');
      }
    }

    // Personnel action controls
    const btnAddPersonnel = document.getElementById('btnAddPersonnel') || document.querySelector('[data-bs-target="#modalAddPersonnel"]');
    if (btnAddPersonnel) {
      if (hasPermission(role, 'personnel.manage')) {
        btnAddPersonnel.classList.remove('d-none');
      } else {
        btnAddPersonnel.classList.add('d-none');
      }
    }
  }

  renderRoleSpecificDashboard() {
    const container = document.getElementById('roleDashboardContainer');
    if (container) {
      container.innerHTML = '';
      container.classList.add('d-none');
    }

    // Ensure the clean wireframe homepage is always fully displayed
    const wireframeHomepage = document.getElementById('wireframeHomepage');
    if (wireframeHomepage) {
      wireframeHomepage.classList.remove('d-none');
    }
  }

  handleUserMenuSelect(role) {
    const roleInput = document.getElementById('loginRole');
    const alertBox = document.getElementById('loginAlert');
    if (alertBox) alertBox.classList.add('d-none');

    if (!role) {
      if (roleInput) roleInput.value = 'auto';
      return;
    }

    if (roleInput) roleInput.value = role;
  }

  fillTestCredentials(email, password) {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = password;
    const alertBox = document.getElementById('loginAlert');
    if (alertBox) alertBox.classList.add('d-none');
  }

  async handleCreateUserSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (this._isSubmittingUser) return;
    this._isSubmittingUser = true;

    const name = document.getElementById('newUserName')?.value;
    const email = document.getElementById('newUserEmail')?.value;
    const password = document.getElementById('newUserPassword')?.value;
    const role = document.getElementById('newUserRole')?.value;
    const station = document.getElementById('newUserStation')?.value;
    const designation = document.getElementById('newUserDesignation')?.value;
    const clearance = document.getElementById('newUserClearance')?.value;
    const assignedExpedition = document.getElementById('newUserExpedition')?.value;

    try {
      const res = await UsersAPI.create({
        name, email, password, role, station, designation, clearance, assignedExpedition
      });
      if (res && res.success) {
        const modalEl = document.getElementById('modalCreateUser');
        if (modalEl && typeof bootstrap !== 'undefined') {
          const m = bootstrap.Modal.getInstance(modalEl);
          if (m) m.hide();
        }
        document.getElementById('formCreateUser')?.reset();
        await this.refreshAdminUsers();
        showNotification(`Account provisioned successfully for ${name} (${role})!`, 'success', 'User Registered');
      } else {
        showNotification(res?.error || 'Failed to create user account', 'error', 'Provisioning Failed');
      }
    } catch (e) {
      showNotification('Error creating account: ' + (e.message || e), 'error', 'System Error');
    } finally {
      setTimeout(() => { this._isSubmittingUser = false; }, 800);
    }
  }

  async handleUpdateUserRole(userId, newRole) {
    try {
      const res = await UsersAPI.assignRole(userId, newRole);
      if (res && res.success) {
        await this.refreshAdminUsers();
        showNotification(`Updated role for user ${userId} to ${newRole}`, 'success', 'RBAC Updated');
      } else {
        showNotification(res?.error || 'Failed to update user role', 'error', 'Permission Error');
      }
    } catch (e) {
      showNotification('Error updating role: ' + (e.message || e), 'error', 'System Error');
    }
  }

  async refreshAdminUsers() {
    try {
      const res = await UsersAPI.getAll();
      const tbody = document.getElementById('adminUsersTableBody');
      if (tbody && res && res.data) {
        tbody.innerHTML = res.data.map(u => {
          const roleBadges = {
            admin: '<span class="badge bg-danger">Administrator</span>',
            manager: '<span class="badge bg-primary">Expedition Manager</span>',
            field_officer: '<span class="badge bg-info text-dark">Field/Research Officer</span>',
            logistics_officer: '<span class="badge bg-success">Logistics Officer</span>'
          };
          return `
            <tr>
              <td class="ps-3">
                <div class="fw-bold text-dark">${u.name}</div>
                <div class="text-muted font-monospace" style="font-size: 11px;">${u.email}</div>
              </td>
              <td>
                <div class="mb-1">${roleBadges[u.role] || u.role}</div>
                <select class="form-select form-select-sm" style="font-size: 11px; max-width: 170px;" onchange="window.IceTrack.handleUpdateUserRole('${u.id}', this.value)">
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator</option>
                  <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Expedition Manager</option>
                  <option value="field_officer" ${u.role === 'field_officer' ? 'selected' : ''}>Field/Research Officer</option>
                  <option value="logistics_officer" ${u.role === 'logistics_officer' ? 'selected' : ''}>Logistics Officer</option>
                </select>
              </td>
              <td>
                <div class="fw-semibold text-dark">${u.station || 'Maitri'}</div>
                <small class="text-muted">${u.jurisdiction || 'Polar Station'}</small>
              </td>
              <td>
                <span class="badge bg-light text-dark border">${u.clearance || 'Level 3'}</span>
              </td>
              <td>
                <small class="text-muted d-inline-block text-truncate" style="max-width: 180px;" title="${u.assignedExpedition || ''}">
                  ${u.assignedExpedition || '44th Indian Scientific Expedition'}
                </small>
              </td>
              <td class="pe-3 text-end">
                <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="window.IceTrackNotify && window.IceTrackNotify('User ID: ${u.id}\\nRole: ${u.role}\\nEmail: ${u.email}', 'info', 'Personnel Dossier')">
                  <i class="fa-solid fa-circle-info"></i>
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (e) {
      console.warn('refreshAdminUsers warning:', e);
    }
  }

  async loadAuditLogs() {
    try {
      const res = await AuditLogsAPI.getAll();
      const tbody = document.getElementById('auditLogsTableBody');
      if (tbody && res && res.data) {
        tbody.innerHTML = res.data.map(log => `
          <tr>
            <td class="text-muted font-monospace" style="font-size: 11px;">${new Date(log.timestamp).toLocaleTimeString()}</td>
            <td><span class="badge bg-dark">${log.action}</span></td>
            <td class="fw-bold text-dark">${log.actorEmail}</td>
            <td><span class="badge bg-secondary">${log.actorRole}</span></td>
            <td class="small text-muted">${log.details}</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('loadAuditLogs error:', e);
    }
  }

  async handleUpdateLocationSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (this._isSubmittingLocation) return;
    this._isSubmittingLocation = true;

    const lat = document.getElementById('fieldLat')?.value;
    const lon = document.getElementById('fieldLon')?.value;
    const sector = document.getElementById('fieldSector')?.value;
    const statusNotes = document.getElementById('fieldMovementNotes')?.value;

    try {
      const res = await FieldAPI.updateLocation({
        latitude: lat,
        longitude: lon,
        sector,
        statusNotes
      });
      if (res && res.success) {
        const modalEl = document.getElementById('modalUpdateLocation');
        if (modalEl && typeof bootstrap !== 'undefined') {
          const m = bootstrap.Modal.getInstance(modalEl);
          if (m) m.hide();
        }
        const coordsEl = document.getElementById('dashFieldCoords');
        if (coordsEl) coordsEl.textContent = lat;
        const lonEl = document.getElementById('dashFieldLon');
        if (lonEl) lonEl.textContent = `${lon} (${sector || 'Active Sector'})`;
        showNotification('Field GPS coordinates transmitted successfully over GSAT-7A satcom link!', 'success', 'Satcom Uplink');
      }
    } catch (e) {
      showNotification('Error transmitting coordinates: ' + (e.message || e), 'error', 'Transmission Failed');
    } finally {
      setTimeout(() => { this._isSubmittingLocation = false; }, 800);
    }
  }

  async updateFieldMissionStatus(newStatus) {
    try {
      const expRes = await ExpeditionsAPI.getAll();
      if (expRes && expRes.data && expRes.data.length > 0) {
        const myExp = expRes.data.find(e => e.station.toLowerCase().includes('dakshin')) || expRes.data[0];
        await ExpeditionsAPI.update(myExp.id, { fieldStatus: newStatus });
      }
    } catch (e) {
      console.warn('updateFieldMissionStatus error:', e);
    }
  }

  async handleFieldObservationSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (this._isSubmittingObs) return;
    this._isSubmittingObs = true;

    const depth = document.getElementById('obsDepth')?.value;
    const temp = document.getElementById('obsTemp')?.value;
    const notes = document.getElementById('obsNotes')?.value;

    try {
      const res = await FieldAPI.submitObservation({
        surfaceTemp: temp,
        notes: `Depth: ${depth} • Notes: ${notes}`
      });
      if (res && res.success) {
        showNotification('Scientific observation logged and transmitted to NCPOR database!', 'success', 'Observation Logged');
        this.renderRoleSpecificDashboard();
      }
    } catch (e) {
      showNotification('Error submitting observation: ' + (e.message || e), 'error', 'Submission Failed');
    } finally {
      setTimeout(() => { this._isSubmittingObs = false; }, 800);
    }
  }

  async handleReportProblemSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (this._isSubmittingProblem) return;
    this._isSubmittingProblem = true;

    const item = document.getElementById('reportItemSelect')?.value;
    const severity = document.getElementById('reportSeverity')?.value;
    const desc = document.getElementById('reportDescription')?.value;

    try {
      await InventoryAPI.reportProblem(1, { item, severity, desc });
      const modalEl = document.getElementById('modalReportProblem');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const m = bootstrap.Modal.getInstance(modalEl);
        if (m) m.hide();
      }
      document.getElementById('formReportProblem')?.reset();
      showNotification(`Problem report for ${item} submitted to Logistics Command.`, 'warning', 'Deficiency Reported');
    } catch (e) {
      showNotification('Error reporting problem: ' + (e.message || e), 'error', 'Submission Failed');
    } finally {
      setTimeout(() => { this._isSubmittingProblem = false; }, 800);
    }
  }

  // --- Minimalist Wireframe Homepage Logic (Directly Inspired by Uploaded Diagram) ---
  initWireframeCarousel() {
    this.wireframeSlideIndex = 0;
    this.wireframeSlides = [
      {
        title: "RV Sagar Nidhi — Southern Ocean Transit",
        subtitle: "Antarctic Resupply Vessel (ISEA-44 Logistics Voyage)",
        badge: "EXPEDITION ACTIVE",
        badgeClass: "bg-success text-white",
        icon: "fa-ship",
        iconColor: "text-primary",
        description: "Ice-class cargo carrier transporting 124 MT of arctic low-temp diesel, high-altitude rations, and deep ice-drilling sensors. Currently holding course at 54°12'S 68°30'E toward Prydz Bay.",
        metric1: { label: "Speed", value: "14.2 kts" },
        metric2: { label: "Cargo Buffer", value: "94% Optimal" },
        actionText: "Track Vessel in Cargo ↗",
        actionView: "cargo"
      },
      {
        title: "Maitri Station — Schirmacher Oasis Telemetry",
        subtitle: "India's Inland Polar Research Hub (70°45'S 11°44'E)",
        badge: "BLIZZARD LEVEL-2",
        badgeClass: "bg-warning text-dark",
        icon: "fa-snowflake",
        iconColor: "text-info",
        description: "Atmospheric aerosol monitoring and deep permafrost thermal profiling. Ambient temperature is -24.2°C with katabatic gusts to 48 kts. Heating life support fully stabilized.",
        metric1: { label: "Wintering Crew", value: "18 Scientists" },
        metric2: { label: "Life Support", value: "275 Days" },
        actionText: "View Station in Map ↗",
        actionView: "map"
      },
      {
        title: "Bharati Station — Larsemann Hills Space Relay",
        subtitle: "Coastal Station & High-Latitude Earth Observation Base",
        badge: "SATCOM OPTIMAL",
        badgeClass: "bg-primary text-white",
        icon: "fa-satellite-dish",
        iconColor: "text-success",
        description: "Continuous polar satellite downlink via ISRO GSAT-7A transponder. Utilizing co-generation wind and solar power with zero uninterrupted communication downtime.",
        metric1: { label: "Data Uplink", value: "99.98% Transponder" },
        metric2: { label: "Deployed Crew", value: "28 Personnel" },
        actionText: "Check Telemetry Analytics ↗",
        actionView: "analytics"
      }
    ];

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('wireframeStationsDropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });

    this.renderWireframeSlide();
  }

  renderWireframeSlide() {
    const container = document.getElementById('wireframeSlideDisplay');
    if (!container || !this.wireframeSlides) return;

    const slide = this.wireframeSlides[this.wireframeSlideIndex];
    if (!slide) return;

    container.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="badge ${slide.badgeClass}" style="font-size: 0.68rem; font-weight: 700;">${slide.badge}</span>
        <span class="text-muted font-monospace" style="font-size: 0.75rem;">MISSION ${this.wireframeSlideIndex + 1} OF ${this.wireframeSlides.length}</span>
      </div>
      <div class="mb-2">
        <i class="fa-solid ${slide.icon} ${slide.iconColor}" style="font-size: 2.2rem;"></i>
      </div>
      <h5 class="fw-bold text-dark mb-1">${slide.title}</h5>
      <div class="text-muted small mb-2">${slide.subtitle}</div>
      <p class="text-secondary small mb-3" style="max-width: 540px; line-height: 1.5;">${slide.description}</p>
      
      <div class="d-flex align-items-center gap-3 mb-3 font-monospace small bg-white border border-dark px-3 py-1">
        <div><strong>${slide.metric1.label}:</strong> <span class="text-primary">${slide.metric1.value}</span></div>
        <div class="text-muted">|</div>
        <div><strong>${slide.metric2.label}:</strong> <span class="text-success">${slide.metric2.value}</span></div>
      </div>

      <button class="btn btn-sm btn-dark px-3 fw-bold rounded-0" onclick="window.IceTrack.switchView('${slide.actionView}')">
        ${slide.actionText}
      </button>
    `;

    // Update dots
    const dots = document.querySelectorAll('#wireframeCarouselDots .wireframe-dot');
    dots.forEach((dot, idx) => {
      if (idx === this.wireframeSlideIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  nextWireframeSlide() {
    if (!this.wireframeSlides) return;
    this.wireframeSlideIndex = (this.wireframeSlideIndex + 1) % this.wireframeSlides.length;
    this.renderWireframeSlide();
  }

  prevWireframeSlide() {
    if (!this.wireframeSlides) return;
    this.wireframeSlideIndex = (this.wireframeSlideIndex - 1 + this.wireframeSlides.length) % this.wireframeSlides.length;
    this.renderWireframeSlide();
  }

  setWireframeSlide(idx) {
    if (!this.wireframeSlides || idx < 0 || idx >= this.wireframeSlides.length) return;
    this.wireframeSlideIndex = idx;
    this.renderWireframeSlide();
  }

  toggleWireframeDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('wireframeStationsDropdown');
    if (dropdown) {
      dropdown.classList.toggle('open');
    }
  }

  toggleWireframeDrawer() {
    const drawer = document.getElementById('wireframeDrawer');
    const backdrop = document.getElementById('wireframeDrawerBackdrop');
    if (drawer && backdrop) {
      drawer.classList.toggle('show');
      backdrop.classList.toggle('show');
    }
  }

  closeWireframeDrawer() {
    const drawer = document.getElementById('wireframeDrawer');
    const backdrop = document.getElementById('wireframeDrawerBackdrop');
    if (drawer && backdrop) {
      drawer.classList.remove('show');
      backdrop.classList.remove('show');
    }
  }

  drawerNavigate(viewId) {
    this.closeWireframeDrawer();
    this.switchView(viewId);
  }

  // Official Gazette Modal / Notification
  showGovGazetteModal() {
    showNotification(
      '• NCPOR/POLAR/2026/044: Winter fuel rationing & emergency heating fuel reserve cleared for Maitri.\n• MoES/ISEA44/MAR/012: RV Sagar Nidhi departure clearance from Mormugao Port.\n• ISRO/SATCOM/7A/99: Polar transponder frequency security update.',
      'info',
      'Official Gazette Directives'
    );
  }

  // Download Gazette PDF action
  downloadGazettePDF(circularNo) {
    showNotification(
      `Generating sealed MoES/NCPOR clearance docket for circular: ${circularNo}\nDigital Signature: VALID (STQC / NIC SHA-256)\nStatus: Ready for Field Download.`,
      'success',
      'Official Document Verified'
    );
  }

  // Quick Dispatch Action
  triggerDispatchAction(type) {
    if (type === 'advisory') {
      showNotification('Advisory Level-2 Blizzard Warning transmitted to Maitri and Dakshin Camp via GSAT-7A transponder. Station wintering crew notified.', 'warning', 'Station Advisory Issued');
    } else if (type === 'fuel') {
      showNotification('Directive logged with NCPOR Polar Wing. Cryogenic reserve heating allocation locked for 275 sub-zero operating days.', 'info', 'Cryo-Fuel Rationing Authorized');
    }
  }

  // SATCOM Ping Action
  triggerSatcomPing() {
    showNotification('Target: Antarctic Station Relay Transponder CH-12\nLatency: 98 ms\nSignal Integrity: 99.98% Optimal\nStatus: SECURE TELEMETRY ACTIVE', 'success', 'GSAT-7A Mil-Satcom Uplink');
  }

  // --- Rendering & Logic ---

  renderAll() {
    try { this.renderDashboardMetrics(); } catch (e) { console.warn('renderDashboardMetrics warning:', e); }
    try { this.renderExpeditions(); } catch (e) { console.warn('renderExpeditions warning:', e); }
    try { this.renderCargo(); } catch (e) { console.warn('renderCargo warning:', e); }
    try { this.renderInventory(); } catch (e) { console.warn('renderInventory warning:', e); }
    try { this.renderPersonnel(); } catch (e) { console.warn('renderPersonnel warning:', e); }
    try { this.renderHomepagePersonnelLocations(); } catch (e) { console.warn('renderHomepagePersonnelLocations warning:', e); }
    try { this.bindForms(); } catch (e) { console.warn('bindForms warning:', e); }
    try { this.initDashboardMap(); } catch (e) { console.warn('initDashboardMap warning:', e); }
    try { this.initMap(); } catch (e) { console.warn('initMap warning:', e); }
    try {
      if (this.analyticsEngine) {
        this.analyticsEngine.render();
      }
    } catch (e) {
      console.warn('AnalyticsEngine render warning:', e);
    }
  }

  // --- Geospatial Command & Map Orchestration ---

  setMapMode(mode) {
    this.mapMode = mode;
    const btnDetailed = document.getElementById('btnModeDetailed');
    const btnGlobe = document.getElementById('btnModeGlobe');
    const leafletCont = document.getElementById('leafletMapContainer');
    const globeCont = document.getElementById('d3MapContainer');
    const layerGroup = document.getElementById('leafletLayerGroup');
    const globeControls = document.getElementById('globeSpecificControls');
    const mapHeading = document.getElementById('mapMainHeading');
    const mapHint = document.getElementById('mapModeHint');

    if (mode === 'detailed') {
      btnDetailed?.classList.add('active', 'btn-primary');
      btnDetailed?.classList.remove('btn-outline-primary');
      btnGlobe?.classList.remove('active', 'btn-primary');
      btnGlobe?.classList.add('btn-outline-primary');

      leafletCont?.classList.remove('d-none');
      globeCont?.classList.add('d-none');
      layerGroup?.classList.remove('d-none');
      globeControls?.classList.add('d-none');

      if (mapHeading) mapHeading.textContent = 'Polar Operations Geospatial Command (Detailed Map)';
      if (mapHint) mapHint.innerHTML = '<i class="fa-solid fa-circle-info text-warning me-1"></i> Interactive Detailed Map &bull; Click any port or station for intelligence dossier &bull; Zoom into berths';

      if (!this.detailedMap) {
        this.initDetailedMap();
      } else {
        setTimeout(() => this.detailedMap?.invalidateSize(), 80);
      }
    } else {
      btnGlobe?.classList.add('active', 'btn-primary');
      btnGlobe?.classList.remove('btn-outline-primary');
      btnDetailed?.classList.remove('active', 'btn-primary');
      btnDetailed?.classList.add('btn-outline-primary');

      globeCont?.classList.remove('d-none');
      leafletCont?.classList.add('d-none');
      globeControls?.classList.remove('d-none');
      layerGroup?.classList.add('d-none');

      if (mapHeading) mapHeading.textContent = 'Rotatable 3D Polar Operations Globe (India & Antarctica)';
      if (mapHint) mapHint.innerHTML = '<i class="fa-solid fa-hand-pointer text-warning me-1"></i> Click & drag in any direction to rotate 3D globe &bull; Scroll to zoom &bull; Click markers for dossier';

      if (!this.globe.initialized) {
        this.initGlobe();
      } else {
        this.resizeGlobe();
      }
    }
  }

  initMap() {
    this.populateLocationPills();
    this.bindGlobeControls();

    if (this.mapMode === 'detailed') {
      this.initDetailedMap();
    } else {
      this.initGlobe();
    }

    // Default dossier briefing
    this.showLocationDossier(INDIAN_PORTS[0]);
  }

  // --- Detailed Leaflet Map (Geospatial View) ---
  initDetailedMap() {
    const container = document.getElementById('leafletMapContainer');
    if (!container || this.detailedMap || typeof L === 'undefined') return;

    try {
      const map = L.map('leafletMapContainer', {
        center: [-10, 75],
        zoom: 3,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      // Base layers (including Google Maps Hybrid & Road)
      const googleHybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      });
      const googleRoadLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      });
      const oceanLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 13 });
      const voyagerLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' });
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 });

      googleHybridLayer.addTo(map);
      this.currentDetailedLayer = googleHybridLayer;
      this.detailedLayers = { 
        googleHybrid: googleHybridLayer,
        googleRoad: googleRoadLayer,
        ocean: oceanLayer, 
        voyager: voyagerLayer, 
        satellite: satelliteLayer 
      };

      // Layer buttons
      const btnGHybrid = document.getElementById('btnLayerGoogleHybrid');
      const btnGRoad = document.getElementById('btnLayerGoogleRoad');
      const btnOcean = document.getElementById('btnLayerOcean');
      const btnVoyager = document.getElementById('btnLayerVoyager');
      const btnSat = document.getElementById('btnLayerSatellite');
      const allLayerBtns = [btnGHybrid, btnGRoad, btnOcean, btnVoyager, btnSat];

      const setLayer = (name, activeBtn) => {
        allLayerBtns.forEach(b => {
          b?.classList.remove('active', 'btn-primary');
          b?.classList.add('btn-outline-secondary');
        });
        activeBtn?.classList.add('active', 'btn-primary');
        activeBtn?.classList.remove('btn-outline-secondary');

        if (this.currentDetailedLayer) {
          map.removeLayer(this.currentDetailedLayer);
        }
        this.currentDetailedLayer = this.detailedLayers[name];
        this.currentDetailedLayer.addTo(map);
      };

      btnGHybrid?.addEventListener('click', () => setLayer('googleHybrid', btnGHybrid));
      btnGRoad?.addEventListener('click', () => setLayer('googleRoad', btnGRoad));
      btnOcean?.addEventListener('click', () => setLayer('ocean', btnOcean));
      btnVoyager?.addEventListener('click', () => setLayer('voyager', btnVoyager));
      btnSat?.addEventListener('click', () => setLayer('satellite', btnSat));

      // Shipping Lanes
      EXPEDITION_ROUTES.forEach(route => {
        const latlngs = route.coordinates.map(coord => [coord[1], coord[0]]);
        const polyline = L.polyline(latlngs, {
          color: '#0284c7',
          weight: 3.5,
          dashArray: '8, 8',
          opacity: 0.85
        }).addTo(map);
        polyline.bindTooltip(`<b>${route.name}</b>`, { sticky: true });
      });

      // Indian Ports (8)
      INDIAN_PORTS.forEach(port => {
        const icon = L.divIcon({
          className: 'leaflet-custom-marker',
          html: `<div class="tactical-marker-pin port-pin" title="${port.name}">
                  <i class="fa-solid fa-anchor" style="font-size: 13px;"></i>
                  <div class="tactical-pulse-ring"></div>
                 </div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const marker = L.marker([port.lat, port.lon], { icon }).addTo(map);
        marker.on('click', () => this.showLocationDossier(port));
        marker.bindPopup(`
          <div class="tactical-map-popup p-1" style="min-width: 220px;">
            <div class="tactical-popup-header d-flex justify-content-between align-items-center mb-1">
              <strong class="text-warning"><i class="fa-solid fa-anchor me-1"></i>${port.name}</strong>
              <span class="badge bg-warning text-dark" style="font-size: 0.65rem;">PORT</span>
            </div>
            <div class="small text-light mb-1">${port.category || port.state}</div>
            <div class="small text-muted font-monospace mb-2">${port.lat.toFixed(3)}°N, ${port.lon.toFixed(3)}°E</div>
            <div class="small text-info mb-2"><i class="fa-solid fa-boxes-packing me-1"></i>${port.activeOps}</div>
            <button class="btn btn-xs btn-primary w-100" onclick="window.IceTrack.showLocationDossierById('port', '${port.id}')">
              <i class="fa-solid fa-circle-info me-1"></i> Open Dossier
            </button>
          </div>
        `);
      });

      // Antarctic Stations (4)
      ANTARCTICA_STATIONS.forEach(station => {
        const icon = L.divIcon({
          className: 'leaflet-custom-marker',
          html: `<div class="tactical-marker-pin base-pin" title="${station.name}">
                  <i class="fa-solid fa-snowflake" style="font-size: 13px;"></i>
                  <div class="tactical-pulse-ring"></div>
                 </div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const marker = L.marker([station.lat, station.lon], { icon }).addTo(map);
        marker.on('click', () => this.showLocationDossier(station));
        marker.bindPopup(`
          <div class="tactical-map-popup p-1" style="min-width: 220px;">
            <div class="tactical-popup-header d-flex justify-content-between align-items-center mb-1">
              <strong class="text-info"><i class="fa-solid fa-snowflake me-1"></i>${station.name}</strong>
              <span class="badge bg-info text-dark" style="font-size: 0.65rem;">${station.status?.split('•')[0] || 'STATION'}</span>
            </div>
            <div class="small text-light mb-1">${station.region}</div>
            <div class="small text-muted font-monospace mb-2">${Math.abs(station.lat).toFixed(3)}°S, ${station.lon.toFixed(3)}°E</div>
            <div class="small text-warning mb-2"><i class="fa-solid fa-satellite-dish me-1"></i>${station.activeOps}</div>
            <button class="btn btn-xs btn-info text-dark fw-bold w-100" onclick="window.IceTrack.showLocationDossierById('antarctica', '${station.id}')">
              <i class="fa-solid fa-circle-info me-1"></i> Open Dossier
            </button>
          </div>
        `);
      });

      // Polar Vessels (3)
      POLAR_VESSELS.forEach(vessel => {
        const icon = L.divIcon({
          className: 'leaflet-custom-marker',
          html: `<div class="tactical-marker-pin ship-pin" title="${vessel.name}">
                  <i class="fa-solid fa-ship" style="font-size: 12px;"></i>
                  <div class="tactical-pulse-ring"></div>
                 </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([vessel.lat, vessel.lon], { icon }).addTo(map);
        marker.on('click', () => this.showLocationDossier(vessel));
        marker.bindPopup(`
          <div class="tactical-map-popup p-1" style="min-width: 220px;">
            <div class="tactical-popup-header d-flex justify-content-between align-items-center mb-1">
              <strong class="text-success"><i class="fa-solid fa-ship me-1"></i>${vessel.name}</strong>
              <span class="badge bg-success text-white" style="font-size: 0.65rem;">VESSEL</span>
            </div>
            <div class="small text-light mb-1">${vessel.status}</div>
            <div class="small text-muted mb-2">Heading: ${vessel.heading} &bull; ${vessel.speed}</div>
            <button class="btn btn-xs btn-success text-white w-100" onclick="window.IceTrack.showLocationDossierById('ship', '${vessel.id}')">
              <i class="fa-solid fa-circle-info me-1"></i> Open Dossier
            </button>
          </div>
        `);
      });

      this.detailedMap = map;
      setTimeout(() => map.invalidateSize(), 150);
    } catch (err) {
      console.warn("Detailed Map initialization error:", err);
    }
  }

  // --- Live Operational Map on Dashboard ---
  initDashboardMap() {
    const container = document.getElementById('dashboardLeafletMap');
    if (!container || this.dashboardMap || typeof L === 'undefined') return;

    try {
      const map = L.map('dashboardLeafletMap', {
        center: [-15, 75],
        zoom: 3,
        minZoom: 2,
        maxZoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd'
      }).addTo(map);

      // Routes
      EXPEDITION_ROUTES.forEach(route => {
        const latlngs = route.coordinates.map(coord => [coord[1], coord[0]]);
        L.polyline(latlngs, {
          color: '#0284c7',
          weight: 2.8,
          dashArray: '6, 6',
          opacity: 0.75
        }).addTo(map).bindTooltip(`<b>${route.name}</b>`);
      });

      // Ports
      INDIAN_PORTS.forEach(port => {
        const icon = L.divIcon({
          className: 'leaflet-custom-marker',
          html: `<div class="tactical-marker-pin port-pin" title="${port.name}">
                  <i class="fa-solid fa-anchor" style="font-size: 11px;"></i>
                  <div class="tactical-pulse-ring"></div>
                 </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([port.lat, port.lon], { icon }).addTo(map);
        marker.bindPopup(`
          <div class="tactical-map-popup p-1" style="min-width: 200px;">
            <div class="tactical-popup-header d-flex justify-content-between align-items-center mb-1">
              <strong class="text-warning"><i class="fa-solid fa-anchor me-1"></i>${port.name}</strong>
            </div>
            <div class="small text-light mb-1">${port.category || port.state}</div>
            <div class="small text-info mb-2">${port.activeOps}</div>
            <button class="btn btn-xs btn-primary w-100" onclick="window.IceTrack.inspectFromMap('port', '${port.id}')">
              <i class="fa-solid fa-compass me-1"></i> Geospatial Dossier
            </button>
          </div>
        `);
      });

      // Antarctic Stations
      ANTARCTICA_STATIONS.forEach(station => {
        const icon = L.divIcon({
          className: 'leaflet-custom-marker',
          html: `<div class="tactical-marker-pin base-pin" title="${station.name}">
                  <i class="fa-solid fa-snowflake" style="font-size: 11px;"></i>
                  <div class="tactical-pulse-ring"></div>
                 </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([station.lat, station.lon], { icon }).addTo(map);
        marker.bindPopup(`
          <div class="tactical-map-popup p-1" style="min-width: 200px;">
            <div class="tactical-popup-header d-flex justify-content-between align-items-center mb-1">
              <strong class="text-info"><i class="fa-solid fa-snowflake me-1"></i>${station.name}</strong>
            </div>
            <div class="small text-light mb-1">${station.region}</div>
            <div class="small text-warning mb-2">${station.status}</div>
            <button class="btn btn-xs btn-info text-dark fw-bold w-100" onclick="window.IceTrack.inspectFromMap('antarctica', '${station.id}')">
              <i class="fa-solid fa-compass me-1"></i> Geospatial Dossier
            </button>
          </div>
        `);
      });

      // Polar Ships
      POLAR_VESSELS.forEach(vessel => {
        const icon = L.divIcon({
          className: 'leaflet-custom-marker',
          html: `<div class="tactical-marker-pin ship-pin" title="${vessel.name}">
                  <i class="fa-solid fa-ship" style="font-size: 11px;"></i>
                  <div class="tactical-pulse-ring"></div>
                 </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([vessel.lat, vessel.lon], { icon }).addTo(map);
        marker.bindPopup(`
          <div class="tactical-map-popup p-1" style="min-width: 200px;">
            <div class="tactical-popup-header d-flex justify-content-between align-items-center mb-1">
              <strong class="text-success"><i class="fa-solid fa-ship me-1"></i>${vessel.name}</strong>
            </div>
            <div class="small text-light mb-1">${vessel.status}</div>
            <div class="small text-muted mb-2">${vessel.speed} &bull; ${vessel.heading}</div>
            <button class="btn btn-xs btn-success text-white w-100" onclick="window.IceTrack.inspectFromMap('ship', '${vessel.id}')">
              <i class="fa-solid fa-compass me-1"></i> Geospatial Dossier
            </button>
          </div>
        `);
      });

      this.dashboardMap = map;

      // Dashboard Quick Controls
      document.getElementById('btnDashFocusIndia')?.addEventListener('click', () => {
        map.flyTo([18.5, 77.5], 5, { duration: 1.2 });
      });
      document.getElementById('btnDashFocusAntarctica')?.addEventListener('click', () => {
        map.flyTo([-72, 45], 4, { duration: 1.2 });
      });
      document.getElementById('btnDashFitAll')?.addEventListener('click', () => {
        map.flyTo([-15, 75], 3, { duration: 1.2 });
      });

      setTimeout(() => map.invalidateSize(), 150);
    } catch (err) {
      console.warn("Dashboard Map initialization error:", err);
    }
  }

  inspectFromMap(type, id) {
    this.switchView('map');
    this.showLocationDossierById(type, id);
  }

  showLocationDossierById(type, id) {
    let target = null;
    if (type === 'port') target = INDIAN_PORTS.find(p => p.id === id);
    else if (type === 'antarctica') target = ANTARCTICA_STATIONS.find(s => s.id === id);
    else if (type === 'ship') target = POLAR_VESSELS.find(v => v.id === id);

    if (target) {
      this.showLocationDossier(target);
      this.focusLocation(target);
    }
  }

  focusPreset(name) {
    if (this.mapMode === 'detailed' && this.detailedMap) {
      if (name === 'india') this.detailedMap.flyTo([18.5, 77.5], 5, { duration: 1.2 });
      else if (name === 'antarctica') this.detailedMap.flyTo([-72, 45], 4, { duration: 1.2 });
      else if (name === 'corridor') this.detailedMap.flyTo([-15, 75], 3, { duration: 1.2 });
      else this.detailedMap.flyTo([-10, 75], 3, { duration: 1.2 });
    } else if (this.globe.initialized) {
      if (name === 'india') this.flyTo(77, 18, this.globe.baseScale * 1.35);
      else if (name === 'antarctica') this.flyTo(45, -78, this.globe.baseScale * 1.35);
      else if (name === 'corridor') this.flyTo(65, -30, this.globe.baseScale * 1.05);
      else this.flyTo(75, 5, this.globe.baseScale);
    }
  }

  focusLocation(item) {
    if (!item) return;
    if (this.mapMode === 'detailed' && this.detailedMap) {
      const zoom = item.type === 'port' ? 8 : item.type === 'antarctica' ? 6 : 6;
      this.detailedMap.flyTo([item.lat, item.lon], zoom, { duration: 1.2 });
    } else if (this.globe.initialized) {
      const scale = item.type === 'port' ? this.globe.baseScale * 1.4 : this.globe.baseScale * 1.35;
      this.flyTo(item.lon, item.lat, scale);
    }
  }

  // --- Rotatable 3D Polar Operations Globe (Indian Ports & Antarctica) ---

  async initGlobe() {
    const container = document.getElementById('d3MapContainer');
    if (!container) return;

    if (typeof d3 === 'undefined') {
      container.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center">
          <i class="fa-solid fa-earth-americas fa-3x text-primary mb-3"></i>
          <h5 class="fw-bold">Polar Geospatial Visualization</h5>
          <p class="text-muted small mb-0">Interactive 3D vector projection ready. Switch to Detailed Satellite Map for high-resolution navigation.</p>
        </div>
      `;
      return;
    }

    if (this.globe.initialized) {
      this.resizeGlobe();
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 540;
    const radius = Math.min(width, height) * 0.42;

    this.globe.baseScale = radius;
    this.globe.currentScale = radius;
    this.globe.currentRotation = [-75, 5, 0]; // Centers India (long ~75) and Southern Ocean

    // Clear any previous artifacts
    container.innerHTML = '';

    const svg = d3.select("#d3MapContainer")
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    this.globe.svg = svg;
    this.globe.width = width;
    this.globe.height = height;

    // Create D3 Orthographic Projection
    const projection = d3.geoOrthographic()
      .scale(this.globe.currentScale)
      .rotate(this.globe.currentRotation)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .precision(0.3);

    const path = d3.geoPath().projection(projection);
    this.globe.projection = projection;
    this.globe.path = path;

    // SVG Definitions: Gradients, Glow Filters, Markers
    const defs = svg.append("defs");

    // Deep Ocean Radial Gradient
    const oceanGrad = defs.append("radialGradient")
      .attr("id", "oceanGradient")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "50%");
    oceanGrad.append("stop").attr("offset", "0%").attr("stop-color", "#0e2a47");
    oceanGrad.append("stop").attr("offset", "70%").attr("stop-color", "#07182c");
    oceanGrad.append("stop").attr("offset", "100%").attr("stop-color", "#020a14");

    // Outer Glow Filter for Pins and Routes
    const glowFilter = defs.append("filter")
      .attr("id", "globeGlow")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
    glowFilter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "glow");
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "glow");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Base Group Hierarchy for Layering
    const gAtmosphere = svg.append("g").attr("class", "layer-atmosphere");
    const gOcean = svg.append("g").attr("class", "layer-ocean");
    const gGraticule = svg.append("g").attr("class", "layer-graticule");
    const gLand = svg.append("g").attr("class", "layer-land");
    const gRoutes = svg.append("g").attr("class", "layer-routes");
    const gShips = svg.append("g").attr("class", "layer-ships");
    const gPorts = svg.append("g").attr("class", "layer-ports");
    const gBases = svg.append("g").attr("class", "layer-bases");

    // Atmosphere Rim Glow
    const atmosphereCircle = gAtmosphere.append("circle")
      .attr("class", "globe-atmosphere")
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", this.globe.currentScale + 2);

    // Ocean Sphere
    const oceanSphere = gOcean.append("path")
      .datum({ type: "Sphere" })
      .attr("class", "globe-sphere")
      .attr("d", path);

    // Coordinate Graticule Grid
    const graticulePath = gGraticule.append("path")
      .datum(d3.geoGraticule10())
      .attr("class", "globe-graticule")
      .attr("d", path);

    this.globe.elements = {
      atmosphereCircle,
      oceanSphere,
      graticulePath,
      gLand,
      gRoutes,
      gShips,
      gPorts,
      gBases
    };

    // --- Interactive Drag-to-Rotate Globe Behavior ---
    let startPos = [0, 0];
    let startRot = [...this.globe.currentRotation];

    const drag = d3.drag()
      .on("start", (event) => {
        this.stopAutoRotate();
        this.globe.isDragging = true;
        startPos = [event.x, event.y];
        startRot = [...this.globe.projection.rotate()];
      })
      .on("drag", (event) => {
        const k = 70 / this.globe.projection.scale();
        const dx = event.x - startPos[0];
        const dy = event.y - startPos[1];
        const newLon = startRot[0] + dx * k;
        const newLat = Math.max(-85, Math.min(85, startRot[1] - dy * k));
        this.globe.currentRotation = [newLon, newLat, 0];
        this.globe.projection.rotate(this.globe.currentRotation);
        this.updateGlobe();
      })
      .on("end", () => {
        this.globe.isDragging = false;
      });

    svg.call(drag);

    // --- Mouse Wheel Zoom on Globe ---
    svg.on("wheel", (event) => {
      event.preventDefault();
      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.89;
      const minScale = this.globe.baseScale * 0.55;
      const maxScale = this.globe.baseScale * 3.8;
      this.globe.currentScale = Math.max(minScale, Math.min(maxScale, this.globe.currentScale * zoomFactor));
      this.globe.projection.scale(this.globe.currentScale);
      this.updateGlobe();
    });

    // --- Load World TopoJSON for Continents ---
    try {
      let worldData;
      try {
        worldData = await d3.json("/countries-110m.json");
      } catch (err) {
        worldData = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
      }

      if (worldData && worldData.objects && worldData.objects.countries) {
        this.globe.countries = topojson.feature(worldData, worldData.objects.countries).features;
        this.renderGlobeWorld();
      }
    } catch (e) {
      console.warn("Could not load full world atlas topojson, falling back to sphere overview:", e);
    }

    // Render Routes, Ports, Antarctic Bases, and Vessels
    this.renderExpeditionRoutes();
    this.renderIndianPorts();
    this.renderAntarcticaBases();
    this.renderPolarVessels();

    this.globe.initialized = true;
    this.updateGlobe();

    // Responsive window resize
    window.addEventListener('resize', () => {
      this.resizeGlobe();
    });
  }

  renderGlobeWorld() {
    if (!this.globe.countries || !this.globe.elements.gLand) return;

    this.globe.elements.gLand.selectAll("path")
      .data(this.globe.countries)
      .enter()
      .append("path")
      .attr("class", d => {
        // Highlight India (ISO id 356) and Antarctica (ISO id 010)
        if (d.id === "356" || (d.properties && d.properties.name === "India")) {
          return "globe-country india-land";
        }
        if (d.id === "010" || (d.properties && d.properties.name === "Antarctica")) {
          return "globe-country antarctica-land";
        }
        return "globe-country";
      })
      .attr("d", this.globe.path);
  }

  renderExpeditionRoutes() {
    if (!this.globe.elements.gRoutes) return;

    const routeFeatures = EXPEDITION_ROUTES.map(r => ({
      type: "Feature",
      properties: { name: r.name, id: r.id },
      geometry: {
        type: "LineString",
        coordinates: r.coordinates
      }
    }));

    // Glow underlay
    this.globe.elements.gRoutes.selectAll(".globe-route-glow")
      .data(routeFeatures)
      .enter()
      .append("path")
      .attr("class", "globe-route-glow")
      .attr("d", this.globe.path);

    // Glowing dashed route path
    this.globe.elements.gRoutes.selectAll(".globe-route-path")
      .data(routeFeatures)
      .enter()
      .append("path")
      .attr("class", "globe-route-path")
      .attr("d", this.globe.path);
  }

  renderIndianPorts() {
    if (!this.globe.elements.gPorts) return;

    const g = this.globe.elements.gPorts;
    g.selectAll(".port-marker-group").remove();

    const groups = g.selectAll(".port-marker-group")
      .data(INDIAN_PORTS)
      .enter()
      .append("g")
      .attr("class", "globe-marker-group port-marker-group")
      .attr("id", d => `marker-${d.id}`)
      .on("click", (event, d) => {
        event.stopPropagation();
        this.showLocationDossier(d);
        this.flyTo(d.lon, d.lat, this.globe.baseScale * 1.4);
      });

    // Glowing saffron halo
    groups.append("circle")
      .attr("r", 9)
      .attr("fill", "none")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.7);

    // Core Port Dot
    groups.append("circle")
      .attr("class", "marker-core")
      .attr("r", 5)
      .attr("fill", "#f59e0b")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5);

    // Port Label
    groups.append("text")
      .attr("class", "globe-marker-label port-label")
      .attr("x", 10)
      .attr("y", 3)
      .text(d => d.name.replace(/ \(.*\)/, ''));
  }

  renderAntarcticaBases() {
    if (!this.globe.elements.gBases) return;

    const g = this.globe.elements.gBases;
    g.selectAll(".base-marker-group").remove();

    const groups = g.selectAll(".base-marker-group")
      .data(ANTARCTICA_STATIONS)
      .enter()
      .append("g")
      .attr("class", "globe-marker-group base-marker-group")
      .attr("id", d => `marker-${d.id}`)
      .on("click", (event, d) => {
        event.stopPropagation();
        this.showLocationDossier(d);
        this.flyTo(d.lon, d.lat, this.globe.baseScale * 1.4);
      });

    // Pulsing radar ring
    groups.append("circle")
      .attr("class", "globe-marker-pulse")
      .attr("r", 6)
      .attr("fill", "none")
      .attr("stroke", "#38bdf8")
      .attr("stroke-width", 1.8);

    // Core Base Beacon
    groups.append("circle")
      .attr("class", "marker-core")
      .attr("r", 5)
      .attr("fill", "#0284c7")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.8);

    // Station Name Label
    groups.append("text")
      .attr("class", "globe-marker-label base-label")
      .attr("x", 11)
      .attr("y", 4)
      .text(d => d.name);
  }

  renderPolarVessels() {
    if (!this.globe.elements.gShips) return;

    const g = this.globe.elements.gShips;
    g.selectAll(".ship-marker-group").remove();

    const groups = g.selectAll(".ship-marker-group")
      .data(POLAR_VESSELS)
      .enter()
      .append("g")
      .attr("class", "globe-marker-group ship-marker-group")
      .attr("id", d => `marker-${d.id}`)
      .on("click", (event, d) => {
        event.stopPropagation();
        this.showLocationDossier(d);
        this.flyTo(d.lon, d.lat, this.globe.baseScale * 1.3);
      });

    // Ship wake ring
    groups.append("circle")
      .attr("r", 7)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "2 2");

    // Ship Core Dot
    groups.append("circle")
      .attr("class", "marker-core")
      .attr("r", 4.5)
      .attr("fill", "#10b981")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5);

    // Vessel Label
    groups.append("text")
      .attr("class", "globe-marker-label ship-label")
      .attr("x", 10)
      .attr("y", 3)
      .text(d => d.name);
  }

  updateGlobe() {
    if (!this.globe.projection || !this.globe.path) return;

    const path = this.globe.path;
    const projection = this.globe.projection;
    const currentRot = projection.rotate();

    // Helper: is location on visible side of the 3D globe?
    const isVisible = (lon, lat) => {
      const centerLon = -currentRot[0];
      const centerLat = -currentRot[1];
      return d3.geoDistance([lon, lat], [centerLon, centerLat]) < 1.57079; // <= 90 degrees
    };

    // Update Paths
    if (this.globe.elements.atmosphereCircle) {
      this.globe.elements.atmosphereCircle.attr("r", projection.scale() + 2);
    }
    if (this.globe.elements.oceanSphere) {
      this.globe.elements.oceanSphere.attr("d", path);
    }
    if (this.globe.elements.graticulePath && this.globe.showGraticule) {
      this.globe.elements.graticulePath.attr("d", path);
    }
    if (this.globe.elements.gLand) {
      this.globe.elements.gLand.selectAll("path").attr("d", path);
    }
    if (this.globe.elements.gRoutes) {
      this.globe.elements.gRoutes.selectAll("path").attr("d", path);
    }

    // Reposition Indian Ports Markers
    if (this.globe.elements.gPorts) {
      this.globe.elements.gPorts.selectAll(".port-marker-group")
        .each(function(d) {
          const visible = isVisible(d.lon, d.lat);
          if (visible) {
            const coords = projection([d.lon, d.lat]);
            if (coords) {
              d3.select(this)
                .style("display", "inline")
                .attr("transform", `translate(${coords[0]},${coords[1]})`);
            }
          } else {
            d3.select(this).style("display", "none");
          }
        });
    }

    // Reposition Antarctic Bases Markers
    if (this.globe.elements.gBases) {
      this.globe.elements.gBases.selectAll(".base-marker-group")
        .each(function(d) {
          const visible = isVisible(d.lon, d.lat);
          if (visible) {
            const coords = projection([d.lon, d.lat]);
            if (coords) {
              d3.select(this)
                .style("display", "inline")
                .attr("transform", `translate(${coords[0]},${coords[1]})`);
            }
          } else {
            d3.select(this).style("display", "none");
          }
        });
    }

    // Reposition Polar Vessels Markers
    if (this.globe.elements.gShips) {
      this.globe.elements.gShips.selectAll(".ship-marker-group")
        .each(function(d) {
          const visible = isVisible(d.lon, d.lat);
          if (visible) {
            const coords = projection([d.lon, d.lat]);
            if (coords) {
              d3.select(this)
                .style("display", "inline")
                .attr("transform", `translate(${coords[0]},${coords[1]})`);
            }
          } else {
            d3.select(this).style("display", "none");
          }
        });
    }
  }

  flyTo(targetLon, targetLat, targetScale, duration = 800) {
    this.stopAutoRotate();

    const startRot = [...this.globe.projection.rotate()];
    const endRot = [-targetLon, -targetLat, 0];
    const startScale = this.globe.projection.scale();
    const endScale = targetScale || this.globe.currentScale;

    // Handle longitudinal shortest wrap
    let diffLon = endRot[0] - startRot[0];
    while (diffLon > 180) diffLon -= 360;
    while (diffLon < -180) diffLon += 360;
    endRot[0] = startRot[0] + diffLon;

    const startTime = performance.now();

    const animateStep = (time) => {
      const elapsed = time - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      const curLon = startRot[0] + (endRot[0] - startRot[0]) * ease;
      const curLat = startRot[1] + (endRot[1] - startRot[1]) * ease;
      const curScale = startScale + (endScale - startScale) * ease;

      this.globe.currentRotation = [curLon, curLat, 0];
      this.globe.currentScale = curScale;
      this.globe.projection.rotate(this.globe.currentRotation).scale(curScale);
      this.updateGlobe();

      if (t < 1) {
        requestAnimationFrame(animateStep);
      }
    };

    requestAnimationFrame(animateStep);
  }

  bindGlobeControls() {
    // Focus Indian Ports
    const btnFocusIndia = document.getElementById('btnFocusIndia');
    if (btnFocusIndia) {
      btnFocusIndia.addEventListener('click', () => {
        this.focusPreset('india');
      });
    }

    // Focus Antarctica
    const btnFocusAntarctica = document.getElementById('btnFocusAntarctica');
    if (btnFocusAntarctica) {
      btnFocusAntarctica.addEventListener('click', () => {
        this.focusPreset('antarctica');
      });
    }

    // Focus Polar Corridor
    const btnFocusCorridor = document.getElementById('btnFocusCorridor');
    if (btnFocusCorridor) {
      btnFocusCorridor.addEventListener('click', () => {
        this.focusPreset('corridor');
      });
    }

    // Reset Camera
    const btnResetGlobe = document.getElementById('btnResetGlobe');
    if (btnResetGlobe) {
      btnResetGlobe.addEventListener('click', () => {
        this.focusPreset('reset');
      });
    }

    // Auto-Rotate Button
    const btnToggleAutoRotate = document.getElementById('btnToggleAutoRotate');
    if (btnToggleAutoRotate) {
      btnToggleAutoRotate.addEventListener('click', () => {
        this.toggleAutoRotate();
      });
    }

    // Zoom Buttons (handles both Leaflet Detailed Map and D3 Globe)
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        if (this.mapMode === 'detailed' && this.detailedMap) {
          this.detailedMap.zoomIn();
        } else if (this.globe.initialized) {
          const targetScale = Math.min(this.globe.baseScale * 3.8, this.globe.currentScale * 1.25);
          this.globe.currentScale = targetScale;
          this.globe.projection.scale(targetScale);
          this.updateGlobe();
        }
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        if (this.mapMode === 'detailed' && this.detailedMap) {
          this.detailedMap.zoomOut();
        } else if (this.globe.initialized) {
          const targetScale = Math.max(this.globe.baseScale * 0.55, this.globe.currentScale * 0.8);
          this.globe.currentScale = targetScale;
          this.globe.projection.scale(targetScale);
          this.updateGlobe();
        }
      });
    }

    // Graticule Toggle
    const btnToggleGraticule = document.getElementById('btnToggleGraticule');
    if (btnToggleGraticule) {
      btnToggleGraticule.addEventListener('click', () => {
        this.globe.showGraticule = !this.globe.showGraticule;
        if (this.globe.elements.graticulePath) {
          this.globe.elements.graticulePath.style("display", this.globe.showGraticule ? "inline" : "none");
        }
        btnToggleGraticule.classList.toggle('active', this.globe.showGraticule);
      });
    }

    // Inspector Close Button
    const closeInspectorBtn = document.getElementById('closeInspectorBtn');
    const inspectorCard = document.getElementById('globeInspectorCard');
    if (closeInspectorBtn && inspectorCard) {
      closeInspectorBtn.addEventListener('click', () => {
        inspectorCard.classList.add('collapsed');
      });
    }

    // Inspector Fly-To Button
    const inspFlyBtn = document.getElementById('inspFlyBtn');
    if (inspFlyBtn) {
      inspFlyBtn.addEventListener('click', () => {
        if (this.globe.selectedTarget) {
          this.focusLocation(this.globe.selectedTarget);
        }
      });
    }
  }

  toggleAutoRotate() {
    if (this.globe.isAutoRotating) {
      this.stopAutoRotate();
    } else {
      this.startAutoRotate();
    }
  }

  startAutoRotate() {
    this.globe.isAutoRotating = true;
    const btn = document.getElementById('btnToggleAutoRotate');
    const icon = document.getElementById('autoRotateIcon');
    const label = document.getElementById('autoRotateLabel');

    if (btn) btn.classList.replace('btn-dark', 'btn-primary');
    if (icon) icon.className = 'fa-solid fa-pause me-1';
    if (label) label.textContent = 'Pause';

    const loop = () => {
      if (!this.globe.isAutoRotating) return;
      this.globe.currentRotation[0] -= 0.3; // Rotate eastward
      this.globe.projection.rotate(this.globe.currentRotation);
      this.updateGlobe();
      this.globe.autoRotateTimer = requestAnimationFrame(loop);
    };

    if (this.globe.autoRotateTimer) cancelAnimationFrame(this.globe.autoRotateTimer);
    this.globe.autoRotateTimer = requestAnimationFrame(loop);
  }

  stopAutoRotate() {
    this.globe.isAutoRotating = false;
    if (this.globe.autoRotateTimer) {
      cancelAnimationFrame(this.globe.autoRotateTimer);
      this.globe.autoRotateTimer = null;
    }
    const btn = document.getElementById('btnToggleAutoRotate');
    const icon = document.getElementById('autoRotateIcon');
    const label = document.getElementById('autoRotateLabel');

    if (btn) btn.classList.replace('btn-primary', 'btn-dark');
    if (icon) icon.className = 'fa-solid fa-play me-1';
    if (label) label.textContent = 'Auto-Rotate';
  }

  populateLocationPills() {
    const container = document.getElementById('locationPillsContainer');
    if (!container) return;

    container.innerHTML = '';

    // Indian Ports Pills
    INDIAN_PORTS.forEach(port => {
      const btn = document.createElement('button');
      btn.className = 'loc-quick-pill pill-india';
      btn.dataset.id = port.id;
      btn.innerHTML = `<i class="fa-solid fa-anchor text-warning me-1"></i>${port.name.replace(/ \(.*\)/, '')}`;
      btn.addEventListener('click', () => {
        this.showLocationDossier(port);
        this.focusLocation(port);
      });
      container.appendChild(btn);
    });

    // Antarctic Bases Pills
    ANTARCTICA_STATIONS.forEach(st => {
      const btn = document.createElement('button');
      btn.className = 'loc-quick-pill pill-antarctica';
      btn.dataset.id = st.id;
      btn.innerHTML = `<i class="fa-solid fa-snowflake text-info me-1"></i>${st.name}`;
      btn.addEventListener('click', () => {
        this.showLocationDossier(st);
        this.focusLocation(st);
      });
      container.appendChild(btn);
    });

    // Polar Ships Pills
    POLAR_VESSELS.forEach(ship => {
      const btn = document.createElement('button');
      btn.className = 'loc-quick-pill pill-ship';
      btn.dataset.id = ship.id;
      btn.innerHTML = `<i class="fa-solid fa-ship text-success me-1"></i>${ship.name}`;
      btn.addEventListener('click', () => {
        this.showLocationDossier(ship);
        this.focusLocation(ship);
      });
      container.appendChild(btn);
    });
  }

  showLocationDossier(item) {
    this.globe.selectedTarget = item;

    const card = document.getElementById('globeInspectorCard');
    if (!card) return;

    card.classList.remove('collapsed');

    // Populate data
    const badge = document.getElementById('inspBadge');
    const title = document.getElementById('inspTitle');
    const subtitle = document.getElementById('inspSubtitle');
    const coords = document.getElementById('inspCoords');
    const dist = document.getElementById('inspDist');
    const clearance = document.getElementById('inspClearance');
    const desc = document.getElementById('inspDesc');
    const ops = document.getElementById('inspOps');

    if (badge) {
      if (item.type === 'port') {
        badge.className = 'badge bg-warning text-dark';
        badge.textContent = item.category || 'INDIAN MARITIME PORT';
      } else if (item.type === 'antarctica') {
        badge.className = 'badge bg-info text-dark';
        badge.textContent = item.category || 'ANTARCTIC RESEARCH BASE';
      } else {
        badge.className = 'badge bg-success text-white';
        badge.textContent = item.category || 'POLAR EXPEDITION VESSEL';
      }
    }

    if (title) title.textContent = item.name;
    if (subtitle) subtitle.textContent = item.region || item.state || item.mission || 'Active Maritime Unit';

    if (coords) {
      const latStr = `${Math.abs(item.lat).toFixed(3)}° ${item.lat >= 0 ? 'N' : 'S'}`;
      const lonStr = `${Math.abs(item.lon).toFixed(3)}° ${item.lon >= 0 ? 'E' : 'W'}`;
      coords.textContent = `${latStr}, ${lonStr}`;
    }

    if (dist) dist.textContent = item.distToAntarctica || item.speed || '~9,400 km';
    if (clearance) clearance.textContent = item.clearance || item.status || 'Level 4 (MoES)';
    if (desc) desc.textContent = item.description || item.mission || '';
    if (ops) ops.textContent = item.activeOps || item.facilities || item.heading || 'Normal Operations';

    // Ambient Weather Telemetry
    const weatherText = document.getElementById('inspWeatherText');
    const weatherBadge = document.getElementById('inspWeatherBadge');
    if (weatherText) {
      if (item.weather) {
        weatherText.textContent = `${item.weather.temp}, ${item.weather.conditions || ''}, Wind: ${item.weather.wind}`;
        if (weatherBadge) weatherBadge.textContent = item.weather.iceCondition || 'OPERATIONAL';
      } else {
        weatherText.textContent = 'Telemetry linked & nominal';
        if (weatherBadge) weatherBadge.textContent = 'NOMINAL';
      }
    }

    // Ground Truth Facilities & Berths from Google Maps & Surveys
    const internalText = document.getElementById('inspInternalDetails');
    if (internalText) {
      let details = item.internalDetails || '';
      if (item.berths) details += (details ? ' • ' : '') + `Berths: ${item.berths}`;
      if (item.modules) details += (details ? ' • ' : '') + `Modules: ${item.modules}`;
      if (!details && item.facilities) details = item.facilities;
      internalText.textContent = details || 'Dedicated polar navigation equipment, telemetry transponders, satellite communication array.';
    }

    // Direct Google Maps Link
    const gmapsBtn = document.getElementById('inspGoogleMapsBtn');
    if (gmapsBtn) {
      gmapsBtn.href = item.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`;
    }

    // Highlight corresponding pill
    document.querySelectorAll('.loc-quick-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.id === item.id);
    });
  }

  resizeGlobe() {
    const container = document.getElementById('d3MapContainer');
    if (!container || !this.globe.projection || !this.globe.svg) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    this.globe.width = width;
    this.globe.height = height;

    this.globe.svg.attr("viewBox", `0 0 ${width} ${height}`);
    this.globe.projection.translate([width / 2, height / 2]);

    const radius = Math.min(width, height) * 0.42;
    this.globe.baseScale = radius;
    if (this.globe.currentScale < radius * 0.55) {
      this.globe.currentScale = radius;
      this.globe.projection.scale(radius);
    }

    this.updateGlobe();
  }

  renderDashboardMetrics() {
    const data = StorageService.getData();
    const countExp = document.getElementById('countExpeditions');
    if (countExp) countExp.textContent = data.expeditions?.length || 0;
    
    const countCargo = document.getElementById('countCargo');
    if (countCargo) countCargo.textContent = data.cargo?.length || 0;
    
    const countPersonnel = document.getElementById('countPersonnel');
    if (countPersonnel) countPersonnel.textContent = data.personnel?.length || 0;
    
    // Count active alerts (e.g., inventory risk High)
    const alertCount = (data.inventory || []).filter(i => i.risk === 'High').length;
    const countAlerts = document.getElementById('countAlerts');
    if (countAlerts) countAlerts.textContent = alertCount;

    if (this.analyticsEngine) {
      this.analyticsEngine.render();
    }
  }

  renderExpeditions() {
    const expeditions = StorageService.getData('expeditions') || [];
    const tbody = document.getElementById('expeditionTableBody');
    if (!tbody) return;
    
    const canDelete = hasPermission(this.currentUser, 'expeditions.delete');

    tbody.innerHTML = '';
    if (expeditions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-muted">
            <i class="fa-solid fa-compass fs-3 d-block mb-2 text-secondary"></i>
            No expeditions recorded yet. Enter your mission parameters to register a new expedition.
          </td>
        </tr>
      `;
      return;
    }
    expeditions.forEach(exp => {
      let priorityClass = 'text-primary';
      if(exp.priority === 'High') priorityClass = 'text-warning';
      if(exp.priority === 'Critical') priorityClass = 'text-danger';

      const phaseText = exp.phase || 'Phase 1: Planning';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="fw-semibold text-dark">${exp.name}</div>
          <small class="text-cyan font-monospace" style="font-size: 11px;"><i class="fa-solid fa-bars-progress me-1"></i>${phaseText}</small>
        </td>
        <td><i class="fa-solid fa-location-dot text-cyan me-1"></i> ${exp.station}</td>
        <td>${exp.ship}</td>
        <td><small class="text-muted">${exp.start} to ${exp.end}</small></td>
        <td><span class="${priorityClass} fw-bold">${exp.priority}</span></td>
        <td class="text-end text-nowrap">
          <button class="btn btn-xs btn-outline-primary me-1 btn-advance-exp" data-id="${exp.id}" title="Advance Mission Phase">
            <i class="fa-solid fa-forward me-1"></i>Advance Phase
          </button>
          ${canDelete ? `
            <button class="btn btn-xs btn-outline-danger btn-delete-exp" data-id="${exp.id}" title="Remove Expedition Record">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : `
            <span class="badge bg-light text-muted border"><i class="fa-solid fa-lock me-1"></i>Protected</span>
          `}
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (!tbody.hasAttribute('data-actions-bound')) {
      tbody.setAttribute('data-actions-bound', 'true');
      tbody.addEventListener('click', (e) => {
        const btnAdvanceExp = e.target.closest('.btn-advance-exp');
        const btnDelete = e.target.closest('.btn-delete-exp');

        if (btnAdvanceExp) {
          const id = btnAdvanceExp.getAttribute('data-id');
          let currentList = StorageService.getData('expeditions') || [];
          const exp = currentList.find(item => String(item.id) === String(id));
          if (exp) {
            const phases = [
              'Phase 1: Planning & Vessel Outfitting',
              'Phase 2: Southern Ocean Passage',
              'Phase 3: Fast Ice Staging & Offloading',
              'Phase 4: Active Scientific Field Operations',
              'Phase 5: Wintering Over / Mission Accomplished'
            ];
            const currentIdx = phases.findIndex(p => (exp.phase || '').toLowerCase().includes(p.toLowerCase().slice(0, 7)));
            const nextIdx = (currentIdx === -1) ? 1 : Math.min(phases.length - 1, currentIdx + 1);
            exp.phase = phases[nextIdx];
            exp.fieldStatus = nextIdx === 4 ? 'Mission Complete' : 'Nominal Operations';
            StorageService.saveData('expeditions', currentList);
            this.renderExpeditions();
            this.renderDashboardMetrics();
            if (this.analyticsEngine) this.analyticsEngine.render();
            showNotification(`Expedition "${exp.name}" advanced to ${exp.phase}.`, 'info', 'Expedition Phase Advanced');
          }
          return;
        }

        if (btnDelete) {
          if (!hasPermission(this.currentUser, 'expeditions.delete')) {
            showNotification('Access Denied: Only Administrator has permission to delete expedition records.', 'error', 'Clearance Violation');
            return;
          }
          const id = btnDelete.getAttribute('data-id');
          let currentList = StorageService.getData('expeditions') || [];
          currentList = currentList.filter(item => String(item.id) !== String(id));
          StorageService.saveData('expeditions', currentList);
          this.renderExpeditions();
          this.renderDashboardMetrics();
          if (this.analyticsEngine) this.analyticsEngine.render();
        }
      });
    }
  }

  async renderCargo() {
    const tbody = document.getElementById('cargoTableBody');
    if (!tbody) return;

    // Retrieve active filter parameters
    const searchInput = document.getElementById('cargoSearchInput');
    const statusSelect = document.getElementById('cargoFilterStatus');
    const destSelect = document.getElementById('cargoFilterDestination');

    const filters = {
      search: searchInput ? searchInput.value.trim() : '',
      status: statusSelect ? statusSelect.value : 'all',
      destination: destSelect ? destSelect.value : 'all'
    };

    // Load cargo records through the unified API layer
    let cargo = await CargoAPI.getAll(filters);

    if (filters.destination && filters.destination !== 'all') {
      cargo = cargo.filter(c => c.destination.toLowerCase() === filters.destination.toLowerCase());
    }

    // Calculate executive logistics metrics
    const totalConsignments = cargo.length;
    const totalMassKg = cargo.reduce((sum, c) => sum + (Number(c.weight || c.weightKg) || 0), 0);
    const grossMassMT = (totalMassKg / 1000).toFixed(1) + ' MT';
    const activeTransit = cargo.filter(c => c.status === 'In Transit' || c.status === 'Approaching Ice Edge' || c.status === 'Offloading').length;
    const deliveredCount = cargo.filter(c => c.status === 'Delivered').length;

    // Update KPI counters
    const elTotal = document.getElementById('cargoMetricTotal');
    const elWeight = document.getElementById('cargoMetricWeight');
    const elTransit = document.getElementById('cargoMetricTransit');
    const elDelivered = document.getElementById('cargoMetricDelivered');
    const elFilterCount = document.getElementById('cargoFilterCount');

    if (elTotal) elTotal.textContent = totalConsignments;
    if (elWeight) elWeight.textContent = grossMassMT;
    if (elTransit) elTransit.textContent = activeTransit;
    if (elDelivered) elDelivered.textContent = deliveredCount;
    if (elFilterCount) {
      elFilterCount.textContent = `Displaying ${totalConsignments} active consignment${totalConsignments === 1 ? '' : 's'}`;
    }

    tbody.innerHTML = '';

    if (cargo.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-muted">
            <i class="fa-solid fa-box-open fs-3 d-block mb-2 text-secondary"></i>
            No cargo consignments recorded yet. Click <strong>"Register Consignment"</strong> to add your shipment.
          </td>
        </tr>
      `;
      return;
    }

    cargo.forEach(c => {
      const stepObj = getConsignmentStep(c);
      let statusBadge = 'bg-secondary text-white';
      if (c.status === 'Loaded') statusBadge = 'bg-primary text-white';
      if (c.status === 'In Transit') statusBadge = 'bg-info text-dark';
      if (c.status === 'Approaching Ice Edge') statusBadge = 'bg-warning text-dark';
      if (c.status === 'Offloading') statusBadge = 'bg-warning text-dark';
      if (c.status === 'Delivered') statusBadge = 'bg-success text-white';

      let priorityBadge = '';
      if (c.priority === 'Critical') priorityBadge = '<span class="badge bg-danger ms-1 text-white">CRITICAL</span>';
      else if (c.priority === 'High') priorityBadge = '<span class="badge bg-warning text-dark ms-1">HIGH</span>';

      const progressVal = Math.min(100, Math.max(0, Number(c.progress) || 0));
      const isDelivered = c.status === 'Delivered' || progressVal >= 100;
      const canAdvanceDeliver = hasPermission(this.currentUser, 'cargo.dispatch');
      const canDeleteCargo = hasPermission(this.currentUser, 'cargo.delete');
      const isReadOnlyCargo = !canAdvanceDeliver && !canDeleteCargo;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-monospace fw-bold text-cyan">${c.id}</td>
        <td>
          <div class="fw-semibold text-dark">${c.item} ${priorityBadge}</div>
          <small class="text-muted d-block font-monospace" style="font-size: 11px;">
            <i class="fa-solid fa-truck-ramp-box text-secondary me-1"></i>${c.carrier || stepObj.carrier}
          </small>
        </td>
        <td class="text-monospace fw-semibold">${Number(c.weight || c.weightKg || 0).toLocaleString()} kg</td>
        <td>
          <small class="text-muted d-flex align-items-center gap-1">
            <span class="text-dark fw-medium">${c.origin}</span>
            <i class="fa-solid fa-arrow-right text-muted mx-1" style="font-size: 10px;"></i>
            <span class="text-cyan fw-bold">${c.destination}</span>
          </small>
          <small class="text-muted d-block mt-1 font-monospace" style="font-size: 10.5px;">
            <i class="fa-solid fa-location-crosshairs text-danger me-1"></i>${c.currentLocation || stepObj.defaultLocation}
          </small>
        </td>
        <td>
          <div class="d-flex align-items-center gap-1">
            <span class="badge bg-dark">Step ${stepObj.step}/5</span>
            <span class="badge ${statusBadge}">${c.status}</span>
          </div>
          <small class="text-muted d-block mt-1 font-monospace" style="font-size: 11px;">
            <i class="fa-solid fa-route text-cyan me-1"></i>${stepObj.shortName}
          </small>
        </td>
        <td style="min-width: 140px;">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <small class="text-muted fw-bold" style="font-size: 11px;">${progressVal}%</small>
            <small class="text-muted" style="font-size: 10px;">${isDelivered ? 'Delivered' : stepObj.shortName}</small>
          </div>
          <div class="progress bg-white bg-opacity-75 shadow-sm" style="height: 6px;">
            <div class="progress-bar ${isDelivered ? 'bg-success' : 'bg-cyan'}" style="width: ${progressVal}%"></div>
          </div>
        </td>
        <td class="text-end text-nowrap">
          <button class="btn btn-xs btn-primary me-1 btn-open-step-modal" data-id="${c.id}" title="Update Consignment Step & Tracking">
            <i class="fa-solid fa-sliders me-1"></i>Update Step
          </button>
          ${!isDelivered && canAdvanceDeliver ? `
            <button class="btn btn-xs btn-outline-info me-1 btn-quick-next-step" data-id="${c.id}" title="Advance to Next Step (+1 Step)">
              <i class="fa-solid fa-forward-step me-1"></i>Next
            </button>
            <button class="btn btn-xs btn-outline-success me-1 btn-deliver-cargo" data-id="${c.id}" title="Mark Fully Delivered">
              <i class="fa-solid fa-check"></i>
            </button>
          ` : ''}
          ${canDeleteCargo ? `
            <button class="btn btn-xs btn-outline-danger btn-delete-cargo" data-id="${c.id}" title="Archive/Delete Consignment">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
          ${isReadOnlyCargo ? `
            <span class="badge bg-light text-muted border"><i class="fa-solid fa-eye me-1"></i>View Only</span>
          ` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Bind action event handlers with delegation
    if (!tbody.hasAttribute('data-actions-bound')) {
      tbody.setAttribute('data-actions-bound', 'true');
      tbody.addEventListener('click', async (e) => {
        const btnOpenModal = e.target.closest('.btn-open-step-modal');
        const btnNextStep = e.target.closest('.btn-quick-next-step');
        const btnAdvance = e.target.closest('.btn-advance-cargo');
        const btnDeliver = e.target.closest('.btn-deliver-cargo');
        const btnDelete = e.target.closest('.btn-delete-cargo');

        if (btnOpenModal) {
          const id = btnOpenModal.getAttribute('data-id');
          this.openUpdateConsignmentModal(id);
          return;
        }

        if (btnNextStep || btnAdvance) {
          if (!hasPermission(this.currentUser, 'cargo.dispatch')) {
            showNotification('Access Denied: Your clearance does not permit advancing cargo progress.', 'error', 'Clearance Violation');
            return;
          }
          const id = (btnNextStep || btnAdvance).getAttribute('data-id');
          const updated = await CargoAPI.advanceStep(id);
          await this.renderCargo();
          this.renderDashboardMetrics();
          if (this.analyticsEngine) this.analyticsEngine.render();
          const stepObj = getConsignmentStep(updated);
          showNotification(`Consignment ${id} advanced to Step ${stepObj.step}: ${stepObj.shortName} (${updated?.progress || 0}%).`, 'info', 'Step Updated');
          return;
        }

        if (btnDeliver) {
          if (!hasPermission(this.currentUser, 'cargo.dispatch')) {
            showNotification('Access Denied: Your clearance does not permit marking cargo as delivered.', 'error', 'Clearance Violation');
            return;
          }
          const id = btnDeliver.getAttribute('data-id');
          await CargoAPI.markDelivered(id);
          await this.renderCargo();
          this.renderDashboardMetrics();
          if (this.analyticsEngine) this.analyticsEngine.render();
          showNotification(`Consignment ${id} marked as fully delivered to polar station depository.`, 'success', 'Delivery Confirmed');
          return;
        }

        if (btnDelete) {
          if (!hasPermission(this.currentUser, 'cargo.delete')) {
            showNotification('Access Denied: Only Administrator and Logistics Officer can delete cargo manifests.', 'error', 'Clearance Violation');
            return;
          }
          const id = btnDelete.getAttribute('data-id');
          await CargoAPI.delete(id);
          await this.renderCargo();
          this.renderDashboardMetrics();
          if (this.analyticsEngine) this.analyticsEngine.render();
          showNotification(`Consignment ${id} archived from active manifests.`, 'info', 'Manifest Deleted');
          return;
        }
      });
    }

    // Bind Filter Controls
    if (searchInput && !searchInput.hasAttribute('data-bound')) {
      searchInput.setAttribute('data-bound', 'true');
      searchInput.addEventListener('input', () => this.renderCargo());
    }
    if (statusSelect && !statusSelect.hasAttribute('data-bound')) {
      statusSelect.setAttribute('data-bound', 'true');
      statusSelect.addEventListener('change', () => this.renderCargo());
    }
    if (destSelect && !destSelect.hasAttribute('data-bound')) {
      destSelect.setAttribute('data-bound', 'true');
      destSelect.addEventListener('change', () => this.renderCargo());
    }

    // Bind Export CSV Button
    const btnExport = document.getElementById('btnExportCargoCsv');
    if (btnExport && !btnExport.hasAttribute('data-bound')) {
      btnExport.setAttribute('data-bound', 'true');
      btnExport.addEventListener('click', () => {
        const allCargo = StorageService.getData('cargo') || [];
        const rows = allCargo.map(c => [
          c.id,
          c.item,
          c.weight,
          c.origin,
          c.destination,
          c.status,
          c.progress + '%',
          c.priority || 'Normal'
        ]);
        const headers = ['Cargo ID', 'Item Description', 'Weight (kg)', 'Origin Port', 'Destination Station', 'Status', 'Progress', 'Priority'];
        exportTableToCsv('icetrack_cargo_manifest.csv', rows, headers);
      });
    }

    // Bind Simulate Progress Button
    const updateBtn = document.getElementById('btnUpdateCargo');
    if (updateBtn && !updateBtn.hasAttribute('data-bound')) {
      updateBtn.setAttribute('data-bound', 'true');
      updateBtn.addEventListener('click', async () => {
        if (!hasPermission(this.currentUser, 'cargo.dispatch')) {
          showNotification('Access Denied: Your clearance does not permit advancing cargo progress.', 'error', 'Clearance Violation');
          return;
        }
        const activeList = await CargoAPI.getAll();
        let updatedCount = 0;
        for (const c of activeList) {
          if (c.progress < 100 || c.status !== 'Delivered') {
            await CargoAPI.advanceStep(c.id);
            updatedCount++;
          }
        }
        await this.renderCargo();
        this.renderDashboardMetrics();
        if (this.analyticsEngine) this.analyticsEngine.render();
        showNotification(`Simulated progress across ${updatedCount} active polar consignment${updatedCount === 1 ? '' : 's'}.`, 'success', 'Fleet Progress Advanced');
      });
    }
  }

  openUpdateConsignmentModal(cargoId) {
    const list = StorageService.getData('cargo') || [];
    const item = list.find(c => String(c.id).toLowerCase() === String(cargoId).toLowerCase());
    if (!item) {
      showNotification(`Consignment ${cargoId} not found.`, 'warning');
      return;
    }

    const stepObj = getConsignmentStep(item);

    const updateCargoId = document.getElementById('updateCargoId');
    const updateCargoIdDisplay = document.getElementById('updateCargoIdDisplay');
    const updateCargoPriorityDisplay = document.getElementById('updateCargoPriorityDisplay');
    const updateCargoItemDisplay = document.getElementById('updateCargoItemDisplay');
    const updateCargoWeightDisplay = document.getElementById('updateCargoWeightDisplay');
    const updateCargoDestDisplay = document.getElementById('updateCargoDestDisplay');
    const updateCargoLastUpdated = document.getElementById('updateCargoLastUpdated');
    const updateCargoStepSelect = document.getElementById('updateCargoStepSelect');
    const updateCargoStatus = document.getElementById('updateCargoStatus');
    const updateCargoProgressRange = document.getElementById('updateCargoProgressRange');
    const updateCargoProgressVal = document.getElementById('updateCargoProgressVal');
    const updateCargoLocation = document.getElementById('updateCargoLocation');
    const updateCargoCarrier = document.getElementById('updateCargoCarrier');
    const updateCargoRemarks = document.getElementById('updateCargoRemarks');

    if (updateCargoId) updateCargoId.value = item.id;
    if (updateCargoIdDisplay) updateCargoIdDisplay.textContent = item.id;
    if (updateCargoPriorityDisplay) updateCargoPriorityDisplay.textContent = `${item.priority || 'Normal'} Priority`;
    if (updateCargoItemDisplay) updateCargoItemDisplay.textContent = item.item;
    if (updateCargoWeightDisplay) updateCargoWeightDisplay.textContent = `${Number(item.weight || item.weightKg || 0).toLocaleString()} kg`;
    if (updateCargoDestDisplay) updateCargoDestDisplay.textContent = item.destination;
    if (updateCargoLastUpdated) {
      updateCargoLastUpdated.textContent = item.updatedAt ? `Updated: ${new Date(item.updatedAt).toLocaleTimeString()}` : 'Updated: Recently';
    }

    if (updateCargoStepSelect) updateCargoStepSelect.value = String(stepObj.step);
    if (updateCargoStatus) updateCargoStatus.value = item.status || stepObj.status;
    
    const progVal = item.progress !== undefined ? Number(item.progress) : stepObj.progress;
    if (updateCargoProgressRange) updateCargoProgressRange.value = progVal;
    if (updateCargoProgressVal) updateCargoProgressVal.textContent = `${progVal}%`;

    if (updateCargoLocation) updateCargoLocation.value = item.currentLocation || stepObj.defaultLocation;
    if (updateCargoCarrier) updateCargoCarrier.value = item.carrier || stepObj.carrier;
    if (updateCargoRemarks) updateCargoRemarks.value = item.notes || '';

    this.updateStepperNavUI(stepObj.step);
    this.openModal('modalUpdateConsignment');
  }

  updateStepperNavUI(activeStep) {
    const nav = document.getElementById('consignmentStepperNav');
    if (!nav) return;
    const buttons = nav.querySelectorAll('.btn-stepper');
    buttons.forEach(btn => {
      const step = Number(btn.getAttribute('data-step'));
      const pill = btn.querySelector('.step-pill');
      if (step === activeStep) {
        btn.classList.add('border-primary', 'bg-primary-subtle');
        btn.classList.remove('bg-white');
        if (pill) {
          pill.classList.remove('bg-secondary', 'bg-success');
          pill.classList.add('bg-primary');
        }
      } else if (step < activeStep) {
        btn.classList.remove('border-primary', 'bg-primary-subtle');
        btn.classList.add('bg-white');
        if (pill) {
          pill.classList.remove('bg-primary', 'bg-secondary');
          pill.classList.add('bg-success');
        }
      } else {
        btn.classList.remove('border-primary', 'bg-primary-subtle');
        btn.classList.add('bg-white');
        if (pill) {
          pill.classList.remove('bg-primary', 'bg-success');
          pill.classList.add('bg-secondary');
        }
      }
    });
  }

  bindUpdateConsignmentModal() {
    const form = document.getElementById('formUpdateConsignment');
    const stepperNav = document.getElementById('consignmentStepperNav');
    const stepSelect = document.getElementById('updateCargoStepSelect');
    const progRange = document.getElementById('updateCargoProgressRange');
    const progVal = document.getElementById('updateCargoProgressVal');
    const btnAdvance = document.getElementById('btnModalAdvanceStep');
    const btnDeliver = document.getElementById('btnModalMarkDelivered');

    if (stepperNav && !stepperNav.hasAttribute('data-bound')) {
      stepperNav.setAttribute('data-bound', 'true');
      stepperNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-stepper');
        if (!btn) return;
        const stepNum = Number(btn.getAttribute('data-step'));
        const stepConfig = CONSIGNMENT_STEPS[stepNum - 1];
        if (stepConfig) {
          if (stepSelect) stepSelect.value = String(stepNum);
          if (progRange) progRange.value = stepConfig.progress;
          if (progVal) progVal.textContent = `${stepConfig.progress}%`;
          const statusEl = document.getElementById('updateCargoStatus');
          if (statusEl) statusEl.value = stepConfig.status;
          const locEl = document.getElementById('updateCargoLocation');
          if (locEl) locEl.value = stepConfig.defaultLocation;
          const carEl = document.getElementById('updateCargoCarrier');
          if (carEl) carEl.value = stepConfig.carrier;
          this.updateStepperNavUI(stepNum);
        }
      });
    }

    if (stepSelect && !stepSelect.hasAttribute('data-bound')) {
      stepSelect.setAttribute('data-bound', 'true');
      stepSelect.addEventListener('change', () => {
        const stepNum = Number(stepSelect.value);
        const stepConfig = CONSIGNMENT_STEPS[stepNum - 1];
        if (stepConfig) {
          if (progRange) progRange.value = stepConfig.progress;
          if (progVal) progVal.textContent = `${stepConfig.progress}%`;
          const statusEl = document.getElementById('updateCargoStatus');
          if (statusEl) statusEl.value = stepConfig.status;
          const locEl = document.getElementById('updateCargoLocation');
          if (locEl) locEl.value = stepConfig.defaultLocation;
          const carEl = document.getElementById('updateCargoCarrier');
          if (carEl) carEl.value = stepConfig.carrier;
          this.updateStepperNavUI(stepNum);
        }
      });
    }

    if (progRange && !progRange.hasAttribute('data-bound')) {
      progRange.setAttribute('data-bound', 'true');
      progRange.addEventListener('input', () => {
        const val = Number(progRange.value);
        if (progVal) progVal.textContent = `${val}%`;
        let step = 1;
        if (val >= 100) step = 5;
        else if (val >= 85) step = 4;
        else if (val >= 60) step = 3;
        else if (val >= 35) step = 2;
        if (stepSelect) stepSelect.value = String(step);
        this.updateStepperNavUI(step);
        const statusEl = document.getElementById('updateCargoStatus');
        if (statusEl && val >= 100) statusEl.value = 'Delivered';
      });
    }

    if (btnAdvance && !btnAdvance.hasAttribute('data-bound')) {
      btnAdvance.setAttribute('data-bound', 'true');
      btnAdvance.addEventListener('click', () => {
        const curStep = Number(stepSelect?.value || 1);
        const nextStep = Math.min(5, curStep + 1);
        const stepConfig = CONSIGNMENT_STEPS[nextStep - 1];
        if (stepSelect) stepSelect.value = String(nextStep);
        if (progRange) progRange.value = stepConfig.progress;
        if (progVal) progVal.textContent = `${stepConfig.progress}%`;
        const statusEl = document.getElementById('updateCargoStatus');
        if (statusEl) statusEl.value = stepConfig.status;
        const locEl = document.getElementById('updateCargoLocation');
        if (locEl) locEl.value = stepConfig.defaultLocation;
        const carEl = document.getElementById('updateCargoCarrier');
        if (carEl) carEl.value = stepConfig.carrier;
        this.updateStepperNavUI(nextStep);
      });
    }

    if (btnDeliver && !btnDeliver.hasAttribute('data-bound')) {
      btnDeliver.setAttribute('data-bound', 'true');
      btnDeliver.addEventListener('click', () => {
        const stepConfig = CONSIGNMENT_STEPS[4];
        if (stepSelect) stepSelect.value = '5';
        if (progRange) progRange.value = 100;
        if (progVal) progVal.textContent = '100%';
        const statusEl = document.getElementById('updateCargoStatus');
        if (statusEl) statusEl.value = 'Delivered';
        const locEl = document.getElementById('updateCargoLocation');
        if (locEl) locEl.value = stepConfig.defaultLocation;
        const carEl = document.getElementById('updateCargoCarrier');
        if (carEl) carEl.value = stepConfig.carrier;
        this.updateStepperNavUI(5);
      });
    }

    if (form && !form.hasAttribute('data-bound')) {
      form.setAttribute('data-bound', 'true');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!hasPermission(this.currentUser, 'cargo.dispatch')) {
          showNotification('Access Denied: Your clearance does not permit updating cargo status.', 'error', 'Clearance Violation');
          return;
        }
        const id = document.getElementById('updateCargoId').value;
        const stepNum = Number(document.getElementById('updateCargoStepSelect').value);
        const status = document.getElementById('updateCargoStatus').value;
        const progress = Number(document.getElementById('updateCargoProgressRange').value);
        const currentLocation = document.getElementById('updateCargoLocation').value.trim();
        const carrier = document.getElementById('updateCargoCarrier').value.trim();
        const notes = document.getElementById('updateCargoRemarks').value.trim();

        await CargoAPI.setStep(id, stepNum, {
          status,
          progress,
          currentLocation,
          carrier,
          notes
        });

        this.closeModal('modalUpdateConsignment');
        await this.renderCargo();
        this.renderDashboardMetrics();
        if (this.analyticsEngine) this.analyticsEngine.render();
        const stepObj = CONSIGNMENT_STEPS[stepNum - 1];
        showNotification(`Consignment ${id} updated to Step ${stepNum}: ${stepObj.shortName} (${progress}%).`, 'success', 'Consignment Updated');
      });
    }
  }

  async renderInventory() {
    const container = document.getElementById('inventoryCardsContainer');
    const alertBox = document.getElementById('inventoryAlertBox');
    const alertText = document.getElementById('inventoryAlertText');
    if (!container) return;

    // Retrieve active filter parameters
    const searchInput = document.getElementById('invSearchInput');
    const stationSelect = document.getElementById('invFilterStation');
    const riskSelect = document.getElementById('invFilterRisk');

    const filters = {
      search: searchInput ? searchInput.value.trim() : '',
      station: stationSelect ? stationSelect.value : 'all',
      risk: riskSelect ? riskSelect.value : 'all'
    };

    // Load inventory records from the unified API layer
    const inventory = await InventoryAPI.getAll(filters);

    // Calculate inventory health KPI metrics
    const totalCount = inventory.length;
    const criticalCount = inventory.filter(i => (i.current || 0) < (i.threshold || 0)).length;
    const moderateCount = inventory.filter(i => {
      const isCritical = (i.current || 0) < (i.threshold || 0);
      return !isCritical && (i.current || 0) < (i.threshold * 1.5);
    }).length;
    const optimalCount = totalCount - criticalCount - moderateCount;

    // Update KPI counters
    const elTotal = document.getElementById('invMetricTotal');
    const elCritical = document.getElementById('invMetricCritical');
    const elModerate = document.getElementById('invMetricModerate');
    const elOptimal = document.getElementById('invMetricOptimal');
    const elFilterCount = document.getElementById('invFilterCount');

    if (elTotal) elTotal.textContent = totalCount;
    if (elCritical) elCritical.textContent = criticalCount;
    if (elModerate) elModerate.textContent = moderateCount;
    if (elOptimal) elOptimal.textContent = optimalCount;
    if (elFilterCount) {
      elFilterCount.textContent = `Displaying ${totalCount} monitored stock reserve${totalCount === 1 ? '' : 's'}`;
    }

    container.innerHTML = '';
    const alertMsgs = [];

    if (inventory.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5 text-muted glass-panel">
          <i class="fa-solid fa-boxes-packing fs-2 mb-2 d-block text-secondary"></i>
          No station inventory items matched the selected filters.
        </div>
      `;
    }

    const canManageInventory = hasPermission(this.currentUser, 'inventory.manage');

    inventory.forEach(inv => {
      const isCritical = inv.current < inv.threshold;
      const isModerate = !isCritical && inv.current < inv.threshold * 1.5;
      
      let computedRisk = 'Low';
      if (isCritical) {
        computedRisk = 'High';
        alertMsgs.push(`${inv.item} at ${inv.location} (${inv.current} remaining vs ${inv.threshold} minimum threshold)`);
      } else if (isModerate) {
        computedRisk = 'Moderate';
      }

      let riskBadgeClass = 'bg-success text-white';
      let cardBorder = '';
      if (computedRisk === 'Moderate') {
        riskBadgeClass = 'bg-warning text-dark';
      } else if (computedRisk === 'High') {
        riskBadgeClass = 'bg-danger text-white pulse-anim';
        cardBorder = 'border-2 border-danger shadow-sm';
      }

      // Safe percentage gauge
      const ratio = Math.min(100, Math.round((inv.current / Math.max(1, inv.threshold)) * 100));
      let gaugeColor = 'bg-success';
      if (computedRisk === 'Moderate') gaugeColor = 'bg-warning';
      if (computedRisk === 'High') gaugeColor = 'bg-danger';

      let prediction = '';
      if (computedRisk === 'High') {
        prediction = `<small class="text-danger d-block mt-2 fw-medium"><i class="fa-solid fa-triangle-exclamation me-1"></i> Critical shortage: re-supply required urgently.</small>`;
      } else if (computedRisk === 'Moderate') {
        prediction = `<small class="text-warning d-block mt-2"><i class="fa-solid fa-clock me-1"></i> Approaching safety threshold buffer.</small>`;
      }

      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="glass-panel p-4 h-100 d-flex flex-column justify-content-between ${cardBorder}">
          <div>
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div class="d-flex align-items-center gap-2">
                <i class="fa-solid ${inv.icon || 'fa-boxes-stacked'} fs-3 text-cyan"></i>
                <span class="badge bg-light text-muted border text-uppercase" style="font-size: 10px;">${inv.category || 'Supplies'}</span>
              </div>
              <span class="badge ${riskBadgeClass}">${computedRisk} Risk</span>
            </div>

            <h6 class="mb-1 fw-bold text-dark">${inv.item}</h6>
            <p class="text-muted small mb-3">
              <i class="fa-solid fa-location-dot me-1 text-cyan"></i> ${inv.location}
              ${inv.responsible ? `&bull; <span class="text-dark">${inv.responsible}</span>` : ''}
            </p>

            <div class="d-flex justify-content-between align-items-end mb-2">
              <div>
                <div class="text-muted small" style="font-size: 11px;">Current Reserve</div>
                <div class="fs-4 fw-bold text-monospace ${isCritical ? 'text-danger' : 'text-dark'}">${inv.current}</div>
              </div>
              <div class="text-end">
                <div class="text-muted small" style="font-size: 11px;">Safety Threshold</div>
                <div class="fs-6 text-monospace text-secondary">${inv.threshold}</div>
              </div>
            </div>

            <div class="progress bg-white bg-opacity-75 mb-1" style="height: 6px;">
              <div class="progress-bar ${gaugeColor}" style="width: ${ratio}%"></div>
            </div>
            ${prediction}
          </div>

          <!-- Quick Action Buttons -->
          <div class="pt-3 mt-3 border-top d-flex justify-content-between align-items-center">
            ${canManageInventory ? `
              <div class="d-flex gap-1">
                <button class="btn btn-xs btn-outline-success btn-restock-inv" data-id="${inv.id}" title="Restock +10 units">
                  <i class="fa-solid fa-plus me-1"></i>+10
                </button>
                <button class="btn btn-xs btn-outline-warning btn-consume-inv" data-id="${inv.id}" title="Consume -5 units">
                  <i class="fa-solid fa-minus me-1"></i>-5
                </button>
              </div>
              <button class="btn btn-xs btn-outline-danger btn-delete-inv" data-id="${inv.id}" title="Delete Record">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : `
              <div class="d-flex justify-content-between align-items-center w-100">
                <span class="badge bg-light text-muted border"><i class="fa-solid fa-lock me-1"></i>${this.currentUser === 'manager' ? 'Monitor Only' : 'Read-Only Stock'}</span>
                ${this.currentUser === 'field_officer' ? `
                  <button class="btn btn-xs btn-outline-warning" data-bs-toggle="modal" data-bs-target="#modalReportProblem">
                    <i class="fa-solid fa-triangle-exclamation me-1"></i>Report Shortage
                  </button>
                ` : `<small class="text-muted">Managed by Logistics Lead</small>`}
              </div>
            `}
          </div>
        </div>
      `;
      container.appendChild(col);
    });

    // Update safety alert banner
    if (alertMsgs.length > 0 && alertBox) {
      alertBox.classList.remove('d-none');
      if (alertText) {
        alertText.innerHTML = `<strong>Critical Stock Alert:</strong> ${alertMsgs.slice(0, 3).join(' &bull; ')}`;
      }
    } else if (alertBox) {
      alertBox.classList.add('d-none');
    }

    // Bind inventory card actions using delegation
    if (!container.hasAttribute('data-actions-bound')) {
      container.setAttribute('data-actions-bound', 'true');
      container.addEventListener('click', async (e) => {
        const btnRestock = e.target.closest('.btn-restock-inv');
        const btnConsume = e.target.closest('.btn-consume-inv');
        const btnDelete = e.target.closest('.btn-delete-inv');

        if (btnRestock || btnConsume || btnDelete) {
          if (!hasPermission(this.currentUser, 'inventory.manage')) {
            showNotification('Access Denied: Only Logistics Officer and Directorate can adjust stock or delete inventory reserves.', 'error', 'Clearance Violation');
            return;
          }
        }

        if (btnRestock) {
          const id = Number(btnRestock.getAttribute('data-id')) || btnRestock.getAttribute('data-id');
          await InventoryAPI.adjustQuantity(id, 10);
          await this.renderInventory();
          this.renderDashboardMetrics();
        } else if (btnConsume) {
          const id = Number(btnConsume.getAttribute('data-id')) || btnConsume.getAttribute('data-id');
          await InventoryAPI.adjustQuantity(id, -5);
          await this.renderInventory();
          this.renderDashboardMetrics();
        } else if (btnDelete) {
          const id = Number(btnDelete.getAttribute('data-id')) || btnDelete.getAttribute('data-id');
          await InventoryAPI.delete(id);
          await this.renderInventory();
          this.renderDashboardMetrics();
        }
      });
    }

    // Bind search & filter inputs
    if (searchInput && !searchInput.hasAttribute('data-bound')) {
      searchInput.setAttribute('data-bound', 'true');
      searchInput.addEventListener('input', () => this.renderInventory());
    }
    if (stationSelect && !stationSelect.hasAttribute('data-bound')) {
      stationSelect.setAttribute('data-bound', 'true');
      stationSelect.addEventListener('change', () => this.renderInventory());
    }
    if (riskSelect && !riskSelect.hasAttribute('data-bound')) {
      riskSelect.setAttribute('data-bound', 'true');
      riskSelect.addEventListener('change', () => this.renderInventory());
    }

    // Bind Export CSV Button
    const btnExportInv = document.getElementById('btnExportInventoryCsv');
    if (btnExportInv && !btnExportInv.hasAttribute('data-bound')) {
      btnExportInv.setAttribute('data-bound', 'true');
      btnExportInv.addEventListener('click', () => {
        const allInv = StorageService.getData('inventory') || [];
        const rows = allInv.map(i => [
          i.id,
          i.item,
          i.category || 'General',
          i.location,
          i.current,
          i.threshold,
          i.risk || 'Low',
          i.responsible || 'Officer'
        ]);
        const headers = ['Record ID', 'Item Name', 'Category', 'Station Location', 'Current Stock', 'Safety Threshold', 'Risk Level', 'Responsible Lead'];
        exportTableToCsv('icetrack_station_inventory.csv', rows, headers);
      });
    }
  }

  renderPersonnel() {
    const personnel = StorageService.getData('personnel');
    const tbody = document.getElementById('personnelTableBody');
    const filter = document.getElementById('filterPersonnelStation');
    if (!tbody || !filter) return;

    const renderData = (data) => {
      tbody.innerHTML = '';
      data.forEach(p => {
        let statusBadge = 'bg-success';
        if(p.status === 'On-route') statusBadge = 'bg-cyan text-dark';
        if(p.status === 'Medical Hold') statusBadge = 'bg-warning text-dark';
        if(p.status === 'Emergency') statusBadge = 'bg-danger text-white';

        const loc = p.location || `${p.station} Station Hub`;
        const coords = p.coordinates || '70°45′57″S 11°44′09″E';

        const tr = document.createElement('tr');
        const canManagePersonnel = hasPermission(this.currentUser, 'personnel.manage');
        tr.innerHTML = `
          <td class="fw-semibold"><i class="fa-solid fa-circle-user text-muted me-2"></i>${p.name}</td>
          <td>${p.role}</td>
          <td><span class="badge border border-secondary text-light">${p.team}</span></td>
          <td><i class="fa-solid fa-building-flag text-primary me-1"></i> ${p.station}</td>
          <td>
            <div class="fw-bold text-dark small"><i class="fa-solid fa-map-pin text-danger me-1"></i>${loc}</div>
            <div class="text-muted font-monospace" style="font-size: 11px;"><i class="fa-solid fa-location-crosshairs text-info me-1"></i>${coords}</div>
          </td>
          <td><span class="badge ${statusBadge}">${p.status}</span></td>
          <td class="text-monospace small text-muted">${p.clearance}</td>
          <td class="text-end text-nowrap">
            <button class="btn btn-xs btn-outline-primary me-1" onclick="window.IceTrack.switchView('map')" title="Locate on Tactical Map">
              <i class="fa-solid fa-map-location-dot"></i>
            </button>
            ${canManagePersonnel ? `
              <button class="btn btn-xs btn-outline-danger btn-delete-person" data-id="${p.id}" title="Remove Personnel Record">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : `
              <span class="badge bg-light text-muted border"><i class="fa-solid fa-eye me-1"></i>View Only</span>
            `}
          </td>
        `;
        tbody.appendChild(tr);
      });
    };

    renderData(personnel);

    if (!tbody.hasAttribute('data-actions-bound')) {
      tbody.setAttribute('data-actions-bound', 'true');
      tbody.addEventListener('click', (e) => {
        const btnDelete = e.target.closest('.btn-delete-person');
        if (btnDelete) {
          if (!hasPermission(this.currentUser, 'personnel.manage')) {
            showNotification('Access Denied: Only Directorate (Admin) has permission to remove personnel records.', 'error', 'Clearance Violation');
            return;
          }
          const id = btnDelete.getAttribute('data-id');
          let currentList = StorageService.getData('personnel') || [];
          currentList = currentList.filter(item => String(item.id) !== String(id));
          StorageService.saveData('personnel', currentList);
          this.renderPersonnel();
          this.renderHomepagePersonnelLocations();
          this.renderDashboardMetrics();
        }
      });
    }

    if (!filter.hasAttribute('data-bound')) {
      filter.setAttribute('data-bound', 'true');
      filter.addEventListener('change', (e) => {
        const val = e.target.value;
        const freshPersonnel = StorageService.getData('personnel') || [];
        if (val === 'all') renderData(freshPersonnel);
        else renderData(freshPersonnel.filter(p => p.station === val));
      });
    }
  }

  // --- Dedicated Homepage Section: Locations of Personnel ---
  renderHomepagePersonnelLocations(stationFilter = 'all') {
    const container = document.getElementById('homepagePersonnelLocationsGrid');
    if (!container) return;

    let personnel = StorageService.getData('personnel') || [];
    if (stationFilter !== 'all') {
      personnel = personnel.filter(p => p.station === stationFilter);
    }

    if (personnel.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="p-4 text-center border rounded bg-white text-muted">
            <i class="fa-solid fa-location-crosshairs fa-2x mb-2 text-secondary"></i>
            <div>No personnel currently deployed at this station location.</div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = personnel.map(p => {
      const loc = p.location || `${p.station} Station Hub`;
      const coords = p.coordinates || '70°45′57″S 11°44′09″E';

      let badgeClass = 'bg-success';
      if (p.status === 'On-route') badgeClass = 'bg-info text-dark';
      if (p.status === 'Medical Hold') badgeClass = 'bg-warning text-dark';
      if (p.status === 'Emergency') badgeClass = 'bg-danger text-white';

      const stationBadges = {
        'Maitri': 'border border-primary text-primary',
        'Bharati': 'border border-success text-success',
        'Dakshin Ice Camp': 'border border-warning text-dark'
      };
      const stClass = stationBadges[p.station] || 'border border-dark text-dark';

      return `
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card h-100 border border-dark rounded-0 p-3 bg-white shadow-sm">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <div class="fw-bold text-dark fs-6 mb-0">
                  <i class="fa-solid fa-user-astronaut text-primary me-1"></i> ${p.name}
                </div>
                <small class="text-muted">${p.role}</small>
              </div>
              <span class="badge ${badgeClass}" style="font-size: 0.68rem;">${p.status}</span>
            </div>

            <div class="mb-3 p-2 bg-light border">
              <div class="d-flex align-items-center justify-content-between mb-1">
                <span class="badge bg-white ${stClass} text-uppercase" style="font-size: 0.65rem;">
                  <i class="fa-solid fa-building-flag me-1"></i>${p.station}
                </span>
                <span class="badge bg-secondary text-white" style="font-size: 0.65rem;">${p.team}</span>
              </div>
              
              <div class="fw-bold text-dark small mt-2">
                <i class="fa-solid fa-map-pin text-danger me-1"></i> ${loc}
              </div>
              <div class="d-flex align-items-center gap-1 text-muted font-monospace mt-1" style="font-size: 0.78rem;">
                <i class="fa-solid fa-location-crosshairs text-info"></i>
                <span class="fw-bold text-dark">${coords}</span>
              </div>
            </div>

            <div class="mt-auto pt-2 d-flex justify-content-between align-items-center border-top">
              <small class="text-muted" style="font-size: 11px;">
                <i class="fa-solid fa-shield-halved me-1"></i>${p.clearance}
              </small>
              <button class="btn btn-xs btn-outline-dark fw-bold" onclick="window.IceTrack.switchView('map')" title="View on Tactical Geospatial Map">
                Track on Map <i class="fa-solid fa-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  filterHomepagePersonnel(station) {
    const btnGroup = document.getElementById('btnGroupPersonnelFilter');
    if (btnGroup) {
      btnGroup.querySelectorAll('button').forEach(btn => {
        if (btn.getAttribute('data-filter') === station) {
          btn.classList.remove('btn-outline-dark');
          btn.classList.add('btn-dark');
        } else {
          btn.classList.remove('btn-dark');
          btn.classList.add('btn-outline-dark');
        }
      });
    }
    this.renderHomepagePersonnelLocations(station);
  }

  // Helper for opening modals cleanly across all environments (including offline/local)
  openModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;
    if (window.bootstrap && window.bootstrap.Modal) {
      try {
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalInstance.show();
        return;
      } catch {}
    }
    modalEl.classList.add('show');
    modalEl.setAttribute('aria-hidden', 'false');
    modalEl.style.display = 'block';
    if (!document.querySelector('.modal-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      document.body.appendChild(backdrop);
    }
    document.body.classList.add('modal-open');
  }

  // Helper for closing modals cleanly across all environments (including offline/local)
  closeModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;
    if (window.bootstrap && window.bootstrap.Modal) {
      try {
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalInstance.hide();
      } catch {}
    }
    modalEl.classList.remove('show');
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.style.display = 'none';
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');
  }

  bindForms() {
    this.bindUpdateConsignmentModal();

    // Expedition Form
    const expForm = document.getElementById('expeditionForm');
    if (expForm && !expForm.hasAttribute('data-bound')) {
      expForm.setAttribute('data-bound', 'true');
      expForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!hasPermission(this.currentUser, 'expeditions.create')) {
          showNotification('Access Denied: Your clearance level does not permit planning new expeditions.', 'error', 'Clearance Violation');
          return;
        }
        const newExp = {
          name: document.getElementById('expName').value,
          station: document.getElementById('expStation').value,
          start: document.getElementById('expStart').value,
          end: document.getElementById('expEnd').value,
          ship: document.getElementById('expShip').value,
          priority: document.getElementById('expPriority').value
        };
        await ExpeditionsAPI.create(newExp);
        this.renderExpeditions();
        this.renderDashboardMetrics();
        if (this.analyticsEngine) {
          this.analyticsEngine.render();
        }
        expForm.reset();
        showNotification(`Polar expedition "${newExp.name}" registered successfully.`, 'success', 'Expedition Scheduled');
      });
    }

    // Emergency Form
    const sosForm = document.getElementById('emergencyForm');
    if (sosForm && !sosForm.hasAttribute('data-bound')) {
      sosForm.setAttribute('data-bound', 'true');
      sosForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Show map marker
        const mapAlert = document.getElementById('mapAlertMarker');
        if(mapAlert) mapAlert.classList.remove('d-none');
        
        // Update personnel state dummy logic
        const personnel = StorageService.getData('personnel');
        if (personnel.length > 0) {
          personnel[0].status = 'Emergency';
          StorageService.saveData('personnel', personnel);
          this.renderPersonnel();
        }

        // Show automated response panel
        const sosRespPanel = document.getElementById('sosResponsePanel');
        if (sosRespPanel) sosRespPanel.classList.remove('d-none');
        
        // Distance calculation logic
        const sosLocInput = document.getElementById('sosLocation');
        const location = sosLocInput ? sosLocInput.value.toLowerCase() : '';
        let support = "Maitri Base";
        if (location.includes("bharati") || location.includes("east")) support = "Bharati Base";
        const sosStationEl = document.getElementById('sosSupportStation');
        if (sosStationEl) sosStationEl.textContent = support;

        showNotification('CRITICAL SOS DISPATCHED: Search & Rescue coordinates uplinked over emergency satcom frequency.', 'error', 'Emergency Beacon Active');

        // Reset form button text to show transmission sent
        const btn = sosForm.querySelector('button');
        btn.innerHTML = '<i class="fa-solid fa-check me-2"></i> SOS SENT';
        btn.classList.replace('btn-danger', 'btn-secondary');
        setTimeout(() => {
          btn.innerHTML = 'TRANSMIT SOS';
          btn.classList.replace('btn-secondary', 'btn-danger');
          sosForm.reset();
        }, 3000);
      });
    }

    // Modal Form: Register Cargo Consignment
    const cargoForm = document.getElementById('formAddCargo');
    if (cargoForm && !cargoForm.hasAttribute('data-bound')) {
      cargoForm.setAttribute('data-bound', 'true');
      cargoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!hasPermission(this.currentUser, 'cargo.create')) {
          showNotification('Access Denied: Your clearance level does not permit registering cargo consignments.', 'error', 'Clearance Violation');
          return;
        }
        const payload = {
          id: document.getElementById('newCargoId').value.trim() || undefined,
          item: document.getElementById('newCargoItem').value.trim(),
          weight: parseFloat(document.getElementById('newCargoWeight').value) || 0,
          origin: document.getElementById('newCargoOrigin').value,
          destination: document.getElementById('newCargoDestination').value,
          status: document.getElementById('newCargoStatus').value,
          priority: document.getElementById('newCargoPriority').value,
          progress: document.getElementById('newCargoStatus').value === 'Delivered' ? 100 : (document.getElementById('newCargoStatus').value === 'In Transit' ? 50 : 10)
        };

        await CargoAPI.create(payload);
        this.closeModal('modalAddCargo');
        cargoForm.reset();
        await this.renderCargo();
        this.renderDashboardMetrics();
        if (this.analyticsEngine) {
          this.analyticsEngine.render();
        }
        showNotification(`Consignment ${payload.item} registered with destination ${payload.destination}.`, 'success', 'Cargo Manifest Created');
      });
    }

    // Modal Form: Add Inventory Stock Item
    const invForm = document.getElementById('formAddInventory');
    if (invForm && !invForm.hasAttribute('data-bound')) {
      invForm.setAttribute('data-bound', 'true');
      invForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!hasPermission(this.currentUser, 'inventory.manage')) {
          showNotification('Access Denied: Only Directorate and Logistics Officers can add inventory items.', 'error', 'Clearance Violation');
          return;
        }
        const payload = {
          item: document.getElementById('newInvItem').value.trim(),
          category: document.getElementById('newInvCategory').value,
          location: document.getElementById('newInvLocation').value,
          current: parseFloat(document.getElementById('newInvCurrent').value) || 0,
          threshold: parseFloat(document.getElementById('newInvThreshold').value) || 1,
          responsible: document.getElementById('newInvResponsible').value.trim() || 'Logistics Lead',
          icon: document.getElementById('newInvIcon').value || 'fa-boxes-stacked'
        };

        await InventoryAPI.create(payload);
        this.closeModal('modalAddInventory');
        invForm.reset();
        await this.renderInventory();
        this.renderDashboardMetrics();
        showNotification(`Stock reserve for "${payload.item}" created at ${payload.location}.`, 'success', 'Inventory Logged');
      });
    }

    // Modal Form: Add Personnel Member
    const personnelForm = document.getElementById('formAddPersonnel');
    if (personnelForm && !personnelForm.hasAttribute('data-bound')) {
      personnelForm.setAttribute('data-bound', 'true');
      personnelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!hasPermission(this.currentUser, 'personnel.manage')) {
          showNotification('Access Denied: Only Directorate (Admin) has clearance to appoint personnel.', 'error', 'Clearance Violation');
          return;
        }
        const personnel = StorageService.getData('personnel') || [];
        const nextLetter = String.fromCharCode(65 + (personnel.length % 26));
        const nameVal = document.getElementById('newPersonName')?.value.trim() || `Person ${nextLetter}`;
        const stationVal = document.getElementById('newPersonStation')?.value || 'Maitri';
        
        const stationDefaults = {
          'Maitri': { loc: 'Maitri Base Station (Central Module)', coords: '70°45′57″S 11°44′09″E' },
          'Bharati': { loc: 'Bharati Research Station (Main Hub)', coords: '69°24′28″S 76°11′14″E' },
          'Dakshin Ice Camp': { loc: 'Dakshin Ice Camp (Field Rig Site)', coords: '70°45′12″S 11°38′44″E' }
        };
        const def = stationDefaults[stationVal] || { loc: `${stationVal} Station Hub`, coords: '70°45′00″S 11°44′00″E' };

        const locVal = document.getElementById('newPersonLocation')?.value.trim() || def.loc;
        const coordsVal = document.getElementById('newPersonCoordinates')?.value.trim() || def.coords;

        const newPerson = {
          name: nameVal,
          role: document.getElementById('newPersonRole')?.value.trim() || 'Logistics Specialist',
          team: document.getElementById('newPersonTeam')?.value || 'Command Wing',
          station: stationVal,
          location: locVal,
          coordinates: coordsVal,
          status: document.getElementById('newPersonStatus')?.value || 'Active',
          clearance: document.getElementById('newPersonClearance')?.value || 'Level 3'
        };

        await PersonnelAPI.create(newPerson);
        this.closeModal('modalAddPersonnel');
        personnelForm.reset();
        this.renderPersonnel();
        this.renderHomepagePersonnelLocations();
        this.renderDashboardMetrics();
        showNotification(`Personnel record created for ${newPerson.name} at ${newPerson.station}.`, 'success', 'Personnel Appointed');
      });
    }
  }

  // Backend Integration & Synchronization API
  async fetchFromAPI(endpoint) {
    if (endpoint === '/cargo') return await CargoAPI.getAll();
    if (endpoint === '/inventory') return await InventoryAPI.getAll();
    if (endpoint === '/expeditions') return await ExpeditionsAPI.getAll();
    if (endpoint === '/personnel') return await PersonnelAPI.getAll();
    return StorageService.getData(endpoint.replace('/', '')) || [];
  }

  async syncWithBackend() {
    console.log('[IceTrack API] Synchronizing local store with remote backend endpoints...');
    const [cargo, inventory, expeditions, personnel] = await Promise.all([
      CargoAPI.getAll(),
      InventoryAPI.getAll(),
      ExpeditionsAPI.getAll(),
      PersonnelAPI.getAll()
    ]);
    return { cargo, inventory, expeditions, personnel, syncedAt: new Date().toISOString() };
  }

  initGovPortalUtilities() {
    const emailInput = document.getElementById('loginEmail');
    const alertBox = document.getElementById('loginAlert');

    if (emailInput) {
      emailInput.addEventListener('input', () => {
        if (alertBox) alertBox.classList.add('d-none');
      });
    }

    // Toggle Password Visibility
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const passwordInput = document.getElementById('loginPassword');
    const toggleIcon = document.getElementById('togglePasswordIcon');
    if (togglePasswordBtn && passwordInput && toggleIcon) {
      togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
        toggleIcon.className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      });
    }

    // Accessibility font resize
    let currentFontSize = 100;
    const fontDec = document.getElementById('fontDec');
    const fontReset = document.getElementById('fontReset');
    const fontInc = document.getElementById('fontInc');

    if (fontDec) {
      fontDec.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentFontSize > 85) {
          currentFontSize -= 5;
          document.documentElement.style.fontSize = `${currentFontSize}%`;
        }
      });
    }
    if (fontReset) {
      fontReset.addEventListener('click', (e) => {
        e.preventDefault();
        currentFontSize = 100;
        document.documentElement.style.fontSize = '100%';
      });
    }
    if (fontInc) {
      fontInc.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentFontSize < 125) {
          currentFontSize += 5;
          document.documentElement.style.fontSize = `${currentFontSize}%`;
        }
      });
    }
  }

  predictInventoryRisk(inventoryData) {
    // ML prediction placeholder
    return inventoryData;
  }
}

// Initialize application with resilient bootstrap
function bootstrapIceTrack() {
  try {
    const app = new IceTrackApp();
    window.PolarOps = app;
    window.IceTrack = app;
  } catch (err) {
    console.error('Fatal initialization error in IceTrackApp:', err);
    window.IceTrack = window.IceTrack || {
      handleLoginSubmit: () => {
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        const email = (emailInput?.value || '').trim();
        const password = (passwordInput?.value || '').trim();
        const alertBox = document.getElementById('loginAlert');
        const alertText = document.getElementById('loginAlertText');

        if (!email || !password) {
          if (alertBox && alertText) {
            alertText.textContent = 'Please enter both your official email ID and security password.';
            alertBox.classList.remove('d-none');
          }
          return;
        }

        const validAccounts = {
          'a@gmail.com': { pass: 'Admin@2026', role: 'admin', name: 'Administrator', station: 'NCPOR HQ / All Stations' },
          'e@gmail.com': { pass: 'EM@2026', role: 'manager', name: 'Expedition Manager', station: 'Bharati' },
          'f@gmail.com': { pass: 'FO@2026', role: 'field_officer', name: 'Field Officer', station: 'Dakshin Ice Camp' },
          'l@gmail.com': { pass: 'LO@2026', role: 'logistics_officer', name: 'Logistics Officer', station: 'Maitri & Bharati' }
        };

        const acc = validAccounts[email.toLowerCase()];
        if (!acc || acc.pass !== password) {
          if (alertBox && alertText) {
            alertText.textContent = 'Invalid Email or Password. Access Denied: Unauthorized Personnel.';
            alertBox.classList.remove('d-none');
          }
          if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
          }
          return;
        }

        if (alertBox) alertBox.classList.add('d-none');
        const loginSec = document.getElementById('loginSection');
        const appSec = document.getElementById('appSection');
        if (loginSec) {
          loginSec.classList.add('d-none');
          loginSec.style.setProperty('display', 'none', 'important');
        }
        if (appSec) {
          appSec.classList.remove('d-none');
          appSec.style.setProperty('display', 'flex', 'important');
        }
      }
    };
    window.PolarOps = window.IceTrack;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapIceTrack);
} else {
  bootstrapIceTrack();
}
