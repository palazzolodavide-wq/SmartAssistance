const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { searchAmazon } = require("./services/amazon");
const { searchCreators } = require("./services/creators");
const {
  refreshTrendingOffers,
  getTrendingOffers
} = require("./services/trending");

const {
  getRecommendedOffers
} = require("./services/recommendations");
require("dotenv").config();
const pool = require("./utils/db");
const app = express();

app.use(cors());
app.use(express.json({ limit: "12mb" }));


/*
|--------------------------------------------------------------------------
| HEALTH
|--------------------------------------------------------------------------
*/

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      database: err.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Utente non trovato",
      });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Password errata",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      success: true,
      token,
      user: {
        customer_code: user.customer_code,
        role: user.role,
        nome: user.nome,
        cognome: user.cognome,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});


/*
|--------------------------------------------------------------------------
| LIVE OFFERS HELPERS
|--------------------------------------------------------------------------
*/

const DEFAULT_LIVE_SETTINGS = {
  enabled: true,
  telegram_auto_import_enabled: false,
  amazon_tag: process.env.AMAZON_ASSOCIATE_TAG || "",
  ttl_hours: 24,
  max_visible: 20
};

function normalizeChannelRef(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "@")
    .replace(/^t\.me\//i, "@")
    .replace(/\s+/g, "");
}

function normalizeAmazonTag(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w-]/g, "");
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

async function ensureLiveSettings() {
  try {
    await pool.query(
      `
      INSERT INTO live_offer_settings (
        id,
        enabled,
        telegram_auto_import_enabled,
        amazon_tag,
        ttl_hours,
        max_visible
      )
      VALUES (true,$1,$2,$3,$4,$5)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        DEFAULT_LIVE_SETTINGS.enabled,
        DEFAULT_LIVE_SETTINGS.telegram_auto_import_enabled,
        DEFAULT_LIVE_SETTINGS.amazon_tag,
        DEFAULT_LIVE_SETTINGS.ttl_hours,
        DEFAULT_LIVE_SETTINGS.max_visible
      ]
    );

    const result = await pool.query(
      `
      SELECT
        enabled,
        telegram_auto_import_enabled,
        COALESCE(amazon_tag, '') AS amazon_tag,
        COALESCE(ttl_hours, 24)::int AS ttl_hours,
        COALESCE(max_visible, 20)::int AS max_visible,
        updated_at
      FROM live_offer_settings
      WHERE id = true
      `
    );

    return result.rows[0] || DEFAULT_LIVE_SETTINGS;
  } catch (err) {
    console.error("LIVE SETTINGS ERROR:", err.message);
    return DEFAULT_LIVE_SETTINGS;
  }
}

async function expireOldLiveOffers() {
  try {
    await pool.query(
      `
      UPDATE live_offers
      SET status = 'expired'
      WHERE status = 'published'
        AND expires_at <= NOW()
      `
    );
  } catch (err) {
    console.error("LIVE EXPIRE ERROR:", err.message);
  }
}

function extractUrlsFromText(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s<>"')]+/gi) || [];

  return matches.map((url) => url.replace(/[.,;:!?]+$/g, ""));
}

function extractAsinFromText(value) {
  const text = decodeUrlRepeated(String(value || ""));

  const patterns = [
    /(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{10})(?:[/?#&]|$)/i,
    /(?:asin=|ASIN%2F)([A-Z0-9]{10})/i,
    /\b(B0[A-Z0-9]{8})\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return "";
}

function decodeUrlRepeated(value, maxPasses = 4) {
  let current = String(value || "");

  for (let i = 0; i < maxPasses; i += 1) {
    try {
      const decoded = decodeURIComponent(current);

      if (decoded === current) {
        break;
      }

      current = decoded;
    } catch (err) {
      break;
    }
  }

  return current;
}

function trimResolvedUrl(value) {
  return String(value || "")
    .trim()
    .replace(/[<>"')\]\s]+$/g, "")
    .replace(/[.,;:!?]+$/g, "");
}

function isUnsafeRedirectHost(hostname) {
  const host = String(hostname || "").toLowerCase();

  if (!host) {
    return true;
  }

  if (
    host === "localhost" ||
    host === "host.docker.internal" ||
    host.endsWith(".local") ||
    host === "::1"
  ) {
    return true;
  }

  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
    return true;
  }

  const private172 = host.match(/^172\.(\d+)\./);

  if (private172) {
    const second = Number.parseInt(private172[1], 10);

    if (second >= 16 && second <= 31) {
      return true;
    }
  }

  return false;
}

function isAmazonUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();

    return host === "amazon.it" || host.endsWith(".amazon.it");
  } catch (err) {
    return /amazon\.it/i.test(String(value || ""));
  }
}

function extractEmbeddedAmazonUrl(value) {
  const decoded = decodeUrlRepeated(value);
  const candidates = [String(value || ""), decoded];

  try {
    const parsed = new URL(String(value || ""));

    for (const [, paramValue] of parsed.searchParams.entries()) {
      candidates.push(paramValue);
      candidates.push(decodeUrlRepeated(paramValue));
    }
  } catch (err) {
    // Non è un URL parsabile, proviamo comunque con il testo grezzo.
  }

  for (const candidate of candidates) {
    const normalized = decodeUrlRepeated(candidate);
    const match = normalized.match(/https?:\/\/(?:www\.)?amazon\.it\/[^\s<>"')\]]+/i);

    if (match?.[0]) {
      return trimResolvedUrl(match[0]);
    }
  }

  return "";
}

function canResolveExternalUrl(value) {
  try {
    const parsed = new URL(String(value || ""));

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    return !isUnsafeRedirectHost(parsed.hostname);
  } catch (err) {
    return false;
  }
}

async function fetchRedirectLocation(url, method = "HEAD") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 SmartAssistance/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const location = response.headers.get("location");

    if (location) {
      return new URL(location, url).toString();
    }

    if (response.url && response.url !== url) {
      return response.url;
    }

    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveAmazonUrl(url) {
  const rawUrl = trimResolvedUrl(url);

  if (!rawUrl) {
    return rawUrl;
  }

  const embeddedAmazonUrl = extractEmbeddedAmazonUrl(rawUrl);

  if (embeddedAmazonUrl) {
    return embeddedAmazonUrl;
  }

  if (isAmazonUrl(rawUrl)) {
    return rawUrl;
  }

  if (!canResolveExternalUrl(rawUrl)) {
    return rawUrl;
  }

  let currentUrl = rawUrl;

  try {
    for (let hop = 0; hop < 7; hop += 1) {
      const embedded = extractEmbeddedAmazonUrl(currentUrl);

      if (embedded) {
        return embedded;
      }

      if (isAmazonUrl(currentUrl)) {
        return currentUrl;
      }

      if (!canResolveExternalUrl(currentUrl)) {
        return rawUrl;
      }

      let nextUrl = "";

      try {
        nextUrl = await fetchRedirectLocation(currentUrl, "HEAD");
      } catch (headErr) {
        nextUrl = await fetchRedirectLocation(currentUrl, "GET");
      }

      if (!nextUrl || nextUrl === currentUrl) {
        return currentUrl;
      }

      currentUrl = trimResolvedUrl(nextUrl);
    }

    return currentUrl;
  } catch (err) {
    console.error("LIVE URL RESOLVE ERROR:", err.message);
    return rawUrl;
  }
}

async function extractAmazonAsinFromMessage(text) {
  const directAsin = extractAsinFromText(text);

  if (directAsin) {
    return {
      asin: directAsin,
      originalUrl: ""
    };
  }

  const urls = extractUrlsFromText(text);

  for (const url of urls) {
    const resolvedUrl = await resolveAmazonUrl(url);
    const asin = extractAsinFromText(resolvedUrl) || extractAsinFromText(url);

    if (asin) {
      return {
        asin,
        originalUrl: resolvedUrl || url
      };
    }
  }

  return {
    asin: "",
    originalUrl: urls[0] || ""
  };
}

function buildAmazonAffiliateUrl(asin, amazonTag) {
  const cleanAsin = String(asin || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cleanTag = normalizeAmazonTag(amazonTag);

  if (!cleanAsin || !cleanTag) {
    return "";
  }

  return `https://www.amazon.it/dp/${cleanAsin}?tag=${encodeURIComponent(cleanTag)}`;
}

function parseEuroNumber(value) {
  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatEuroAmount(value) {
  const parsed = typeof value === "number" ? value : parseEuroNumber(value);

  if (!Number.isFinite(parsed)) {
    return "";
  }

  return `${parsed.toFixed(2).replace(".", ",")} €`;
}

function extractEuroAmounts(text) {
  const value = String(text || "");
  const regex = /(?:€|EUR)?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR)/gi;
  const amounts = [];
  let match;

  while ((match = regex.exec(value)) !== null) {
    const amount = parseEuroNumber(match[1]);

    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const beforeStart = Math.max(0, match.index - 80);
    const afterEnd = Math.min(value.length, match.index + match[0].length + 80);
    const before = value.slice(beforeStart, match.index).toLowerCase();
    const after = value.slice(match.index + match[0].length, afterEnd).toLowerCase();
    const context = value.slice(beforeStart, afterEnd).toLowerCase();

    amounts.push({
      raw: match[0].trim(),
      amount,
      index: match.index,
      before,
      after,
      context
    });
  }

  return amounts;
}

function extractExplicitDiscountPercent(text) {
  const value = String(text || "");
  const patterns = [
    /(?:-|−)\s*([1-9][0-9]?)\s*%/i,
    /sconto\s*(?:del\s*)?([1-9][0-9]?)\s*%/i,
    /risparmi(?:o|a)?\s*(?:del\s*)?([1-9][0-9]?)\s*%/i,
    /coupon\s*(?:del\s*)?([1-9][0-9]?)\s*%/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    const parsed = Number.parseInt(match?.[1] || "", 10);

    if (Number.isFinite(parsed) && parsed > 0 && parsed < 100) {
      return parsed;
    }
  }

  return null;
}

function extractFirstEuroAmountFromPattern(value, pattern) {
  const match = String(value || "").match(pattern);

  if (!match?.[1]) {
    return null;
  }

  return parseEuroNumber(match[1]);
}

function extractLivePriceByExplicitPatterns(text) {
  const value = String(text || "").replace(/\s+/g, " ");

  const currentInstead = value.match(
    /(?:prezzo\s*(?:finale|finito)?|solo|a\s+soli|offerta|ora|adesso)?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR)\s*(?:invece\s+di|anzich[eéè]|al\s+posto\s+di|prima\s+di|da)\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR)/i
  );

  if (currentInstead?.[1] && currentInstead?.[2]) {
    const currentAmount = parseEuroNumber(currentInstead[1]);
    const previousAmount = parseEuroNumber(currentInstead[2]);

    if (currentAmount && previousAmount && previousAmount > currentAmount) {
      return {
        currentAmount,
        previousAmount
      };
    }
  }

  const fromTo = value.match(
    /(?:da|prezzo\s+normale|prezzo\s+di\s+listino|listino|prima|era)\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR).*?(?:a|ora|adesso|prezzo\s*(?:finale|finito)?)\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR)/i
  );

  if (fromTo?.[1] && fromTo?.[2]) {
    const previousAmount = parseEuroNumber(fromTo[1]);
    const currentAmount = parseEuroNumber(fromTo[2]);

    if (currentAmount && previousAmount && previousAmount > currentAmount) {
      return {
        currentAmount,
        previousAmount
      };
    }
  }

  const normalWithCoupon = value.match(
    /(?:prezzo\s+(?:normale|di\s+listino|iniziale|precedente)|listino|prima|era|da)\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR).*?(?:coupon|codice|sconto|buono|voucher|extra)\s*(?:da|di)?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR)/i
  );

  if (normalWithCoupon?.[1] && normalWithCoupon?.[2]) {
    const previousAmount = parseEuroNumber(normalWithCoupon[1]);
    const discountAmount = parseEuroNumber(normalWithCoupon[2]);

    if (previousAmount && discountAmount && previousAmount > discountAmount) {
      return {
        currentAmount: previousAmount - discountAmount,
        previousAmount
      };
    }
  }

  const couponThenNormal = value.match(
    /(?:coupon|codice|sconto|buono|voucher|extra)\s*(?:da|di)?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR).*?(?:prezzo\s+(?:normale|di\s+listino|iniziale|precedente)|listino|prima|era|da)\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR)/i
  );

  if (couponThenNormal?.[1] && couponThenNormal?.[2]) {
    const discountAmount = parseEuroNumber(couponThenNormal[1]);
    const previousAmount = parseEuroNumber(couponThenNormal[2]);

    if (previousAmount && discountAmount && previousAmount > discountAmount) {
      return {
        currentAmount: previousAmount - discountAmount,
        previousAmount
      };
    }
  }

  const finalWithCoupon = value.match(
    /(?:prezzo\s*(?:finale|finito)?|finale|totale|paghi|a\s+soli|solo)\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR).*?(?:coupon|codice|sconto|buono|voucher|extra)\s*(?:da|di)?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR)/i
  );

  if (finalWithCoupon?.[1] && finalWithCoupon?.[2]) {
    const currentAmount = parseEuroNumber(finalWithCoupon[1]);
    const discountAmount = parseEuroNumber(finalWithCoupon[2]);

    if (currentAmount && discountAmount) {
      return {
        currentAmount,
        previousAmount: currentAmount + discountAmount
      };
    }
  }

  const normalWithPercent = value.match(
    /(?:prezzo\s+(?:normale|di\s+listino|iniziale|precedente)|listino|prima|era|da)\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:€|euro|EUR).*?(?:-|−|sconto\s*(?:del)?|coupon\s*(?:del)?)\s*([1-9][0-9]?)\s*%/i
  );

  if (normalWithPercent?.[1] && normalWithPercent?.[2]) {
    const previousAmount = parseEuroNumber(normalWithPercent[1]);
    const percent = Number.parseInt(normalWithPercent[2], 10);

    if (previousAmount && percent > 0 && percent < 100) {
      return {
        currentAmount: previousAmount * (1 - (percent / 100)),
        previousAmount,
        discountPercent: percent
      };
    }
  }

  return null;
}

function isPreviousPriceAmount(item) {
  const before = item.before || "";

  return /(invece\s+di|anzich[eéè]|prima|listino|precedente|barrato|era|costava|prezzo\s+(?:normale|di\s+partenza|iniziale|consigliato|di\s+listino)|da\s*)$/i.test(before) ||
    /(invece\s+di|anzich[eéè]|prima|listino|precedente|barrato|era|costava|prezzo\s+(?:normale|di\s+partenza|iniziale|consigliato|di\s+listino))/i.test(before);
}

function isCurrentPriceAmount(item) {
  const before = item.before || "";

  if (/(coupon|codice|buono|voucher|sconto|risparmi|risparmio|extra)\s*(?:da|di)?\s*$/i.test(before)) {
    return false;
  }

  return /(prezzo\s*(?:finale|finito)?|finale|totale|paghi|pagamento|offerta|ora|adesso|solo|a\s+soli|dopo\s+(?:coupon|codice|sconto)|post\s+(?:coupon|sconto)|scende\s+a|viene\s+a|a\s*)$/i.test(before) ||
    /(prezzo\s*(?:finale|finito)|finale|totale|paghi|pagamento|offerta|ora|adesso|solo|a\s+soli|dopo\s+(?:coupon|codice|sconto)|post\s+(?:coupon|sconto)|scende\s+a|viene\s+a)/i.test(before);
}

function isDiscountAmount(item) {
  const before = item.before || "";

  if (isCurrentPriceAmount(item)) {
    return false;
  }

  return /(coupon|codice|buono|sconto|risparmi|risparmio|voucher|extra|meno|scalare|applica)\s*(?:da|di)?\s*$/i.test(before) ||
    /(coupon|codice|buono|sconto|risparmi|risparmio|voucher|extra|meno|scalare|applica)/i.test(before);
}

function extractLivePriceInfo(text, fallbackPriceText = "") {
  const explicitPattern = extractLivePriceByExplicitPatterns(text);

  if (explicitPattern?.currentAmount) {
    const explicitDiscount = explicitPattern.discountPercent || extractExplicitDiscountPercent(text);
    const computedDiscount =
      explicitPattern.previousAmount && explicitPattern.previousAmount > explicitPattern.currentAmount
        ? Math.round(((explicitPattern.previousAmount - explicitPattern.currentAmount) / explicitPattern.previousAmount) * 100)
        : null;

    return {
      priceText: formatEuroAmount(explicitPattern.currentAmount),
      previousPriceText: explicitPattern.previousAmount ? formatEuroAmount(explicitPattern.previousAmount) : "",
      discountPercent: explicitDiscount || computedDiscount || null
    };
  }

  const amounts = extractEuroAmounts(text);
  const explicitDiscount = extractExplicitDiscountPercent(text);

  const currentCandidates = amounts.filter((item) => isCurrentPriceAmount(item));
  const previousCandidates = amounts.filter((item) => isPreviousPriceAmount(item));
  const discountCandidates = amounts.filter((item) => isDiscountAmount(item));

  const discountAmount =
    discountCandidates.length > 0
      ? Math.max(...discountCandidates.map((item) => item.amount))
      : null;

  const nonDiscountAmounts = amounts.filter((item) => !discountCandidates.includes(item));

  let currentAmount =
    currentCandidates.length > 0
      ? currentCandidates[currentCandidates.length - 1].amount
      : null;

  let previousAmount =
    previousCandidates.length > 0
      ? Math.max(...previousCandidates.map((item) => item.amount))
      : null;

  if (!previousAmount && nonDiscountAmounts.length >= 2) {
    previousAmount = Math.max(...nonDiscountAmounts.map((item) => item.amount));
  }

  if (!currentAmount && previousAmount && discountAmount && previousAmount > discountAmount) {
    currentAmount = previousAmount - discountAmount;
  }

  if (!currentAmount && previousAmount && explicitDiscount) {
    currentAmount = previousAmount * (1 - (explicitDiscount / 100));
  }

  if (!currentAmount && nonDiscountAmounts.length === 1 && !isPreviousPriceAmount(nonDiscountAmounts[0])) {
    currentAmount = nonDiscountAmounts[0].amount;
  }

  if (!currentAmount && nonDiscountAmounts.length >= 2) {
    const lowerAmounts = nonDiscountAmounts
      .map((item) => item.amount)
      .filter((amount) => !previousAmount || amount < previousAmount);

    if (lowerAmounts.length > 0) {
      currentAmount = Math.min(...lowerAmounts);
    }
  }

  if (!currentAmount && fallbackPriceText) {
    currentAmount = parseEuroNumber(fallbackPriceText);
  }

  if (!previousAmount && currentAmount && discountAmount) {
    previousAmount = currentAmount + discountAmount;
  }

  if (previousAmount && currentAmount && previousAmount <= currentAmount) {
    previousAmount = null;
  }

  const computedDiscount =
    previousAmount && currentAmount && previousAmount > currentAmount
      ? Math.round(((previousAmount - currentAmount) / previousAmount) * 100)
      : null;

  return {
    priceText: currentAmount ? formatEuroAmount(currentAmount) : "",
    previousPriceText: previousAmount ? formatEuroAmount(previousAmount) : "",
    discountPercent: explicitDiscount || computedDiscount || null
  };
}

function extractPriceText(text) {
  return extractLivePriceInfo(text).priceText;
}

function extractCouponText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const couponLine = lines.find((line) =>
    /(coupon|codice|sconto|promo|buono)/i.test(line)
  );

  return couponLine ? couponLine.slice(0, 120) : "";
}

function inferLiveOfferCategory(text) {
  const value = String(text || "").toLowerCase();

  if (/(notebook|laptop|portatile|macbook|thinkpad|ideapad)/i.test(value)) {
    return "notebook";
  }

  if (/(desktop|pc fisso|monitor|tastiera|mouse|webcam|ups|stampante)/i.test(value)) {
    return "desktop";
  }

  if (/(smartphone|telefono|iphone|samsung|xiaomi|oppo|cover|pellicola|caricatore usb-c|power bank)/i.test(value)) {
    return "smartphone";
  }

  if (/(cuffie|auricolari|soundbar|speaker|audio|bluetooth)/i.test(value)) {
    return "audio";
  }

  if (/(gaming|playstation|xbox|nintendo|controller|console)/i.test(value)) {
    return "gaming";
  }

  if (/(casa|aspirapolvere|friggitrice|lavatrice|domotica|lampada|philips hue)/i.test(value)) {
    return "casa";
  }

  return "generale";
}

function buildLiveOfferTitle(text, asin) {
  const cleanedLines = String(text || "")
    .replace(/https?:\/\/[^\s<>"')]+/gi, "")
    .split(/\r?\n/)
    .map((line) => line
      .replace(/[🔥💥🚨✅⭐️⭐🎁👉➡️🔗]/g, "")
      .replace(/\s+/g, " ")
      .trim()
    )
    .filter((line) =>
      line &&
      !/^prezzo\b/i.test(line) &&
      !/^coupon\b/i.test(line) &&
      !/^codice\b/i.test(line)
    );

  const title = cleanedLines[0] || `Offerta Amazon ${asin}`;

  return title.slice(0, 150);
}

function getTelegramMessagePayload(update) {
  return update?.channel_post || update?.message || update?.edited_channel_post || update?.edited_message || null;
}

function getTelegramMessageText(message) {
  return String(message?.text || message?.caption || "").trim();
}

function getTelegramChannelRef(message) {
  const chat = message?.chat || {};

  if (chat.username) {
    return `@${chat.username}`;
  }

  if (chat.id) {
    return String(chat.id);
  }

  return "";
}

async function isAllowedLiveSource(channelRef) {
  const normalized = normalizeChannelRef(channelRef);

  if (!normalized) {
    return false;
  }

  const result = await pool.query(
    `
    SELECT id
    FROM live_offer_sources
    WHERE enabled = true
      AND (
        LOWER(channel_ref) = LOWER($1)
        OR LOWER(REPLACE(channel_ref, '@', '')) = LOWER(REPLACE($1, '@', ''))
      )
    LIMIT 1
    `,
    [normalized]
  );

  return result.rows.length > 0;
}


function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeAmazonItemsResponse(data) {
  const items =
    data?.SearchResult?.Items ||
    data?.searchResult?.items ||
    data?.items ||
    data?.results ||
    data?.Items ||
    [];

  return Array.isArray(items) ? items : [];
}

function readNestedValue(object, paths) {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce((current, key) => current?.[key], object);

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function readNestedNumber(object, paths) {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce((current, key) => current?.[key], object);

    if (value !== undefined && value !== null && value !== "") {
      const parsed = Number.parseFloat(String(value).replace(",", "."));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizeDiscountPercent(value) {
  const parsed = Number.parseInt(String(value || "").replace(/[^0-9]/g, ""), 10);

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 100) {
    return null;
  }

  return parsed;
}

function normalizeAmazonProductInfo(item) {
  if (!item) {
    return null;
  }

  const asin = firstNonEmpty(
    item.asin,
    item.ASIN,
    readNestedValue(item, ["item.asin", "Item.ASIN"])
  ).toUpperCase();

  const title = firstNonEmpty(
    item.titolo,
    item.title,
    readNestedValue(item, [
      "itemInfo.title.displayValue",
      "ItemInfo.Title.DisplayValue",
      "itemInfo.Title.DisplayValue",
      "ItemInfo.Title.DisplayValue"
    ])
  );

  const imageUrl = firstNonEmpty(
    item.image_url,
    readNestedValue(item, [
      "images.primary.large.url",
      "images.primary.medium.url",
      "images.primary.small.url",
      "Images.Primary.Large.URL",
      "Images.Primary.Medium.URL",
      "Images.Primary.Small.URL"
    ])
  );

  const priceText = firstNonEmpty(
    item.prezzo,
    item.price,
    readNestedValue(item, [
      "offers.listings.0.price.displayAmount",
      "Offers.Listings.0.Price.DisplayAmount",
      "offers.summaries.0.lowestPrice.displayAmount",
      "Offers.Summaries.0.LowestPrice.DisplayAmount"
    ])
  );

  const previousPriceText = firstNonEmpty(
    item.prezzo_precedente,
    item.previous_price,
    item.list_price,
    readNestedValue(item, [
      "offers.listings.0.savingBasis.displayAmount",
      "Offers.Listings.0.SavingBasis.DisplayAmount",
      "offers.listings.0.price.savingBasis.displayAmount",
      "Offers.Listings.0.Price.SavingBasis.DisplayAmount",
      "offers.summaries.0.highestPrice.displayAmount",
      "Offers.Summaries.0.HighestPrice.DisplayAmount"
    ])
  );

  const discountFromAmazon = normalizeDiscountPercent(firstNonEmpty(
    item.sconto_percentuale,
    item.discount_percent,
    readNestedValue(item, [
      "offers.listings.0.price.savings.percentage",
      "Offers.Listings.0.Price.Savings.Percentage",
      "offers.listings.0.price.Savings.Percentage",
      "Offers.Listings.0.Price.savings.percentage"
    ])
  ));

  const currentAmount = parseEuroNumber(priceText);
  const previousAmount = parseEuroNumber(previousPriceText);
  const computedDiscount =
    previousAmount && currentAmount && previousAmount > currentAmount
      ? Math.round(((previousAmount - currentAmount) / previousAmount) * 100)
      : null;

  return {
    asin,
    title,
    imageUrl,
    priceText,
    previousPriceText,
    discountPercent: discountFromAmazon || normalizeDiscountPercent(computedDiscount)
  };
}

async function enrichLiveOfferFromAmazon(asin) {
  const cleanAsin = String(asin || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!cleanAsin) {
    return {
      title: "",
      imageUrl: "",
      priceText: "",
      previousPriceText: "",
      discountPercent: null
    };
  }

  try {
    const data = await searchCreators(cleanAsin);
    const items = normalizeAmazonItemsResponse(data);

    const normalizedItems = items
      .map(normalizeAmazonProductInfo)
      .filter(Boolean);

    const exactMatch =
      normalizedItems.find((item) => item.asin === cleanAsin) ||
      normalizedItems[0];

    if (!exactMatch) {
      return {
        title: "",
        imageUrl: "",
        priceText: "",
        previousPriceText: "",
        discountPercent: null
      };
    }

    return {
      title: exactMatch.title || "",
      imageUrl: exactMatch.imageUrl || "",
      priceText: exactMatch.priceText || "",
      previousPriceText: exactMatch.previousPriceText || "",
      discountPercent: exactMatch.discountPercent || null
    };
  } catch (err) {
    console.error("LIVE AMAZON ENRICH ERROR:", err.message);

    return {
      title: "",
      imageUrl: "",
      priceText: "",
      previousPriceText: "",
      discountPercent: null
    };
  }
}


async function saveLiveOfferFromText({
  text,
  sourceChannel = "manual",
  telegramUpdateId = null,
  telegramMessageId = null,
  settings = null
}) {
  const liveSettings = settings || await ensureLiveSettings();
  const amazonTag = normalizeAmazonTag(liveSettings.amazon_tag);

  if (!amazonTag) {
    return {
      success: false,
      skipped: true,
      reason: "Tag affiliato Amazon mancante"
    };
  }

  const { asin, originalUrl } = await extractAmazonAsinFromMessage(text);

  if (!asin) {
    return {
      success: false,
      skipped: true,
      reason: "ASIN Amazon non trovato"
    };
  }

  const affiliateUrl = buildAmazonAffiliateUrl(asin, amazonTag);

  if (!affiliateUrl) {
    return {
      success: false,
      skipped: true,
      reason: "Link affiliato non generato"
    };
  }

  const amazonInfo = await enrichLiveOfferFromAmazon(asin);
  const priceInfo = extractLivePriceInfo(text, amazonInfo.priceText);

  const existingResult = await pool.query(
    `
    SELECT id
    FROM live_offers
    WHERE asin = $1
      AND status = 'published'
      AND expires_at > NOW()
    LIMIT 1
    `,
    [asin]
  );

  if (existingResult.rows.length > 0) {
    await pool.query(
      `
      UPDATE live_offers
      SET
        last_seen_at = NOW(),
        raw_text = COALESCE(NULLIF($2, ''), raw_text),
        title = COALESCE(NULLIF($3, ''), title),
        price_text = COALESCE(NULLIF($4, ''), price_text),
        previous_price_text = COALESCE(NULLIF($5, ''), previous_price_text),
        discount_percent = COALESCE($6, discount_percent),
        image_url = COALESCE(NULLIF($7, ''), image_url)
      WHERE id = $1
      `,
      [
        existingResult.rows[0].id,
        text || "",
        amazonInfo.title || "",
        priceInfo.priceText || amazonInfo.priceText || "",
        priceInfo.previousPriceText || amazonInfo.previousPriceText || "",
        priceInfo.discountPercent || amazonInfo.discountPercent,
        amazonInfo.imageUrl || ""
      ]
    );

    return {
      success: true,
      duplicate: true,
      enriched: Boolean(
        amazonInfo.title ||
        amazonInfo.priceText ||
        amazonInfo.previousPriceText ||
        amazonInfo.discountPercent ||
        amazonInfo.imageUrl
      ),
      offer_id: existingResult.rows[0].id,
      asin,
      price_info: {
        priceText: priceInfo.priceText || amazonInfo.priceText || "",
        previousPriceText: priceInfo.previousPriceText || amazonInfo.previousPriceText || "",
        discountPercent: priceInfo.discountPercent || amazonInfo.discountPercent || null
      }
    };
  }

  const ttlHours = clampNumber(liveSettings.ttl_hours, 24, 1, 168);
  const title = amazonInfo.title || buildLiveOfferTitle(text, asin);
  const priceText = priceInfo.priceText || amazonInfo.priceText;
  const previousPriceText = priceInfo.previousPriceText || amazonInfo.previousPriceText;
  const discountPercent = priceInfo.discountPercent || amazonInfo.discountPercent;
  const imageUrl = amazonInfo.imageUrl;
  const couponText = extractCouponText(text);
  const category = inferLiveOfferCategory(text);

  const result = await pool.query(
    `
    INSERT INTO live_offers (
      source_type,
      source_channel,
      telegram_update_id,
      telegram_message_id,
      raw_text,
      asin,
      title,
      price_text,
      previous_price_text,
      discount_percent,
      coupon_text,
      original_url,
      affiliate_url,
      image_url,
      category,
      status,
      expires_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'published',NOW() + ($16 || ' hours')::interval)
    RETURNING *
    `,
    [
      telegramUpdateId ? "telegram" : "manual",
      normalizeChannelRef(sourceChannel) || "manual",
      telegramUpdateId,
      telegramMessageId,
      text || "",
      asin,
      title,
      priceText || null,
      previousPriceText || null,
      discountPercent,
      couponText || null,
      originalUrl || null,
      affiliateUrl,
      imageUrl || null,
      category,
      ttlHours
    ]
  );

  return {
    success: true,
    offer: result.rows[0],
    price_info: {
      priceText: priceText || "",
      previousPriceText: previousPriceText || "",
      discountPercent: discountPercent || null
    }
  };
}

async function getPublicLiveOffers({
  page = 1,
  pageSize = null
} = {}) {
  const settings = await ensureLiveSettings();

  if (!settings.enabled) {
    return {
      offers: [],
      pagination: {
        page: 1,
        pageSize: clampNumber(settings.max_visible, 20, 1, 100),
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    };
  }

  await expireOldLiveOffers();

  const currentPage = clampNumber(page, 1, 1, 10000);
  const perPage = clampNumber(pageSize || settings.max_visible, settings.max_visible || 20, 1, 100);
  const offset = (currentPage - 1) * perPage;

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM live_offers
    WHERE status = 'published'
      AND expires_at > NOW()
      AND affiliate_url IS NOT NULL
      AND TRIM(affiliate_url) <> ''
    `
  );

  const total = countResult.rows[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const result = await pool.query(
    `
    SELECT
      asin,
      category AS categoria,
      'amazon' AS partner,
      title AS titolo,
      COALESCE(NULLIF(coupon_text, ''), title) AS descrizione,
      affiliate_url,
      image_url,
      price_text AS prezzo,
      previous_price_text AS prezzo_precedente,
      discount_percent AS sconto_percentuale,
      'live' AS tipo_offerta,
      'live_telegram' AS source,
      source_channel,
      imported_at,
      expires_at
    FROM live_offers
    WHERE status = 'published'
      AND expires_at > NOW()
      AND affiliate_url IS NOT NULL
      AND TRIM(affiliate_url) <> ''
    ORDER BY imported_at DESC
    LIMIT $1 OFFSET $2
    `,
    [perPage, offset]
  );

  return {
    offers: result.rows,
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    }
  };
}

let telegramPollRunning = false;

async function pollTelegramLiveOffers() {
  if (telegramPollRunning) {
    return;
  }

  telegramPollRunning = true;

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return;
    }

    const settings = await ensureLiveSettings();

    if (!settings.telegram_auto_import_enabled || !settings.enabled) {
      return;
    }

    const stateResult = await pool.query(
      `
      SELECT COALESCE(value, '0') AS value
      FROM app_runtime_state
      WHERE key = 'telegram_live_last_update_id'
      `
    );

    const lastUpdateId = Number.parseInt(stateResult.rows[0]?.value || "0", 10) || 0;
    const offset = lastUpdateId > 0 ? lastUpdateId + 1 : undefined;
    const params = new URLSearchParams();

    if (offset) {
      params.set("offset", String(offset));
    }

    params.set("timeout", "0");
    params.set("allowed_updates", JSON.stringify(["channel_post", "message", "edited_channel_post", "edited_message"]));

    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Telegram HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok || !Array.isArray(data.result)) {
      throw new Error("Risposta Telegram non valida");
    }

    let maxUpdateId = lastUpdateId;

    for (const update of data.result) {
      if (Number.isFinite(update.update_id)) {
        maxUpdateId = Math.max(maxUpdateId, update.update_id);
      }

      const message = getTelegramMessagePayload(update);
      const text = getTelegramMessageText(message);
      const channelRef = getTelegramChannelRef(message);

      if (!text || !channelRef) {
        continue;
      }

      const allowed = await isAllowedLiveSource(channelRef);

      if (!allowed) {
        continue;
      }

      const importResult = await saveLiveOfferFromText({
        text,
        sourceChannel: channelRef,
        telegramUpdateId: update.update_id,
        telegramMessageId: message?.message_id || null,
        settings
      });

      if (importResult.success) {
        console.log("LIVE OFFER IMPORT:", channelRef, importResult.asin || importResult.offer?.asin || "ok");
      } else {
        console.log("LIVE OFFER SKIP:", channelRef, importResult.reason || "skip");
      }
    }

    if (maxUpdateId > lastUpdateId) {
      await pool.query(
        `
        INSERT INTO app_runtime_state (key, value, updated_at)
        VALUES ('telegram_live_last_update_id', $1, NOW())
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `,
        [String(maxUpdateId)]
      );
    }
  } catch (err) {
    console.error("TELEGRAM LIVE POLL ERROR:", err.message);
  } finally {
    telegramPollRunning = false;
  }
}


/*
|--------------------------------------------------------------------------
| ADMIN AUTH MIDDLEWARE
|--------------------------------------------------------------------------
*/

function authenticateAdmin(req, res, next) {
  const publicApiRoutes = [
    /^\/api\/app\/[^/]+$/,
    /^\/api\/app\/[^/]+\/live-offers$/,
    /^\/api\/app\/[^/]+\/consents$/,
    /^\/api\/app\/[^/]+\/click$/,
    /^\/api\/receipt-upload\/[^/]+$/,
    /^\/api\/receipt-upload\/[^/]+\/receipt$/,
    /^\/app\/[^/]+$/,
    /^\/app\/[^/]+\/click$/,
    /^\/receipt-upload\/[^/]+$/,
    /^\/receipt-upload\/[^/]+\/receipt$/
  ];

  const isPublicApiRoute = publicApiRoutes.some((route) =>
    route.test(req.originalUrl) || route.test(req.path)
  );

  if (isPublicApiRoute) {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Token mancante"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Accesso non autorizzato"
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Token non valido o scaduto"
    });
  }
}


function normalizeDeviceCategory(value) {
  const category = String(value || "").toLowerCase().trim();

  if (category.includes("notebook") || category.includes("laptop") || category.includes("portatile")) {
    return "notebook";
  }

  if (category.includes("desktop") || category.includes("pc") || category.includes("computer")) {
    return "desktop";
  }

  if (category.includes("smartphone") || category.includes("telefono") || category.includes("phone")) {
    return "smartphone";
  }

  return "device";
}

function getDeviceAccessorySearches(device) {
  const category = normalizeDeviceCategory(device?.categoria);
  const base = `${device?.marca || ""} ${device?.modello || ""}`.trim();
  const fallbackBase = base || "accessori tecnologia";

  if (category === "notebook") {
    return [
      `${fallbackBase} mouse wireless`,
      `${fallbackBase} borsa notebook`,
      `${fallbackBase} hub usb c`,
      `${fallbackBase} supporto notebook`,
      `${fallbackBase} caricatore compatibile`
    ];
  }

  if (category === "desktop") {
    return [
      `${fallbackBase} tastiera mouse wireless`,
      `${fallbackBase} monitor pc`,
      `${fallbackBase} webcam`,
      `${fallbackBase} casse pc`,
      `${fallbackBase} gruppo continuità`
    ];
  }

  if (category === "smartphone") {
    return [
      `${fallbackBase} cover`,
      `${fallbackBase} pellicola vetro`,
      `${fallbackBase} caricatore usb-c`,
      `${fallbackBase} power bank`,
      `${fallbackBase} auricolari bluetooth`
    ];
  }

  return [
    `${fallbackBase} accessori`,
    `${fallbackBase} caricatore`,
    `${fallbackBase} custodia`,
    `${fallbackBase} supporto`,
    `${fallbackBase} bluetooth`
  ];
}

function normalizeWhatsAppChatId(phone) {
  const raw = String(phone || "").replace(/\D/g, "");

  if (!raw) {
    return "";
  }

  let normalized = raw;

  if (normalized.startsWith("0039")) {
    normalized = normalized.substring(4);
  }

  if (!normalized.startsWith("39")) {
    normalized = `39${normalized}`;
  }

  return `${normalized}@c.us`;
}

function getWahaConfig() {
  return {
    baseUrl: (process.env.WAHA_BASE_URL || "http://host.docker.internal:3000").replace(/\/+$/, ""),
    apiKey: process.env.WAHA_API_KEY || "",
    session: process.env.WAHA_SESSION || "default",
    sendTextPath: process.env.WAHA_SEND_TEXT_PATH || "/api/sendText"
  };
}

async function sendWahaTextMessage({ chatId, text }) {
  const config = getWahaConfig();

  if (!config.apiKey) {
    throw new Error("WAHA_API_KEY non configurata nel backend");
  }

  const payload = {
    session: config.session,
    chatId,
    text
  };

  const headers = {
    "Content-Type": "application/json",
    "X-Api-Key": config.apiKey
  };

  const pathsToTry = [
    config.sendTextPath,
    "/api/sendText",
    "/api/send-text"
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  let lastError = "";

  for (const path of pathsToTry) {
    const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const bodyText = await response.text();

      if (response.ok) {
        return {
          success: true,
          endpoint: url,
          response: bodyText
        };
      }

      lastError = `HTTP ${response.status}: ${bodyText || response.statusText}`;

      if (response.status !== 404) {
        break;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(lastError || "Errore invio WAHA");
}



/*
|--------------------------------------------------------------------------
| INTERNAL - TELEGRAM LIVE ACCOUNT READER
|--------------------------------------------------------------------------
*/

function verifyLiveImportSecret(req, res, next) {
  const configuredSecret = String(process.env.LIVE_IMPORT_SECRET || "").trim();
  const requestSecret = String(
    req.headers["x-live-import-secret"] ||
    req.headers["x-smartassistance-live-secret"] ||
    ""
  ).trim();

  if (!configuredSecret) {
    return res.status(503).json({
      success: false,
      error: "LIVE_IMPORT_SECRET non configurato nel backend"
    });
  }

  if (!requestSecret || requestSecret !== configuredSecret) {
    return res.status(401).json({
      success: false,
      error: "Secret import live non valido"
    });
  }

  next();
}

app.get("/api/live-offers/import-config", verifyLiveImportSecret, async (req, res) => {
  try {
    const settings = await ensureLiveSettings();

    const sourcesResult = await pool.query(
      `
      SELECT
        id,
        channel_ref,
        label,
        enabled
      FROM live_offer_sources
      WHERE enabled = true
      ORDER BY created_at ASC
      `
    );

    res.json({
      success: true,
      settings: {
        enabled: Boolean(settings.enabled),
        telegram_auto_import_enabled: Boolean(settings.telegram_auto_import_enabled),
        ttl_hours: Number(settings.ttl_hours || 24),
        max_visible: Number(settings.max_visible || 20)
      },
      sources: sourcesResult.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/api/live-offers/import-external", verifyLiveImportSecret, async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const sourceChannel = normalizeChannelRef(req.body?.source_channel || "telegram-account");
    const telegramMessageId = req.body?.telegram_message_id
      ? Number.parseInt(req.body.telegram_message_id, 10)
      : null;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Testo offerta mancante"
      });
    }

    const settings = await ensureLiveSettings();

    if (!settings.enabled || !settings.telegram_auto_import_enabled) {
      return res.status(409).json({
        success: false,
        skipped: true,
        reason: "Offerte live o import automatico Telegram disattivati"
      });
    }

    const result = await saveLiveOfferFromText({
      text,
      sourceChannel,
      telegramMessageId: Number.isFinite(telegramMessageId) ? telegramMessageId : null,
      settings
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});



app.post("/api/live-offers/heartbeat", verifyLiveImportSecret, async (req, res) => {
  try {
    const payload = req.body || {};
    const status = String(payload.status || "ok").slice(0, 80);
    const message = String(payload.message || "").slice(0, 500);
    const sourcesCount = Number.parseInt(payload.sources_count || 0, 10) || 0;
    const importedCount = Number.parseInt(payload.imported_count || 0, 10) || 0;
    const skippedCount = Number.parseInt(payload.skipped_count || 0, 10) || 0;
    const errorCount = Number.parseInt(payload.error_count || 0, 10) || 0;

    const stateEntries = {
      telegram_account_heartbeat_at: new Date().toISOString(),
      telegram_account_status: status,
      telegram_account_message: message,
      telegram_account_sources_count: String(sourcesCount),
      telegram_account_imported_count: String(importedCount),
      telegram_account_skipped_count: String(skippedCount),
      telegram_account_error_count: String(errorCount)
    };

    for (const [key, value] of Object.entries(stateEntries)) {
      await pool.query(
        `
        INSERT INTO app_runtime_state (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `,
        [key, value]
      );
    }

    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


app.use("/api", authenticateAdmin);

/*
|--------------------------------------------------------------------------
| USERS
|--------------------------------------------------------------------------
*/

app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        customer_code,
        nome,
        cognome,
        email,
        telefono,
        role,
        app_token,
        COALESCE(broadcast_opt_out, false) AS broadcast_opt_out,
        COALESCE(privacy_consent, false) AS privacy_consent,
        privacy_consent_at,
        COALESCE(marketing_consent, false) AS marketing_consent,
        marketing_consent_at,
        COALESCE(whatsapp_consent, false) AS whatsapp_consent,
        whatsapp_consent_at,
        COALESCE(consent_note, '') AS consent_note
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const {
      nome,
      cognome,
      email,
      telefono,
      privacy_consent = false,
      marketing_consent = false,
      whatsapp_consent = false,
      consent_note = "",
      broadcast_opt_out
    } = req.body;

    if (!privacy_consent) {
      return res.status(400).json({
        success: false,
        error: "Per creare il cliente devi registrare il consenso privacy."
      });
    }

    const effectiveWhatsAppConsent = Boolean(whatsapp_consent);
    const effectiveBroadcastOptOut =
      broadcast_opt_out !== undefined
        ? Boolean(broadcast_opt_out)
        : !effectiveWhatsAppConsent;

    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS total FROM users WHERE role = 'customer'"
    );

    const nextNumber = countResult.rows[0].total + 1;

    const customerCode =
      "SA-" + String(nextNumber).padStart(6, "0");

    const appToken =
      Math.random().toString(36).substring(2, 14);

    const result = await pool.query(
      `
      INSERT INTO users (
        customer_code,
        role,
        nome,
        cognome,
        email,
        telefono,
        password_hash,
        consenso_privacy,
        app_token,
        broadcast_opt_out,
        privacy_consent,
        privacy_consent_at,
        marketing_consent,
        marketing_consent_at,
        whatsapp_consent,
        whatsapp_consent_at,
        consent_note
      )
      VALUES (
        $1,
        'customer',
        $2,
        $3,
        $4,
        $5,
        'changeme',
        $6,
        $7,
        $8,
        $9,
        CASE WHEN $9 THEN NOW() ELSE NULL END,
        $10,
        CASE WHEN $10 THEN NOW() ELSE NULL END,
        $11,
        CASE WHEN $11 THEN NOW() ELSE NULL END,
        $12
      )
      RETURNING *
      `,
      [
        customerCode,
        nome,
        cognome,
        email,
        telefono,
        Boolean(privacy_consent),
        appToken,
        effectiveBroadcastOptOut,
        Boolean(privacy_consent),
        Boolean(marketing_consent),
        effectiveWhatsAppConsent,
        String(consent_note || "").trim()
      ]
    );

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
});

/*
|--------------------------------------------------------------------------
| UPDATE USER
|--------------------------------------------------------------------------
*/

app.put("/api/users/:id", async (req, res) => {
  try {

    const { id } = req.params;

    const {
      nome,
      cognome,
      email,
      telefono,
      privacy_consent = false,
      marketing_consent = false,
      whatsapp_consent = false,
      consent_note = "",
      broadcast_opt_out
    } = req.body;

    if (!privacy_consent) {
      return res.status(400).json({
        success: false,
        error: "Il consenso privacy è obbligatorio per mantenere il cliente attivo."
      });
    }

    const effectiveWhatsAppConsent = Boolean(whatsapp_consent);
    const effectiveBroadcastOptOut =
      broadcast_opt_out !== undefined
        ? Boolean(broadcast_opt_out)
        : !effectiveWhatsAppConsent;

    const result = await pool.query(
      `
      UPDATE users
      SET
        nome = $1,
        cognome = $2,
        email = $3,
        telefono = $4,
        broadcast_opt_out = $5,
        consenso_privacy = $6,
        privacy_consent = $6,
        privacy_consent_at = CASE
          WHEN $6 = TRUE AND privacy_consent_at IS NULL THEN NOW()
          WHEN $6 = FALSE THEN NULL
          ELSE privacy_consent_at
        END,
        marketing_consent = $7,
        marketing_consent_at = CASE
          WHEN $7 = TRUE AND marketing_consent_at IS NULL THEN NOW()
          WHEN $7 = FALSE THEN NULL
          ELSE marketing_consent_at
        END,
        whatsapp_consent = $8,
        whatsapp_consent_at = CASE
          WHEN $8 = TRUE AND whatsapp_consent_at IS NULL THEN NOW()
          WHEN $8 = FALSE THEN NULL
          ELSE whatsapp_consent_at
        END,
        consent_note = $9
      WHERE id = $10
      RETURNING *
      `,
      [
        nome,
        cognome,
        email,
        telefono,
        effectiveBroadcastOptOut,
        Boolean(privacy_consent),
        Boolean(marketing_consent),
        effectiveWhatsAppConsent,
        String(consent_note || "").trim(),
        id
      ]
    );

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
});


app.delete("/api/users/:id", async (req, res) => {
  try {

    const { id } = req.params;

    const devices = await pool.query(
      "SELECT id FROM devices WHERE user_id = $1",
      [id]
    );

    if (devices.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Impossibile eliminare il cliente: sono presenti dispositivi associati. Eliminare prima tutti i dispositivi del cliente."
      });
    }

    await pool.query(
      "DELETE FROM users WHERE id = $1",
      [id]
    );

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
});


app.get("/api/app/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const customerResult = await pool.query(
      `
      SELECT
        id,
        customer_code,
        nome,
        cognome,
        email,
        telefono,
        COALESCE(privacy_consent, COALESCE(consenso_privacy, false), false) AS privacy_consent,
        privacy_consent_at,
        COALESCE(marketing_consent, false) AS marketing_consent,
        marketing_consent_at,
        COALESCE(whatsapp_consent, false) AS whatsapp_consent,
        whatsapp_consent_at
      FROM users
      WHERE app_token = $1
      `,
      [token]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Cliente non trovato"
      });
    }

    const customer = customerResult.rows[0];
    const canShowMarketingOffers = Boolean(customer.marketing_consent);

    const devicesResult = await pool.query(
      `
      SELECT
        id,
        marca,
        modello,
        data_acquisto,
        scadenza_garanzia,
        note,
        categoria,
        receipt_filename,
        receipt_mime_type,
        receipt_data_url,
        receipt_uploaded_at
      FROM devices
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [customer.id]
    );

    const device = devicesResult.rows[0] || null;

    let manualOffers = [];

    if (canShowMarketingOffers) {
      try {
        const manualOffersResult = await pool.query(`
        SELECT
          id::text AS asin,
          categoria,
          partner,
          titolo,
          descrizione,
          affiliate_url,
          image_url,
          NULL::text AS prezzo,
          NULL::text AS prezzo_precedente,
          NULL::int AS sconto_percentuale,
          COALESCE(tipo_offerta, 'manual') AS tipo_offerta,
          'manual' AS source
        FROM offers
        WHERE affiliate_url IS NOT NULL
          AND TRIM(affiliate_url) <> ''
          AND titolo IS NOT NULL
          AND TRIM(titolo) <> ''
        ORDER BY created_at DESC
        LIMIT 50
      `);

      manualOffers = manualOffersResult.rows;
      } catch (manualErr) {
        console.error("MANUAL OFFERS ERROR:", manualErr.message);
        manualOffers = [];
      }
    }

    let amazonRecommendedOffers = [];

    if (canShowMarketingOffers && device?.marca && device?.modello) {
      try {
        const searches = getDeviceAccessorySearches(device);

        const creatorResponses = await Promise.all(
          searches.map(searchCreators)
        );

        const amazonOffers = creatorResponses
          .flatMap(response =>
            response.searchResult?.items ||
            response.SearchResult?.Items ||
            []
          )
          .map(item => ({
            asin: item.asin || item.ASIN,
            categoria: normalizeDeviceCategory(device.categoria),
            partner: "amazon",
            titolo:
              item.itemInfo?.title?.displayValue ||
              item.ItemInfo?.Title?.DisplayValue ||
              "",
            descrizione:
              item.itemInfo?.title?.displayValue ||
              item.ItemInfo?.Title?.DisplayValue ||
              "",
            affiliate_url:
              item.detailPageURL ||
              item.DetailPageURL ||
              "",
            image_url:
              item.images?.primary?.medium?.url ||
              item.Images?.Primary?.Medium?.URL ||
              null,
            prezzo:
              item.offersV2?.listings?.[0]?.price?.money?.displayAmount ||
              item.OffersV2?.Listings?.[0]?.Price?.Money?.DisplayAmount ||
              null,
            prezzo_precedente:
              item.offersV2?.listings?.[0]?.price?.savingBasis?.money?.displayAmount ||
              item.OffersV2?.Listings?.[0]?.Price?.SavingBasis?.Money?.DisplayAmount ||
              null,
            sconto_percentuale:
              item.offersV2?.listings?.[0]?.price?.savings?.percentage ||
              item.OffersV2?.Listings?.[0]?.Price?.Savings?.Percentage ||
              null,
            tipo_offerta: "accessory",
            source: "amazon_recommended"
          }))
          .filter(offer =>
            offer.titolo &&
            offer.affiliate_url &&
            offer.asin
          );

        const uniqueAmazonOffers = [
          ...new Map(
            amazonOffers.map(offer => [offer.asin, offer])
          ).values()
        ];

        amazonRecommendedOffers = getRecommendedOffers(uniqueAmazonOffers);
      } catch (amazonErr) {
        console.error("CUSTOMER AMAZON OFFERS ERROR:", amazonErr.message);
        amazonRecommendedOffers = [];
      }
    }

    let trendingOffers = [];

    if (canShowMarketingOffers) {
      try {
        trendingOffers = await getTrendingOffers(10);
      } catch (trendingErr) {
        console.error("TRENDING OFFERS ERROR:", trendingErr.message);
        trendingOffers = [];
      }
    }

    let liveOffers = [];
    let livePagination = {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    };
    let liveSettings = {
      enabled: true,
      ttl_hours: 24,
      max_visible: 20
    };

    try {
      const currentLiveSettings = await ensureLiveSettings();

      liveSettings = {
        enabled: Boolean(currentLiveSettings.enabled),
        ttl_hours: Number(currentLiveSettings.ttl_hours || 24),
        max_visible: Number(currentLiveSettings.max_visible || 20)
      };

      if (canShowMarketingOffers && liveSettings.enabled) {
        const liveResult = await getPublicLiveOffers({ page: 1 });

        liveOffers = liveResult.offers;
        livePagination = liveResult.pagination;
      }
    } catch (liveErr) {
      console.error("LIVE OFFERS ERROR:", liveErr.message);
      liveOffers = [];
    }

    const recommendedOffers = [
      ...new Map(
        [...manualOffers, ...amazonRecommendedOffers]
          .filter(offer => offer?.affiliate_url)
          .map((offer, index) => [
            offer.asin || offer.affiliate_url || index,
            offer
          ])
      ).values()
    ].slice(0, 50);

    res.setHeader("Cache-Control", "no-store");

    res.json({
      success: true,
      customer,
      device,
      devices: devicesResult.rows,
      recommendedOffers,
      manualOffers,
      trendingOffers,
      liveOffers,
      livePagination,
      liveSettings
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});



app.get("/api/app/:token/live-offers", async (req, res) => {
  try {
    const { token } = req.params;
    const page = clampNumber(req.query.page || 1, 1, 1, 10000);

    const customerResult = await pool.query(
      "SELECT id, COALESCE(marketing_consent, false) AS marketing_consent FROM users WHERE app_token = $1",
      [token]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Cliente non trovato"
      });
    }

    const customer = customerResult.rows[0];
    const settings = await ensureLiveSettings();

    if (!customer.marketing_consent) {
      return res.json({
        success: true,
        liveOffers: [],
        livePagination: {
          page: 1,
          pageSize: clampNumber(settings.max_visible, 20, 1, 100),
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        },
        liveSettings: {
          enabled: false,
          ttl_hours: Number(settings.ttl_hours || 24),
          max_visible: Number(settings.max_visible || 20)
        },
        reason: "Consenso marketing non attivo"
      });
    }

    if (!settings.enabled) {
      return res.json({
        success: true,
        liveOffers: [],
        livePagination: {
          page: 1,
          pageSize: clampNumber(settings.max_visible, 20, 1, 100),
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        },
        liveSettings: {
          enabled: false,
          ttl_hours: Number(settings.ttl_hours || 24),
          max_visible: Number(settings.max_visible || 20)
        }
      });
    }

    const liveResult = await getPublicLiveOffers({
      page
    });

    res.setHeader("Cache-Control", "no-store");

    res.json({
      success: true,
      liveOffers: liveResult.offers,
      livePagination: liveResult.pagination,
      liveSettings: {
        enabled: Boolean(settings.enabled),
        ttl_hours: Number(settings.ttl_hours || 24),
        max_visible: Number(settings.max_visible || 20)
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


app.put("/api/app/:token/consents", async (req, res) => {
  try {
    const { token } = req.params;
    const {
      marketing_consent = false,
      whatsapp_consent = false
    } = req.body || {};

    const customerResult = await pool.query(
      `
      SELECT
        id,
        COALESCE(privacy_consent, COALESCE(consenso_privacy, false), false) AS privacy_consent
      FROM users
      WHERE app_token = $1
      `,
      [token]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Cliente non trovato"
      });
    }

    const customer = customerResult.rows[0];

    if (!customer.privacy_consent) {
      return res.status(400).json({
        success: false,
        error: "Consenso privacy non registrato. Contatta il punto vendita."
      });
    }

    const nextMarketingConsent = Boolean(marketing_consent);
    const nextWhatsAppConsent = Boolean(whatsapp_consent);

    const result = await pool.query(
      `
      UPDATE users
      SET
        marketing_consent = $1,
        marketing_consent_at = CASE
          WHEN $1 = TRUE AND marketing_consent_at IS NULL THEN NOW()
          WHEN $1 = FALSE THEN NULL
          ELSE marketing_consent_at
        END,
        whatsapp_consent = $2,
        whatsapp_consent_at = CASE
          WHEN $2 = TRUE AND whatsapp_consent_at IS NULL THEN NOW()
          WHEN $2 = FALSE THEN NULL
          ELSE whatsapp_consent_at
        END,
        broadcast_opt_out = NOT $2
      WHERE id = $3
      RETURNING
        id,
        customer_code,
        nome,
        cognome,
        email,
        telefono,
        COALESCE(privacy_consent, COALESCE(consenso_privacy, false), false) AS privacy_consent,
        privacy_consent_at,
        COALESCE(marketing_consent, false) AS marketing_consent,
        marketing_consent_at,
        COALESCE(whatsapp_consent, false) AS whatsapp_consent,
        whatsapp_consent_at
      `,
      [
        nextMarketingConsent,
        nextWhatsAppConsent,
        customer.id
      ]
    );

    res.json({
      success: true,
      customer: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


/*
|--------------------------------------------------------------------------
| CUSTOMER APP - OFFER CLICK TRACKING
|--------------------------------------------------------------------------
*/

app.post("/api/app/:token/click", async (req, res) => {
  try {
    const { token } = req.params;
    const {
      asin,
      titolo,
      affiliate_url,
      source
    } = req.body || {};

    if (!affiliate_url) {
      return res.status(400).json({
        success: false,
        error: "affiliate_url mancante"
      });
    }

    const customerResult = await pool.query(
      "SELECT id FROM users WHERE app_token = $1",
      [token]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Cliente non trovato"
      });
    }

    await pool.query(
      `
      INSERT INTO offer_clicks (
        user_id,
        app_token,
        asin,
        titolo,
        affiliate_url,
        source,
        user_agent,
        ip_address
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        customerResult.rows[0].id,
        token,
        asin || null,
        titolo || null,
        affiliate_url,
        source || "webapp",
        req.get("user-agent") || null,
        req.ip || null
      ]
    );

    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


/*
|--------------------------------------------------------------------------
| ADMIN - CLICK STATS
|--------------------------------------------------------------------------
*/

app.get("/api/stats/clicks", async (req, res) => {
  try {
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total_clicks,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '24 hours'
        )::int AS clicks_24h,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
        )::int AS clicks_7d,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '30 days'
        )::int AS clicks_30d,
        COUNT(DISTINCT user_id) FILTER (
          WHERE user_id IS NOT NULL
            AND created_at >= NOW() - INTERVAL '7 days'
        )::int AS unique_customers_7d,
        COUNT(DISTINCT COALESCE(NULLIF(asin, ''), affiliate_url))::int AS unique_products
      FROM offer_clicks
    `);

    const topProductsResult = await pool.query(`
      SELECT
        COALESCE(asin, '') AS asin,
        COALESCE(NULLIF(titolo, ''), 'Prodotto senza titolo') AS titolo,
        COALESCE(NULLIF(affiliate_url, ''), '') AS affiliate_url,
        COUNT(*)::int AS clicks,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
        )::int AS clicks_7d,
        MAX(created_at) AS last_click
      FROM offer_clicks
      GROUP BY asin, titolo, affiliate_url
      ORDER BY clicks DESC, last_click DESC
      LIMIT 15
    `);

    const dailyClicksResult = await pool.query(`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '13 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      ),
      clicks AS (
        SELECT
          created_at::date AS day,
          COUNT(*)::int AS clicks
        FROM offer_clicks
        WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
        GROUP BY created_at::date
      )
      SELECT
        days.day,
        TO_CHAR(days.day, 'DD/MM') AS label,
        COALESCE(clicks.clicks, 0)::int AS clicks
      FROM days
      LEFT JOIN clicks
        ON clicks.day = days.day
      ORDER BY days.day ASC
    `);

    const sourceStatsResult = await pool.query(`
      SELECT
        COALESCE(NULLIF(source, ''), 'webapp') AS source,
        COUNT(*)::int AS clicks,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
        )::int AS clicks_7d,
        MAX(created_at) AS last_click
      FROM offer_clicks
      GROUP BY COALESCE(NULLIF(source, ''), 'webapp')
      ORDER BY clicks DESC, last_click DESC
      LIMIT 12
    `);

    const customerStatsResult = await pool.query(`
      SELECT
        u.customer_code,
        u.nome,
        u.cognome,
        u.app_token,
        COUNT(*)::int AS clicks,
        COUNT(*) FILTER (
          WHERE oc.created_at >= NOW() - INTERVAL '7 days'
        )::int AS clicks_7d,
        MAX(oc.created_at) AS last_click
      FROM offer_clicks oc
      LEFT JOIN users u
        ON oc.user_id = u.id
      GROUP BY u.customer_code, u.nome, u.cognome
      ORDER BY clicks DESC, last_click DESC
      LIMIT 12
    `);

    const recentClicksResult = await pool.query(`
      SELECT
        oc.created_at,
        oc.asin,
        oc.titolo,
        oc.source,
        oc.affiliate_url,
        u.customer_code,
        u.nome,
        u.cognome
      FROM offer_clicks oc
      LEFT JOIN users u
        ON oc.user_id = u.id
      ORDER BY oc.created_at DESC
      LIMIT 30
    `);

    res.json({
      success: true,
      summary: summaryResult.rows[0] || {
        total_clicks: 0,
        clicks_24h: 0,
        clicks_7d: 0,
        clicks_30d: 0,
        unique_customers_7d: 0,
        unique_products: 0
      },
      topProducts: topProductsResult.rows,
      dailyClicks: dailyClicksResult.rows,
      sourceStats: sourceStatsResult.rows,
      customerStats: customerStatsResult.rows,
      recentClicks: recentClicksResult.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| WHATSAPP BROADCAST - WAHA
|--------------------------------------------------------------------------
*/

app.post("/api/broadcast/whatsapp", async (req, res) => {
  let broadcastId = null;

  try {
    const { message, customer_ids } = req.body;

    const cleanMessage = String(message || "").trim();

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        error: "Messaggio mancante"
      });
    }

    if (cleanMessage.length > 1800) {
      return res.status(400).json({
        success: false,
        error: "Messaggio troppo lungo. Limite massimo: 1800 caratteri."
      });
    }

    const params = [];
    let whereClause = `
      WHERE role = 'customer'
        AND telefono IS NOT NULL
        AND TRIM(telefono) <> ''
        AND COALESCE(broadcast_opt_out, false) = false
    `;

    if (Array.isArray(customer_ids) && customer_ids.length > 0) {
      params.push(customer_ids);
      whereClause += `
        AND id = ANY($1::uuid[])
      `;
    }

    const customersResult = await pool.query(
      `
      SELECT
        id,
        customer_code,
        nome,
        cognome,
        telefono,
        COALESCE(broadcast_opt_out, false) AS broadcast_opt_out
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      `,
      params
    );

    const customers = customersResult.rows;

    const broadcastResult = await pool.query(
      `
      INSERT INTO whatsapp_broadcasts (
        message,
        target_count,
        status,
        created_by
      )
      VALUES ($1, $2, 'running', $3)
      RETURNING id
      `,
      [
        cleanMessage,
        customers.length,
        req.user?.id || null
      ]
    );

    broadcastId = broadcastResult.rows[0].id;

    const sent = [];
    const failed = [];
    const skipped = [];

    for (const customer of customers) {
      const chatId = normalizeWhatsAppChatId(customer.telefono);

      if (!chatId) {
        const skippedItem = {
          customer,
          reason: "Telefono non valido"
        };

        skipped.push(skippedItem);

        await pool.query(
          `
          INSERT INTO whatsapp_broadcast_recipients (
            broadcast_id,
            customer_id,
            customer_code,
            nome,
            cognome,
            telefono,
            chat_id,
            status,
            error
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,'skipped',$8)
          `,
          [
            broadcastId,
            customer.id,
            customer.customer_code,
            customer.nome,
            customer.cognome,
            customer.telefono,
            chatId,
            skippedItem.reason
          ]
        );

        continue;
      }

      try {
        const result = await sendWahaTextMessage({
          chatId,
          text: cleanMessage
        });

        const sentItem = {
          customer,
          chatId,
          endpoint: result.endpoint
        };

        sent.push(sentItem);

        await pool.query(
          `
          INSERT INTO whatsapp_broadcast_recipients (
            broadcast_id,
            customer_id,
            customer_code,
            nome,
            cognome,
            telefono,
            chat_id,
            status,
            sent_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,'sent',NOW())
          `,
          [
            broadcastId,
            customer.id,
            customer.customer_code,
            customer.nome,
            customer.cognome,
            customer.telefono,
            chatId
          ]
        );

        await new Promise((resolve) => setTimeout(resolve, 850));
      } catch (err) {
        const failedItem = {
          customer,
          chatId,
          error: err.message
        };

        failed.push(failedItem);

        await pool.query(
          `
          INSERT INTO whatsapp_broadcast_recipients (
            broadcast_id,
            customer_id,
            customer_code,
            nome,
            cognome,
            telefono,
            chat_id,
            status,
            error
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,'failed',$8)
          `,
          [
            broadcastId,
            customer.id,
            customer.customer_code,
            customer.nome,
            customer.cognome,
            customer.telefono,
            chatId,
            err.message
          ]
        );
      }
    }

    await pool.query(
      `
      UPDATE whatsapp_broadcasts
      SET
        sent_count = $1,
        failed_count = $2,
        skipped_count = $3,
        status = 'completed'
      WHERE id = $4
      `,
      [
        sent.length,
        failed.length,
        skipped.length,
        broadcastId
      ]
    );

    res.json({
      success: true,
      broadcast_id: broadcastId,
      total: customers.length,
      sent_count: sent.length,
      failed_count: failed.length,
      skipped_count: skipped.length,
      sent,
      failed,
      skipped
    });
  } catch (err) {
    if (broadcastId) {
      await pool.query(
        `
        UPDATE whatsapp_broadcasts
        SET status = 'failed'
        WHERE id = $1
        `,
        [broadcastId]
      ).catch(() => {});
    }

    res.status(500).json({
      success: false,
      broadcast_id: broadcastId,
      error: err.message
    });
  }
});

app.get("/api/broadcast/whatsapp/history", async (req, res) => {
  try {
    const broadcastsResult = await pool.query(`
      SELECT
        id,
        LEFT(message, 220) AS message_preview,
        target_count,
        sent_count,
        failed_count,
        skipped_count,
        status,
        created_at
      FROM whatsapp_broadcasts
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      broadcasts: broadcastsResult.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/api/broadcast/whatsapp/history/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const broadcastResult = await pool.query(
      `
      SELECT
        id,
        message,
        target_count,
        sent_count,
        failed_count,
        skipped_count,
        status,
        created_at
      FROM whatsapp_broadcasts
      WHERE id = $1
      `,
      [id]
    );

    if (broadcastResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Broadcast non trovato"
      });
    }

    const recipientsResult = await pool.query(
      `
      SELECT
        id,
        customer_id,
        customer_code,
        nome,
        cognome,
        telefono,
        chat_id,
        status,
        error,
        sent_at,
        created_at
      FROM whatsapp_broadcast_recipients
      WHERE broadcast_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );

    res.json({
      success: true,
      broadcast: broadcastResult.rows[0],
      recipients: recipientsResult.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


/*
|--------------------------------------------------------------------------
| DEVICES
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| DEVICES
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| PUBLIC RECEIPT UPLOAD
|--------------------------------------------------------------------------
*/

app.get("/api/receipt-upload/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `
      SELECT
        rut.token,
        rut.expires_at,
        rut.used_at,
        d.id AS device_id,
        d.marca,
        d.modello,
        d.categoria,
        d.receipt_filename,
        d.receipt_uploaded_at,
        u.customer_code,
        u.nome,
        u.cognome
      FROM receipt_upload_tokens rut
      JOIN devices d
        ON rut.device_id = d.id
      JOIN users u
        ON d.user_id = u.id
      WHERE rut.token = $1
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Link non valido"
      });
    }

    const item = result.rows[0];

    if (item.used_at) {
      return res.status(410).json({
        success: false,
        error: "Questo link è già stato usato"
      });
    }

    if (new Date(item.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        error: "Link scaduto. Genera un nuovo QR dall'admin."
      });
    }

    res.json({
      success: true,
      expires_at: item.expires_at,
      device: {
        id: item.device_id,
        marca: item.marca,
        modello: item.modello,
        categoria: item.categoria,
        receipt_filename: item.receipt_filename,
        receipt_uploaded_at: item.receipt_uploaded_at
      },
      customer: {
        customer_code: item.customer_code,
        nome: item.nome,
        cognome: item.cognome,
        app_token: item.app_token
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/api/receipt-upload/:token/receipt", async (req, res) => {
  try {
    const { token } = req.params;

    const {
      filename,
      mime_type,
      data_url
    } = req.body;

    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!filename || !mime_type || !data_url) {
      return res.status(400).json({
        success: false,
        error: "Dati scontrino mancanti"
      });
    }

    if (!allowedMimeTypes.includes(mime_type)) {
      return res.status(400).json({
        success: false,
        error: "Formato non supportato. Usa PDF, JPG, PNG o WEBP."
      });
    }

    if (!String(data_url).startsWith(`data:${mime_type};base64,`)) {
      return res.status(400).json({
        success: false,
        error: "Formato file non valido"
      });
    }

    if (String(data_url).length > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: "File troppo grande. Limite massimo 5 MB circa."
      });
    }

    const tokenResult = await pool.query(
      `
      SELECT
        rut.token,
        rut.device_id,
        rut.expires_at,
        rut.used_at
      FROM receipt_upload_tokens rut
      WHERE rut.token = $1
      `,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Link non valido"
      });
    }

    const uploadToken = tokenResult.rows[0];

    if (uploadToken.used_at) {
      return res.status(410).json({
        success: false,
        error: "Questo link è già stato usato"
      });
    }

    if (new Date(uploadToken.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        error: "Link scaduto. Genera un nuovo QR dall'admin."
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const deviceResult = await client.query(
        `
        UPDATE devices
        SET
          receipt_filename = $1,
          receipt_mime_type = $2,
          receipt_data_url = $3,
          receipt_uploaded_at = NOW()
        WHERE id = $4
        RETURNING *
        `,
        [
          filename,
          mime_type,
          data_url,
          uploadToken.device_id
        ]
      );

      await client.query(
        `
        UPDATE receipt_upload_tokens
        SET used_at = NOW()
        WHERE token = $1
        `,
        [token]
      );

      await client.query("COMMIT");

      res.json({
        success: true,
        device: deviceResult.rows[0]
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/api/devices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id,
        d.user_id,
        d.marca,
        d.modello,
        d.categoria,
        d.data_acquisto,
        d.scadenza_garanzia,
        d.note,
        d.receipt_filename,
        d.receipt_mime_type,
        d.receipt_data_url,
        d.receipt_uploaded_at,
        u.customer_code,
        u.nome,
        u.cognome,
        u.telefono
      FROM devices d
      JOIN users u
        ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {

   res.status(500).json({
  message: err.message,
  stack: err.stack,
  status: err.response?.status,
  response: err.response?.data
});

  }
});

app.post("/api/devices", async (req, res) => {
  try {

        const {
          user_id,
          marca,
          modello,
          categoria,
          data_acquisto,
          scadenza_garanzia,
          note
        } = req.body;
    const result = await pool.query(
      `
INSERT INTO devices (
  user_id,
  marca,
  modello,
  categoria,
  data_acquisto,
  scadenza_garanzia,
  note
)
VALUES (
  $1,$2,$3,$4,$5,$6,$7
)  
    RETURNING *
      `,
      [
  user_id,
  marca,
  modello,
  categoria,
  data_acquisto,
  scadenza_garanzia,
  note
]
    );

    res.json({
      success: true,
      device: result.rows[0]
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
});

/*
|--------------------------------------------------------------------------
| UPDATE DEVICE
|--------------------------------------------------------------------------
*/

app.put("/api/devices/:id", async (req, res) => {
  try {

    const { id } = req.params;

    const {
  marca,
  modello,
  categoria,
  data_acquisto,
  scadenza_garanzia,
  note
} = req.body;

    const result = await pool.query(
      `
      UPDATE devices
SET
  marca = $1,
  modello = $2,
  categoria = $3,
  data_acquisto = $4,
  scadenza_garanzia = $5,
  note = $6
WHERE id = $7
      RETURNING *
      `,
      [
  marca,
  modello,
  categoria,
  data_acquisto,
  scadenza_garanzia,
  note,
  id
]
    );

    res.json({
      success: true,
      device: result.rows[0]
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
});




/*
|--------------------------------------------------------------------------
| DEVICE RECEIPT PHONE UPLOAD TOKEN
|--------------------------------------------------------------------------
*/

app.post("/api/devices/:id/receipt-upload-token", async (req, res) => {
  try {
    const { id } = req.params;

    const deviceResult = await pool.query(
      `
      SELECT
        d.id,
        d.marca,
        d.modello,
        d.categoria,
        u.nome,
        u.cognome,
        u.customer_code
      FROM devices d
      JOIN users u
        ON d.user_id = u.id
      WHERE d.id = $1
      `,
      [id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Dispositivo non trovato"
      });
    }

    await pool.query(
      `
      DELETE FROM receipt_upload_tokens
      WHERE device_id = $1
        AND (
          used_at IS NOT NULL
          OR expires_at < NOW()
        )
      `,
      [id]
    );

    const token = crypto.randomBytes(32).toString("hex");

    const result = await pool.query(
      `
      INSERT INTO receipt_upload_tokens (
        token,
        device_id,
        expires_at
      )
      VALUES (
        $1,
        $2,
        NOW() + INTERVAL '30 minutes'
      )
      RETURNING token, expires_at
      `,
      [token, id]
    );

    res.json({
      success: true,
      token: result.rows[0].token,
      expires_at: result.rows[0].expires_at,
      device: deviceResult.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| DEVICE RECEIPT
|--------------------------------------------------------------------------
*/

app.put("/api/devices/:id/receipt", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      filename,
      mime_type,
      data_url
    } = req.body;

    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!filename || !mime_type || !data_url) {
      return res.status(400).json({
        success: false,
        error: "Dati scontrino mancanti"
      });
    }

    if (!allowedMimeTypes.includes(mime_type)) {
      return res.status(400).json({
        success: false,
        error: "Formato non supportato. Usa PDF, JPG, PNG o WEBP."
      });
    }

    if (!String(data_url).startsWith(`data:${mime_type};base64,`)) {
      return res.status(400).json({
        success: false,
        error: "Formato file non valido"
      });
    }

    if (String(data_url).length > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: "File troppo grande. Limite massimo 5 MB circa."
      });
    }

    const result = await pool.query(
      `
      UPDATE devices
      SET
        receipt_filename = $1,
        receipt_mime_type = $2,
        receipt_data_url = $3,
        receipt_uploaded_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [
        filename,
        mime_type,
        data_url,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Dispositivo non trovato"
      });
    }

    res.json({
      success: true,
      device: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.delete("/api/devices/:id/receipt", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE devices
      SET
        receipt_filename = NULL,
        receipt_mime_type = NULL,
        receipt_data_url = NULL,
        receipt_uploaded_at = NULL
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Dispositivo non trovato"
      });
    }

    res.json({
      success: true,
      device: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.delete("/api/devices/:id", async (req, res) => {
  try {

    const { id } = req.params;

    await pool.query(
      "DELETE FROM devices WHERE id = $1",
      [id]
    );

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
});

app.get("/api/offers", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT *
      FROM offers
      ORDER BY created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
});

  app.post("/api/offers", async (req, res) => {
    try {

          const {
            categoria,
            partner,
            titolo,
            descrizione,
            affiliate_url,
            image_url,
            tipo_offerta = "accessory"
          } = req.body;
      const result = await pool.query(
            `
            INSERT INTO offers (
              categoria,
              partner,
              titolo,
              descrizione,
              affiliate_url,
              image_url,
              tipo_offerta
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *
            `,
            [
              categoria,
              partner,
              titolo,
              descrizione,
              affiliate_url,
              image_url,
              tipo_offerta
            ]
          );

      res.json({
        success: true,
        offer: result.rows[0]
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        error: err.message
      });

    }
  });

    app.put("/api/offers/:id", async (req, res) => {
      try {

        const { id } = req.params;

        const {
          categoria,
          partner,
          titolo,
          descrizione,
          affiliate_url,
          image_url
        } = req.body;

        const result = await pool.query(
          `
          UPDATE offers
          SET
            categoria = $1,
            partner = $2,
            titolo = $3,
            descrizione = $4,
            affiliate_url = $5,
            image_url = $6
          WHERE id = $7
          RETURNING *
          `,
          [
            categoria,
            partner,
            titolo,
            descrizione,
            affiliate_url,
            image_url,
            id
          ]
        );

        res.json({
          success: true,
          offer: result.rows[0]
        });

      } catch (err) {

        res.status(500).json({
          success: false,
          error: err.message
        });

      }
    });
app.delete("/api/offers/:id", async (req, res) => {
  try {

    const { id } = req.params;

    await pool.query(
      "DELETE FROM offers WHERE id = $1",
      [id]
    );

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
});


/*
|--------------------------------------------------------------------------
| ADMIN - LIVE OFFERS
|--------------------------------------------------------------------------
*/

app.get("/api/live-offers", async (req, res) => {
  try {
    const settings = await ensureLiveSettings();
    await expireOldLiveOffers();

    const sourcesResult = await pool.query(
      `
      SELECT
        id,
        channel_ref,
        label,
        enabled,
        created_at,
        updated_at
      FROM live_offer_sources
      ORDER BY created_at DESC
      `
    );

    const offersResult = await pool.query(
      `
      SELECT
        id,
        source_type,
        source_channel,
        asin,
        title,
        price_text,
        previous_price_text,
        discount_percent,
        coupon_text,
        affiliate_url,
        category,
        status,
        imported_at,
        expires_at,
        last_seen_at
      FROM live_offers
      ORDER BY imported_at DESC
      LIMIT 80
      `
    );

    res.json({
      success: true,
      settings,
      sources: sourcesResult.rows,
      offers: offersResult.rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.put("/api/live-offers/settings", async (req, res) => {
  try {
    const current = await ensureLiveSettings();
    const {
      enabled,
      telegram_auto_import_enabled,
      amazon_tag,
      ttl_hours,
      max_visible
    } = req.body || {};

    const nextSettings = {
      enabled: typeof enabled === "boolean" ? enabled : current.enabled,
      telegram_auto_import_enabled:
        typeof telegram_auto_import_enabled === "boolean"
          ? telegram_auto_import_enabled
          : current.telegram_auto_import_enabled,
      amazon_tag: normalizeAmazonTag(amazon_tag ?? current.amazon_tag),
      ttl_hours: clampNumber(ttl_hours, current.ttl_hours || 24, 1, 168),
      max_visible: clampNumber(max_visible, current.max_visible || 20, 1, 100)
    };

    const result = await pool.query(
      `
      INSERT INTO live_offer_settings (
        id,
        enabled,
        telegram_auto_import_enabled,
        amazon_tag,
        ttl_hours,
        max_visible,
        updated_at
      )
      VALUES (true,$1,$2,$3,$4,$5,NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        telegram_auto_import_enabled = EXCLUDED.telegram_auto_import_enabled,
        amazon_tag = EXCLUDED.amazon_tag,
        ttl_hours = EXCLUDED.ttl_hours,
        max_visible = EXCLUDED.max_visible,
        updated_at = NOW()
      RETURNING
        enabled,
        telegram_auto_import_enabled,
        amazon_tag,
        ttl_hours,
        max_visible,
        updated_at
      `,
      [
        nextSettings.enabled,
        nextSettings.telegram_auto_import_enabled,
        nextSettings.amazon_tag,
        nextSettings.ttl_hours,
        nextSettings.max_visible
      ]
    );

    res.json({
      success: true,
      settings: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/api/live-offers/sources", async (req, res) => {
  try {
    const channelRef = normalizeChannelRef(req.body?.channel_ref);
    const label = String(req.body?.label || "").trim();

    if (!channelRef) {
      return res.status(400).json({
        success: false,
        error: "Canale Telegram mancante"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO live_offer_sources (
        channel_ref,
        label,
        enabled
      )
      VALUES ($1,$2,true)
      ON CONFLICT (channel_ref)
      DO UPDATE SET
        label = COALESCE(NULLIF(EXCLUDED.label, ''), live_offer_sources.label),
        enabled = true,
        updated_at = NOW()
      RETURNING *
      `,
      [channelRef, label || channelRef]
    );

    res.json({
      success: true,
      source: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.put("/api/live-offers/sources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const enabled = Boolean(req.body?.enabled);

    const result = await pool.query(
      `
      UPDATE live_offer_sources
      SET
        enabled = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [enabled, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Canale non trovato"
      });
    }

    res.json({
      success: true,
      source: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.delete("/api/live-offers/sources/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM live_offer_sources WHERE id = $1",
      [req.params.id]
    );

    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/api/live-offers/import-text", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const sourceChannel = normalizeChannelRef(req.body?.source_channel || "manual-test");

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Testo offerta mancante"
      });
    }

    const result = await saveLiveOfferFromText({
      text,
      sourceChannel
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.put("/api/live-offers/:id/status", async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim();

    if (!["published", "hidden", "expired", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Stato non valido"
      });
    }

    const result = await pool.query(
      `
      UPDATE live_offers
      SET status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Offerta live non trovata"
      });
    }

    res.json({
      success: true,
      offer: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});



app.get("/api/live-offers/monitor", async (req, res) => {
  try {
    await expireOldLiveOffers();

    const settings = await ensureLiveSettings();

    const countsResult = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'published' AND expires_at > NOW())::int AS active_live,
        COUNT(*) FILTER (WHERE imported_at >= NOW() - INTERVAL '24 hours')::int AS imported_24h,
        COUNT(*) FILTER (WHERE imported_at::date = CURRENT_DATE)::int AS imported_today,
        COUNT(*) FILTER (WHERE status = 'expired')::int AS expired_total,
        COUNT(*)::int AS total
      FROM live_offers
      `
    );

    const latestResult = await pool.query(
      `
      SELECT
        id,
        asin,
        title,
        source_channel,
        status,
        imported_at,
        expires_at
      FROM live_offers
      ORDER BY imported_at DESC
      LIMIT 1
      `
    );

    const sourcesResult = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE enabled = true)::int AS enabled_sources,
        COUNT(*)::int AS total_sources
      FROM live_offer_sources
      `
    );

    const stateResult = await pool.query(
      `
      SELECT key, value, updated_at
      FROM app_runtime_state
      WHERE key IN (
        'telegram_account_heartbeat_at',
        'telegram_account_status',
        'telegram_account_message',
        'telegram_account_sources_count',
        'telegram_account_imported_count',
        'telegram_account_skipped_count',
        'telegram_account_error_count'
      )
      `
    );

    const state = Object.fromEntries(
      stateResult.rows.map((row) => [row.key, row.value])
    );

    const heartbeatAt = state.telegram_account_heartbeat_at || null;
    const heartbeatAgeSeconds = heartbeatAt
      ? Math.round((Date.now() - new Date(heartbeatAt).getTime()) / 1000)
      : null;

    let serviceStatus = "unknown";

    if (heartbeatAgeSeconds === null) {
      serviceStatus = "unknown";
    } else if (heartbeatAgeSeconds <= 180) {
      serviceStatus = "ok";
    } else if (heartbeatAgeSeconds <= 600) {
      serviceStatus = "warning";
    } else {
      serviceStatus = "ko";
    }

    res.json({
      success: true,
      settings: {
        enabled: Boolean(settings.enabled),
        telegram_auto_import_enabled: Boolean(settings.telegram_auto_import_enabled),
        ttl_hours: Number(settings.ttl_hours || 24),
        max_visible: Number(settings.max_visible || 20)
      },
      counts: countsResult.rows[0] || {},
      sources: sourcesResult.rows[0] || {},
      latestOffer: latestResult.rows[0] || null,
      service: {
        status: serviceStatus,
        heartbeat_at: heartbeatAt,
        heartbeat_age_seconds: heartbeatAgeSeconds,
        raw_status: state.telegram_account_status || "",
        message: state.telegram_account_message || "",
        sources_count: Number.parseInt(state.telegram_account_sources_count || "0", 10) || 0,
        imported_count: Number.parseInt(state.telegram_account_imported_count || "0", 10) || 0,
        skipped_count: Number.parseInt(state.telegram_account_skipped_count || "0", 10) || 0,
        error_count: Number.parseInt(state.telegram_account_error_count || "0", 10) || 0
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


app.get("/api/amazon/search", async (req, res) => {
  try {

    const q = req.query.q;

    if (!q) {
      return res.status(400).json({
        error: "Parametro q mancante"
      });
    }

    const data = await searchCreators(q);

    res.json(data);

  } catch (err) {

    console.log("AMAZON ERROR");
    console.log("STATUS:", err.response?.status);
    console.log("DATA:", JSON.stringify(err.response?.data, null, 2));

    res.status(500).json({
      message: err.message,
      status: err.response?.status,
      response: err.response?.data
    });

  }
});


app.get("/api/creators/search", async (req, res) => {

  try {

    const q = req.query.q;

    if (!q) {
      return res.status(400).json({
        error: "Parametro q mancante"
      });
    }

    const data = await searchCreators(q);

    res.json(data);

  } catch (err) {

    console.log("CREATORS ERROR");
    console.log("STATUS:", err.response?.status);
    console.log("DATA:", JSON.stringify(err.response?.data, null, 2));

    res.status(500).json({
      message: err.message,
      status: err.response?.status,
      response: err.response?.data
    });

  }

});

app.post("/api/trending/refresh", async (req, res) => {

  try {

    await refreshTrendingOffers();

    res.json({
      success: true
    });

  } catch (err) {

    console.error("TRENDING ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});
app.listen(process.env.PORT || 3006, () => {
  console.log(
    `Smart Assistance Backend avviato sulla porta ${
      process.env.PORT || 3006
    }`
  );

  const pollSeconds = clampNumber(process.env.TELEGRAM_POLL_SECONDS || 60, 60, 30, 3600);

  setInterval(pollTelegramLiveOffers, pollSeconds * 1000);
  setTimeout(pollTelegramLiveOffers, 5000);
});




































