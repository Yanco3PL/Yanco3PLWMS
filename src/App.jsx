import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

const TIPOS = ["Bin Grande", "Bin Chico", "Pallet", "Caja SA Box"];
const CANALES = ["Web/DTC", "Dealer/B2B", "FBA", "Kitting"];
const ESTADOS_REC = ["Pendiente", "En proceso", "Completo", "Con discrepancia"];
const ESTADOS_ORD = ["Pendiente", "Pickeando", "Empacado", "Enviado"];
const PRIORIDADES = ["Normal", "Urgente"];

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtFecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function horasEntre(inicioIso, finIso) {
  const inicio = new Date(inicioIso).getTime();
  const fin = finIso ? new Date(finIso).getTime() : Date.now();
  return (fin - inicio) / 3600000;
}

async function registrarEvento(usuario, modulo, accion, objeto, detalle) {
  try {
    await supabase.from("auditoria").insert({ usuario: usuario || "Sin nombre", modulo, accion, objeto, detalle });
  } catch (e) { /* no bloquea la operación principal */ }
}

export default function App() {
  const [tab, setTab] = useState("inventario");
  const [bines, setBines] = useState([]);
  const [recepciones, setRecepciones] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [usuario, setUsuario] = useState(() => localStorage.getItem("serya_usuario") || "");

  const actualizarUsuario = (v) => {
    setUsuario(v);
    localStorage.setItem("serya_usuario", v);
  };

  const cargarTodo = useCallback(async () => {
    setError(null);
    const [b, r, o] = await Promise.all([
      supabase.from("bines").select("*").order("codigo"),
      supabase.from("recepciones").select("*").order("creado_en", { ascending: false }),
      supabase.from("ordenes").select("*").order("creado_en", { ascending: false }),
    ]);
    if (b.error || r.error || o.error) {
      setError((b.error || r.error || o.error).message);
    } else {
      setBines(b.data || []);
      setRecepciones(r.data || []);
      setOrdenes(o.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);
  useEffect(() => {
    const t = setInterval(cargarTodo, 60000);
    return () => clearInterval(t);
  }, [cargarTodo]);

  // ---------- BINES ----------
  const updateBin = async (bin, patch) => {
    setSaving(true);
    const { error: err } = await supabase.from("bines").update(patch).eq("id", bin.id);
    if (err) setError(err.message);
    else if ("actual" in patch && String(patch.actual) !== String(bin.actual)) {
      registrarEvento(usuario, "Inventario", "Ajuste manual", bin.codigo, `${bin.actual} → ${patch.actual} unidades`);
    }
    await cargarTodo();
    setSaving(false);
  };
  const addBin = async () => {
    setSaving(true);
    const { data, error: err } = await supabase.from("bines").insert({
      codigo: `NUEVO-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      tipo: TIPOS[0], cliente: "", almacen: "Miami - Principal", capacidad: 1, actual: 0, tarifa: 0,
    }).select().single();
    if (err) setError(err.message);
    else registrarEvento(usuario, "Inventario", "Bin creado", data.codigo, "");
    await cargarTodo();
    setSaving(false);
  };
  const deleteBin = async (bin) => {
    setSaving(true);
    const { error: err } = await supabase.from("bines").delete().eq("id", bin.id);
    if (err) setError(err.message);
    else registrarEvento(usuario, "Inventario", "Bin eliminado", bin.codigo, "");
    await cargarTodo();
    setSaving(false);
  };

  // ---------- RECEPCIONES ----------
  const updateRecepcion = async (rec, patch) => {
    setSaving(true);
    let updates = { ...patch };
    const nuevoEstado = patch.estado ?? rec.estado;
    const bin = bines.find((b) => b.codigo === (patch.bin_codigo ?? rec.bin_codigo));

    if (nuevoEstado === "Completo" && !rec.aplicado) {
      const cantidad = Number(patch.recibido ?? rec.recibido ?? 0);
      if (bin) await supabase.from("bines").update({ actual: Math.max(0, Number(bin.actual) + cantidad) }).eq("id", bin.id);
      updates.aplicado = true;
      updates.completado_en = new Date().toISOString();
    } else if (rec.aplicado && patch.estado && patch.estado !== "Completo") {
      const cantidad = Number(rec.recibido || 0);
      if (bin) await supabase.from("bines").update({ actual: Math.max(0, Number(bin.actual) - cantidad) }).eq("id", bin.id);
      updates.aplicado = false;
      updates.completado_en = null;
    }
    const { error: err } = await supabase.from("recepciones").update(updates).eq("id", rec.id);
    if (err) setError(err.message);
    else if (patch.estado && patch.estado !== rec.estado) {
      registrarEvento(usuario, "Recepción", "Cambio de estado", rec.po || rec.id, `${rec.estado} → ${patch.estado}`);
    }
    await cargarTodo();
    setSaving(false);
  };
  const addRecepcion = async () => {
    setSaving(true);
    const { data, error: err } = await supabase.from("recepciones").insert({
      cliente: "", po: "", sku: "", esperado: 0, recibido: 0, bin_codigo: bines[0]?.codigo || null, estado: "Pendiente",
    }).select().single();
    if (err) setError(err.message);
    else registrarEvento(usuario, "Recepción", "Creada", data.id, "");
    await cargarTodo();
    setSaving(false);
  };
  const deleteRecepcion = async (rec) => {
    setSaving(true);
    const { error: err } = await supabase.from("recepciones").delete().eq("id", rec.id);
    if (err) setError(err.message);
    else registrarEvento(usuario, "Recepción", "Eliminada", rec.po || rec.id, "");
    await cargarTodo();
    setSaving(false);
  };

  // ---------- ORDENES ----------
  const updateOrden = async (ord, patch) => {
    setSaving(true);
    let updates = { ...patch };
    const nuevoEstado = patch.estado ?? ord.estado;
    const bin = bines.find((b) => b.codigo === (patch.bin_codigo ?? ord.bin_codigo));

    if (nuevoEstado === "Enviado" && !ord.aplicado) {
      const cantidad = Number(patch.unidades ?? ord.unidades ?? 0);
      if (bin) await supabase.from("bines").update({ actual: Math.max(0, Number(bin.actual) - cantidad) }).eq("id", bin.id);
      updates.aplicado = true;
      updates.enviado_en = new Date().toISOString();
    } else if (ord.aplicado && patch.estado && patch.estado !== "Enviado") {
      const cantidad = Number(ord.unidades || 0);
      if (bin) await supabase.from("bines").update({ actual: Math.max(0, Number(bin.actual) + cantidad) }).eq("id", bin.id);
      updates.aplicado = false;
      updates.enviado_en = null;
    }
    const { error: err } = await supabase.from("ordenes").update(updates).eq("id", ord.id);
    if (err) setError(err.message);
    else if (patch.estado && patch.estado !== ord.estado) {
      registrarEvento(usuario, "Picking", "Cambio de estado", ord.orden || ord.id, `${ord.estado} → ${patch.estado}`);
    }
    await cargarTodo();
    setSaving(false);
  };
  const addOrden = async () => {
    setSaving(true);
    const { data, error: err } = await supabase.from("ordenes").insert({
      cliente: "", orden: "", canal: CANALES[0], items: 1, unidades: 1, bin_codigo: bines[0]?.codigo || null, estado: "Pendiente", prioridad: "Normal",
    }).select().single();
    if (err) setError(err.message);
    else registrarEvento(usuario, "Picking", "Orden creada", data.id, "");
    await cargarTodo();
    setSaving(false);
  };
  const deleteOrden = async (ord) => {
    setSaving(true);
    const { error: err } = await supabase.from("ordenes").delete().eq("id", ord.id);
    if (err) setError(err.message);
    else registrarEvento(usuario, "Picking", "Orden eliminada", ord.orden || ord.id, "");
    await cargarTodo();
    setSaving(false);
  };

  if (loading) return <div className="app"><p style={{ color: "#5B6672" }}>Cargando WMS…</p></div>;

  const unidadesTotal = bines.reduce((s, b) => s + Number(b.actual || 0), 0);
  const capacidadTotal = bines.reduce((s, b) => s + Number(b.capacidad || 0), 0);
  const ingresoTotal = bines.reduce((s, b) => s + Number(b.tarifa || 0) * Math.min(Number(b.actual || 0) / (Number(b.capacidad) || 1), 1), 0);
  const recepcionesAbiertas = recepciones.filter((r) => r.estado !== "Completo" && r.estado !== "Con discrepancia").length;
  const ordenesAbiertas = ordenes.filter((o) => o.estado !== "Enviado").length;

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="eyebrow">SERYA · WMS</div>
          <h1 className="h1">Inventario, recepción y picking</h1>
          <p className="sub">Conectado en vivo a la base de datos — cualquiera con este link ve y edita lo mismo.</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <label className="user-label">
            Tú eres:
            <input className="input text" style={{ width: 110, marginLeft: 6, display: "inline-block" }}
              placeholder="tu nombre" value={usuario} onChange={(e) => actualizarUsuario(e.target.value)} />
          </label>
          <div className="save-state">{saving ? "Guardando…" : "Guardado"}</div>
          {error && <div className="error-msg">{error}</div>}
        </div>
      </header>

      <div className="summary-row">
        <div className="card">
          <div className="card-label">Unidades en inventario</div>
          <div className="card-big">{unidadesTotal} <span style={{ fontSize: 14, color: "#8A93A0" }}>/ {capacidadTotal}</span></div>
          <div className="card-meta">capacidad usada</div>
        </div>
        <div className="card">
          <div className="card-label">Recepciones abiertas</div>
          <div className="card-big">{recepcionesAbiertas}</div>
          <div className="card-meta">pendiente / en proceso</div>
        </div>
        <div className="card">
          <div className="card-label">Órdenes abiertas</div>
          <div className="card-big">{ordenesAbiertas}</div>
          <div className="card-meta">por pickear / empacar</div>
        </div>
        <div className="card card-total">
          <div className="card-label">Ingreso mensual por storage</div>
          <div className="card-big">{money(ingresoTotal)}</div>
          <div className="card-meta">según ocupación actual</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "inventario" ? "active" : ""}`} onClick={() => setTab("inventario")}>Inventario</button>
        <button className={`tab ${tab === "recepcion" ? "active" : ""}`} onClick={() => setTab("recepcion")}>Recepción</button>
        <button className={`tab ${tab === "picking" ? "active" : ""}`} onClick={() => setTab("picking")}>Picking / Packing</button>
      </div>

      {tab === "inventario" && (
        <div className="table-wrap">
          <div className="tab-toolbar">
            <button className="btn btn-primary" onClick={addBin}>+ Nuevo bin</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Código</th><th>Tipo</th><th>Cliente</th><th>Almacén</th>
                <th style={{ textAlign: "right" }}>Capacidad</th><th style={{ textAlign: "right" }}>Actual</th>
                <th style={{ textAlign: "right" }}>% Llenado</th><th style={{ textAlign: "right" }}>Tarifa/mes</th>
                <th style={{ textAlign: "right" }}>Monto</th><th></th>
              </tr>
            </thead>
            <tbody>
              {bines.map((b) => {
                const pct = Math.min((Number(b.actual || 0) / (Number(b.capacidad) || 1)) * 100, 999);
                const sobre = Number(b.actual) > Number(b.capacidad);
                const monto = Number(b.tarifa || 0) * Math.min(Number(b.actual || 0) / (Number(b.capacidad) || 1), 1);
                return (
                  <tr key={b.id}>
                    <td><input className="input" defaultValue={b.codigo} onBlur={(e) => e.target.value !== b.codigo && updateBin(b, { codigo: e.target.value })} /></td>
                    <td>
                      <select className="select" value={b.tipo} onChange={(e) => updateBin(b, { tipo: e.target.value })}>
                        {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td><input className="input text" defaultValue={b.cliente} onBlur={(e) => e.target.value !== b.cliente && updateBin(b, { cliente: e.target.value })} /></td>
                    <td><input className="input text" defaultValue={b.almacen} onBlur={(e) => e.target.value !== b.almacen && updateBin(b, { almacen: e.target.value })} /></td>
                    <td style={{ textAlign: "right" }}><input className="input" type="number" defaultValue={b.capacidad} onBlur={(e) => Number(e.target.value) !== Number(b.capacidad) && updateBin(b, { capacidad: e.target.value })} /></td>
                    <td style={{ textAlign: "right" }}><input className="input" type="number" defaultValue={b.actual} onBlur={(e) => Number(e.target.value) !== Number(b.actual) && updateBin(b, { actual: e.target.value })} /></td>
                    <td style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, color: sobre ? "#C24B3F" : "#1B232C" }}>{pct.toFixed(0)}%</td>
                    <td style={{ textAlign: "right" }}><input className="input" type="number" step="0.5" defaultValue={b.tarifa} onBlur={(e) => Number(e.target.value) !== Number(b.tarifa) && updateBin(b, { tarifa: e.target.value })} /></td>
                    <td style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500 }}>{money(monto)}</td>
                    <td style={{ textAlign: "center" }}><button className="del-btn" onClick={() => deleteBin(b)}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="footnote">Edita un campo y haz clic fuera (o Tab) para guardar — igual que una hoja de cálculo.</p>
        </div>
      )}

      {tab === "recepcion" && (
        <div className="table-wrap">
          <div className="tab-toolbar">
            <button className="btn btn-primary" onClick={addRecepcion}>+ Nueva recepción</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th>PO</th><th>SKU</th>
                <th style={{ textAlign: "right" }}>Esperado</th><th style={{ textAlign: "right" }}>Recibido</th>
                <th>Bin destino</th><th>Estado</th><th>Llegada</th><th style={{ textAlign: "right" }}>Horas</th><th></th>
              </tr>
            </thead>
            <tbody>
              {recepciones.map((r) => {
                const h = horasEntre(r.llegada, r.completado_en);
                const enRiesgo = r.estado !== "Completo" && h > 24;
                const discre = Number(r.recibido) !== Number(r.esperado) && r.estado !== "Pendiente";
                return (
                  <tr key={r.id}>
                    <td><input className="input text" defaultValue={r.cliente} onBlur={(e) => e.target.value !== r.cliente && updateRecepcion(r, { cliente: e.target.value })} /></td>
                    <td><input className="input" defaultValue={r.po} onBlur={(e) => e.target.value !== r.po && updateRecepcion(r, { po: e.target.value })} /></td>
                    <td><input className="input" defaultValue={r.sku} onBlur={(e) => e.target.value !== r.sku && updateRecepcion(r, { sku: e.target.value })} /></td>
                    <td style={{ textAlign: "right" }}><input className="input" type="number" defaultValue={r.esperado} onBlur={(e) => Number(e.target.value) !== Number(r.esperado) && updateRecepcion(r, { esperado: e.target.value })} /></td>
                    <td style={{ textAlign: "right" }}><input className="input" type="number" defaultValue={r.recibido} style={discre ? { borderColor: "#D98C2B", color: "#D98C2B" } : {}} onBlur={(e) => Number(e.target.value) !== Number(r.recibido) && updateRecepcion(r, { recibido: e.target.value })} /></td>
                    <td>
                      <select className="select" value={r.bin_codigo || ""} onChange={(e) => updateRecepcion(r, { bin_codigo: e.target.value })}>
                        <option value="">— sin bin —</option>
                        {bines.map((b) => <option key={b.id} value={b.codigo}>{b.codigo}</option>)}
                      </select>
                      {r.aplicado && <div className="ok-tiny">✓ aplicado</div>}
                    </td>
                    <td>
                      <select className="select" value={r.estado} onChange={(e) => updateRecepcion(r, { estado: e.target.value })}>
                        {ESTADOS_REC.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
                      </select>
                    </td>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, whiteSpace: "nowrap" }}>{fmtFecha(r.llegada)}</td>
                    <td style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, color: enRiesgo ? "#C24B3F" : "#1B232C" }}>{h.toFixed(1)}h</td>
                    <td style={{ textAlign: "center" }}><button className="del-btn" onClick={() => deleteRecepcion(r)}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="footnote">Al marcar "Completo", "Recibido" se suma al bin destino una sola vez. Si regresas el estado, se revierte.</p>
        </div>
      )}

      {tab === "picking" && (
        <div className="table-wrap">
          <div className="tab-toolbar">
            <button className="btn btn-primary" onClick={addOrden}>+ Nueva orden</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Orden</th><th>Cliente</th><th>Canal</th><th style={{ textAlign: "right" }}>Unidades</th>
                <th>Bin origen</th><th>Prioridad</th><th>Estado</th><th style={{ textAlign: "right" }}>Horas</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => {
                const h = horasEntre(o.creado_en, o.enviado_en);
                return (
                  <tr key={o.id}>
                    <td><input className="input" defaultValue={o.orden} onBlur={(e) => e.target.value !== o.orden && updateOrden(o, { orden: e.target.value })} /></td>
                    <td><input className="input text" defaultValue={o.cliente} onBlur={(e) => e.target.value !== o.cliente && updateOrden(o, { cliente: e.target.value })} /></td>
                    <td>
                      <select className="select" value={o.canal} onChange={(e) => updateOrden(o, { canal: e.target.value })}>
                        {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: "right" }}><input className="input" type="number" defaultValue={o.unidades} onBlur={(e) => Number(e.target.value) !== Number(o.unidades) && updateOrden(o, { unidades: e.target.value })} /></td>
                    <td>
                      <select className="select" value={o.bin_codigo || ""} onChange={(e) => updateOrden(o, { bin_codigo: e.target.value })}>
                        <option value="">— sin bin —</option>
                        {bines.map((b) => <option key={b.id} value={b.codigo}>{b.codigo}</option>)}
                      </select>
                      {o.aplicado && <div className="ok-tiny">✓ aplicado</div>}
                    </td>
                    <td>
                      <select className="select" value={o.prioridad} onChange={(e) => updateOrden(o, { prioridad: e.target.value })} style={o.prioridad === "Urgente" ? { color: "#D98C2B", fontWeight: 600 } : {}}>
                        {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="select" value={o.estado} onChange={(e) => updateOrden(o, { estado: e.target.value })}>
                        {ESTADOS_ORD.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500 }}>{h.toFixed(1)}h</td>
                    <td style={{ textAlign: "center" }}><button className="del-btn" onClick={() => deleteOrden(o)}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="footnote">Al marcar "Enviado", "Unidades" se resta del bin origen una sola vez. Si regresas el estado, se revierte.</p>
        </div>
      )}
    </div>
  );
}
