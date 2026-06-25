const axios = require("axios");

let accessToken = null;
let expiresAt = 0;

async function getAccessToken() {

  if (accessToken && Date.now() < expiresAt) {
    return accessToken;
  }

  const response = await axios.post(
    "https://api.amazon.co.uk/auth/o2/token",
    new URLSearchParams({
            grant_type: "client_credentials",
            scope: "creatorsapi::default"
          }).toString(),
    {
      headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(
                `${process.env.CREATORS_CLIENT_ID}:${process.env.CREATORS_CLIENT_SECRET}`
              ).toString("base64")}`
            }
    }
  );

  accessToken = response.data.access_token;

  expiresAt =
    Date.now() + ((response.data.expires_in - 60) * 1000);

  return accessToken;
}

async function searchCreators(keyword) {

  const token = await getAccessToken();

  const response = await axios.post(
    "https://creatorsapi.amazon/catalog/v1/searchItems",
    {
  keywords: keyword,
        itemCount: 10,
  marketplace: "www.amazon.it",
  partnerTag: process.env.CREATORS_PARTNER_TAG,
  resources: [
    "images.primary.medium",
    "itemInfo.title",
    "offersV2.listings.price"
  ]
},
    {
      headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "x-marketplace": "www.amazon.it"
            }
    }
  );

  return response.data;
}

module.exports = {
  searchCreators
};








