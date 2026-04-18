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

// Build the canonical sorted query string for HMAC input
function buildQueryString(fields: Record<string, string>): string {
  return Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
}

// Compute HMAC-SHA256, trying hex-decoded key first (as per Moamalat docs).
// Falls back to raw UTF-8 key if the hex string is invalid.
// Returns uppercase hex.
function resolveKey(secretHex: string): Buffer {
  // Always trim whitespace to protect against copy-paste errors in secrets
  const s = secretHex.trim();
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
    return Buffer.from(s, "hex");
  }
  return Buffer.from(s, "utf8");
}

function computeHmac(fields: Record<string, string>, secretHex: string): string {
  const queryString = buildQueryString(fields);
  const key = resolveKey(secretHex);
  return crypto.createHmac("sha256", key).update(queryString).digest("hex").toUpperCase();
}

// Compute HMAC using key as raw UTF-8 string (for debug comparison)
function computeHmacUtf8(fields: Record<string, string>, secret: string): string {
  const queryString = buildQueryString(fields);
  return crypto.createHmac("sha256", Buffer.from(secret.trim(), "utf8")).update(queryString).digest("hex").toUpperCase();
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

      // Moamalat MerchantReference: keep short (max ~20 chars) and alphanumeric only.
      // Use last 12 chars of the reference passed in (appointment ID suffix).
      const shortRef = merchantReference.replace(/[^a-zA-Z0-9]/g, "").slice(-16);

      // Fields used for request SecureHash (sorted ascending by key name)
      const hashFields: Record<string, string> = {
        Amount: AmountTrxn,
        DateTimeLocalTrxn: TrxDateTime,
        MerchantId: MID,
        MerchantReference: shortRef,
        TerminalId: TID,
      };

      const SecureHash = computeHmac(hashFields, secretHex);

      // ── Debug: compute several hash variants so we can identify the correct one ──
      // Variant A: standard (hex-decoded key, same fields)
      const varA = computeHmac(hashFields, secretHex);

      // Variant B: utf8 key
      const varB = computeHmacUtf8(hashFields, secretHex);

      // Variant C: using the LightBox config field names instead of the hash field names
      const hashFieldsC: Record<string, string> = {
        AmountTrxn,
        MID,
        MerchantReference: shortRef,
        TID,
        TrxDateTime,
      };
      const varC = computeHmac(hashFieldsC, secretHex);
      const varCUtf8 = computeHmacUtf8(hashFieldsC, secretHex);

      // Variant D: values concatenated (no key=value, no &), sorted by key name
      const concatHex = Object.keys(hashFields).sort().map(k => hashFields[k]).join("");
      const concatC2hex = Object.keys(hashFieldsC).sort().map(k => (hashFieldsC as any)[k]).join("");
      const keyHex = (/^[0-9a-fA-F]+$/.test(secretHex) && secretHex.length % 2 === 0)
        ? Buffer.from(secretHex, "hex")
        : Buffer.from(secretHex, "utf8");
      const varD = crypto.createHmac("sha256", keyHex).update(concatHex).digest("hex").toUpperCase();
      const varE = crypto.createHmac("sha256", keyHex).update(concatC2hex).digest("hex").toUpperCase();

      console.log("[Moamalat] === Hash Debug Variants ===");
      console.log("[Moamalat] Input A (standard):", buildQueryString(hashFields));
      console.log("[Moamalat] Hash A hex-key:", varA);
      console.log("[Moamalat] Hash B utf8-key:", varB);
      console.log("[Moamalat] Input C (config names):", buildQueryString(hashFieldsC));
      console.log("[Moamalat] Hash C hex-key:", varC);
      console.log("[Moamalat] Hash C utf8-key:", varCUtf8);
      console.log("[Moamalat] Input D (concat standard):", concatHex);
      console.log("[Moamalat] Hash D:", varD);
      console.log("[Moamalat] Input E (concat config names):", concatC2hex);
      console.log("[Moamalat] Hash E:", varE);

      return res.json({
        success: true,
        config: {
          MID,
          TID,
          AmountTrxn,
          MerchantReference: shortRef,
          TrxDateTime,
          SecureHash,
        },
        _debug: {
          hashInputA: buildQueryString(hashFields),
          varA_hexKey: varA,
          varB_utf8Key: varB,
          hashInputC: buildQueryString(hashFieldsC),
          varC_hexKey: varC,
          varC_utf8Key: varCUtf8,
          concatInputD: concatHex,
          varD,
          concatInputE: concatC2hex,
          varE,
          note: "Share this with Moamalat support to identify the correct hash variant",
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
