
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function CustomerPage() {
  const params = useParams();
  const token = params?.token;

  const [data, setData] = useState({
    customer: {},
    device: null,
    devices: [],
    recommendedOffers: [],
    trendingOffers: []
  });

  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/app/${token}`);

        if (!res.ok) {
          throw new Error("Dati cliente non disponibili");
        }

        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setError(err.message || "Errore caricamento dati");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      load();
    }
  }, [token]);

  const customerName = `${data?.customer?.nome || ""} ${data?.customer?.cognome || ""}`.trim();
  const mainDevice = data?.device || data?.devices?.[0] || null;
  const deviceName = `${mainDevice?.marca || ""} ${mainDevice?.modello || ""}`.trim();

  const warrantyDate = mainDevice?.scadenza_garanzia
    ? new Date(mainDevice.scadenza_garanzia).toLocaleDateString("it-IT")
    : "Non disponibile";

  const initials = useMemo(() => {
    const nome = data?.customer?.nome?.[0] || "";
    const cognome = data?.customer?.cognome?.[0] || "";
    return `${nome}${cognome}`.toUpperCase() || "SA";
  }, [data]);

  const recommendedOffers = data?.recommendedOffers || [];
  const trendingOffers = data?.trendingOffers || [];

  const bestOffer = recommendedOffers[0] || trendingOffers[0] || null;

  function openAffiliateLink(url) {
    if (!url) return;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      window.location.href = url;
      return;
    }

    window.open(url, "_blank");
  }

  function offerPrice(offer) {
    return offer?.prezzo || "";
  }

  function OfferCard({ offer, highlight = false }) {
    return (
      <article
        onClick={() => openAffiliateLink(offer.affiliate_url)}
        style={{
          background: "#ffffff",
          borderRadius: highlight ? "24px" : "20px",
          padding: highlight ? "18px" : "14px",
          boxShadow: highlight
            ? "0 18px 45px rgba(15,23,42,.14)"
            : "0 10px 26px rgba(15,23,42,.08)",
          border: "1px solid rgba(226,232,240,.9)",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {offer.sconto_percentuale > 0 && (
          <div
            style={{
              position: "absolute",
              top: "14px",
              left: "14px",
              zIndex: 2,
              background: "#ef4444",
              color: "white",
              padding: "6px 10px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: "800"
            }}
          >
            -{offer.sconto_percentuale}%
          </div>
        )}

        {offer.image_url ? (
          <img
            src={offer.image_url}
            alt={offer.titolo || "Prodotto consigliato"}
            style={{
              width: "100%",
              height: highlight ? "210px" : "150px",
              objectFit: "contain",
              marginBottom: "14px",
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "10px"
            }}
          />
        ) : (
          <div
            style={{
              height: highlight ? "210px" : "150px",
              borderRadius: "16px",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "42px",
              marginBottom: "14px"
            }}
          >
            🎁
          </div>
        )}

        <div
          style={{
            fontSize: "12px",
            color: "#2563eb",
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: ".04em",
            marginBottom: "8px"
          }}
        >
          Consigliato per te
        </div>

        <h3
          style={{
            margin: 0,
            color: "#0f172a",
            fontSize: highlight ? "18px" : "15px",
            lineHeight: 1.35,
            minHeight: highlight ? "48px" : "42px"
          }}
        >
          {offer.titolo || "Prodotto consigliato"}
        </h3>

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
                color: "#94a3b8",
                textDecoration: "line-through",
                fontSize: "14px"
              }}
            >
              {offer.prezzo_precedente}
            </span>
          )}

          {offerPrice(offer) && (
            <strong
              style={{
                fontSize: highlight ? "28px" : "22px",
                color: "#111827"
              }}
            >
              {offerPrice(offer)}
            </strong>
          )}
        </div>

        <button
          type="button"
          style={{
            width: "100%",
            marginTop: "14px",
            border: "none",
            background: "#2563eb",
            color: "white",
            padding: "13px 14px",
            borderRadius: "14px",
            fontSize: "15px",
            fontWeight: "800",
            cursor: "pointer"
          }}
        >
          🛒 Scopri l'offerta
        </button>
      </article>
    );
  }

  function NavButton({ id, icon, label }) {
    const active = tab === id;

    return (
      <button
        type="button"
        onClick={() => {
          setTab(id);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        style={{
          border: "none",
          background: "transparent",
          color: active ? "#2563eb" : "#64748b",
          fontWeight: active ? "800" : "600",
          fontSize: "12px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
          minWidth: "62px"
        }}
      >
        <span style={{ fontSize: "20px" }}>{icon}</span>
        {label}
      </button>
    );
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Arial",
          background: "#f3f6fb",
          color: "#0f172a"
        }}
      >
        Caricamento...
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Arial",
          background: "#f3f6fb",
          padding: "24px",
          textAlign: "center"
        }}
      >
        <div
          style={{
            background: "white",
            padding: "24px",
            borderRadius: "20px",
            boxShadow: "0 12px 30px rgba(15,23,42,.10)"
          }}
        >
          <h1 style={{ marginTop: 0 }}>Smart Assistance</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        background: "#f3f6fb",
        minHeight: "100vh",
        padding: "18px",
        paddingBottom: "96px",
        fontFamily: "Arial",
        color: "#0f172a"
      }}
    >
      <section
        style={{
          background: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
          borderRadius: "28px",
          padding: "22px",
          color: "white",
          boxShadow: "0 18px 45px rgba(37,99,235,.28)",
          marginBottom: "18px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "58px",
              height: "58px",
              borderRadius: "50%",
              background: "rgba(255,255,255,.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "900",
              fontSize: "20px"
            }}
          >
            {initials}
          </div>

          <div>
            <div style={{ fontSize: "13px", opacity: .9 }}>
              Smart Assistance
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: "26px", lineHeight: 1.1 }}>
              Ciao {data?.customer?.nome || "Cliente"} 👋
            </h1>
            <div style={{ marginTop: "5px", fontSize: "13px", opacity: .88 }}>
              Il tuo spazio assistenza e consigli utili
            </div>
          </div>
        </div>
      </section>

      {tab === "home" && (
        <>
          <section
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              padding: "18px",
              boxShadow: "0 10px 30px rgba(15,23,42,.08)",
              marginBottom: "18px",
              border: "1px solid rgba(226,232,240,.9)"
            }}
          >
            <div style={{ color: "#64748b", fontWeight: "700", fontSize: "13px" }}>
              📱 Il tuo dispositivo
            </div>

            <h2 style={{ margin: "8px 0 4px", fontSize: "23px" }}>
              {deviceName || "Dispositivo non disponibile"}
            </h2>

            <div
              style={{
                marginTop: "14px",
                background: "#f8fafc",
                borderRadius: "18px",
                padding: "14px",
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center"
              }}
            >
              <div>
                <div style={{ color: "#64748b", fontSize: "13px", fontWeight: "700" }}>
                  🛡 Garanzia fino al
                </div>
                <strong style={{ fontSize: "18px" }}>{warrantyDate}</strong>
              </div>
              <div style={{ fontSize: "32px" }}>✅</div>
            </div>
          </section>

          {bestOffer && (
            <section style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "end",
                  marginBottom: "12px"
                }}
              >
                <div>
                  <div style={{ color: "#2563eb", fontWeight: "900", fontSize: "13px" }}>
                    🎯 Oggi ti consigliamo
                  </div>
                  <h2 style={{ margin: "4px 0 0", fontSize: "22px" }}>
                    Scelto per il tuo dispositivo
                  </h2>
                </div>
              </div>

              <OfferCard offer={bestOffer} highlight />
            </section>
          )}

          {recommendedOffers.length > 0 && (
            <section style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px"
                }}
              >
                <h2 style={{ margin: 0, fontSize: "21px" }}>
                  🎁 Consigliati per te
                </h2>

                <button
                  type="button"
                  onClick={() => setTab("offers")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#2563eb",
                    fontWeight: "800"
                  }}
                >
                  Mostra tutti
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
                  gap: "14px"
                }}
              >
               {recommendedOffers
  .filter((offer) => offer.affiliate_url !== bestOffer?.affiliate_url)
  .slice(0, 4)
  .map((offer, index) => (
                  <OfferCard key={index} offer={offer} />
                ))}
              </div>
            </section>
          )}

          <section
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              padding: "20px",
              boxShadow: "0 10px 30px rgba(15,23,42,.08)",
              border: "1px solid rgba(226,232,240,.9)"
            }}
          >
            <h2 style={{ margin: 0, fontSize: "22px" }}>
              💬 Hai bisogno di aiuto?
            </h2>
            <p style={{ color: "#64748b", lineHeight: 1.5 }}>
              Scrivici direttamente su WhatsApp per assistenza, consigli o informazioni sul tuo dispositivo.
            </p>
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
                padding: "15px",
                borderRadius: "16px",
                fontWeight: "900",
                fontSize: "16px"
              }}
            >
              Apri WhatsApp
            </a>
          </section>
        </>
      )}

      {tab === "offers" && (
        <>
          <h2 style={{ marginTop: 0 }}>🎁 Consigliati per il tuo dispositivo</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
              gap: "14px"
            }}
          >
            {[...recommendedOffers, ...trendingOffers].map((offer, index) => (
              <OfferCard key={index} offer={offer} />
            ))}
          </div>
        </>
      )}

      {tab === "devices" && (
        <>
          <h2 style={{ marginTop: 0 }}>📱 I tuoi dispositivi</h2>

          {data?.devices?.length === 0 ? (
            <div
              style={{
                background: "white",
                borderRadius: "20px",
                padding: "20px",
                boxShadow: "0 10px 30px rgba(15,23,42,.08)"
              }}
            >
              Nessun dispositivo registrato.
            </div>
          ) : (
            data.devices.map((device, index) => (
              <div
                key={index}
                style={{
                  background: "white",
                  borderRadius: "20px",
                  padding: "18px",
                  marginBottom: "12px",
                  boxShadow: "0 10px 30px rgba(15,23,42,.08)"
                }}
              >
                <strong style={{ fontSize: "19px" }}>
                  {device.marca} {device.modello}
                </strong>
                <div style={{ marginTop: "10px", color: "#64748b" }}>
                  Garanzia:{" "}
                  {device.scadenza_garanzia
                    ? new Date(device.scadenza_garanzia).toLocaleDateString("it-IT")
                    : "N/D"}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === "support" && (
        <>
          <section
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "22px",
              boxShadow: "0 10px 30px rgba(15,23,42,.08)",
              border: "1px solid rgba(226,232,240,.9)"
            }}
          >
            <h2 style={{ marginTop: 0 }}>💬 Assistenza</h2>
            <p style={{ color: "#64748b", lineHeight: 1.5 }}>
              Per supporto, configurazioni, accessori o informazioni, contattaci direttamente.
            </p>

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
                borderRadius: "16px",
                fontWeight: "900",
                marginTop: "14px"
              }}
            >
              Scrivici su WhatsApp
            </a>
          </section>
        </>
      )}

      <nav
        style={{
          position: "fixed",
          left: "12px",
          right: "12px",
          bottom: "12px",
          background: "rgba(255,255,255,.96)",
          backdropFilter: "blur(12px)",
          borderRadius: "22px",
          display: "flex",
          justifyContent: "space-around",
          padding: "12px 8px",
          boxShadow: "0 16px 40px rgba(15,23,42,.18)",
          border: "1px solid rgba(226,232,240,.9)",
          zIndex: 10
        }}
      >
        <NavButton id="home" icon="🏠" label="Home" />
        <NavButton id="offers" icon="🎁" label="Per te" />
        <NavButton id="devices" icon="📱" label="Device" />
        <NavButton id="support" icon="💬" label="Aiuto" />
      </nav>
    </main>
  );
}
