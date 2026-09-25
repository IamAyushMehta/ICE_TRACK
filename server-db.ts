import pg from 'pg';
const { Pool } = pg;

export interface UserRecord {
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

export interface ActiveSession {
  token: string;
  user: UserRecord;
  expiresAt: number;
}

export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  details: string;
  target?: string;
  timestamp: string;
}

// Default Seed Data
const DEFAULT_USERS: UserRecord[] = [
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

const DEFAULT_EXPEDITIONS = [
  { 
    id: 1, 
    name: "44th Indian Scientific Expedition to Antarctica", 
    station: "Bharati", 
    start: "2024-11-15", 
    end: "2025-03-30", 
    ship: "MV Vasiliy Golovnin", 
    priority: "High",
    managerId: "USR-MANAGER",
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
    managerId: "USR-ADMIN",
    fieldLeadId: "USR-FIELD",
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
    managerId: "USR-MANAGER",
    fieldStatus: "Weather Monitoring Nominal",
    observations: "Dobson spectrophotometer calibrated. Katabatic wind sensors active."
  }
];

const DEFAULT_CARGO = [
  { id: "CGO-4401", item: "Polar Heavy Generator Spares & Crankshafts", weight: 3400, weightKg: 3400, origin: "Mormugao Port (Goa)", destination: "Maitri Station", status: "Loaded", progress: 25, priority: "High", expedition: "44th Indian Scientific Expedition to Antarctica" },
  { id: "CGO-4402", item: "Cryogenic Aviation Fuel & Jet-A1 Drums (2000L)", weight: 6200, weightKg: 6200, origin: "New Mangalore Port", destination: "Bharati Station", status: "In Transit", progress: 65, priority: "Critical", expedition: "44th Indian Scientific Expedition to Antarctica" },
  { id: "CGO-4403", item: "Hydroponics Nutrient Solutions & Seed Modules", weight: 450, weightKg: 450, origin: "Mormugao Port (Goa)", destination: "Maitri Station", status: "Delivered", progress: 100, priority: "Normal", expedition: "Larsemann Hills Atmospheric & Ozone Profiling" },
  { id: "CGO-4404", item: "Deep-Ice Core Electromechanical Drill Heads", weight: 1200, weightKg: 1200, origin: "Cape Town Transit Hub", destination: "Dakshin Ice Camp", status: "In Transit", progress: 40, priority: "High", expedition: "Dakshin Gangotri Ice Core Drilling Survey" }
];

const DEFAULT_INVENTORY = [
  { id: 1, item: "Extreme Polar Diesel (EPD -50°C)", category: "Fuel & Power", location: "Maitri", current: 42000, threshold: 25000, responsible: "Col. Rajesh Sharma", risk: "Low", icon: "fa-gas-pump" },
  { id: 2, item: "Cryogenic Jet A-1 Helicopter Fuel", category: "Fuel & Power", location: "Bharati", current: 11000, threshold: 14000, responsible: "Wg Cdr. K. Raman", risk: "Moderate", icon: "fa-plane" },
  { id: 3, item: "Freeze-Dried Rations (18-Month Reserve)", category: "Provisions & Food", location: "Maitri", current: 850, threshold: 300, responsible: "Dr. Sunita Rao", risk: "Low", icon: "fa-utensils" },
  { id: 4, item: "Oxygen & Nitrogen Medical Cylinders", category: "Medical & Cryo", location: "Maitri", current: 14, threshold: 20, responsible: "Surgeon Cdr. M. Patel", risk: "High", icon: "fa-notes-medical" },
  { id: 5, item: "Piston Rings for Cummins 250kVA GenSet", category: "Mechanical Spares", location: "Bharati", current: 4, threshold: 12, responsible: "Er. Amitav Ghosh", risk: "High", icon: "fa-gears" },
  { id: 6, item: "Deep Permafrost Thermal Probes", category: "Scientific Instruments", location: "Dakshin Ice Camp", current: 24, threshold: 12, responsible: "Dr. K. Swaminathan", risk: "Low", icon: "fa-temperature-low" },
  { id: 7, item: "Extreme Cold Weather (ECW) Parkas", category: "Survival Gear", location: "Dakshin Ice Camp", current: 38, threshold: 25, responsible: "Dr. K. Swaminathan", risk: "Low", icon: "fa-vest" },
  { id: 8, item: "SATCOM Satellite Transceivers", category: "Communications", location: "Bharati", current: 6, threshold: 8, responsible: "Expedition Manager", risk: "Moderate", icon: "fa-satellite-dish" }
];

const DEFAULT_PERSONNEL = [
  { id: 1, name: "Dr. Abhigyan Sharma", role: "Chief Polar Commander & Director General", team: "Command HQ", station: "Maitri & Bharati", location: "Maitri Base Station (Central Command Module)", coordinates: "70°45′57″S 11°44′09″E", status: "Active", clearance: "Level 5", email: "admin@ncpor.res.in", expedition: "All Expeditions" },
  { id: 2, name: "Expedition Manager", role: "Expedition Operations Lead", team: "Bravo Operations", station: "Bharati", location: "Bharati Research Station (Main Habitation Hub)", coordinates: "69°24′28″S 76°11′14″E", status: "Active", clearance: "Level 4", email: "E@gmail.com", expedition: "44th Indian Scientific Expedition to Antarctica" },
  { id: 3, name: "Dr. K. Swaminathan", role: "Ice Core Drilling Specialist & Field Scientist", team: "Echo Cryo-Drilling", station: "Dakshin Ice Camp", location: "Dakshin Ice Core Rig Field Site #4", coordinates: "70°45′12″S 11°38′44″E", status: "Active", clearance: "Level 3", email: "field@ncpor.res.in", expedition: "Dakshin Gangotri Ice Core Drilling Survey" },
  { id: 4, name: "Commander Vikram Rao", role: "Polar Maritime & Supply Logistics Officer", team: "Naval & Cargo Wing", station: "Bharati", location: "Bharati Coastal Marine Pier & Prydz Bay Ice Margin", coordinates: "69°24′28″S 76°11′14″E", status: "Active", clearance: "Level 4", email: "logistics@ncpor.res.in", expedition: "Polar Logistics Supply Chain" },
  { id: 5, name: "Dr. Ananya Roy", role: "Chief Polar Atmospheric Physicist", team: "Atmospheric Physics", station: "Maitri", location: "Maitri Meteorological Tower & Radiosonde Lab", coordinates: "70°45′57″S 11°44′09″E", status: "Active", clearance: "Level 4", email: "ananya.roy@ncpor.res.in", expedition: "Larsemann Hills Atmospheric & Ozone Profiling" },
  { id: 6, name: "Col. Rajesh Sharma", role: "Station Commander & Logistics Lead", team: "Engineering Corps", station: "Maitri", location: "Maitri Base Station (Central Command Module)", coordinates: "70°45′57″S 11°44′09″E", status: "Active", clearance: "Level 4", email: "rajesh.sharma@indianarmy.nic.in", expedition: "44th Indian Scientific Expedition to Antarctica" },
  { id: 7, name: "Er. Amitav Ghosh", role: "Electrical & Heating Systems Engineer", team: "Life Support", station: "Bharati", location: "Bharati Thermal Generator Unit & Battery Shelter", coordinates: "69°24′28″S 76°11′14″E", status: "Active", clearance: "Level 3", email: "amitav.ghosh@ncpor.res.in", expedition: "44th Indian Scientific Expedition to Antarctica" }
];

const DEFAULT_EMERGENCIES = [
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
];

const DEFAULT_FIELD_REPORTS = [
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
];

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
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

// In-Memory Fallback Store (Used when DATABASE_URL is not provided or offline)
const inMemoryStore = {
  users: [...DEFAULT_USERS],
  sessions: new Map<string, ActiveSession>(),
  auditLogs: [...DEFAULT_AUDIT_LOGS],
  expeditions: [...DEFAULT_EXPEDITIONS],
  cargo: [...DEFAULT_CARGO],
  inventory: [...DEFAULT_INVENTORY],
  personnel: [...DEFAULT_PERSONNEL],
  emergencies: [...DEFAULT_EMERGENCIES],
  fieldReports: [...DEFAULT_FIELD_REPORTS]
};

// PostgreSQL Connection Pool Configuration
let pool: pg.Pool | null = null;
let isConnected = false;
let isInitializing = false;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;
}

export function isDatabaseConnected(): boolean {
  return isConnected;
}

export function getDbInfo() {
  return {
    connected: isConnected,
    type: isConnected ? 'PostgreSQL (Supabase / Cloud SQL)' : 'In-Memory Store (Zero-Config Fallback)',
    provider: isConnected ? 'PostgreSQL' : 'Memory'
  };
}

/**
 * Initializes PostgreSQL Pool and automatically runs DDL migration & initial seeding
 */
export async function initDatabase(): Promise<boolean> {
  const dbUrl = getDatabaseUrl();

  if (!dbUrl) {
    console.log('[ICETRACK DB] DATABASE_URL not set; running with robust in-memory database store.');
    isConnected = false;
    return false;
  }

  if (isConnected && pool) {
    return true;
  }

  if (isInitializing) {
    return false;
  }

  isInitializing = true;

  try {
    const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

    pool = new Pool({
      connectionString: dbUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000
    });

    // Test connection
    const client = await pool.connect();
    client.release();
    isConnected = true;
    console.log('[ICETRACK DB] Successfully connected to PostgreSQL Cloud Database.');

    // Run Auto-Migrations & Seeding
    await setupSchema();
    isInitializing = false;
    return true;
  } catch (err: any) {
    console.error('[ICETRACK DB] PostgreSQL connection error:', err.message);
    console.warn('[ICETRACK DB] Gracefully falling back to in-memory store.');
    isConnected = false;
    isInitializing = false;
    return false;
  }
}

/**
 * Ensures all necessary tables exist in PostgreSQL and seeds initial data if empty
 */
async function setupSchema() {
  if (!pool) return;

  const ddl = `
    CREATE TABLE IF NOT EXISTS icetrack_users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      designation VARCHAR(255),
      station VARCHAR(255),
      jurisdiction VARCHAR(255),
      assigned_expedition VARCHAR(255),
      assigned_team VARCHAR(255),
      clearance VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS icetrack_sessions (
      token VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES icetrack_users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS icetrack_expeditions (
      id BIGINT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      station VARCHAR(255) NOT NULL,
      start_date VARCHAR(64),
      end_date VARCHAR(64),
      ship VARCHAR(255),
      priority VARCHAR(50) DEFAULT 'Normal',
      manager_id VARCHAR(64),
      field_lead_id VARCHAR(64),
      field_status VARCHAR(255) DEFAULT 'Plan Approved',
      observations TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS icetrack_cargo (
      id VARCHAR(64) PRIMARY KEY,
      item VARCHAR(255) NOT NULL,
      weight NUMERIC DEFAULT 0,
      weight_kg NUMERIC DEFAULT 0,
      origin VARCHAR(255),
      destination VARCHAR(255),
      status VARCHAR(64) DEFAULT 'Registered',
      progress INTEGER DEFAULT 0,
      priority VARCHAR(50) DEFAULT 'Normal',
      expedition VARCHAR(255),
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS icetrack_inventory (
      id BIGINT PRIMARY KEY,
      item VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      location VARCHAR(255),
      current_stock NUMERIC DEFAULT 0,
      threshold NUMERIC DEFAULT 0,
      responsible VARCHAR(255),
      risk VARCHAR(50) DEFAULT 'Low',
      icon VARCHAR(100) DEFAULT 'fa-box',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS icetrack_personnel (
      id BIGINT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(255),
      team VARCHAR(255),
      station VARCHAR(255),
      location VARCHAR(255),
      coordinates VARCHAR(100),
      status VARCHAR(50) DEFAULT 'Active',
      clearance VARCHAR(50) DEFAULT 'Level 3',
      email VARCHAR(255),
      expedition VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS icetrack_emergencies (
      id VARCHAR(64) PRIMARY KEY,
      team VARCHAR(255),
      station VARCHAR(255),
      type VARCHAR(100) DEFAULT 'Operational',
      severity VARCHAR(50) DEFAULT 'High',
      message TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'Active',
      reported_by VARCHAR(255),
      reported_email VARCHAR(255),
      expedition VARCHAR(255),
      resolved_by VARCHAR(255),
      resolved_at TIMESTAMPTZ,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS icetrack_field_reports (
      id VARCHAR(64) PRIMARY KEY,
      officer_email VARCHAR(255),
      officer_name VARCHAR(255),
      station VARCHAR(255),
      expedition VARCHAR(255),
      coordinates VARCHAR(100),
      elevation VARCHAR(100),
      surface_temp VARCHAR(50),
      wind_speed VARCHAR(50),
      notes TEXT,
      equipment_status VARCHAR(100) DEFAULT 'Nominal',
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS icetrack_audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      actor_id VARCHAR(64),
      actor_email VARCHAR(255),
      actor_role VARCHAR(50),
      details TEXT,
      target VARCHAR(255),
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(ddl);

  // Check if seeding is needed (if users table is empty)
  const userCheck = await pool.query('SELECT COUNT(*) as count FROM icetrack_users');
  if (parseInt(userCheck.rows[0].count, 10) === 0) {
    console.log('[ICETRACK DB] Seeding initial polar defense records into PostgreSQL...');

    // Seed users
    for (const u of DEFAULT_USERS) {
      await pool.query(
        `INSERT INTO icetrack_users (id, name, email, password, role, designation, station, jurisdiction, assigned_expedition, assigned_team, clearance, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.email, u.password, u.role, u.designation, u.station, u.jurisdiction, u.assignedExpedition, u.assignedTeam, u.clearance, u.createdAt]
      );
    }

    // Seed expeditions
    for (const e of DEFAULT_EXPEDITIONS) {
      await pool.query(
        `INSERT INTO icetrack_expeditions (id, name, station, start_date, end_date, ship, priority, manager_id, field_status, observations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
        [e.id, e.name, e.station, e.start, e.end, e.ship, e.priority, e.managerId, e.fieldStatus, e.observations]
      );
    }

    // Seed cargo
    for (const c of DEFAULT_CARGO) {
      await pool.query(
        `INSERT INTO icetrack_cargo (id, item, weight, weight_kg, origin, destination, status, progress, priority, expedition)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.item, c.weight, c.weightKg, c.origin, c.destination, c.status, c.progress, c.priority, c.expedition]
      );
    }

    // Seed inventory
    for (const i of DEFAULT_INVENTORY) {
      await pool.query(
        `INSERT INTO icetrack_inventory (id, item, category, location, current_stock, threshold, responsible, risk, icon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
        [i.id, i.item, i.category, i.location, i.current, i.threshold, i.responsible, i.risk, i.icon]
      );
    }

    // Seed personnel
    for (const p of DEFAULT_PERSONNEL) {
      await pool.query(
        `INSERT INTO icetrack_personnel (id, name, role, team, station, location, coordinates, status, clearance, email, expedition)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.role, p.team, p.station, p.location, p.coordinates, p.status, p.clearance, p.email, p.expedition]
      );
    }

    // Seed emergencies
    for (const em of DEFAULT_EMERGENCIES) {
      await pool.query(
        `INSERT INTO icetrack_emergencies (id, team, station, type, severity, message, status, reported_by, reported_email, expedition, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
        [em.id, em.team, em.station, em.type, em.severity, em.message, em.status, em.reportedBy, em.reportedEmail, em.expedition, em.timestamp]
      );
    }

    // Seed field reports
    for (const fr of DEFAULT_FIELD_REPORTS) {
      await pool.query(
        `INSERT INTO icetrack_field_reports (id, officer_email, officer_name, station, expedition, coordinates, elevation, surface_temp, wind_speed, notes, equipment_status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
        [fr.id, fr.officerEmail, fr.officerName, fr.station, fr.expedition, fr.coordinates, fr.elevation, fr.surfaceTemp, fr.windSpeed, fr.notes, fr.equipmentStatus, fr.timestamp]
      );
    }

    // Seed audit log
    for (const al of DEFAULT_AUDIT_LOGS) {
      await pool.query(
        `INSERT INTO icetrack_audit_logs (id, action, actor_id, actor_email, actor_role, details, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [al.id, al.action, al.actorId, al.actorEmail, al.actorRole, al.details, al.timestamp]
      );
    }

    console.log('[ICETRACK DB] Initial seed data successfully populated in PostgreSQL.');
  }
}

// -------------------------------------------------------------
// USER OPERATIONS
// -------------------------------------------------------------

function mapUserRow(row: any): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    designation: row.designation,
    station: row.station,
    jurisdiction: row.jurisdiction,
    assignedExpedition: row.assigned_expedition,
    assignedTeam: row.assigned_team,
    clearance: row.clearance,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const clean = (email || '').trim().toLowerCase();
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_users WHERE LOWER(email) = $1 LIMIT 1', [clean]);
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }
  return inMemoryStore.users.find(u => u.email.toLowerCase() === clean) || null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_users WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }
  return inMemoryStore.users.find(u => u.id === id) || null;
}

export async function getAllUsers(): Promise<UserRecord[]> {
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_users ORDER BY created_at ASC');
    return res.rows.map(mapUserRow);
  }
  return [...inMemoryStore.users];
}

export async function createUser(user: UserRecord): Promise<UserRecord> {
  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO icetrack_users (id, name, email, password, role, designation, station, jurisdiction, assigned_expedition, assigned_team, clearance, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [user.id, user.name, user.email, user.password, user.role, user.designation, user.station, user.jurisdiction, user.assignedExpedition, user.assignedTeam, user.clearance, user.createdAt]
    );
    return user;
  }
  inMemoryStore.users.push(user);
  return user;
}

export async function updateUserRole(id: string, newRole: string): Promise<UserRecord | null> {
  if (isConnected && pool) {
    const res = await pool.query(
      'UPDATE icetrack_users SET role = $1 WHERE id = $2 RETURNING *',
      [newRole, id]
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  }
  const u = inMemoryStore.users.find(user => user.id === id);
  if (u) {
    u.role = newRole as any;
    return u;
  }
  return null;
}

// -------------------------------------------------------------
// SESSION OPERATIONS (Vercel Serverless Cross-Instance Persistence)
// -------------------------------------------------------------

export async function createSession(token: string, user: UserRecord, expiresAt: number): Promise<void> {
  if (isConnected && pool) {
    await pool.query(
      'INSERT INTO icetrack_sessions (token, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token) DO UPDATE SET expires_at = $3',
      [token, user.id, expiresAt]
    );
    return;
  }
  inMemoryStore.sessions.set(token, { token, user, expiresAt });
}

export async function getSession(token: string): Promise<ActiveSession | null> {
  if (isConnected && pool) {
    const res = await pool.query(
      `SELECT s.token, s.expires_at, u.* 
       FROM icetrack_sessions s 
       JOIN icetrack_users u ON s.user_id = u.id 
       WHERE s.token = $1 LIMIT 1`,
      [token]
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    const expiresAt = Number(row.expires_at);

    if (Date.now() > expiresAt) {
      await deleteSession(token);
      return null;
    }

    return {
      token: row.token,
      expiresAt,
      user: mapUserRow(row)
    };
  }

  const s = inMemoryStore.sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    inMemoryStore.sessions.delete(token);
    return null;
  }
  return s;
}

export async function deleteSession(token: string): Promise<void> {
  if (isConnected && pool) {
    await pool.query('DELETE FROM icetrack_sessions WHERE token = $1', [token]);
    return;
  }
  inMemoryStore.sessions.delete(token);
}

// -------------------------------------------------------------
// AUDIT LOGS
// -------------------------------------------------------------

export async function getAuditLogs(): Promise<AuditLog[]> {
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_audit_logs ORDER BY timestamp DESC LIMIT 500');
    return res.rows.map(r => ({
      id: r.id,
      action: r.action,
      actorId: r.actor_id,
      actorEmail: r.actor_email,
      actorRole: r.actor_role,
      details: r.details,
      target: r.target,
      timestamp: new Date(r.timestamp).toISOString()
    }));
  }
  return [...inMemoryStore.auditLogs];
}

export async function logAudit(
  action: string,
  actor: { id: string; email: string; role: string },
  details: string,
  target?: string
): Promise<void> {
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

  if (isConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO icetrack_audit_logs (id, action, actor_id, actor_email, actor_role, details, target, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [entry.id, entry.action, entry.actorId, entry.actorEmail, entry.actorRole, entry.details, entry.target || null, entry.timestamp]
      );
      return;
    } catch (e: any) {
      console.error('[ICETRACK DB] Failed to persist audit log to Postgres:', e.message);
    }
  }

  inMemoryStore.auditLogs.unshift(entry);
  if (inMemoryStore.auditLogs.length > 500) inMemoryStore.auditLogs.pop();
}

// -------------------------------------------------------------
// EXPEDITIONS
// -------------------------------------------------------------

function mapExpeditionRow(r: any) {
  return {
    id: Number(r.id),
    name: r.name,
    station: r.station,
    start: r.start_date,
    end: r.end_date,
    ship: r.ship,
    priority: r.priority,
    managerId: r.manager_id,
    fieldLeadId: r.field_lead_id,
    fieldStatus: r.field_status,
    observations: r.observations
  };
}

export async function getExpeditions(): Promise<any[]> {
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_expeditions ORDER BY id ASC');
    return res.rows.map(mapExpeditionRow);
  }
  return [...inMemoryStore.expeditions];
}

export async function createExpedition(exp: any): Promise<any> {
  const newExp = {
    id: exp.id || Date.now(),
    name: exp.name,
    station: exp.station,
    start: exp.start,
    end: exp.end,
    ship: exp.ship || 'RV Sagar Nidhi',
    priority: exp.priority || 'Normal',
    managerId: exp.managerId,
    fieldStatus: exp.fieldStatus || 'Plan Approved',
    observations: exp.observations || ''
  };

  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO icetrack_expeditions (id, name, station, start_date, end_date, ship, priority, manager_id, field_status, observations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [newExp.id, newExp.name, newExp.station, newExp.start, newExp.end, newExp.ship, newExp.priority, newExp.managerId, newExp.fieldStatus, newExp.observations]
    );
    return newExp;
  }

  inMemoryStore.expeditions.unshift(newExp);
  return newExp;
}

export async function updateExpedition(id: string | number, updates: any): Promise<any | null> {
  if (isConnected && pool) {
    const existing = await pool.query('SELECT * FROM icetrack_expeditions WHERE id = $1', [id]);
    if (!existing.rows[0]) return null;

    const current = mapExpeditionRow(existing.rows[0]);
    const merged = { ...current, ...updates };

    await pool.query(
      `UPDATE icetrack_expeditions SET 
        name = $1, station = $2, start_date = $3, end_date = $4, ship = $5,
        priority = $6, manager_id = $7, field_status = $8, observations = $9
       WHERE id = $10`,
      [merged.name, merged.station, merged.start, merged.end, merged.ship, merged.priority, merged.managerId, merged.fieldStatus, merged.observations, id]
    );
    return merged;
  }

  const exp = inMemoryStore.expeditions.find(e => String(e.id) === String(id));
  if (!exp) return null;
  Object.assign(exp, updates);
  return exp;
}

export async function deleteExpedition(id: string | number): Promise<boolean> {
  if (isConnected && pool) {
    const res = await pool.query('DELETE FROM icetrack_expeditions WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }
  const before = inMemoryStore.expeditions.length;
  inMemoryStore.expeditions = inMemoryStore.expeditions.filter(e => String(e.id) !== String(id));
  return inMemoryStore.expeditions.length < before;
}

// -------------------------------------------------------------
// CARGO
// -------------------------------------------------------------

function mapCargoRow(r: any) {
  return {
    id: r.id,
    item: r.item,
    weight: Number(r.weight || 0),
    weightKg: Number(r.weight_kg || r.weight || 0),
    origin: r.origin,
    destination: r.destination,
    status: r.status,
    progress: Number(r.progress || 0),
    priority: r.priority,
    expedition: r.expedition,
    createdBy: r.created_by
  };
}

export async function getCargo(): Promise<any[]> {
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_cargo ORDER BY created_at DESC');
    return res.rows.map(mapCargoRow);
  }
  return [...inMemoryStore.cargo];
}

export async function createCargo(cargo: any): Promise<any> {
  const newCargo = {
    id: cargo.id || `CGO-${Math.floor(1000 + Math.random() * 9000)}`,
    item: cargo.item,
    weight: Number(cargo.weight || cargo.weightKg || 0),
    weightKg: Number(cargo.weightKg || cargo.weight || 0),
    origin: cargo.origin,
    destination: cargo.destination,
    status: cargo.status || 'Loaded',
    progress: Number(cargo.progress || 0),
    priority: cargo.priority || 'Normal',
    expedition: cargo.expedition,
    createdBy: cargo.createdBy
  };

  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO icetrack_cargo (id, item, weight, weight_kg, origin, destination, status, progress, priority, expedition, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [newCargo.id, newCargo.item, newCargo.weight, newCargo.weightKg, newCargo.origin, newCargo.destination, newCargo.status, newCargo.progress, newCargo.priority, newCargo.expedition, newCargo.createdBy]
    );
    return newCargo;
  }

  inMemoryStore.cargo.unshift(newCargo);
  return newCargo;
}

export async function updateCargo(id: string, updates: any): Promise<any | null> {
  if (isConnected && pool) {
    const existing = await pool.query('SELECT * FROM icetrack_cargo WHERE LOWER(id) = LOWER($1)', [id]);
    if (!existing.rows[0]) return null;

    const current = mapCargoRow(existing.rows[0]);
    const merged = { ...current, ...updates };

    await pool.query(
      `UPDATE icetrack_cargo SET 
        item = $1, weight = $2, weight_kg = $3, origin = $4, destination = $5,
        status = $6, progress = $7, priority = $8, expedition = $9
       WHERE LOWER(id) = LOWER($10)`,
      [merged.item, merged.weight, merged.weightKg, merged.origin, merged.destination, merged.status, merged.progress, merged.priority, merged.expedition, id]
    );
    return merged;
  }

  const index = inMemoryStore.cargo.findIndex(c => String(c.id).toLowerCase() === String(id).toLowerCase());
  if (index === -1) return null;
  inMemoryStore.cargo[index] = { ...inMemoryStore.cargo[index], ...updates };
  return inMemoryStore.cargo[index];
}

export async function deleteCargo(id: string): Promise<boolean> {
  if (isConnected && pool) {
    const res = await pool.query('DELETE FROM icetrack_cargo WHERE LOWER(id) = LOWER($1)', [id]);
    return (res.rowCount || 0) > 0;
  }
  const before = inMemoryStore.cargo.length;
  inMemoryStore.cargo = inMemoryStore.cargo.filter(c => String(c.id).toLowerCase() !== String(id).toLowerCase());
  return inMemoryStore.cargo.length < before;
}

// -------------------------------------------------------------
// INVENTORY
// -------------------------------------------------------------

function mapInventoryRow(r: any) {
  return {
    id: Number(r.id),
    item: r.item,
    category: r.category,
    location: r.location,
    current: Number(r.current_stock || 0),
    threshold: Number(r.threshold || 0),
    responsible: r.responsible,
    risk: r.risk,
    icon: r.icon
  };
}

export async function getInventory(): Promise<any[]> {
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_inventory ORDER BY id ASC');
    return res.rows.map(mapInventoryRow);
  }
  return [...inMemoryStore.inventory];
}

export async function createInventory(item: any): Promise<any> {
  const newItem = {
    id: item.id || Date.now(),
    item: item.item,
    category: item.category || 'Supplies',
    location: item.location || 'Maitri',
    current: Number(item.current || 0),
    threshold: Number(item.threshold || 0),
    responsible: item.responsible || 'Officer in Charge',
    risk: item.risk || 'Low',
    icon: item.icon || 'fa-box'
  };

  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO icetrack_inventory (id, item, category, location, current_stock, threshold, responsible, risk, icon)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [newItem.id, newItem.item, newItem.category, newItem.location, newItem.current, newItem.threshold, newItem.responsible, newItem.risk, newItem.icon]
    );
    return newItem;
  }

  inMemoryStore.inventory.unshift(newItem);
  return newItem;
}

export async function updateInventory(id: string | number, updates: any): Promise<any | null> {
  if (isConnected && pool) {
    const existing = await pool.query('SELECT * FROM icetrack_inventory WHERE id = $1', [id]);
    if (!existing.rows[0]) return null;

    const current = mapInventoryRow(existing.rows[0]);
    const merged = { ...current, ...updates };

    await pool.query(
      `UPDATE icetrack_inventory SET 
        item = $1, category = $2, location = $3, current_stock = $4, threshold = $5,
        responsible = $6, risk = $7, icon = $8
       WHERE id = $9`,
      [merged.item, merged.category, merged.location, merged.current, merged.threshold, merged.responsible, merged.risk, merged.icon, id]
    );
    return merged;
  }

  const index = inMemoryStore.inventory.findIndex(i => String(i.id) === String(id));
  if (index === -1) return null;
  inMemoryStore.inventory[index] = { ...inMemoryStore.inventory[index], ...updates };
  return inMemoryStore.inventory[index];
}

export async function deleteInventory(id: string | number): Promise<boolean> {
  if (isConnected && pool) {
    const res = await pool.query('DELETE FROM icetrack_inventory WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }
  const before = inMemoryStore.inventory.length;
  inMemoryStore.inventory = inMemoryStore.inventory.filter(i => String(i.id) !== String(id));
  return inMemoryStore.inventory.length < before;
}

// -------------------------------------------------------------
// PERSONNEL
// -------------------------------------------------------------

function mapPersonnelRow(r: any) {
  return {
    id: Number(r.id),
    name: r.name,
    role: r.role,
    team: r.team,
    station: r.station,
    location: r.location,
    coordinates: r.coordinates,
    status: r.status,
    clearance: r.clearance,
    email: r.email,
    expedition: r.expedition
  };
}

export async function getPersonnel(): Promise<any[]> {
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_personnel ORDER BY id ASC');
    return res.rows.map(mapPersonnelRow);
  }
  return [...inMemoryStore.personnel];
}

export async function createPersonnel(person: any): Promise<any> {
  const newPerson = {
    id: person.id || Date.now(),
    name: person.name,
    role: person.role || 'Field Specialist',
    team: person.team || 'Operational Team',
    station: person.station || 'Maitri',
    location: person.location || 'Maitri Base',
    coordinates: person.coordinates || '70°45′57″S 11°44′09″E',
    status: person.status || 'Active',
    clearance: person.clearance || 'Level 3',
    email: person.email,
    expedition: person.expedition || '44th Indian Scientific Expedition to Antarctica'
  };

  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO icetrack_personnel (id, name, role, team, station, location, coordinates, status, clearance, email, expedition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [newPerson.id, newPerson.name, newPerson.role, newPerson.team, newPerson.station, newPerson.location, newPerson.coordinates, newPerson.status, newPerson.clearance, newPerson.email, newPerson.expedition]
    );
    return newPerson;
  }

  inMemoryStore.personnel.unshift(newPerson);
  return newPerson;
}

export async function deletePersonnel(id: string | number): Promise<boolean> {
  if (isConnected && pool) {
    const res = await pool.query('DELETE FROM icetrack_personnel WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }
  const before = inMemoryStore.personnel.length;
  inMemoryStore.personnel = inMemoryStore.personnel.filter(p => String(p.id) !== String(id));
  return inMemoryStore.personnel.length < before;
}

// -------------------------------------------------------------
// EMERGENCIES
// -------------------------------------------------------------

function mapEmergencyRow(r: any) {
  return {
    id: r.id,
    team: r.team,
    station: r.station,
    type: r.type,
    severity: r.severity,
    message: r.message,
    status: r.status,
    reportedBy: r.reported_by,
    reportedEmail: r.reported_email,
    expedition: r.expedition,
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString()
  };
}

export async function getEmergencies(): Promise<any[]> {
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_emergencies ORDER BY timestamp DESC');
    return res.rows.map(mapEmergencyRow);
  }
  return [...inMemoryStore.emergencies];
}

export async function createEmergency(emg: any): Promise<any> {
  const newEmg = {
    id: emg.id || `EMG-${Math.floor(100 + Math.random() * 900)}`,
    team: emg.team || 'Field Operations',
    station: emg.station || 'Maitri',
    type: emg.type || 'Operational',
    severity: emg.severity || 'High',
    message: emg.message,
    status: 'Active',
    reportedBy: emg.reportedBy,
    reportedEmail: emg.reportedEmail,
    expedition: emg.expedition,
    timestamp: new Date().toISOString()
  };

  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO icetrack_emergencies (id, team, station, type, severity, message, status, reported_by, reported_email, expedition, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [newEmg.id, newEmg.team, newEmg.station, newEmg.type, newEmg.severity, newEmg.message, newEmg.status, newEmg.reportedBy, newEmg.reportedEmail, newEmg.expedition, newEmg.timestamp]
    );
    return newEmg;
  }

  inMemoryStore.emergencies.unshift(newEmg);
  return newEmg;
}

export async function resolveEmergency(id: string, resolvedBy: string): Promise<any | null> {
  const resolvedAt = new Date().toISOString();
  if (isConnected && pool) {
    const res = await pool.query(
      `UPDATE icetrack_emergencies 
       SET status = 'Resolved', resolved_by = $1, resolved_at = $2 
       WHERE id = $3 RETURNING *`,
      [resolvedBy, resolvedAt, id]
    );
    return res.rows[0] ? mapEmergencyRow(res.rows[0]) : null;
  }

  const emg = inMemoryStore.emergencies.find(e => e.id === id);
  if (!emg) return null;
  emg.status = 'Resolved';
  (emg as any).resolvedBy = resolvedBy;
  (emg as any).resolvedAt = resolvedAt;
  return emg;
}

// -------------------------------------------------------------
// FIELD OBSERVATIONS & REPORTS
// -------------------------------------------------------------

function mapFieldReportRow(r: any) {
  return {
    id: r.id,
    officerEmail: r.officer_email,
    officerName: r.officer_name,
    station: r.station,
    expedition: r.expedition,
    coordinates: r.coordinates,
    elevation: r.elevation,
    surfaceTemp: r.surface_temp,
    windSpeed: r.wind_speed,
    notes: r.notes,
    equipmentStatus: r.equipment_status,
    timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString()
  };
}

export async function getFieldReports(): Promise<any[]> {
  if (isConnected && pool) {
    const res = await pool.query('SELECT * FROM icetrack_field_reports ORDER BY timestamp DESC');
    return res.rows.map(mapFieldReportRow);
  }
  return [...inMemoryStore.fieldReports];
}

export async function createFieldReport(report: any): Promise<any> {
  const newReport = {
    id: report.id || `FR-${Date.now()}`,
    officerEmail: report.officerEmail,
    officerName: report.officerName,
    station: report.station,
    expedition: report.expedition,
    coordinates: report.coordinates || "70°45'S, 11°44'E",
    elevation: report.elevation || '2,200m ASL',
    surfaceTemp: report.surfaceTemp || '-35°C',
    windSpeed: report.windSpeed || '30 kts',
    notes: report.notes || 'Field observation logged',
    equipmentStatus: report.equipmentStatus || 'Nominal',
    timestamp: new Date().toISOString()
  };

  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO icetrack_field_reports (id, officer_email, officer_name, station, expedition, coordinates, elevation, surface_temp, wind_speed, notes, equipment_status, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [newReport.id, newReport.officerEmail, newReport.officerName, newReport.station, newReport.expedition, newReport.coordinates, newReport.elevation, newReport.surfaceTemp, newReport.windSpeed, newReport.notes, newReport.equipmentStatus, newReport.timestamp]
    );
    return newReport;
  }

  inMemoryStore.fieldReports.unshift(newReport);
  return newReport;
}

// -------------------------------------------------------------
// DATABASE FULL EXPORT & IMPORT
// -------------------------------------------------------------

export async function exportAll() {
  const [expeditions, cargo, inventory, personnel, emergencies, fieldReports, rawUsers] = await Promise.all([
    getExpeditions(),
    getCargo(),
    getInventory(),
    getPersonnel(),
    getEmergencies(),
    getFieldReports(),
    getAllUsers()
  ]);

  return {
    version: '3.1',
    provider: isConnected ? 'PostgreSQL' : 'InMemory',
    exportedAt: new Date().toISOString(),
    data: {
      expeditions,
      cargo,
      inventory,
      personnel,
      emergencies,
      fieldReports,
      users: rawUsers.map(u => ({ ...u, password: '***' }))
    }
  };
}

export async function importAll(imported: any) {
  if (Array.isArray(imported.expeditions)) {
    for (const exp of imported.expeditions) {
      await updateExpedition(exp.id, exp) || await createExpedition(exp);
    }
  }
  if (Array.isArray(imported.cargo)) {
    for (const c of imported.cargo) {
      await updateCargo(c.id, c) || await createCargo(c);
    }
  }
  if (Array.isArray(imported.inventory)) {
    for (const i of imported.inventory) {
      await updateInventory(i.id, i) || await createInventory(i);
    }
  }
  if (Array.isArray(imported.personnel)) {
    for (const p of imported.personnel) {
      await createPersonnel(p);
    }
  }
}
