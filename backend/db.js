const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "sih_grievances.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

function initDatabase() {
  db.exec(`
    -- Departments Table
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('CITIZEN', 'OFFICER', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN')) NOT NULL DEFAULT 'CITIZEN',
      department_id INTEGER REFERENCES departments(id),
      phone TEXT,
      zone TEXT DEFAULT 'Zone 1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Grievance Categories Table
    CREATE TABLE IF NOT EXISTS grievance_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER REFERENCES departments(id),
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      default_priority TEXT CHECK(default_priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
      sla_hours INTEGER DEFAULT 48
    );

    -- SLA Rules Table
    CREATE TABLE IF NOT EXISTS sla_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      sla_hours INTEGER NOT NULL,
      escalation_threshold_hours INTEGER DEFAULT 4,
      UNIQUE(category, priority)
    );

    -- Incidents Table (Clustered master tickets)
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      department TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'HIGH',
      status TEXT DEFAULT 'OPEN',
      primary_location TEXT,
      affected_citizens_count INTEGER DEFAULT 1,
      assigned_officer_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Grievances Table
    CREATE TABLE IF NOT EXISTS grievances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT UNIQUE NOT NULL,
      citizen_id INTEGER NOT NULL REFERENCES users(id),
      category TEXT NOT NULL,
      subcategory TEXT,
      department TEXT NOT NULL,
      priority TEXT CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL DEFAULT 'MEDIUM',
      description TEXT NOT NULL,
      location_text TEXT,
      latitude REAL,
      longitude REAL,
      language TEXT DEFAULT 'en',
      status TEXT CHECK(status IN ('SUBMITTED', 'AI_PROCESSED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CITIZEN_VERIFIED', 'CLOSED', 'ESCALATED', 'REOPENED', 'REJECTED')) NOT NULL DEFAULT 'SUBMITTED',
      ai_confidence REAL DEFAULT 0.90,
      assigned_officer_id INTEGER REFERENCES users(id),
      sla_deadline DATETIME,
      is_escalated INTEGER DEFAULT 0,
      escalation_level INTEGER DEFAULT 0,
      incident_id INTEGER REFERENCES incidents(id) ON DELETE SET NULL,
      is_duplicate INTEGER DEFAULT 0,
      duplicate_of_id INTEGER REFERENCES grievances(id),
      duplicate_confidence REAL DEFAULT 0.0,
      reopen_count INTEGER DEFAULT 0,
      reopen_reason TEXT,
      resolution_notes TEXT,
      resolved_at DATETIME,
      verified_at DATETIME,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Incident Grievances Mapping
    CREATE TABLE IF NOT EXISTS incident_grievances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      grievance_id INTEGER NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(incident_id, grievance_id)
    );

    -- Escalations Table
    CREATE TABLE IF NOT EXISTS escalations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grievance_id INTEGER NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
      escalated_from_officer_id INTEGER REFERENCES users(id),
      escalated_to_officer_id INTEGER REFERENCES users(id),
      reason TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- AI Analysis Log Table
    CREATE TABLE IF NOT EXISTS ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grievance_id INTEGER REFERENCES grievances(id) ON DELETE CASCADE,
      extracted_json TEXT NOT NULL,
      raw_prompt TEXT,
      confidence REAL DEFAULT 0.9,
      missing_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Locations Table
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grievance_id INTEGER UNIQUE REFERENCES grievances(id) ON DELETE CASCADE,
      location_text TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      address TEXT,
      city TEXT,
      state TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Grievance Status History Table
    CREATE TABLE IF NOT EXISTS grievance_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grievance_id INTEGER NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      changed_by_user_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_grievances_citizen ON grievances(citizen_id);
    CREATE INDEX IF NOT EXISTS idx_grievances_tracking ON grievances(tracking_number);
    CREATE INDEX IF NOT EXISTS idx_grievances_status ON grievances(status);
    CREATE INDEX IF NOT EXISTS idx_grievances_department ON grievances(department);
    CREATE INDEX IF NOT EXISTS idx_grievances_officer ON grievances(assigned_officer_id);
    CREATE INDEX IF NOT EXISTS idx_grievances_incident ON grievances(incident_id);
  `);
  console.log("Full database schema initialized successfully.");
}

initDatabase();

module.exports = db;
