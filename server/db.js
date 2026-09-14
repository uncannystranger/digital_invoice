import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
const file = process.env.DATABASE_PATH || path.resolve("data/qaansheeg.sqlite");
mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
export const db = new DatabaseSync(file);
chmodSync(file, 0o600);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,language TEXT NOT NULL DEFAULT 'so');
CREATE TABLE IF NOT EXISTS businesses(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS business_members(user_id TEXT NOT NULL REFERENCES users(id),business_id TEXT NOT NULL REFERENCES businesses(id),role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),PRIMARY KEY(user_id,business_id));
CREATE TABLE IF NOT EXISTS business_settings(business_id TEXT PRIMARY KEY REFERENCES businesses(id),data TEXT NOT NULL,next_sequence INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),business_id TEXT NOT NULL REFERENCES businesses(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,sample INTEGER NOT NULL DEFAULT 0,UNIQUE(id,business_id));
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),data TEXT NOT NULL,sample INTEGER NOT NULL DEFAULT 0,UNIQUE(id,business_id));
CREATE TABLE IF NOT EXISTS invoices(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),customer_id TEXT NOT NULL,number TEXT NOT NULL,issue TEXT NOT NULL,due TEXT NOT NULL,currency TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('draft','sent','cancelled')),total INTEGER NOT NULL CHECK(total>=0),data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,sample INTEGER NOT NULL DEFAULT 0,deleted INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,UNIQUE(business_id,number),UNIQUE(id,business_id),FOREIGN KEY(customer_id,business_id) REFERENCES customers(id,business_id));
CREATE TABLE IF NOT EXISTS invoice_items(id TEXT PRIMARY KEY,invoice_id TEXT NOT NULL REFERENCES invoices(id),position INTEGER NOT NULL,description TEXT NOT NULL,quantity TEXT NOT NULL,price TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,business_id TEXT NOT NULL,invoice_id TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),date TEXT NOT NULL,method TEXT NOT NULL,reference TEXT NOT NULL,notes TEXT NOT NULL,idempotency_key TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(business_id,idempotency_key),FOREIGN KEY(invoice_id,business_id) REFERENCES invoices(id,business_id));
CREATE TABLE IF NOT EXISTS activity_logs(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),invoice_id TEXT,actor TEXT NOT NULL,action TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS public_links(token_hash TEXT PRIMARY KEY,business_id TEXT NOT NULL,invoice_id TEXT NOT NULL,expires INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(invoice_id,business_id) REFERENCES invoices(id,business_id));
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),invoice_id TEXT,title TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,dedupe TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS invoice_requests(business_id TEXT NOT NULL,request_key TEXT NOT NULL,invoice_id TEXT NOT NULL REFERENCES invoices(id),PRIMARY KEY(business_id,request_key));
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS invoices_tenant ON invoices(business_id,deleted,issue);
CREATE INDEX IF NOT EXISTS payment_tenant ON payments(business_id,invoice_id);
CREATE INDEX IF NOT EXISTS activity_tenant ON activity_logs(business_id,invoice_id);
`);
export const one = (sql, ...p) => db.prepare(sql).get(...p);
export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);
export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export const defaultSettings = (name) => ({
  name,
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "Muqdisho",
  country: "Soomaaliya",
  registration: "",
  taxNumber: "",
  logo: "",
  accent: "#556b4a",
  style: "classic",
  prefix: "QSH",
  dueDays: 14,
  currency: "USD",
  notes: "Waad ku mahadsan tahay wada shaqaynta.",
  terms: "Fadlan bixi lacagta ka hor taariikhda kama dambaysta ah.",
  signature: "",
  methods: [
    { name: "EVC Plus", enabled: false, details: "" },
    { name: "Zaad", enabled: false, details: "" },
    { name: "eDahab", enabled: false, details: "" },
    { name: "Sahal", enabled: false, details: "" },
    { name: "Bank Transfer", enabled: false, details: "" },
    { name: "Cash", enabled: true, details: "Lacag caddaan ah" },
    { name: "Other", enabled: false, details: "" },
  ],
});
