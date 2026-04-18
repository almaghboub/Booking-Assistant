import crypto from "crypto";
import type { Express } from "express";

// Moamalat LightBox URLs
export const LIGHTBOX_SCRIPT_URL =
  process.env.NODE_ENV === "production"
    ? "https://npg.moamalat.net:6006/js/lightbox.js"
    : "https://tnpg.moamalat.net:6006/js/lightbox.js";

// Generate TrxDateTime in required format: yyyyMMddHHmm
function formatTrxDateTime(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}${MM}${dd}${HH}${mm}`;
}

// Compute HMAC-SHA256 over a sorted field string, using hex-decoded merchant key.
// Returns uppercase hex.
function computeHmac(fields: Record<string, string>, secretHex: string): string {
  const key = Buffer.from(secretHex, "hex");
  // Sort field names ascending
  const queryString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
  return crypto.createHmac("sha256", key).update(queryString).digest("hex").toUpperCase();
}

export function registerMoamalatRoutes(app: Express) {
  // ── POST /api/moamalat/create-payment ──────────────────────────────────────
  // Generates the Moamalat LightBox config with a valid SecureHash.
  // Input:  { amount: number (e.g. 1.000), merchantReference: string }
  // Output: { success: true, config: { MID, TID, AmountTrxn, MerchantReference, TrxDateTime, SecureHash } }
  app.post("/api/moamalat/create-payment", async (req, res) => {
    try {
      const { amount, merchantReference } = req.body;

      if (!amount || !merchantReference) {
        return res
          .status(400)
          .json({ success: false, error: "amount and merchantReference are required" });
      }

      const MID = process.env.MOAMALAT_MID;
      const TID = process.env.MOAMALAT_TID;
      const secretHex = process.env.MOAMALAT_SECRET_HEX;

      if (!MID || !TID || !secretHex) {
        return res
          .status(500)
          .json({ success: false, error: "Moamalat credentials not configured (MOAMALAT_MID / MOAMALAT_TID / MOAMALAT_SECRET_HEX)" });
      }

      // AmountTrxn: convert to smallest currency unit. 1 LYD = 1000.
      const AmountTrxn = String(Math.round(parseFloat(amount) * 1000));
      const TrxDateTime = formatTrxDateTime();

      // Fields used for request SecureHash (sorted ascending by key name)
      const hashFields: Record<string, string> = {
        Amount: AmountTrxn,
        DateTimeLocalTrxn: TrxDateTime,
        MerchantId: MID,
        MerchantReference: merchantReference,
        TerminalId: TID,
      };

      const SecureHash = computeHmac(hashFields, secretHex);

      return res.json({
        success: true,
        config: {
          MID,
          TID,
          AmountTrxn,
          MerchantReference: merchantReference,
          TrxDateTime,
          SecureHash,
        },
      });
    } catch (err: any) {
      console.error("[Moamalat] create-payment error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── POST /api/moamalat/verify-complete-callback ────────────────────────────
  // Verifies the SecureHash returned inside the Moamalat completeCallback payload.
  // Steps:
  //   1. Remove SecureHash from payload
  //   2. Sort remaining fields alphabetically
  //   3. Rebuild query string
  //   4. Compute HMAC-SHA256 with hex-decoded merchant key
  //   5. Compare (case-insensitive) with received SecureHash
  // Returns: { success, verified, payment? }
  app.post("/api/moamalat/verify-complete-callback", async (req, res) => {
    try {
      const secretHex = process.env.MOAMALAT_SECRET_HEX;
      if (!secretHex) {
        return res
          .status(500)
          .json({ success: false, error: "Moamalat secret not configured" });
      }

      const payload: Record<string, string> = { ...req.body };
      const receivedHash = payload.SecureHash;

      if (!receivedHash) {
        return res
          .status(400)
          .json({ success: false, error: "Missing SecureHash in callback payload" });
      }

      // Remove SecureHash before computing
      delete payload.SecureHash;

      const computedHash = computeHmac(payload, secretHex);

      if (computedHash !== receivedHash.toUpperCase()) {
        console.warn("[Moamalat] SecureHash mismatch — payment NOT verified");
        return res
          .status(400)
          .json({ success: false, error: "SecureHash mismatch — payment not verified" });
      }

      // Hash is valid — extract and return payment data
      const paymentData = {
        merchantReference: payload.MerchantReference,
        systemReference: payload.SystemReference,
        networkReference: payload.NetworkReference,
        txnDate: payload.TxnDate,
        amount: payload.Amount,
        currency: payload.TxnCurrency,
        paidThrough: payload.PaidThrough,
        payerAccount: payload.PayerAccount,
        payerName: payload.PayerName,
        status: payload.TransactionStatus,
      };

      console.log("[Moamalat] Payment verified:", paymentData);
      return res.json({ success: true, verified: true, payment: paymentData });
    } catch (err: any) {
      console.error("[Moamalat] verify-complete-callback error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── GET /api/moamalat/lightbox-url ─────────────────────────────────────────
  // Returns the correct LightBox script URL for the current environment,
  // so the frontend never hard-codes environment logic itself.
  app.get("/api/moamalat/lightbox-url", (_req, res) => {
    res.json({ url: LIGHTBOX_SCRIPT_URL });
  });
}
