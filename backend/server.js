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
| ADMIN AUTH MIDDLEWARE
|--------------------------------------------------------------------------
*/

function authenticateAdmin(req, res, next) {
  const publicApiRoutes = [
    /^\/api\/app\/[^/]+$/,
    /^\/api\/app\/[^/]+\/click$/,
    /^\/api\/receipt-upload\/[^/]+$/,
    /^\/api\/receipt-upload\/[^/]+\/receipt$/,
    /^\/api\/flyer\/lavialattea$/,
    /^\/api\/flyer\/lavialattea\/embed$/,
    /^\/api\/flyer\/lavialattea\/pages$/,
    /^\/api\/flyer\/lavialattea\/image$/,
    /^\/app\/[^/]+$/,
    /^\/app\/[^/]+\/click$/,
    /^\/receipt-upload\/[^/]+$/,
    /^\/receipt-upload\/[^/]+\/receipt$/,
    /^\/flyer\/lavialattea$/
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


/*
|--------------------------------------------------------------------------
| PUBLIC FLYER RESOLVER
|--------------------------------------------------------------------------
*/

const LAVIALATTEA_FLYER_PAGE_URL = "https://www.lavialattea.it/volantino/";
const ALLOWED_FLYER_HOSTS = new Set([
  "www.lavialattea.it",
  "lavialattea.it",
  "www.euronics.it",
  "euronics.it"
]);

function normalizeFlyerUrl(value, baseUrl = LAVIALATTEA_FLYER_PAGE_URL) {
  if (!value) {
    return "";
  }

  try {
    return new URL(
      String(value)
        .replace(/&amp;/g, "&")
        .replace(/&#038;/g, "&")
        .replace(/["']/g, "")
        .trim(),
      baseUrl
    ).href;
  } catch (err) {
    return "";
  }
}

function getAttribute(tag, attributeName) {
  const match = tag.match(new RegExp(`${attributeName}=["']([^"']+)["']`, "i"));
  return match ? match[1] : "";
}

function addImageCandidate(candidates, value, index, baseUrl = LAVIALATTEA_FLYER_PAGE_URL) {
  const url = normalizeFlyerUrl(value, baseUrl);

  if (!url) {
    return;
  }

  const lower = url.toLowerCase();

  if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(lower)) {
    return;
  }

  if (
    lower.includes("logo") ||
    lower.includes("favicon") ||
    lower.includes("icon") ||
    lower.includes("placeholder") ||
    lower.includes("spinner") ||
    lower.includes("loader") ||
    lower.includes("avatar")
  ) {
    return;
  }

  if (!candidates.some((item) => item.url === url)) {
    candidates.push({
      url,
      index
    });
  }
}

function extractFlyerPagesFromHtml(html) {
  const content =
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    html.match(/<div[^>]+class=["'][^"']*entry-content[^"']*["'][^>]*>[\s\S]*?<\/div>/i)?.[0] ||
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ||
    html;

  const candidates = [];
  const imageTagMatches = [...content.matchAll(/<img\b[^>]*>/gi)];

  imageTagMatches.forEach((match, index) => {
    const tag = match[0];

    [
      "src",
      "data-src",
      "data-lazy-src",
      "data-original",
      "data-large_image",
    ].forEach((attributeName) => {
      addImageCandidate(candidates, getAttribute(tag, attributeName), index);
    });

    const srcset =
      getAttribute(tag, "srcset") ||
      getAttribute(tag, "data-srcset");

    if (srcset) {
      srcset.split(",").forEach((part) => {
        const srcsetUrl = part.trim().split(/\s+/)[0];
        addImageCandidate(candidates, srcsetUrl, index);
      });
    }
  });

  const contentUrlMatches = [
    ...content.matchAll(/https?:\/\/[^"'()\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'()\s<>]*)?/gi)
  ];

  contentUrlMatches.forEach((match, index) => {
    addImageCandidate(candidates, match[0], imageTagMatches.length + index);
  });

  const scoreImage = (url) => {
    const lower = url.toLowerCase();
    let score = 0;

    if (lower.includes("volantino")) score += 10;
    if (lower.includes("facciamo")) score += 8;
    if (lower.includes("meta")) score += 6;
    if (lower.includes("euronics")) score += 5;
    if (lower.includes("lavialattea")) score += 4;
    if (lower.includes("wp-content")) score += 2;
    if (lower.includes("qr")) score -= 6;
    if (lower.includes("banner")) score -= 2;

    return score;
  };

  const sorted = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreImage(candidate.url),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.index - b.index;
    });

  const useful =
    sorted.some((candidate) => candidate.score >= 8)
      ? sorted.filter((candidate) => candidate.score >= 8)
      : sorted;

  return useful.map((candidate, index) => ({
    index,
    image_url: `/api/flyer/lavialattea/image?url=${encodeURIComponent(candidate.url)}`,
    source_url: candidate.url,
  }));
}

async function loadLaViaLatteaFlyerHtml() {
  const response = await fetch(LAVIALATTEA_FLYER_PAGE_URL, {
    headers: {
      "User-Agent": "SmartAssistance/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Errore caricamento volantino: ${response.status}`);
  }

  return response.text();
}

app.get("/api/flyer/lavialattea", async (req, res) => {
  try {
    const html = await loadLaViaLatteaFlyerHtml();
    const pages = extractFlyerPagesFromHtml(html);

    res.json({
      success: true,
      title: "Volantino La Via Lattea Euronics",
      source: pages.length > 0 ? "lavialattea_images" : "lavialattea_page",
      page_url: LAVIALATTEA_FLYER_PAGE_URL,
      embed_url: "/api/flyer/lavialattea/pages",
      pages_url: "/api/flyer/lavialattea/pages",
      pages_count: pages.length,
      is_direct_flyer: pages.length > 0,
      is_internal_embed: true
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/api/flyer/lavialattea/pages", async (req, res) => {
  try {
    const html = await loadLaViaLatteaFlyerHtml();
    const pages = extractFlyerPagesFromHtml(html);

    res.setHeader("Cache-Control", "public, max-age=900");
    res.json({
      success: true,
      title: "Volantino La Via Lattea Euronics",
      page_url: LAVIALATTEA_FLYER_PAGE_URL,
      pages,
      pages_count: pages.length,
      is_native_viewer: true,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      pages: [],
    });
  }
});

app.get("/api/flyer/lavialattea/image", async (req, res) => {
  try {
    const sourceUrl = normalizeFlyerUrl(req.query.url);

    if (!sourceUrl) {
      return res.status(400).send("URL immagine non valido");
    }

    const parsed = new URL(sourceUrl);

    if (!ALLOWED_FLYER_HOSTS.has(parsed.hostname)) {
      return res.status(403).send("Host immagine non consentito");
    }

    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "SmartAssistance/1.0",
        "Referer": LAVIALATTEA_FLYER_PAGE_URL
      }
    });

    if (!response.ok) {
      return res.status(response.status).send("Immagine non disponibile");
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=900");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).send("Errore caricamento immagine");
  }
});

app.get("/api/flyer/lavialattea/embed", async (req, res) => {
  try {
    const html = await loadLaViaLatteaFlyerHtml();
    const pages = extractFlyerPagesFromHtml(html);

    const imagesHtml = pages.length > 0
      ? pages.map((page) => `<img src="${page.image_url}" alt="Pagina volantino ${page.index + 1}" />`).join("")
      : "<p>Volantino non disponibile in questo momento.</p>";

    const optimizedHtml = `
      <!doctype html>
      <html lang="it">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #111827;
              font-family: Arial, sans-serif;
            }
            body { padding: 0; }
            img {
              width: 100%;
              height: auto;
              display: block;
              margin: 0 auto 12px;
            }
          </style>
        </head>
        <body>${imagesHtml}</body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=900");
    res.send(optimizedHtml);
  } catch (err) {
    res.status(500).send("Volantino non disponibile");
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
        app_token
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
      telefono
    } = req.body;

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
        app_token
      )
      VALUES (
        $1,
        'customer',
        $2,
        $3,
        $4,
        $5,
        'changeme',
        true,
        $6
      )
      RETURNING *
      `,
      [
        customerCode,
        nome,
        cognome,
        email,
        telefono,
        appToken
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
      telefono
    } = req.body;

    const result = await pool.query(
      `
      UPDATE users
      SET
        nome = $1,
        cognome = $2,
        email = $3,
        telefono = $4
      WHERE id = $5
      RETURNING *
      `,
      [
        nome,
        cognome,
        email,
        telefono,
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
        telefono
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

        const device = devicesResult.rows[0];

        const searches = [
          `${device.marca} ${device.modello} cover`,
          `${device.marca} ${device.modello} pellicola vetro`,
          `${device.marca} ${device.modello} caricatore usb-c`,
          `${device.marca} ${device.modello} power bank`,
          `${device.marca} ${device.modello} auricolari bluetooth`
        ];

        const creatorResponses = await Promise.all(
          searches.map(searchCreators)
        );

            const offers = creatorResponses
              .flatMap(response =>
                response.searchResult?.items || []
              )
              .map(item => ({
                    asin: item.asin,
                    categoria: device.categoria,
                    titolo:
                      item.itemInfo?.title?.displayValue || "",
                    descrizione:
                      item.itemInfo?.title?.displayValue || "",
                    affiliate_url:
                      item.detailPageURL || "",
                    image_url:
                      item.images?.primary?.medium?.url || null,
                    prezzo:
                      item.offersV2?.listings?.[0]?.price?.money?.displayAmount || null,
                    prezzo_precedente:
                      item.offersV2?.listings?.[0]?.price?.savingBasis?.money?.displayAmount || null,
                    sconto_percentuale:
                      item.offersV2?.listings?.[0]?.price?.savings?.percentage || null,
                    tipo_offerta: "accessory"
                  }))
              .filter(offer =>
                offer.titolo &&
                offer.affiliate_url &&
                offer.asin
              );

            const uniqueOffers = [
              ...new Map(
                offers.map(offer => [offer.asin, offer])
              ).values()
            ];
                const trendingOffers =
          await getTrendingOffers(10);

        res.json({
          success: true,
          customer,
          device: device || null,
          devices: devicesResult.rows,
          recommendedOffers:
              getRecommendedOffers(uniqueOffers),
          trendingOffers
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
        )::int AS clicks_7d
      FROM offer_clicks
    `);

    const topProductsResult = await pool.query(`
      SELECT
        COALESCE(asin, '') AS asin,
        COALESCE(NULLIF(titolo, ''), 'Prodotto senza titolo') AS titolo,
        COUNT(*)::int AS clicks,
        MAX(created_at) AS last_click
      FROM offer_clicks
      GROUP BY asin, titolo
      ORDER BY clicks DESC, last_click DESC
      LIMIT 10
    `);

    const recentClicksResult = await pool.query(`
      SELECT
        oc.created_at,
        oc.asin,
        oc.titolo,
        oc.source,
        u.customer_code,
        u.nome,
        u.cognome
      FROM offer_clicks oc
      LEFT JOIN users u
        ON oc.user_id = u.id
      ORDER BY oc.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      summary: summaryResult.rows[0] || {
        total_clicks: 0,
        clicks_24h: 0,
        clicks_7d: 0
      },
      topProducts: topProductsResult.rows,
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
        cognome: item.cognome
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
});




































