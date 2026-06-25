const axios = require("axios");
const aws4 = require("aws4");

async function searchAmazon(keyword) {

  console.log("PAAPI TAG:", process.env.PAAPI_PARTNER_TAG);

  const body = {
  Keywords: keyword,
  SearchIndex: "All",
  ItemCount: 10,
  Condition: "New",
  Merchant: "All",
  Resources: [
      "Images.Primary.Medium",
      "ItemInfo.Title"
    ],
    PartnerTag: process.env.PAAPI_PARTNER_TAG,
  PartnerType: "Associates",
  Marketplace: process.env.PAAPI_MARKETPLACE
};

  const opts = {
    host: "webservices.amazon.it",
    path: "/paapi5/searchitems",
    service: "ProductAdvertisingAPI",
    region: "eu-west-1",
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Content-Encoding": "amz-1.0",
      "X-Amz-Target":
        "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems"
    },
    body: JSON.stringify(body)
  };

  aws4.sign(opts, {
    accessKeyId: process.env.PAAPI_ACCESS_KEY,
    secretAccessKey: process.env.PAAPI_SECRET_KEY
  });

  console.log("SIGNED HEADERS");
  console.log(JSON.stringify(opts.headers, null, 2));

  const response = await axios({
    method: "POST",
    url: "https://webservices.amazon.it/paapi5/searchitems",
    headers: opts.headers,
    data: body,
    validateStatus: () => true
  });

  console.log("AMAZON RESPONSE");
console.log(JSON.stringify(response.data, null, 2));

return response.data;
}

module.exports = {
  searchAmazon
};








