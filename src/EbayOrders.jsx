import React, { useState, useEffect, useCallback } from "react";

function money(n, c) {
  return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: c || "USD" });
}
function fmtFecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EbayOrders() {
  const [pedidos, setPedidos] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ebay-orders");
      const data = await r.json();
      if (!r.ok || data.error) {
        setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        setPedidos([]);
      } else {
        setPedidos(data.pedidos || []);
      }
    } catch (e) {
      setError(String(e));
      setPedidos([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <div className="tab-toolbar" style={{ padding: "0 0 10px", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          {pedidos ? `${pedidos.length} pedido(s) recientes de eBay` : "Cargando…"}
        </div>
        <button className="btn btn-primary" onClick={cargar}>↻ Refrescar</button>
      </div>

      {error && (
        <div style={{ background: "#FBEAE8", border: "1px solid #E8B8B2", color: "#9A342A", fontSize: 12.5, padding: "10px 14px", borderRadius: 6, marginBottom: 14, whiteSpace: "pre-wrap" }}>
          <strong>No se pudo conectar con eBay:</strong> {error}
          {error.includes("token") || error.includes("expired") || error.includes("401") ? (
            <div style={{ marginTop: 6 }}>Es probable que el token haya expirado (duran ~2 horas) — hay que generar uno nuevo, o pasar a usar un refresh token para que no se caiga.</div>
          ) : null}
        </div>
      )}

      {loading && <p style={{ color: "var(--muted)" }}>Cargando pedidos de eBay…</p>}

      {!loading && pedidos && pedidos.length === 0 && !error && (
        <div className="table-wrap" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
          No hay pedidos recientes en tu cuenta de eBay.
        </div>
      )}

      {!loading && pedidos && pedidos.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order ID</th><th>Comprador</th><th>Fecha</th><th>Estado</th>
                <th style={{ textAlign: "right" }}>Total</th><th>Items</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.orderId}>
                  <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{p.orderId}</td>
                  <td style={{ padding: "8px 12px" }}>{p.comprador}</td>
                  <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{fmtFecha(p.creado)}</td>
                  <td style={{ padding: "8px 12px" }}>{p.estado}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{money(p.total, p.moneda)}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12.5 }}>
                    {p.items.map((it, i) => <div key={i}>{it.cantidad}× {it.titulo || it.sku}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="footnote">Esto lee tus pedidos directo de eBay (Fulfillment API) — todavía no los mete al WMS ni descuenta inventario. Es la prueba de que la conexión funciona.</p>
    </div>
  );
}
