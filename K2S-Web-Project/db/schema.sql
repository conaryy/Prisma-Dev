-- K2S Web Project - MySQL Schema (Best Practice Draft)
-- Engine: InnoDB, charset utf8mb4.
-- Note: IDs are UUID strings (CHAR(36)) for simplicity.

CREATE DATABASE IF NOT EXISTS k2s_p1
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE k2s_p1;

CREATE TABLE IF NOT EXISTS instansi (
  id CHAR(36) PRIMARY KEY,
  facility_group VARCHAR(255) NOT NULL,
  kobu VARCHAR(255) NOT NULL,
  bandara VARCHAR(255) NOT NULL,
  cabang_airnav VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  alias VARCHAR(255) DEFAULT NULL,
  address TEXT,
  contact_name VARCHAR(255) DEFAULT NULL,
  contact_email VARCHAR(255) DEFAULT NULL,
  contact_phone VARCHAR(100) DEFAULT NULL,
  fax VARCHAR(100) DEFAULT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  longitude VARCHAR(50) DEFAULT NULL,
  latitude VARCHAR(50) DEFAULT NULL,
  service_area VARCHAR(255) DEFAULT NULL,
  operating_hours VARCHAR(100) DEFAULT NULL,
  traffic_type VARCHAR(100) DEFAULT NULL,
  runway_capacity VARCHAR(100) DEFAULT NULL,
  runway_condition VARCHAR(100) DEFAULT NULL,
  location VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facilities (
  id CHAR(36) PRIMARY KEY,
  instansi_id CHAR(36) DEFAULT NULL,
  facility_group VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  merk VARCHAR(255) DEFAULT NULL,
  type VARCHAR(255) DEFAULT NULL,
  frequency VARCHAR(100) DEFAULT NULL,
  ident VARCHAR(100) DEFAULT NULL,
  condition_status ENUM('Normal','Single','Unserviceable') NOT NULL DEFAULT 'Normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_facilities_instansi
    FOREIGN KEY (instansi_id) REFERENCES instansi(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) PRIMARY KEY,
  instansi_id CHAR(36) DEFAULT NULL,
  unit_name VARCHAR(255) NOT NULL,
  position_name VARCHAR(255) NOT NULL,
  level VARCHAR(50) DEFAULT NULL,
  status ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_organizations_instansi
    FOREIGN KEY (instansi_id) REFERENCES instansi(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS personil (
  id CHAR(36) PRIMARY KEY,
  instansi_id CHAR(36) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(255) DEFAULT NULL,
  level VARCHAR(50) DEFAULT NULL,
  field_name VARCHAR(100) DEFAULT NULL,
  tier VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_personil_instansi
    FOREIGN KEY (instansi_id) REFERENCES instansi(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id CHAR(36) PRIMARY KEY,
  instansi_id CHAR(36) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  number VARCHAR(255) NOT NULL,
  valid_until DATE NOT NULL,
  status ENUM('Berlaku','Tidak Berlaku') NOT NULL DEFAULT 'Berlaku',
  file_name VARCHAR(255) DEFAULT NULL,
  file_url TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_certificates_instansi
    FOREIGN KEY (instansi_id) REFERENCES instansi(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS agenda (
  id CHAR(36) PRIMARY KEY,
  date DATE NOT NULL,
  activity_type VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  status VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audits (
  id CHAR(36) PRIMARY KEY,
  number VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  location VARCHAR(255) NOT NULL,
  status VARCHAR(100) NOT NULL,
  focus VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspections (
  id CHAR(36) PRIMARY KEY,
  number VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  location VARCHAR(255) NOT NULL,
  status VARCHAR(100) NOT NULL,
  unit VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitoring (
  id CHAR(36) PRIMARY KEY,
  date DATE NOT NULL,
  location VARCHAR(255) NOT NULL,
  status VARCHAR(100) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS findings (
  id CHAR(36) PRIMARY KEY,
  source_type ENUM('Audit','Inspeksi','Monitoring') NOT NULL,
  source_id CHAR(36) NOT NULL,
  kategori VARCHAR(255) NOT NULL,
  deskripsi TEXT NOT NULL,
  severity ENUM('Low','Med','High') NOT NULL,
  status ENUM('Open','In Progress','Closed') NOT NULL,
  due_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_findings_source (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id CHAR(36) PRIMARY KEY,
  finding_id CHAR(36) NOT NULL,
  aksi_perbaikan TEXT NOT NULL,
  pic VARCHAR(255) NOT NULL,
  target_date DATE NOT NULL,
  status ENUM('Open','In Progress','Done') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_followups_finding
    FOREIGN KEY (finding_id) REFERENCES findings(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS follow_up_history (
  id CHAR(36) PRIMARY KEY,
  follow_up_id CHAR(36) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_followup_history
    FOREIGN KEY (follow_up_id) REFERENCES follow_ups(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS follow_up_evidence (
  id CHAR(36) PRIMARY KEY,
  follow_up_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_followup_evidence
    FOREIGN KEY (follow_up_id) REFERENCES follow_ups(id)
    ON DELETE CASCADE
);

-- Auth schema
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(50) DEFAULT NULL,
  role ENUM('Admin','Supervisor','Auditor','Viewer') NOT NULL DEFAULT 'Viewer',
  status ENUM('Active','Disabled') NOT NULL DEFAULT 'Active',
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  UNIQUE KEY uq_auth_sessions_refresh (refresh_token_hash),
  INDEX idx_auth_sessions_user (user_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  UNIQUE KEY uq_password_resets_token (token_hash),
  INDEX idx_password_resets_user (user_id)
);
