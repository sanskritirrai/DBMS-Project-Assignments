/**
 * Cloudflare Worker API for the Pharmacy Inventory & Prescription app.
 *
 * This is the deployed backend. It implements the same JSON API as the local
 * FastAPI service in `backend/app/main.py`, but runs on Cloudflare Workers and
 * stores data in a D1 (SQLite) database bound as `env.DB`, because serverless
 * hosts cannot run a Python process or a MySQL server.
 *
 * The React build in `frontend/dist` is served from the same origin through
 * `env.ASSETS`, so the browser talks to `/api` on one domain.
 */

const API_PREFIX = '/api'
const DEFAULT_TOKEN_MINUTES = 480
// Cloudflare's WebCrypto rejects PBKDF2 iteration counts above 100000.
const PBKDF2_ITERATIONS = 100000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  category TEXT,
  strength TEXT,
  dosage_form TEXT,
  requires_prescription INTEGER NOT NULL DEFAULT 0,
  manufacturer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 20,
  purchase_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  expiry_date TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  doctor_name TEXT NOT NULL,
  prescription_date TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  quantity INTEGER NOT NULL,
  instructions TEXT
);
`

const SUPPLIERS = [
  [1, 'Sharma Medical Distributors', 'Rohit Sharma', '9876543210', 'Jaipur'],
  [2, 'Aarogya Pharma Wholesale', 'Priya Mehta', '9876501234', 'Delhi'],
  [3, 'Bharat Medicos Supply', 'Amit Verma', '9810012345', 'Gurugram'],
]

const CUSTOMERS = [
  [1, 'Aarav Sharma', '9876543211', 'aarav@example.in', 'Jaipur'],
  [2, 'Ananya Gupta', '9876543212', 'ananya@example.in', 'Delhi'],
  [3, 'Rohan Mehta', '9876543213', 'rohan@example.in', 'Alwar'],
  [4, 'Priya Singh', '9876543214', 'priya@example.in', 'Gurugram'],
  [5, 'Ishita Verma', '9876543215', 'ishita@example.in', 'Jaipur'],
]

const MEDICINES = [
  [1, 'Dolo 650', 'Paracetamol', 'Analgesic / Antipyretic', '650 mg', 'Tablet', 0, 'Micro Labs'],
  [2, 'Crocin 500', 'Paracetamol', 'Analgesic / Antipyretic', '500 mg', 'Tablet', 0, 'Haleon'],
  [3, 'Cetirizine 10', 'Cetirizine', 'Antihistamine', '10 mg', 'Tablet', 0, 'Generic'],
  [4, 'ORS Powder', 'Oral Rehydration Salts', 'Electrolyte', 'WHO formula', 'Sachet', 0, 'Generic'],
  [5, 'Pantoprazole 40', 'Pantoprazole', 'Gastrointestinal', '40 mg', 'Tablet', 1, 'Generic'],
  [6, 'Amoxicillin 500', 'Amoxicillin', 'Antibiotic', '500 mg', 'Capsule', 1, 'Generic'],
  [7, 'Azithromycin 500', 'Azithromycin', 'Antibiotic', '500 mg', 'Tablet', 1, 'Generic'],
  [8, 'Metformin 500', 'Metformin', 'Antidiabetic', '500 mg', 'Tablet', 1, 'Generic'],
  [9, 'Amlodipine 5', 'Amlodipine', 'Antihypertensive', '5 mg', 'Tablet', 1, 'Generic'],
  [10, 'Vitamin C 500', 'Ascorbic Acid', 'Vitamin / Supplement', '500 mg', 'Tablet', 0, 'Generic'],
  [11, 'Ibuprofen 400', 'Ibuprofen', 'NSAID', '400 mg', 'Tablet', 1, 'Generic'],
  [12, 'Levocetirizine 5', 'Levocetirizine', 'Antihistamine', '5 mg', 'Tablet', 1, 'Generic'],
]

const INVENTORY = [
  [1, 1, 1, 'DL650-2401', 140, 30, 1.8, 2.5, '2027-12-31'],
  [2, 2, 1, 'CR500-2402', 85, 25, 1.2, 1.8, '2027-10-31'],
  [3, 3, 2, 'CTZ10-2403', 18, 25, 1.0, 1.5, '2027-08-31'],
  [4, 4, 3, 'ORS-2404', 60, 20, 12.0, 18.0, '2027-11-30'],
  [5, 5, 2, 'PNT40-2405', 42, 20, 4.5, 6.0, '2027-09-30'],
  [6, 6, 3, 'AMX500-2406', 24, 20, 5.0, 7.0, '2027-06-30'],
  [7, 7, 1, 'AZT500-2407', 12, 20, 8.0, 11.0, '2027-07-31'],
  [8, 8, 2, 'MET500-2408', 100, 25, 2.0, 3.0, '2028-01-31'],
  [9, 9, 2, 'AML5-2409', 75, 20, 1.5, 2.2, '2027-12-31'],
  [10, 10, 1, 'VTC500-2410', 55, 20, 2.0, 3.0, '2027-10-31'],
  [11, 11, 3, 'IBU400-2411', 9, 20, 2.5, 3.5, '2027-05-31'],
  [12, 12, 1, 'LVC5-2412', 31, 15, 2.0, 3.0, '2027-09-30'],
]

const PRESCRIPTIONS = [
  [1, 'RX-2026-001', 1, 'Dr. Neha Kapoor', '2026-10-20', 'Demo record only', 'pending'],
  [2, 'RX-2026-002', 2, 'Dr. Arjun Rao', '2026-10-19', 'Demo record only', 'dispensed'],
]

const PRESCRIPTION_ITEMS = [
  [1, 1, 5, 10, 'As written on the original prescription'],
  [2, 2, 8, 30, 'As written on the original prescription'],
]

/* ------------------------------------------------------------------ helpers */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function error(status, detail) {
  return json({ detail }, status)
}

function toB64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

/* ------------------------------------------------------------- credentials */

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      base,
      256,
    ),
  )
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await deriveKey(password, salt)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64Url(salt)}$${toB64Url(derived)}`
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const salt = fromB64Url(parts[2])
  const expected = fromB64Url(parts[3])
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, 256),
  )
  return constantTimeEqual(derived, expected)
}

function secretOf(env) {
  return env.SECRET_KEY || 'dev-only-change-this-secret'
}

async function hmacKey(env) {
  return crypto.subtle.importKey('raw', encoder.encode(secretOf(env)), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

async function createToken(user, env) {
  const minutes = Number(env.ACCESS_TOKEN_MINUTES || DEFAULT_TOKEN_MINUTES) || DEFAULT_TOKEN_MINUTES
  const header = toB64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload = toB64Url(
    encoder.encode(
      JSON.stringify({
        sub: String(user.id),
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + minutes * 60,
      }),
    ),
  )
  const body = `${header}.${payload}`
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env), encoder.encode(body))
  return `${body}.${toB64Url(new Uint8Array(signature))}`
}

async function readToken(token, env) {
  const parts = String(token).split('.')
  if (parts.length !== 3) return null
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(env),
    fromB64Url(parts[2]),
    encoder.encode(`${parts[0]}.${parts[1]}`),
  )
  if (!valid) return null
  let payload
  try {
    payload = JSON.parse(decoder.decode(fromB64Url(parts[1])))
  } catch {
    return null
  }
  if (!payload || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

/* ------------------------------------------------------------ schema + seed */

let schemaReady = null

function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = initialise(env).catch((err) => {
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}

async function count(env, table) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first()
  return row ? Number(row.total) : 0
}

async function initialise(env) {
  // Run the schema one statement at a time: D1's multi-statement ``exec`` is
  // not supported everywhere, ``batch`` is.
  await env.DB.batch(
    SCHEMA_SQL.split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => env.DB.prepare(statement)),
  )

  const admin = await env.DB.prepare('SELECT id, full_name FROM users WHERE lower(email) = ?')
    .bind('admin@shreepharmacy.in')
    .first()

  if (!admin) {
    await env.DB.prepare(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    )
      .bind('Bhavya Shany', 'admin@shreepharmacy.in', await hashPassword('Admin@123'), 'admin')
      .run()
  } else if (admin.full_name === 'User') {
    await env.DB.prepare('UPDATE users SET full_name = ? WHERE id = ?').bind('Bhavya Shany', admin.id).run()
  }

  const statements = []

  if ((await count(env, 'suppliers')) === 0) {
    for (const row of SUPPLIERS) {
      statements.push(
        env.DB.prepare('INSERT INTO suppliers (id, name, contact_person, phone, city) VALUES (?, ?, ?, ?, ?)').bind(...row),
      )
    }
  }

  if ((await count(env, 'customers')) === 0) {
    for (const row of CUSTOMERS) {
      statements.push(
        env.DB.prepare('INSERT INTO customers (id, full_name, phone, email, city) VALUES (?, ?, ?, ?, ?)').bind(...row),
      )
    }
  }

  if ((await count(env, 'medicines')) === 0) {
    for (const row of MEDICINES) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO medicines (id, name, generic_name, category, strength, dosage_form, requires_prescription, manufacturer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).bind(...row),
      )
    }
  }

  if ((await count(env, 'inventory')) === 0) {
    for (const row of INVENTORY) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO inventory (id, medicine_id, supplier_id, batch_number, quantity, reorder_level, purchase_price, selling_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).bind(...row),
      )
    }
  }

  if ((await count(env, 'prescriptions')) === 0) {
    for (const row of PRESCRIPTIONS) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO prescriptions (id, prescription_number, customer_id, doctor_name, prescription_date, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(...row),
      )
    }
  }

  if ((await count(env, 'prescription_items')) === 0) {
    for (const row of PRESCRIPTION_ITEMS) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO prescription_items (id, prescription_id, medicine_id, quantity, instructions) VALUES (?, ?, ?, ?, ?)',
        ).bind(...row),
      )
    }
  }

  if (statements.length) await env.DB.batch(statements)
}

/* ------------------------------------------------------------------ queries */

function medicineRow(row) {
  return {
    id: row.id,
    name: row.name,
    generic_name: row.generic_name,
    category: row.category,
    strength: row.strength,
    dosage_form: row.dosage_form,
    requires_prescription: Boolean(row.requires_prescription),
    manufacturer: row.manufacturer,
  }
}

async function currentUser(request, env) {
  const header = request.headers.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const payload = await readToken(match[1].trim(), env)
  if (!payload) return null
  const user = await env.DB.prepare('SELECT id, full_name, email, role FROM users WHERE id = ?')
    .bind(Number(payload.sub))
    .first()
  return user || null
}

async function readJson(request) {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

function text(value) {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

function integer(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

function decimal(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/* ----------------------------------------------------------------- handlers */

async function login(request, env) {
  const body = await readJson(request)
  const email = text(body.email)
  const password = body.password == null ? '' : String(body.password)
  if (!email || !password) return error(422, 'Email and password are required')

  const user = await env.DB.prepare('SELECT * FROM users WHERE lower(email) = ?').bind(email.toLowerCase()).first()
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return error(401, 'Incorrect email or password')
  }

  return json({
    access_token: await createToken(user, env),
    token_type: 'bearer',
    user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
  })
}

async function dashboard(env) {
  const summary = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM medicines) AS medicine_count,
       (SELECT COALESCE(SUM(quantity), 0) FROM inventory) AS total_units,
       (SELECT COUNT(*) FROM inventory WHERE quantity <= reorder_level) AS low_stock_batches,
       (SELECT COUNT(*) FROM prescriptions WHERE status = 'pending') AS pending_prescriptions,
       (SELECT COUNT(*) FROM inventory WHERE expiry_date <= date('now')) AS expired_batches`,
  ).first()

  return json({
    medicine_count: Number(summary.medicine_count || 0),
    total_units: Number(summary.total_units || 0),
    low_stock_batches: Number(summary.low_stock_batches || 0),
    pending_prescriptions: Number(summary.pending_prescriptions || 0),
    expired_batches: Number(summary.expired_batches || 0),
  })
}

async function listMedicines(url, env) {
  const search = (url.searchParams.get('search') || '').trim().toLowerCase()
  let query = 'SELECT * FROM medicines'
  const bindings = []
  if (search) {
    query += ' WHERE lower(name) LIKE ? OR lower(generic_name) LIKE ? OR lower(category) LIKE ?'
    const like = `%${search}%`
    bindings.push(like, like, like)
  }
  query += ' ORDER BY name'
  const { results } = await env.DB.prepare(query).bind(...bindings).all()
  return json((results || []).map(medicineRow))
}

async function addMedicine(request, env) {
  const body = await readJson(request)
  const name = text(body.name)
  const genericName = text(body.generic_name)
  if (!name) return error(422, 'name: field required')
  if (!genericName) return error(422, 'generic_name: field required')

  const result = await env.DB.prepare(
    `INSERT INTO medicines (name, generic_name, category, strength, dosage_form, requires_prescription, manufacturer)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      name,
      genericName,
      text(body.category),
      text(body.strength),
      text(body.dosage_form),
      body.requires_prescription ? 1 : 0,
      text(body.manufacturer),
    )
    .run()

  const row = await env.DB.prepare('SELECT * FROM medicines WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first()
  return json(medicineRow(row), 201)
}

async function updateMedicine(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM medicines WHERE id = ?').bind(id).first()
  if (!existing) return error(404, 'Medicine not found')

  const body = await readJson(request)
  const fields = []
  const bindings = []
  const mapping = {
    name: (value) => text(value),
    generic_name: (value) => text(value),
    category: (value) => text(value),
    strength: (value) => text(value),
    dosage_form: (value) => text(value),
    manufacturer: (value) => text(value),
  }
  for (const [column, coerce] of Object.entries(mapping)) {
    if (column in body) {
      const value = coerce(body[column])
      if ((column === 'name' || column === 'generic_name') && !value) {
        return error(422, `${column}: field required`)
      }
      fields.push(`${column} = ?`)
      bindings.push(value)
    }
  }
  if ('requires_prescription' in body) {
    fields.push('requires_prescription = ?')
    bindings.push(body.requires_prescription ? 1 : 0)
  }
  if (!fields.length) return json(medicineRow(existing))

  bindings.push(id)
  await env.DB.prepare(`UPDATE medicines SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run()
  const row = await env.DB.prepare('SELECT * FROM medicines WHERE id = ?').bind(id).first()
  return json(medicineRow(row))
}

async function listInventory(url, env) {
  const search = (url.searchParams.get('search') || '').trim().toLowerCase()
  let query = `SELECT i.id, i.medicine_id, m.name AS medicine_name, m.generic_name, m.strength,
                      i.batch_number, i.quantity, i.reorder_level, i.selling_price, i.expiry_date
               FROM inventory i JOIN medicines m ON m.id = i.medicine_id`
  const bindings = []
  if (search) {
    query += ' WHERE lower(m.name) LIKE ? OR lower(i.batch_number) LIKE ?'
    const like = `%${search}%`
    bindings.push(like, like)
  }
  query += ' ORDER BY i.expiry_date'
  const { results } = await env.DB.prepare(query).bind(...bindings).all()
  return json(
    (results || []).map((row) => ({
      id: row.id,
      medicine_id: row.medicine_id,
      medicine_name: row.medicine_name,
      generic_name: row.generic_name,
      strength: row.strength,
      batch_number: row.batch_number,
      quantity: row.quantity,
      reorder_level: row.reorder_level,
      selling_price: Number(row.selling_price),
      expiry_date: row.expiry_date,
    })),
  )
}

async function addInventory(request, env) {
  const body = await readJson(request)
  const medicineId = integer(body.medicine_id)
  const quantity = integer(body.quantity, 0)
  const batchNumber = text(body.batch_number)
  const expiryDate = text(body.expiry_date)

  if (!medicineId) return error(422, 'medicine_id: field required')
  if (!batchNumber) return error(422, 'batch_number: field required')
  if (!expiryDate) return error(422, 'expiry_date: field required')

  if (quantity <= 0) return json({ id: null, message: 'Batch with 0 quantity not added' })

  const medicine = await env.DB.prepare('SELECT id FROM medicines WHERE id = ?').bind(medicineId).first()
  if (!medicine) return error(404, 'Medicine not found')

  const result = await env.DB.prepare(
    `INSERT INTO inventory (medicine_id, supplier_id, batch_number, quantity, reorder_level, purchase_price, selling_price, expiry_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      medicineId,
      integer(body.supplier_id),
      batchNumber,
      quantity,
      integer(body.reorder_level, 20),
      decimal(body.purchase_price),
      decimal(body.selling_price),
      expiryDate,
    )
    .run()

  return json({ id: result.meta.last_row_id, message: 'Inventory batch added' }, 201)
}

async function updateInventory(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM inventory WHERE id = ?').bind(id).first()
  if (!existing) return error(404, 'Inventory batch not found')

  const body = await readJson(request)
  const quantity = 'quantity' in body ? integer(body.quantity) : null
  if (quantity !== null && quantity <= 0) {
    await env.DB.prepare('DELETE FROM inventory WHERE id = ?').bind(id).run()
    return json({ id, message: 'Inventory batch deleted (quantity reached 0)' })
  }

  const fields = []
  const bindings = []
  if (quantity !== null) {
    fields.push('quantity = ?')
    bindings.push(quantity)
  }
  if ('reorder_level' in body) {
    fields.push('reorder_level = ?')
    bindings.push(integer(body.reorder_level, 20))
  }
  if ('purchase_price' in body) {
    fields.push('purchase_price = ?')
    bindings.push(decimal(body.purchase_price))
  }
  if ('selling_price' in body) {
    fields.push('selling_price = ?')
    bindings.push(decimal(body.selling_price))
  }
  const expiryDate = text(body.expiry_date)
  if (expiryDate) {
    fields.push('expiry_date = ?')
    bindings.push(expiryDate)
  }
  const batchNumber = text(body.batch_number)
  if (batchNumber) {
    fields.push('batch_number = ?')
    bindings.push(batchNumber)
  }

  if (fields.length) {
    bindings.push(id)
    await env.DB.prepare(`UPDATE inventory SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run()
  }
  return json({ id, message: 'Inventory batch updated' })
}

async function deleteInventory(env, id) {
  const existing = await env.DB.prepare('SELECT id FROM inventory WHERE id = ?').bind(id).first()
  if (!existing) return error(404, 'Inventory batch not found')
  await env.DB.prepare('DELETE FROM inventory WHERE id = ?').bind(id).run()
  return json({ id, message: 'Inventory batch deleted' })
}

async function listCustomers(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, full_name, phone, email, city FROM customers ORDER BY full_name',
  ).all()
  return json(results || [])
}

async function addCustomer(request, env) {
  const body = await readJson(request)
  const fullName = text(body.full_name)
  if (!fullName) return error(422, 'full_name: field required')

  const result = await env.DB.prepare('INSERT INTO customers (full_name, phone, email, city) VALUES (?, ?, ?, ?)')
    .bind(fullName, text(body.phone), text(body.email), text(body.city))
    .run()
  return json({ id: result.meta.last_row_id, message: 'Customer added', full_name: fullName }, 201)
}

async function listSuppliers(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, contact_person, phone, city FROM suppliers ORDER BY name',
  ).all()
  return json(results || [])
}

async function listPrescriptions(env) {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.prescription_number, c.full_name AS customer_name, p.doctor_name,
            p.prescription_date, p.status, p.notes
     FROM prescriptions p JOIN customers c ON c.id = p.customer_id
     ORDER BY p.prescription_date DESC`,
  ).all()
  return json(results || [])
}

async function addPrescription(request, env) {
  const body = await readJson(request)
  const customerId = integer(body.customer_id)
  const doctorName = text(body.doctor_name)
  const prescriptionDate = text(body.prescription_date)
  const items = Array.isArray(body.items) ? body.items : []

  if (!customerId) return error(422, 'customer_id: field required')
  if (!doctorName) return error(422, 'doctor_name: field required')
  if (!prescriptionDate) return error(422, 'prescription_date: field required')
  if (!items.length) return error(400, 'Add at least one prescription item')

  const customer = await env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(customerId).first()
  if (!customer) return error(404, 'Customer not found')

  for (const item of items) {
    const medicineId = integer(item && item.medicine_id)
    if (!medicineId) return error(422, 'items: medicine_id is required')
    const medicine = await env.DB.prepare('SELECT id FROM medicines WHERE id = ?').bind(medicineId).first()
    if (!medicine) return error(404, `Medicine ${medicineId} not found`)
  }

  const total = await count(env, 'prescriptions')
  const prescriptionNumber = `RX-${new Date().getUTCFullYear()}-${String(total + 1).padStart(4, '0')}`

  const inserted = await env.DB.prepare(
    `INSERT INTO prescriptions (prescription_number, customer_id, doctor_name, prescription_date, notes, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
  )
    .bind(prescriptionNumber, customerId, doctorName, prescriptionDate, text(body.notes))
    .run()

  const prescriptionId = inserted.meta.last_row_id
  const statements = items.map((item) =>
    env.DB.prepare(
      'INSERT INTO prescription_items (prescription_id, medicine_id, quantity, instructions) VALUES (?, ?, ?, ?)',
    ).bind(
      prescriptionId,
      integer(item.medicine_id),
      integer(item.quantity, 1),
      text(item.instructions),
    ),
  )
  if (statements.length) await env.DB.batch(statements)

  return json(
    { id: prescriptionId, prescription_number: prescriptionNumber, message: 'Prescription saved' },
    201,
  )
}

async function updatePrescription(request, env, id) {
  const existing = await env.DB.prepare('SELECT id FROM prescriptions WHERE id = ?').bind(id).first()
  if (!existing) return error(404, 'Prescription not found')

  const body = await readJson(request)
  const fields = []
  const bindings = []
  const doctorName = text(body.doctor_name)
  if (doctorName) {
    fields.push('doctor_name = ?')
    bindings.push(doctorName)
  }
  const prescriptionDate = text(body.prescription_date)
  if (prescriptionDate) {
    fields.push('prescription_date = ?')
    bindings.push(prescriptionDate)
  }
  const status = text(body.status)
  if (status) {
    if (!['pending', 'dispensed', 'cancelled'].includes(status)) {
      return error(422, 'status: must be pending, dispensed or cancelled')
    }
    fields.push('status = ?')
    bindings.push(status)
  }
  if ('notes' in body) {
    fields.push('notes = ?')
    bindings.push(text(body.notes))
  }

  if (fields.length) {
    bindings.push(id)
    await env.DB.prepare(`UPDATE prescriptions SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run()
  }
  return json({ id, message: 'Prescription updated' })
}

/* ------------------------------------------------------------------ routing */

const API_DOCS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pharmacy API reference</title>
    <style>
      body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; margin: 0; padding: 40px 24px; background: #f7f7f4; color: #1f2a24; }
      main { max-width: 780px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 32px; box-shadow: 0 12px 40px rgba(20, 40, 30, .08); }
      h1 { margin: 0 0 6px; font-size: 26px; }
      p { color: #5c6b62; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 14px; }
      th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #e8ece8; }
      th { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #7d8b83; }
      code { background: #f0f3ef; padding: 2px 6px; border-radius: 5px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Pharmacy API reference</h1>
      <p>All endpoints are JSON. Send <code>Authorization: Bearer &lt;token&gt;</code> except for login and health.</p>
      <table>
        <thead><tr><th>Method</th><th>Endpoint</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td>POST</td><td><code>/api/auth/login</code></td><td>Login and receive a JWT</td></tr>
          <tr><td>GET</td><td><code>/api/health</code></td><td>Service health</td></tr>
          <tr><td>GET</td><td><code>/api/dashboard</code></td><td>Dashboard summary</td></tr>
          <tr><td>GET / POST</td><td><code>/api/medicines</code></td><td>List / add medicines</td></tr>
          <tr><td>PATCH</td><td><code>/api/medicines/{id}</code></td><td>Update a medicine</td></tr>
          <tr><td>GET / POST</td><td><code>/api/inventory</code></td><td>List / add inventory batches</td></tr>
          <tr><td>PATCH / DELETE</td><td><code>/api/inventory/{id}</code></td><td>Update / delete a batch</td></tr>
          <tr><td>GET / POST</td><td><code>/api/customers</code></td><td>List / add customers</td></tr>
          <tr><td>GET</td><td><code>/api/suppliers</code></td><td>List suppliers</td></tr>
          <tr><td>GET / POST</td><td><code>/api/prescriptions</code></td><td>List / create prescriptions</td></tr>
          <tr><td>PATCH</td><td><code>/api/prescriptions/{id}</code></td><td>Update a prescription</td></tr>
        </tbody>
      </table>
    </main>
  </body>
</html>`

async function handleApi(request, env, url) {
  const method = request.method
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const segments = path.split('/').filter(Boolean) // ['api', ...]

  if (path === API_PREFIX || path === `${API_PREFIX}/health`) {
    if (method !== 'GET') return error(405, 'Method not allowed')
    if (path === `${API_PREFIX}/health`) return json({ status: 'ok', service: 'pharmacy-api' })
    return json({
      service: 'Pharmacy Inventory & Prescription API',
      status: 'online',
      docs: '/docs',
      health: '/api/health',
    })
  }

  if (path === `${API_PREFIX}/auth/login`) {
    if (method !== 'POST') return error(405, 'Method not allowed')
    return login(request, env)
  }

  const user = await currentUser(request, env)
  if (!user) return error(401, 'Not authenticated')

  const [, resource, identifier] = segments

  switch (resource) {
    case 'dashboard':
      if (!identifier && method === 'GET') return dashboard(env)
      break
    case 'medicines':
      if (!identifier) {
        if (method === 'GET') return listMedicines(url, env)
        if (method === 'POST') return addMedicine(request, env)
      } else if (method === 'PATCH') {
        return updateMedicine(request, env, integer(identifier, 0))
      }
      break
    case 'inventory':
      if (!identifier) {
        if (method === 'GET') return listInventory(url, env)
        if (method === 'POST') return addInventory(request, env)
      } else {
        const id = integer(identifier, 0)
        if (!id) return error(404, 'Inventory batch not found')
        if (method === 'PATCH') return updateInventory(request, env, id)
        if (method === 'DELETE') return deleteInventory(env, id)
      }
      break
    case 'customers':
      if (!identifier) {
        if (method === 'GET') return listCustomers(env)
        if (method === 'POST') return addCustomer(request, env)
      }
      break
    case 'suppliers':
      if (!identifier && method === 'GET') return listSuppliers(env)
      break
    case 'prescriptions':
      if (!identifier) {
        if (method === 'GET') return listPrescriptions(env)
        if (method === 'POST') return addPrescription(request, env)
      } else if (method === 'PATCH') {
        return updatePrescription(request, env, integer(identifier, 0))
      }
      break
    default:
      return error(404, 'Not found')
  }

  return error(405, 'Method not allowed')
}

async function serveAsset(request, env, url) {
  if (url.pathname === '/docs' || url.pathname === '/docs/') {
    return new Response(API_DOCS_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (!env.ASSETS) return new Response('Not found', { status: 404 })

  const response = await env.ASSETS.fetch(request)
  if (response.status === 404 && !url.pathname.includes('.')) {
    // Single-page app: unknown document paths fall back to the shell.
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request))
  }
  return response
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (!url.pathname.startsWith(`${API_PREFIX}/`) && url.pathname !== API_PREFIX) {
      return serveAsset(request, env, url)
    }

    try {
      await ensureSchema(env)
      return await handleApi(request, env, url)
    } catch (err) {
      console.error('[api]', err && err.stack ? err.stack : err)
      const message = String((err && err.message) || '')
      if (/D1|database|SQLITE/i.test(message)) {
        return error(503, 'Database unavailable. Try again in a moment.')
      }
      return error(500, 'Unexpected server error')
    }
  },
}
