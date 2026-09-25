/**
 * ICETRACK — Dynamic Role-Based Command Dashboards
 * Comprehensive, role-specific command dashboards tailored for:
 * 1. Administrator (A@gmail.com)
 * 2. Expedition Manager (E@gmail.com)
 * 3. Field/Research Officer (F@gmail.com)
 * 4. Logistics Officer (L@gmail.com)
 */

import { UsersAPI, FieldAPI } from './api.js';

export function renderRoleDashboard(role, officer, container, appInstance) {
  if (!container) return;

  switch (role) {
    case 'admin':
      renderAdminDashboard(officer, container, appInstance);
      break;
    case 'manager':
      renderManagerDashboard(officer, container, appInstance);
      break;
    case 'field_officer':
      renderFieldOfficerDashboard(officer, container, appInstance);
      break;
    case 'logistics_officer':
      renderLogisticsDashboard(officer, container, appInstance);
      break;
    default:
      renderManagerDashboard(officer, container, appInstance);
  }
}

/**
 * 1. ADMINISTRATOR DASHBOARD
 * Full institutional overview + User & Role Administration Console + Audit Trail + System Metrics
 */
export async function renderAdminDashboard(officer, container, appInstance) {
  let usersList = [];
  try {
    const res = await UsersAPI.getAll();
    if (res && res.data) usersList = res.data;
  } catch (e) {
    console.warn('Failed to load users for admin dashboard:', e);
  }

  container.innerHTML = `
    <!-- Administrator Institutional Operations Header -->
    <div class="card border-0 shadow-sm mb-4 bg-dark text-white rounded-3 overflow-hidden">
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-danger px-2 py-1"><i class="fa-solid fa-shield-halved me-1"></i> CLEARANCE LEVEL 5</span>
              <span class="badge bg-secondary">DIRECTORATE GENERAL</span>
              <span class="badge bg-success bg-opacity-75"><i class="fa-solid fa-satellite me-1"></i> GSAT-7A SATCOM SECURE</span>
            </div>
            <h2 class="h4 fw-bold text-white mb-1">
              <i class="fa-solid fa-crown text-warning me-2"></i>Institutional Operations & RBAC Command
            </h2>
            <p class="text-light text-opacity-75 small mb-0">
              National Centre for Polar and Ocean Research (MoES, Govt. of India) • Global Arctic & Antarctic Jurisdiction
            </p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-light" onclick="window.IceTrack.loadAuditLogs()" data-bs-toggle="modal" data-bs-target="#modalAdminAuditLogs">
              <i class="fa-solid fa-clipboard-list me-1 text-info"></i> Security Audit Trail
            </button>
            <button class="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#modalCreateUser">
              <i class="fa-solid fa-user-plus me-1"></i> Provision User Account
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Institutional KPI Overview Strip -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Active Expeditions</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">3 Missions</h3>
              <small class="text-success fw-bold"><i class="fa-solid fa-check-double me-1"></i>All Nominal</small>
            </div>
            <div class="p-2 rounded bg-primary-subtle text-primary"><i class="fa-solid fa-mountain-sun fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Station Personnel</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">48 Active</h3>
              <small class="text-muted">Maitri, Bharati & Dakshin</small>
            </div>
            <div class="p-2 rounded bg-info-subtle text-info"><i class="fa-solid fa-users-gear fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Fleet Consignments</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">11,250 kg</h3>
              <small class="text-primary fw-bold">4 Active Manifests</small>
            </div>
            <div class="p-2 rounded bg-success-subtle text-success"><i class="fa-solid fa-boxes-packing fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">System Security</span>
              <h3 class="fw-bold text-success mt-1 mb-0">100% RBAC</h3>
              <small class="text-muted">Tier-1 Satcom Uplink</small>
            </div>
            <div class="p-2 rounded bg-warning-subtle text-warning"><i class="fa-solid fa-shield-halved fa-lg"></i></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Institutional User Administration Console -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-white py-3 border-bottom d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <div>
          <h5 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-users-gear text-primary me-2"></i>Officer Accounts & Access Control Console</h5>
          <small class="text-muted">Server-authoritative Role-Based Access Control matrix. Changes take immediate effect across sessions.</small>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-light text-dark border px-2 py-1">${usersList.length} Accounts Registered</span>
          <button class="btn btn-sm btn-outline-secondary" onclick="window.IceTrack.renderRoleSpecificDashboard()">
            <i class="fa-solid fa-arrows-rotate"></i>
          </button>
        </div>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 small">
            <thead class="table-light text-muted">
              <tr>
                <th class="ps-3">Officer Name / Email</th>
                <th>Role & Clearance</th>
                <th>Station / Base</th>
                <th>Security Clearance</th>
                <th>Assigned Expedition</th>
                <th class="pe-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody id="adminUsersTableBody">
              ${renderUserRows(usersList)}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Quick Dispatch & Operational Shortcuts -->
    <div class="row g-3 mb-4">
      <div class="col-lg-7">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white py-3 border-bottom">
            <h6 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-tower-broadcast text-primary me-2"></i>Institutional Station Telemetry</h6>
          </div>
          <div class="card-body p-3">
            <div class="p-3 rounded border bg-light mb-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="fw-bold text-dark"><i class="fa-solid fa-satellite-dish me-2 text-cyan"></i>Maitri Base Station (Queen Maud Land)</div>
                <span class="badge bg-success">OPERATIONAL</span>
              </div>
              <div class="row g-2 text-muted small">
                <div class="col-4">Temp: <strong class="text-dark">-18.4°C</strong></div>
                <div class="col-4">Wind: <strong class="text-dark">28 kts</strong></div>
                <div class="col-4">Power: <strong class="text-success">Nominal</strong></div>
              </div>
            </div>
            <div class="p-3 rounded border bg-light mb-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="fw-bold text-dark"><i class="fa-solid fa-satellite-dish me-2 text-primary"></i>Bharati Base Station (Larsemann Hills)</div>
                <span class="badge bg-success">OPERATIONAL</span>
              </div>
              <div class="row g-2 text-muted small">
                <div class="col-4">Temp: <strong class="text-dark">-12.2°C</strong></div>
                <div class="col-4">Wind: <strong class="text-dark">14 kts</strong></div>
                <div class="col-4">Power: <strong class="text-success">Nominal</strong></div>
              </div>
            </div>
            <div class="p-3 rounded border bg-light">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="fw-bold text-dark"><i class="fa-solid fa-satellite-dish me-2 text-warning"></i>Dakshin Ice Camp (Inland Plateau)</div>
                <span class="badge bg-warning text-dark">BLIZZARD STANDBY</span>
              </div>
              <div class="row g-2 text-muted small">
                <div class="col-4">Temp: <strong class="text-dark">-24.0°C</strong></div>
                <div class="col-4">Wind: <strong class="text-dark">42 kts</strong></div>
                <div class="col-4">Power: <strong class="text-warning">Battery Backup</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white py-3 border-bottom">
            <h6 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-bolt text-warning me-2"></i>Institutional Quick Dispatch</h6>
          </div>
          <div class="card-body p-3 d-grid gap-2">
            <button class="btn btn-outline-primary text-start p-2" onclick="window.IceTrack.switchView('expeditions')">
              <i class="fa-solid fa-mountain-sun me-2 text-primary"></i><strong>Expeditions Management</strong>
              <div class="small text-muted ps-4">Review schedules, approve field plans, manage research missions</div>
            </button>
            <button class="btn btn-outline-success text-start p-2" onclick="window.IceTrack.switchView('cargo')">
              <i class="fa-solid fa-ship me-2 text-success"></i><strong>Cargo & Maritime Fleet</strong>
              <div class="small text-muted ps-4">Oversee RV Sagar Nidhi, SA Agulhas II, Mormugao port shipments</div>
            </button>
            <button class="btn btn-outline-info text-start p-2" onclick="window.IceTrack.switchView('inventory')">
              <i class="fa-solid fa-boxes-stacked me-2 text-info"></i><strong>Strategic Inventory Stock</strong>
              <div class="small text-muted ps-4">Monitor polar diesel, cryogenic fuel, survival gear, generator spares</div>
            </button>
            <button class="btn btn-outline-danger text-start p-2" onclick="window.IceTrack.switchView('emergency')">
              <i class="fa-solid fa-truck-medical me-2 text-danger"></i><strong>Emergency SOS Command</strong>
              <div class="small text-muted ps-4">Review weather distress alerts and authorize medical evacuations</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderUserRows(usersList) {
  if (!usersList || usersList.length === 0) {
    return `<tr><td colspan="6" class="text-center py-3 text-muted">Loading user accounts...</td></tr>`;
  }

  return usersList.map(u => {
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
          <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="window.IceTrackNotify && window.IceTrackNotify('User ID: ${u.id}\\nRole: ${u.role}\\nEmail: ${u.email}\\nCreated: ${u.createdAt || 'Active'}', 'info', 'Personnel Dossier')">
            <i class="fa-solid fa-circle-info"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 2. EXPEDITION MANAGER DASHBOARD
 * Assigned expedition overview, schedule, assigned personnel, cargo readiness, inventory, weather & alerts
 */
export async function renderManagerDashboard(officer, container, appInstance) {
  const assignedExp = officer?.assignedExpedition || "44th Indian Scientific Expedition to Antarctica";
  const station = officer?.station || "Bharati";

  container.innerHTML = `
    <!-- Manager Assigned Mission Header -->
    <div class="card border-0 shadow-sm mb-4 bg-primary text-white rounded-3 overflow-hidden">
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-white text-primary fw-bold"><i class="fa-solid fa-compass me-1"></i> ASSIGNED EXPEDITION LEAD</span>
              <span class="badge bg-dark bg-opacity-50">STATION: ${station.toUpperCase()}</span>
              <span class="badge bg-success"><i class="fa-solid fa-check me-1"></i> MISSION ACTIVE</span>
            </div>
            <h2 class="h4 fw-bold text-white mb-1">
              ${assignedExp}
            </h2>
            <p class="text-white text-opacity-75 small mb-0">
              Operations Command • Polar Logistics & Research Taskforce • Vessel: MV Vasiliy Golovnin
            </p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-light text-primary fw-bold" onclick="window.IceTrack.switchView('expeditions')">
              <i class="fa-solid fa-route me-1"></i> Expeditions Console
            </button>
            <button class="btn btn-sm btn-outline-light" onclick="window.IceTrack.switchView('map')">
              <i class="fa-solid fa-map-location-dot me-1"></i> Track on Live Map
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Manager Operational Metrics -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Assigned Personnel</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">18 Personnel</h3>
              <small class="text-success fw-bold"><i class="fa-solid fa-circle-check me-1"></i>All Stationed</small>
            </div>
            <div class="p-2 rounded bg-primary-subtle text-primary"><i class="fa-solid fa-users fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Assigned Cargo</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">2 Shipments</h3>
              <small class="text-primary fw-bold">6,200 kg En Route</small>
            </div>
            <div class="p-2 rounded bg-info-subtle text-info"><i class="fa-solid fa-ship fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Sector Weather</span>
              <h3 class="fw-bold text-success mt-1 mb-0">-12.2°C</h3>
              <small class="text-muted">48h Clear Weather Window</small>
            </div>
            <div class="p-2 rounded bg-success-subtle text-success"><i class="fa-solid fa-cloud-sun fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Field Ice Camps</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">3 Camps Active</h3>
              <small class="text-muted">Telemetry Online</small>
            </div>
            <div class="p-2 rounded bg-warning-subtle text-warning"><i class="fa-solid fa-tents fa-lg"></i></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Manager Detailed Mission Overview & Sector Team -->
    <div class="row g-3 mb-4">
      <div class="col-lg-8">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-compass text-primary me-2"></i>Mission Operations & Field Plan</h6>
            <span class="badge bg-primary">IN PROGRESS</span>
          </div>
          <div class="card-body p-4">
            <div class="row g-3 mb-4">
              <div class="col-md-6">
                <div class="p-3 rounded border bg-light">
                  <span class="text-muted small fw-semibold">Primary Mission Sector</span>
                  <div class="fw-bold text-dark mt-1">Larsemann Hills & Prydz Bay Margin</div>
                  <small class="text-muted">Glaciological, atmospheric, and oceanographic research survey</small>
                </div>
              </div>
              <div class="col-md-6">
                <div class="p-3 rounded border bg-light">
                  <span class="text-muted small fw-semibold">Chartered Icebreaker</span>
                  <div class="fw-bold text-dark mt-1">MV Vasiliy Golovnin (Russian Flag)</div>
                  <small class="text-muted">Transit speed 12.8 kts • ETA Prydz Bay: 14 Days</small>
                </div>
              </div>
            </div>

            <h6 class="fw-bold text-dark mb-2">Active Operational Alerts & Watchpoints</h6>
            <div class="p-3 rounded border border-warning-subtle bg-warning bg-opacity-10 d-flex align-items-start gap-3 mb-3">
              <i class="fa-solid fa-triangle-exclamation text-warning fa-lg mt-1"></i>
              <div>
                <div class="fw-bold text-dark">Cryogenic Aviation Fuel & Jet-A1 Replenishment Priority</div>
                <small class="text-muted">Current station reserve at Bharati is 11,000L against a safety threshold of 14,000L. Consignment CGO-4402 (6,200 kg) is currently sailing aboard MV Vasiliy Golovnin at 65% progress.</small>
              </div>
            </div>

            <div class="d-flex justify-content-end gap-2">
              <button class="btn btn-sm btn-outline-primary" onclick="window.IceTrack.switchView('cargo')">
                <i class="fa-solid fa-box-open me-1"></i> Review Assigned Consignments
              </button>
              <button class="btn btn-sm btn-primary" onclick="window.IceTrack.switchView('personnel')">
                <i class="fa-solid fa-users me-1"></i> Review Station Team
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-4">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white py-3 border-bottom">
            <h6 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-users-gear text-primary me-2"></i>Assigned Sector Team</h6>
          </div>
          <div class="card-body p-3">
            <div class="d-flex flex-column gap-2">
              <div class="p-2 rounded border bg-light d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-bold small text-dark">${officer.name}</div>
                  <div class="text-muted" style="font-size: 11px;">${officer.designation || 'Expedition Manager'}</div>
                </div>
                <span class="badge bg-primary">LEAD</span>
              </div>
              <div class="p-2 rounded border bg-light d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-bold small text-dark">Er. Amitav Ghosh</div>
                  <div class="text-muted" style="font-size: 11px;">Electrical & Heating Systems Engineer</div>
                </div>
                <span class="badge bg-secondary">Active</span>
              </div>
              <div class="p-2 rounded border bg-light d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-bold small text-dark">Wg Cdr. K. Raman</div>
                  <div class="text-muted" style="font-size: 11px;">Polar Aviation & Helicopter Officer</div>
                </div>
                <span class="badge bg-secondary">Active</span>
              </div>
              <div class="p-2 rounded border bg-light d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-bold small text-dark">Dr. Sunita Rao</div>
                  <div class="text-muted" style="font-size: 11px;">Medical Officer & Hypothermia Specialist</div>
                </div>
                <span class="badge bg-secondary">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 3. FIELD / RESEARCH OFFICER DASHBOARD
 * Assigned mission, field coordinates, location updater, mission status updater,
 * observations submission form, equipment status, and SOS reporting
 */
export async function renderFieldOfficerDashboard(officer, container, appInstance) {
  const station = officer?.station || "Dakshin Ice Camp";
  const mission = officer?.assignedExpedition || "Dakshin Gangotri Ice Core Drilling Survey";

  let observations = [];
  try {
    const res = await FieldAPI.getObservations();
    if (res && res.data) observations = res.data;
  } catch (e) {
    console.warn('Failed to load observations:', e);
  }

  container.innerHTML = `
    <!-- Field Officer Mission Header -->
    <div class="card border-0 shadow-sm mb-4 bg-info bg-gradient text-dark rounded-3 overflow-hidden">
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-dark text-white"><i class="fa-solid fa-microscope me-1"></i> FIELD RESEARCH SCIENTIST</span>
              <span class="badge bg-white text-dark fw-bold border">${station.toUpperCase()}</span>
              <span class="badge bg-danger"><i class="fa-solid fa-satellite-dish me-1"></i> LIVE SATCOM LINK</span>
            </div>
            <h2 class="h4 fw-bold text-dark mb-1">
              ${mission}
            </h2>
            <p class="text-dark text-opacity-75 small mb-0">
              Echo Cryo-Drilling Team • Lead Scientist: ${officer.name} • Reporting to: Expedition Lead (Bharati Base)
            </p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-dark" data-bs-toggle="modal" data-bs-target="#modalUpdateLocation">
              <i class="fa-solid fa-location-crosshairs me-1 text-info"></i> Update GPS Coordinates
            </button>
            <button class="btn btn-sm btn-warning fw-bold text-dark" data-bs-toggle="modal" data-bs-target="#modalReportProblem">
              <i class="fa-solid fa-triangle-exclamation me-1"></i> Report Equipment Problem
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Field Coordinates & Live Telemetry Strip -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Field Coordinates</span>
              <h4 class="fw-bold text-dark font-monospace mt-1 mb-0">70°45'S 11°44'E</h4>
              <small class="text-success fw-bold"><i class="fa-solid fa-circle-check me-1"></i>GPS Locked</small>
            </div>
            <div class="p-2 rounded bg-info-subtle text-info"><i class="fa-solid fa-location-dot fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Surface Temp</span>
              <h3 class="fw-bold text-primary mt-1 mb-0">-24.0°C</h3>
              <small class="text-muted">Safe Field Drilling Window</small>
            </div>
            <div class="p-2 rounded bg-primary-subtle text-primary"><i class="fa-solid fa-temperature-snow fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Ice Core Rig Status</span>
              <h3 class="fw-bold text-success mt-1 mb-0">Nominal</h3>
              <small class="text-muted">Rig 4 Operating at 120m</small>
            </div>
            <div class="p-2 rounded bg-success-subtle text-success"><i class="fa-solid fa-gears fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">SOS Transceiver</span>
              <h3 class="fw-bold text-danger mt-1 mb-0">Active</h3>
              <small class="text-muted">Cospas-Sarsat Synced</small>
            </div>
            <div class="p-2 rounded bg-danger-subtle text-danger"><i class="fa-solid fa-truck-medical fa-lg"></i></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Observations Submission & Transmission Table -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
        <h6 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-book-journal-whills text-primary me-2"></i>Transmitted Field Observations & Data Logs</h6>
        <span class="badge bg-secondary">${observations.length} Logs Transmitted</span>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 small">
            <thead class="table-light text-muted">
              <tr>
                <th class="ps-3">Timestamp</th>
                <th>Station / Sector</th>
                <th>Coordinates</th>
                <th>Surface Temp</th>
                <th>Findings & Notes</th>
                <th class="pe-3">Status</th>
              </tr>
            </thead>
            <tbody id="fieldObservationsTableBody">
              ${renderObservationRows(observations)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderObservationRows(obsList) {
  if (!obsList || obsList.length === 0) {
    return `<tr><td colspan="6" class="text-center py-3 text-muted">No observations submitted yet.</td></tr>`;
  }
  return obsList.map(o => `
    <tr>
      <td class="ps-3 text-muted font-monospace" style="font-size: 11px;">${new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      <td class="fw-bold text-dark">${o.station}</td>
      <td class="text-muted font-monospace">${o.coordinates || '70°45\'S 11°44\'E'}</td>
      <td class="text-primary fw-semibold">${o.surfaceTemp}</td>
      <td><span class="text-muted">${o.notes}</span></td>
      <td class="pe-3"><span class="badge bg-success-subtle text-success">Archived</span></td>
    </tr>
  `).join('');
}

/**
 * 4. LOGISTICS OFFICER DASHBOARD
 * Total consignments, gross payload, in-transit cargo, delivered cargo,
 * awaiting dispatch, inventory readiness, critical stock shortages, supply lines
 */
export async function renderLogisticsDashboard(officer, container, appInstance) {
  container.innerHTML = `
    <!-- Logistics Command Header -->
    <div class="card border-0 shadow-sm mb-4 bg-success text-white rounded-3 overflow-hidden">
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-white text-success fw-bold"><i class="fa-solid fa-truck-ramp-box me-1"></i> POLAR SUPPLY CHAIN LEAD</span>
              <span class="badge bg-dark bg-opacity-50">MARITIME & AIR CORRIDOR</span>
              <span class="badge bg-warning text-dark"><i class="fa-solid fa-ship me-1"></i> FLEET EN ROUTE</span>
            </div>
            <h2 class="h4 fw-bold text-white mb-1">
              Polar Maritime, Cargo & Strategic Inventory Command
            </h2>
            <p class="text-white text-opacity-75 small mb-0">
              Overseeing Mormugao Port (Goa), New Mangalore Port, Cape Town Transit Hub, Maitri & Bharati Bases
            </p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-light text-success fw-bold" onclick="window.IceTrack.switchView('cargo')">
              <i class="fa-solid fa-box-open me-1"></i> Register Consignment
            </button>
            <button class="btn btn-sm btn-outline-light" onclick="window.IceTrack.switchView('inventory')">
              <i class="fa-solid fa-boxes-stacked me-1"></i> Manage Inventory
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Logistics Key Metrics -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Total Consignments</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">4 Shipments</h3>
              <small class="text-success fw-bold">Active Manifest</small>
            </div>
            <div class="p-2 rounded bg-success-subtle text-success"><i class="fa-solid fa-boxes-packing fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Gross Payload</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">11,250 kg</h3>
              <small class="text-primary fw-bold">Maritime + Air Cargo</small>
            </div>
            <div class="p-2 rounded bg-primary-subtle text-primary"><i class="fa-solid fa-weight-hanging fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">En Route</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">7,400 kg</h3>
              <small class="text-warning fw-bold">2 Vessels Sailing</small>
            </div>
            <div class="p-2 rounded bg-warning-subtle text-warning"><i class="fa-solid fa-ship fa-lg"></i></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="text-muted small fw-semibold text-uppercase">Awaiting Dispatch</span>
              <h3 class="fw-bold text-dark mt-1 mb-0">3,850 kg</h3>
              <small class="text-muted">Mormugao Port Berth 4</small>
            </div>
            <div class="p-2 rounded bg-info-subtle text-info"><i class="fa-solid fa-warehouse fa-lg"></i></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Priority Supply Lines & Inventory Watch -->
    <div class="row g-3 mb-4">
      <div class="col-lg-7">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-ship text-success me-2"></i>Priority Consignments Status</h6>
            <button class="btn btn-xs btn-outline-primary" onclick="window.IceTrack.switchView('cargo')">View Manifests</button>
          </div>
          <div class="card-body p-3">
            <div class="mb-3 p-3 rounded border bg-light">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-dark">CGO-4401: Scientific Core Drill Mast</span>
                <span class="badge bg-success">Delivered</span>
              </div>
              <small class="text-muted d-block mb-2">Mormugao Port &rarr; Maitri Base • 4,500 kg</small>
              <div class="progress" style="height: 6px;">
                <div class="progress-bar bg-success" style="width: 100%;"></div>
              </div>
            </div>

            <div class="mb-3 p-3 rounded border bg-light">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-dark">CGO-4402: Cryogenic Aviation Fuel (Jet-A1)</span>
                <span class="badge bg-warning text-dark">In Transit</span>
              </div>
              <small class="text-muted d-block mb-2">Cape Town &rarr; Bharati Base • 6,200 kg • MV Vasiliy Golovnin</small>
              <div class="progress" style="height: 6px;">
                <div class="progress-bar bg-cyan" style="width: 65%;"></div>
              </div>
            </div>

            <div class="mb-3 p-3 rounded border bg-light">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-dark">CGO-4403: Emergency Blizzard Shelter Pods</span>
                <span class="badge bg-primary">Loaded</span>
              </div>
              <small class="text-muted d-block mb-2">New Mangalore Port &rarr; Maitri Base • 1,200 kg</small>
              <div class="progress" style="height: 6px;">
                <div class="progress-bar bg-primary" style="width: 25%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-5">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-triangle-exclamation text-danger me-2"></i>Critical Stock Shortages</h6>
            <button class="btn btn-xs btn-outline-danger" onclick="window.IceTrack.switchView('inventory')">Manage Stock</button>
          </div>
          <div class="card-body p-3">
            <div class="p-3 rounded border border-danger-subtle bg-danger bg-opacity-10 mb-3">
              <div class="d-flex justify-content-between align-items-center">
                <div class="fw-bold text-danger">Aviation Turbine Fuel (Jet-A1)</div>
                <span class="badge bg-danger">CRITICAL</span>
              </div>
              <small class="text-muted d-block mt-1">Current Reserve: <strong>11,000 L</strong> (Threshold: 14,000 L)</small>
              <small class="text-dark d-block mt-1">Status: Urgent replenishment sailing on CGO-4402.</small>
            </div>

            <div class="p-3 rounded border bg-light">
              <div class="d-flex justify-content-between align-items-center">
                <div class="fw-bold text-dark">Caterpillar Generator Overhaul Spares</div>
                <span class="badge bg-warning text-dark">MODERATE</span>
              </div>
              <small class="text-muted d-block mt-1">Current Reserve: <strong>3 units</strong> (Threshold: 4 units)</small>
              <small class="text-muted d-block mt-1">Scheduled for delivery next sailing corridor.</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
