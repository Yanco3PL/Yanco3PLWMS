import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

const ESTADOS = ["Borrador", "Enviada", "Pagada"];

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function periodoLabel(p) {
  const [y, m] = p.split("-");
  const nombres = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${nombres[Number(m) - 1]} ${y}`;
}

async function registrarEvento(usuario, modulo, accion, objeto, detalle) {
  try {
    await supabase.from("auditoria").insert({ usuario: usuario || "Sin nombre", modulo, accion, objeto, detalle });
  } catch (e) { /* no bloquea la operación principal */ }
}

export default function Facturacion({ usuario }) {
  const [bines, setBines] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [tarifaFulfillment, setTarifaFulfillment] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [periodoFiltro, setPeriodoFiltro] = useState("Todos");

  const cargarTodo = useCallback(async () => {
    setError(null);
    const [b, o, f, c] = await Promise.all([
      supabase.from("bines").select("*"),
      supabase.from("ordenes").select("*"),
      supabase.from("facturas").select("*").order("periodo", { ascending: false }),
      supabase.from("configuracion").select("*").eq("clave", "tarifa_fulfillment").maybeSingle(),
    ]);
    if (b.error || o.error || f.error) {
      setError((b.error || o.error || f.error).message);
    } else {
      setBines(b.data || []);
      setOrdenes(o.data || []);
      setFacturas(f.data || []);
      if (c.data) setTarifaFulfillment(Number(c.data.valor));
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);

  const actualizarTarifa = async (v) => {
    setTarifaFulfillment(v);
    await supabase.from("configuracion").update({ valor: String(v) }).eq("clave", "tarifa_fulfillment");
  };

  const calcularStoragePorCliente = () => {
    const mapa = {};
    bines.forEach((b) => {
      const monto = Number(b.tarifa || 0) * Math.min(Number(b.actual || 0) / (Number(b.capacidad) || 1), 1);
      mapa[b.cliente] = (mapa[b.cliente] || 0) + monto;
    });
    return mapa;
  };

  const calcularFulfillmentPorCliente = (periodo) => {
    const mapa = {};
    ordenes.forEach((o) => {
      if (o.estado !== "Enviado" || !o.enviado_en) return;
      if (o.enviado_en.slice(0, 7) !== periodo) return;
      const monto = Number(o.unidades || 0) * Number(tarifaFulfillment || 0);
      mapa[o.cliente] = (mapa[o.cliente] || 0) + monto;
    });
    return mapa;
  };

  const generarBorradores = async () => {
    setSaving(true);
    const periodo = periodoActual();
    const storagePorCliente = calcularStoragePorCliente();
    const fulfillmentPorCliente = calcularFulfillmentPorCliente(periodo);
    const clientes = new Set([...Object.keys(storagePorCliente), ...Object.keys(fulfillmentPorCliente)]);

    for (const cliente of clientes) {
      const storage = storagePorCliente[cliente] || 0;
      const fulfillment = fulfillmentPorCliente[cliente] || 0;
      const existente = facturas.find((f) => f.cliente === cliente && f.periodo === periodo);
      if (!existente) {
        await supabase.from("facturas").insert({ cliente, periodo, storage, fulfillment, ajuste: 0, estado: "Borrador" });
      } else if (existente.estado === "Borrador") {
        await supabase.from("facturas").update({ storage, fulfillment }).eq("id", existente.id);
      }
    }
    registrarEvento(usuario, "Facturación", "Borradores generados", periodo, `${clientes.size} cliente(s)`);
    await cargarTodo();
    setSaving(false);
  };

  const updateFactura = async (factura, patch) => {
    setSaving(true);
    const { error: err } = await supabase.from("facturas").update(patch).eq("id", factura.id);
    if (err) setError(err.message);
    else if (patch.estado && patch.estado !== factura.estado) {
      registrarEvento(usuario, "Facturación", "Cambio de estado", `${factura.cliente} · ${factura.periodo}`, `${factura.estado} → ${patch.estado}`);
    }
    await cargarTodo();
    setSaving(false);
  };

  const deleteFactura = async (factura) => {
    setSaving(true);
    const { error: err } = await supabase.from("facturas").delete().eq("id", factura.id);
    if (err) setError(err.message);
    else registrarEvento(usuario, "Facturación", "Eliminada", `${factura.cliente} · ${factura.periodo}`, "");
    await cargarTodo();
    setSaving(false);
  };

  if (loading) return <p style={{ color: "#626E8C" }}>Cargando facturación…</p>;

  const periodos = ["Todos", ...Array.from(new Set(facturas.map((f) => f.periodo))).sort().reverse()];
  const visibles = periodoFiltro === "Todos" ? facturas : facturas.filter((f) => f.periodo === periodoFiltro);

  const totalPeriodoActual = facturas
    .filter((f) => f.periodo === periodoActual())
    .reduce((s, f) => s + Number(f.storage) + Number(f.fulfillment) + Number(f.ajuste || 0), 0);
  const pendientesEnvio = facturas.filter((f) => f.estado === "Borrador").length;
  const pagadas = facturas.filter((f) => f.estado === "Pagada").length;
  const sinCobrar = facturas.filter((f) => f.estado !== "Pagada").reduce((s, f) => s + Number(f.storage) + Number(f.fulfillment) + Number(f.ajuste || 0), 0);

  const totalGeneral = visibles.reduce((s, f) => s + Number(f.storage) + Number(f.fulfillment) + Number(f.ajuste || 0), 0);
  const porCliente = {};
  visibles.forEach((f) => {
    const t = Number(f.storage) + Number(f.fulfillment) + Number(f.ajuste || 0);
    porCliente[f.cliente] = (porCliente[f.cliente] || 0) + t;
  });
  const concentracion = Object.entries(porCliente)
    .map(([cliente, monto]) => ({ cliente, monto, pct: totalGeneral ? (monto / totalGeneral) * 100 : 0 }))
    .sort((a, b) => b.monto - a.monto);
  const clienteAncla = concentracion[0];
  const enRiesgoConcentracion = clienteAncla && clienteAncla.pct > 40;

  return (
    <div>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="summary-row">
        <div className="card">
          <div className="card-label">Facturado este mes ({periodoLabel(periodoActual())})</div>
          <div className="card-big">{money(totalPeriodoActual)}</div>
          <div className="card-meta">storage + fulfillment</div>
        </div>
        <div className="card">
          <div className="card-label">Borradores sin enviar</div>
          <div className="card-big">{pendientesEnvio}</div>
          <div className="card-meta">listos para revisar</div>
        </div>
        <div className="card">
          <div className="card-label">Pagadas</div>
          <div className="card-big">{pagadas}</div>
          <div className="card-meta">histórico</div>
        </div>
        <div className="card card-total">
          <div className="card-label">Por cobrar (sin pagar)</div>
          <div className="card-big">{money(sinCobrar)}</div>
          <div className="card-meta">borrador + enviada</div>
        </div>
      </div>

      <div className="tab-toolbar" style={{ padding: "0 0 10px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 13, color: "#626E8C" }}>
            Tarifa fulfillment/unidad:
            <input className="input" style={{ width: 70, marginLeft: 6, display: "inline-block" }} type="number" min="0" step="0.1"
              value={tarifaFulfillment} onChange={(e) => actualizarTarifa(e.target.value)} />
          </label>
          <select className="select" value={periodoFiltro} onChange={(e) => setPeriodoFiltro(e.target.value)}>
            {periodos.map((p) => <option key={p} value={p}>{p === "Todos" ? "Todos los períodos" : periodoLabel(p)}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={generarBorradores}>↻ Generar/actualizar borradores del mes</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th><th>Período</th>
              <th style={{ textAlign: "right" }}>Storage</th><th style={{ textAlign: "right" }}>Fulfillment</th>
              <th style={{ textAlign: "right" }}>Ajuste</th><th style={{ textAlign: "right" }}>Total</th>
              <th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => {
              const total = Number(f.storage) + Number(f.fulfillment) + Number(f.ajuste || 0);
              return (
                <tr key={f.id}>
                  <td className="input text" style={{ border: "none", padding: "8px 12px" }}>{f.cliente}</td>
                  <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono', monospace" }}>{periodoLabel(f.periodo)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{money(f.storage)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{money(f.fulfillment)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <input className="input" type="number" step="0.5" defaultValue={f.ajuste} onBlur={(e) => Number(e.target.value) !== Number(f.ajuste) && updateFactura(f, { ajuste: e.target.value })} />
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{money(total)}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <select className="select" value={f.estado} onChange={(e) => updateFactura(f, { estado: e.target.value })}>
                      {ESTADOS.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <button className="del-btn" onClick={() => deleteFactura(f)}>×</button>
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#8791AD", padding: 24 }}>Sin facturas todavía. Pulsa "Generar/actualizar borradores del mes".</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "22px 0 8px" }}>Concentración de clientes</h2>
      <div style={{ background: "#fff", border: "1px solid #E2E5EF", borderRadius: 4, padding: 16 }}>
        {enRiesgoConcentracion && (
          <div style={{ background: "#FBEAE8", border: "1px solid #E8B8B2", color: "#9A342A", fontSize: 12.5, padding: "8px 12px", borderRadius: 4, marginBottom: 14 }}>
            ⚠ {clienteAncla.cliente} representa {clienteAncla.pct.toFixed(0)}% de la facturación — por encima de la meta de mantenerse bajo 40%.
          </div>
        )}
        {concentracion.map((c) => (
          <div key={c.cliente} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
              <span style={{ fontWeight: 500 }}>{c.cliente}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: c.pct > 40 ? "#D6473C" : "#626E8C" }}>{money(c.monto)} · {c.pct.toFixed(0)}%</span>
            </div>
            <div style={{ position: "relative", height: 8, background: "#F4F5FA", borderRadius: 4 }}>
              <div style={{ height: 8, borderRadius: 4, width: `${Math.min(c.pct, 100)}%`, background: c.pct > 40 ? "#D6473C" : "#101B3D" }} />
              <div style={{ position: "absolute", left: "40%", top: -2, bottom: -2, width: 2, background: "#14213D55" }} />
            </div>
          </div>
        ))}
        {concentracion.length === 0 && <div style={{ fontSize: 13, color: "#8791AD" }}>Sin facturas para calcular concentración todavía.</div>}
        <div style={{ fontSize: 11, color: "#8791AD", marginTop: 8 }}>La línea vertical marca el 40% — su meta es que ningún cliente la pase.</div>
      </div>

      <p className="footnote">Storage se recalcula de la ocupación real de bines cada vez que generas borradores. Fulfillment cuenta unidades de órdenes marcadas "Enviado" dentro del mes. Una vez que marcas "Enviada" o "Pagada", esos montos quedan congelados.</p>
    </div>
  );
}
