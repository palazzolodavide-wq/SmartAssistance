"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const WHATSAPP_NUMBER = "393297655557";

export default function CustomerPage() {
  const params = useParams();
  const token = params?.token;

  function getValidTab(value) {
    const tabName = String(value || "").toLowerCase().trim();

    return ["home", "offers", "live", "devices", "support"].includes(tabName)
      ? tabName
      : "home";
  }

  function getInitialNavigationState() {
    if (typeof window === "undefined") {
      return {
        tab: "home",
        livePage: 1,
      };
    }

    const searchParams = new URLSearchParams(window.location.search);
    const tabFromUrl = searchParams.get("tab") || searchParams.get("section") || "";
    const pageFromUrl = Number.parseInt(
      searchParams.get("page") || searchParams.get("livePage") || "1",
      10
    );

    return {
      tab: getValidTab(tabFromUrl),
      livePage: Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1,
    };
  }

  function syncAppNavigation(nextTab, livePage = 1, options = {}) {
    if (typeof window === "undefined") {
      return;
    }

    const tabName = getValidTab(nextTab);
    const pageNumber = Number.isFinite(Number(livePage)) && Number(livePage) > 0
      ? Number(livePage)
      : 1;

    const url = new URL(window.location.href);

    if (tabName === "home") {
      url.searchParams.delete("tab");
      url.searchParams.delete("section");
      url.searchParams.delete("page");
      url.searchParams.delete("livePage");
    } else {
      url.searchParams.set("tab", tabName);
      url.searchParams.delete("section");

      if (tabName === "live" && pageNumber > 1) {
        url.searchParams.set("page", String(pageNumber));
      } else {
        url.searchParams.delete("page");
      }

      url.searchParams.delete("livePage");
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl === currentUrl) {
      return;
    }

    if (options.replace) {
      window.history.replaceState({}, "", nextUrl);
    } else {
      window.history.pushState({}, "", nextUrl);
    }
  }

  const [data, setData] = useState({
    customer: {},
    device: null,
    devices: [],
    guides: [],
    recommendedOffers: [],
    manualOffers: [],
    trendingOffers: [],
    liveOffers: [],
    livePagination: {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
    liveSettings: {
      enabled: true,
      ttl_hours: 24,
      max_visible: 20,
    },
  });

  const canShowMarketingOffers = Boolean(data.customer?.marketing_consent);
  const navItems = [
    { id: "home", icon: "🏠", label: "Home" },
    ...(canShowMarketingOffers ? [{ id: "offers", icon: "🎁", label: "Per te" }] : []),
    ...(canShowMarketingOffers && data.liveSettings?.enabled !== false
      ? [{ id: "live", icon: "🔥", label: "Live" }]
      : []),
    { id: "devices", icon: "📱", label: "Device" },
    { id: "support", icon: "💬", label: "Aiuto" },
  ];

  const [tab, setTab] = useState(() => getInitialNavigationState().tab);
  const [offerFilter, setOfferFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);
  const [receiptViewer, setReceiptViewer] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [showConsentSettings, setShowConsentSettings] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentMessage, setConsentMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const initialNavigation = getInitialNavigationState();

        const res = await fetch(`/api/app/${token}?v=${Date.now()}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok || json.success === false) {
          throw new Error(json.error || "Errore caricamento dati");
        }

        let liveOffers = json.liveOffers || [];
        let livePagination = json.livePagination || {
          page: 1,
          pageSize: json.liveSettings?.max_visible || 20,
          total: json.liveOffers?.length || 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        };
        let liveSettings = json.liveSettings || {
          enabled: true,
          ttl_hours: 24,
          max_visible: 20,
        };

        if (
          initialNavigation.tab === "live" &&
          liveSettings?.enabled !== false &&
          initialNavigation.livePage > 1
        ) {
          const liveRes = await fetch(`/api/app/${token}/live-offers?page=${encodeURIComponent(initialNavigation.livePage)}&v=${Date.now()}`, {
            cache: "no-store",
          });
          const liveJson = await liveRes.json();

          if (liveRes.ok && liveJson.success !== false) {
            liveOffers = liveJson.liveOffers || [];
            livePagination = liveJson.livePagination || livePagination;
            liveSettings = liveJson.liveSettings || liveSettings;
          }
        }

        setData({
          customer: json.customer || {},
          device: json.device || json.devices?.[0] || null,
          devices: json.devices || [],
          guides: json.guides || [],
          recommendedOffers: json.recommendedOffers || [],
          manualOffers: json.manualOffers || [],
          trendingOffers: json.trendingOffers || [],
          liveOffers,
          livePagination,
          liveSettings,
        });

        const requestedTab = initialNavigation.tab;
        const nextTab =
          (!Boolean(json.customer?.marketing_consent) && ["offers", "live"].includes(requestedTab)) ||
          (liveSettings?.enabled === false && requestedTab === "live")
            ? "home"
            : requestedTab;

        setTab(nextTab);
        syncAppNavigation(nextTab, livePagination?.page || initialNavigation.livePage, { replace: true });
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
    if (["offers", "live"].includes(tab) && !canShowMarketingOffers) {
      setTab("home");
      syncAppNavigation("home", 1, { replace: true });
      return;
    }

    if (tab === "live" && data.liveSettings?.enabled === false) {
      setTab("home");
      syncAppNavigation("home", 1, { replace: true });
    }
  }, [tab, canShowMarketingOffers, data.liveSettings?.enabled]);

  useEffect(() => {
    function handlePopState() {
      const navigation = getInitialNavigationState();

      setTab(navigation.tab);

      if (navigation.tab === "live" && canShowMarketingOffers && data.liveSettings?.enabled !== false) {
        loadLiveOffersPage(navigation.livePage, {
          syncUrl: false,
          scroll: false,
        });
      }
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [token, canShowMarketingOffers, data.liveSettings?.enabled, data.livePagination?.page]);


  useEffect(() => {
    if (!token) return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;

    setIsInstalled(standalone);

    const isiOS =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent || "") ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    setShowIosInstallGuide(isiOS && !standalone);

    let manifestLink = document.querySelector('link[rel="manifest"]');

    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }

    manifestLink.href = `/manifest?token=${encodeURIComponent(token)}&v=39`;

    let themeColor = document.querySelector('meta[name="theme-color"]');

    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.appendChild(themeColor);
    }

    themeColor.content = "#0f172a";
    // PATCH_63_WEBAPP_MOBILE_SAFE_VIEWPORT
    let viewportMeta = document.querySelector('meta[name="viewport"]');

    if (!viewportMeta) {
      viewportMeta = document.createElement("meta");
      viewportMeta.name = "viewport";
      document.head.appendChild(viewportMeta);
    }

    viewportMeta.content = "width=device-width, initial-scale=1, viewport-fit=cover";

    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');

    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleIcon);
    }

    appleIcon.href = "/icons/apple-touch-icon.png?v=52";

    let appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');

    if (!appleCapable) {
      appleCapable = document.createElement("meta");
      appleCapable.name = "apple-mobile-web-app-capable";
      document.head.appendChild(appleCapable);
    }

    appleCapable.content = "yes";

    let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');

    if (!appleStatusBar) {
      appleStatusBar = document.createElement("meta");
      appleStatusBar.name = "apple-mobile-web-app-status-bar-style";
      document.head.appendChild(appleStatusBar);
    }

    appleStatusBar.content = "black-translucent";

    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');

    if (!appleTitle) {
      appleTitle = document.createElement("meta");
      appleTitle.name = "apple-mobile-web-app-title";
      document.head.appendChild(appleTitle);
    }

    appleTitle.content = "Smart Assistance";

    let favicon = document.querySelector('link[rel="icon"]');

    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }

    favicon.href = "/favicon.ico?v=52";

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [token]);



  const customerName = `${data.customer?.nome || ""} ${data.customer?.cognome || ""}`.trim();
  const deviceName = `${data.device?.marca || ""} ${data.device?.modello || ""}`.trim();
  const primaryCategory = normalizeDeviceCategory(data.device?.categoria);

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

  function getDeviceIcon(category) {
    if (category === "notebook") return "💻";
    if (category === "desktop") return "🖥️";
    if (category === "smartphone") return "📱";
    return "🔧";
  }

  function getDeviceLabel(category) {
    if (category === "notebook") return "Il tuo notebook";
    if (category === "desktop") return "Il tuo PC";
    if (category === "smartphone") return "Il tuo smartphone";
    return "Il tuo dispositivo";
  }

  function getHeroText(category) {
    if (category === "notebook") {
      return "Il tuo notebook è sempre sotto controllo. Qui trovi garanzia, supporto e accessori utili per lavorare meglio.";
    }

    if (category === "desktop") {
      return "Il tuo PC è sempre sotto controllo. Qui trovi garanzia, supporto e prodotti utili per completare la tua postazione.";
    }

    if (category === "smartphone") {
      return "Il tuo smartphone è sempre sotto controllo. Qui trovi garanzia, assistenza e accessori consigliati.";
    }

    return "Il tuo dispositivo è sempre sotto controllo. Qui trovi garanzia, assistenza e prodotti consigliati.";
  }

  function getOfferIntro(category) {
    if (category === "notebook") {
      return "Accessori e prodotti selezionati per il tuo notebook: mouse, borse, hub, supporti e alimentazione.";
    }

    if (category === "desktop") {
      return "Accessori e prodotti selezionati per il tuo PC: monitor, tastiere, webcam, audio e postazione.";
    }

    if (category === "smartphone") {
      return "Accessori e prodotti selezionati in base al tuo smartphone.";
    }

    return "Accessori e prodotti selezionati in base al tuo dispositivo.";
  }

  function getSupportIntro(category) {
    if (category === "notebook") {
      return "Per supporto sul tuo notebook, configurazioni, backup, garanzia o consigli sugli accessori, contattaci direttamente su WhatsApp.";
    }

    if (category === "desktop") {
      return "Per supporto sul tuo PC, configurazioni, periferiche, garanzia o consigli sulla postazione, contattaci direttamente su WhatsApp.";
    }

    if (category === "smartphone") {
      return "Per supporto sul tuo smartphone, configurazioni, garanzia o consigli sugli accessori, contattaci direttamente su WhatsApp.";
    }

    return "Per supporto sul tuo dispositivo, configurazioni, garanzia o consigli sugli accessori, contattaci direttamente su WhatsApp.";
  }

  function normalizeOfferCategory(value) {
    return String(value || "generale").toLowerCase().trim();
  }

  function getOfferCategoryLabel(value) {
    const category = normalizeOfferCategory(value);

    if (category === "accessori") return "Accessori";
    if (category === "smartphone") return "Smartphone";
    if (category === "notebook") return "Notebook";
    if (category === "desktop") return "Desktop / PC";
    if (category === "casa") return "Casa";
    if (category === "gaming") return "Gaming";
    if (category === "audio") return "Audio";
    if (category === "generale") return "Generale";

    return category;
  }

  function isCompatibleOffer(offer) {
    return offer?.source === "amazon_recommended" || offer?.tipo_offerta === "accessory";
  }

  function isRecommendedOffer(offer) {
    return offer?.source === "manual" || offer?.tipo_offerta === "manual";
  }



  const allOffers = useMemo(() => {
    if (!canShowMarketingOffers) {
      return [];
    }

    const merged = [
      ...(data.manualOffers || []),
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
  }, [canShowMarketingOffers, data.manualOffers, data.recommendedOffers, data.trendingOffers]);

  const offerFilterOptions = useMemo(() => {
    const categories = [
      ...new Set(
        allOffers
          .map((offer) => normalizeOfferCategory(offer.categoria))
          .filter(Boolean)
      )
    ];

    return [
      { id: "all", label: "Tutte", count: allOffers.length },
      { id: "compatible", label: "Compatibili", count: allOffers.filter(isCompatibleOffer).length },
      { id: "recommended", label: "Consigliati", count: allOffers.filter(isRecommendedOffer).length },
      ...categories
        .filter((category) => category && category !== "generale")
        .map((category) => ({
          id: `category:${category}`,
          label: getOfferCategoryLabel(category),
          count: allOffers.filter((offer) => normalizeOfferCategory(offer.categoria) === category).length,
        }))
    ].filter((option) => option.count > 0 || option.id === "all");
  }, [allOffers]);

  const filteredAllOffers = useMemo(() => {
    if (offerFilter === "compatible") {
      return allOffers.filter(isCompatibleOffer);
    }

    if (offerFilter === "recommended") {
      return allOffers.filter(isRecommendedOffer);
    }

    if (offerFilter.startsWith("category:")) {
      const category = offerFilter.replace("category:", "");
      return allOffers.filter((offer) => normalizeOfferCategory(offer.categoria) === category);
    }

    return allOffers;
  }, [allOffers, offerFilter]);

  const homeDeviceOffers = useMemo(() => {
    return (data.recommendedOffers || [])
      .filter((offer) =>
        offer?.affiliate_url &&
        offer?.source !== "manual" &&
        offer?.tipo_offerta !== "manual"
      )
      .slice(0, 4);
  }, [data.recommendedOffers]);

  function trackOfferClick(offer, source = "webapp") {
    if (!token || !offer?.affiliate_url) return;

    const payload = JSON.stringify({
      asin: offer.asin || null,
      titolo: offer.titolo || null,
      affiliate_url: offer.affiliate_url,
      source
    });

    const endpoint = `/api/app/${token}/click`;

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], {
          type: "application/json"
        });

        navigator.sendBeacon(endpoint, blob);
        return;
      }

      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: payload,
        keepalive: true
      }).catch(() => {});
    } catch (err) {
      // Il click deve aprire comunque il link affiliato.
    }
  }

  function openAffiliateLink(offer, source = "webapp") {
    const url = offer?.affiliate_url || offer;

    if (!url) return;

    if (offer?.affiliate_url) {
      trackOfferClick(offer, source);
    }

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

  function buildOfferShareText(offer) {
    const lines = [];

    lines.push("Offerta Smart Assistance");

    if (offer?.titolo) {
      lines.push(offer.titolo);
    }

    const discountPercent = getOfferDiscountPercent(offer);

    if (offer?.prezzo) {
      const priceLine = discountPercent > 0
        ? `Prezzo: ${offer.prezzo} (-${discountPercent}%)`
        : `Prezzo: ${offer.prezzo}`;

      lines.push(priceLine);
    }

    if (offer?.prezzo_precedente) {
      lines.push(`Prima: ${offer.prezzo_precedente}`);
    }

    return lines.filter(Boolean).join("\n");
  }

  function copyTextToClipboardFallback(text) {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy");
      return true;
    } catch (err) {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async function shareOffer(offer) {
    const url = offer?.affiliate_url;

    if (!url) {
      alert("Link offerta non disponibile.");
      return;
    }

    const title = offer?.titolo || "Offerta Smart Assistance";
    const text = buildOfferShareText(offer);
    const fallbackText = `${text}\n${url}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url,
        });

        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fallbackText);
        alert("Link offerta copiato. Ora puoi incollarlo dove vuoi.");
        return;
      }

      const copied = copyTextToClipboardFallback(fallbackText);

      if (copied) {
        alert("Link offerta copiato. Ora puoi incollarlo dove vuoi.");
      } else {
        alert("Copia manualmente il link: " + url);
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        return;
      }

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(fallbackText);
          alert("Link offerta copiato. Ora puoi incollarlo dove vuoi.");
          return;
        }
      } catch (copyErr) {
        // fallback sotto
      }

      alert("Condivisione non riuscita. Link: " + url);
    }
  }

  function openWhatsApp() {
    const message = encodeURIComponent(
      `Ciao, ho bisogno di assistenza per ${deviceName || "il mio dispositivo"}.`
    );

    window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
  }

  function buildPrivacyRequestMessage() {
    return encodeURIComponent(
      "Ciao, vorrei informazioni sulla gestione o revoca del consenso privacy collegato alla mia WebApp Smart Assistance."
    );
  }

  function openPrivacyRequestWhatsApp() {
    window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${buildPrivacyRequestMessage()}`;
  }

  async function updateCustomerConsentPreferences(nextValues) {
    if (!token || consentSaving) return;

    try {
      setConsentSaving(true);
      setConsentMessage("");

      const res = await fetch(`/api/app/${token}/consents`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          marketing_consent: Boolean(nextValues.marketing_consent),
          whatsapp_consent: Boolean(nextValues.whatsapp_consent),
        }),
      });

      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Errore aggiornamento consensi");
      }

      setData((current) => ({
        ...current,
        customer: {
          ...current.customer,
          ...(json.customer || {}),
        },
        manualOffers: json.customer?.marketing_consent ? current.manualOffers : [],
        recommendedOffers: json.customer?.marketing_consent ? current.recommendedOffers : [],
        trendingOffers: json.customer?.marketing_consent ? current.trendingOffers : [],
        liveOffers: json.customer?.marketing_consent ? current.liveOffers : [],
      }));

      if (!json.customer?.marketing_consent && ["offers", "live"].includes(tab)) {
        setTab("home");
        syncAppNavigation("home", 1, { replace: true });
      }

      setConsentMessage("Preferenze aggiornate.");
    } catch (err) {
      setConsentMessage(err.message || "Errore aggiornamento consensi.");
    } finally {
      setConsentSaving(false);
    }
  }

  function selectTab(nextTab, options = {}) {
    const tabName = getValidTab(nextTab);
    const livePage = tabName === "live" ? options.livePage || 1 : 1;

    setTab(tabName);
    syncAppNavigation(tabName, livePage, {
      replace: Boolean(options.replace),
    });

    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goToOffers() {
    selectTab("offers");
  }

  function goToSupport() {
    selectTab("support");
  }

  function openReceipt(device) {
    if (!device?.receipt_data_url) {
      return;
    }

    setReceiptViewer(device);
  }

  function closeReceiptViewer() {
    setReceiptViewer(null);
    selectTab("home");
  }

  async function installWebApp() {
    if (!installPrompt) return;

    installPrompt.prompt();

    try {
      await installPrompt.userChoice;
    } catch (err) {
      // Il browser può non restituire una scelta.
    }

    setInstallPrompt(null);
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
      maxWidth: "1180px",
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
      display: "flex",
      alignItems: "center",
      gap: "10px",
      marginBottom: "18px",
      fontWeight: "bold",
    },
    brandLogo: {
      width: "210px",
      maxWidth: "72vw",
      height: "auto",
      borderRadius: "18px",
      background: "#ffffff",
      padding: "8px 10px",
      boxShadow: "0 12px 28px rgba(0,0,0,.22)",
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
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: "14px",
      background: "rgba(255,255,255,.14)",
      color: "white",
      fontSize: "20px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    iosInstallCard: {
      background: "rgba(255,255,255,.10)",
      border: "1px solid rgba(255,255,255,.14)",
      borderRadius: "20px",
      padding: "14px",
      marginTop: "14px",
      color: "#e0f2fe",
      lineHeight: 1.45,
      fontSize: "14px",
    },
    iosInstallTitle: {
      color: "#ffffff",
      fontWeight: "bold",
      marginBottom: "6px",
    },
    receiptOverlay: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#0f172a",
      display: "flex",
      flexDirection: "column",
    },
    receiptToolbar: {
      minHeight: "64px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      padding: "10px 14px",
      background: "rgba(15,23,42,.98)",
      borderBottom: "1px solid rgba(255,255,255,.12)",
      color: "#f8fafc",
    },
    receiptTitle: {
      minWidth: 0,
      fontWeight: "bold",
      fontSize: "14px",
      lineHeight: 1.25,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    receiptBackButton: {
      border: "none",
      borderRadius: "14px",
      padding: "11px 14px",
      background: "#2563eb",
      color: "white",
      fontWeight: "bold",
      fontSize: "14px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    receiptFrameWrap: {
      flex: 1,
      minHeight: 0,
      background: "#111827",
      display: "flex",
      alignItems: "stretch",
      justifyContent: "center",
    },
    receiptFrame: {
      width: "100%",
      height: "100%",
      border: 0,
      background: "#111827",
    },
    receiptImage: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      background: "#111827",
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
    secondaryCta: {
      width: "100%",
      border: "1px solid rgba(96,165,250,.40)",
      borderRadius: "16px",
      padding: "14px",
      fontWeight: "bold",
      fontSize: "15px",
      cursor: "pointer",
      background: "rgba(37,99,235,.14)",
      color: "#bfdbfe",
    },
    compactCtaRow: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "10px",
      marginTop: "14px",
    },
    featuredOfferLabel: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      borderRadius: "999px",
      padding: "7px 10px",
      background: "rgba(250,204,21,.14)",
      color: "#fde68a",
      fontWeight: "bold",
      fontSize: "13px",
      marginBottom: "12px",
    },
    filterBar: {
      display: "flex",
      gap: "10px",
      overflowX: "auto",
      padding: "4px 0 14px",
      marginBottom: "6px",
    },
    filterButton: {
      border: "1px solid rgba(96,165,250,.30)",
      borderRadius: "999px",
      padding: "10px 13px",
      background: "rgba(255,255,255,.06)",
      color: "#cbd5e1",
      fontWeight: "bold",
      fontSize: "13px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    filterButtonActive: {
      background: "#2563eb",
      borderColor: "#60a5fa",
      color: "#ffffff",
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
    preferenceToggle: {
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
      border: "1px solid rgba(148,163,184,.30)",
      background: "rgba(255,255,255,.04)",
      borderRadius: "16px",
      padding: "14px",
      color: "#e2e8f0",
      cursor: "pointer",
    },
    preferenceCheck: {
      marginTop: "4px",
      flexShrink: 0,
    },
    preferenceCopy: {
      display: "grid",
      gap: "4px",
      minWidth: 0,
      flex: 1,
    },
    preferenceTitle: {
      display: "block",
      fontWeight: "bold",
      lineHeight: 1.25,
    },
    preferenceHint: {
      display: "block",
      color: "#cbd5e1",
      fontSize: "13px",
      lineHeight: 1.45,
    },
    supportSideStack: {
      display: "grid",
      gap: "16px",
      alignContent: "start",
      minWidth: 0,
    },
    preferencePanelHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "14px",
      marginBottom: "14px",
    },
    preferencePanelTitle: {
      margin: "0 0 6px",
      fontSize: "28px",
      lineHeight: 1.15,
    },
    preferencePanelSubtitle: {
      margin: 0,
      color: "#cbd5e1",
      lineHeight: 1.45,
      fontSize: "15px",
    },
    preferencePanelButton: {
      border: "1px solid rgba(147,197,253,.40)",
      borderRadius: "14px",
      padding: "12px 16px",
      background: "rgba(37,99,235,.16)",
      color: "#bfdbfe",
      fontWeight: "bold",
      cursor: "pointer",
      whiteSpace: "nowrap",
      minWidth: "110px",
    },
    privacyCompactCard: {
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
      border: "1px solid rgba(148,163,184,.25)",
      background: "rgba(255,255,255,.045)",
      borderRadius: "16px",
      padding: "14px",
      color: "#e2e8f0",
    },
    compactContactCard: {
      padding: "22px",
    },
    nav: {
      position: "fixed",
      left: "50%",
      right: "auto",
      bottom: "12px",
      width: "calc(100% - 24px)",
      maxWidth: "560px",
      transform: "translateX(-50%)",
      margin: "0 auto",
      background: "rgba(15,23,42,.96)",
      border: "1px solid rgba(255,255,255,.10)",
      borderRadius: "22px",
      display: "grid",
      gridTemplateColumns: "repeat(5,1fr)",
      padding: "10px",
      boxShadow: "0 12px 36px rgba(0,0,0,.35)",
      backdropFilter: "blur(12px)",
    },
  };

  async function loadLiveOffersPage(page, options = {}) {
    if (!token || liveLoading) return;

    const pageNumber = Number.isFinite(Number(page)) && Number(page) > 0
      ? Number(page)
      : 1;

    try {
      setLiveLoading(true);

      const res = await fetch(`/api/app/${token}/live-offers?page=${encodeURIComponent(pageNumber)}&v=${Date.now()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Errore caricamento offerte live");
      }

      setData((current) => ({
        ...current,
        liveOffers: json.liveOffers || [],
        livePagination: json.livePagination || current.livePagination,
        liveSettings: json.liveSettings || current.liveSettings,
      }));

      setTab("live");

      if (options.syncUrl !== false) {
        syncAppNavigation("live", json.livePagination?.page || pageNumber);
      }

      if (options.scroll !== false) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      alert(err.message || "Errore caricamento offerte live");
    } finally {
      setLiveLoading(false);
    }
  }

  function NavButton({ id, icon, label }) {
    const active = tab === id;

    return (
      <button
        onClick={() => {
          selectTab(id, {
            livePage: id === "live" ? 1 : undefined,
          });
        }}
        style={{
          border: "none",
          background: active ? "#2563eb" : "transparent",
          color: active ? "white" : "#cbd5e1",
          borderRadius: "14px",
          padding: "9px 8px",
          fontSize: "11px",
          fontWeight: "bold",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2px",
          minHeight: "58px",
          minWidth: 0,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "18px", marginBottom: "2px" }}>{icon}</div>
        {label}
      </button>
    );
  }

  function getOfferBadge(offer, compact = false) {
    if (offer?.source === "live_telegram" || offer?.tipo_offerta === "live") {
      return "Offerta live";
    }

    if (offer?.source === "manual") {
      return "Scelto da Smart Assistance";
    }

    if (offer?.source === "amazon_recommended" || offer?.tipo_offerta === "accessory") {
      return "Compatibile con il tuo dispositivo";
    }

    if (compact) {
      return "Offerta in evidenza";
    }

    return "Prodotto consigliato";
  }

  function getOfferClickSource(offer, compact = false) {
    if (offer?.source === "live_telegram" || offer?.tipo_offerta === "live") {
      return "live_offer";
    }

    if (offer?.source === "manual") {
      return "manual_offer";
    }

    if (offer?.source === "amazon_recommended") {
      return "amazon_recommended";
    }

    return compact ? "trending" : "recommended";
  }

  function parseOfferEuroAmount(value) {
    const parsed = Number.parseFloat(
      String(value || "")
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^\d.]/g, "")
    );

    return Number.isFinite(parsed) ? parsed : null;
  }

  function getOfferDiscountPercent(offer) {
    const direct = Number.parseInt(offer?.sconto_percentuale || offer?.discount_percent || 0, 10);

    if (Number.isFinite(direct) && direct > 0 && direct < 100) {
      return direct;
    }

    const price = parseOfferEuroAmount(offer?.prezzo || offer?.price_text);
    const previousPrice = parseOfferEuroAmount(offer?.prezzo_precedente || offer?.previous_price_text);

    if (previousPrice && price && previousPrice > price) {
      return Math.round(((previousPrice - price) / previousPrice) * 100);
    }

    return 0;
  }

  function OfferCard({ offer, compact = false }) {
    const discountPercent = getOfferDiscountPercent(offer);

    return (
      <div className="sa-offer-card" style={styles.lightCard}>
        <div style={{ position: "relative" }}>
          {discountPercent > 0 && (
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
              -{discountPercent}%
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
          {getOfferBadge(offer, compact)}
        </div>

        <h3 style={{ margin: "0 0 10px", fontSize: "17px", lineHeight: 1.25 }}>
          {offer.titolo || "Prodotto consigliato"}
        </h3>

        {(offer.partner || offer.categoria) && (
          <div style={{ color: "#64748b", fontSize: "13px", marginBottom: "12px", fontWeight: "bold" }}>
            {[offer.partner, offer.categoria].filter(Boolean).join(" · ")}
          </div>
        )}

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

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            style={{ ...styles.cta, flex: 1 }}
            onClick={() => openAffiliateLink(offer, getOfferClickSource(offer, compact))}
          >
            Scopri →
          </button>

          <button
            type="button"
            title="Condividi offerta"
            aria-label="Condividi offerta"
            onClick={() => shareOffer(offer)}
            style={{
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              color: "#334155",
              borderRadius: "14px",
              padding: "14px 12px",
              fontWeight: "bold",
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              minWidth: compact ? "46px" : "112px",
            }}
          >
            <span aria-hidden="true">📤</span>
            {!compact && <span>Condividi</span>}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div className="sa-shell" style={{ ...styles.shell, display: "flex", minHeight: "80vh", alignItems: "center", justifyContent: "center" }}>
          Caricamento...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.page}>
        <div className="sa-shell" style={styles.shell}>
          <div className="sa-app-card" style={styles.card}>
            <h2>Impossibile caricare la WebApp</h2>
            <p>{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="sa-page" style={styles.page}>
      <style>{`
        /* PATCH_63_1_WEBAPP_NO_WHITE_FRAME */
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #0f172a !important;
          width: 100% !important;
          min-height: 100% !important;
          overflow-x: hidden !important;
        }

        body {
          overscroll-behavior-x: none;
          -webkit-tap-highlight-color: transparent;
        }

        .sa-page {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          min-height: 100vh !important;
          min-height: 100dvh !important;
          background: #0f172a !important;
        }
        /* PATCH_63_WEBAPP_MOBILE_SAFE */
        .sa-page,
        .sa-page * {
          box-sizing: border-box;
        }

        .sa-page {
          overflow-x: hidden;
          -webkit-text-size-adjust: 100%;
          touch-action: manipulation;
        }

        .sa-shell {
          max-width: 100%;
        }

        .sa-filter-bar-mobile-helper {
          display: none;
        }

        @media (max-width: 520px) {
          .sa-page {
            padding: 12px !important;
            padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px)) !important;
          }

          .sa-app-card,
          .sa-offer-card {
            border-radius: 18px !important;
            padding: 14px !important;
          }

          .sa-home-hero {
            border-radius: 22px !important;
            padding: 18px !important;
          }

          .sa-home-hero h1,
          .sa-page h1 {
            font-size: 24px !important;
            line-height: 1.15 !important;
          }

          .sa-page h2 {
            font-size: 20px !important;
            line-height: 1.2 !important;
          }

          .sa-offer-card img {
            height: 145px !important;
            margin-bottom: 12px !important;
          }

          .sa-offer-card h3 {
            font-size: 16px !important;
            line-height: 1.28 !important;
          }

          .sa-offer-card > div:last-child {
            gap: 8px !important;
          }

          .sa-offer-card > div:last-child button {
            min-height: 48px !important;
          }

          .sa-nav {
            width: calc(100% - 16px) !important;
            bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important;
            padding: 8px !important;
            border-radius: 20px !important;
          }

          .sa-nav button {
            min-height: 54px !important;
            padding: 7px 4px !important;
            font-size: 10px !important;
          }

          .sa-nav button div {
            font-size: 17px !important;
            margin-bottom: 1px !important;
          }
        }

        @media (max-width: 390px) {
          .sa-page {
            padding: 10px !important;
            padding-bottom: calc(108px + env(safe-area-inset-bottom, 0px)) !important;
          }

          .sa-nav {
            width: calc(100% - 12px) !important;
            padding: 7px !important;
          }

          .sa-nav button {
            min-height: 50px !important;
            font-size: 9.5px !important;
          }

          .sa-nav button div {
            font-size: 16px !important;
          }

          .sa-offer-card img {
            height: 132px !important;
          }
        }
        .sa-shell {
          width: 100%;
        }

        .sa-home-grid,
        .sa-offers-grid,
        .sa-devices-grid,
        .sa-support-grid {
          display: grid;
          gap: 16px;
        }

        .sa-offers-grid,
        .sa-devices-grid,
        .sa-support-grid {
          grid-template-columns: 1fr;
        }

        .sa-section-header {
          margin-bottom: 14px;
        }

        .sa-offer-card,
        .sa-app-card {
          min-width: 0;
        }

        .sa-featured-offer {
          margin-bottom: 16px;
        }

        .sa-support-grid {
          align-items: start;
        }

        .sa-support-grid > * {
          min-width: 0;
        }

        @media (min-width: 900px) {
          .sa-page {
            padding: 28px 32px 108px !important;
          }

          /* PATCH_63_1_WEBAPP_NO_WHITE_FRAME */
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #0f172a !important;
          width: 100% !important;
          min-height: 100% !important;
          overflow-x: hidden !important;
        }

        body {
          overscroll-behavior-x: none;
          -webkit-tap-highlight-color: transparent;
        }

        .sa-page {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          min-height: 100vh !important;
          min-height: 100dvh !important;
          background: #0f172a !important;
        }
        /* PATCH_63_WEBAPP_MOBILE_SAFE */
        .sa-page,
        .sa-page * {
          box-sizing: border-box;
        }

        .sa-page {
          overflow-x: hidden;
          -webkit-text-size-adjust: 100%;
          touch-action: manipulation;
        }

        .sa-shell {
          max-width: 100%;
        }

        .sa-filter-bar-mobile-helper {
          display: none;
        }

        @media (max-width: 520px) {
          .sa-page {
            padding: 12px !important;
            padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px)) !important;
          }

          .sa-app-card,
          .sa-offer-card {
            border-radius: 18px !important;
            padding: 14px !important;
          }

          .sa-home-hero {
            border-radius: 22px !important;
            padding: 18px !important;
          }

          .sa-home-hero h1,
          .sa-page h1 {
            font-size: 24px !important;
            line-height: 1.15 !important;
          }

          .sa-page h2 {
            font-size: 20px !important;
            line-height: 1.2 !important;
          }

          .sa-offer-card img {
            height: 145px !important;
            margin-bottom: 12px !important;
          }

          .sa-offer-card h3 {
            font-size: 16px !important;
            line-height: 1.28 !important;
          }

          .sa-offer-card > div:last-child {
            gap: 8px !important;
          }

          .sa-offer-card > div:last-child button {
            min-height: 48px !important;
          }

          .sa-nav {
            width: calc(100% - 16px) !important;
            bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important;
            padding: 8px !important;
            border-radius: 20px !important;
          }

          .sa-nav button {
            min-height: 54px !important;
            padding: 7px 4px !important;
            font-size: 10px !important;
          }

          .sa-nav button div {
            font-size: 17px !important;
            margin-bottom: 1px !important;
          }
        }

        @media (max-width: 390px) {
          .sa-page {
            padding: 10px !important;
            padding-bottom: calc(108px + env(safe-area-inset-bottom, 0px)) !important;
          }

          .sa-nav {
            width: calc(100% - 12px) !important;
            padding: 7px !important;
          }

          .sa-nav button {
            min-height: 50px !important;
            font-size: 9.5px !important;
          }

          .sa-nav button div {
            font-size: 16px !important;
          }

          .sa-offer-card img {
            height: 132px !important;
          }
        }
        .sa-shell {
            max-width: 1180px !important;
          }

          .sa-home-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            align-items: start;
          }

          .sa-home-hero {
            grid-column: 1 / -1;
            min-height: 190px;
          }

          .sa-home-device {
            grid-column: 1;
          }

          .sa-home-assist {
            grid-column: 2;
          }

          .sa-offer-section,
          .sa-trending-section {
            grid-column: 1 / -1;
          }

          .sa-offers-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sa-offers-grid-home {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sa-devices-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sa-support-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            align-items: start;
          }

          .sa-support-main {
            grid-column: 1 / -1;
          }

          .sa-support-guides {
            grid-column: 1;
          }

          .sa-support-side-stack {
            grid-column: 2;
            align-self: start;
          }

          .sa-support-side,
          .sa-support-secondary {
            grid-column: auto;
            align-self: auto;
          }

          .sa-nav {
            max-width: 760px !important;
            bottom: 18px !important;
          }

          .sa-offer-card,
          .sa-app-card {
            transition: transform .16s ease, box-shadow .16s ease;
          }

          .sa-offer-card:hover,
          .sa-app-card:hover {
            transform: translateY(-2px);
          }
        }

        @media (min-width: 1180px) {
          .sa-offers-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .sa-offers-grid-home {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .sa-devices-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .sa-nav {
            max-width: 860px !important;
          }
        }

        @media (max-width: 899px) {
          .sa-page {
            padding: 16px !important;
            padding-bottom: 92px !important;
          }
        }
      `}</style>

      {receiptViewer && (
        <section style={styles.receiptOverlay}>
          <div style={styles.receiptToolbar}>
            <button
              type="button"
              onClick={closeReceiptViewer}
              style={styles.receiptBackButton}
            >
              ← Torna alla Home
            </button>

            <div style={styles.receiptTitle}>
              Scontrino {receiptViewer.marca || ""} {receiptViewer.modello || ""}
            </div>
          </div>

          <div style={styles.receiptFrameWrap}>
            {receiptViewer.receipt_mime_type === "application/pdf" ? (
              <iframe
                src={receiptViewer.receipt_data_url}
                title="Scontrino acquisto"
                style={styles.receiptFrame}
              />
            ) : (
              <img
                src={receiptViewer.receipt_data_url}
                alt="Scontrino acquisto"
                style={styles.receiptImage}
              />
            )}
          </div>
        </section>
      )}

      <div className="sa-shell" style={styles.shell}>
        {tab === "home" && (
          <div className="sa-home-grid">
            <section className="sa-home-hero sa-app-card" style={styles.hero}>
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
                  <img
                    src="/brand/smart-assistance-wordmark-card.png?v=52"
                    alt="Smart Assistance"
                    style={styles.brandLogo}
                  />
                </div>

                {installPrompt && !isInstalled && (
                  <button
                    type="button"
                    onClick={installWebApp}
                    title="Installa Smart Assistance"
                    aria-label="Installa Smart Assistance"
                    style={styles.installIconButton}
                  >
                    📲
                  </button>
                )}
              </div>

              <h1 style={styles.title}>Ciao {data.customer?.nome || customerName || ""} 👋</h1>
              <div style={styles.subtitle}>
                {getHeroText(primaryCategory)}
              </div>

              {showIosInstallGuide && (
                <div style={styles.iosInstallCard}>
                  <div style={styles.iosInstallTitle}>Installa su iPhone</div>
                  Su Safari non compare il pulsante automatico. Tocca <strong>Condividi</strong> e poi
                  <strong> Aggiungi alla schermata Home</strong>.
                </div>
              )}
            </section>

            {!canShowMarketingOffers && (
              <section className="sa-offer-section sa-app-card" style={styles.card}>
                <h2 style={{ margin: "0 0 8px" }}>🎁 Offerte non attive</h2>
                <p style={{ color: "#cbd5e1", lineHeight: 1.5, margin: 0 }}>
                  Le offerte personalizzate e le offerte live sono disponibili solo se è attivo il consenso marketing.
                  Puoi richiederne l'attivazione al punto vendita.
                </p>
              </section>
            )}

            <section className="sa-home-device sa-app-card" style={styles.card}>
              <div style={{ fontSize: "14px", color: "#93c5fd", marginBottom: "8px", fontWeight: "bold" }}>
                {getDeviceIcon(primaryCategory)} {getDeviceLabel(primaryCategory)}
              </div>
              <h2 style={{ margin: "0 0 10px", fontSize: "24px" }}>
                {deviceName || "Dispositivo non disponibile"}
              </h2>
              <div style={{ color: "#cbd5e1" }}>
                🛡 Garanzia fino al {formatDate(data.device?.scadenza_garanzia)}
              </div>

              {data.device?.receipt_data_url && (
                <button
                  type="button"
                  onClick={() => openReceipt(data.device)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: "16px",
                    padding: "14px",
                    marginTop: "14px",
                    background: "#f59e0b",
                    color: "#111827",
                    fontWeight: "bold",
                    fontSize: "15px",
                    cursor: "pointer",
                  }}
                >
                  🧾 Apri scontrino acquisto
                </button>
              )}
            </section>

            <section className="sa-home-assist sa-app-card" style={styles.card}>
              <h2 style={{ margin: "0 0 8px" }}>💬 Hai bisogno di assistenza?</h2>
              <p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
                Scrivici su WhatsApp: ti aiutiamo con configurazione,
                garanzia, accessori e supporto post vendita.
              </p>

              <div style={styles.compactCtaRow}>
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

                <button
                  type="button"
                  onClick={goToSupport}
                  style={styles.secondaryCta}
                >
                  Guide e contatti →
                </button>
              </div>

              {installPrompt && !isInstalled && (
                <div style={{
                  marginTop: "14px",
                  borderTop: "1px solid rgba(255,255,255,.08)",
                  paddingTop: "14px",
                }}>
                  <div style={{ color: "#bfdbfe", fontWeight: "bold", marginBottom: "6px" }}>
                    Installa Smart Assistance
                  </div>
                  <p style={{ color: "#cbd5e1", lineHeight: 1.45, fontSize: "14px", marginTop: 0 }}>
                    Aggiungila al PC o alla schermata Home per ritrovarla subito.
                  </p>
                  <button
                    type="button"
                    onClick={installWebApp}
                    style={styles.secondaryCta}
                  >
                    Installa WebApp 📲
                  </button>
                </div>
              )}
            </section>

            {homeDeviceOffers.length > 0 && (
              <section className="sa-offer-section">
                <h2 style={styles.sectionTitle}>🎁 Consigliati per il tuo dispositivo</h2>
                {homeDeviceOffers[0] && (
                  <div className="sa-featured-offer">
                    <div style={styles.featuredOfferLabel}>⭐ Prodotto in evidenza</div>
                    <OfferCard
                      offer={homeDeviceOffers[0]}
                    />
                  </div>
                )}

                {homeDeviceOffers.slice(1, 3).length > 0 && (
                  <div className="sa-offers-grid sa-offers-grid-home">
                    {homeDeviceOffers.slice(1, 3).map((offer, index) => (
                      <OfferCard key={offer.asin || offer.affiliate_url || index} offer={offer} compact />
                    ))}
                  </div>
                )}

                <div style={styles.compactCtaRow}>
                  <button
                    type="button"
                    onClick={goToOffers}
                    style={styles.secondaryCta}
                  >
                    Vedi tutte le offerte →
                  </button>
                </div>
              </section>
            )}

            {data.trendingOffers?.length > 0 && (
              <section className="sa-trending-section">
                <h2 style={styles.sectionTitle}>🔥 Offerte interessanti</h2>
                <div className="sa-offers-grid">
                  {data.trendingOffers.slice(0, 3).map((offer, index) => (
                    <OfferCard key={offer.asin || offer.affiliate_url || index} offer={offer} compact />
                  ))}
                </div>

                <div style={styles.compactCtaRow}>
                  <button
                    type="button"
                    onClick={goToOffers}
                    style={styles.secondaryCta}
                  >
                    Apri offerte per te →
                  </button>
                </div>
              </section>
            )}

          </div>
        )}

        {tab === "offers" && canShowMarketingOffers && (
          <>
            <h1 style={{ marginTop: 0 }}>🎁 Per te</h1>
            <p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
              {getOfferIntro(primaryCategory)}
            </p>

            {allOffers.length > 0 && (
              <div style={styles.filterBar}>
                {offerFilterOptions.map((option) => {
                  const active = offerFilter === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setOfferFilter(option.id)}
                      style={{
                        ...styles.filterButton,
                        ...(active ? styles.filterButtonActive : {}),
                      }}
                    >
                      {option.label} · {option.count}
                    </button>
                  );
                })}
              </div>
            )}

            {allOffers.length === 0 ? (
              <div className="sa-app-card" style={styles.card}>Nessuna offerta disponibile al momento.</div>
            ) : filteredAllOffers.length === 0 ? (
              <div className="sa-app-card" style={styles.card}>
                Nessuna offerta per questo filtro.
              </div>
            ) : (
              <div className="sa-offers-grid">
                {filteredAllOffers.map((offer, index) => (
                  <OfferCard key={offer.asin || offer.affiliate_url || index} offer={offer} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "live" && canShowMarketingOffers && data.liveSettings?.enabled !== false && (
          <>
            <h1 style={{ marginTop: 0 }}>🔥 Offerte live</h1>
            <p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
              Offerte automatiche aggiornate dai canali selezionati da Smart Assistance. Le offerte live restano visibili per poco tempo.
            </p>

            {data.livePagination?.total > 0 && (
              <div className="sa-app-card" style={{ ...styles.card, marginBottom: "16px" }}>
                <strong>{data.livePagination.total} offerte live disponibili</strong>
                <div style={{ color: "#cbd5e1", marginTop: "6px", fontSize: "14px" }}>
                  Pagina {data.livePagination.page} di {data.livePagination.totalPages} · {data.livePagination.pageSize} offerte per pagina
                </div>
              </div>
            )}

            {!data.liveOffers?.length ? (
              <div className="sa-app-card" style={styles.card}>
                Nessuna offerta live disponibile al momento.
              </div>
            ) : (
              <>
                <div className="sa-offers-grid">
                  {data.liveOffers.map((offer, index) => (
                    <OfferCard key={`${offer.asin || offer.affiliate_url || index}-${index}`} offer={offer} />
                  ))}
                </div>

                {data.livePagination?.totalPages > 1 && (
                  <div className="sa-app-card" style={{ ...styles.card, marginTop: "18px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <button
                        style={{
                          ...styles.cta,
                          width: "auto",
                          opacity: data.livePagination.hasPrev && !liveLoading ? 1 : 0.45,
                          cursor: data.livePagination.hasPrev && !liveLoading ? "pointer" : "not-allowed",
                        }}
                        disabled={!data.livePagination.hasPrev || liveLoading}
                        onClick={() => loadLiveOffersPage((data.livePagination.page || 1) - 1)}
                      >
                        ← Precedenti
                      </button>

                      <strong style={{ color: "#e2e8f0" }}>
                        Pagina {data.livePagination.page} / {data.livePagination.totalPages}
                      </strong>

                      <button
                        style={{
                          ...styles.cta,
                          width: "auto",
                          opacity: data.livePagination.hasNext && !liveLoading ? 1 : 0.45,
                          cursor: data.livePagination.hasNext && !liveLoading ? "pointer" : "not-allowed",
                        }}
                        disabled={!data.livePagination.hasNext || liveLoading}
                        onClick={() => loadLiveOffersPage((data.livePagination.page || 1) + 1)}
                      >
                        Successive →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "devices" && (
          <>
            <h1 style={{ marginTop: 0 }}>📱💻🖥️ Dispositivi</h1>
            {data.devices.length === 0 ? (
              <div className="sa-app-card" style={styles.card}>Nessun dispositivo registrato.</div>
            ) : (
              <div className="sa-devices-grid">
                {data.devices.map((device, index) => (
                  <section key={index} className="sa-app-card" style={styles.card}>
                  <div style={{
                    display: "inline-block",
                    background: "rgba(96,165,250,.18)",
                    border: "1px solid rgba(147,197,253,.28)",
                    color: "#bfdbfe",
                    borderRadius: "999px",
                    padding: "6px 10px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    marginBottom: "10px",
                  }}>
                    {getDeviceIcon(normalizeDeviceCategory(device.categoria))} {getDeviceLabel(normalizeDeviceCategory(device.categoria))}
                  </div>

                  <h2 style={{ margin: "0 0 8px" }}>
                    {device.marca} {device.modello}
                  </h2>
                  <div style={{ color: "#cbd5e1" }}>
                    🛡 Garanzia fino al {formatDate(device.scadenza_garanzia)}
                  </div>

                  {device.receipt_data_url ? (
                    <button
                      type="button"
                      onClick={() => openReceipt(device)}
                      style={{
                        width: "100%",
                        border: "none",
                        borderRadius: "16px",
                        padding: "14px",
                        marginTop: "14px",
                        background: "#f59e0b",
                        color: "#111827",
                        fontWeight: "bold",
                        fontSize: "15px",
                        cursor: "pointer",
                      }}
                    >
                      🧾 Apri scontrino acquisto
                    </button>
                  ) : (
                    <div style={{ color: "#94a3b8", marginTop: "10px", fontSize: "14px" }}>
                      Scontrino non disponibile.
                    </div>
                  )}

                  {device.note && (
                    <div style={{ color: "#94a3b8", marginTop: "10px" }}>
                      {device.note}
                    </div>
                  )}
                </section>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "support" && (
          <>
            <h1 style={{ marginTop: 0 }}>💬 Assistenza</h1>

            <div className="sa-support-grid">
            <section className="sa-support-main sa-app-card" style={styles.card}>
              <h2 style={{ marginTop: 0 }}>Siamo qui per aiutarti</h2>
              <p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
                {getSupportIntro(primaryCategory)}
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

            <section className="sa-support-guides sa-app-card" style={styles.card}>
              <h2 style={{ marginTop: 0 }}>📚 Guide rapide</h2>
              <p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
                Piccoli consigli utili per usare meglio il tuo smartphone ogni giorno.
              </p>

              <div style={{ display: "grid", gap: "12px" }}>
                {(data.guides || []).length === 0 ? (
                  <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
                    Nessuna guida disponibile al momento.
                  </div>
                ) : (
                  data.guides.map((guide) => (
                    <div key={guide.id || guide.title} style={styles.guideCard}>
                      <div style={styles.guideIcon}>{guide.icon || "💡"}</div>
                      <div>
                        <strong>{guide.title}</strong>
                        <p style={styles.guideText}>
                          {guide.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="sa-support-side-stack" style={styles.supportSideStack}>
<section className="sa-support-side sa-app-card" style={styles.card}>
                <div style={styles.preferencePanelHeader}>
                  <div>
                    <h2 style={styles.preferencePanelTitle}>🔐 Privacy e preferenze</h2>
                    <p style={styles.preferencePanelSubtitle}>
                      Gestisci offerte personalizzate e messaggi WhatsApp.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowConsentSettings(!showConsentSettings)}
                    style={styles.preferencePanelButton}
                  >
                    {showConsentSettings ? "Chiudi" : "Gestisci"}
                  </button>
                </div>

                {showConsentSettings && (
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div style={styles.privacyCompactCard}>
                      <div style={{ ...styles.guideIcon, width: "38px", height: "38px", minWidth: "38px", fontSize: "20px" }}>🔐</div>
                      <div>
                        <strong style={{ display: "block", marginBottom: "4px" }}>Privacy</strong>
                        <p style={styles.preferenceHint}>
                          Stato: {data.customer?.privacy_consent ? "attiva" : "non registrata"}.
                          Per una revoca completa contatta il punto vendita.
                        </p>
                        <button
                          type="button"
                          onClick={openPrivacyRequestWhatsApp}
                          style={{
                            marginTop: "10px",
                            border: "1px solid rgba(147,197,253,.35)",
                            borderRadius: "12px",
                            padding: "9px 12px",
                            background: "rgba(37,99,235,.16)",
                            color: "#bfdbfe",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          Richiedi gestione privacy
                        </button>
                      </div>
                    </div>

                    <label style={styles.preferenceToggle}>
                      <input
                        type="checkbox"
                        style={styles.preferenceCheck}
                        checked={Boolean(data.customer?.marketing_consent)}
                        disabled={consentSaving}
                        onChange={(e) => updateCustomerConsentPreferences({
                          marketing_consent: e.target.checked,
                          whatsapp_consent: Boolean(data.customer?.whatsapp_consent),
                        })}
                      />
                      <span style={styles.preferenceCopy}>
                        <strong style={styles.preferenceTitle}>Offerte e consigli personalizzati</strong>
                        <small style={styles.preferenceHint}>
                          Mostra o nasconde le sezioni Per te e Live.
                        </small>
                      </span>
                    </label>

                    <label style={styles.preferenceToggle}>
                      <input
                        type="checkbox"
                        style={styles.preferenceCheck}
                        checked={Boolean(data.customer?.whatsapp_consent)}
                        disabled={consentSaving}
                        onChange={(e) => updateCustomerConsentPreferences({
                          marketing_consent: Boolean(data.customer?.marketing_consent),
                          whatsapp_consent: e.target.checked,
                        })}
                      />
                      <span style={styles.preferenceCopy}>
                        <strong style={styles.preferenceTitle}>Messaggi WhatsApp</strong>
                        <small style={styles.preferenceHint}>
                          Consente messaggi e broadcast manuali dal punto vendita.
                        </small>
                      </span>
                    </label>

                    {consentMessage && (
                      <div style={{
                        border: "1px solid rgba(147,197,253,.30)",
                        background: "rgba(37,99,235,.12)",
                        color: "#bfdbfe",
                        borderRadius: "14px",
                        padding: "11px 12px",
                        fontSize: "14px",
                      }}>
                        {consentMessage}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="sa-support-secondary sa-app-card" style={{ ...styles.card, ...styles.compactContactCard }}>
                <h2 style={{ margin: "0 0 10px", fontSize: "25px" }}>📞 Contatti utili</h2>
                <p style={{ color: "#cbd5e1", lineHeight: 1.45, margin: "0 0 14px" }}>
                  Salva questa WebApp nella schermata Home per ritrovare assistenza, garanzia e consigli.
                </p>

                <button
                  onClick={openWhatsApp}
                  style={{
                    width: "100%",
                    border: "1px solid rgba(37,211,102,.45)",
                    borderRadius: "16px",
                    padding: "14px",
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
            </div>
            </div>
          </>
        )}
      </div>

      <nav
        className="sa-nav"
        style={{
          ...styles.nav,
          gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
          maxWidth: `${Math.min(860, Math.max(360, navItems.length * 170))}px`,
        }}
      >
        {navItems.map((item) => (
          <NavButton key={item.id} id={item.id} icon={item.icon} label={item.label} />
        ))}
      </nav>
    </main>
  );
}


