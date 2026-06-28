"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const WHATSAPP_NUMBER = "393297655557";

export default function CustomerPage() {
  const params = useParams();
  const token = params?.token;

  const [data, setData] = useState({
    customer: {},
    device: null,
    devices: [],
    recommendedOffers: [],
    trendingOffers: [],
  });

  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/app/${token}`);
        const json = await res.json();

        if (!res.ok || json.success === false) {
          throw new Error(json.error || "Errore caricamento dati");
        }

        setData({
          customer: json.customer || {},
          device: json.device || json.devices?.[0] || null,
          devices: json.devices || [],
          recommendedOffers: json.recommendedOffers || [],
          trendingOffers: json.trendingOffers || [],
        });
      } catch (err) {
        setError(err.message || "Errore caricamento dati");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      load();
    }
  }, [token]);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const customerName = `${data.customer?.nome || ""} ${data.customer?.cognome || ""}`.trim();
  const deviceName = `${data.device?.marca || ""} ${data.device?.modello || ""}`.trim();

  const allOffers = useMemo(() => {
    const merged = [
      ...(data.recommendedOffers || []),
      ...(data.trendingOffers || []),
    ];

    return [
      ...new Map(
        merged
          .filter((offer) => offer?.affiliate_url)
          .map((offer, index) => [offer.asin || offer.affiliate_url || index, offer])
      ).values(),
    ];
  }, [data.recommendedOffers, data.trendingOffers]);

  function openAffiliateLink(url) {
    if (!url) return;

    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAmazon =
      url.includes("amazon.") ||
      url.includes("amzn.");

    if (isAndroid && isAmazon) {
      try {
        const parsedUrl = new URL(url);
        const intentUrl =
          `intent://${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}` +
          "#Intent;scheme=https;package=com.amazon.mShop.android.shopping;end";

        window.location.href = intentUrl;
        return;
      } catch (err) {
        window.location.href = url;
        return;
      }
    }

    if (isIOS || isAndroid) {
      window.location.href = url;
      return;
    }

    window.open(url, "_blank");
  }

  function openWhatsApp() {
    const message = encodeURIComponent(
      `Ciao, ho bisogno di assistenza per ${deviceName || "il mio dispositivo"}.`
    );

    window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
  }

  async function installWebApp() {
    if (installPrompt) {
      installPrompt.prompt();

      try {
        await installPrompt.userChoice;
      } catch (err) {
        // Nessuna azione: il browser può non restituire una scelta.
      }

      setInstallPrompt(null);
      return;
    }

    alert(
      "Per installare Smart Assistance:\n\n" +
      "1. Tocca il menu del browser (⋮)\n" +
      "2. Scegli 'Aggiungi a schermata Home'\n" +
      "3. Conferma l'installazione"
    );
  }

  function formatDate(value) {
    if (!value) return "Non disponibile";
    return new Date(value).toLocaleDateString("it-IT");
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#0f172a",
      color: "#f8fafc",
      fontFamily: "Arial, sans-serif",
      padding: "16px",
      paddingBottom: "92px",
    },
    shell: {
      maxWidth: "560px",
      margin: "0 auto",
    },
    hero: {
      background: "linear-gradient(145deg,#2563eb,#0f172a)",
      borderRadius: "28px",
      padding: "22px",
      marginBottom: "18px",
      boxShadow: "0 20px 40px rgba(0,0,0,.28)",
      border: "1px solid rgba(255,255,255,.10)",
    },
    brand: {
      fontSize: "14px",
      letterSpacing: ".08em",
      textTransform: "uppercase",
      opacity: .8,
      marginBottom: "18px",
      fontWeight: "bold",
    },
    title: {
      margin: 0,
      fontSize: "30px",
      lineHeight: 1.1,
    },
    subtitle: {
      marginTop: "10px",
      color: "#dbeafe",
      lineHeight: 1.5,
      fontSize: "15px",
    },
    installIconButton: {
      width: "42px",
      height: "42px",
      minWidth: "42px",
      border: "1px solid rgba(255,255,255,.20)",
      borderRadius: "14px",
      background: "rgba(255,255,255,.12)",
      color: "white",
      fontSize: "20px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      background: "#111827",
      border: "1px solid rgba(255,255,255,.08)",
      borderRadius: "22px",
      padding: "18px",
      marginBottom: "16px",
      boxShadow: "0 10px 28px rgba(0,0,0,.22)",
    },
    lightCard: {
      background: "#f8fafc",
      color: "#0f172a",
      borderRadius: "22px",
      padding: "16px",
      marginBottom: "16px",
      boxShadow: "0 10px 28px rgba(0,0,0,.22)",
    },
    sectionTitle: {
      margin: "22px 0 12px",
      fontSize: "20px",
    },
    cta: {
      width: "100%",
      border: "none",
      borderRadius: "16px",
      padding: "15px",
      fontWeight: "bold",
      fontSize: "16px",
      cursor: "pointer",
      background: "#dc2626",
      color: "white",
    },
    guideCard: {
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
      background: "rgba(255,255,255,.06)",
      border: "1px solid rgba(255,255,255,.08)",
      borderRadius: "16px",
      padding: "14px",
    },
    guideIcon: {
      width: "42px",
      height: "42px",
      minWidth: "42px",
      borderRadius: "14px",
      background: "rgba(37,99,235,.22)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "22px",
    },
    guideText: {
      margin: "6px 0 0",
      color: "#cbd5e1",
      fontSize: "13px",
      lineHeight: 1.45,
    },
    nav: {
      position: "fixed",
      left: "12px",
      right: "12px",
      bottom: "12px",
      maxWidth: "560px",
      margin: "0 auto",
      background: "rgba(15,23,42,.96)",
      border: "1px solid rgba(255,255,255,.10)",
      borderRadius: "22px",
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      padding: "10px",
      boxShadow: "0 12px 36px rgba(0,0,0,.35)",
      backdropFilter: "blur(12px)",
    },
  };

  function NavButton({ id, icon, label }) {
    const active = tab === id;

    return (
      <button
        onClick={() => {
          setTab(id);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        style={{
          border: "none",
          background: active ? "#2563eb" : "transparent",
          color: active ? "white" : "#cbd5e1",
          borderRadius: "14px",
          padding: "9px 4px",
          fontSize: "12px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        <div style={{ fontSize: "18px", marginBottom: "2px" }}>{icon}</div>
        {label}
      </button>
    );
  }

  function OfferCard({ offer, compact = false }) {
    return (
      <div style={styles.lightCard}>
        <div style={{ position: "relative" }}>
          {offer.sconto_percentuale > 0 && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                left: "8px",
                background: "#dc2626",
                color: "white",
                borderRadius: "999px",
                padding: "8px 10px",
                fontWeight: "bold",
                fontSize: "13px",
                zIndex: 1,
              }}
            >
              -{offer.sconto_percentuale}%
            </div>
          )}

          {offer.image_url && (
            <img
              src={offer.image_url}
              alt={offer.titolo || "Prodotto"}
              style={{
                width: "100%",
                height: compact ? "150px" : "190px",
                objectFit: "contain",
                background: "#fff",
                borderRadius: "18px",
                marginBottom: "14px",
              }}
            />
          )}
        </div>

        <div
          style={{
            display: "inline-block",
            background: "#dcfce7",
            color: "#166534",
            borderRadius: "999px",
            padding: "5px 9px",
            fontSize: "12px",
            fontWeight: "bold",
            marginBottom: "10px",
          }}
        >
          Compatibile con il tuo dispositivo
        </div>

        <h3 style={{ margin: "0 0 10px", fontSize: "17px", lineHeight: 1.25 }}>
          {offer.titolo || "Prodotto consigliato"}
        </h3>

        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "14px" }}>
          {offer.prezzo && (
            <strong style={{ fontSize: "30px", color: "#b45309" }}>
              {offer.prezzo}
            </strong>
          )}

          {offer.prezzo_precedente && (
            <span style={{ color: "#64748b", textDecoration: "line-through" }}>
              {offer.prezzo_precedente}
            </span>
          )}
        </div>

        <button style={styles.cta} onClick={() => openAffiliateLink(offer.affiliate_url)}>
          Scopri →
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={{ ...styles.shell, display: "flex", minHeight: "80vh", alignItems: "center", justifyContent: "center" }}>
          Caricamento...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.card}>
            <h2>Impossibile caricare la WebApp</h2>
            <p>{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {tab === "home" && (
          <>
            <section style={styles.hero}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "18px",
                }}
              >
                <div style={{ ...styles.brand, marginBottom: 0 }}>
                  Smart Assistance
                </div>

                <button
                  type="button"
                  onClick={installWebApp}
                  title="Aggiungi alla Home"
                  aria-label="Aggiungi alla Home"
                  style={styles.installIconButton}
                >
                  📲
                </button>
              </div>

              <h1 style={styles.title}>Ciao {data.customer?.nome || customerName || ""} 👋</h1>
              <div style={styles.subtitle}>
                Il tuo smartphone è sempre sotto controllo. Qui trovi garanzia,
                assistenza e accessori consigliati per il tuo dispositivo.
              </div>
            </section>

            <section style={styles.card}>
              <div style={{ fontSize: "14px", color: "#93c5fd", marginBottom: "8px", fontWeight: "bold" }}>
                📱 Il tuo dispositivo
              </div>
              <h2 style={{ margin: "0 0 10px", fontSize: "24px" }}>
                {deviceName || "Dispositivo non disponibile"}
              </h2>
              <div style={{ color: "#cbd5e1" }}>
                🛡 Garanzia fino al {formatDate(data.device?.scadenza_garanzia)}
              </div>
            </section>

            {data.recommendedOffers?.length > 0 && (
              <>
                <h2 style={styles.sectionTitle}>🎁 Consigliati per il tuo dispositivo</h2>
                {data.recommendedOffers.slice(0, 4).map((offer, index) => (
                  <OfferCard key={offer.asin || offer.affiliate_url || index} offer={offer} />
                ))}
              </>
            )}

            {data.trendingOffers?.length > 0 && (
              <>
                <h2 style={styles.sectionTitle}>🔥 Offerte interessanti</h2>
                {data.trendingOffers.slice(0, 3).map((offer, index) => (
                  <OfferCard key={offer.asin || offer.affiliate_url || index} offer={offer} compact />
                ))}
              </>
            )}

            <section style={styles.card}>
              <h2 style={{ margin: "0 0 8px" }}>💬 Hai bisogno di assistenza?</h2>
              <p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
                Scrivici su WhatsApp: ti aiutiamo con configurazione,
                garanzia, accessori e supporto post vendita.
              </p>
              <button
                onClick={openWhatsApp}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: "16px",
                  padding: "15px",
                  background: "#25D366",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                Apri WhatsApp
              </button>
            </section>
          </>
        )}

        {tab === "offers" && (
          <>
            <h1 style={{ marginTop: 0 }}>🎁 Per te</h1>
            <p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
              Accessori e prodotti selezionati in base al tuo dispositivo.
            </p>
            {allOffers.length === 0 ? (
              <div style={styles.card}>Nessuna offerta disponibile al momento.</div>
            ) : (
              allOffers.map((offer, index) => (
                <OfferCard key={offer.asin || offer.affiliate_url || index} offer={offer} />
              ))
            )}
          </>
        )}

        {tab === "devices" && (
          <>
            <h1 style={{ marginTop: 0 }}>📱 Dispositivi</h1>
            {data.devices.length === 0 ? (
              <div style={styles.card}>Nessun dispositivo registrato.</div>
            ) : (
              data.devices.map((device, index) => (
                <section key={index} style={styles.card}>
                  <h2 style={{ margin: "0 0 8px" }}>
                    {device.marca} {device.modello}
                  </h2>
                  <div style={{ color: "#cbd5e1" }}>
                    🛡 Garanzia fino al {formatDate(device.scadenza_garanzia)}
                  </div>
                  {device.note && (
                    <div style={{ color: "#94a3b8", marginTop: "10px" }}>
                      {device.note}
                    </div>
                  )}
                </section>
              ))
            )}
          </>
        )}

        {tab === "support" && (
          <>
            <h1 style={{ marginTop: 0 }}>💬 Assistenza</h1>

            <section style={styles.card}>
              <h2 style={{ marginTop: 0 }}>Siamo qui per aiutarti</h2>
              <p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
                Per supporto sul tuo dispositivo, configurazioni, garanzia o
                consigli sugli accessori, contattaci direttamente su WhatsApp.
              </p>
              <button
                onClick={openWhatsApp}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: "16px",
                  padding: "16px",
                  background: "#25D366",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "17px",
                  cursor: "pointer",
                }}
              >
                Scrivici su WhatsApp
              </button>
            </section>

            <section style={styles.card}>
              <h2 style={{ marginTop: 0 }}>📚 Guide rapide</h2>
              <p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
                Piccoli consigli utili per usare meglio il tuo smartphone ogni giorno.
              </p>

              <div style={{ display: "grid", gap: "12px" }}>
                <div style={styles.guideCard}>
                  <div style={styles.guideIcon}>🔋</div>
                  <div>
                    <strong>Risparmiare batteria</strong>
                    <p style={styles.guideText}>
                      Chiudi le app inutili, riduci la luminosità e attiva il risparmio energetico quando serve.
                    </p>
                  </div>
                </div>

                <div style={styles.guideCard}>
                  <div style={styles.guideIcon}>🛡</div>
                  <div>
                    <strong>Proteggere il telefono</strong>
                    <p style={styles.guideText}>
                      Usa vetro temperato, cover adeguata e blocco schermo con PIN, impronta o volto.
                    </p>
                  </div>
                </div>

                <div style={styles.guideCard}>
                  <div style={styles.guideIcon}>☁️</div>
                  <div>
                    <strong>Backup foto e contatti</strong>
                    <p style={styles.guideText}>
                      Verifica che Google Foto, Samsung Cloud o iCloud siano configurati correttamente.
                    </p>
                  </div>
                </div>

                <div style={styles.guideCard}>
                  <div style={styles.guideIcon}>📶</div>
                  <div>
                    <strong>Wi‑Fi e connessione</strong>
                    <p style={styles.guideText}>
                      Se internet è lento, riavvia il telefono e controlla rete Wi‑Fi, dati mobili e aggiornamenti.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={{ marginTop: 0 }}>📞 Contatti utili</h2>
              <p style={{ color: "#cbd5e1", lineHeight: 1.5, marginBottom: "14px" }}>
                Salva questa WebApp nella schermata Home per ritrovare assistenza, garanzia e consigli in un solo tocco.
              </p>

              <button
                onClick={openWhatsApp}
                style={{
                  width: "100%",
                  border: "1px solid rgba(37,211,102,.45)",
                  borderRadius: "16px",
                  padding: "15px",
                  background: "rgba(37,211,102,.12)",
                  color: "#bbf7d0",
                  fontWeight: "bold",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                Chiedi informazioni
              </button>
            </section>
          </>
        )}
      </div>

      <nav style={styles.nav}>
        <NavButton id="home" icon="🏠" label="Home" />
        <NavButton id="offers" icon="🎁" label="Per te" />
        <NavButton id="devices" icon="📱" label="Device" />
        <NavButton id="support" icon="💬" label="Aiuto" />
      </nav>
    </main>
  );
}
