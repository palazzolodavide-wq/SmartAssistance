const { Pool } = require("pg");
const { searchCreators } = require("./creators");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TRENDING_QUERIES = [
  { categoria: "audio", query: "auricolari bluetooth" },
  { categoria: "power", query: "power bank usb-c" },
  { categoria: "charger", query: "caricatore usb-c 45w" },
  { categoria: "wearable", query: "smartwatch" },
  { categoria: "smart_home", query: "presa smart wifi" },
  { categoria: "auto", query: "supporto auto magsafe" },
  { categoria: "office", query: "mini stampante termica" },
  { categoria: "speaker", query: "speaker bluetooth" }
];

function calculateScore(item) {

  const listing = item.offersV2?.listings?.[0];

  const discount =
    listing?.price?.savings?.percentage || 0;

  let score = 0;

  score += discount * 3;

  if (item.images?.primary?.medium?.url) {
    score += 20;
  }

  if (listing?.price?.money?.amount) {
    score += 20;
  }

  if (listing?.isBuyBoxWinner) {
    score += 15;
  }

  return score;
}

async function refreshTrendingOffers() {

  for (const entry of TRENDING_QUERIES) {

    let response = null;

    for (let attempt = 1; attempt <= 3; attempt++) {

      try {

        response = await searchCreators(entry.query);
        break;

      } catch (err) {

        if (err.response?.status !== 429 || attempt === 3) {
          throw err;
        }

        console.log(
          `Rate limit Amazon (${entry.query}) - tentativo ${attempt}/3`
        );

        await sleep(attempt * 5000);

      }

    }

    const items =
      response.searchResult?.items || [];

    for (const item of items) {

      const listing =
        item.offersV2?.listings?.[0];

      const score =
        calculateScore(item);

      await pool.query(
        `
        INSERT INTO trending_offers (
          asin,
          categoria,
          titolo,
          affiliate_url,
          image_url,
          prezzo,
          sconto_percentuale,
          score,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,NOW()
        )
        ON CONFLICT (asin)
        DO UPDATE SET
          categoria = EXCLUDED.categoria,
          titolo = EXCLUDED.titolo,
          affiliate_url = EXCLUDED.affiliate_url,
          image_url = EXCLUDED.image_url,
          prezzo = EXCLUDED.prezzo,
          sconto_percentuale = EXCLUDED.sconto_percentuale,
          score = EXCLUDED.score,
          updated_at = NOW()
        `,
        [
          item.asin,
          entry.categoria,
          item.itemInfo?.title?.displayValue,
          item.detailPageURL,
          item.images?.primary?.medium?.url,
          listing?.price?.money?.displayAmount,
          listing?.price?.savings?.percentage || 0,
          score
        ]
      );
        }
    await sleep(2000);

  }

}

async function getTrendingOffers(limit = 10) {

  const result = await pool.query(
    `
    SELECT *
    FROM trending_offers
    ORDER BY score DESC, updated_at DESC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

module.exports = {
  refreshTrendingOffers,
  getTrendingOffers
};





