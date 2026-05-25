import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    migrate(db);
  }
  return db;
}

function columnExists(database, table, column) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      ghl_agent_id TEXT NOT NULL UNIQUE,
      location_id TEXT NOT NULL,
      name TEXT NOT NULL,
      business_name TEXT,
      welcome_message TEXT,
      agent_prompt TEXT,
      success_criteria TEXT NOT NULL DEFAULT '{}',
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      ghl_call_id TEXT NOT NULL UNIQUE,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      contact_id TEXT,
      started_at TEXT,
      duration_sec INTEGER,
      summary TEXT,
      transcript TEXT,
      transcript_json TEXT,
      extracted_data TEXT,
      trial_call INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_evaluations (
      call_id TEXT PRIMARY KEY REFERENCES calls(id),
      overall_score INTEGER NOT NULL,
      kpi_results TEXT NOT NULL,
      deviations TEXT NOT NULL,
      use_actions TEXT NOT NULL,
      evaluated_at TEXT NOT NULL,
      evaluated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      agent_id TEXT PRIMARY KEY REFERENCES agents(id),
      items TEXT NOT NULL,
      based_on_calls INTEGER NOT NULL DEFAULT 0,
      provider TEXT,
      generated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      agents_synced INTEGER DEFAULT 0,
      calls_synced INTEGER DEFAULT 0,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS llm_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      provider TEXT NOT NULL DEFAULT 'openai',
      openai_api_key TEXT,
      openai_model TEXT,
      gemini_api_key TEXT,
      gemini_model TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS monitored_agents (
      ghl_agent_id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      name TEXT NOT NULL,
      business_name TEXT,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ghl_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      api_token TEXT,
      location_id TEXT,
      api_base TEXT,
      timezone TEXT,
      default_agent_id TEXT,
      updated_at TEXT
    );
  `);

  if (!columnExists(database, 'call_evaluations', 'evaluated_by')) {
    database.exec('ALTER TABLE call_evaluations ADD COLUMN evaluated_by TEXT');
  }
  if (!columnExists(database, 'call_evaluations', 'suggestions')) {
    database.exec('ALTER TABLE call_evaluations ADD COLUMN suggestions TEXT NOT NULL DEFAULT \'[]\'');
  }
  if (!columnExists(database, 'call_evaluations', 'eval_fingerprint')) {
    database.exec('ALTER TABLE call_evaluations ADD COLUMN eval_fingerprint TEXT');
  }
  if (!columnExists(database, 'monitored_agents', 'api_token')) {
    database.exec('ALTER TABLE monitored_agents ADD COLUMN api_token TEXT');
  }
  if (!columnExists(database, 'monitored_agents', 'api_base')) {
    database.exec("ALTER TABLE monitored_agents ADD COLUMN api_base TEXT DEFAULT 'https://services.leadconnectorhq.com'");
  }
  if (!columnExists(database, 'monitored_agents', 'timezone')) {
    database.exec("ALTER TABLE monitored_agents ADD COLUMN timezone TEXT DEFAULT 'Asia/Kolkata'");
  }
  if (!columnExists(database, 'monitored_agents', 'evaluation_prompt')) {
    database.exec('ALTER TABLE monitored_agents ADD COLUMN evaluation_prompt TEXT');
  }
  if (!columnExists(database, 'monitored_agents', 'sync_interval_minutes')) {
    database.exec(
      'ALTER TABLE monitored_agents ADD COLUMN sync_interval_minutes INTEGER NOT NULL DEFAULT 0',
    );
  }
  if (!columnExists(database, 'monitored_agents', 'last_auto_sync_at')) {
    database.exec('ALTER TABLE monitored_agents ADD COLUMN last_auto_sync_at TEXT');
  }
}
