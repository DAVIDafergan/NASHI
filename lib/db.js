const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
const db = new Database(path.join(DATA_DIR, 'givex.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, pass TEXT, name TEXT, phone TEXT DEFAULT '', org TEXT DEFAULT '', role TEXT DEFAULT 'user', created TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS campaigns(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, slug TEXT UNIQUE, title TEXT, subtitle TEXT DEFAULT '', story TEXT DEFAULT '', goal INTEGER DEFAULT 100000, bonus_goal INTEGER DEFAULT 0, currency TEXT DEFAULT 'ILS', multiplier REAL DEFAULT 1, start_at TEXT, end_at TEXT, status TEXT DEFAULT 'draft', cover TEXT DEFAULT '', logo TEXT DEFAULT '', video TEXT DEFAULT '', color TEXT DEFAULT '#1d4ed8', lang TEXT DEFAULT 'he', settings TEXT DEFAULT '{}', provider TEXT DEFAULT '{"type":"test"}', created TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS levels(id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE, name TEXT, amount INTEGER, descr TEXT DEFAULT '', stock INTEGER DEFAULT 0, pos INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS teams(id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE, slug TEXT, name TEXT, goal INTEGER DEFAULT 0, phone TEXT DEFAULT '', photo TEXT DEFAULT '', descr TEXT DEFAULT '', pos INTEGER DEFAULT 0, UNIQUE(campaign_id,slug));
CREATE TABLE IF NOT EXISTS matchers(id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE, name TEXT, logo TEXT DEFAULT '', pos INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS donations(id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE, team_id INTEGER, level_id INTEGER, amount INTEGER, currency TEXT DEFAULT 'ILS', name TEXT, phone TEXT DEFAULT '', email TEXT DEFAULT '', dedication TEXT DEFAULT '', anonymous INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', test INTEGER DEFAULT 0, provider TEXT DEFAULT '', ref TEXT DEFAULT '', installments INTEGER DEFAULT 1, monthly INTEGER DEFAULT 0, token TEXT, meta TEXT DEFAULT '{}', created TEXT DEFAULT (datetime('now')), paid_at TEXT);
CREATE INDEX IF NOT EXISTS d_c ON donations(campaign_id,status);
CREATE INDEX IF NOT EXISTS d_t ON donations(token);
CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);
`);
db.exec("CREATE TABLE IF NOT EXISTS updates(id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE, title TEXT, body TEXT, image TEXT DEFAULT '', created TEXT DEFAULT (datetime('now')))");
db.exec("CREATE TABLE IF NOT EXISTS contracts(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, version TEXT, name TEXT, id_number TEXT, role_title TEXT, org TEXT, org_number TEXT, email TEXT, phone TEXT, signature TEXT, ip TEXT, ua TEXT, html TEXT, sent INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now')))");
db.exec("CREATE TABLE IF NOT EXISTS resets(token TEXT PRIMARY KEY, user_id INTEGER, exp INTEGER)");
db.exec("CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER, user_id INTEGER, channel TEXT, audience TEXT, text TEXT, total INTEGER DEFAULT 0, sent INTEGER DEFAULT 0, failed INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now')))");
try { db.exec("ALTER TABLE teams ADD COLUMN email TEXT DEFAULT ''"); } catch { }
for (const col of ['icon TEXT DEFAULT \'\'', 'monthly INTEGER DEFAULT 0', 'months INTEGER DEFAULT 12']) { try { db.exec('ALTER TABLE levels ADD COLUMN ' + col); } catch { } }
for (const col of ['verified INTEGER DEFAULT 0', 'note TEXT DEFAULT \'\'', 'id_number TEXT DEFAULT \'\'']) { try { db.exec('ALTER TABLE donations ADD COLUMN ' + col); } catch { } }
for (const col of ['role_title TEXT DEFAULT \'\'', 'address TEXT DEFAULT \'\'', 'city TEXT DEFAULT \'\'', 'website TEXT DEFAULT \'\'', 's46 TEXT DEFAULT \'\'', 'consent_at TEXT DEFAULT \'\'', 'marketing INTEGER DEFAULT 0', 'sms TEXT DEFAULT \'{}\'', 'email_verified INTEGER DEFAULT 0', 'verify_token TEXT DEFAULT \'\'', 'org_number TEXT DEFAULT \'\'', 'org_name TEXT DEFAULT \'\'', 'org_verified INTEGER DEFAULT 0', 'org_data TEXT DEFAULT \'{}\'', 'org_status TEXT DEFAULT \'\'']) { try { db.exec('ALTER TABLE users ADD COLUMN ' + col); } catch { } }
for (const col of ["method TEXT DEFAULT 'digital'", "file TEXT DEFAULT ''", "docs TEXT DEFAULT '{}'", "status TEXT DEFAULT 'pending'", "review_note TEXT DEFAULT ''", "reviewed_at TEXT DEFAULT ''"]) { try { db.exec('ALTER TABLE contracts ADD COLUMN ' + col); } catch { } }
for (const col of ["plan TEXT DEFAULT ''", "plan_until TEXT DEFAULT ''"]) { try { db.exec('ALTER TABLE users ADD COLUMN ' + col); } catch { } }
try { db.exec('ALTER TABLE campaigns ADD COLUMN paid INTEGER DEFAULT 0'); } catch { }
db.exec("CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, campaign_id INTEGER, kind TEXT, amount INTEGER, status TEXT DEFAULT 'pending', ref TEXT DEFAULT '', note TEXT DEFAULT '', created TEXT DEFAULT (datetime('now')), approved_at TEXT DEFAULT '')");
// contracts signed before approval existed are grandfathered as approved
try { if (!db.prepare("SELECT 1 FROM kv WHERE k='contracts_grandfathered'").get()) { db.exec("UPDATE contracts SET status='approved' WHERE status='pending'"); db.prepare("INSERT INTO kv(k,v) VALUES('contracts_grandfathered','1')").run(); } } catch { }
fs.mkdirSync(path.join(DATA_DIR, 'private'), { recursive: true });
module.exports = { db, DATA_DIR };
