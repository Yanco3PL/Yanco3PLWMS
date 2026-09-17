import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const COLORS = { navy: "#101B3D", orange: "#FF5A1F", teal: "#0FA3A3", success: "#189A5C", warning: "#E08A1E", danger: "#D6473C", muted: "#8791AD" };
const CANAL_COLORS = { "Web/DTC": "#101B3D", "Dealer/B2B": "#FF5A1F", "FBA": "#0FA3A3", "Kitting": "#E08A1E" };

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Dashboard() {
  const [bines, setBines] = useState([]);
  const [recepciones, setRecepciones] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    const [b, r, o, f] = await Promise.all([
      supabase.from("bines").select("*"),
      supabase.from("recepciones").select("*"),
      supabase.from("ordenes").select("*"),
      supabase.from("facturas").select("*"),
    ]);
    setBines(b.data || []);
    setRecepciones(r.data || []);
    setOrdenes(o.data || []);
    setFacturas(f.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <p style={{ color: "var(--muted)" }}>Cargando dashboard…</p>;

  // KPI: accuracy de picking
  const enviadas = ordenes.filter((o) => o.estado === "Enviado");
  const conError = enviadas.filter((o) => o.error_picking).length;
  const accuracy = enviadas.length ? ((enviadas.length - conError) / enviadas.length) * 100 : 100;

  // KPI: dock-to-stock dentro de 24h
  const completadas = recepciones.filter((r) => r.estado === "Completo" && r.completado_en);
  const dentroDeSLA = completadas.filter((r) => (new Date(r.completado_en) - new Date(r.llegada)) / 3600000 <= 24).length;
  const slaDockToStock = completadas.length ? (dentroDeSLA / completadas.length) * 100 : 100;

  // KPI: ocupación
  const unidadesTotal = bines.reduce((s, b) => s + Number(b.actual || 0), 0);
  const capacidadTotal = bines.reduce((s, b) => s + Number(b.capacidad || 0), 0);
  const ocupacion = capacidadTotal ? (unidadesTotal / capacidadTotal) * 100 : 0;

  // KPI: ingreso del mes + concentración del cliente ancla
  const facturasMes = facturas.filter((f) => f.periodo === periodoActual());
  const ingresoMes = facturasMes.reduce((s, f) => s + Number(f.storage) + Number(f.fulfillment) + Number(f.ajuste || 0), 0);
  const porCliente = {};
  facturasMes.forEach((f) => {
    const t = Number(f.storage) + Number(f.fulfillment) + Number(f.ajuste || 0);
    porCliente[f.cliente] = (porCliente[f.cliente] || 0) + t;
  });
  const clientesOrdenados = Object.entries(porCliente).sort((a, b) => b[1] - a[1]);
  const concentracionAncla = ingresoMes ? ((clientesOrdenados[0]?.[1] || 0) / ingresoMes) * 100 : 0;

  // Gráfica: unidades por cliente
  const unidadesPorCliente = {};
  bines.forEach((b) => { unidadesPorCliente[b.cliente] = (unidadesPorCliente[b.cliente] || 0) + Number(b.actual || 0); });
  const dataUnidadesCliente = Object.entries(unidadesPorCliente).map(([cliente, unidades]) => ({ cliente, unidades }));

  // Gráfica: órdenes enviadas por día, últimos 14 días
  const dias = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const enviosPorDia = {};
  ordenes.forEach((o) => { if (o.enviado_en) { const dia = o.enviado_en.slice(0, 10); enviosPorDia[dia] = (enviosPorDia[dia] || 0) + 1; } });
  const dataEnviosPorDia = dias.map((d) => ({ dia: d.slice(5), ordenes: enviosPorDia[d] || 0 }));

  // Gráfica: distribución por canal
  const porCanal = {};
  ordenes.forEach((o) => { porCanal[o.canal] = (porCanal[o.canal] || 0) + 1; });
  const dataCanal = Object.entries(porCanal).map(([canal, cantidad]) => ({ canal, cantidad }));

  return (
    <div>
      <div className="summary-row">
        <div className="card" style={{ borderTopColor: accuracy < 99.5 ? COLORS.danger : COLORS.success }}>
          <div className="card-label">Accuracy de picking</div>
          <div className="card-big" style={{ color: accuracy < 99.5 ? COLORS.danger : COLORS.navy }}>{accuracy.toFixed(1)}%</div>
          <div className="card-meta">meta: ≥ 99.5%</div>
        </div>
        <div className="card" style={{ borderTopColor: slaDockToStock < 99 ? COLORS.danger : COLORS.success }}>
          <div className="card-label">SLA dock-to-stock (≤24h)</div>
          <div className="card-big" style={{ color: slaDockToStock < 99 ? COLORS.danger : COLORS.navy }}>{slaDockToStock.toFixed(1)}%</div>
          <div className="card-meta">meta: ≥ 99%</div>
        </div>
        <div className="card">
          <div className="card-label">Ocupación de inventario</div>
          <div className="card-big">{ocupacion.toFixed(0)}%</div>
          <div className="card-meta">{unidadesTotal} / {capacidadTotal} unidades</div>
        </div>
        <div className="card" style={{ borderTopColor: concentracionAncla > 40 ? COLORS.warning : COLORS.success }}>
          <div className="card-label">Concentración cliente ancla</div>
          <div className="card-big" style={{ color: concentracionAncla > 40 ? COLORS.warning : COLORS.navy }}>{concentracionAncla.toFixed(0)}%</div>
          <div className="card-meta">meta: &lt; 40%</div>
        </div>
        <div className="card card-total">
          <div className="card-label">Ingreso este mes</div>
          <div className="card-big">{money(ingresoMes)}</div>
          <div className="card-meta">storage + fulfillment</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14, marginBottom: 14 }}>
        <div className="table-wrap" style={{ borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>Órdenes enviadas — últimos 14 días</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dataEnviosPorDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EF" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#8791AD" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8791AD" }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="ordenes" stroke={COLORS.orange} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="table-wrap" style={{ borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>Órdenes por canal</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dataCanal} dataKey="cantidad" nameKey="canal" cx="50%" cy="50%" outerRadius={75} label={({ canal, percent }) => `${canal} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 11 }}>
                {dataCanal.map((d, i) => <Cell key={i} fill={CANAL_COLORS[d.canal] || COLORS.muted} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="table-wrap" style={{ borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>Unidades en inventario por cliente</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dataUnidadesCliente} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EF" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#8791AD" }} />
            <YAxis type="category" dataKey="cliente" tick={{ fontSize: 11.5, fill: "#14213D" }} width={180} />
            <Tooltip />
            <Bar dataKey="unidades" fill={COLORS.navy} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="footnote">Todo se calcula en vivo desde inventario, recepción, picking y facturación — no hay números guardados aparte que se puedan desactualizar.</p>
    </div>
  );
}
