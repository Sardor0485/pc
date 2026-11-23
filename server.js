"use strict";
const express = require("express"), crypto = require("crypto"), path = require("path"), fs = require("fs");
const { Pool, types } = require("pg");
types.setTypeParser(1700, parseFloat); // NUMERIC -> number
types.setTypeParser(20, v => parseInt(v, 10)); // BIGINT -> number

process.on("unhandledRejection", e => console.error("unhandled:", e));
const PORT = process.env.PORT || 3000;
const PASS = process.env.APP_PASSWORD || "";
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL o‘rnatilmagan"); process.exit(1); }

const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: local || process.env.PGSSL === "off" ? false : { rejectUnauthorized: false },
  max: 5
});

// jadval: [ustun, postgres turi]; birinchisi doim id
const S = {
  products: [["id","text"],["type","text"],["model","text"],["color","text"],["size","numeric"],["wt","numeric"],["qty","numeric"],["cost","numeric"],["price","numeric"],["joy","text"]],
  clients:  [["id","text"],["name","text"],["phone","text"],["tg","text"]],
  orders:   [["id","text"],["cid","text"],["pid","text"],["qty","numeric"],["price","numeric"],["cost","numeric"],["total","numeric"],["paid","numeric"],["st","int"],["at","bigint"]],
  payments: [["id","text"],["at","bigint"],["cid","text"],["oid","text"],["amt","numeric"],["note","text"]],
  expenses: [["id","text"],["at","bigint"],["cat","text"],["amt","numeric"],["note","text"]],
  ins:      [["id","text"],["at","bigint"],["pid","text"],["qty","numeric"],["cost","numeric"]],
  msgs:     [["id","text"],["oid","text"],["at","bigint"],["txt","text"],["auto","boolean"]]
};
const ORDER = { products: "seq", clients: "seq", orders: "at, id", payments: "at, id", expenses: "at, id", ins: "at, id", msgs: "at, id" };
const Q = n => '"' + n + '"';

/* ---------- auth ---------- */
const st = { pw: "", tg: process.env.TELEGRAM_BOT_TOKEN || "" };
const scr = (p, salt) => crypto.scryptSync(String(p), salt, 32).toString("hex");
const mkPw = p => { const sl = crypto.randomBytes(16).toString("hex"); return sl + ":" + scr(p, sl); };
const chkPw = p => {
  if (st.pw) { const [sl, h] = st.pw.split(":"); return crypto.timingSafeEqual(Buffer.from(scr(p, sl)), Buffer.from(h)); }
  return !!PASS && crypto.timingSafeEqual(sha(p), sha(PASS));
};
const sha = s => crypto.createHash("sha256").update(String(s)).digest();
const sign = exp => exp + "." + crypto.createHmac("sha256", SECRET + st.pw).update(String(exp)).digest("hex");
function valid(tok) {
  if (!tok) return false;
  const [exp, mac] = tok.split(".");
  if (!exp || !mac || +exp < Date.now()) return false;
  const good = sign(exp).split(".")[1];
  return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good));
}
const issue = (req, res) => {
  const age = 30 * 86400;
  res.setHeader("Set-Cookie", `ba=${sign(Date.now() + age * 1000)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${req.secure ? "; Secure" : ""}`);
};
const setMeta = (k, v) => pool.query("INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [k, v]);
const cookie = req => { const m = /(?:^|;\s*)ba=([^;]+)/.exec(req.headers.cookie || ""); return m && m[1]; };
const auth = (req, res, next) => valid(cookie(req)) ? next() : res.status(401).json({ error: "auth" });
const tries = new Map();
const w = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---------- app ---------- */
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "30mb" }));

app.get("/health", async (_q, res) => {
  try { await pool.query("SELECT 1"); res.send("ok"); } catch (e) { res.status(500).send("db"); }
});

app.post("/api/login", (req, res) => {
  if (!st.pw && !PASS) return res.status(409).json({ setup: true });
  const ip = req.ip, now = Date.now(), t = (tries.get(ip) || []).filter(x => now - x < 60000);
  if (t.length >= 5) return res.status(429).json({ error: "ko‘p urinish" });
  const ok = chkPw((req.body || {}).password || "");
  if (!ok) { t.push(now); tries.set(ip, t); return res.status(401).json({ error: "parol" }); }
  tries.delete(ip);
  issue(req, res);
  res.json({ ok: true });
});
app.post("/api/logout", (_q, res) => { res.setHeader("Set-Cookie", "ba=; HttpOnly; Path=/; Max-Age=0"); res.json({ ok: true }); });

app.get("/api/status", (_q, res) => res.json({ setup: !st.pw && !PASS }));
app.post("/api/setup", w(async (req, res) => {
  if (st.pw || PASS) return res.status(403).json({ error: "Parol allaqachon o‘rnatilgan" });
  const p = String((req.body || {}).password || "");
  if (p.length < 6) return res.status(400).json({ error: "Kamida 6 belgi" });
  st.pw = mkPw(p);
  await setMeta("pw_hash", st.pw);
  issue(req, res);
  res.json({ ok: true });
}));

app.use("/api", auth);

app.get("/api/settings", (_q, res) => res.json({ tg: !!st.tg }));
app.put("/api/settings", w(async (req, res) => {
  const { tgToken, oldPassword, newPassword } = req.body || {};
  if (newPassword) {
    if (String(newPassword).length < 6) return res.status(400).json({ error: "Yangi parol kamida 6 belgi" });
    if (!chkPw(oldPassword || "")) return res.status(403).json({ error: "Hozirgi parol noto‘g‘ri" });
  }
  if (typeof tgToken === "string" && tgToken.trim()) {
    if (!/^\d+:[\w-]{20,}$/.test(tgToken.trim())) return res.status(400).json({ error: "Token formati noto‘g‘ri" });
    st.tg = tgToken.trim();
    await setMeta("tg_token", st.tg);
  }
  if (newPassword) { st.pw = mkPw(newPassword); await setMeta("pw_hash", st.pw); issue(req, res); }
  res.json({ ok: true, tg: !!st.tg });
}));

app.get("/api/ver", w(async (_q, res) => {
  const r = await pool.query("SELECT value FROM meta WHERE key='ver'");
  res.json({ ver: +r.rows[0].value });
}));

app.get("/api/state", async (_q, res) => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const ver = +(await c.query("SELECT value FROM meta WHERE key='ver'")).rows[0].value, data = {};
    for (const t of Object.keys(S)) {
      const extra = t === "products" ? ",img_v,(img<>'') AS has" : "";
      const r = await c.query(`SELECT ${S[t].map(x => Q(x[0])).join(",")}${extra} FROM ${t} ORDER BY ${ORDER[t]}`);
      data[t] = r.rows.map(row => {
        if (t === "products") { row.img = row.has ? `/api/img/${row.id}?v=${row.img_v}` : ""; delete row.has; delete row.img_v; }
        if (t === "msgs") delete row.id;
        return row;
      });
    }
    await c.query("COMMIT");
    res.set("Cache-Control", "no-store").json({ ver, data });
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); console.error(e); res.status(500).json({ error: "db" }); }
  finally { c.release(); }
});

app.put("/api/state", async (req, res) => {
  const { ver, data } = req.body || {};
  if (!data || typeof data !== "object") return res.status(400).json({ error: "data" });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const cv = +(await c.query("SELECT value FROM meta WHERE key='ver' FOR UPDATE")).rows[0].value;
    if (ver !== cv) { await c.query("ROLLBACK"); return res.status(409).json({ ver: cv }); }
    for (const t of Object.keys(S)) {
      if (!Array.isArray(data[t])) continue;
      const cols = S[t], seen = new Map();
      for (const r0 of data[t]) {
        const r = { ...r0 };
        if (t === "msgs") r.id = r.oid + "_" + r.at;
        if (r.id == null) continue;
        for (const [n, ty] of cols) if ((ty === "bigint" || ty === "int") && r[n] != null) r[n] = Math.round(+r[n]);
        seen.set(String(r.id), r);
      }
      const rows = JSON.stringify([...seen.values()]);
      const names = cols.map(x => Q(x[0])).join(",");
      const def = cols.map(x => Q(x[0]) + " " + x[1]).join(",");
      const upd = cols.slice(1).map(x => `${Q(x[0])}=EXCLUDED.${Q(x[0])}`).join(",");
      await c.query(`INSERT INTO ${t} (${names}) SELECT ${names} FROM jsonb_to_recordset($1::jsonb) AS x(${def}) ON CONFLICT (id) DO UPDATE SET ${upd}`, [rows]);
      await c.query(`DELETE FROM ${t} WHERE id NOT IN (SELECT id FROM jsonb_to_recordset($1::jsonb) AS x(id text))`, [rows]);
    }
    const imgs = {};
    for (const p of Array.isArray(data.products) ? data.products : []) {
      if (typeof p.img === "string" && p.img.startsWith("data:image/") && p.img.length < 2e6) {
        const v = Date.now();
        await c.query("UPDATE products SET img=$2, img_v=$3 WHERE id=$1", [p.id, p.img, v]);
        imgs[p.id] = `/api/img/${p.id}?v=${v}`;
      } else if (!p.img) await c.query("UPDATE products SET img='', img_v=0 WHERE id=$1 AND img<>''", [p.id]);
    }
    const nv = cv + 1;
    await c.query("UPDATE meta SET value=$1 WHERE key='ver'", [String(nv)]);
    await c.query("COMMIT");
    res.json({ ver: nv, imgs });
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); console.error(e); res.status(500).json({ error: "db" }); }
  finally { c.release(); }
});

app.get("/api/img/:id", w(async (req, res) => {
  const r = await pool.query("SELECT img FROM products WHERE id=$1", [req.params.id]);
  const m = r.rows[0] && /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(r.rows[0].img);
  if (!m) return res.status(404).end();
  res.set({ "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" }).send(Buffer.from(m[2], "base64"));
}));

// zakaz tayyor xabari: Telegram bot tokeni faqat serverda saqlanadi
app.post("/api/notify", async (req, res) => {
  const tk = st.tg, { chat_id, text } = req.body || {};
  if (!tk) return res.json({ ok: false, error: "bot tokeni kiritilmagan" });
  if (!/^-?\d+$/.test(String(chat_id || "")) || !text) return res.status(400).json({ ok: false });
  try {
    const r = await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text: String(text).slice(0, 3500) })
    });
    res.json({ ok: (await r.json()).ok === true });
  } catch (e) { res.json({ ok: false }); }
});

app.use(express.static(path.join(__dirname, "public")));
app.use((err, _q, res, _n) => { console.error(err); res.status(500).json({ error: "server" }); });

(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  for (const row of (await pool.query("SELECT key, value FROM meta WHERE key IN ('pw_hash','tg_token')")).rows) {
    if (row.key === "pw_hash") st.pw = row.value; else st.tg = row.value;
  }
  if (!st.pw && !PASS) console.log("Parol o‘rnatilmagan: birinchi kirishda o‘rnating");
  app.listen(PORT, () => console.log("biznes_analitica :" + PORT));
})().catch(e => { console.error(e); process.exit(1); });
