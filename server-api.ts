import express from 'express';
import dotenv from 'dotenv';
import * as db from './server-db.js';

dotenv.config();

// Initialize Database connection on module load
db.initDatabase().catch(err => {
  console.warn('[ICETRACK API] Database auto-init warning:', err.message);
});

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  FIELD_OFFICER: 'field_officer',
  LOGISTICS_OFFICER: 'logistics_officer'
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'users.view', 'users.create', 'users.assign_role', 'settings.manage', 'audit_logs.view',
    'expeditions.view', 'expeditions.create', 'expeditions.update', 'expeditions.delete', 'expeditions.update_field_status',
    'cargo.view', 'cargo.create', 'cargo.update', 'cargo.dispatch', 'cargo.delete',
    'inventory.monitor', 'inventory.manage', 'inventory.report_problem',
    'personnel.view', 'personnel.view_assigned_team', 'personnel.manage',
    'map.view_all', 'map.view_assigned', 'location.update_own', 'observations.create',
    'emergency.create', 'emergency.manage', 'emergency.respond_supply',
    'analytics.view_all', 'analytics.view_operational', 'analytics.view_logistics'
  ],
  manager: [
    'expeditions.view', 'expeditions.create', 'expeditions.update', 'expeditions.update_field_status',
    'cargo.view', 'cargo.create', 'cargo.update', 'cargo.dispatch',
    'inventory.monitor',
    'personnel.view', 'personnel.view_assigned_team', 'personnel.manage',
    'map.view_assigned', 'observations.create',
    'emergency.create', 'emergency.manage',
    'analytics.view_operational'
  ],
  field_officer: [
    'expeditions.view', 'expeditions.update_field_status',
    'cargo.view',
    'inventory.monitor', 'inventory.report_problem',
    'personnel.view_assigned_team',
    'map.view_assigned', 'location.update_own', 'observations.create',
    'emergency.create'
  ],
  logistics_officer: [
    'expeditions.view',
    'cargo.view', 'cargo.create', 'cargo.update', 'cargo.dispatch', 'cargo.delete',
    'inventory.monitor', 'inventory.manage',
    'personnel.view',
    'map.view_assigned',
    'emergency.create', 'emergency.respond_supply',
    'analytics.view_logistics'
  ]
};

export type UserRecord = db.UserRecord;
export type ActiveSession = db.ActiveSession;
export type AuditLog = db.AuditLog;

export const logAudit = db.logAudit;

export const apiRouter = express.Router();
apiRouter.use(express.json());

// Token Authentication Middleware with DB verification
async function authenticateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '401 Unauthorized: Valid security token required to access ICETRACK services.'
      });
    }

    const token = authHeader.substring(7).trim();
    const session = await db.getSession(token);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: '401 Unauthorized: Session invalid or expired. Please log in again.'
      });
    }

    (req as any).user = session.user;
    (req as any).token = token;
    next();
  } catch (err: any) {
    console.error('[ICETRACK Auth Error]:', err);
    res.status(500).json({ success: false, error: 'Authentication service encountered an error' });
  }
}

function requirePermission(permission: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user as db.UserRecord;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const permitted = ROLE_PERMISSIONS[user.role] || [];
    if (!permitted.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `403 Forbidden: Access Denied. Your authenticated role (${user.role}) does not have permission '${permission}'.`,
        requiredPermission: permission,
        userRole: user.role
      });
    }

    next();
  };
}

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
apiRouter.get('/health', async (req, res) => {
  const dbInfo = db.getDbInfo();
  res.json({
    status: 'ok',
    system: 'ICETRACK Polar Logistics & Expedition Command Backend',
    version: '3.1.0 (PostgreSQL + RBAC Enforced)',
    database: dbInfo,
    rolesSupported: Object.keys(ROLE_PERMISSIONS)
  });
});

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanEmail || !cleanPass) {
      return res.status(400).json({
        success: false,
        error: 'Official email ID and security password are required.'
      });
    }

    const user = await db.findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Access Denied: Unauthorized Personnel. Email ID not registered in polar defense directory.'
      });
    }

    if (user.password !== cleanPass) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password. Access Denied: Unauthorized Personnel.'
      });
    }

    const token = `icetrack_sec_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await db.createSession(token, user, expiresAt);

    await db.logAudit(
      'USER_LOGIN_SUCCESS',
      { id: user.id, email: user.email, role: user.role },
      `Successful login as ${user.designation} (${user.role}) from station ${user.station}`
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        station: user.station,
        jurisdiction: user.jurisdiction,
        assignedExpedition: user.assignedExpedition,
        assignedTeam: user.assignedTeam,
        clearance: user.clearance
      }
    });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ success: false, error: 'Login service encountered an error' });
  }
});

apiRouter.get('/auth/me', authenticateUser, (req, res) => {
  const user = (req as any).user as db.UserRecord;
  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation,
      station: user.station,
      jurisdiction: user.jurisdiction,
      assignedExpedition: user.assignedExpedition,
      assignedTeam: user.assignedTeam,
      clearance: user.clearance,
      permissions: ROLE_PERMISSIONS[user.role] || []
    }
  });
});

apiRouter.post('/auth/logout', authenticateUser, async (req, res) => {
  try {
    const token = (req as any).token as string;
    const user = (req as any).user as db.UserRecord;

    await db.deleteSession(token);
    await db.logAudit('USER_LOGOUT', { id: user.id, email: user.email, role: user.role }, 'User signed out');

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    console.error('[Auth Logout Error]:', err);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// -------------------------------------------------------------
// USER MANAGEMENT (Admin Only)
// -------------------------------------------------------------
apiRouter.get('/users', authenticateUser, requirePermission('users.view'), async (req, res) => {
  try {
    const userList = await db.getAllUsers();
    const safeUsers = userList.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      designation: u.designation,
      station: u.station,
      jurisdiction: u.jurisdiction,
      assignedExpedition: u.assignedExpedition,
      assignedTeam: u.assignedTeam,
      clearance: u.clearance,
      createdAt: u.createdAt
    }));
    res.json({ success: true, count: safeUsers.length, data: safeUsers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/users', authenticateUser, requirePermission('users.create'), async (req, res) => {
  try {
    const actor = (req as any).user as db.UserRecord;
    const { name, email, password, role, designation, station, jurisdiction, assignedExpedition, assignedTeam, clearance } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Name, email, password, and role are required.' });
    }

    const validRoles = ['admin', 'manager', 'field_officer', 'logistics_officer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
    }

    const newUser: db.UserRecord = {
      id: `USR-${Date.now().toString(36).toUpperCase()}`,
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      role,
      designation: designation ? designation.trim() : (role === 'manager' ? 'Expedition Manager' : role === 'field_officer' ? 'Field Officer' : role === 'logistics_officer' ? 'Logistics Officer' : 'System Administrator'),
      station: station ? station.trim() : 'Maitri',
      jurisdiction: jurisdiction ? jurisdiction.trim() : 'Assigned Sector',
      assignedExpedition: assignedExpedition ? assignedExpedition.trim() : '44th Indian Scientific Expedition to Antarctica',
      assignedTeam: assignedTeam ? assignedTeam.trim() : 'Operational Team',
      clearance: clearance ? clearance.trim() : 'Level 3',
      createdAt: new Date().toISOString()
    };

    await db.createUser(newUser);
    await db.logAudit('USER_CREATED', { id: actor.id, email: actor.email, role: actor.role }, `Created user ${newUser.name} (${newUser.email}) with role ${newUser.role}`, newUser.id);

    res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        designation: newUser.designation,
        station: newUser.station,
        clearance: newUser.clearance
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/users/:id/role', authenticateUser, requirePermission('users.assign_role'), async (req, res) => {
  try {
    const actor = (req as any).user as db.UserRecord;
    const targetId = req.params.id;
    const { role } = req.body;

    const validRoles = ['admin', 'manager', 'field_officer', 'logistics_officer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const targetUser = await db.findUserById(targetId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const oldRole = targetUser.role;
    const updated = await db.updateUserRole(targetId, role);

    await db.logAudit(
      'USER_ROLE_CHANGED',
      { id: actor.id, email: actor.email, role: actor.role },
      `Changed role of ${targetUser.name} (${targetUser.email}) from ${oldRole} to ${role}`,
      targetUser.id
    );

    res.json({
      success: true,
      data: {
        id: updated?.id || targetId,
        name: targetUser.name,
        email: targetUser.email,
        oldRole,
        newRole: role
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// AUDIT LOGS
// -------------------------------------------------------------
apiRouter.get('/audit-logs', authenticateUser, requirePermission('audit_logs.view'), async (req, res) => {
  try {
    const logs = await db.getAuditLogs();
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// EXPEDITIONS
// -------------------------------------------------------------
apiRouter.get('/expeditions', authenticateUser, requirePermission('expeditions.view'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    let list = await db.getExpeditions();

    if (user.role === 'field_officer') {
      list = list.filter(e => 
        e.name.toLowerCase().includes((user.assignedExpedition || '').toLowerCase()) || 
        e.station.toLowerCase().includes((user.station || '').toLowerCase())
      );
    } else if (user.role === 'manager') {
      list = list.map(e => ({
        ...e,
        isAssigned: e.name.toLowerCase().includes((user.assignedExpedition || '').toLowerCase()) || 
                    e.station.toLowerCase().includes((user.station || '').toLowerCase())
      }));
    }
    res.json({ success: true, count: list.length, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/expeditions', authenticateUser, requirePermission('expeditions.create'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const newExp = await db.createExpedition({
      id: Date.now(),
      name: req.body.name,
      station: req.body.station,
      start: req.body.start,
      end: req.body.end,
      ship: req.body.ship || 'RV Sagar Nidhi',
      priority: req.body.priority || 'Normal',
      managerId: user.id,
      fieldStatus: 'Plan Approved',
      observations: req.body.observations || 'Expedition initialized by ' + user.name
    });

    await db.logAudit('EXPEDITION_CREATED', { id: user.id, email: user.email, role: user.role }, `Created mission: ${newExp.name}`, String(newExp.id));
    res.status(201).json({ success: true, data: newExp });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/expeditions/:id', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const id = req.params.id;

    if (user.role === 'field_officer') {
      const updates: any = {};
      if (req.body.fieldStatus) updates.fieldStatus = req.body.fieldStatus;
      if (req.body.observations) updates.observations = req.body.observations;

      const updated = await db.updateExpedition(id, updates);
      if (!updated) return res.status(404).json({ success: false, error: 'Expedition not found' });

      await db.logAudit('EXPEDITION_FIELD_STATUS_UPDATED', { id: user.id, email: user.email, role: user.role }, `Updated field status to: ${updated.fieldStatus}`, String(id));
      return res.json({ success: true, data: updated });
    }

    if (user.role === 'manager' || user.role === 'admin') {
      const updated = await db.updateExpedition(id, req.body);
      if (!updated) return res.status(404).json({ success: false, error: 'Expedition not found' });

      await db.logAudit('EXPEDITION_UPDATED', { id: user.id, email: user.email, role: user.role }, `Updated expedition ${updated.name}`, String(id));
      return res.json({ success: true, data: updated });
    }

    return res.status(403).json({ success: false, error: '403 Forbidden: Insufficient permissions to modify expeditions.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/expeditions/:id', authenticateUser, requirePermission('expeditions.delete'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const id = req.params.id;
    await db.deleteExpedition(id);
    await db.logAudit('EXPEDITION_DELETED', { id: user.id, email: user.email, role: user.role }, `Deleted expedition: ${id}`, String(id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// CARGO
// -------------------------------------------------------------
apiRouter.get('/cargo', authenticateUser, requirePermission('cargo.view'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    let list = await db.getCargo();

    if (user.role === 'field_officer') {
      list = list.filter(c => 
        (c.destination && c.destination.toLowerCase().includes((user.station || '').toLowerCase())) || 
        (c.expedition && c.expedition.toLowerCase().includes((user.assignedExpedition || '').toLowerCase()))
      );
    } else if (user.role === 'manager') {
      list = list.filter(c => 
        (c.destination && c.destination.toLowerCase().includes((user.station || '').toLowerCase())) || 
        (c.expedition && c.expedition.toLowerCase().includes((user.assignedExpedition || '').toLowerCase())) ||
        (user.station && user.station.includes('All'))
      );
    }
    res.json({ success: true, count: list.length, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/cargo', authenticateUser, requirePermission('cargo.create'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const newCargo = await db.createCargo({
      id: req.body.id || `CGO-${Math.floor(1000 + Math.random() * 9000)}`,
      ...req.body,
      createdBy: user.email
    });

    await db.logAudit('CARGO_REGISTERED', { id: user.id, email: user.email, role: user.role }, `Registered consignment ${newCargo.id}: ${newCargo.item}`, newCargo.id);
    res.status(201).json({ success: true, data: newCargo });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/cargo/:id', authenticateUser, requirePermission('cargo.update'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const id = req.params.id;
    const updated = await db.updateCargo(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Cargo not found' });

    await db.logAudit('CARGO_UPDATED', { id: user.id, email: user.email, role: user.role }, `Updated cargo ${id} status: ${updated.status}`, id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/cargo/:id', authenticateUser, requirePermission('cargo.delete'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const id = req.params.id;
    await db.deleteCargo(id);
    await db.logAudit('CARGO_DELETED', { id: user.id, email: user.email, role: user.role }, `Deleted consignment ${id}`, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// INVENTORY
// -------------------------------------------------------------
apiRouter.get('/inventory', authenticateUser, requirePermission('inventory.monitor'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    let list = await db.getInventory();

    if (user.role === 'field_officer') {
      list = list.filter(i => 
        (i.location && i.location.toLowerCase() === (user.station || '').toLowerCase()) ||
        (i.responsible && i.responsible.toLowerCase().includes((user.name || '').toLowerCase()))
      );
    }
    res.json({ success: true, count: list.length, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/inventory', authenticateUser, requirePermission('inventory.manage'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const newItem = await db.createInventory({ id: Date.now(), ...req.body });

    await db.logAudit('INVENTORY_ITEM_ADDED', { id: user.id, email: user.email, role: user.role }, `Added inventory stock ${newItem.item} at ${newItem.location}`, String(newItem.id));
    res.status(201).json({ success: true, data: newItem });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/inventory/:id', authenticateUser, requirePermission('inventory.manage'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const id = req.params.id;
    const updated = await db.updateInventory(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Item not found' });

    await db.logAudit('INVENTORY_UPDATED', { id: user.id, email: user.email, role: user.role }, `Updated stock ${updated.item}: current ${updated.current}`, String(id));
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/inventory/:id', authenticateUser, requirePermission('inventory.manage'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const id = req.params.id;
    await db.deleteInventory(id);
    await db.logAudit('INVENTORY_DELETED', { id: user.id, email: user.email, role: user.role }, `Deleted inventory item ${id}`, String(id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// PERSONNEL
// -------------------------------------------------------------
apiRouter.get('/personnel', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    let list = await db.getPersonnel();

    if (user.role === 'field_officer') {
      list = list.filter(p => 
        (p.email && p.email.toLowerCase() === (user.email || '').toLowerCase()) ||
        (p.station && p.station.toLowerCase() === (user.station || '').toLowerCase()) ||
        (p.team && user.assignedTeam && p.team.toLowerCase() === user.assignedTeam.toLowerCase())
      );
    } else if (user.role === 'manager') {
      list = list.filter(p => 
        (p.station && p.station.toLowerCase() === (user.station || '').toLowerCase()) ||
        (p.expedition && p.expedition.toLowerCase().includes((user.assignedExpedition || '').toLowerCase())) ||
        (user.station && user.station.includes('All'))
      );
    }
    res.json({ success: true, count: list.length, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/personnel', authenticateUser, requirePermission('personnel.manage'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const newPerson = await db.createPersonnel({ id: Date.now(), ...req.body });

    await db.logAudit('PERSONNEL_ASSIGNED', { id: user.id, email: user.email, role: user.role }, `Assigned ${newPerson.name} to ${newPerson.station}`, String(newPerson.id));
    res.status(201).json({ success: true, data: newPerson });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/personnel/:id', authenticateUser, requirePermission('personnel.manage'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const id = req.params.id;
    await db.deletePersonnel(id);
    await db.logAudit('PERSONNEL_REMOVED', { id: user.id, email: user.email, role: user.role }, `Removed personnel ${id}`, String(id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// EMERGENCY
// -------------------------------------------------------------
apiRouter.get('/emergency', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    let list = await db.getEmergencies();

    if (user.role === 'field_officer') {
      list = list.filter(e => 
        (e.reportedEmail && e.reportedEmail.toLowerCase() === (user.email || '').toLowerCase()) || 
        (e.station && e.station.toLowerCase() === (user.station || '').toLowerCase())
      );
    } else if (user.role === 'manager') {
      list = list.filter(e => 
        (e.station && e.station.toLowerCase() === (user.station || '').toLowerCase()) || 
        (e.expedition && e.expedition.toLowerCase().includes((user.assignedExpedition || '').toLowerCase()))
      );
    } else if (user.role === 'logistics_officer') {
      list = list.filter(e => 
        e.type === 'Fuel' || e.type === 'Equipment' || 
        (e.station && (e.station.toLowerCase().includes('bharati') || e.station.toLowerCase().includes('maitri')))
      );
    }
    res.json({ success: true, count: list.length, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/emergency', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const newEmg = await db.createEmergency({
      id: `EMG-${Math.floor(100 + Math.random() * 900)}`,
      team: req.body.team || user.assignedTeam || 'Field Operations',
      station: req.body.station || user.station,
      type: req.body.type || 'Operational',
      severity: req.body.severity || 'High',
      message: req.body.message,
      status: 'Active',
      reportedBy: user.name,
      reportedEmail: user.email,
      expedition: user.assignedExpedition,
      timestamp: new Date().toISOString()
    });

    await db.logAudit('EMERGENCY_SOS_TRANSMITTED', { id: user.id, email: user.email, role: user.role }, `SOS: [${newEmg.type} - ${newEmg.severity}] ${newEmg.message}`, newEmg.id);
    res.status(201).json({ success: true, data: newEmg });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/emergency/:id/resolve', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const id = req.params.id;

    if (user.role === 'field_officer') {
      return res.status(403).json({ success: false, error: '403 Forbidden: Field officers cannot resolve emergencies.' });
    }

    const resolved = await db.resolveEmergency(id, user.name);
    if (!resolved) return res.status(404).json({ success: false, error: 'Emergency record not found' });

    await db.logAudit('EMERGENCY_RESOLVED', { id: user.id, email: user.email, role: user.role }, `Emergency ${id} resolved by ${user.name}`, id);
    res.json({ success: true, data: resolved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// FIELD OBSERVATIONS & LOCATION
// -------------------------------------------------------------
apiRouter.get('/field/observations', authenticateUser, async (req, res) => {
  try {
    const reports = await db.getFieldReports();
    res.json({ success: true, count: reports.length, data: reports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/field/observations', authenticateUser, requirePermission('observations.create'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const newReport = await db.createFieldReport({
      id: `FR-${Date.now()}`,
      officerEmail: user.email,
      officerName: user.name,
      station: req.body.station || user.station,
      expedition: user.assignedExpedition,
      coordinates: req.body.coordinates || "70°45'S, 11°44'E",
      elevation: req.body.elevation || '2,200m ASL',
      surfaceTemp: req.body.surfaceTemp || '-35°C',
      windSpeed: req.body.windSpeed || '30 kts',
      notes: req.body.notes || 'Field observation logged',
      equipmentStatus: req.body.equipmentStatus || 'Nominal',
      timestamp: new Date().toISOString()
    });

    await db.logAudit('FIELD_OBSERVATION_SUBMITTED', { id: user.id, email: user.email, role: user.role }, `Observation by ${user.name} at ${newReport.station}`, newReport.id);
    res.status(201).json({ success: true, data: newReport });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/field/location', authenticateUser, requirePermission('location.update_own'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const { latitude, longitude, sector, statusNotes } = req.body;

    await db.logAudit(
      'FIELD_LOCATION_UPDATED',
      { id: user.id, email: user.email, role: user.role },
      `Updated location coordinates: Lat ${latitude}, Lon ${longitude} (${sector || 'Sector Active'}). Notes: ${statusNotes || 'Position verified'}`
    );

    res.json({
      success: true,
      message: 'Field coordinates successfully updated in ICETRACK Satcom Network',
      data: {
        officer: user.name,
        station: user.station,
        coordinates: `${latitude}, ${longitude}`,
        sector: sector || 'Polar Field Sector',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// DATABASE EXPORT / IMPORT
// -------------------------------------------------------------
apiRouter.get('/database/export', authenticateUser, requirePermission('settings.manage'), async (req, res) => {
  try {
    const snapshot = await db.exportAll();
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/database/import', authenticateUser, requirePermission('settings.manage'), async (req, res) => {
  try {
    const user = (req as any).user as db.UserRecord;
    const imported = req.body.data || req.body;
    await db.importAll(imported);
    await db.logAudit('DATABASE_IMPORTED', { id: user.id, email: user.email, role: user.role }, 'Imported database snapshot');
    res.json({ success: true, message: 'Database imported successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// EXPRESS APPLICATION WRAPPER (For Vite Dev & Vercel Serverless)
// -------------------------------------------------------------
export const apiApp = express();

// Middleware: CORS & Preflight
apiApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware: Body Parsing
apiApp.use(express.json({ limit: '10mb' }));
apiApp.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount apiRouter both with /api/v1 prefix and at root (for Vercel path rewriting)
apiApp.use('/api/v1', apiRouter);
apiApp.use(apiRouter);

// 404 Handler for API routes
apiApp.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `404 Not Found: Endpoint ${req.method} ${req.originalUrl || req.url} does not exist on ICETRACK API.`
  });
});

// Centralized Error Handling Middleware
apiApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ICETRACK API Server Error]:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  }
});
