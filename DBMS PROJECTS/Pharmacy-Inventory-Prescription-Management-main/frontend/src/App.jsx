import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, Bell, Boxes, ClipboardList, LayoutDashboard,
  LogOut, Menu, Package, Plus, Search, ShieldCheck, Users, Truck, X, Pill,
  CalendarDays, AlertTriangle, Edit2, Stethoscope, Clock
} from 'lucide-react'
import { api, getToken, DOCS_URL } from './api'

const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
}).format(value || 0)

const formatDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
})

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Welcome'
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@shreepharmacy.in')
  const [password, setPassword] = useState('Admin@123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onLogin(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-art">
        <div className="brand light">
          <span className="brand-mark"><Pill size={22} /></span>
          <span>Shree<span className="brand-soft">Pharmacy</span></span>
        </div>
        <div className="art-copy">
          <span className="eyebrow">PHARMACY OPERATIONS, SIMPLIFIED</span>
          <h1>Care starts with<br /><em>better management.</em></h1>
          <p>One calm workspace for inventory, prescriptions and the people who count on you.</p>
          <div className="art-stats">
            <div><strong>360°</strong><span>Stock visibility</span></div>
            <div><strong>One</strong><span>Connected workspace</span></div>
          </div>
        </div>
        <div className="art-orb orb-one"></div>
        <div className="art-orb orb-two"></div>
        <div className="art-footer">A smarter way to run your pharmacy.</div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand brand">
            <span className="brand-mark"><Pill size={22} /></span>
            <span>Shree<span className="brand-soft">Pharmacy</span></span>
          </div>
          <span className="eyebrow muted">WELCOME BACK</span>
          <h2>Sign in to your account</h2>
          <p className="subtext">Enter your details to access the pharmacy dashboard.</p>
          <form onSubmit={submit}>
            <label>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@pharmacy.in" />
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter your password" />
            {error && <div className="error-msg">{error}</div>}
            <button className="primary-btn login-btn" disabled={busy}>
              {busy ? 'Signing in...' : 'Sign in'} <span>→</span>
            </button>
          </form>
          <div className="login-note"><ShieldCheck size={16} /> Secure access for authorised pharmacy staff</div>
          <div className="demo-hint">Demo: admin@shreepharmacy.in · Admin@123</div>
        </div>
        <div className="copyright">© 2026 Shree Pharmacy Management</div>
      </section>
    </main>
  )
}

const EMPTY_DATA = {
  dashboard: null,
  inventory: [],
  medicines: [],
  customers: [],
  suppliers: [],
  prescriptions: []
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pharmacy_user') || 'null')
    } catch {
      return null
    }
  })
  const [page, setPage] = useState('Dashboard')
  const [data, setData] = useState(EMPTY_DATA)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState('')
  const [editingBatch, setEditingBatch] = useState(null)
  const [editingMedicine, setEditingMedicine] = useState(null)
  const [editingPrescription, setEditingPrescription] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [loading, setLoading] = useState(false)

  async function login(email, password) {
    const result = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    localStorage.setItem('pharmacy_token', result.access_token)
    localStorage.setItem('pharmacy_user', JSON.stringify(result.user))
    setUser(result.user)
  }

  function logout() {
    localStorage.removeItem('pharmacy_token')
    localStorage.removeItem('pharmacy_user')
    setUser(null)
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [dashboard, inventory, medicines, customers, suppliers, prescriptions] = await Promise.all([
        api('/dashboard'), api('/inventory'), api('/medicines'),
        api('/customers'), api('/suppliers'), api('/prescriptions')
      ])
      setData({ dashboard, inventory, medicines, customers, suppliers, prescriptions })
    } catch (err) {
      const message = err.message.toLowerCase()
      if (message.includes('token') || message.includes('auth') || message.includes('not authenticated')) logout()
      else setNotice(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && getToken()) loadAll()
  }, [user])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  const nav = [
    { label: 'OVERVIEW', items: [{ name: 'Dashboard', icon: LayoutDashboard }] },
    {
      label: 'PHARMACY',
      items: [
        { name: 'Inventory', icon: Boxes },
        { name: 'Medicines', icon: Pill },
        { name: 'Prescriptions', icon: ClipboardList }
      ]
    },
    {
      label: 'DIRECTORY',
      items: [
        { name: 'Customers', icon: Users },
        { name: 'Suppliers', icon: Truck },
        { name: 'Doctors', icon: Stethoscope }
      ]
    }
  ]

  const filteredInventory = useMemo(() => data.inventory.filter(item =>
    `${item.medicine_name} ${item.generic_name} ${item.batch_number}`.toLowerCase().includes(search.toLowerCase())
  ), [data.inventory, search])

  const filteredMedicines = useMemo(() => data.medicines.filter(medicine =>
    medicine.name.toLowerCase().includes(search.toLowerCase())
  ), [data.medicines, search])

  if (!user) return <Login onLogin={login} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Pill size={21} /></span>
          <span>Shree<span className="brand-soft">Pharmacy</span></span>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        {nav.map(group => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.name}
                  className={`nav-item ${page === item.name ? 'active' : ''}`}
                  onClick={() => { setPage(item.name); setSearch(''); setMobileNav(false) }}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                  {item.name === 'Inventory' && <span className="nav-count">{data.inventory.length}</span>}
                </button>
              )
            })}
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Activity size={17} /></div>
            <strong>Need a hand?</strong>
            <p>Check the API guide or contact your system administrator.</p>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">Open API docs ↗</a>
          </div>
          <div className="profile">
            <div className="avatar">{user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
            <div className="profile-info">
              <strong>{user.full_name}</strong>
              <span>{user.role}</span>
            </div>
            <button className="icon-btn" title="Sign out" onClick={logout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)}></div>}

      <main className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
            <div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div>
          </div>
          <div className="top-actions">
            <div className="today">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <button className="icon-btn notification" title="Notifications"><Bell size={18} /><i></i></button>
            <div className="top-avatar">{user.full_name?.[0]}</div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow muted">SHREE PHARMACY / MANAGEMENT</div>
              <h1>{page === 'Dashboard' ? getGreeting() : page}<span className="heading-dot">.</span></h1>
              <p>
                {page === 'Dashboard' ? 'Here’s what’s happening at your pharmacy today.'
                  : page === 'Inventory' ? 'Track batches, stock levels and expiry dates.'
                  : page === 'Doctors' ? 'The clinicians whose prescriptions this pharmacy records.'
                  : `Manage your pharmacy ${page.toLowerCase()} records.`}
              </p>
            </div>
            {['Inventory', 'Medicines', 'Prescriptions', 'Customers'].includes(page) && (
              <button className="primary-btn" onClick={() => setModal(page)}>
                <Plus size={17} /> Add {page === 'Inventory' ? 'stock' : page === 'Medicines' ? 'medicine' : page === 'Customers' ? 'customer' : 'prescription'}
              </button>
            )}
          </div>

          {notice && (
            <div className="toast">
              <AlertTriangle size={16} />{notice}
              <button onClick={() => setNotice('')}><X size={15} /></button>
            </div>
          )}

          {loading && <div className="loading-line">Refreshing pharmacy data...</div>}

          {page === 'Dashboard' && <Dashboard data={data} setPage={setPage} />}

          {page === 'Inventory' && (
            <>
              <div className="toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input placeholder="Search medicine, generic name or batch..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span className="result-count">{filteredInventory.length} batches</span>
              </div>
              <InventoryTable rows={filteredInventory} allInventory={data.inventory} onEdit={setEditingBatch} />
            </>
          )}

          {page === 'Medicines' && (
            <>
              <div className="toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input placeholder="Search medicines..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span className="result-count">{filteredMedicines.length} medicines</span>
              </div>
              <MedicineTable rows={filteredMedicines} onEdit={setEditingMedicine} />
            </>
          )}

          {page === 'Prescriptions' && <PrescriptionTable rows={data.prescriptions} onEdit={setEditingPrescription} />}
          {page === 'Customers' && <PeopleTable rows={data.customers} type="customer" />}
          {page === 'Suppliers' && <PeopleTable rows={data.suppliers} type="supplier" />}
          {page === 'Doctors' && (
            <div className="doctors-grid">{DOCTORS.map(doctor => <DoctorCard key={doctor.id} doctor={doctor} />)}</div>
          )}

          <footer className="footer">
            <span>Shree Pharmacy Management</span>
            <span>Inventory with care <span className="footer-heart">♥</span></span>
          </footer>
        </div>
      </main>

      {modal && (
        <AddModal
          type={modal}
          medicines={data.medicines}
          customers={data.customers}
          prescriptions={data.prescriptions}
          onClose={() => setModal('')}
          onSaved={async () => { setModal(''); setNotice('Record saved successfully'); await loadAll() }}
        />
      )}

      {editingBatch && (
        <EditBatchModal
          batch={editingBatch}
          onClose={() => setEditingBatch(null)}
          onSaved={async msg => { setEditingBatch(null); setNotice(msg || 'Batch updated successfully'); await loadAll() }}
        />
      )}

      {editingMedicine && (
        <EditMedicineModal
          medicine={editingMedicine}
          onClose={() => setEditingMedicine(null)}
          onSaved={async msg => { setEditingMedicine(null); setNotice(msg || 'Medicine updated successfully'); await loadAll() }}
        />
      )}

      {editingPrescription && (
        <EditPrescriptionModal
          prescription={editingPrescription}
          onClose={() => setEditingPrescription(null)}
          onSaved={async msg => { setEditingPrescription(null); setNotice(msg || 'Prescription updated successfully'); await loadAll() }}
        />
      )}
    </div>
  )
}

function Dashboard({ data, setPage }) {
  const d = data.dashboard || {}

  const medicineTotals = useMemo(() => {
    const totals = {}
    for (const item of data.inventory) {
      totals[item.medicine_id] = (totals[item.medicine_id] || 0) + (Number(item.quantity) || 0)
    }
    return totals
  }, [data.inventory])

  const low = useMemo(
    () => data.inventory.filter(item => (medicineTotals[item.medicine_id] ?? item.quantity) <= 30),
    [data.inventory, medicineTotals]
  )

  const stats = [
    { label: 'Medicine catalogue', value: d.medicine_count ?? '—', detail: 'Products registered', icon: Pill, tone: 'violet', trend: 'Live catalogue' },
    { label: 'Units in stock', value: (d.total_units ?? 0).toLocaleString('en-IN'), detail: 'Across all batches', icon: Package, tone: 'blue', trend: 'Current stock' },
    { label: 'Low stock batches', value: low.length, detail: 'Medicine total ≤ 30 units', icon: ArrowDownRight, tone: 'amber', trend: 'Needs attention' },
    { label: 'Pending prescriptions', value: d.pending_prescriptions ?? '—', detail: 'Awaiting dispensing', icon: ClipboardList, tone: 'green', trend: 'To review' }
  ]

  const recent = data.prescriptions.slice(0, 4)

  return (
    <>
      <div className="stats-grid">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div className="stat-card" key={stat.label}>
              <div className={`stat-icon ${stat.tone}`}><Icon size={19} /></div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-detail">
                <span className={`stat-trend ${stat.tone}`}>{stat.trend}</span>
                <span>{stat.detail}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="dashboard-grid">
        <section className="panel low-panel">
          <div className="panel-head">
            <div>
              <h3>Stock needing attention</h3>
              <p>Medicines with total stock ≤ 30 units</p>
            </div>
            <button className="text-btn" onClick={() => setPage('Inventory')}>View inventory <span>→</span></button>
          </div>
          {low.length ? (
            <div className="attention-list">
              {low.slice(0, 5).map(item => {
                const total = medicineTotals[item.medicine_id] ?? item.quantity
                return (
                  <div className="attention-row" key={item.id}>
                    <div className="medicine-symbol"><Pill size={17} /></div>
                    <div className="attention-name">
                      <strong>{item.medicine_name}</strong>
                      <span>{item.batch_number}</span>
                    </div>
                    <div className="stock-meter">
                      <div className="meter-track"><i style={{ width: `${Math.min(100, total / 30 * 100)}%` }}></i></div>
                      <span>{item.quantity} in batch ({total} total)</span>
                    </div>
                    <span className="status-pill warning">Low stock</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">All medicines have total stock above 30 units.</div>
          )}
        </section>

        <section className="panel quick-panel">
          <div className="panel-head">
            <div>
              <h3>Quick access</h3>
              <p>Jump into a common task</p>
            </div>
          </div>
          <div className="quick-grid">
            <button onClick={() => setPage('Inventory')}>
              <span className="quick-icon qi-blue"><Boxes size={19} /></span>
              <strong>View stock</strong><small>Check available batches</small>
            </button>
            <button onClick={() => setPage('Prescriptions')}>
              <span className="quick-icon qi-green"><ClipboardList size={19} /></span>
              <strong>Prescriptions</strong><small>Review prescription queue</small>
            </button>
            <button onClick={() => setPage('Customers')}>
              <span className="quick-icon qi-violet"><Users size={19} /></span>
              <strong>Customers</strong><small>Browse customer records</small>
            </button>
            <button onClick={() => setPage('Suppliers')}>
              <span className="quick-icon qi-orange"><Truck size={19} /></span>
              <strong>Suppliers</strong><small>View supply partners</small>
            </button>
          </div>
        </section>
      </div>

      <section className="panel recent-panel">
        <div className="panel-head">
          <div>
            <h3>Recent prescriptions</h3>
            <p>Latest records in your pharmacy</p>
          </div>
          <button className="text-btn" onClick={() => setPage('Prescriptions')}>View all <span>→</span></button>
        </div>
        <PrescriptionTable rows={recent} compact />
      </section>

      <div className="notice-strip">
        <ShieldCheck size={18} />
        <span>
          <strong>Dispensing reminder:</strong> Verify the original prescription and patient details
          before dispensing prescription-only medicines.
        </span>
      </div>
    </>
  )
}

function InventoryTable({ rows, allInventory = rows, onEdit }) {
  const medicineTotals = useMemo(() => {
    const totals = {}
    for (const item of allInventory) {
      totals[item.medicine_id] = (totals[item.medicine_id] || 0) + (Number(item.quantity) || 0)
    }
    return totals
  }, [allInventory])

  if (!rows.length) return <div className="panel empty-state">No inventory batches found.</div>

  return (
    <div className="panel table-panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>MEDICINE</th><th>BATCH NUMBER</th><th>QUANTITY</th>
              <th>SELLING PRICE</th><th>EXPIRY DATE</th><th>STATUS</th><th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const totalQty = medicineTotals[row.medicine_id] ?? row.quantity
              const isInStock = totalQty > 30
              return (
                <tr key={row.id}>
                  <td>
                    <div className="table-primary">{row.medicine_name}</div>
                    <div className="table-secondary">
                      {row.generic_name} · {row.strength || '—'} (Total: {totalQty} units)
                    </div>
                  </td>
                  <td className="mono">{row.batch_number}</td>
                  <td><strong>{row.quantity}</strong><span className="table-secondary"> units</span></td>
                  <td>{money(row.selling_price)}</td>
                  <td>{formatDate(row.expiry_date)}</td>
                  <td><span className={`status-pill ${isInStock ? 'success' : 'warning'}`}>{isInStock ? 'In stock' : 'Low stock'}</span></td>
                  <td><button className="action-btn" title="Edit batch" onClick={() => onEdit(row)}><Edit2 size={13} /> Edit</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MedicineTable({ rows, onEdit }) {
  if (!rows.length) return <div className="panel empty-state">No medicines found.</div>

  return (
    <div className="panel table-panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>MEDICINE</th><th>GENERIC NAME</th><th>CATEGORY</th>
              <th>STRENGTH / FORM</th><th>CLASSIFICATION</th><th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(medicine => (
              <tr key={medicine.id}>
                <td>
                  <div className="table-primary">{medicine.name}</div>
                  <div className="table-secondary">{medicine.manufacturer || 'Manufacturer not listed'}</div>
                </td>
                <td>{medicine.generic_name}</td>
                <td>{medicine.category || '—'}</td>
                <td>{medicine.strength || '—'} · {medicine.dosage_form || '—'}</td>
                <td>
                  <span className={`status-pill ${medicine.requires_prescription ? 'warning' : 'success'}`}>
                    {medicine.requires_prescription ? 'Prescription required' : 'OTC / general'}
                  </span>
                </td>
                <td><button className="action-btn" title="Edit medicine" onClick={() => onEdit(medicine)}><Edit2 size={13} /> Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PrescriptionTable({ rows, compact = false, onEdit }) {
  if (!rows.length) return <div className="panel empty-state">No prescriptions recorded yet.</div>

  return (
    <div className="panel table-panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>REFERENCE</th><th>CUSTOMER</th><th>DOCTOR</th><th>DATE</th><th>STATUS</th>
              {!compact && <th>ACTIONS</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td className="mono table-primary">{row.prescription_number}</td>
                <td>{row.customer_name}</td>
                <td>{row.doctor_name}</td>
                <td>{formatDate(row.prescription_date)}</td>
                <td>
                  <span className={`status-pill ${row.status === 'dispensed' ? 'success' : row.status === 'cancelled' ? 'neutral' : 'warning'}`}>
                    {row.status}
                  </span>
                </td>
                {!compact && <td><button className="action-btn" title="Edit prescription" onClick={() => onEdit(row)}><Edit2 size={13} /> Edit</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const DOCTORS = [
  {
    id: 1,
    name: 'Dr. Rajesh Mehta',
    specialty: 'General Physician',
    qualification: 'MBBS, MD (Internal Medicine)',
    experience: '18 years',
    clinic: 'Mehta Family Clinic',
    city: 'Jaipur',
    availability: 'Mon – Sat · 10:00 – 18:00',
    focus: ['Fever & infections', 'Preventive care', 'Lifestyle counselling'],
    bio: 'A neighbourhood family physician who handles everyday cases, seasonal infections and long-term follow-ups for patients across Jaipur.'
  },
  {
    id: 2,
    name: 'Dr. Priya Nair',
    specialty: 'Cardiologist',
    qualification: 'MBBS, MD, DM (Cardiology)',
    experience: '14 years',
    clinic: 'Aarogya Heart Centre',
    city: 'Delhi',
    availability: 'Mon – Fri · 09:30 – 16:00',
    focus: ['Hypertension', 'Heart failure', 'Post-procedure review'],
    bio: 'Practises preventive cardiology with an emphasis on blood-pressure control and structured follow-up for patients on long-term medication.'
  },
  {
    id: 3,
    name: 'Dr. Neha Kapoor',
    specialty: 'Gastroenterologist',
    qualification: 'MBBS, MD, DM (Gastroenterology)',
    experience: '11 years',
    clinic: 'Kapoor Digestive Care',
    city: 'Jaipur',
    availability: 'Tue – Sat · 11:00 – 19:00',
    focus: ['Acid peptic disease', 'IBS', 'Liver health'],
    bio: 'Sees patients with long-standing acidity, irritable bowel symptoms and liver concerns, with a focus on diet and adherence to therapy.'
  },
  {
    id: 4,
    name: 'Dr. Arvind Swamy',
    specialty: 'Diabetologist & Internal Medicine',
    qualification: 'MBBS, MD (General Medicine)',
    experience: '21 years',
    clinic: 'Swamy Diabetes & Wellness',
    city: 'Alwar',
    availability: 'Mon – Thu · 10:00 – 17:30',
    focus: ['Type 2 diabetes', 'Thyroid disorders', 'Metabolic care'],
    bio: 'Runs a long-term diabetes clinic built around periodic review, medicine reconciliation and steady lifestyle coaching for adults.'
  },
  {
    id: 5,
    name: 'Dr. Sunita Rao',
    specialty: 'Pulmonologist',
    qualification: 'MBBS, MD (Respiratory Medicine)',
    experience: '9 years',
    clinic: 'Bharat Chest & Allergy Clinic',
    city: 'Gurugram',
    availability: 'Mon – Sat · 12:00 – 18:00',
    focus: ['Asthma', 'Allergic rhinitis', 'Chronic cough'],
    bio: 'Treats asthma and allergy cases with inhaler technique reviews, written action plans and regular breathing assessments.'
  },
  {
    id: 6,
    name: 'Dr. Arjun Rao',
    specialty: 'Family Medicine',
    qualification: 'MBBS, DNB (Family Medicine)',
    experience: '8 years',
    clinic: 'Rao Community Health',
    city: 'Delhi',
    availability: 'Mon – Fri · 10:00 – 20:00',
    focus: ['Common cold & flu', 'Child wellness', 'Routine check-ups'],
    bio: 'A family medicine practitioner covering routine consultations for adults and children, with an interest in first-contact care.'
  }
]

const initials = name => name
  .replace(/^Dr\.\s*/, '')
  .split(' ')
  .map(part => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase()

function DoctorCard({ doctor }) {
  return (
    <article className="doctor-card">
      <div className="doctor-head">
        <div className="doctor-avatar">{initials(doctor.name)}</div>
        <div className="doctor-id">
          <h3 className="doctor-name">{doctor.name}</h3>
          <span className="doctor-specialty">{doctor.specialty}</span>
          <span className="doctor-qual">{doctor.qualification}</span>
        </div>
      </div>
      <p className="doctor-bio">{doctor.bio}</p>
      <div className="doctor-tags">
        {doctor.focus.map(item => <span className="doctor-tag" key={item}>{item}</span>)}
      </div>
      <div className="doctor-facts">
        <div className="doctor-fact"><span>Experience</span><strong>{doctor.experience}</strong></div>
        <div className="doctor-fact"><span>Clinic</span><strong>{doctor.clinic}</strong></div>
        <div className="doctor-fact"><span>City</span><strong>{doctor.city}</strong></div>
      </div>
      <div className="doctor-foot"><Clock size={14} /><span>{doctor.availability}</span></div>
    </article>
  )
}

function PeopleTable({ rows, type }) {
  if (!rows.length) return <div className="panel empty-state">No {type} records found.</div>

  return (
    <div className="panel table-panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>NAME</th>
              <th>{type === 'customer' ? 'PHONE' : 'CONTACT PERSON'}</th>
              <th>EMAIL / PHONE</th>
              <th>CITY</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td><div className="table-primary">{row.full_name || row.name}</div></td>
                <td>{type === 'customer' ? (row.phone || '—') : (row.contact_person || '—')}</td>
                <td>{type === 'customer' ? (row.email || '—') : (row.phone || '—')}</td>
                <td>{row.city || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AddModal({ type, medicines, customers, prescriptions = [], onClose, onSaved }) {
  const [form, setForm] = useState(type === 'Inventory' ? { reorder_level: 20 } : {})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const doctorOptions = useMemo(() => {
    const set = new Set(['Dr. Rajesh Mehta', 'Dr. Priya Nair', 'Dr. Neha Kapoor', 'Dr. Arvind Swamy', 'Dr. Sunita Rao'])
    for (const rx of prescriptions) {
      if (rx.doctor_name) set.add(rx.doctor_name)
    }
    return Array.from(set).map(doc => [doc, doc])
  }, [prescriptions])

  const change = e => setForm(current => ({
    ...current,
    [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (type === 'Medicines') {
        await api('/medicines', { method: 'POST', body: JSON.stringify({ ...form, requires_prescription: !!form.requires_prescription }) })
      }
      if (type === 'Inventory') {
        await api('/inventory', {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            medicine_id: Number(form.medicine_id),
            supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
            quantity: Number(form.quantity),
            reorder_level: form.reorder_level !== undefined ? Number(form.reorder_level) : 20,
            purchase_price: Number(form.purchase_price),
            selling_price: Number(form.selling_price)
          })
        })
      }
      if (type === 'Prescriptions') {
        await api('/prescriptions', {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            customer_id: Number(form.customer_id),
            items: [{
              medicine_id: Number(form.medicine_id),
              quantity: Number(form.quantity),
              instructions: form.instructions || 'As written on original prescription'
            }]
          })
        })
      }
      if (type === 'Customers') {
        await api('/customers', { method: 'POST', body: JSON.stringify(form) })
      }
      await onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const title = type === 'Inventory' ? 'Add inventory batch'
    : type === 'Medicines' ? 'Add a medicine'
    : type === 'Customers' ? 'Add customer'
    : 'Record prescription'

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className="modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow muted">PHARMACY RECORDS</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button>
        </div>

        <form onSubmit={submit} className="modal-form">
          {type === 'Medicines' && (
            <>
              <Field label="Medicine name" name="name" onChange={change} required />
              <Field label="Generic name" name="generic_name" onChange={change} required />
              <Field label="Category" name="category" onChange={change} />
              <div className="form-two">
                <Field label="Strength" name="strength" onChange={change} />
                <Field label="Dosage form" name="dosage_form" onChange={change} />
              </div>
              <Field label="Manufacturer" name="manufacturer" onChange={change} />
              <label className="check-label">
                <input type="checkbox" name="requires_prescription" onChange={change} /> Prescription required
              </label>
            </>
          )}

          {type === 'Inventory' && (
            <>
              <SelectField label="Medicine" name="medicine_id" options={medicines.map(m => [m.id, `${m.name} (${m.strength || 'N/A'})`])} onChange={change} />
              <Field label="Batch number" name="batch_number" onChange={change} required />
              <div className="form-two">
                <Field label="Quantity" name="quantity" type="number" onChange={change} required />
                <Field label="Reorder level" name="reorder_level" type="number" value={form.reorder_level ?? 20} onChange={change} required />
              </div>
              <div className="form-two">
                <Field label="Purchase price (₹)" name="purchase_price" type="number" step="any" onChange={change} required />
                <Field label="Selling price (₹)" name="selling_price" type="number" step="any" onChange={change} required />
              </div>
              <Field label="Expiry date" name="expiry_date" type="date" onChange={change} required />
            </>
          )}

          {type === 'Prescriptions' && (
            <>
              <SelectField label="Customer" name="customer_id" options={customers.map(c => [c.id, c.full_name])} onChange={change} />
              <SelectField label="Doctor name" name="doctor_name" options={doctorOptions} onChange={change} />
              <Field label="Prescription date" name="prescription_date" type="date" onChange={change} required />
              <SelectField label="Medicine on prescription" name="medicine_id" options={medicines.map(m => [m.id, `${m.name} (${m.strength || 'N/A'})`])} onChange={change} />
              <Field label="Quantity" name="quantity" type="number" onChange={change} required />
              <Field label="Instructions (transcribe exactly)" name="instructions" onChange={change} />
              <Field label="Notes" name="notes" onChange={change} />
              <p className="form-note">
                Enter details exactly as written on the valid original prescription.
                This form does not recommend doses or treatment.
              </p>
            </>
          )}

          {type === 'Customers' && (
            <>
              <Field label="Full name" name="full_name" onChange={change} required />
              <Field label="Phone number" name="phone" onChange={change} />
              <Field label="Email" name="email" type="email" onChange={change} />
              <Field label="City" name="city" onChange={change} />
            </>
          )}

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button className="primary-btn" disabled={busy}>{busy ? 'Saving...' : 'Save record'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function EditBatchModal({ batch, onClose, onSaved }) {
  const [form, setForm] = useState({
    quantity: batch.quantity,
    reorder_level: batch.reorder_level ?? 20,
    selling_price: batch.selling_price,
    expiry_date: batch.expiry_date
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const change = e => setForm(current => ({ ...current, [e.target.name]: e.target.value }))
  const willDelete = Number(form.quantity) <= 0

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api(`/inventory/${batch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          quantity: Number(form.quantity),
          reorder_level: Number(form.reorder_level),
          selling_price: Number(form.selling_price),
          expiry_date: form.expiry_date
        })
      })
      await onSaved(willDelete ? 'Batch removed (quantity is 0)' : (res.message || 'Batch updated successfully'))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className="modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow muted">INVENTORY UPDATE</span>
            <h2>Edit batch · {batch.batch_number}</h2>
            <p className="table-secondary" style={{ marginTop: '4px' }}>{batch.medicine_name} ({batch.strength || 'N/A'})</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <div className="form-two">
            <Field label="Quantity (units)" name="quantity" type="number" min="0" value={form.quantity} onChange={change} required />
            <Field label="Reorder level" name="reorder_level" type="number" min="0" value={form.reorder_level} onChange={change} required />
          </div>
          <div className="form-two">
            <Field label="Selling price (₹)" name="selling_price" type="number" step="any" value={form.selling_price} onChange={change} required />
            <Field label="Expiry date" name="expiry_date" type="date" value={form.expiry_date} onChange={change} required />
          </div>

          {willDelete && (
            <p className="form-note" style={{ color: '#c45c58', background: '#fff2f0' }}>
              Setting quantity to 0 will delete this batch from inventory.
            </p>
          )}

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button className="primary-btn" disabled={busy}>
              {busy ? 'Saving...' : willDelete ? 'Remove batch' : 'Update batch'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function EditMedicineModal({ medicine, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: medicine.name,
    generic_name: medicine.generic_name,
    category: medicine.category || '',
    strength: medicine.strength || '',
    dosage_form: medicine.dosage_form || '',
    manufacturer: medicine.manufacturer || '',
    requires_prescription: !!medicine.requires_prescription
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const change = e => setForm(current => ({
    ...current,
    [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/medicines/${medicine.id}`, { method: 'PATCH', body: JSON.stringify(form) })
      await onSaved('Medicine updated successfully')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className="modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow muted">CATALOGUE UPDATE</span>
            <h2>Edit medicine · {medicine.name}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <Field label="Medicine name" name="name" value={form.name} onChange={change} required />
          <Field label="Generic name" name="generic_name" value={form.generic_name} onChange={change} required />
          <Field label="Category" name="category" value={form.category} onChange={change} />
          <div className="form-two">
            <Field label="Strength" name="strength" value={form.strength} onChange={change} />
            <Field label="Dosage form" name="dosage_form" value={form.dosage_form} onChange={change} />
          </div>
          <Field label="Manufacturer" name="manufacturer" value={form.manufacturer} onChange={change} />
          <label className="check-label">
            <input type="checkbox" name="requires_prescription" checked={form.requires_prescription} onChange={change} />
            Prescription required
          </label>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button className="primary-btn" disabled={busy}>{busy ? 'Saving...' : 'Update medicine'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function EditPrescriptionModal({ prescription, onClose, onSaved }) {
  const [form, setForm] = useState({
    doctor_name: prescription.doctor_name,
    prescription_date: prescription.prescription_date,
    status: prescription.status,
    notes: prescription.notes || ''
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const change = e => setForm(current => ({ ...current, [e.target.name]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/prescriptions/${prescription.id}`, { method: 'PATCH', body: JSON.stringify(form) })
      await onSaved('Prescription updated successfully')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className="modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow muted">PRESCRIPTION UPDATE</span>
            <h2>Edit prescription · {prescription.prescription_number}</h2>
            <p className="table-secondary" style={{ marginTop: '4px' }}>Customer: {prescription.customer_name}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={19} /></button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <label className="field-label">Status
            <select name="status" value={form.status} onChange={change}>
              <option value="pending">Pending (Awaiting dispensing)</option>
              <option value="dispensed">Dispensed (Completed)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <Field label="Doctor name" name="doctor_name" value={form.doctor_name} onChange={change} required />
          <Field label="Prescription date" name="prescription_date" type="date" value={form.prescription_date} onChange={change} required />
          <Field label="Notes" name="notes" value={form.notes} onChange={change} />

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button className="primary-btn" disabled={busy}>{busy ? 'Saving...' : 'Update prescription'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Field({ label, name, type = 'text', onChange, required = false, value, min, step }) {
  return (
    <label className="field-label">{label}
      <input
        name={name}
        type={type}
        onChange={onChange}
        required={required}
        defaultValue={value}
        min={min}
        step={step}
      />
    </label>
  )
}

function SelectField({ label, name, options, onChange }) {
  return (
    <label className="field-label">{label}
      <select name={name} onChange={onChange} required defaultValue="">
        <option value="" disabled>Select {label.toLowerCase()}</option>
        {options.map(([id, text]) => <option value={id} key={id}>{text}</option>)}
      </select>
    </label>
  )
}

export default App
