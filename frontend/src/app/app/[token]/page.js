"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function CustomerPage() {

  const params = useParams();
  const token = params?.token;

  console.log("PARAMS:", params);
  console.log("TOKEN:", token);

  console.log("TOKEN:", token);

  const [data, setData] = useState({
  customer: {},
  devices: [],
  offers: []
});
  const [tab, setTab] = useState("home");
const [loading, setLoading] = useState(true);

  useEffect(() => {

    async function load() {

      try {

        const res = await fetch(`/api/app/${token}`);

console.log("FETCH URL:", res.url);
console.log("STATUS:", res.status);
console.log("CONTENT-TYPE:", res.headers.get("content-type"));

const text = await res.text();

console.log("RESPONSE:", text.substring(0, 300));

const json = JSON.parse(text);

setData(json);
setLoading(false);

      } catch (err) {

  console.error(err);

} finally {

  setLoading(false);

}

    }

    if (token) {
      load();
    }

  }, [token]);

  const openAffiliateLink = (url) => {

  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent
    );

  if (isMobile) {
    window.location.href = url;
    return;
  }

  window.open(url, "_blank");
};

if (loading) {

  return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Arial"
        }}
      >
        Caricamento...
      </div>
    );
  }

  const initials =
    (data?.customer?.nome?.[0] || "") +
    (data?.customer?.cognome?.[0] || "");

  const deviceCategory =
          data?.devices?.[0]?.categoria;

        const deviceBrand =
          (data?.devices?.[0]?.marca || "").toLowerCase();

        const deviceModel =
          (data?.devices?.[0]?.modello || "").toLowerCase();

        const deviceName =
          `${data?.devices?.[0]?.marca || ""} ${data?.devices?.[0]?.modello || ""}`.trim();

        const modelOffers =
          data?.offers?.filter(offer => {
            const text = `${offer.titolo || ""} ${offer.descrizione || ""}`.toLowerCase();

            return (
              offer.categoria === deviceCategory &&
              (
                (deviceModel && text.includes(deviceModel)) ||
                (deviceBrand && text.includes(deviceBrand))
              )
            );
          }) || [];

        const filteredOffers =
          modelOffers.length > 0
            ? modelOffers
            : data?.offers?.filter(
                offer => offer.categoria === deviceCategory
              ) || [];
  const navButton = (id, label) => (
    <button
      onClick={() => {
              setTab(id);

              window.scrollTo({
                top: 0,
                behavior: "smooth"
              });
            }}
      style={{
        border: "none",
        background: "transparent",
        fontSize: "13px",
        fontWeight: tab === id ? "bold" : "normal",
        color: tab === id ? "#2563eb" : "#666",
        cursor: "pointer"
      }}
    >
      {label}
    </button>
  );

  return (

    <main
      style={{
        background: "#f3f6fb",
        minHeight: "100vh",
        padding: "18px",
        paddingBottom: "90px",
        fontFamily: "Arial"
      }}
    >

      <div
        style={{
          background:
            "linear-gradient(135deg,#2563eb,#3b82f6)",
          borderRadius: "20px",
          padding: "18px",
          color: "white",
          marginBottom: "20px"
        }}
      >

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px"
          }}
        >

          <div
            style={{
              width: "58px",
              height: "58px",
              borderRadius: "50%",
              background: "rgba(255,255,255,.25)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "20px",
              fontWeight: "bold"
            }}
          >
            {initials}
          </div>

          <div>

            <h1
              style={{
                margin: 0,
                fontSize: "24px"
              }}
            >
              SmartAssistance
            </h1>

            <div style={{ marginTop: "6px", fontSize: "18px" }}>
              {data?.customer?.nome} {data?.customer?.cognome}
            </div>

            <div
              style={{
                fontSize: "12px",
                opacity: 0.85,
                marginTop: "4px"
              }}
            >
              {data?.customer?.customer_code}
            </div>

          </div>

        </div>

      </div>

      {tab === "home" && (

  <>
    <div
      style={{
        background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
        color: "white",
        borderRadius: "24px",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 12px 30px rgba(37,99,235,.25)"
      }}
    >

      <div style={{ fontSize: "14px", opacity: .9 }}>
        👋 Benvenuto
      </div>

      <h1 style={{ margin: "8px 0 0 0", fontSize: "32px" }}>
        {data?.customer?.nome} {data?.customer?.cognome}
      </h1>

      <div
        style={{
          marginTop: "24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "16px"
        }}
      >

        <div
          style={{
            background: "rgba(255,255,255,.15)",
            borderRadius: "18px",
            padding: "18px"
          }}
        >
          <div style={{ opacity: .8, marginBottom: "8px" }}>
            📱 Il tuo dispositivo
          </div>

          <strong style={{ fontSize: "20px" }}>
            {data?.device?.marca} {data?.device?.modello}
          </strong>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,.15)",
            borderRadius: "18px",
            padding: "18px"
          }}
        >
          <div style={{ opacity: .8, marginBottom: "8px" }}>
            🛡️ Garanzia valida fino al
          </div>

          <strong style={{ fontSize: "20px" }}>
            {data?.device?.scadenza_garanzia
              ? new Date(data.device.scadenza_garanzia).toLocaleDateString("it-IT")
              : "N/D"}
          </strong>
        </div>

      </div>

    </div>

    <h2 style={{ marginBottom: "16px" }}>
      🎁 Accessori consigliati
    </h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
        gap: "16px",
        marginBottom: "32px"
      }}
    >

      {data?.recommendedOffers?.map((offer, index) => (

        <div
          key={index}
          onClick={() => openAffiliateLink(offer.affiliate_url)}
          style={{
            background: "white",
            borderRadius: "18px",
            padding: "16px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,.06)"
          }}
        >

          {offer.image_url && (
            <img
              src={offer.image_url}
              alt={offer.titolo}
              style={{
                width: "100%",
                height: "160px",
                objectFit: "contain",
                marginBottom: "12px"
              }}
            />
          )}

          <div
            style={{
              fontSize: "12px",
              color: "#2563eb",
              fontWeight: "bold",
              textTransform: "uppercase",
              marginBottom: "8px"
            }}
          >
            {offer.tipo}
          </div>

          <div style={{ fontWeight: "bold", minHeight: "48px" }}>
            {offer.titolo}
          </div>

          <div
  style={{
    marginTop: "12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap"
  }}
>

  {offer.prezzo_precedente && (
    <span
      style={{
        textDecoration: "line-through",
        color: "#9ca3af",
        fontSize: "14px"
      }}
    >
      {offer.prezzo_precedente}
    </span>
  )}

  {offer.prezzo && (
    <span
      style={{
        fontSize: "22px",
        fontWeight: "bold",
        color: "#111827"
      }}
    >
      {offer.prezzo}
    </span>
  )}

  {offer.sconto_percentuale > 0 && (
    <span
      style={{
        background: "#dc2626",
        color: "white",
        padding: "4px 8px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "bold"
      }}
    >
      -{offer.sconto_percentuale}%
    </span>
  )}

</div>

        </div>

      ))}

    </div>

    <h2 style={{ marginBottom: "16px" }}>
      🔥 I più acquistati del momento
    </h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
        gap: "16px"
      }}
    >

      {data?.trendingOffers?.map((offer, index) => (

        <div
          key={index}
          onClick={() => openAffiliateLink(offer.affiliate_url)}
          style={{
            background: "white",
            borderRadius: "18px",
            padding: "16px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,.06)"
          }}
        >

          {offer.image_url && (
            <img
              src={offer.image_url}
              alt={offer.titolo}
              style={{
                width: "100%",
                height: "160px",
                objectFit: "contain",
                marginBottom: "12px"
              }}
            />
          )}

          <div style={{ fontWeight: "bold", minHeight: "48px" }}>
            {offer.titolo}
          </div>

          <div
  style={{
    marginTop: "12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap"
  }}
>

  {offer.prezzo_precedente && (
    <span
      style={{
        textDecoration: "line-through",
        color: "#9ca3af",
        fontSize: "14px"
      }}
    >
      {offer.prezzo_precedente}
    </span>
  )}

  {offer.prezzo && (
    <span
      style={{
        fontSize: "22px",
        fontWeight: "bold",
        color: "#111827"
      }}
    >
      {offer.prezzo}
    </span>
  )}

  {offer.sconto_percentuale > 0 && (
    <span
      style={{
        background: "#dc2626",
        color: "white",
        padding: "4px 8px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "bold"
      }}
    >
      -{offer.sconto_percentuale}%
    </span>
  )}

</div>

        </div>

      ))}

    </div>

  </>

)}

          {tab === "devices" && (

        <>
          <h2>Dispositivi</h2>

          {data?.devices?.length === 0 ? (

            <div
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "20px",
                boxShadow:
                  "0 2px 10px rgba(0,0,0,.06)"
              }}
            >
              Nessun dispositivo registrato
            </div>

          ) : (

            data?.devices?.map((device, index) => (

              <div
                key={index}
                style={{
                  background: "white",
                  borderRadius: "16px",
                  padding: "18px",
                  marginBottom: "12px",
                  boxShadow:
                    "0 2px 10px rgba(0,0,0,.06)"
                }}
              >
                <strong>
                  {device.marca} {device.modello}
                </strong>

                <div
                  style={{
                    color: "#666",
                    marginTop: "8px"
                  }}
                >
                  Garanzia:
                  {" "}
                  {device.scadenza_garanzia || "N/D"}
                </div>

              </div>

            ))

          )}
        </>
      )}

      {tab === "offers" && (

        <>
          <h2>Offerte</h2>

          <div
            style={{
              display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: "16px"
            }}
          >

            {filteredOffers.map((offer, index) => (

              <div
                key={index}
                style={{
                  background: "white",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow:
                    "0 2px 10px rgba(0,0,0,.06)"
                }}
              >


                    {offer.image_url && (
                      <img
                        src={offer.image_url}
                        alt={offer.titolo}
                        style={{
                          width: "140px",
                          height: "140px",
                          objectFit: "contain",
                          display: "block",
                          margin: "0 auto 16px",
                          borderRadius: "8px"
                        }}
                      />
                    )}

                <strong>
                  {offer.titolo}
                </strong>

                <div
                  style={{
                    marginTop: "8px",
                    color: "#666"
                  }}
                >
                  {offer.descrizione}
                    </div>

                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap"
                      }}
                    >

                      {offer.prezzo_precedente && (
                        <span
                          style={{
                            textDecoration: "line-through",
                            color: "#9ca3af",
                            fontSize: "14px"
                          }}
                        >
                          {offer.prezzo_precedente}
                        </span>
                      )}

                      {offer.prezzo && (
                        <span
                          style={{
                            fontSize: "24px",
                            fontWeight: "bold",
                            color: "#111827"
                          }}
                        >
                          {offer.prezzo}
                        </span>
                      )}

                      {offer.sconto_percentuale && (
                        <span
                          style={{
                            background: "#dc2626",
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: "bold"
                          }}
                        >
                          -{offer.sconto_percentuale}%
                        </span>
                      )}

                    </div>

                    <a href={offer.affiliate_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: "12px",
                    background: "#2563eb",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    fontWeight: "bold"
                  }}
                >
                  Apri Offerta
                </a>

              </div>

            ))}

          </div>
        </>
      )}
{tab === "support" && (

        <>
          <h2>Assistenza</h2>

          <a
            href="https://wa.me/393297655557"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              background: "#25D366",
              color: "white",
              textDecoration: "none",
              padding: "16px",
              borderRadius: "14px",
              fontWeight: "bold"
            }}
          >
            Apri WhatsApp
          </a>
        </>
      )}

      <div
        style={{
          position: "fixed",
          left: "12px",
          right: "12px",
          bottom: "12px",
          background: "white",
          borderRadius: "18px",
          display: "flex",
          justifyContent: "space-around",
          padding: "14px",
          boxShadow:
            "0 4px 20px rgba(0,0,0,.12)"
        }}
      >
        {navButton("home", "Home")}
        
        
        
      </div>

    </main>

  );

}






























































