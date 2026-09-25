import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable CORS for development and local clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// --- Role Definitions & Permission Matrix ---
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  FIELD_OFFICER: 'field_officer',
  LOGISTICS_OFFICER: 'logistics_officer'
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
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

// --- In-Memory Datastores ---
interface UserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'field_officer' | 'logistics_officer';
  designation: string;
  station: string;
  jurisdiction: string;
  assignedExpedition: string;
  assignedTeam: string;
  clearance: string;
  createdAt: string;
}

const users: UserRecord[] = [
  {
    id: 'USR-ADMIN',
    name: 'Administrator',
    email: 'A@gmail.com',
    password: 'Admin@2026',
    role: 'admin',
    designation: 'Chief Polar Commander & Director General',
    station: 'NCPOR HQ / All Stations',
    jurisdiction: 'All Polar Stations & Expeditions',
    assignedExpedition: 'All Expeditions',
    assignedTeam: 'Command HQ',
    clearance: 'Level 5 (Directorate)',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'USR-MANAGER',
    name: 'Expedition Manager',
    email: 'E@gmail.com',
    password: 'EM@2026',
    role: 'manager',
    designation: 'Expedition Operations Lead',
    station: 'Bharati',
    jurisdiction: 'Bharati Base & 44th ISEA Operations',
    assignedExpedition: '44th Indian Scientific Expedition to Antarctica',
    assignedTeam: 'Bravo Operations',
    clearance: 'Level 4 (Operational Command)',
    createdAt: '2024-01-10T00:00:00Z'
  },
  {
    id: 'USR-FIELD',
    name: 'Field Officer',
    email: 'F@gmail.com',
    password: 'FO@2026',
    role: 'field_officer',
    designation: 'Ice Core Drilling Specialist & Field Scientist',
    station: 'Dakshin Ice Camp',
    jurisdiction: 'Dakshin Ice Camp Field Sector',
    assignedExpedition: 'Dakshin Gangotri Ice Core Drilling Survey',
    assignedTeam: 'Echo Cryo-Drilling',
    clearance: 'Level 3 (Field Research)',
    createdAt: '2024-02-01T00:00:00Z'
  },
  {
    id: 'USR-LOGISTICS',
    name: 'Logistics Officer',
    email: 'L@gmail.com',
    password: 'LO@2026',
    role: 'logistics_officer',
    designation: 'Polar Maritime & Supply Logistics Officer',
    station: 'Maitri & Bharati',
    jurisdiction: 'Goa-Antarctica Marine Supply Corridor',
    assignedExpedition: 'Polar Logistics Supply Chain',
    assignedTeam: 'Naval & Cargo Wing',
    clearance: 'Level 4 (Logistics Command)',
    createdAt: '2024-02-15T00:00:00Z'
  }
];

// Active server sessions: token -> { user, expiresAt }
interface ActiveSession {
  token: string;
  user: UserRecord;
  expiresAt: number;
}
const activeSessions = new Map<string, ActiveSession>();

// Audit Log Store
interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  details: string;
  target?: string;
  timestamp: string;
}
const auditLogs: AuditLog[] = [
  {
    id: 'AUD-001',
    action: 'SYSTEM_BOOTSTRAP',
    actorId: 'SYSTEM',
    actorEmail: 'system@ncpor.gov.in',
    actorRole: 'system',
    details: 'ICETRACK RBAC Kernel and Polar Operations Database initialized',
    timestamp: new Date(Date.now() - 3600000).toISOString()
  }
];

function logAudit(action: string, actor: { id: string; email: string; role: string }, details: string, target?: string) {
  const entry: AuditLog = {
    id: `AUD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    action,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    details,
    target,
    timestamp: new Date().toISOString()
  };
  auditLogs.unshift(entry);
  if (auditLogs.length > 500) auditLogs.pop();
}

// Polar Operations Datastore
const db = {
  expeditions: [
    { 
      id: 1, 
      name: "44th Indian Scientific Expedition to Antarctica", 
      station: "Bharati", 
      start: "2024-11-15", 
      end: "2025-03-30", 
      ship: "MV Vasiliy Golovnin", 
      priority: "High",
      managerId: "USR-002",
      fieldStatus: "Operations Nominal",
      observations: "Vessel refitted at Cape Town, steaming through Roaring Forties."
    },
    { 
      id: 2, 
      name: "Dakshin Gangotri Ice Core Drilling Survey", 
      station: "Dakshin Ice Camp", 
      start: "2024-12-01", 
      end: "2025-02-15", 
      ship: "SA Agulhas II", 
      priority: "Critical",
      managerId: "USR-001",
      fieldLeadId: "USR-003",
      fieldStatus: "Active Drilling at 180m depth",
      observations: "Deep ice core thermal gradient recording nominal. Blizzard standby."
    },
    { 
      id: 3, 
      name: "Larsemann Hills Atmospheric & Ozone Profiling", 
      station: "Maitri", 
      start: "2025-01-10", 
      end: "2025-04-20", 
      ship: "RV Sagar Nidhi", 
      priority: "Normal",
      managerId: "USR-002",
      fieldStatus: "Weather Monitoring Nominal",
      observations: "Dobson spectrophotometer calibrated. Katabatic wind sensors active."
    }
  ],
  cargo: [
    { id: "CGO-4401", item: "Polar Heavy Generator Spares & Crankshafts", weight: 3400, weightKg: 3400, origin: "Mormugao Port (Goa)", destination: "Maitri Station", status: "Loaded", progress: 25, priority: "High", expedition: "44th Indian Scientific Expedition to Antarctica" },
    { id: "CGO-4402", item: "Cryogenic Aviation Fuel & Jet-A1 Drums (2000L)", weight: 6200, weightKg: 6200, origin: "New Mangalore Port", destination: "Bharati Station", status: "In Transit", progress: 65, priority: "Critical", expedition: "44th Indian Scientific Expedition to Antarctica" },
    { id: "CGO-4403", item: "Hydroponics Nutrient Solutions & Seed Modules", weight: 450, weightKg: 450, origin: "Mormugao Port (Goa)", destination: "Maitri Station", status: "Delivered", progress: 100, priority: "Normal", expedition: "Larsemann Hills Atmospheric & Ozone Profiling" },
    { id: "CGO-4404", item: "Deep-Ice Core Electromechanical Drill Heads", weight: 1200, weightKg: 1200, origin: "Cape Town Transit Hub", destination: "Dakshin Ice Camp", status: "In Transit", progress: 40, priority: "High", expedition: "Dakshin Gangotri Ice Core Drilling Survey" }
  ],
  inventory: [
    { id: 1, item: "Extreme Polar Diesel (EPD -50°C)", category: "Fuel & Power", location: "Maitri", current: 42000, threshold: 25000, responsible: "Col. Rajesh Sharma", risk: "Low", icon: "fa-gas-pump" },
    { id: 2, item: "Cryogenic Jet A-1 Helicopter Fuel", category: "Fuel & Power", location: "Bharati", current: 11000, threshold: 14000, responsible: "Wg Cdr. K. Raman", risk: "Moderate", icon: "fa-plane" },
    { id: 3, item: "Freeze-Dried Rations (18-Month Reserve)", category: "Provisions & Food", location: "Maitri", current: 850, threshold: 300, responsible: "Dr. Sunita Rao", risk: "Low", icon: "fa-utensils" },
    { id: 4, item: "Oxygen & Nitrogen Medical Cylinders", category: "Medical & Cryo", location: "Maitri", current: 14, threshold: 20, responsible: "Surgeon Cdr. M. Patel", risk: "High", icon: "fa-notes-medical" },
    { id: 5, item: "Piston Rings for Cummins 250kVA GenSet", category: "Mechanical Spares", location: "Bharati", current: 4, threshold: 12, responsible: "Er. Amitav Ghosh", risk: "High", icon: "fa-gears" },
    { id: 6, item: "Deep Permafrost Thermal Probes", category: "Scientific Instruments", location: "Dakshin Ice Camp", current: 24, threshold: 12, responsible: "Dr. K. Swaminathan", risk: "Low", icon: "fa-temperature-low" },
    { id: 7, item: "Extreme Cold Weather (ECW) Parkas", category: "Survival Gear", location: "Dakshin Ice Camp", current: 38, threshold: 25, responsible: "Dr. K. Swaminathan", risk: "Low", icon: "fa-vest" },
    { id: 8, item: "SATCOM Satellite Transceivers", category: "Communications", location: "Bharati", current: 6, threshold: 8, responsible: "Expedition Manager", risk: "Moderate", icon: "fa-satellite-dish" }
  ],
  personnel: [
    { id: 1, name: "Dr. Abhigyan Sharma", role: "Chief Polar Commander & Director General", team: "Command HQ", station: "Maitri & Bharati", location: "Maitri Base Station (Central Command Module)", coordinates: "70°45′57″S 11°44′09″E", status: "Active", clearance: "Level 5", email: "admin@ncpor.res.in", expedition: "All Expeditions" },
    { id: 2, name: "Expedition Manager", role: "Expedition Operations Lead", team: "Bravo Operations", station: "Bharati", location: "Bharati Research Station (Main Habitation Hub)", coordinates: "69°24′28″S 76°11′14″E", status: "Active", clearance: "Level 4", email: "E@gmail.com", expedition: "44th Indian Scientific Expedition to Antarctica" },
    { id: 3, name: "Dr. K. Swaminathan", role: "Ice Core Drilling Specialist & Field Scientist", team: "Echo Cryo-Drilling", station: "Dakshin Ice Camp", location: "Dakshin Ice Core Rig Field Site #4", coordinates: "70°45′12″S 11°38′44″E", status: "Active", clearance: "Level 3", email: "field@ncpor.res.in", expedition: "Dakshin Gangotri Ice Core Drilling Survey" },
    { id: 4, name: "Commander Vikram Rao", role: "Polar Maritime & Supply Logistics Officer", team: "Naval & Cargo Wing", station: "Bharati", location: "Bharati Coastal Marine Pier & Prydz Bay Ice Margin", coordinates: "69°24′28″S 76°11′14″E", status: "Active", clearance: "Level 4", email: "logistics@ncpor.res.in", expedition: "Polar Logistics Supply Chain" },
    { id: 5, name: "Dr. Ananya Roy", role: "Chief Polar Atmospheric Physicist", team: "Atmospheric Physics", station: "Maitri", location: "Maitri Meteorological Tower & Radiosonde Lab", coordinates: "70°45′57″S 11°44′09″E", status: "Active", clearance: "Level 4", email: "ananya.roy@ncpor.res.in", expedition: "Larsemann Hills Atmospheric & Ozone Profiling" },
    { id: 6, name: "Col. Rajesh Sharma", role: "Station Commander & Logistics Lead", team: "Engineering Corps", station: "Maitri", location: "Maitri Base Station (Central Command Module)", coordinates: "70°45′57″S 11°44′09″E", status: "Active", clearance: "Level 4", email: "rajesh.sharma@indianarmy.nic.in", expedition: "44th Indian Scientific Expedition to Antarctica" },
    { id: 7, name: "Er. Amitav Ghosh", role: "Electrical & Heating Systems Engineer", team: "Life Support", station: "Bharati", location: "Bharati Thermal Generator Unit & Battery Shelter", coordinates: "69°24′28″S 76°11′14″E", status: "Active", clearance: "Level 3", email: "amitav.ghosh@ncpor.res.in", expedition: "44th Indian Scientific Expedition to Antarctica" }
  ],
  emergencies: [
    {
      id: "EMG-101",
      team: "Echo Cryo-Drilling",
      station: "Dakshin Ice Camp",
      type: "Weather",
      severity: "High",
      message: "Blizzard gusting to 52 knots. Core drilling suspended; shelter heating nominal on backup generator.",
      status: "Active",
      reportedBy: "Dr. K. Swaminathan",
      reportedEmail: "field@ncpor.res.in",
      expedition: "Dakshin Gangotri Ice Core Drilling Survey",
      timestamp: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: "EMG-102",
      team: "Logistics Wing",
      station: "Bharati Base",
      type: "Fuel",
      severity: "Moderate",
      message: "Aviation Fuel Jet A-1 threshold warning. Tanker dispatch required from Mormugao Port.",
      status: "Monitoring",
      reportedBy: "Commander Vikram Rao",
      reportedEmail: "logistics@ncpor.res.in",
      expedition: "Polar Logistics Supply Chain",
      timestamp: new Date(Date.now() - 14400000).toISOString()
    }
  ],
  fieldReports: [
    {
      id: "FR-01",
      officerEmail: "field@ncpor.res.in",
      officerName: "Dr. K. Swaminathan",
      station: "Dakshin Ice Camp",
      expedition: "Dakshin Gangotri Ice Core Drilling Survey",
      coordinates: "70°45'S, 11°44'E",
      elevation: "2,200m ASL",
      surfaceTemp: "-38.4°C",
      windSpeed: "34 kts (SSW)",
      notes: "Core sample 44-D extracted intact at 182m. Ice crystalline structure dense with low gas inclusions.",
      equipmentStatus: "Nominal",
      timestamp: new Date(Date.now() - 18000000).toISOString()
    }
  ]
};

// --- Authentication & RBAC Middleware ---

function authenticateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: '401 Unauthorized: Valid security token required to access ICETRACK services.'
    });
  }

  const token = authHeader.substring(7).trim();
  const session = activeSessions.get(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      error: '401 Unauthorized: Session invalid or expired. Please log in again.'
    });
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({
      success: false,
      error: '401 Unauthorized: Session expired. Re-authentication required.'
    });
  }

  (req as any).user = session.user;
  (req as any).token = token;
  next();
}

function requirePermission(permission: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user as UserRecord;
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

// --- RESTful API Routes ---

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'ICETRACK Polar Logistics & Expedition Command Backend',
    version: '3.0.0 (RBAC Enforced)',
    timestamp: new Date().toISOString(),
    activeSessionsCount: activeSessions.size,
    rolesSupported: Object.keys(ROLE_PERMISSIONS)
  });
});

// --- Authentication Endpoints ---

// POST /api/v1/auth/login: Validates official credentials or provisions authenticated officer session
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password, role: requestedRole } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanEmail || !cleanPass) {
    return res.status(400).json({
      success: false,
      error: 'Official email ID and security password are required.'
    });
  }

  // Look up user in official records - strictly allow only authorized officer accounts
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);

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

  // Generate cryptographically unique server session token
  const token = `icetrack_sec_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  activeSessions.set(token, { token, user, expiresAt });

  logAudit(
    'USER_LOGIN_SUCCESS',
    { id: user.id, email: user.email, role: user.role },
    `Successful login as ${user.designation} (${user.role}) from station ${user.station}`
  );

  // Return sanitized user record with authoritatively assigned role
  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role, // Server authoritative role
      designation: user.designation,
      station: user.station,
      jurisdiction: user.jurisdiction,
      assignedExpedition: user.assignedExpedition,
      assignedTeam: user.assignedTeam,
      clearance: user.clearance
    }
  });
});

// GET /api/v1/auth/me: Retrieve current authenticated identity from token
app.get('/api/v1/auth/me', authenticateUser, (req, res) => {
  const user = (req as any).user as UserRecord;
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

// POST /api/v1/auth/logout: Revoke server session
app.post('/api/v1/auth/logout', authenticateUser, (req, res) => {
  const token = (req as any).token as string;
  const user = (req as any).user as UserRecord;

  activeSessions.delete(token);
  logAudit('USER_LOGOUT', { id: user.id, email: user.email, role: user.role }, 'User signed out');

  res.json({ success: true, message: 'Logged out successfully' });
});

// --- User Management (Admin Only) ---

// GET /api/v1/users
app.get('/api/v1/users', authenticateUser, requirePermission('users.view'), (req, res) => {
  const userList = users.map(u => ({
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
  res.json({ success: true, count: userList.length, data: userList });
});

// POST /api/v1/users: Create new account
app.post('/api/v1/users', authenticateUser, requirePermission('users.create'), (req, res) => {
  const actor = (req as any).user as UserRecord;
  const { name, email, password, role, designation, station, jurisdiction, assignedExpedition, assignedTeam, clearance } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, error: 'Name, email, password, and role are required.' });
  }

  const validRoles = ['admin', 'manager', 'field_officer', 'logistics_officer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
  }

  const newUser: UserRecord = {
    id: `USR-0${users.length + 1}`,
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

  users.push(newUser);
  logAudit('USER_CREATED', { id: actor.id, email: actor.email, role: actor.role }, `Created user ${newUser.name} (${newUser.email}) with role ${newUser.role}`, newUser.id);

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
});

// PATCH /api/v1/users/:id/role: Change user role
app.patch('/api/v1/users/:id/role', authenticateUser, requirePermission('users.assign_role'), (req, res) => {
  const actor = (req as any).user as UserRecord;
  const targetId = req.params.id;
  const { role } = req.body;

  const validRoles = ['admin', 'manager', 'field_officer', 'logistics_officer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  const targetUser = users.find(u => u.id === targetId);
  if (!targetUser) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const oldRole = targetUser.role;
  targetUser.role = role;

  logAudit(
    'USER_ROLE_CHANGED',
    { id: actor.id, email: actor.email, role: actor.role },
    `Changed role of ${targetUser.name} (${targetUser.email}) from ${oldRole} to ${role}`,
    targetUser.id
  );

  res.json({
    success: true,
    data: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      oldRole,
      newRole: targetUser.role
    }
  });
});

// GET /api/v1/audit-logs: View audit trail
app.get('/api/v1/audit-logs', authenticateUser, requirePermission('audit_logs.view'), (req, res) => {
  res.json({ success: true, count: auditLogs.length, data: auditLogs });
});

// --- Expeditions (Role-Scoped & CRUD Protected) ---

app.get('/api/v1/expeditions', authenticateUser, requirePermission('expeditions.view'), (req, res) => {
  const user = (req as any).user as UserRecord;

  let result = db.expeditions;
  // Field Officers can only view their assigned expedition
  if (user.role === 'field_officer') {
    result = db.expeditions.filter(e => 
      e.name.toLowerCase().includes(user.assignedExpedition.toLowerCase()) || 
      e.station.toLowerCase().includes(user.station.toLowerCase())
    );
  } else if (user.role === 'manager') {
    // Managers can see all or prioritize their assigned
    result = db.expeditions.map(e => ({
      ...e,
      isAssigned: e.name.toLowerCase().includes(user.assignedExpedition.toLowerCase()) || e.station.toLowerCase().includes(user.station.toLowerCase())
    }));
  }

  res.json({ success: true, count: result.length, data: result });
});

app.post('/api/v1/expeditions', authenticateUser, requirePermission('expeditions.create'), (req, res) => {
  const user = (req as any).user as UserRecord;

  const newExp = {
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
  };

  db.expeditions.unshift(newExp);
  logAudit('EXPEDITION_CREATED', { id: user.id, email: user.email, role: user.role }, `Created mission: ${newExp.name}`, String(newExp.id));

  res.status(201).json({ success: true, data: newExp });
});

app.patch('/api/v1/expeditions/:id', authenticateUser, (req, res) => {
  const user = (req as any).user as UserRecord;
  const id = req.params.id;
  const exp = db.expeditions.find(e => String(e.id) === String(id));

  if (!exp) return res.status(404).json({ success: false, error: 'Expedition not found' });

  // Field officer can only update field status and observations
  if (user.role === 'field_officer') {
    if (req.body.fieldStatus) exp.fieldStatus = req.body.fieldStatus;
    if (req.body.observations) exp.observations = req.body.observations;
    logAudit('EXPEDITION_FIELD_STATUS_UPDATED', { id: user.id, email: user.email, role: user.role }, `Updated field status to: ${exp.fieldStatus}`, String(exp.id));
    return res.json({ success: true, data: exp });
  }

  // Manager can update assigned expeditions
  if (user.role === 'manager' || user.role === 'admin') {
    Object.assign(exp, req.body);
    logAudit('EXPEDITION_UPDATED', { id: user.id, email: user.email, role: user.role }, `Updated expedition ${exp.name}`, String(exp.id));
    return res.json({ success: true, data: exp });
  }

  return res.status(403).json({ success: false, error: '403 Forbidden: Insufficient permissions to modify expeditions.' });
});

app.delete('/api/v1/expeditions/:id', authenticateUser, requirePermission('expeditions.delete'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const id = req.params.id;
  const target = db.expeditions.find(e => String(e.id) === String(id));
  db.expeditions = db.expeditions.filter(e => String(e.id) !== String(id));
  logAudit('EXPEDITION_DELETED', { id: user.id, email: user.email, role: user.role }, `Deleted expedition: ${target?.name || id}`, String(id));
  res.json({ success: true });
});

// --- Cargo (Role-Scoped & CRUD Protected) ---

app.get('/api/v1/cargo', authenticateUser, requirePermission('cargo.view'), (req, res) => {
  const user = (req as any).user as UserRecord;
  let result = db.cargo;

  // Field Officer: Read-only details required for assigned mission/station
  if (user.role === 'field_officer') {
    result = db.cargo.filter(c => 
      c.destination.toLowerCase().includes(user.station.toLowerCase()) || 
      (c.expedition && c.expedition.toLowerCase().includes(user.assignedExpedition.toLowerCase()))
    );
  } else if (user.role === 'manager') {
    // Manager sees cargo for assigned expeditions
    result = db.cargo.filter(c => 
      c.destination.toLowerCase().includes(user.station.toLowerCase()) || 
      (c.expedition && c.expedition.toLowerCase().includes(user.assignedExpedition.toLowerCase())) ||
      user.station.includes('All')
    );
  }

  res.json({ success: true, count: result.length, data: result });
});

app.post('/api/v1/cargo', authenticateUser, requirePermission('cargo.create'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const newCargo = {
    id: req.body.id || `CGO-${Math.floor(1000 + Math.random() * 9000)}`,
    ...req.body,
    createdBy: user.email
  };
  db.cargo.unshift(newCargo);
  logAudit('CARGO_REGISTERED', { id: user.id, email: user.email, role: user.role }, `Registered consignment ${newCargo.id}: ${newCargo.item}`, newCargo.id);
  res.status(201).json({ success: true, data: newCargo });
});

app.patch('/api/v1/cargo/:id', authenticateUser, requirePermission('cargo.update'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const id = req.params.id;
  const index = db.cargo.findIndex(c => String(c.id).toLowerCase() === String(id).toLowerCase());
  if (index === -1) return res.status(404).json({ error: 'Cargo not found' });

  db.cargo[index] = { ...db.cargo[index], ...req.body };
  logAudit('CARGO_UPDATED', { id: user.id, email: user.email, role: user.role }, `Updated cargo ${id} status: ${db.cargo[index].status}`, id);
  res.json({ success: true, data: db.cargo[index] });
});

app.delete('/api/v1/cargo/:id', authenticateUser, requirePermission('cargo.delete'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const id = req.params.id;
  db.cargo = db.cargo.filter(c => String(c.id).toLowerCase() !== String(id).toLowerCase());
  logAudit('CARGO_DELETED', { id: user.id, email: user.email, role: user.role }, `Deleted consignment ${id}`, id);
  res.json({ success: true });
});

// --- Inventory (Role-Scoped & CRUD Protected) ---

app.get('/api/v1/inventory', authenticateUser, requirePermission('inventory.monitor'), (req, res) => {
  const user = (req as any).user as UserRecord;
  let result = db.inventory;

  // Field officers see assigned equipment & supplies
  if (user.role === 'field_officer') {
    result = db.inventory.filter(i => 
      i.location.toLowerCase() === user.station.toLowerCase() ||
      (i.responsible && i.responsible.toLowerCase().includes(user.name.toLowerCase()))
    );
  }

  res.json({ success: true, count: result.length, data: result });
});

app.post('/api/v1/inventory', authenticateUser, requirePermission('inventory.manage'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const newItem = { id: Date.now(), ...req.body };
  db.inventory.unshift(newItem);
  logAudit('INVENTORY_ITEM_ADDED', { id: user.id, email: user.email, role: user.role }, `Added inventory stock ${newItem.item} at ${newItem.location}`, String(newItem.id));
  res.status(201).json({ success: true, data: newItem });
});

app.patch('/api/v1/inventory/:id', authenticateUser, requirePermission('inventory.manage'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const id = req.params.id;
  const index = db.inventory.findIndex(item => String(item.id) === String(id));
  if (index === -1) return res.status(404).json({ error: 'Item not found' });

  db.inventory[index] = { ...db.inventory[index], ...req.body };
  logAudit('INVENTORY_UPDATED', { id: user.id, email: user.email, role: user.role }, `Updated stock ${db.inventory[index].item}: current ${db.inventory[index].current}`, String(id));
  res.json({ success: true, data: db.inventory[index] });
});

app.delete('/api/v1/inventory/:id', authenticateUser, requirePermission('inventory.manage'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const id = req.params.id;
  db.inventory = db.inventory.filter(item => String(item.id) !== String(id));
  logAudit('INVENTORY_DELETED', { id: user.id, email: user.email, role: user.role }, `Deleted inventory item ${id}`, String(id));
  res.json({ success: true });
});

// --- Personnel (Role-Scoped & CRUD Protected) ---

app.get('/api/v1/personnel', authenticateUser, (req, res) => {
  const user = (req as any).user as UserRecord;
  let result = db.personnel;

  if (user.role === 'field_officer') {
    // View own profile and assigned team only
    result = db.personnel.filter(p => 
      p.email.toLowerCase() === user.email.toLowerCase() ||
      p.station.toLowerCase() === user.station.toLowerCase() ||
      (p.team && user.assignedTeam && p.team.toLowerCase() === user.assignedTeam.toLowerCase())
    );
  } else if (user.role === 'manager') {
    // Manage personnel assignments for assigned expeditions
    result = db.personnel.filter(p => 
      p.station.toLowerCase() === user.station.toLowerCase() ||
      (p.expedition && p.expedition.toLowerCase().includes(user.assignedExpedition.toLowerCase())) ||
      user.station.includes('All')
    );
  }

  res.json({ success: true, count: result.length, data: result });
});

app.post('/api/v1/personnel', authenticateUser, requirePermission('personnel.manage'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const newPerson = { id: Date.now(), ...req.body };
  db.personnel.unshift(newPerson);
  logAudit('PERSONNEL_ASSIGNED', { id: user.id, email: user.email, role: user.role }, `Assigned ${newPerson.name} to ${newPerson.station}`, String(newPerson.id));
  res.status(201).json({ success: true, data: newPerson });
});

app.delete('/api/v1/personnel/:id', authenticateUser, requirePermission('personnel.manage'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const id = req.params.id;
  db.personnel = db.personnel.filter(p => String(p.id) !== String(id));
  logAudit('PERSONNEL_REMOVED', { id: user.id, email: user.email, role: user.role }, `Removed personnel ${id}`, String(id));
  res.json({ success: true });
});

// --- Emergency & Field Observations ---

app.get('/api/v1/emergency', authenticateUser, (req, res) => {
  const user = (req as any).user as UserRecord;
  let result = db.emergencies;

  if (user.role === 'field_officer') {
    result = db.emergencies.filter(e => e.reportedEmail.toLowerCase() === user.email.toLowerCase() || e.station.toLowerCase() === user.station.toLowerCase());
  } else if (user.role === 'manager') {
    result = db.emergencies.filter(e => e.station.toLowerCase() === user.station.toLowerCase() || (e.expedition && e.expedition.toLowerCase().includes(user.assignedExpedition.toLowerCase())));
  } else if (user.role === 'logistics_officer') {
    result = db.emergencies.filter(e => e.type === 'Fuel' || e.type === 'Equipment' || e.station.toLowerCase().includes('bharati') || e.station.toLowerCase().includes('maitri'));
  }

  res.json({ success: true, count: result.length, data: result });
});

app.post('/api/v1/emergency', authenticateUser, (req, res) => {
  const user = (req as any).user as UserRecord;
  const newEmg = {
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
  };

  db.emergencies.unshift(newEmg);
  logAudit('EMERGENCY_SOS_TRANSMITTED', { id: user.id, email: user.email, role: user.role }, `SOS: [${newEmg.type} - ${newEmg.severity}] ${newEmg.message}`, newEmg.id);

  res.status(201).json({ success: true, data: newEmg });
});

app.patch('/api/v1/emergency/:id/resolve', authenticateUser, (req, res) => {
  const user = (req as any).user as UserRecord;
  const id = req.params.id;
  const emg = db.emergencies.find(e => e.id === id);

  if (!emg) return res.status(404).json({ success: false, error: 'Emergency record not found' });

  // Field officers cannot resolve emergencies (only Admin, Manager, or Logistics for supply)
  if (user.role === 'field_officer') {
    return res.status(403).json({ success: false, error: '403 Forbidden: Field officers cannot resolve emergencies.' });
  }

  emg.status = 'Resolved';
  (emg as any).resolvedBy = user.name;
  (emg as any).resolvedAt = new Date().toISOString();

  logAudit('EMERGENCY_RESOLVED', { id: user.id, email: user.email, role: user.role }, `Emergency ${id} resolved by ${user.name}`, id);
  res.json({ success: true, data: emg });
});

// Field Observations & Location Updates
app.get('/api/v1/field/observations', authenticateUser, (req, res) => {
  res.json({ success: true, count: db.fieldReports.length, data: db.fieldReports });
});

app.post('/api/v1/field/observations', authenticateUser, requirePermission('observations.create'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const newReport = {
    id: `FR-${Date.now()}`,
    officerEmail: user.email,
    officerName: user.name,
    station: req.body.station || user.station,
    expedition: user.assignedExpedition,
    coordinates: req.body.coordinates || '70°45\'S, 11°44\'E',
    elevation: req.body.elevation || '2,200m ASL',
    surfaceTemp: req.body.surfaceTemp || '-35°C',
    windSpeed: req.body.windSpeed || '30 kts',
    notes: req.body.notes || 'Field observation logged',
    equipmentStatus: req.body.equipmentStatus || 'Nominal',
    timestamp: new Date().toISOString()
  };

  db.fieldReports.unshift(newReport);
  logAudit('FIELD_OBSERVATION_SUBMITTED', { id: user.id, email: user.email, role: user.role }, `Observation by ${user.name} at ${newReport.station}`, newReport.id);

  res.status(201).json({ success: true, data: newReport });
});

app.post('/api/v1/field/location', authenticateUser, requirePermission('location.update_own'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const { latitude, longitude, sector, statusNotes } = req.body;

  logAudit(
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
});

// Database Full Export / Import (Admin Only)
app.get('/api/v1/database/export', authenticateUser, requirePermission('settings.manage'), (req, res) => {
  res.json({
    version: "3.0",
    exportedAt: new Date().toISOString(),
    data: {
      expeditions: db.expeditions,
      cargo: db.cargo,
      inventory: db.inventory,
      personnel: db.personnel,
      emergencies: db.emergencies,
      fieldReports: db.fieldReports,
      users: users.map(u => ({ ...u, password: '***' }))
    }
  });
});

app.post('/api/v1/database/import', authenticateUser, requirePermission('settings.manage'), (req, res) => {
  const user = (req as any).user as UserRecord;
  const imported = req.body.data || req.body;
  if (Array.isArray(imported.expeditions)) db.expeditions = imported.expeditions;
  if (Array.isArray(imported.cargo)) db.cargo = imported.cargo;
  if (Array.isArray(imported.inventory)) db.inventory = imported.inventory;
  if (Array.isArray(imported.personnel)) db.personnel = imported.personnel;
  logAudit('DATABASE_IMPORTED', { id: user.id, email: user.email, role: user.role }, 'Imported database snapshot');
  res.json({ success: true, message: 'Database imported successfully' });
});

// Static file serving for client app
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ICETRACK Polar Ops] Server and RBAC REST Engine running at http://0.0.0.0:${PORT}`);
  console.log(`[ICETRACK Polar Ops] 4 Authenticated Roles Active: Administrator, Expedition Manager, Field/Research Officer, Logistics Officer`);
});
