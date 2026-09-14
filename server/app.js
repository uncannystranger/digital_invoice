import express from "express";
import helmet from "helmet";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import sharp from "sharp";
import nodemailer from "nodemailer";
import Decimal from "decimal.js";
import { z, ZodError } from "zod";
import { db, one, all, run, transaction, defaultSettings } from "./db.js";
import {
  settings,
  invoice,
  listInvoices,
  makeInvoice,
  editInvoice,
  createLink,
  customer,
  id,
  hash,
  now,
  fail,
  log,
  seed,
} from "./invoices.js";
import {
  authSchema,
  customerSchema,
  productSchema,
  invoiceSchema,
  paymentSchema,
  settingsSchema,
} from "./schema.js";
import { pdfBuffer } from "./pdf.js";
import { today, formatMoney } from "../shared/finance.js";
const scrypt = promisify(scryptCallback);
const production = process.env.NODE_ENV === "production";
const origin = process.env.APP_ORIGIN || "http://localhost:5173";
if (production && (!process.env.APP_ORIGIN || !origin.startsWith("https://")))
  throw new Error("Production requires HTTPS APP_ORIGIN.");
export const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY_HOPS)
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
app.use(
  helmet({
    strictTransportSecurity: false,
    referrerPolicy: { policy: "no-referrer" },
    contentSecurityPolicy: production
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
  }),
);
app.use(express.json({ limit: "3mb" }));
function limit(scope, max, ms) {
  return (req, res, next) => {
    const key = scope + ":" + req.ip;
    const t = Date.now();
    run("DELETE FROM rate_limits WHERE reset_at<?", t);
    const r = one("SELECT * FROM rate_limits WHERE key=?", key);
    if (r && r.count >= max)
      return res.status(429).json({
        error: "Codsiyo badan ayaa dhacay. Fadlan sug oo mar kale isku day.",
      });
    if (r) run("UPDATE rate_limits SET count=count+1 WHERE key=?", key);
    else run("INSERT INTO rate_limits VALUES(?,?,?)", key, 1, t + ms);
    next();
  };
}
app.use("/api", limit("api", 1000, 60000), (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (req.get("origin") !== origin || req.get("x-qaansheeg") !== "1")
      return res.status(403).json({ error: "Codsigan lama oggola." });
  }
  next();
});
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: production,
  path: "/",
  maxAge: 7 * 86400000,
};
const tokenOf = (req) =>
  (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("qsh_session="))
    ?.slice(12);
function session(req, res, next) {
  const token = tokenOf(req);
  const s =
    token &&
    one(
      "SELECT s.*,u.name,u.email,u.language,m.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN business_members m ON m.user_id=s.user_id AND m.business_id=s.business_id WHERE s.hash=? AND s.expires>?",
      hash(token),
      Date.now(),
    );
  if (!s) return res.status(401).json({ error: "Fadlan soo gal." });
  req.auth = s;
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.get("x-csrf-token") !== s.csrf
  )
    return res
      .status(403)
      .json({ error: "Fadhigu wuu isbeddelay. Bogga dib u cusboonaysii." });
  next();
}
function edit(req, res, next) {
  if (req.auth.role === "viewer")
    return res
      .status(403)
      .json({ error: "Waxaad haysataa oggolaansho daawasho oo keliya." });
  next();
}
function owner(req, res, next) {
  if (req.auth.role !== "owner")
    return res
      .status(403)
      .json({ error: "Maamulaha ganacsiga oo keliya ayaa tan samayn kara." });
  next();
}
async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return salt + ":" + key.toString("hex");
}
async function verify(password, stored) {
  const [salt, h] = stored.split(":");
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(key, Buffer.from(h, "hex"));
}
function loginSession(req, res, u, b) {
  const prior = tokenOf(req);
  if (prior) run("DELETE FROM sessions WHERE hash=?", hash(prior));
  run("DELETE FROM sessions WHERE expires<?", Date.now());
  const token = randomBytes(32).toString("base64url"),
    csrf = randomBytes(32).toString("base64url");
  run(
    "INSERT INTO sessions VALUES(?,?,?,?,?)",
    hash(token),
    u,
    b,
    csrf,
    Date.now() + 7 * 86400000,
  );
  res.cookie("qsh_session", token, cookieOptions);
  res.json({ ok: true });
}
app.post("/api/auth/register", limit("auth", 15, 900000), async (req, res) => {
  const d = authSchema.parse(req.body);
  if (!d.name || !d.business) fail("Magacaaga iyo magaca ganacsiga buuxi.");
  if (one("SELECT id FROM users WHERE email=?", d.email))
    fail("Akoonka lama abuuri karo. Haddii aad hore u lahayd, soo gal.", 409);
  const password = await passwordHash(d.password);
  const u = id(),
    b = id();
  transaction(() => {
    run(
      "INSERT INTO users VALUES(?,?,?,?,?)",
      u,
      d.email,
      d.name,
      password,
      "so",
    );
    run("INSERT INTO businesses VALUES(?,?,?)", b, d.business, now());
    run("INSERT INTO business_members VALUES(?,?,?)", u, b, "owner");
    run(
      "INSERT INTO business_settings VALUES(?,?,1)",
      b,
      JSON.stringify(defaultSettings(d.business)),
    );
    if (d.sample) seed(b, d.name);
  });
  loginSession(req, res, u, b);
});
app.post("/api/auth/login", limit("auth", 15, 900000), async (req, res) => {
  const d = authSchema.parse(req.body);
  const u = one("SELECT * FROM users WHERE email=?", d.email);
  const fake = "00000000000000000000000000000000:" + "00".repeat(64);
  const valid = await verify(d.password, u?.password || fake);
  if (!u || !valid) fail("Email-ka ama furaha sirta ahi sax ma aha.", 401);
  const b = one(
    "SELECT business_id FROM business_members WHERE user_id=? ORDER BY rowid LIMIT 1",
    u.id,
  );
  loginSession(req, res, u.id, b.business_id);
});
app.post("/api/auth/logout", session, (req, res) => {
  run("DELETE FROM sessions WHERE hash=?", req.auth.hash);
  res.clearCookie("qsh_session", { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});
app.get("/api/session", session, (req, res) =>
  res.json({
    user: {
      id: req.auth.user_id,
      name: req.auth.name,
      email: req.auth.email,
      language: req.auth.language,
      role: req.auth.role,
    },
    csrf: req.auth.csrf,
    businessId: req.auth.business_id,
    businesses: all(
      "SELECT b.id,b.name,m.role FROM businesses b JOIN business_members m ON m.business_id=b.id WHERE m.user_id=?",
      req.auth.user_id,
    ),
    emailConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_FROM),
  }),
);
app.post("/api/switch-business", session, (req, res) => {
  const b = z.object({ businessId: z.uuid() }).parse(req.body).businessId;
  if (
    !one(
      "SELECT * FROM business_members WHERE user_id=? AND business_id=?",
      req.auth.user_id,
      b,
    )
  )
    fail("Ganacsigan ma geli kartid.", 403);
  run("UPDATE sessions SET business_id=? WHERE hash=?", b, req.auth.hash);
  res.json({ ok: true });
});
app.patch("/api/profile", session, (req, res) => {
  const d = z
    .object({
      name: z.string().trim().min(1).max(100),
      language: z.enum(["so", "en"]),
    })
    .parse(req.body);
  run(
    "UPDATE users SET name=?,language=? WHERE id=?",
    d.name,
    d.language,
    req.auth.user_id,
  );
  res.json({ ok: true });
});
app.get("/api/public/:token", limit("public", 120, 60000), (req, res) => {
  const row = publicInvoice(req.params.token);
  res.json(publicData(row));
});
app.get("/api/public/:token/pdf", limit("pdf", 30, 60000), async (req, res) => {
  const inv = publicInvoice(req.params.token);
  res
    .type("application/pdf")
    .attachment(`${inv.number}.pdf`)
    .send(await pdfBuffer(inv));
});
function publicInvoice(token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    fail("Xiriirkan lama helin ama wuu dhacay.", 404);
  const link = one(
    "SELECT * FROM public_links WHERE token_hash=? AND revoked=0 AND expires>?",
    hash(token),
    Date.now(),
  );
  if (!link) fail("Xiriirkan lama helin ama wuu dhacay.", 404);
  const inv = invoice(link.business_id, link.invoice_id);
  if (inv.state === "cancelled") fail("Qaansheeggan waa la kansalay.", 410);
  return inv;
}
function publicData(inv) {
  const {
    id,
    customerId,
    version,
    createdAt,
    customerSnapshot,
    businessSnapshot,
    ...d
  } = inv;
  return {
    ...d,
    payments: undefined,
    requestKey: undefined,
    items: inv.items.map(({ description, quantity, price }) => ({
      description,
      quantity,
      price,
    })),
    customerSnapshot: {
      name: customerSnapshot.name,
      contact: customerSnapshot.contact,
      address: customerSnapshot.address,
      city: customerSnapshot.city,
      phone: customerSnapshot.phone,
      email: customerSnapshot.email,
    },
    businessSnapshot: {
      name: businessSnapshot.name,
      address: businessSnapshot.address,
      city: businessSnapshot.city,
      country: businessSnapshot.country,
      phone: businessSnapshot.phone,
      email: businessSnapshot.email,
      website: businessSnapshot.website,
      logo: businessSnapshot.logo,
      accent: businessSnapshot.accent,
      style: businessSnapshot.style,
      registration: businessSnapshot.registration,
      taxNumber: businessSnapshot.taxNumber,
      methods: businessSnapshot.methods.filter(
        (m) => m.enabled && inv.paymentMethods.includes(m.name),
      ),
    },
  };
}
app.use("/api", session);
app.get("/api/bootstrap", (req, res) => {
  const b = req.auth.business_id;
  const invoices = listInvoices(b);
  invoices
    .filter((i) => i.status === "overdue")
    .forEach((i) =>
      run(
        "INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,?,?,?)",
        id(),
        b,
        i.id,
        `Qaansheegga ${i.number} wuu daahay.`,
        now(),
        null,
        b + ":overdue:" + i.id,
      ),
    );
  res.json({
    settings: settings(b),
    customers: all("SELECT * FROM customers WHERE business_id=?", b).map(
      (r) => ({
        id: r.id,
        ...JSON.parse(r.data),
        archived: !!r.archived,
        sample: !!r.sample,
      }),
    ),
    products: all("SELECT * FROM products WHERE business_id=?", b).map((r) => ({
      id: r.id,
      ...JSON.parse(r.data),
      sample: !!r.sample,
    })),
    invoices,
    notifications: all(
      "SELECT id,invoice_id,title,created_at,read_at FROM notifications WHERE business_id=? ORDER BY created_at DESC LIMIT 100",
      b,
    ),
    activity: all(
      "SELECT id,invoice_id,actor,action,created_at FROM activity_logs WHERE business_id=? ORDER BY rowid DESC LIMIT 30",
      b,
    ),
  });
});
app.post("/api/customers", edit, (req, res) => {
  const d = customerSchema.parse(req.body);
  const key = id();
  run(
    "INSERT INTO customers VALUES(?,?,?,0,0)",
    key,
    req.auth.business_id,
    JSON.stringify(d),
  );
  log(req.auth.business_id, null, req.auth.name, "Macmiil lagu daray");
  res.status(201).json({ id: key, ...d });
});
app.put("/api/customers/:id", edit, (req, res) => {
  customer(req.auth.business_id, req.params.id);
  const d = customerSchema.parse(req.body);
  run(
    "UPDATE customers SET data=? WHERE id=? AND business_id=?",
    JSON.stringify(d),
    req.params.id,
    req.auth.business_id,
  );
  log(req.auth.business_id, null, req.auth.name, "Macmiil wax laga beddelay");
  res.json({ id: req.params.id, ...d });
});
app.patch("/api/customers/:id/archive", edit, (req, res) => {
  customer(req.auth.business_id, req.params.id);
  const d = z.object({ archived: z.boolean() }).parse(req.body);
  run(
    "UPDATE customers SET archived=? WHERE id=? AND business_id=?",
    d.archived ? 1 : 0,
    req.params.id,
    req.auth.business_id,
  );
  log(
    req.auth.business_id,
    null,
    req.auth.name,
    d.archived ? "Macmiil la kaydiyey" : "Macmiil la soo celiyey",
  );
  res.json({ ok: true });
});
app.delete("/api/customers/:id", edit, (req, res) => {
  const b = req.auth.business_id;
  customer(b, req.params.id);
  if (
    one(
      "SELECT id FROM invoices WHERE customer_id=? AND business_id=?",
      req.params.id,
      b,
    )
  )
    fail(
      "Macmiil qaansheeg leh lama tirtiri karo. Kaydi halkii aad ka tirtiri lahayd.",
      409,
    );
  run("DELETE FROM customers WHERE id=? AND business_id=?", req.params.id, b);
  log(b, null, req.auth.name, "Macmiil la tirtiray");
  res.json({ ok: true });
});
app.post("/api/products", edit, (req, res) => {
  const d = productSchema.parse(req.body),
    key = id();
  run(
    "INSERT INTO products VALUES(?,?,?,0)",
    key,
    req.auth.business_id,
    JSON.stringify(d),
  );
  res.status(201).json({ id: key, ...d });
});
app.put("/api/products/:id", edit, (req, res) => {
  const d = productSchema.parse(req.body);
  if (
    !run(
      "UPDATE products SET data=? WHERE id=? AND business_id=?",
      JSON.stringify(d),
      req.params.id,
      req.auth.business_id,
    ).changes
  )
    fail("Shayga lama helin.", 404);
  res.json({ id: req.params.id, ...d });
});
app.delete("/api/products/:id", edit, (req, res) => {
  if (
    !run(
      "DELETE FROM products WHERE id=? AND business_id=?",
      req.params.id,
      req.auth.business_id,
    ).changes
  )
    fail("Shayga lama helin.", 404);
  res.json({ ok: true });
});
app.post("/api/invoices", edit, (req, res) => {
  const d = invoiceSchema.parse(req.body);
  res
    .status(201)
    .json(
      transaction(() => makeInvoice(req.auth.business_id, d, req.auth.name)),
    );
});
app.get("/api/invoices/:id", (req, res) => {
  const b = req.auth.business_id;
  const inv = invoice(b, req.params.id);
  res.json({
    ...inv,
    activity: all(
      "SELECT id,actor,action,created_at FROM activity_logs WHERE business_id=? AND invoice_id=? ORDER BY rowid DESC",
      b,
      inv.id,
    ),
  });
});
app.put("/api/invoices/:id", edit, (req, res) => {
  const d = invoiceSchema.parse(req.body);
  res.json(
    transaction(() =>
      editInvoice(req.auth.business_id, req.params.id, d, req.auth.name),
    ),
  );
});
app.post("/api/invoices/:id/duplicate", edit, (req, res) => {
  const inv = invoice(req.auth.business_id, req.params.id);
  const d = {
    ...inv,
    requestKey: undefined,
    issue: today(),
    due: new Date(
      Date.now() + settings(req.auth.business_id).dueDays * 86400000,
    )
      .toISOString()
      .slice(0, 10),
  };
  res
    .status(201)
    .json(
      transaction(() => makeInvoice(req.auth.business_id, d, req.auth.name)),
    );
});
app.post("/api/invoices/:id/cancel", edit, (req, res) => {
  const b = req.auth.business_id;
  res.json(
    transaction(() => {
      const inv = invoice(b, req.params.id);
      if (inv.paid > 0)
        fail("Qaansheeg lacag laga bixiyey lama kansali karo.", 409);
      if (inv.state === "cancelled") fail("Horaa loo kansalay.", 409);
      run(
        "UPDATE invoices SET state='cancelled',version=version+1 WHERE id=? AND business_id=?",
        inv.id,
        b,
      );
      run(
        "UPDATE public_links SET revoked=1 WHERE invoice_id=? AND business_id=?",
        inv.id,
        b,
      );
      log(b, inv.id, req.auth.name, "Qaansheeg la kansalay");
      return invoice(b, inv.id);
    }),
  );
});
app.delete("/api/invoices/:id", edit, (req, res) => {
  const b = req.auth.business_id;
  transaction(() => {
    const inv = invoice(b, req.params.id);
    if (inv.state !== "draft" || inv.paid)
      fail("Qaansheeg qabyo ah oo keliya ayaa la tirtiri karaa.", 409);
    run(
      "UPDATE invoices SET deleted=1 WHERE id=? AND business_id=?",
      inv.id,
      b,
    );
    run(
      "UPDATE public_links SET revoked=1 WHERE invoice_id=? AND business_id=?",
      inv.id,
      b,
    );
    log(b, inv.id, req.auth.name, "Qaansheeg la tirtiray");
  });
  res.json({ ok: true });
});
app.get("/api/invoices/:id/pdf", limit("pdf", 30, 60000), async (req, res) => {
  const inv = invoice(req.auth.business_id, req.params.id);
  res
    .type("application/pdf")
    .attachment(`${inv.number}.pdf`)
    .send(await pdfBuffer(inv));
});
app.post("/api/invoices/:id/share", edit, (req, res) =>
  res.json(
    transaction(() =>
      createLink(req.auth.business_id, req.params.id, req.auth.name, origin),
    ),
  ),
);
app.delete("/api/invoices/:id/share", edit, (req, res) => {
  const inv = invoice(req.auth.business_id, req.params.id);
  run(
    "UPDATE public_links SET revoked=1 WHERE invoice_id=? AND business_id=?",
    inv.id,
    req.auth.business_id,
  );
  log(
    req.auth.business_id,
    inv.id,
    req.auth.name,
    "Xiriirrada wadaagista la joojiyey",
  );
  res.json({ ok: true });
});
app.post(
  "/api/invoices/:id/email",
  edit,
  limit("mail", 10, 3600000),
  async (req, res) => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
      fail("Email diristu waxay u baahan tahay dejinta adeegga SMTP.", 503);
    const b = req.auth.business_id,
      inv = invoice(b, req.params.id);
    if (inv.state === "cancelled") fail("Qaansheeggan waa la kansalay.");
    const { email } = z.object({ email: z.email().max(254) }).parse(req.body);
    const token = randomBytes(32).toString("base64url");
    run(
      "INSERT INTO public_links VALUES(?,?,?,?,0)",
      hash(token),
      b,
      inv.id,
      Date.now() + 90 * 86400000,
    );
    try {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_PORT === "465",
        requireTLS: process.env.SMTP_PORT !== "465",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
        connectionTimeout: 10000,
        socketTimeout: 20000,
      });
      const result = await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: `Qaansheeg ${inv.number} · ${inv.businessSnapshot.name}`,
        text: `Asc, waxaan kuu soo dirnay qaansheegga ${inv.number}. Wadarta waa ${formatMoney(inv.total, inv.currency)}. Waxaad ka arki kartaa halkan: ${origin}/q/${token}`,
        attachments: [
          { filename: inv.number + ".pdf", content: await pdfBuffer(inv) },
        ],
      });
      if (!result.accepted?.length) throw new Error("Not accepted");
      transaction(() => {
        run(
          "UPDATE invoices SET state='sent',version=version+1 WHERE id=? AND business_id=?",
          inv.id,
          b,
        );
        log(b, inv.id, req.auth.name, "Email loo gudbiyey adeegga dirista");
      });
      res.json({ ok: true });
    } catch {
      run("UPDATE public_links SET revoked=1 WHERE token_hash=?", hash(token));
      fail("Email-ka lama diri karin. Hubi adeegga oo mar kale isku day.", 502);
    }
  },
);
app.post("/api/invoices/:id/payments", edit, (req, res) => {
  const d = paymentSchema.parse(req.body),
    b = req.auth.business_id;
  res.json(
    transaction(() => {
      const inv = invoice(b, req.params.id);
      const prior = one(
        "SELECT * FROM payments WHERE business_id=? AND idempotency_key=?",
        b,
        d.idempotencyKey,
      );
      if (prior) {
        if (prior.invoice_id !== inv.id)
          fail("Aqoonsigan lacag-bixinta hore ayaa loo isticmaalay.", 409);
        return invoice(b, inv.id);
      }
      if (inv.state === "cancelled" || inv.status === "paid")
        fail("Qaansheeggan lacag laguma dari karo.", 409);
      const amount = new Decimal(d.amount).mul(100);
      if (!amount.isInteger() || amount.gt(inv.balance) || !amount.isPositive())
        fail("Qiimuhu waa inuu sax yahay oo uusan ka badnayn hadhaaga.");
      if (!settings(b).methods.some((m) => m.enabled && m.name === d.method))
        fail("Habkan lacag-bixinta lama hawlgelin.");
      run(
        "INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?)",
        id(),
        b,
        inv.id,
        amount.toNumber(),
        d.date,
        d.method,
        d.reference,
        d.notes,
        d.idempotencyKey,
        now(),
      );
      run(
        "UPDATE invoices SET state='sent',version=version+1 WHERE id=? AND business_id=?",
        inv.id,
        b,
      );
      log(
        b,
        inv.id,
        req.auth.name,
        `Lacag la diiwaangeliyey: ${formatMoney(amount.toNumber(), inv.currency)}`,
      );
      run(
        "INSERT INTO notifications VALUES(?,?,?,?,?,?,?)",
        id(),
        b,
        inv.id,
        `Lacag la helay · ${inv.number}`,
        now(),
        null,
        null,
      );
      return invoice(b, inv.id);
    }),
  );
});
app.patch("/api/notifications/:id/read", (req, res) => {
  run(
    "UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND business_id=?",
    now(),
    req.params.id,
    req.auth.business_id,
  );
  res.json({ ok: true });
});
app.put("/api/settings", owner, (req, res) => {
  const d = settingsSchema.parse(req.body),
    b = req.auth.business_id;
  const current = settings(b);
  if (d.nextSequence < current.nextSequence)
    fail("Lambarka xiga dib looma celin karo.");
  transaction(() => {
    run(
      "UPDATE business_settings SET data=?,next_sequence=? WHERE business_id=?",
      JSON.stringify({ ...d, logo: current.logo }),
      d.nextSequence,
      b,
    );
    run("UPDATE businesses SET name=? WHERE id=?", d.name, b);
    log(b, null, req.auth.name, "Dejinta ganacsiga la beddelay");
  });
  res.json(settings(b));
});
app.post("/api/settings/logo", owner, async (req, res) => {
  const { image } = z
    .object({ image: z.string().max(2800000) })
    .parse(req.body);
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(image))
    fail("Isticmaal PNG, JPEG ama WebP. SVG lama oggola.");
  let result;
  try {
    result = await sharp(Buffer.from(image.split(",")[1], "base64"), {
      limitInputPixels: 16000000,
    })
      .rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    fail("Sawirkan lama akhrin karo.");
  }
  const b = req.auth.business_id,
    s = settings(b);
  s.logo = "data:image/png;base64," + result.toString("base64");
  run(
    "UPDATE business_settings SET data=? WHERE business_id=?",
    JSON.stringify(s),
    b,
  );
  log(b, null, req.auth.name, "Astaanta ganacsiga la beddelay");
  res.json({ logo: s.logo });
});
app.delete("/api/settings/logo", owner, (req, res) => {
  const b = req.auth.business_id,
    s = settings(b);
  s.logo = "";
  run(
    "UPDATE business_settings SET data=? WHERE business_id=?",
    JSON.stringify(s),
    b,
  );
  res.json({ ok: true });
});
app.get("/api/members", owner, (req, res) =>
  res.json(
    all(
      "SELECT u.id,u.email,u.name,m.role FROM users u JOIN business_members m ON m.user_id=u.id WHERE m.business_id=?",
      req.auth.business_id,
    ),
  ),
);
app.post("/api/members", owner, (req, res) => {
  const d = z
    .object({ email: z.email(), role: z.enum(["editor", "viewer"]) })
    .parse(req.body);
  const u = one("SELECT id FROM users WHERE email=?", d.email.toLowerCase());
  if (!u) fail("Qofkani waa inuu marka hore samaystaa akoon.");
  if (u.id === req.auth.user_id)
    fail("Oggolaanshahaaga sidan laguma beddeli karo.");
  run(
    "INSERT INTO business_members VALUES(?,?,?) ON CONFLICT(user_id,business_id) DO UPDATE SET role=excluded.role",
    u.id,
    req.auth.business_id,
    d.role,
  );
  log(
    req.auth.business_id,
    null,
    req.auth.name,
    "Xubin iyo oggolaansho la dejiyey",
  );
  res.json({ ok: true });
});
app.delete("/api/members/:id", owner, (req, res) => {
  if (req.params.id === req.auth.user_id) fail("Maamuluhu isma saari karo.");
  transaction(() => {
    run(
      "DELETE FROM business_members WHERE user_id=? AND business_id=? AND role!='owner'",
      req.params.id,
      req.auth.business_id,
    );
    run(
      "DELETE FROM sessions WHERE user_id=? AND business_id=?",
      req.params.id,
      req.auth.business_id,
    );
    log(req.auth.business_id, null, req.auth.name, "Xubin laga saaray");
  });
  res.json({ ok: true });
});
app.post("/api/sample", owner, (req, res) => {
  transaction(() => seed(req.auth.business_id, req.auth.name));
  res.json({ ok: true });
});
app.delete("/api/sample", owner, (req, res) => {
  const b = req.auth.business_id;
  transaction(() => {
    const ids = all(
      "SELECT id FROM invoices WHERE business_id=? AND sample=1",
      b,
    );
    for (const { id: key } of ids) {
      run(
        "DELETE FROM public_links WHERE business_id=? AND invoice_id=?",
        b,
        key,
      );
      run(
        "DELETE FROM notifications WHERE business_id=? AND invoice_id=?",
        b,
        key,
      );
      run("DELETE FROM payments WHERE business_id=? AND invoice_id=?", b, key);
      run(
        "DELETE FROM invoice_requests WHERE business_id=? AND invoice_id=?",
        b,
        key,
      );
      run("DELETE FROM invoice_items WHERE invoice_id=?", key);
      run(
        "DELETE FROM activity_logs WHERE business_id=? AND invoice_id=?",
        b,
        key,
      );
      run("DELETE FROM invoices WHERE id=? AND business_id=?", key, b);
    }
    run("DELETE FROM products WHERE business_id=? AND sample=1", b);
    run(
      "DELETE FROM customers WHERE business_id=? AND sample=1 AND id NOT IN (SELECT customer_id FROM invoices WHERE business_id=?)",
      b,
      b,
    );
    log(b, null, req.auth.name, "Xogta tusaalaha ah la saaray");
  });
  res.json({ ok: true });
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Boggan lama helin." }),
);
app.use(express.static(path.resolve("dist"), { index: false }));
app.get("/{*path}", (req, res) =>
  res.sendFile(path.resolve("dist/index.html")),
);
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError)
    return res.status(422).json({
      error: err.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(" · "),
    });
  const status =
    err.status || (String(err.code).includes("SQLITE_CONSTRAINT") ? 409 : 500);
  if (status >= 500)
    console.error("Request failed", {
      method: req.method,
      code: err.code || err.name,
    });
  res.status(status).json({
    error:
      status === 500
        ? "Waxbaa qaldamay. Xogtaadu way kuu taallaa; mar kale isku day."
        : status === 409 && !err.status
          ? "Xogtan hore ayaa loo kaydiyey."
          : err.message,
  });
});
