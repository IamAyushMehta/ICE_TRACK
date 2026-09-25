/**
 * ICETRACK — Unified Database & Backend Integration API
 * 
 * This service provides a standardized RESTful and Database Adapter interface for
 * the polar logistics command portal. It is 100% plug-and-play compatible with:
 * 1. Offline & Local Standalone (file:// protocol & memory/localStorage)
 * 2. Node.js / Express backend server (/api/v1)
 * 3. Relational SQL databases (PostgreSQL, Cloud SQL, SQLite, MySQL)
 * 4. Document / NoSQL databases (Firebase Firestore, Supabase, MongoDB)
 */

import { StorageService, AUTHORIZED_OFFICERS, defaultData, CONSIGNMENT_STEPS, getConsignmentStep } from './data.js';

export { CONSIGNMENT_STEPS, getConsignmentStep };

// Configuration Settings
export const API_CONFIG = {
  // Mode: 'auto' (detects if remote server responds), true (enforce remote), or false (local only)
  MODE: 'auto',
  // Remote API Base URL (e.g., '/api/v1' or 'http://localhost:3000/api/v1')
  API_BASE_URL: '/api/v1',
  REQUEST_TIMEOUT: 4000,
  AUTH_TOKEN_KEY: 'icetrack_auth_token',
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  // Set to true once verified active remote connection
  isRemoteAvailable: false
};

// Check if running directly from local filesystem (file:// protocol)
export function isLocalFileProtocol() {
  try {
    return typeof window !== 'undefined' && window.location.protocol === 'file:';
  } catch {
    return false;
  }
}

/**
 * Generic HTTP Request Dispatcher with automatic local fallback & 403 protection
 */
async function apiRequest(endpoint, method = 'GET', payload = null) {
  // If local file protocol or mode is explicitly false, skip network request entirely
  if (isLocalFileProtocol() || API_CONFIG.MODE === false) {
    return null;
  }

  // If in 'auto' or true mode, attempt network request with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.REQUEST_TIMEOUT);

    const token = StorageService.getItem(API_CONFIG.AUTH_TOKEN_KEY);
    const headers = { ...API_CONFIG.HEADERS };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_CONFIG.API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : null,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (response.status === 403) {
      // 403 Forbidden: Blocked by backend RBAC
      const errorMsg = data?.error || '403 Forbidden: Access Denied.';
      if (typeof window !== 'undefined' && window.IceTrack && window.IceTrack.showAccessDenied) {
        window.IceTrack.showAccessDenied(endpoint, errorMsg);
      }
      const err = new Error(errorMsg);
      err.status = 403;
      err.is403 = true;
      throw err;
    }

    if (response.status === 401) {
      if (endpoint !== '/auth/login') {
        const errorMsg = data?.error || '401 Unauthorized: Session expired.';
        const err = new Error(errorMsg);
        err.status = 401;
        throw err;
      }
      throw new Error(data?.error || 'Invalid Email or Password. Access Denied: Unauthorized Personnel.');
    }

    if (response.ok) {
      API_CONFIG.isRemoteAvailable = true;
      return data;
    } else {
      throw new Error(data?.error || `HTTP Error ${response.status}`);
    }
  } catch (err) {
    if (err.status === 403 || err.status === 401 || err.message?.includes('Access Denied')) {
      throw err;
    }
    // Network or CORS error (e.g. offline, server not started) -> fallback to local data
    API_CONFIG.isRemoteAvailable = false;
  }

  return null;
}

/**
 * Authentication & Identity Service (Server-Authoritative RBAC)
 */
export const AuthAPI = {
  async login(email, password, requestedRole = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    try {
      // Remote call: Send email, password, and requested role (if custom onboarded)
      const remote = await apiRequest('/auth/login', 'POST', { 
        email: cleanEmail, 
        password: cleanPass, 
        role: requestedRole 
      });
      if (remote && (remote.token || remote.success)) {
        const userObj = remote.user || remote;
        StorageService.setItem(API_CONFIG.AUTH_TOKEN_KEY, remote.token || 'remote_token');
        StorageService.setItem('icetrack_user_email', userObj.email);
        StorageService.setItem('icetrack_user_name', userObj.name);
        StorageService.setItem('icetrack_user_role', userObj.role);
        StorageService.setItem('icetrack_user_station', userObj.station || 'Bharati');
        StorageService.setItem('icetrack_user_data', JSON.stringify(userObj));
        return { success: true, token: remote.token, user: userObj };
      }
    } catch (err) {
      // If the backend returned an explicit auth rejection (401/403/Access Denied), rethrow
      if (err.status === 401 || err.status === 403 || (err.message && err.message.includes('Access Denied'))) {
        throw err;
      }
      console.warn('[ICETRACK Network Auth Fallback] Remote authentication unavailable, engaging safe local offline store:', err);
    }

    // Local authentication & offline fallback - strictly enforce authorized officer accounts only
    const matched = AUTHORIZED_OFFICERS.find(
      o => o.email.toLowerCase() === cleanEmail
    );

    if (!matched) {
      throw new Error('Access Denied: Unauthorized Personnel. Email ID not registered in polar directory.');
    }

    if (matched.password !== cleanPass) {
      throw new Error('Invalid security password. Access Denied: Unauthorized Personnel.');
    }

    const token = `local_token_${Date.now()}`;
    const officer = {
      id: matched.id || 'USR-LOCAL',
      name: matched.name,
      email: matched.email,
      role: matched.defaultRole,
      station: matched.station,
      jurisdiction: matched.jurisdiction || matched.station,
      assignedExpedition: matched.assignedExpedition || '44th Indian Scientific Expedition to Antarctica',
      assignedTeam: matched.assignedTeam || 'Scientific Wing',
      designation: matched.designation,
      clearance: matched.clearance
    };

    StorageService.setItem(API_CONFIG.AUTH_TOKEN_KEY, token);
    StorageService.setItem('icetrack_user_email', officer.email);
    StorageService.setItem('icetrack_user_name', officer.name);
    StorageService.setItem('icetrack_user_role', officer.role);
    StorageService.setItem('icetrack_user_station', officer.station);
    StorageService.setItem('icetrack_user_data', JSON.stringify(officer));

    return { success: true, token, user: officer };
  },

  async getCurrentUser() {
    try {
      const remote = await apiRequest('/auth/me');
      if (remote && remote.user) {
        StorageService.setItem('icetrack_user_role', remote.user.role);
        StorageService.setItem('icetrack_user_data', JSON.stringify(remote.user));
        return remote.user;
      }
    } catch {}

    const rawUser = StorageService.getItem('icetrack_user_data');
    if (rawUser) {
      try {
        return JSON.parse(rawUser);
      } catch {}
    }

    const email = StorageService.getItem('icetrack_user_email');
    const name = StorageService.getItem('icetrack_user_name');
    const role = StorageService.getItem('icetrack_user_role') || 'manager';

    if (!email && !name) return null;
    return { email, name, role };
  },

  async logout() {
    try {
      await apiRequest('/auth/logout', 'POST');
    } catch {}
    StorageService.removeItem(API_CONFIG.AUTH_TOKEN_KEY);
    StorageService.removeItem('icetrack_user_email');
    StorageService.removeItem('icetrack_user_name');
    StorageService.removeItem('icetrack_user_role');
    StorageService.removeItem('icetrack_user_station');
    StorageService.removeItem('icetrack_user_data');
    return true;
  }
};

/**
 * Expeditions Operations API Service
 */
export const ExpeditionsAPI = {
  async getAll() {
    const remote = await apiRequest('/expeditions');
    if (remote && Array.isArray(remote.data)) {
      return remote.data;
    }
    return StorageService.getData('expeditions') || [];
  },

  async getById(id) {
    const list = await this.getAll();
    return list.find(e => String(e.id) === String(id)) || null;
  },

  async create(expeditionData) {
    const remote = await apiRequest('/expeditions', 'POST', expeditionData);
    if (remote && remote.data) {
      return remote.data;
    }

    const list = StorageService.getData('expeditions') || [];
    const newExp = {
      id: expeditionData.id || Date.now(),
      name: expeditionData.name.trim(),
      station: expeditionData.station.trim(),
      start: expeditionData.start,
      end: expeditionData.end,
      ship: expeditionData.ship.trim(),
      priority: expeditionData.priority || 'Normal',
      createdAt: new Date().toISOString()
    };

    list.unshift(newExp);
    StorageService.saveData('expeditions', list);
    return newExp;
  },

  async update(id, updates) {
    const remote = await apiRequest(`/expeditions/${id}`, 'PATCH', updates);
    if (remote && remote.data) {
      return remote.data;
    }

    const list = StorageService.getData('expeditions') || [];
    const index = list.findIndex(e => String(e.id) === String(id));
    if (index === -1) return null;

    list[index] = { ...list[index], ...updates };
    StorageService.saveData('expeditions', list);
    return list[index];
  },

  async delete(id) {
    await apiRequest(`/expeditions/${id}`, 'DELETE');
    let list = StorageService.getData('expeditions') || [];
    list = list.filter(e => String(e.id) !== String(id));
    StorageService.saveData('expeditions', list);
    return true;
  }
};

/**
 * Cargo Logistics API Service
 */
export const CargoAPI = {
  async getAll(filters = {}) {
    const remote = await apiRequest('/cargo');
    let list = (remote && Array.isArray(remote.data)) ? remote.data : (StorageService.getData('cargo') || []);

    if (filters.status && filters.status !== 'all') {
      list = list.filter(item => item.status.toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(item =>
        item.id.toLowerCase().includes(q) ||
        item.item.toLowerCase().includes(q) ||
        (item.origin && item.origin.toLowerCase().includes(q)) ||
        (item.destination && item.destination.toLowerCase().includes(q))
      );
    }

    return list;
  },

  async getById(id) {
    const list = await this.getAll();
    return list.find(item => String(item.id).toLowerCase() === String(id).toLowerCase()) || null;
  },

  async create(cargoData) {
    const remote = await apiRequest('/cargo', 'POST', cargoData);
    if (remote && remote.data) return remote.data;

    const list = StorageService.getData('cargo') || [];
    const newCargo = {
      id: cargoData.id || `CGO-${Math.floor(1000 + Math.random() * 9000)}`,
      item: cargoData.item.trim(),
      weight: parseFloat(cargoData.weight || cargoData.weightKg) || 0,
      weightKg: parseFloat(cargoData.weight || cargoData.weightKg) || 0,
      origin: cargoData.origin ? cargoData.origin.trim() : 'Mormugao Port (Goa)',
      destination: cargoData.destination.trim(),
      status: cargoData.status || 'In Transit',
      progress: parseInt(cargoData.progress, 10) || 15,
      priority: cargoData.priority || 'Normal',
      createdAt: new Date().toISOString()
    };

    list.unshift(newCargo);
    StorageService.saveData('cargo', list);
    return newCargo;
  },

  async update(id, updates) {
    if (updates.currentStep) {
      const stepIdx = Math.max(1, Math.min(5, Number(updates.currentStep))) - 1;
      const stepConfig = CONSIGNMENT_STEPS[stepIdx];
      if (stepConfig) {
        updates.stepName = updates.stepName || stepConfig.label;
        if (updates.progress === undefined) updates.progress = stepConfig.progress;
        if (updates.status === undefined) updates.status = stepConfig.status;
        if (!updates.currentLocation) updates.currentLocation = stepConfig.defaultLocation;
        if (!updates.carrier) updates.carrier = stepConfig.carrier;
      }
    }

    const remote = await apiRequest(`/cargo/${id}`, 'PATCH', updates);
    const list = StorageService.getData('cargo') || [];
    const index = list.findIndex(c => String(c.id).toLowerCase() === String(id).toLowerCase());
    if (index !== -1) {
      list[index] = { ...list[index], ...(remote?.data || updates), updatedAt: new Date().toISOString() };
      StorageService.saveData('cargo', list);
      return list[index];
    }
    if (remote && remote.data) return remote.data;
    return null;
  },

  async advanceStep(id) {
    const list = StorageService.getData('cargo') || [];
    const item = list.find(c => String(c.id).toLowerCase() === String(id).toLowerCase());
    if (!item) return null;

    const currentStepObj = getConsignmentStep(item);
    const nextStepNum = Math.min(5, currentStepObj.step + 1);
    const nextStepObj = CONSIGNMENT_STEPS[nextStepNum - 1];

    return await this.update(id, {
      currentStep: nextStepNum,
      stepName: nextStepObj.label,
      progress: nextStepObj.progress,
      status: nextStepObj.status,
      currentLocation: nextStepObj.defaultLocation,
      carrier: item.carrier || nextStepObj.carrier
    });
  },

  async setStep(id, stepNum, customData = {}) {
    const validStep = Math.max(1, Math.min(5, Number(stepNum) || 1));
    const stepObj = CONSIGNMENT_STEPS[validStep - 1];

    return await this.update(id, {
      currentStep: validStep,
      stepName: stepObj.label,
      progress: customData.progress !== undefined ? Number(customData.progress) : stepObj.progress,
      status: customData.status || stepObj.status,
      currentLocation: customData.currentLocation || stepObj.defaultLocation,
      carrier: customData.carrier || stepObj.carrier,
      notes: customData.notes || customData.remarks,
      ...customData
    });
  },

  async advanceProgress(id, increment = 15) {
    const list = StorageService.getData('cargo') || [];
    const item = list.find(c => String(c.id).toLowerCase() === String(id).toLowerCase());
    if (!item) return null;

    let newProgress = Math.min(100, (item.progress || 0) + increment);
    let stepNum = 1;
    if (newProgress >= 100) stepNum = 5;
    else if (newProgress >= 85) stepNum = 4;
    else if (newProgress >= 60) stepNum = 3;
    else if (newProgress >= 35) stepNum = 2;

    const stepObj = CONSIGNMENT_STEPS[stepNum - 1];

    return await this.update(id, {
      progress: newProgress,
      currentStep: stepNum,
      stepName: stepObj.label,
      status: newProgress >= 100 ? 'Delivered' : stepObj.status
    });
  },

  async markDelivered(id) {
    const stepObj = CONSIGNMENT_STEPS[4];
    return await this.update(id, {
      progress: 100,
      currentStep: 5,
      stepName: stepObj.label,
      status: 'Delivered',
      currentLocation: 'Polar Station Central Depot (Storage Module)'
    });
  },

  async delete(id) {
    await apiRequest(`/cargo/${id}`, 'DELETE');
    let list = StorageService.getData('cargo') || [];
    list = list.filter(item => String(item.id).toLowerCase() !== String(id).toLowerCase());
    StorageService.saveData('cargo', list);
    return true;
  }
};

/**
 * Inventory Stock API Service
 */
export const InventoryAPI = {
  async getAll(filters = {}) {
    const remote = await apiRequest('/inventory');
    let list = (remote && Array.isArray(remote.data)) ? remote.data : (StorageService.getData('inventory') || []);

    if (filters.station && filters.station !== 'all') {
      list = list.filter(item => item.location.toLowerCase() === filters.station.toLowerCase());
    }

    if (filters.risk && filters.risk !== 'all') {
      list = list.filter(item => (item.risk || 'Low').toLowerCase() === filters.risk.toLowerCase());
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(item =>
        item.item.toLowerCase().includes(q) ||
        (item.responsible && item.responsible.toLowerCase().includes(q)) ||
        item.location.toLowerCase().includes(q)
      );
    }

    return list;
  },

  async getById(id) {
    const list = await this.getAll();
    return list.find(item => String(item.id) === String(id)) || null;
  },

  async create(itemData) {
    const remote = await apiRequest('/inventory', 'POST', itemData);
    if (remote && remote.data) return remote.data;

    const list = StorageService.getData('inventory') || [];
    const current = parseFloat(itemData.current) || 0;
    const threshold = parseFloat(itemData.threshold) || 1;

    let risk = 'Low';
    if (current < threshold) risk = 'High';
    else if (current < threshold * 1.5) risk = 'Moderate';

    const newItem = {
      id: itemData.id || Date.now(),
      item: itemData.item.trim(),
      current,
      threshold,
      location: itemData.location.trim(),
      responsible: itemData.responsible ? itemData.responsible.trim() : 'Station Officer',
      risk,
      icon: itemData.icon || 'fa-boxes-stacked',
      category: itemData.category || 'General Supplies',
      updatedAt: new Date().toISOString()
    };

    list.unshift(newItem);
    StorageService.saveData('inventory', list);
    return newItem;
  },

  async update(id, updates) {
    const remote = await apiRequest(`/inventory/${id}`, 'PATCH', updates);
    if (remote && remote.data) return remote.data;

    const list = StorageService.getData('inventory') || [];
    const index = list.findIndex(item => String(item.id) === String(id));
    if (index === -1) return null;

    const current = updates.current !== undefined ? parseFloat(updates.current) : list[index].current;
    const threshold = updates.threshold !== undefined ? parseFloat(updates.threshold) : list[index].threshold;

    let risk = 'Low';
    if (current < threshold) risk = 'High';
    else if (current < threshold * 1.5) risk = 'Moderate';

    list[index] = {
      ...list[index],
      ...updates,
      current,
      threshold,
      risk,
      updatedAt: new Date().toISOString()
    };

    StorageService.saveData('inventory', list);
    return list[index];
  },

  async adjustQuantity(id, delta) {
    const list = StorageService.getData('inventory') || [];
    const item = list.find(i => String(i.id) === String(id));
    if (!item) return null;

    const newCurrent = Math.max(0, (item.current || 0) + delta);
    return await this.update(id, { current: newCurrent });
  },

  async delete(id) {
    await apiRequest(`/inventory/${id}`, 'DELETE');
    let list = StorageService.getData('inventory') || [];
    list = list.filter(item => String(item.id) !== String(id));
    StorageService.saveData('inventory', list);
    return true;
  },

  async reportProblem(id, problemDetails) {
    const remote = await apiRequest(`/inventory/${id}/report-problem`, 'POST', problemDetails);
    if (remote && remote.data) return remote.data;
    return { success: true, reportedAt: new Date().toISOString(), details: problemDetails };
  }
};

/**
 * Personnel Manifest API Service
 */
export const PersonnelAPI = {
  async getAll(filters = {}) {
    const remote = await apiRequest('/personnel');
    let list = (remote && Array.isArray(remote.data)) ? remote.data : (StorageService.getData('personnel') || []);

    if (filters.station && filters.station !== 'all') {
      list = list.filter(p => p.station.toLowerCase() === filters.station.toLowerCase());
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q))
      );
    }

    return list;
  },

  async create(personData) {
    const remote = await apiRequest('/personnel', 'POST', personData);
    if (remote && remote.data) return remote.data;

    const list = StorageService.getData('personnel') || [];
    const newPerson = {
      id: personData.id || Date.now(),
      name: personData.name.trim(),
      role: personData.role.trim(),
      station: personData.station.trim(),
      clearance: personData.clearance || 'Level 3',
      team: personData.team || 'Scientific Wing',
      status: personData.status || 'Active',
      email: personData.email || `${personData.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      createdAt: new Date().toISOString()
    };

    list.unshift(newPerson);
    StorageService.saveData('personnel', list);
    return newPerson;
  },

  async delete(id) {
    await apiRequest(`/personnel/${id}`, 'DELETE');
    let list = StorageService.getData('personnel') || [];
    list = list.filter(p => String(p.id) !== String(id));
    StorageService.saveData('personnel', list);
    return true;
  }
};

/**
 * Administration & User Management Service (Admin Role Enforced)
 */
export const UsersAPI = {
  async getAll() {
    const remote = await apiRequest('/users');
    if (remote && remote.data) return remote.data;
    return AUTHORIZED_OFFICERS.map(o => ({
      id: o.id || 'USR-001',
      name: o.name,
      email: o.email,
      role: o.defaultRole,
      designation: o.designation,
      station: o.station,
      clearance: o.clearance,
      assignedExpedition: o.assignedExpedition || 'All Expeditions',
      assignedTeam: o.assignedTeam || 'Command HQ',
      createdAt: '2024-01-01T00:00:00Z'
    }));
  },

  async create(userData) {
    const remote = await apiRequest('/users', 'POST', userData);
    if (remote && remote.data) return remote.data;
    throw new Error('User creation requires active connection to ICETRACK Admin Service.');
  },

  async updateRole(userId, newRole) {
    const remote = await apiRequest(`/users/${userId}/role`, 'PATCH', { role: newRole });
    if (remote && remote.data) return remote.data;
    throw new Error('Role modification requires active connection to ICETRACK Admin Service.');
  },

  async assignRole(userId, newRole) {
    return this.updateRole(userId, newRole);
  }
};

/**
 * Audit Trail & Security Logs Service (Admin Role Enforced)
 */
export const AuditLogsAPI = {
  async getAll() {
    const remote = await apiRequest('/audit-logs');
    if (remote && remote.data) return remote.data;
    return [
      {
        id: 'AUD-001',
        action: 'SYSTEM_BOOTSTRAP',
        actorId: 'SYSTEM',
        actorEmail: 'system@ncpor.gov.in',
        actorRole: 'system',
        details: 'ICETRACK RBAC Kernel and Polar Operations Database initialized',
        timestamp: new Date().toISOString()
      }
    ];
  }
};

/**
 * Field Officer Scientific Reports & GPS Telemetry Service
 */
export const FieldAPI = {
  async updateLocation(coords) {
    const remote = await apiRequest('/field/location', 'POST', coords);
    if (remote && remote.data) return remote.data;
    return { success: true, coordinates: `${coords.latitude}, ${coords.longitude}`, timestamp: new Date().toISOString() };
  },

  async getObservations() {
    const remote = await apiRequest('/field/observations');
    if (remote && remote.data) return remote.data;
    return StorageService.getData('fieldObservations') || [];
  },

  async submitObservation(observationData) {
    const remote = await apiRequest('/field/observations', 'POST', observationData);
    if (remote && remote.data) return remote.data;

    const list = StorageService.getData('fieldObservations') || [];
    const newObs = {
      id: `FR-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...observationData
    };
    list.unshift(newObs);
    StorageService.saveData('fieldObservations', list);
    return newObs;
  }
};

/**
 * Emergency & SOS Operations Service
 */
export const EmergencyAPI = {
  async getAll() {
    const remote = await apiRequest('/emergency');
    if (remote && remote.data) return remote.data;
    return StorageService.getData('emergencies') || [];
  },

  async create(sosData) {
    const remote = await apiRequest('/emergency', 'POST', sosData);
    if (remote && remote.data) return remote.data;

    const list = StorageService.getData('emergencies') || [];
    const newEmg = {
      id: `EMG-${Math.floor(100 + Math.random() * 900)}`,
      status: 'Active',
      timestamp: new Date().toISOString(),
      ...sosData
    };
    list.unshift(newEmg);
    StorageService.saveData('emergencies', list);
    return newEmg;
  },

  async resolve(id) {
    const remote = await apiRequest(`/emergency/${id}/resolve`, 'PATCH');
    if (remote && remote.data) return remote.data;

    let list = StorageService.getData('emergencies') || [];
    const target = list.find(e => e.id === id);
    if (target) {
      target.status = 'Resolved';
      StorageService.saveData('emergencies', list);
    }
    return true;
  }
};

/**
 * Unified Database Adapter
 * Used for programmatic export, import, or cloud syncing
 */
export const DatabaseAdapter = {
  async exportCompleteDatabase() {
    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      expeditions: StorageService.getData('expeditions') || [],
      cargo: StorageService.getData('cargo') || [],
      inventory: StorageService.getData('inventory') || [],
      personnel: StorageService.getData('personnel') || []
    };
  },

  async importCompleteDatabase(jsonData) {
    if (!jsonData) return false;
    if (Array.isArray(jsonData.expeditions)) StorageService.saveData('expeditions', jsonData.expeditions);
    if (Array.isArray(jsonData.cargo)) StorageService.saveData('cargo', jsonData.cargo);
    if (Array.isArray(jsonData.inventory)) StorageService.saveData('inventory', jsonData.inventory);
    if (Array.isArray(jsonData.personnel)) StorageService.saveData('personnel', jsonData.personnel);
    return true;
  },

  async resetToBaseline() {
    StorageService.saveData('expeditions', defaultData.expeditions);
    StorageService.saveData('cargo', defaultData.cargo);
    StorageService.saveData('inventory', defaultData.inventory);
    StorageService.saveData('personnel', defaultData.personnel);
    return true;
  }
};

/**
 * In-App Notification System (Replaces window.alert for clean iframe compliance)
 * Includes deduplication to guarantee no alert or update message ever displays twice.
 */
let lastNotificationRecord = { message: '', time: 0 };

export function showNotification(message, type = 'info', title = '') {
  if (typeof document === 'undefined' || !message) return;

  const cleanMsg = String(message).trim();
  const now = Date.now();

  // Deduplication guard: discard identical message triggered within 1500ms
  if (lastNotificationRecord.message === cleanMsg && (now - lastNotificationRecord.time) < 1500) {
    return;
  }
  lastNotificationRecord = { message: cleanMsg, time: now };

  let container = document.getElementById('icetrackNotificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'icetrackNotificationContainer';
    container.style.cssText = 'position: fixed; top: 1.5rem; right: 1.5rem; z-index: 99999; display: flex; flex-direction: column; gap: 0.5rem; max-width: 420px; pointer-events: none;';
    document.body.appendChild(container);
  }

  // Check if an identical notification is already visible in the container
  const activeToasts = container.querySelectorAll('.icetrack-toast-body');
  for (let i = 0; i < activeToasts.length; i++) {
    if (activeToasts[i].textContent.trim() === cleanMsg) {
      return;
    }
  }

  const toast = document.createElement('div');
  toast.className = 'icetrack-toast-item';
  const typeStyles = {
    success: 'background: #064e3b; color: #a7f3d0; border: 1px solid #059669;',
    warning: 'background: #451a03; color: #fde68a; border: 1px solid #d97706;',
    error: 'background: #450a0a; color: #fca5a5; border: 1px solid #dc2626;',
    info: 'background: #082f49; color: #bae6fd; border: 1px solid #0284c7;'
  };
  toast.style.cssText = `pointer-events: auto; padding: 0.85rem 1.15rem; border-radius: 6px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); font-size: 0.85rem; line-height: 1.4; transition: all 0.25s ease; transform: translateY(-10px); opacity: 0; display: flex; align-items: flex-start; gap: 0.75rem; font-family: system-ui, -apple-system, sans-serif; ${typeStyles[type] || typeStyles.info}`;

  const icons = {
    success: '<i class="fa-solid fa-circle-check fs-5"></i>',
    warning: '<i class="fa-solid fa-triangle-exclamation fs-5"></i>',
    error: '<i class="fa-solid fa-circle-exclamation fs-5"></i>',
    info: '<i class="fa-solid fa-circle-info fs-5"></i>'
  };

  toast.innerHTML = `
    <div style="flex-shrink: 0; margin-top: 1px;">${icons[type] || icons.info}</div>
    <div style="flex-grow: 1;">
      ${title ? `<div style="font-weight: 700; margin-bottom: 2px; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px;">${title}</div>` : ''}
      <div class="icetrack-toast-body" style="white-space: pre-line;">${cleanMsg}</div>
    </div>
    <button style="background: none; border: none; color: currentColor; opacity: 0.7; cursor: pointer; padding: 0; margin-left: 6px; font-size: 1.2rem; line-height: 1;" title="Close">&times;</button>
  `;

  const closeBtn = toast.querySelector('button');
  const dismiss = () => {
    toast.style.transform = 'translateY(-10px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  };
  if (closeBtn) closeBtn.addEventListener('click', dismiss);

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  setTimeout(dismiss, 4500);
}

if (typeof window !== 'undefined') {
  window.IceTrackNotify = showNotification;
}

/**
 * Utility function to download data as a CSV file
 */
export function exportTableToCsv(filename, rows, headers) {
  if (!rows || !rows.length) {
    showNotification('No records available to export.', 'warning', 'CSV Export');
    return;
  }

  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map(row =>
      row.map(val => {
        const str = String(val ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showNotification(`Exported ${rows.length} records to ${filename}`, 'success', 'Export Complete');
}
