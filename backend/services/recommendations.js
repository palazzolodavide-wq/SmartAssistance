function getRecommendedOffers(offers = []) {

  const OFFER_RULES = [
    { tipo: "cover", regex: /cover|custodia/i },
    { tipo: "vetro", regex: /vetro|pellicola/i },
    { tipo: "charger", regex: /caricatore|charger/i },
    { tipo: "powerbank", regex: /power\s*bank/i },
    { tipo: "audio", regex: /auricolari|cuffie|buds/i }
  ];

  const MAX_PER_TYPE = 2;

  const counters = {};
  const selected = [];

  for (const offer of offers) {

    const text =
      `${offer.titolo || ""} ${offer.descrizione || ""}`;

    const rule = OFFER_RULES.find(r =>
      r.regex.test(text)
    );

    if (!rule) {
      continue;
    }

    counters[rule.tipo] ??= 0;

    if (counters[rule.tipo] >= MAX_PER_TYPE) {
      continue;
    }

    counters[rule.tipo]++;

    selected.push({
      ...offer,
      tipo: rule.tipo
    });

  }

  return selected;

}

module.exports = {
  getRecommendedOffers
};
