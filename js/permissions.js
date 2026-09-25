/**
 * ICETRACK / PolarOps — Centralized Role-Based Access Control (RBAC) System
 * 
 * Supports exactly four roles:
 * 1. Administrator (admin)
 * 2. Expedition Manager (manager)
 * 3. Field/Research Officer (field_officer)
 * 4. Logistics Officer (logistics_officer)
 */

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  FIELD_OFFICER: 'field_officer',
  LOGISTICS_OFFICER: 'logistics_officer'
};

export const ROLE_LABELS = {
  admin: 'Administrator',
  manager: 'Expedition Manager',
  field_officer: 'Field/Research Officer',
  logistics_officer: 'Logistics Officer'
};

export const ROLE_BADGE_CLASSES = {
  admin: 'bg-danger text-white',
  manager: 'bg-primary text-white',
  field_officer: 'bg-info text-dark',
  logistics_officer: 'bg-success text-white'
};

export const PERMISSIONS = {
  // User and Role Management (Admin only)
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_ASSIGN_ROLE: 'users.assign_role',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_LOGS_VIEW: 'audit_logs.view',

  // Expeditions
  EXPEDITIONS_VIEW: 'expeditions.view',
  EXPEDITIONS_CREATE: 'expeditions.create',
  EXPEDITIONS_UPDATE: 'expeditions.update',
  EXPEDITIONS_DELETE: 'expeditions.delete',
  EXPEDITIONS_UPDATE_FIELD_STATUS: 'expeditions.update_field_status',

  // Cargo
  CARGO_VIEW: 'cargo.view',
  CARGO_CREATE: 'cargo.create',
  CARGO_UPDATE: 'cargo.update',
  CARGO_DISPATCH: 'cargo.dispatch',
  CARGO_DELETE: 'cargo.delete',

  // Inventory
  INVENTORY_MONITOR: 'inventory.monitor',
  INVENTORY_MANAGE: 'inventory.manage',
  INVENTORY_REPORT_PROBLEM: 'inventory.report_problem',

  // Personnel
  PERSONNEL_VIEW: 'personnel.view',
  PERSONNEL_VIEW_ASSIGNED_TEAM: 'personnel.view_assigned_team',
  PERSONNEL_MANAGE: 'personnel.manage',

  // Map & Location
  MAP_VIEW_ALL: 'map.view_all',
  MAP_VIEW_ASSIGNED: 'map.view_assigned',
  LOCATION_UPDATE_OWN: 'location.update_own',
  OBSERVATIONS_CREATE: 'observations.create',

  // Emergency
  EMERGENCY_CREATE: 'emergency.create',
  EMERGENCY_MANAGE: 'emergency.manage',
  EMERGENCY_RESPOND_SUPPLY: 'emergency.respond_supply',

  // Analytics
  ANALYTICS_VIEW_ALL: 'analytics.view_all',
  ANALYTICS_VIEW_OPERATIONAL: 'analytics.view_operational',
  ANALYTICS_VIEW_LOGISTICS: 'analytics.view_logistics'
};

/**
 * Role Permission Mapping Matrix
 */
export const ROLE_PERMISSIONS = {
  admin: [
    // Full access to every module and action
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_ASSIGN_ROLE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.AUDIT_LOGS_VIEW,
    PERMISSIONS.EXPEDITIONS_VIEW,
    PERMISSIONS.EXPEDITIONS_CREATE,
    PERMISSIONS.EXPEDITIONS_UPDATE,
    PERMISSIONS.EXPEDITIONS_DELETE,
    PERMISSIONS.EXPEDITIONS_UPDATE_FIELD_STATUS,
    PERMISSIONS.CARGO_VIEW,
    PERMISSIONS.CARGO_CREATE,
    PERMISSIONS.CARGO_UPDATE,
    PERMISSIONS.CARGO_DISPATCH,
    PERMISSIONS.CARGO_DELETE,
    PERMISSIONS.INVENTORY_MONITOR,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_REPORT_PROBLEM,
    PERMISSIONS.PERSONNEL_VIEW,
    PERMISSIONS.PERSONNEL_VIEW_ASSIGNED_TEAM,
    PERMISSIONS.PERSONNEL_MANAGE,
    PERMISSIONS.MAP_VIEW_ALL,
    PERMISSIONS.MAP_VIEW_ASSIGNED,
    PERMISSIONS.LOCATION_UPDATE_OWN,
    PERMISSIONS.OBSERVATIONS_CREATE,
    PERMISSIONS.EMERGENCY_CREATE,
    PERMISSIONS.EMERGENCY_MANAGE,
    PERMISSIONS.EMERGENCY_RESPOND_SUPPLY,
    PERMISSIONS.ANALYTICS_VIEW_ALL,
    PERMISSIONS.ANALYTICS_VIEW_OPERATIONAL,
    PERMISSIONS.ANALYTICS_VIEW_LOGISTICS
  ],

  manager: [
    // Operational modules for assigned expeditions
    PERMISSIONS.EXPEDITIONS_VIEW,
    PERMISSIONS.EXPEDITIONS_CREATE,
    PERMISSIONS.EXPEDITIONS_UPDATE,
    PERMISSIONS.EXPEDITIONS_UPDATE_FIELD_STATUS,
    PERMISSIONS.CARGO_VIEW,
    PERMISSIONS.CARGO_CREATE,
    PERMISSIONS.CARGO_UPDATE,
    PERMISSIONS.CARGO_DISPATCH,
    PERMISSIONS.INVENTORY_MONITOR,
    PERMISSIONS.PERSONNEL_VIEW,
    PERMISSIONS.PERSONNEL_VIEW_ASSIGNED_TEAM,
    PERMISSIONS.MAP_VIEW_ASSIGNED,
    PERMISSIONS.OBSERVATIONS_CREATE,
    PERMISSIONS.EMERGENCY_CREATE,
    PERMISSIONS.EMERGENCY_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW_OPERATIONAL
  ],

  field_officer: [
    // Assigned field mission scope only
    PERMISSIONS.EXPEDITIONS_VIEW,
    PERMISSIONS.EXPEDITIONS_UPDATE_FIELD_STATUS,
    PERMISSIONS.CARGO_VIEW,
    PERMISSIONS.INVENTORY_MONITOR,
    PERMISSIONS.INVENTORY_REPORT_PROBLEM,
    PERMISSIONS.PERSONNEL_VIEW_ASSIGNED_TEAM,
    PERMISSIONS.MAP_VIEW_ASSIGNED,
    PERMISSIONS.LOCATION_UPDATE_OWN,
    PERMISSIONS.OBSERVATIONS_CREATE,
    PERMISSIONS.EMERGENCY_CREATE
  ],

  logistics_officer: [
    // Logistics, supply chain, cargo, inventory
    PERMISSIONS.EXPEDITIONS_VIEW,
    PERMISSIONS.CARGO_VIEW,
    PERMISSIONS.CARGO_CREATE,
    PERMISSIONS.CARGO_UPDATE,
    PERMISSIONS.CARGO_DISPATCH,
    PERMISSIONS.CARGO_DELETE,
    PERMISSIONS.INVENTORY_MONITOR,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.PERSONNEL_VIEW,
    PERMISSIONS.MAP_VIEW_ASSIGNED,
    PERMISSIONS.EMERGENCY_CREATE,
    PERMISSIONS.EMERGENCY_RESPOND_SUPPLY,
    PERMISSIONS.ANALYTICS_VIEW_LOGISTICS
  ]
};

/**
 * Permitted navigation views per role
 */
export const ROLE_VIEWS = {
  admin: ['dashboard', 'expeditions', 'cargo', 'inventory', 'personnel', 'map', 'emergency', 'analytics'],
  manager: ['dashboard', 'expeditions', 'cargo', 'inventory', 'personnel', 'map', 'emergency', 'analytics'],
  field_officer: ['dashboard', 'expeditions', 'cargo', 'inventory', 'personnel', 'map', 'emergency'],
  logistics_officer: ['dashboard', 'cargo', 'inventory', 'expeditions', 'personnel', 'map', 'emergency', 'analytics']
};

/**
 * Check if a role possesses a specific permission
 */
export function hasPermission(role, permission) {
  if (!role || !ROLE_PERMISSIONS[role]) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Check if a role is allowed to access a specific navigation view
 */
export function canAccessView(role, viewId) {
  if (!role || !ROLE_VIEWS[role]) return false;
  return ROLE_VIEWS[role].includes(viewId);
}

/**
 * Get all permitted views for a role
 */
export function getPermittedViews(role) {
  return ROLE_VIEWS[role] || ['dashboard'];
}
