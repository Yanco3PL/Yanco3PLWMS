import crypto from "crypto";

// Estos dos valores deben coincidir EXACTAMENTE con lo que pongas en el
// formulario de eBay (Application Keys → Production → "Marketplace Account
// Deletion" → Notification Endpoint / Verification token).
const VERIFICATION_TOKEN = "serya_wms_marketplace_deletion_verification_2026_tok";
const ENDPOINT_URL = "https://yanco3-plwms.vercel.app/api/ebay-deletion";

export default function handler(req, res) {
  if (req.method === "GET") {
    const challengeCode = req.query.challenge_code;
    if (!challengeCode) {
      res.status(400).json({ error: "missing challenge_code" });
      return;
    }
    const hash = crypto.createHash("sha256");
    hash.update(challengeCode);
    hash.update(VERIFICATION_TOKEN);
    hash.update(ENDPOINT_URL);
    const challengeResponse = hash.digest("hex");
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ challengeResponse });
    return;
  }

  if (req.method === "POST") {
    // Aquí eBay notifica cuando un usuario borra su cuenta de eBay.
    // Serya no guarda datos personales de compradores de eBay (solo
    // pedidos operativos), así que por ahora solo confirmamos recibido.
    // Si más adelante guardamos datos de comprador, aquí habría que
    // borrarlos.
    res.status(200).json({ received: true });
    return;
  }

  res.status(405).end();
}
