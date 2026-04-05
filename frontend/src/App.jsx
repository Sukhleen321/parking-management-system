// frontend/src/App.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

// ─── API helpers ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.message.includes("Failed to fetch")) {
      throw new Error("Unable to connect to server. Please try again.");
    }
    throw err;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Request failed with status " + res.status);
  }
  return res.json();
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" {...rest}>
    <path d={path} />
  </svg>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [slots, setSlots] = useState([]);
  const [vtypes, setVtypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [notification, setNotification] = useState(null);
  const wsRef = useRef(null);

  const notify = useCallback((msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  // Load initial data
  useEffect(() => {
    Promise.all([
      api("GET", "/dashboard-stats").then(setStats),
      api("GET", "/slots").then(setSlots),
      api("GET", "/vehicle-types").then(setVtypes),
      api("GET", "/parking-records?limit=50").then(setRecords),
    ]).catch(console.error);
  }, []);

  // Refresh dashboard stats
  const refreshStats = useCallback(() => {
    api("GET", "/dashboard-stats").then(setStats).catch(console.error);
    api("GET", "/slots").then(setSlots).catch(console.error);
    api("GET", "/parking-records?limit=50").then(setRecords).catch(console.error);
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.event === "vehicle_entry" || data.event === "vehicle_exit") {
          refreshStats();
        }
      };
      ws.onclose = () => setTimeout(connect, 3000);
    };
    connect();
    return () => wsRef.current?.close();
  }, [refreshStats]);

  const navItems = [
    { key: "dashboard", label: "Dashboard",      icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
    { key: "slots",     label: "Parking Slots",  icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" },
    { key: "entry",     label: "Vehicle Entry",  icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6" },
    { key: "exit",      label: "Vehicle Exit",   icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
    { key: "records",   label: "Records",        icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { key: "admin",     label: "Admin Panel",    icon: "M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z" },
  ];

  const pages = { dashboard: <Dashboard stats={stats} records={records} onRefresh={refreshStats} />,
    slots: <SlotsView slots={slots} vtypes={vtypes} onNavigate={(p) => setPage(p)} />,
    entry: <VehicleEntry vtypes={vtypes} onSuccess={(msg) => { notify(msg); refreshStats(); }} />,
    exit: <VehicleExit records={records} vtypes={vtypes} onSuccess={(msg) => { notify(msg); refreshStats(); }} />,
    records: <RecordsView records={records} />,
    admin: <AdminPanel vtypes={vtypes} setVtypes={setVtypes} slots={slots} onSuccess={notify} />,
  };

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-400 rounded-lg flex items-center justify-center">
              <span className="text-gray-900 font-black text-xs">PS</span>
            </div>
            <div>
              <p className="font-bold text-sm tracking-widest">PARKSMART</p>
              <p className="text-xs text-gray-500 tracking-widest font-mono">MANAGEMENT</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => (
            <button key={item.key} onClick={() => setPage(item.key)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${page === item.key
                  ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"}`}>
              <Icon path={item.icon} size={15} />
              {item.label}
              {item.key === "slots" && slots.length > 0 && (
                <span className="ml-auto bg-cyan-400 text-gray-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {slots.filter(s => s.is_occupied).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            System Online
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-gray-900 border-b border-gray-800 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-sm font-semibold tracking-wide capitalize">
            {navItems.find(n => n.key === page)?.label}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono">
              {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-green-400 font-mono bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{pages[page]}</main>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl animate-in slide-in-from-right
          ${notification.type === "success" ? "bg-green-400/10 border-green-400/30 text-green-400"
            : notification.type === "error" ? "bg-red-400/10 border-red-400/30 text-red-400"
            : "bg-cyan-400/10 border-cyan-400/30 text-cyan-400"}`}>
          <div className={`w-2 h-2 rounded-full ${notification.type === "success" ? "bg-green-400" : notification.type === "error" ? "bg-red-400" : "bg-cyan-400"}`} />
          {notification.msg}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ stats, records, onRefresh }) {
  if (!stats) return <div className="flex items-center justify-center h-64 text-gray-500 font-mono text-sm">Loading stats...</div>;
  const active = records.filter(r => r.status === "active");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Now",    value: stats.active_parkings,  color: "text-cyan-400",   sub: "vehicles parked" },
          { label: "Today Revenue", value: `₹${stats.revenue_today.toLocaleString()}`, color: "text-amber-400", sub: "total collected" },
          { label: "Occupancy",     value: `${stats.occupancy_rate}%`, color: "text-green-400", sub: `${stats.occupied_slots}/${stats.total_slots} slots` },
          { label: "Today Entries", value: stats.vehicles_today, color: "text-purple-400", sub: "vehicles entered" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs font-mono tracking-widest text-gray-500 uppercase mb-2">{s.label}</p>
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1 font-mono">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-mono tracking-widest text-gray-500 uppercase mb-4">Weekly Revenue</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.revenue_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={v => `₹${v}`} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                formatter={v => [`₹${v}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="#00C8F0" fillOpacity={0.8} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-mono tracking-widest text-gray-500 uppercase mb-4">Slot Breakdown</p>
          {stats.slot_breakdown.map(b => {
            const pct = b.total > 0 ? Math.round(b.occupied / b.total * 100) : 0;
            const colors = { bike: "#00C8F0", car: "#F59E0B", truck: "#8B5CF6" };
            return (
              <div key={b.type} className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-semibold capitalize">{b.type}</span>
                  <span className="text-xs font-mono text-gray-400">{b.occupied}/{b.total} · {pct}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: colors[b.type] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono tracking-widest text-gray-500 uppercase">Active Sessions</p>
          <span className="text-xs font-mono text-gray-500">{active.length} vehicles</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800">
              {["Vehicle","Owner","Type","Slot","Floor","Entry","Duration","Est. Fee"].map(h => (
                <th key={h} className="text-left py-2 px-3 text-xs font-mono text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {active.slice(0, 10).map(r => {
                const dur = Math.max(((new Date() - new Date(r.entry_time)) / 3600000), 0.25);
                const typeColor = { bike: "text-cyan-400", car: "text-amber-400", truck: "text-purple-400" };
                return (
                  <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-cyan-400 text-xs">{r.vehicle_number}</td>
                    <td className="py-2.5 px-3 text-gray-300 text-xs">{r.owner_name || "—"}</td>
                    <td className="py-2.5 px-3"><span className={`text-xs font-mono ${typeColor[r.vehicle_type]}`}>{r.vehicle_type}</span></td>
                    <td className="py-2.5 px-3 font-mono text-xs">{r.slot_number}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-400">{r.floor_number}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-400">{new Date(r.entry_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-green-400">{Math.floor(dur)}h {Math.round((dur % 1) * 60)}m</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-amber-400">₹{Math.round(dur * 50)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Slots View ───────────────────────────────────────────────────────────────
function SlotsView({ slots, vtypes, onNavigate }) {
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const floors = [...new Set(slots.map(s => s.floor_number))].sort();
  const filtered = slots.filter(s => {
    const byOcc = filter === "all" ? true : filter === "free" ? !s.is_occupied : s.is_occupied;
    const byType = typeFilter === "all" ? true : s.slot_type === typeFilter;
    return byOcc && byType;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1">
          {["all","free","occupied"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all
                ${filter === f ? "bg-cyan-400/10 border-cyan-400/30 text-cyan-400" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}>
              {f === "all" ? "All" : f === "free" ? "Available" : "Occupied"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {["all","bike","car","truck"].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all capitalize
                ${typeFilter === t ? "bg-cyan-400/10 border-cyan-400/30 text-cyan-400" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        {floors.map(floor => {
          const floorSlots = filtered.filter(s => s.floor_number === floor);
          if (!floorSlots.length) return null;
          return (
            <div key={floor}>
              <div className="flex items-center gap-3 mb-3 mt-4 first:mt-0">
                <span className="text-xs font-mono tracking-widest text-gray-500 uppercase">Floor {floor}</span>
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs font-mono text-gray-500">{floorSlots.filter(s=>!s.is_occupied).length} free</span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}>
                {floorSlots.map(s => (
                  <div key={s.id} title={s.is_occupied ? "Occupied" : "Available — click to go to entry"}
                    onClick={() => !s.is_occupied && onNavigate("entry")}
                    className={`rounded-lg p-2.5 text-center border transition-all
                      ${s.is_occupied
                        ? "bg-red-500/10 border-red-500/30 text-red-400 cursor-default"
                        : "bg-green-500/10 border-green-500/30 text-green-400 cursor-pointer hover:bg-green-500/20 hover:scale-105"}`}>
                    <div className="text-xs font-bold font-mono">{s.slot_number}</div>
                    <div className="text-xs opacity-60 uppercase tracking-wider mt-0.5 font-mono" style={{fontSize:9}}>{s.slot_type}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vehicle Entry ────────────────────────────────────────────────────────────
function VehicleEntry({ vtypes, onSuccess }) {
  const [form, setForm] = useState({ vehicle_number: "", vehicle_type_id: 2, owner_name: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.vehicle_number.trim()) { setError("Vehicle number is required"); return; }
    setLoading(true); setError(null);
    try {
      const res = await api("POST", "/vehicle-entry", { ...form, vehicle_number: form.vehicle_number.toUpperCase(), vehicle_type_id: parseInt(form.vehicle_type_id) });
      setResult(res);
      onSuccess(`${res.vehicle_number} checked in → Slot ${res.slot_number}`);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const vt = vtypes.find(v => v.id === parseInt(form.vehicle_type_id));
  return (
    <div className="max-w-md space-y-4">
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm">{error}</div>}
      {result ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl p-4 text-sm">
            ✓ {result.vehicle_number} checked in — Slot {result.slot_number} (Floor {result.floor_number})
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[["Vehicle", result.vehicle_number], ["Type", result.vehicle_type], ["Slot", result.slot_number], ["Floor", result.floor_number]].map(([l,v]) => (
              <div key={l}><p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">{l}</p><p className="font-mono text-cyan-400">{v}</p></div>
            ))}
          </div>
          <button onClick={() => { setResult(null); setForm({ vehicle_number: "", vehicle_type_id: 2, owner_name: "" }); }}
            className="w-full py-2.5 bg-cyan-400 text-gray-900 rounded-lg font-semibold text-sm">
            + New Entry
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <p className="text-xs font-mono tracking-widest text-gray-500 uppercase">New Vehicle Entry</p>
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Vehicle Number *</label>
            <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))}
              placeholder="e.g. KA01AB1234" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-cyan-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Vehicle Type *</label>
            <select value={form.vehicle_type_id} onChange={e => setForm(f => ({ ...f, vehicle_type_id: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:border-cyan-400 focus:outline-none">
              {vtypes.map(v => <option key={v.id} value={v.id}>{v.type_name.charAt(0).toUpperCase()+v.type_name.slice(1)} — ₹{v.price_per_hour}/hr</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Owner Name (Optional)</label>
            <input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
              placeholder="e.g. Ravi Kumar" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:border-cyan-400 focus:outline-none" />
          </div>
          {vt && (
            <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-lg p-3 text-xs font-mono text-cyan-400">
              AUTO-ASSIGN → nearest free {vt.type_name} slot · ₹{vt.price_per_hour}/hr
            </div>
          )}
          <button onClick={submit} disabled={loading}
            className="w-full py-3 bg-cyan-400 text-gray-900 rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-cyan-300 transition-colors">
            {loading ? "Processing..." : "⬤ Check In Vehicle"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Vehicle Exit ─────────────────────────────────────────────────────────────
function VehicleExit({ records, vtypes, onSuccess }) {
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [payMethod, setPayMethod] = useState("upi");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const doSearch = async () => {
    if (!search.trim()) return;
    setLoading(true); setError(null);
    try {
      const data = await api("GET", `/vehicle-exit/preview/${search.trim().toUpperCase()}`);
      setPreview(data);
    } catch (e) { setError(e.message); setPreview(null); }
    setLoading(false);
  };

  const confirmExit = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      await api("POST", "/vehicle-exit", { vehicle_number: preview.vehicle_number });
      await api("POST", "/payment", { parking_record_id: preview.record_id, amount: preview.estimated_fee, payment_method: payMethod });
      setResult({ fee: preview.estimated_fee, method: payMethod, vnum: preview.vehicle_number });
      onSuccess(`₹${preview.estimated_fee} collected — ${preview.vehicle_number} exited`);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (result) return (
    <div className="max-w-md">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl p-4 text-sm">
          ✓ Exit processed — ₹{result.fee} collected via {result.method.toUpperCase()}
        </div>
        <button onClick={() => { setResult(null); setSearch(""); setPreview(null); }}
          className="w-full py-2.5 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
          Process Another Exit
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md space-y-4">
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm">{error}</div>}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <p className="text-xs font-mono tracking-widest text-gray-500 uppercase">Vehicle Exit & Payment</p>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Enter vehicle number..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:border-cyan-400 focus:outline-none" />
          <button onClick={doSearch} disabled={loading} className="px-4 py-2.5 bg-cyan-400 text-gray-900 rounded-lg font-semibold text-sm">
            {loading ? "..." : "Search"}
          </button>
        </div>

        {preview && (
          <div className="space-y-3">
            <div className="bg-gray-800 rounded-xl p-4 space-y-2.5 text-sm">
              {[["Vehicle", preview.vehicle_number, "text-cyan-400"], ["Owner", preview.owner_name||"—", ""], ["Type", preview.vehicle_type, "capitalize"], ["Slot", preview.slot_number, "font-mono"], ["Entry", new Date(preview.entry_time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}), "font-mono"], ["Duration", `${preview.duration_hours.toFixed(2)}h`, "text-green-400 font-mono"]].map(([l,v,cls]) => (
                <div key={l} className="flex justify-between items-center pb-2 border-b border-gray-700 last:border-0">
                  <span className="text-gray-400">{l}</span>
                  <span className={`font-medium ${cls}`}>{v}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-1">
                <span className="font-semibold">Total Fee</span>
                <span className="text-2xl font-bold font-mono text-amber-400">₹{preview.estimated_fee}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                {["cash","upi","card"].map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`py-2 rounded-lg text-sm font-semibold uppercase tracking-wider border transition-all
                      ${payMethod === m ? "bg-amber-400/10 border-amber-400/30 text-amber-400" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={confirmExit} disabled={loading}
              className="w-full py-3 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg font-bold text-sm hover:bg-green-500/30 transition-colors">
              {loading ? "Processing..." : `Confirm Exit · Collect ₹${preview.estimated_fee}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Records View ─────────────────────────────────────────────────────────────
function RecordsView({ records }) {
  const [filter, setFilter] = useState("all");
  const filtered = records.filter(r => filter === "all" ? true : r.status === filter);
  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {["all","active","completed"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all capitalize
              ${filter === f ? "bg-cyan-400/10 border-cyan-400/30 text-cyan-400" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}>
            {f}
          </button>
        ))}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr>{["#","Vehicle","Owner","Type","Slot","Entry","Exit","Fee","Status"].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs font-mono text-gray-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-4 text-xs font-mono text-gray-600">#{r.id}</td>
                  <td className="py-3 px-4 font-mono text-xs text-cyan-400">{r.vehicle_number}</td>
                  <td className="py-3 px-4 text-xs text-gray-300">{r.owner_name||"—"}</td>
                  <td className="py-3 px-4"><span className={`text-xs font-mono ${r.vehicle_type==="bike"?"text-cyan-400":r.vehicle_type==="car"?"text-amber-400":"text-purple-400"}`}>{r.vehicle_type}</span></td>
                  <td className="py-3 px-4 font-mono text-xs">{r.slot_number}</td>
                  <td className="py-3 px-4 text-xs font-mono text-gray-400">{r.entry_time ? new Date(r.entry_time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}) : "—"}</td>
                  <td className="py-3 px-4 text-xs font-mono text-gray-400">{r.exit_time ? new Date(r.exit_time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}) : "—"}</td>
                  <td className="py-3 px-4 font-mono text-xs text-amber-400">{r.fee ? `₹${r.fee}` : "—"}</td>
                  <td className="py-3 px-4"><span className={`text-xs font-mono px-2 py-0.5 rounded border ${r.status==="active"?"bg-green-400/10 border-green-400/20 text-green-400":"bg-gray-700/50 border-gray-600 text-gray-400"}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({ vtypes, setVtypes, slots, onSuccess }) {
  const [tab, setTab] = useState("pricing");
  const [prices, setPrices] = useState({});
  useEffect(() => { setPrices(Object.fromEntries(vtypes.map(v => [v.id, v.price_per_hour]))); }, [vtypes]);

  const savePrices = async () => {
    try {
      for (const vt of vtypes) {
        await api("PUT", `/vehicle-types/${vt.id}`, { type_name: vt.type_name, price_per_hour: parseFloat(prices[vt.id]) });
      }
      setVtypes(vtypes.map(v => ({ ...v, price_per_hour: parseFloat(prices[v.id]) })));
      onSuccess("Pricing updated!", "success");
    } catch (e) { onSuccess(e.message, "error"); }
  };

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-800 mb-5">
        {["pricing","slots","system"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all capitalize ${tab===t?"border-cyan-400 text-cyan-400":"border-transparent text-gray-500 hover:text-gray-300"}`}>
            {t === "pricing" ? "Pricing" : t === "slots" ? "Slots Overview" : "System Info"}
          </button>
        ))}
      </div>

      {tab === "pricing" && (
        <div className="max-w-md bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <p className="text-xs font-mono tracking-widest text-gray-500 uppercase">Dynamic Pricing</p>
          <div className="space-y-3">
            {vtypes.map(v => (
              <div key={v.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{v.type_name==="bike"?"🏍":v.type_name==="car"?"🚗":"🚛"}</span>
                  <span className="font-semibold capitalize">{v.type_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-mono">₹</span>
                  <input type="number" value={prices[v.id]||""} onChange={e => setPrices(p => ({...p, [v.id]: e.target.value}))}
                    className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm font-mono text-center focus:border-amber-400 focus:outline-none" />
                  <span className="text-gray-500 text-xs font-mono">/hr</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={savePrices} className="w-full py-2.5 bg-cyan-400 text-gray-900 rounded-lg font-bold text-sm">Save Pricing</button>
        </div>
      )}
      {tab === "slots" && (
        <div className="grid grid-cols-3 gap-4 max-w-2xl">
          {["bike","car","truck"].map(type => {
            const all = slots.filter(s => s.slot_type === type);
            const occ = all.filter(s => s.is_occupied).length;
            const colors = { bike: "#00C8F0", car: "#F59E0B", truck: "#8B5CF6" };
            return (
              <div key={type} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">{type}</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-gray-800 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold font-mono">{all.length}</p>
                    <p className="text-xs text-gray-500 font-mono">total</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold font-mono text-green-400">{all.length - occ}</p>
                    <p className="text-xs text-gray-500 font-mono">free</p>
                  </div>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${all.length ? Math.round(occ/all.length*100) : 0}%`, background: colors[type] }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === "system" && (
        <div className="max-w-md bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-xs font-mono tracking-widest text-gray-500 uppercase mb-4">System Information</p>
          <table className="w-full text-sm">
            <tbody>
              {[["Version","ParkSmart v1.0.0"],["Backend","FastAPI + PostgreSQL"],["ORM","SQLAlchemy"],["Deployment","Render + Supabase"],["Total Slots",slots.length],["WebSocket","Connected ✓"]].map(([k,v]) => (
                <tr key={k} className="border-b border-gray-800 last:border-0">
                  <td className="py-2.5 text-gray-500 text-xs font-mono">{k}</td>
                  <td className="py-2.5 text-cyan-400 font-mono text-xs text-right">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
