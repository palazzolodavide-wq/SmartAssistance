const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
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

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

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
        role
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
        marca,
        modello,
        data_acquisto,
        scadenza_garanzia,
        note,
        categoria
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
| DEVICES
|--------------------------------------------------------------------------
*/

app.get("/api/devices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id,
        d.marca,
        d.modello,
        d.data_acquisto,
        d.scadenza_garanzia,
        d.note,
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




































