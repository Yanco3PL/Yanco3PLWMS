export default async function handler(req, res) {
  try {
    const token = process.env.EBAY_USER_TOKEN;
    if (!token) {
      res.status(500).json({ error: "Falta configurar EBAY_USER_TOKEN en las Environment Variables de Vercel." });
      return;
    }

    const r = await fetch("https://api.ebay.com/sell/fulfillment/v1/order?limit=20", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await r.json();

    if (!r.ok) {
      res.status(r.status).json({ error: data });
      return;
    }

    const pedidos = (data.orders || []).map((o) => ({
      orderId: o.orderId,
      creado: o.creationDate,
      estado: o.orderFulfillmentStatus,
      comprador: o.buyer?.username || "",
      total: o.pricingSummary?.total?.value || 0,
      moneda: o.pricingSummary?.total?.currency || "USD",
      items: (o.lineItems || []).map((li) => ({
        sku: li.sku || "",
        titulo: li.title || "",
        cantidad: li.quantity || 0,
      })),
    }));

    res.status(200).json({ pedidos, total: data.total || pedidos.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
