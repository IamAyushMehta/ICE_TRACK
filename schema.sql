-- =====================================================================
-- ICETRACK: Polar Operations & Logistics Command Database Schema
-- Compatible with PostgreSQL (Supabase, Neon, Render, Railway, AWS RDS)
-- =====================================================================

-- 1. Users Table
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

-- 2. Sessions Table (Persistent Auth across Serverless instances)
CREATE TABLE IF NOT EXISTS icetrack_sessions (
  token VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES icetrack_users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON icetrack_sessions(expires_at);

-- 3. Expeditions Table
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

-- 4. Cargo / Consignments Table
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

-- 5. Inventory Table
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

-- 6. Personnel Table
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

-- 7. Emergencies / SOS Alerts Table
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

-- 8. Field Reports & Observations Table
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

-- 9. Audit Logs Table
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON icetrack_audit_logs(timestamp DESC);

-- =====================================================================
-- INITIAL SEED DATA (Populated if not already existing)
-- =====================================================================

-- Seed Default Officers
INSERT INTO icetrack_users (id, name, email, password, role, designation, station, jurisdiction, assigned_expedition, assigned_team, clearance, created_at)
VALUES 
  ('USR-ADMIN', 'Administrator', 'A@gmail.com', 'Admin@2026', 'admin', 'Chief Polar Commander & Director General', 'NCPOR HQ / All Stations', 'All Polar Stations & Expeditions', 'All Expeditions', 'Command HQ', 'Level 5 (Directorate)', '2024-01-01T00:00:00Z'),
  ('USR-MANAGER', 'Expedition Manager', 'E@gmail.com', 'EM@2026', 'manager', 'Expedition Operations Lead', 'Bharati', 'Bharati Base & 44th ISEA Operations', '44th Indian Scientific Expedition to Antarctica', 'Bravo Operations', 'Level 4 (Operational Command)', '2024-01-10T00:00:00Z'),
  ('USR-FIELD', 'Field Officer', 'F@gmail.com', 'FO@2026', 'field_officer', 'Ice Core Drilling Specialist & Field Scientist', 'Dakshin Ice Camp', 'Dakshin Ice Camp Field Sector', 'Dakshin Gangotri Ice Core Drilling Survey', 'Echo Cryo-Drilling', 'Level 3 (Field Research)', '2024-02-01T00:00:00Z'),
  ('USR-LOGISTICS', 'Logistics Officer', 'L@gmail.com', 'LO@2026', 'logistics_officer', 'Polar Maritime & Supply Logistics Officer', 'Maitri & Bharati', 'Goa-Antarctica Marine Supply Corridor', 'Polar Logistics Supply Chain', 'Naval & Cargo Wing', 'Level 4 (Logistics Command)', '2024-02-15T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Expeditions
INSERT INTO icetrack_expeditions (id, name, station, start_date, end_date, ship, priority, manager_id, field_status, observations)
VALUES
  (1, '44th Indian Scientific Expedition to Antarctica', 'Bharati', '2024-11-15', '2025-03-30', 'MV Vasiliy Golovnin', 'High', 'USR-MANAGER', 'Operations Nominal', 'Vessel refitted at Cape Town, steaming through Roaring Forties.'),
  (2, 'Dakshin Gangotri Ice Core Drilling Survey', 'Dakshin Ice Camp', '2024-12-01', '2025-02-15', 'SA Agulhas II', 'Critical', 'USR-ADMIN', 'Active Drilling at 180m depth', 'Deep ice core thermal gradient recording nominal. Blizzard standby.'),
  (3, 'Larsemann Hills Atmospheric & Ozone Profiling', 'Maitri', '2025-01-10', '2025-04-20', 'RV Sagar Nidhi', 'Normal', 'USR-MANAGER', 'Weather Monitoring Nominal', 'Dobson spectrophotometer calibrated. Katabatic wind sensors active.')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Cargo
INSERT INTO icetrack_cargo (id, item, weight, weight_kg, origin, destination, status, progress, priority, expedition)
VALUES
  ('CGO-4401', 'Polar Heavy Generator Spares & Crankshafts', 3400, 3400, 'Mormugao Port (Goa)', 'Maitri Station', 'Loaded', 25, 'High', '44th Indian Scientific Expedition to Antarctica'),
  ('CGO-4402', 'Cryogenic Aviation Fuel & Jet-A1 Drums (2000L)', 6200, 6200, 'New Mangalore Port', 'Bharati Station', 'In Transit', 65, 'Critical', '44th Indian Scientific Expedition to Antarctica'),
  ('CGO-4403', 'Hydroponics Nutrient Solutions & Seed Modules', 450, 450, 'Mormugao Port (Goa)', 'Maitri Station', 'Delivered', 100, 'Normal', 'Larsemann Hills Atmospheric & Ozone Profiling'),
  ('CGO-4404', 'Deep-Ice Core Electromechanical Drill Heads', 1200, 1200, 'Cape Town Transit Hub', 'Dakshin Ice Camp', 'In Transit', 40, 'High', 'Dakshin Gangotri Ice Core Drilling Survey')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Inventory
INSERT INTO icetrack_inventory (id, item, category, location, current_stock, threshold, responsible, risk, icon)
VALUES
  (1, 'Extreme Polar Diesel (EPD -50°C)', 'Fuel & Power', 'Maitri', 42000, 25000, 'Col. Rajesh Sharma', 'Low', 'fa-gas-pump'),
  (2, 'Cryogenic Jet A-1 Helicopter Fuel', 'Fuel & Power', 'Bharati', 11000, 14000, 'Wg Cdr. K. Raman', 'Moderate', 'fa-plane'),
  (3, 'Freeze-Dried Rations (18-Month Reserve)', 'Provisions & Food', 'Maitri', 850, 300, 'Dr. Sunita Rao', 'Low', 'fa-utensils'),
  (4, 'Oxygen & Nitrogen Medical Cylinders', 'Medical & Cryo', 'Maitri', 14, 20, 'Surgeon Cdr. M. Patel', 'High', 'fa-notes-medical'),
  (5, 'Piston Rings for Cummins 250kVA GenSet', 'Mechanical Spares', 'Bharati', 4, 12, 'Er. Amitav Ghosh', 'High', 'fa-gears'),
  (6, 'Deep Permafrost Thermal Probes', 'Scientific Instruments', 'Dakshin Ice Camp', 24, 12, 'Dr. K. Swaminathan', 'Low', 'fa-temperature-low'),
  (7, 'Extreme Cold Weather (ECW) Parkas', 'Survival Gear', 'Dakshin Ice Camp', 38, 25, 'Dr. K. Swaminathan', 'Low', 'fa-vest'),
  (8, 'SATCOM Satellite Transceivers', 'Communications', 'Bharati', 6, 8, 'Expedition Manager', 'Moderate', 'fa-satellite-dish')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Personnel
INSERT INTO icetrack_personnel (id, name, role, team, station, location, coordinates, status, clearance, email, expedition)
VALUES
  (1, 'Dr. Abhigyan Sharma', 'Chief Polar Commander & Director General', 'Command HQ', 'Maitri & Bharati', 'Maitri Base Station (Central Command Module)', '70°45′57″S 11°44′09″E', 'Active', 'Level 5', 'admin@ncpor.res.in', 'All Expeditions'),
  (2, 'Expedition Manager', 'Expedition Operations Lead', 'Bravo Operations', 'Bharati', 'Bharati Research Station (Main Habitation Hub)', '69°24′28″S 76°11′14″E', 'Active', 'Level 4', 'E@gmail.com', '44th Indian Scientific Expedition to Antarctica'),
  (3, 'Dr. K. Swaminathan', 'Ice Core Drilling Specialist & Field Scientist', 'Echo Cryo-Drilling', 'Dakshin Ice Camp', 'Dakshin Ice Core Rig Field Site #4', '70°45′12″S 11°38′44″E', 'Active', 'Level 3', 'field@ncpor.res.in', 'Dakshin Gangotri Ice Core Drilling Survey'),
  (4, 'Commander Vikram Rao', 'Polar Maritime & Supply Logistics Officer', 'Naval & Cargo Wing', 'Bharati', 'Bharati Coastal Marine Pier & Prydz Bay Ice Margin', '69°24′28″S 76°11′14″E', 'Active', 'Level 4', 'logistics@ncpor.res.in', 'Polar Logistics Supply Chain'),
  (5, 'Dr. Ananya Roy', 'Chief Polar Atmospheric Physicist', 'Atmospheric Physics', 'Maitri', 'Maitri Meteorological Tower & Radiosonde Lab', '70°45′57″S 11°44′09″E', 'Active', 'Level 4', 'ananya.roy@ncpor.res.in', 'Larsemann Hills Atmospheric & Ozone Profiling'),
  (6, 'Col. Rajesh Sharma', 'Station Commander & Logistics Lead', 'Engineering Corps', 'Maitri', 'Maitri Base Station (Central Command Module)', '70°45′57″S 11°44′09″E', 'Active', 'Level 4', 'rajesh.sharma@indianarmy.nic.in', '44th Indian Scientific Expedition to Antarctica'),
  (7, 'Er. Amitav Ghosh', 'Electrical & Heating Systems Engineer', 'Life Support', 'Bharati', 'Bharati Thermal Generator Unit & Battery Shelter', '69°24′28″S 76°11′14″E', 'Active', 'Level 3', 'amitav.ghosh@ncpor.res.in', '44th Indian Scientific Expedition to Antarctica')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Emergencies
INSERT INTO icetrack_emergencies (id, team, station, type, severity, message, status, reported_by, reported_email, expedition, timestamp)
VALUES
  ('EMG-101', 'Echo Cryo-Drilling', 'Dakshin Ice Camp', 'Weather', 'High', 'Blizzard gusting to 52 knots. Core drilling suspended; shelter heating nominal on backup generator.', 'Active', 'Dr. K. Swaminathan', 'field@ncpor.res.in', 'Dakshin Gangotri Ice Core Drilling Survey', NOW() - INTERVAL '2 hours'),
  ('EMG-102', 'Logistics Wing', 'Bharati Base', 'Fuel', 'Moderate', 'Aviation Fuel Jet A-1 threshold warning. Tanker dispatch required from Mormugao Port.', 'Monitoring', 'Commander Vikram Rao', 'logistics@ncpor.res.in', 'Polar Logistics Supply Chain', NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Field Reports
INSERT INTO icetrack_field_reports (id, officer_email, officer_name, station, expedition, coordinates, elevation, surface_temp, wind_speed, notes, equipment_status, timestamp)
VALUES
  ('FR-01', 'field@ncpor.res.in', 'Dr. K. Swaminathan', 'Dakshin Ice Camp', 'Dakshin Gangotri Ice Core Drilling Survey', '70°45''S, 11°44''E', '2,200m ASL', '-38.4°C', '34 kts (SSW)', 'Core sample 44-D extracted intact at 182m. Ice crystalline structure dense with low gas inclusions.', 'Nominal', NOW() - INTERVAL '5 hours')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Audit Log
INSERT INTO icetrack_audit_logs (id, action, actor_id, actor_email, actor_role, details, timestamp)
VALUES
  ('AUD-001', 'SYSTEM_BOOTSTRAP', 'SYSTEM', 'system@ncpor.gov.in', 'system', 'ICETRACK PostgreSQL Defense Database and RBAC Kernel initialized', NOW())
ON CONFLICT (id) DO NOTHING;
