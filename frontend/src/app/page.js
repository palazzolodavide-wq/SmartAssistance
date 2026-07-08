"use client";

import React, { useEffect, useMemo, useState } from "react";

const API_URL = "";
const BRANDS = [
  "Samsung",
  "Apple",
  "Xiaomi",
  "Oppo",
  "Realme",
  "Honor",
  "Motorola",
  "Google",
  "Vivo",
  "OnePlus",
  "Huawei",
  "Nokia",
  "Altra",
];

const PRODUCT_CATEGORIES = [
  { value: "smartphone", label: "Smartphone" },
  { value: "notebook", label: "Notebook" },
  { value: "desktop", label: "Desktop / PC fisso" },
];

const OFFER_CATEGORIES = [
  { value: "accessori", label: "Accessori" },
  { value: "smartphone", label: "Smartphone" },
  { value: "notebook", label: "Notebook" },
  { value: "desktop", label: "Desktop / PC fisso" },
  { value: "casa", label: "Casa" },
  { value: "gaming", label: "Gaming" },
  { value: "audio", label: "Audio" },
  { value: "generale", label: "Generale" },
];

const OFFER_PARTNERS = [
  { value: "amazon", label: "Amazon" },
  { value: "euronics", label: "Euronics" },
  { value: "lavialattea", label: "La Via Lattea" },
  { value: "altro", label: "Altro" },
];

const EMPTY_USER_FORM = {
  nome: "",
  cognome: "",
  email: "",
  telefono: "",
  privacy_consent: false,
  marketing_consent: false,
  whatsapp_consent: false,
  consent_note: "",
  broadcast_opt_out: true,
};

const EMPTY_DEVICE_FORM = {
  user_id: "",
  marca: "",
  modello: "",
  categoria: "",
  data_acquisto: "",
  scadenza_garanzia: "",
  note: "",
};

const EMPTY_OFFER_FORM = {
  categoria: "accessori",
  partner: "amazon",
  titolo: "",
  descrizione: "",
  affiliate_url: "",
  image_url: "",
};

const EMPTY_LIVE_SETTINGS = {
  enabled: true,
  telegram_auto_import_enabled: false,
  amazon_tag: "",
  ttl_hours: 24,
  max_visible: 20,
};

const EMPTY_LIVE_SOURCE_FORM = {
  channel_ref: "",
  label: "",
};

const GUIDE_CATEGORIES = [
  { value: "generale", label: "Generale" },
  { value: "smartphone", label: "Smartphone" },
  { value: "notebook", label: "Notebook" },
  { value: "desktop", label: "Desktop / PC fisso" },
];

const EMPTY_GUIDE_FORM = {
  icon: "",
  title: "",
  description: "",
  categoria: "generale",
  sort_order: 0,
  enabled: true,
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "customers", label: "Clienti & Device" },
  { id: "offers", label: "Offerte" },
  { id: "guides", label: "Guide WebApp" },
  { id: "live", label: "Offerte Live" },
  { id: "system", label: "Sistema" },
  { id: "stats", label: "Statistiche" },
];

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  // PATCH_81_PRODUCTION_SOFT_STATE
  const [productionSoftByUser, setProductionSoftByUser] = useState({});
  const [productionSoftLoadingByUser, setProductionSoftLoadingByUser] = useState({});

  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [offers, setOffers] = useState([]);
  const [guides, setGuides] = useState([]);

  const [userSearch, setUserSearch] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [offerSearch, setOfferSearch] = useState("");
  const [guideSearch, setGuideSearch] = useState("");

  const [editingUserId, setEditingUserId] = useState(null);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [editingGuideId, setEditingGuideId] = useState(null);

  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [newCustomerDeviceForm, setNewCustomerDeviceForm] = useState(EMPTY_DEVICE_FORM);
  const [deviceForm, setDeviceForm] = useState(EMPTY_DEVICE_FORM);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER_FORM);
  const [guideForm, setGuideForm] = useState(EMPTY_GUIDE_FORM);

  const [amazonSearch, setAmazonSearch] = useState("");
  const [amazonResults, setAmazonResults] = useState([]);
  const [amazonSearchMessage, setAmazonSearchMessage] = useState("");
  const [amazonImportCategories, setAmazonImportCategories] = useState({});

  const [liveSettings, setLiveSettings] = useState(EMPTY_LIVE_SETTINGS);
  const [liveSources, setLiveSources] = useState([]);
  const [liveOffers, setLiveOffers] = useState([]);
  const [liveSourceForm, setLiveSourceForm] = useState(EMPTY_LIVE_SOURCE_FORM);
  const [liveImportText, setLiveImportText] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const [liveMonitor, setLiveMonitor] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  // PATCH_64_2_SAFE_WEBAPP_ANALYTICS_ADMIN_STATE
  const [webAppAnalytics, setWebAppAnalytics] = useState({
    summary: {
      online_now: 0,
      active_5m: 0,
      total_visits: 0,
      visits_today: 0,
      visits_7d: 0,
      unique_customers_total: 0,
      unique_customers_today: 0,
      peak_online_global: 0,
      peak_online_today: 0,
      last_activity_at: null,
    },
    recent_sessions: [],
  });

  const [clickStats, setClickStats] = useState({
    summary: {
      total_clicks: 0,
      clicks_24h: 0,
      clicks_7d: 0,
      clicks_30d: 0,
      unique_customers_7d: 0,
      unique_products: 0,
    },
    topProducts: [],
    dailyClicks: [],
    sourceStats: [],
    customerStats: [],
    recentClicks: [],
  });

  const [qrModalUser, setQrModalUser] = useState(null);
  const [receiptUploadModal, setReceiptUploadModal] = useState(null);
  const [whatsAppModalUser, setWhatsAppModalUser] = useState(null);
  const [whatsAppMessage, setWhatsAppMessage] = useState("");
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastIndex, setBroadcastIndex] = useState(0);
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [customerDeviceMode, setCustomerDeviceMode] = useState("list");
  const [newCustomerReceiptQrAfterSave, setNewCustomerReceiptQrAfterSave] = useState(false);
  const [deviceReceiptQrAfterSave, setDeviceReceiptQrAfterSave] = useState(false);

  const today = new Date();

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      window.location.href = "/login";
      return;
    }

    setAuthReady(true);
    loadData();
  }, []);

  // PATCH_64_5_ADMIN_ANALYTICS_AUTO_REFRESH_EFFECT
  useEffect(() => {
    if (!authReady || activeSection !== "dashboard" || loading) {
      return;
    }

    let cancelled = false;

    function refreshAnalytics() {
      if (cancelled) {
        return;
      }

      loadWebAppAnalytics({ silent: true });
    }

    refreshAnalytics();

    const intervalId = window.setInterval(refreshAnalytics, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authReady, activeSection, loading]);

  function getAuthToken() {
    if (typeof window === "undefined") {
      return "";
    }

    return localStorage.getItem("token") || "";
  }

  async function apiFetch(url, options = {}) {
    const token = getAuthToken();

    if (!token) {
      window.location.href = "/login";
      throw new Error("Accesso non effettuato");
    }

    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      throw new Error("Sessione scaduta");
    }

    return res;
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  // PATCH_64_5_ADMIN_ANALYTICS_AUTO_REFRESH_LOADER
  async function loadWebAppAnalytics(options = {}) {
    try {
      const analyticsRes = await apiFetch(`${API_URL}/api/analytics/summary`);
      const analyticsData = await analyticsRes.json();

      if (analyticsData.success) {
        setWebAppAnalytics({
          summary: analyticsData.summary || {},
          recent_sessions: Array.isArray(analyticsData.recent_sessions) ? analyticsData.recent_sessions : [],
        });
      }
    } catch (analyticsErr) {
      if (!options.silent) {
        console.error("Errore statistiche WebApp", analyticsErr);
      }
    }
  }

  async function loadData() {
    try {
      setLoading(true);

      const [usersRes, devicesRes, offersRes, guidesRes, liveRes, liveMonitorRes] = await Promise.all([
        apiFetch(`${API_URL}/api/users`),
        apiFetch(`${API_URL}/api/devices`),
        apiFetch(`${API_URL}/api/offers`),
        apiFetch(`${API_URL}/api/webapp-guides`),
        apiFetch(`${API_URL}/api/live-offers`),
        apiFetch(`${API_URL}/api/live-offers/monitor`),
      ]);

      const [usersData, devicesData, offersData, guidesData, liveData, liveMonitorData] = await Promise.all([
        usersRes.json(),
        devicesRes.json(),
        offersRes.json(),
        guidesRes.json(),
        liveRes.json(),
        liveMonitorRes.json(),
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setDevices(Array.isArray(devicesData) ? devicesData : []);
      setOffers(Array.isArray(offersData) ? offersData : []);
      setGuides(Array.isArray(guidesData?.guides) ? guidesData.guides : []);

      if (liveData?.success) {
        setLiveSettings({ ...EMPTY_LIVE_SETTINGS, ...(liveData.settings || {}) });
        setLiveSources(Array.isArray(liveData.sources) ? liveData.sources : []);
        setLiveOffers(Array.isArray(liveData.offers) ? liveData.offers : []);
      }

      if (liveMonitorData?.success) {
        setLiveMonitor(liveMonitorData);
      }

      try {
        const statsRes = await apiFetch(`${API_URL}/api/stats/clicks`);
        const statsData = await statsRes.json();

        if (statsData.success) {
          setClickStats(statsData);
        }
      } catch (statsErr) {
        console.error("Errore statistiche click", statsErr);
      }

      try {
        const broadcastRes = await apiFetch(`${API_URL}/api/broadcast/whatsapp/history`);
        const broadcastData = await broadcastRes.json();

        if (broadcastData.success && Array.isArray(broadcastData.broadcasts)) {
          setBroadcastHistory(broadcastData.broadcasts);
        }
      } catch (broadcastErr) {
        console.error("Errore storico broadcast WhatsApp", broadcastErr);
      }

      try {
        const systemRes = await apiFetch(`${API_URL}/api/system-status`);
        const systemData = await systemRes.json();

        if (systemData.success) {
          setSystemStatus(systemData);
        }
      } catch (systemErr) {
        console.error("Errore stato sistema", systemErr);
        setSystemStatus(null);
      }

      // PATCH_64_2_SAFE_WEBAPP_ANALYTICS_ADMIN_LOAD
      await loadWebAppAnalytics({ silent: false });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function daysToExpiry(dateString) {
    if (!dateString) return 99999;

    const expiry = new Date(dateString);

    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  }

  function getWarrantyClass(dateString) {
    const days = daysToExpiry(dateString);

    if (days < 0) return "badge badge-red";
    if (days <= 30) return "badge badge-orange";
    if (days <= 90) return "badge badge-yellow";

    return "badge badge-green";
  }

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("it-IT");
  }

  function calculateWarrantyExpiry(startDate, years = 2) {
    if (!startDate) {
      return "";
    }

    const date = new Date(`${startDate}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const originalMonth = date.getMonth();
    date.setFullYear(date.getFullYear() + years);

    if (date.getMonth() !== originalMonth) {
      date.setDate(0);
    }

    return date.toISOString().slice(0, 10);
  }

  function updateNewCustomerWarrantyStart(startDate) {
    setNewCustomerDeviceForm((current) => ({
      ...current,
      data_acquisto: startDate,
      scadenza_garanzia: calculateWarrantyExpiry(startDate),
    }));
  }

  function updateDeviceWarrantyStart(startDate) {
    setDeviceForm((current) => ({
      ...current,
      data_acquisto: startDate,
      scadenza_garanzia: calculateWarrantyExpiry(startDate),
    }));
  }

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
    return "";
  }
  function getDeviceCategoryLabel(category) {
    const normalized = normalizeDeviceCategory(category);

    if (normalized === "notebook") return "Notebook";
    if (normalized === "desktop") return "Desktop / PC";
    if (normalized === "smartphone") return "Smartphone";

    return "Dispositivo";
  }

  const expiring30 = useMemo(
    () => devices.filter((d) => {
      const days = daysToExpiry(d.scadenza_garanzia);
      return days >= 0 && days <= 30;
    }).length,
    [devices]
  );

  const expiring60 = useMemo(
    () => devices.filter((d) => {
      const days = daysToExpiry(d.scadenza_garanzia);
      return days >= 0 && days <= 60;
    }).length,
    [devices]
  );

  const expiring90 = useMemo(
    () => devices.filter((d) => {
      const days = daysToExpiry(d.scadenza_garanzia);
      return days >= 0 && days <= 90;
    }).length,
    [devices]
  );

  const expiringDevices = useMemo(
    () => devices
      .filter((d) => {
        const days = daysToExpiry(d.scadenza_garanzia);
        return days >= 0 && days <= 90;
      })
      .sort((a, b) => daysToExpiry(a.scadenza_garanzia) - daysToExpiry(b.scadenza_garanzia)),
    [devices]
  );

  const filteredUsers = useMemo(() => {
    const s = userSearch.toLowerCase().trim();

    if (!s) return users;

    return users.filter((u) =>
      u.customer_code?.toLowerCase().includes(s) ||
      u.nome?.toLowerCase().includes(s) ||
      u.cognome?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.telefono?.toLowerCase().includes(s)
    );
  }, [users, userSearch]);

  const filteredDevices = useMemo(() => {
    const s = deviceSearch.toLowerCase().trim();

    if (!s) return devices;

    return devices.filter((d) =>
      d.nome?.toLowerCase().includes(s) ||
      d.cognome?.toLowerCase().includes(s) ||
      d.marca?.toLowerCase().includes(s) ||
      d.modello?.toLowerCase().includes(s) ||
      d.customer_code?.toLowerCase().includes(s)
    );
  }, [devices, deviceSearch]);

  const filteredOffers = useMemo(() => {
    const s = offerSearch.toLowerCase().trim();

    if (!s) return offers;

    return offers.filter((offer) =>
      offer.titolo?.toLowerCase().includes(s) ||
      offer.categoria?.toLowerCase().includes(s) ||
      offer.partner?.toLowerCase().includes(s)
    );
  }, [offers, offerSearch]);

  const editingDevice = useMemo(() => {
    if (!editingDeviceId) {
      return null;
    }

    return devices.find((device) => device.id === editingDeviceId) || null;
  }, [devices, editingDeviceId]);

  async function saveUser(e) {
    e.preventDefault();

    try {
      const isEdit = editingUserId !== null;

      if (!userForm.privacy_consent) {
        alert("Per salvare il cliente devi registrare il consenso privacy.");
        return;
      }

      if (!isEdit) {
        if (
          !newCustomerDeviceForm.marca ||
          !newCustomerDeviceForm.modello ||
          !newCustomerDeviceForm.categoria
        ) {
          alert("Per creare un nuovo cliente devi inserire anche categoria, marca e modello del dispositivo.");
          return;
        }
      }

      const res = await apiFetch(
        isEdit
          ? `${API_URL}/api/users/${editingUserId}`
          : `${API_URL}/api/users`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userForm),
        }
      );

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore salvataggio cliente");
        return;
      }

      let createdDevice = null;

      if (!isEdit) {
        const createdUser = data.user;

        if (createdUser?.id) {
          const devicePayload = {
            ...newCustomerDeviceForm,
            user_id: createdUser.id,
          };

          const deviceRes = await apiFetch(`${API_URL}/api/devices`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(devicePayload),
          });

          const deviceData = await deviceRes.json();

          if (!deviceData.success) {
            alert(
              "Cliente creato, ma il dispositivo non è stato salvato: " +
              (deviceData.error || "errore dispositivo")
            );
            await loadData();
            return;
          }

          createdDevice = deviceData.device;
        }

        setEditingUserId(null);
        setUserForm(EMPTY_USER_FORM);
        setNewCustomerDeviceForm(EMPTY_DEVICE_FORM);
        setCustomerDeviceMode("list");

        const shouldOpenQr = newCustomerReceiptQrAfterSave && createdDevice?.id;
        setNewCustomerReceiptQrAfterSave(false);

        await loadData();

        if (shouldOpenQr) {
          await createReceiptUploadQr(createdDevice);
          return;
        }

        if (createdUser?.app_token) {
          const appUrl = getCustomerAppUrl(createdUser);
          alert(
            `Cliente e dispositivo creati.\n\nLink WebApp:\n${appUrl}\n\nUsa Copia msg, WhatsApp o QR nella tabella clienti.`
          );
        } else {
          alert("Cliente e dispositivo creati.");
        }
      } else {
        alert("Cliente aggiornato");

        setEditingUserId(null);
        setUserForm(EMPTY_USER_FORM);
        setCustomerDeviceMode("list");

        await loadData();
      }
    } catch (err) {
      alert(err.message);
    }
  }

  function editUser(user) {
    setEditingUserId(user.id);
    setUserForm({
      nome: user.nome || "",
      cognome: user.cognome || "",
      email: user.email || "",
      telefono: user.telefono || "",
      privacy_consent: Boolean(user.privacy_consent),
      marketing_consent: Boolean(user.marketing_consent),
      whatsapp_consent: Boolean(user.whatsapp_consent),
      consent_note: user.consent_note || "",
      broadcast_opt_out: Boolean(user.broadcast_opt_out),
    });

    setDeviceReceiptQrAfterSave(false);
    setCustomerDeviceMode("new");
    setExpandedCustomerId(user.id);
    setActiveSection("customers");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startAddDeviceForCustomer(user) {
    setEditingDeviceId(null);
    setDeviceForm({
      ...EMPTY_DEVICE_FORM,
      user_id: user.id,
    });
    setCustomerDeviceMode("device");
    setExpandedCustomerId(user.id);
    setActiveSection("customers");
    setTimeout(() => {
      const el = document.getElementById("existing-device-form");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
  }

  async function deleteUser(id) {
    if (!confirm("Sei sicuro di voler eliminare il cliente?")) {
      return;
    }

    try {
      const res = await apiFetch(`${API_URL}/api/users/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore eliminazione cliente");
        return;
      }

      alert("Cliente eliminato");
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function saveDevice(e) {
    e.preventDefault();

    try {
      const isEdit = editingDeviceId !== null;

      if (!isEdit && !deviceForm.user_id) {
        alert("Seleziona un cliente");
        return;
      }

      const res = await apiFetch(
        isEdit
          ? `${API_URL}/api/devices/${editingDeviceId}`
          : `${API_URL}/api/devices`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(deviceForm),
        }
      );

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore salvataggio dispositivo");
        return;
      }

      const savedDevice = data.device;
      const shouldOpenQr = !isEdit && deviceReceiptQrAfterSave && savedDevice?.id;

      setEditingDeviceId(null);
      setDeviceForm(EMPTY_DEVICE_FORM);
      setDeviceReceiptQrAfterSave(false);
      setCustomerDeviceMode("list");

      await loadData();

      if (shouldOpenQr) {
        await createReceiptUploadQr(savedDevice);
        return;
      }

      alert(isEdit ? "Dispositivo aggiornato" : "Dispositivo creato");
    } catch (err) {
      alert(err.message);
    }
  }

  function editDevice(device) {
    setEditingDeviceId(device.id);
    setDeviceForm({
      user_id: device.user_id || "",
      marca: device.marca || "",
      modello: device.modello || "",
      categoria: device.categoria || "",
      data_acquisto: device.data_acquisto ? device.data_acquisto.substring(0, 10) : "",
      scadenza_garanzia: device.scadenza_garanzia ? device.scadenza_garanzia.substring(0, 10) : "",
      note: device.note || "",
    });

    setDeviceReceiptQrAfterSave(false);
    setCustomerDeviceMode("device");
    setExpandedCustomerId(device.user_id || null);
    setActiveSection("customers");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteDevice(id) {
    if (!confirm("Sei sicuro di voler eliminare il dispositivo?")) {
      return;
    }

    try {
      const res = await apiFetch(`${API_URL}/api/devices/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore eliminazione dispositivo");
        return;
      }

      alert("Dispositivo eliminato");
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function getOfferCategoryLabel(value) {
    return OFFER_CATEGORIES.find((item) => item.value === value)?.label || value || "-";
  }

  function getOfferPartnerLabel(value) {
    return OFFER_PARTNERS.find((item) => item.value === value)?.label || value || "-";
  }

  function normalizeOfferPayload(payload) {
    return {
      categoria: (payload.categoria || "accessori").trim(),
      partner: (payload.partner || "amazon").trim(),
      titolo: (payload.titolo || "").trim(),
      descrizione: (payload.descrizione || "").trim(),
      affiliate_url: (payload.affiliate_url || "").trim(),
      image_url: (payload.image_url || "").trim(),
    };
  }

  function validateOfferPayload(payload) {
    if (!payload.titolo) {
      return "Inserisci il titolo dell'offerta";
    }

    if (!payload.affiliate_url) {
      return "Inserisci il link affiliato";
    }

    if (!/^https?:\/\//i.test(payload.affiliate_url)) {
      return "Il link affiliato deve iniziare con http:// oppure https://";
    }

    if (payload.image_url && !/^https?:\/\//i.test(payload.image_url)) {
      return "L'URL immagine deve iniziare con http:// oppure https://";
    }

    return "";
  }

  function openOfferLink(offer) {
    const url = offer?.affiliate_url || offerForm.affiliate_url;

    if (!url) {
      alert("Link offerta non disponibile");
      return;
    }

    window.open(url, "_blank");
  }

  async function copyOfferLink(offer) {
    const url = offer?.affiliate_url || offerForm.affiliate_url;

    if (!url) {
      alert("Link offerta non disponibile");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      alert("Link offerta copiato");
    } catch (err) {
      prompt("Copia link offerta", url);
    }
  }

  function fillOfferTemplate(type) {
    if (type === "cover") {
      setOfferForm({
        ...offerForm,
        categoria: "accessori",
        partner: offerForm.partner || "amazon",
        titolo: offerForm.titolo || "Cover protettiva consigliata",
        descrizione: offerForm.descrizione || "Protegge il dispositivo da urti, graffi e cadute accidentali.",
      });
      return;
    }

    if (type === "vetro") {
      setOfferForm({
        ...offerForm,
        categoria: "accessori",
        partner: offerForm.partner || "amazon",
        titolo: offerForm.titolo || "Vetro temperato consigliato",
        descrizione: offerForm.descrizione || "Protezione schermo resistente e trasparente per uso quotidiano.",
      });
      return;
    }

    if (type === "caricatore") {
      setOfferForm({
        ...offerForm,
        categoria: "accessori",
        partner: offerForm.partner || "amazon",
        titolo: offerForm.titolo || "Caricatore rapido consigliato",
        descrizione: offerForm.descrizione || "Accessorio utile per ricarica veloce e sicura del dispositivo.",
      });
    }
  }

  async function saveOffer(e) {
    e.preventDefault();

    try {
      const isEdit = editingOfferId !== null;
      const payload = normalizeOfferPayload(offerForm);
      const validationError = validateOfferPayload(payload);

      if (validationError) {
        alert(validationError);
        return;
      }

      const res = await apiFetch(
        isEdit
          ? `${API_URL}/api/offers/${editingOfferId}`
          : `${API_URL}/api/offers`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore salvataggio offerta");
        return;
      }

      alert(isEdit ? "Offerta aggiornata" : "Offerta creata");

      setEditingOfferId(null);
      setOfferForm(EMPTY_OFFER_FORM);

      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function editOffer(offer) {
    setEditingOfferId(offer.id);
    setOfferForm({
      categoria: offer.categoria || "",
      partner: offer.partner || "amazon",
      titolo: offer.titolo || "",
      descrizione: offer.descrizione || "",
      affiliate_url: offer.affiliate_url || "",
      image_url: offer.image_url || "",
    });

    setActiveSection("offers");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteOffer(id) {
    if (!confirm("Sei sicuro di voler eliminare l'offerta?")) {
      return;
    }

    try {
      const res = await apiFetch(`${API_URL}/api/offers/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore eliminazione offerta");
        return;
      }

      alert("Offerta eliminata");
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function getGuideCategoryLabel(value) {
    return GUIDE_CATEGORIES.find((item) => item.value === value)?.label || value || "-";
  }

  const filteredGuides = guides.filter((guide) => {
    const query = guideSearch.toLowerCase().trim();

    if (!query) return true;

    return [
      guide.title,
      guide.description,
      guide.categoria,
      guide.icon,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });

  function normalizeGuidePayload(payload) {
    return {
      icon: String(payload.icon || "").trim(),
      title: String(payload.title || "").trim(),
      description: String(payload.description || "").trim(),
      categoria: String(payload.categoria || "generale").trim(),
      sort_order: Number.parseInt(payload.sort_order || 0, 10) || 0,
      enabled: Boolean(payload.enabled),
    };
  }

  function validateGuidePayload(payload) {
    if (!payload.title) return "Titolo guida obbligatorio";
    if (!payload.description) return "Descrizione guida obbligatoria";

    return "";
  }

  async function saveGuide(e) {
    e.preventDefault();

    try {
      const isEdit = editingGuideId !== null;
      const payload = normalizeGuidePayload(guideForm);
      const validationError = validateGuidePayload(payload);

      if (validationError) {
        alert(validationError);
        return;
      }

      const res = await apiFetch(
        isEdit
          ? `${API_URL}/api/webapp-guides/${editingGuideId}`
          : `${API_URL}/api/webapp-guides`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore salvataggio guida");
        return;
      }

      alert(isEdit ? "Guida aggiornata" : "Guida creata");

      setEditingGuideId(null);
      setGuideForm(EMPTY_GUIDE_FORM);

      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function editGuide(guide) {
    setEditingGuideId(guide.id);
    setGuideForm({
      icon: guide.icon || "",
      title: guide.title || "",
      description: guide.description || "",
      categoria: guide.categoria || "generale",
      sort_order: Number(guide.sort_order || 0),
      enabled: Boolean(guide.enabled),
    });

    setActiveSection("guides");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetGuideForm() {
    setEditingGuideId(null);
    setGuideForm(EMPTY_GUIDE_FORM);
  }

  async function deleteGuide(id) {
    if (!confirm("Sei sicuro di voler eliminare questa guida?")) {
      return;
    }

    try {
      const res = await apiFetch(`${API_URL}/api/webapp-guides/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore eliminazione guida");
        return;
      }

      alert("Guida eliminata");
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function normalizeAmazonItem(item) {
    if (!item) {
      return null;
    }

    const title =
      item.titolo ||
      item.title ||
      item.itemInfo?.title?.displayValue ||
      item.ItemInfo?.Title?.DisplayValue ||
      "";

    const affiliateUrl =
      item.affiliate_url ||
      item.detailPageURL ||
      item.DetailPageURL ||
      "";

    const imageUrl =
      item.image_url ||
      item.images?.primary?.medium?.url ||
      item.Images?.Primary?.Medium?.URL ||
      "";

    const asin =
      item.asin ||
      item.ASIN ||
      affiliateUrl ||
      title;

    if (!title && !affiliateUrl) {
      return null;
    }

    return {
      asin,
      titolo: title || "Prodotto Amazon",
      descrizione: title || "Prodotto Amazon",
      affiliate_url: affiliateUrl,
      image_url: imageUrl,
      raw: item,
    };
  }

  function extractAmazonItems(data) {
    const items =
      data?.SearchResult?.Items ||
      data?.searchResult?.items ||
      data?.items ||
      data?.results ||
      [];

    return items
      .map(normalizeAmazonItem)
      .filter((item) => item && item.affiliate_url);
  }

  function getAmazonImportKey(item, index = "") {
    const normalized = normalizeAmazonItem(item);

    return normalized?.asin || normalized?.affiliate_url || normalized?.titolo || String(index);
  }

  function getAmazonImportCategory(item, index = "") {
    const key = getAmazonImportKey(item, index);

    return amazonImportCategories[key] || offerForm.categoria || "accessori";
  }

  async function searchAmazon() {
    const query = amazonSearch.trim();

    if (!query) {
      alert("Inserisci una ricerca");
      return;
    }

    try {
      setAmazonResults([]);
      setAmazonImportCategories({});
      setAmazonSearchMessage("Ricerca in corso...");

      const res = await apiFetch(
        `${API_URL}/api/amazon/search?q=${encodeURIComponent(query)}`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Errore ricerca Amazon");
      }

      const items = extractAmazonItems(data);

      if (items.length === 0) {
        setAmazonSearchMessage("Nessun risultato automatico trovato. Puoi comunque creare l'offerta manualmente nel modulo a sinistra.");
        return;
      }

      setAmazonResults(items);

      const defaultCategory = offerForm.categoria || "accessori";
      setAmazonImportCategories(
        Object.fromEntries(
          items.map((item, index) => [getAmazonImportKey(item, index), defaultCategory])
        )
      );

      setAmazonSearchMessage(`${items.length} prodotti trovati. Scegli la categoria prima di importare.`);
    } catch (err) {
      setAmazonResults([]);
      setAmazonSearchMessage(`Ricerca non disponibile: ${err.message}`);
    }
  }

  async function importAmazonProduct(item, selectedCategory = "accessori") {
    const normalized = normalizeAmazonItem(item);
    const importCategory = selectedCategory || "accessori";

    if (!normalized?.affiliate_url) {
      alert("Prodotto non importabile: link affiliato mancante");
      return;
    }

    try {
      const offer = {
        categoria: importCategory,
        partner: "amazon",
        titolo: normalized.titolo,
        descrizione: normalized.descrizione,
        affiliate_url: normalized.affiliate_url,
        image_url: normalized.image_url,
      };

      const res = await apiFetch(`${API_URL}/api/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(offer),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore importazione");
        return;
      }

      alert(`Prodotto importato in categoria: ${getOfferCategoryLabel(importCategory)}`);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }


  function getLiveServiceLabel(status) {
    if (status === "ok") return "OK";
    if (status === "warning") return "Attenzione";
    if (status === "ko") return "KO";

    return "Non rilevato";
  }

  function getLiveServiceBadge(status) {
    if (status === "ok") return "badge badge-green";
    if (status === "warning") return "badge badge-yellow";
    if (status === "ko") return "badge badge-red";

    return "badge badge-blue";
  }

  function formatLiveAge(seconds) {
    if (seconds === null || seconds === undefined) return "-";

    if (seconds < 60) {
      return `${seconds}s fa`;
    }

    const minutes = Math.round(seconds / 60);

    if (minutes < 60) {
      return `${minutes} min fa`;
    }

    const hours = Math.round(minutes / 60);

    return `${hours} ore fa`;
  }

  function getLiveStatusLabel(status) {
    if (status === "published") return "Pubblicata";
    if (status === "hidden") return "Nascosta";
    if (status === "expired") return "Scaduta";
    if (status === "rejected") return "Scartata";

    return status || "-";
  }

  function formatLiveDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function saveLiveSettings(e) {
    e.preventDefault();

    try {
      const payload = {
        enabled: Boolean(liveSettings.enabled),
        telegram_auto_import_enabled: Boolean(liveSettings.telegram_auto_import_enabled),
        amazon_tag: String(liveSettings.amazon_tag || "").trim(),
        ttl_hours: Number(liveSettings.ttl_hours || 24),
        max_visible: Number(liveSettings.max_visible || 20),
      };

      const res = await apiFetch(`${API_URL}/api/live-offers/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore salvataggio impostazioni live");
        return;
      }

      setLiveSettings({ ...EMPTY_LIVE_SETTINGS, ...(data.settings || {}) });
      setLiveMessage("Impostazioni Offerte Live salvate");
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function addLiveSource(e) {
    e.preventDefault();

    try {
      if (!liveSourceForm.channel_ref.trim()) {
        alert("Inserisci il canale Telegram, esempio @nomecanale");
        return;
      }

      const res = await apiFetch(`${API_URL}/api/live-offers/sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(liveSourceForm),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore salvataggio canale");
        return;
      }

      setLiveSourceForm(EMPTY_LIVE_SOURCE_FORM);
      setLiveMessage("Canale Telegram salvato");
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function toggleLiveSource(source) {
    try {
      const res = await apiFetch(`${API_URL}/api/live-offers/sources/${source.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: !source.enabled }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore aggiornamento canale");
        return;
      }

      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteLiveSource(id) {
    if (!confirm("Eliminare questo canale Telegram dalle fonti live?")) {
      return;
    }

    try {
      const res = await apiFetch(`${API_URL}/api/live-offers/sources/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore eliminazione canale");
        return;
      }

      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function importLiveText(e) {
    e.preventDefault();

    try {
      if (!liveImportText.trim()) {
        alert("Incolla un messaggio Telegram o un link Amazon da testare");
        return;
      }

      const res = await apiFetch(`${API_URL}/api/live-offers/import-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: liveImportText,
          source_channel: "manual-test",
        }),
      });

      const data = await res.json();

      if (!data.success && !data.duplicate) {
        alert(data.reason || data.error || "Import test non riuscito");
        return;
      }

      setLiveImportText("");
      setLiveMessage(data.duplicate ? "Offerta già presente: aggiornata vista" : "Offerta live importata");
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function updateLiveOfferStatus(offer, status) {
    try {
      const res = await apiFetch(`${API_URL}/api/live-offers/${offer.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore aggiornamento offerta live");
        return;
      }

      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function openNewCustomerForm() {
    setEditingUserId(null);
    setEditingDeviceId(null);
    setUserForm(EMPTY_USER_FORM);
    setNewCustomerDeviceForm(EMPTY_DEVICE_FORM);
    setDeviceForm(EMPTY_DEVICE_FORM);
    setCustomerDeviceMode("new");
    setExpandedCustomerId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeCustomerForms() {
    setEditingUserId(null);
    setEditingDeviceId(null);
    setUserForm(EMPTY_USER_FORM);
    setNewCustomerDeviceForm(EMPTY_DEVICE_FORM);
    setDeviceForm(EMPTY_DEVICE_FORM);
    setCustomerDeviceMode("list");
    setNewCustomerReceiptQrAfterSave(false);
    setDeviceReceiptQrAfterSave(false);
  }

  function toggleCustomerDetails(userId) {
    setExpandedCustomerId((current) => current === userId ? null : userId);
  }

  function getCustomerDevices(user) {
    return devices.filter((device) => device.user_id === user.id);
  }

  async function toggleBroadcastOptOut(user) {
    const nextValue = !user.broadcast_opt_out;
    const label = nextValue
      ? "escludere dai broadcast"
      : "includere di nuovo nei broadcast";

    if (!confirm(`Vuoi ${label} ${user.nome || ""} ${user.cognome || ""}?`)) {
      return;
    }

    try {
      const res = await apiFetch(`${API_URL}/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: user.nome || "",
          cognome: user.cognome || "",
          email: user.email || "",
          telefono: user.telefono || "",
          privacy_consent: Boolean(user.privacy_consent),
          marketing_consent: Boolean(user.marketing_consent),
          whatsapp_consent: !nextValue,
          consent_note: user.consent_note || "",
          broadcast_opt_out: nextValue,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore aggiornamento cliente");
        return;
      }

      await loadData();
      alert(nextValue ? "Cliente escluso dai broadcast" : "Cliente reincluso nei broadcast");
    } catch (err) {
      alert(err.message);
    }
  }

  async function updateCustomerConsents(user, changes, successMessage) {
    if (!user?.id) return;

    const nextPrivacyConsent =
      changes.privacy_consent !== undefined
        ? Boolean(changes.privacy_consent)
        : Boolean(user.privacy_consent);

    if (!nextPrivacyConsent) {
      alert("Il consenso privacy è obbligatorio per mantenere il cliente attivo. Per una revoca privacy completa serve una procedura separata di eliminazione/anomizzazione cliente.");
      return;
    }

    const nextMarketingConsent =
      changes.marketing_consent !== undefined
        ? Boolean(changes.marketing_consent)
        : Boolean(user.marketing_consent);

    const nextWhatsAppConsent =
      changes.whatsapp_consent !== undefined
        ? Boolean(changes.whatsapp_consent)
        : Boolean(user.whatsapp_consent);

    const nextBroadcastOptOut =
      changes.broadcast_opt_out !== undefined
        ? Boolean(changes.broadcast_opt_out)
        : !nextWhatsAppConsent;

    try {
      const res = await apiFetch(`${API_URL}/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: user.nome || "",
          cognome: user.cognome || "",
          email: user.email || "",
          telefono: user.telefono || "",
          privacy_consent: nextPrivacyConsent,
          marketing_consent: nextMarketingConsent,
          whatsapp_consent: nextWhatsAppConsent,
          consent_note: user.consent_note || "",
          broadcast_opt_out: nextBroadcastOptOut,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore aggiornamento consensi");
        return;
      }

      await loadData();

      if (successMessage) {
        alert(successMessage);
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function revokeOptionalConsents(user) {
    if (!confirm(`Vuoi revocare marketing/offerte e WhatsApp per ${user.nome || ""} ${user.cognome || ""}?`)) {
      return;
    }

    await updateCustomerConsents(
      user,
      {
        marketing_consent: false,
        whatsapp_consent: false,
        broadcast_opt_out: true,
      },
      "Consensi opzionali revocati"
    );
  }

  function getBroadcastCustomers() {
    return users.filter((user) =>
      getWhatsAppPhone(user) &&
      Boolean(user.whatsapp_consent) &&
      !user.broadcast_opt_out
    );
  }

  function openBroadcastModal() {
    setBroadcastMessage("Ciao, abbiamo aggiornato le offerte consigliate nella tua WebApp Smart Assistance. Aprila per vedere i prodotti selezionati per te.");
    setBroadcastIndex(0);
    setBroadcastResult(null);
    setBroadcastModalOpen(true);
  }

  function closeBroadcastModal() {
    setBroadcastModalOpen(false);
    setBroadcastMessage("");
    setBroadcastIndex(0);
    setBroadcastSending(false);
    setBroadcastResult(null);
  }

  async function copyBroadcastMessage() {
    if (!broadcastMessage.trim()) {
      alert("Messaggio vuoto");
      return;
    }

    try {
      await navigator.clipboard.writeText(broadcastMessage.trim());
      alert("Messaggio copiato");
    } catch (err) {
      prompt("Copia messaggio", broadcastMessage.trim());
    }
  }

  function openBroadcastWhatsApp(user) {
    const phone = getWhatsAppPhone(user);

    if (!phone) {
      alert("Telefono cliente non disponibile");
      return;
    }

    if (!broadcastMessage.trim()) {
      alert("Scrivi un messaggio prima di inviare");
      return;
    }

    const customers = getBroadcastCustomers();
    const currentIndex = customers.findIndex((item) => item.id === user.id);

    if (currentIndex >= 0) {
      setBroadcastIndex(Math.min(currentIndex + 1, customers.length));
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(broadcastMessage.trim())}`, "_blank");
  }

  async function sendAutomaticBroadcast() {
    const customers = getBroadcastCustomers();

    if (customers.length === 0) {
      alert("Nessun cliente con telefono valido");
      return;
    }

    if (!broadcastMessage.trim()) {
      alert("Scrivi un messaggio prima di inviare");
      return;
    }

    const confirmed = confirm(
      `Inviare il messaggio via WhatsApp a ${customers.length} clienti?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setBroadcastSending(true);
      setBroadcastResult(null);

      const res = await apiFetch(`${API_URL}/api/broadcast/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: broadcastMessage.trim(),
          customer_ids: customers.map((user) => user.id)
        })
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore broadcast WhatsApp");
        setBroadcastResult(data);
        return;
      }

      setBroadcastResult(data);
      await loadData();
      alert(`Broadcast completato. Inviati: ${data.sent_count}. Errori: ${data.failed_count}.`);
    } catch (err) {
      setBroadcastResult({
        success: false,
        error: err.message
      });
      alert(err.message);
    } finally {
      setBroadcastSending(false);
    }
  }

  function openNextBroadcastWhatsApp() {
    const customers = getBroadcastCustomers();

    if (customers.length === 0) {
      alert("Nessun cliente con telefono valido");
      return;
    }

    if (broadcastIndex >= customers.length) {
      alert("Hai già aperto WhatsApp per tutti i clienti in lista.");
      return;
    }

    openBroadcastWhatsApp(customers[broadcastIndex]);
  }

  function getCustomerAppUrl(user) {
    if (!user?.app_token) {
      return "";
    }

    if (typeof window === "undefined") {
      return `/app/${user.app_token}`;
    }

    return `${window.location.origin}/app/${user.app_token}`;
  }

  async function copyCustomerAppUrl(user) {
    const url = getCustomerAppUrl(user);

    if (!url) {
      alert("Token WebApp non disponibile per questo cliente");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      alert("Link WebApp copiato");
    } catch (err) {
      prompt("Copia il link WebApp", url);
    }
  }


  
  // PATCH_81_PRODUCTION_SOFT_LOADER
  async function loadProductionSoftSummary(user, options = {}) {
    if (!user?.id) {
      return;
    }

    const key = String(user.id);

    if (!options.force && productionSoftByUser[key]?.success) {
      return;
    }

    setProductionSoftLoadingByUser((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await apiFetch(`${API_URL}/api/users/${user.id}/production-soft`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setProductionSoftByUser((prev) => ({
          ...prev,
          [key]: {
            success: false,
            error: data.error || "Dati produzione cliente non disponibili"
          }
        }));
        return;
      }

      setProductionSoftByUser((prev) => ({
        ...prev,
        [key]: data
      }));
    } catch (err) {
      console.error("Errore produzione soft cliente", err);
      setProductionSoftByUser((prev) => ({
        ...prev,
        [key]: {
          success: false,
          error: "Errore caricamento dati WebApp cliente"
        }
      }));
    } finally {
      setProductionSoftLoadingByUser((prev) => ({ ...prev, [key]: false }));
    }
  }
// PATCH_61_PRIVACY_EXPORT_FRONTEND
  async function exportCustomerPrivacy(user) {
    if (!user?.id) {
      alert("Cliente non disponibile");
      return;
    }

    try {
      const res = await apiFetch(`${API_URL}/api/users/${user.id}/privacy-export`);
      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore esportazione privacy");
        return;
      }

      const exportPayload = data.export || data;
      const safeCode = String(user.customer_code || user.id || "cliente")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .slice(0, 80);
      const datePart = new Date().toISOString().slice(0, 10);
      const fileName = `smart-assistance-privacy-${safeCode}-${datePart}.json`;
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      alert("Esportazione privacy generata");
    } catch (err) {
      alert(err.message);
    }
  }
  function openCustomerApp(user) {
    const url = getCustomerAppUrl(user);

    if (!url) {
      alert("Token WebApp non disponibile per questo cliente");
      return;
    }

    window.open(url, "_blank");
  }

  function getCustomerPhone(user) {
    const raw = (user?.telefono || "").replace(/\D/g, "");

    if (raw.startsWith("0039")) {
      return raw.substring(4);
    }

    if (raw.startsWith("39")) {
      return raw.substring(2);
    }

    return raw;
  }

  function getWhatsAppPhone(user) {
    const phone = getCustomerPhone(user);

    if (!phone) {
      return "";
    }

    return `39${phone}`;
  }

  function getCustomerOnboardingMessage(user) {
    const url = getCustomerAppUrl(user);
    const nome = user?.nome || "cliente";

    return (
      `Ciao ${nome}, ecco il link della tua WebApp Smart Assistance:\n\n` +
      `${url}\n\n` +
      "Da qui puoi vedere garanzia, assistenza e accessori consigliati per il tuo dispositivo."
    );
  }

  function getWhatsAppTemplate(type, user) {
    const nome = user?.nome || "cliente";
    const appUrl = getCustomerAppUrl(user);

    if (type === "promo") {
      return `Ciao ${nome}, abbiamo aggiornato le offerte consigliate nella tua WebApp Smart Assistance. Puoi vederle qui:\n\n${appUrl}`;
    }

    if (type === "assistenza") {
      return `Ciao ${nome}, ti scriviamo da Smart Assistance. Se hai bisogno di supporto per il tuo dispositivo puoi rispondere direttamente a questo messaggio.`;
    }

    if (type === "scontrino") {
      return `Ciao ${nome}, abbiamo caricato lo scontrino del tuo acquisto nella tua WebApp Smart Assistance. Lo trovi nella sezione del tuo dispositivo:\n\n${appUrl}`;
    }

    return getCustomerOnboardingMessage(user);
  }

  async function copyCustomerOnboardingMessage(user) {
    const message = getCustomerOnboardingMessage(user);

    try {
      await navigator.clipboard.writeText(message);
      alert("Messaggio cliente copiato");
    } catch (err) {
      prompt("Copia il messaggio cliente", message);
    }
  }

  function openCustomerWhatsApp(user) {
    if (!user.whatsapp_consent || user.broadcast_opt_out) {
      alert("WhatsApp non consentito per questo cliente. Attiva prima il consenso WhatsApp.");
      return;
    }
    const phone = getWhatsAppPhone(user);
    const message = encodeURIComponent(getCustomerOnboardingMessage(user));

    if (!phone) {
      alert("Telefono cliente non disponibile");
      return;
    }

    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  }

  function openCustomWhatsAppModal(user) {
    if (!user.whatsapp_consent || user.broadcast_opt_out) {
      alert("WhatsApp non consentito per questo cliente. Attiva prima il consenso WhatsApp.");
      return;
    }
    const phone = getWhatsAppPhone(user);

    if (!phone) {
      alert("Telefono cliente non disponibile");
      return;
    }

    setWhatsAppModalUser(user);
    setWhatsAppMessage("");
  }

  function sendCustomWhatsApp() {
    const phone = getWhatsAppPhone(whatsAppModalUser);

    if (!phone) {
      alert("Telefono cliente non disponibile");
      return;
    }

    if (!whatsAppMessage.trim()) {
      alert("Scrivi un messaggio prima di inviare");
      return;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(whatsAppMessage.trim())}`, "_blank");
  }

  async function copyCustomWhatsAppMessage() {
    if (!whatsAppMessage.trim()) {
      alert("Messaggio vuoto");
      return;
    }

    try {
      await navigator.clipboard.writeText(whatsAppMessage.trim());
      alert("Messaggio copiato");
    } catch (err) {
      prompt("Copia il messaggio", whatsAppMessage.trim());
    }
  }

  function getCustomerQrImageUrl(user) {
    const url = getCustomerAppUrl(user);

    if (!url) {
      return "";
    }

    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(url)}`;
  }

  function openCustomerQr(user) {
    const url = getCustomerAppUrl(user);

    if (!url) {
      alert("Token WebApp non disponibile per questo cliente");
      return;
    }

    setQrModalUser(user);
  }

  function closeCustomerQr() {
    setQrModalUser(null);
  }

  function readReceiptFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Impossibile leggere il file"));

      reader.readAsDataURL(file);
    });
  }

  async function uploadDeviceReceipt(device, event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    try {
      if (!allowedTypes.includes(file.type)) {
        alert("Formato non supportato. Usa PDF, JPG, PNG o WEBP.");
        event.target.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("File troppo grande. Limite massimo 5 MB.");
        event.target.value = "";
        return;
      }

      const dataUrl = await readReceiptFileAsDataUrl(file);

      const res = await apiFetch(`${API_URL}/api/devices/${device.id}/receipt`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          mime_type: file.type,
          data_url: dataUrl,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore caricamento scontrino");
        return;
      }

      alert("Scontrino caricato");
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      event.target.value = "";
    }
  }

  async function deleteDeviceReceipt(device) {
    if (!confirm("Vuoi rimuovere lo scontrino da questo dispositivo?")) {
      return;
    }

    try {
      const res = await apiFetch(`${API_URL}/api/devices/${device.id}/receipt`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore rimozione scontrino");
        return;
      }

      alert("Scontrino rimosso");
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function openDeviceReceipt(device) {
    if (!device?.receipt_data_url) {
      alert("Scontrino non disponibile");
      return;
    }

    const win = window.open();

    if (!win) {
      alert("Popup bloccato dal browser");
      return;
    }

    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Scontrino ${device.marca || ""} ${device.modello || ""}</title>
          <meta charset="utf-8" />
          <style>
            body {
              margin: 0;
              background: #111827;
              color: white;
              font-family: Arial, sans-serif;
            }

            iframe, img {
              width: 100vw;
              height: 100vh;
              border: 0;
              object-fit: contain;
              background: #111827;
            }
          </style>
        </head>
        <body>
          ${
            device.receipt_mime_type === "application/pdf"
              ? `<iframe src="${device.receipt_data_url}"></iframe>`
              : `<img src="${device.receipt_data_url}" alt="Scontrino" />`
          }
        </body>
      </html>
    `);

    win.document.close();
  }

  async function createReceiptUploadQr(device) {
    try {
      const res = await apiFetch(`${API_URL}/api/devices/${device.id}/receipt-upload-token`, {
        method: "POST",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore generazione QR upload");
        return;
      }

      const uploadUrl = `${window.location.origin}/receipt-upload/${data.token}`;

      setReceiptUploadModal({
        device,
        uploadUrl,
        expires_at: data.expires_at,
      });
    } catch (err) {
      alert(err.message);
    }
  }

  function getReceiptUploadQrImageUrl(url) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(url)}`;
  }

  async function copyReceiptUploadUrl() {
    if (!receiptUploadModal?.uploadUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(receiptUploadModal.uploadUrl);
      alert("Link upload copiato");
    } catch (err) {
      prompt("Copia link upload", receiptUploadModal.uploadUrl);
    }
  }

  function formatInteger(value) {
    return Number(value || 0).toLocaleString("it-IT");
  }

  function getMaxDailyClicks() {
    return Math.max(
      1,
      ...(clickStats.dailyClicks || []).map((item) => Number(item.clicks || 0))
    );
  }

  function exportClickStatsCsv() {
    const rows = [
      ["tipo", "valore_1", "valore_2", "valore_3"],
      ["click_totali", clickStats.summary?.total_clicks || 0, "", ""],
      ["click_24h", clickStats.summary?.clicks_24h || 0, "", ""],
      ["click_7_giorni", clickStats.summary?.clicks_7d || 0, "", ""],
      ["click_30_giorni", clickStats.summary?.clicks_30d || 0, "", ""],
      ["clienti_unici_7_giorni", clickStats.summary?.unique_customers_7d || 0, "", ""],
      ["prodotti_cliccati", clickStats.summary?.unique_products || 0, "", ""],
      [],
      ["giorno", "click", "", ""],
      ...(clickStats.dailyClicks || []).map((item) => [
        item.label || item.day || "",
        item.clicks || 0,
        "",
        "",
      ]),
      [],
      ["prodotto", "click_totali", "click_7_giorni", "ultimo_click"],
      ...(clickStats.topProducts || []).map((item) => [
        item.titolo || "",
        item.clicks || 0,
        item.clicks_7d || 0,
        item.last_click ? new Date(item.last_click).toLocaleString("it-IT") : "",
      ]),
      [],
      ["fonte", "click_totali", "click_7_giorni", "ultimo_click"],
      ...(clickStats.sourceStats || []).map((item) => [
        item.source || "webapp",
        item.clicks || 0,
        item.clicks_7d || 0,
        item.last_click ? new Date(item.last_click).toLocaleString("it-IT") : "",
      ]),
      [],
      ["cliente", "click_totali", "click_7_giorni", "ultimo_click"],
      ...(clickStats.customerStats || []).map((item) => [
        item.customer_code
          ? `${item.customer_code} - ${item.nome || ""} ${item.cognome || ""}`.trim()
          : "Cliente non disponibile",
        item.clicks || 0,
        item.clicks_7d || 0,
        item.last_click ? new Date(item.last_click).toLocaleString("it-IT") : "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(";")
      )
      .join("\\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `smart-assistance-click-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }


  function getSystemStatusLabel(status) {
    if (status === "ok") return "OK";
    if (status === "warning") return "OK con avvisi";
    if (status === "error") return "ERRORE";
    return "Non testato";
  }

  function getSystemBadgeClass(status) {
    if (status === "ok") return "badge badge-green";
    if (status === "warning") return "badge badge-orange";
    if (status === "error") return "badge badge-red";
    return "badge badge-blue";
  }

  function formatSystemDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function formatFileSize(bytes) {
    const value = Number(bytes || 0);
    if (!value) return "0 MB";
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }

  function getSystemServiceList() {
    const services = systemStatus?.services || {};
    return [
      services.backend || { label: "Backend", status: "unknown", message: "Non verificato" },
      services.postgres || { label: "PostgreSQL", status: "unknown", message: "Non verificato" },
      services.frontend || { label: "Frontend", status: "unknown", message: "Non verificato" },
      services.public || { label: "Dominio pubblico", status: "unknown", message: "Non verificato" },
      services.telegram || { label: "Telegram Live", status: "unknown", message: "Non verificato" },
      services.whatsapp || { label: "WhatsApp", status: "unknown", message: "Non verificato" },
      // PATCH_64_8_SYSTEM_ANALYTICS_FRONTEND_SERVICE
      services.analytics || { label: "Analytics WebApp", status: "unknown", message: "Non verificato" },
      services.backup || { label: "Backup", status: "unknown", message: "Non verificato" },
    ];
  }

  function renderTopbarTitle() {
    const item = NAV_ITEMS.find((nav) => nav.id === activeSection);

    return item?.label || "Dashboard";
  }

  if (!authReady) {
    return (
      <main className="admin-loading">
        Verifica accesso...
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f4f7fb;
          color: #0f172a;
        }

        .admin-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px 1fr;
          font-family: Arial, sans-serif;
          background: #f4f7fb;
        }

        .admin-loading {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: Arial, sans-serif;
          background: #f4f7fb;
          color: #0f172a;
        }

        .sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          background: #0f172a;
          color: #fff;
          padding: 24px 18px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .brand-box {
          display: grid;
          gap: 10px;
          padding: 8px 4px 18px;
          border-bottom: 1px solid rgba(255,255,255,.10);
        }

        .brand-wordmark {
          width: 100%;
          max-width: 218px;
          min-height: 46px;
          border-radius: 18px;
          background: #ffffff;
          padding: 9px 12px;
          object-fit: contain;
          box-shadow: 0 12px 30px rgba(37,99,235,.22);
        }

        .brand-subtitle {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 0;
          padding-left: 4px;
        }

        .nav-list {
          display: grid;
          gap: 8px;
        }

        .nav-button {
          width: 100%;
          border: none;
          background: transparent;
          color: #cbd5e1;
          padding: 13px 14px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 11px;
          cursor: pointer;
          font-weight: 800;
          text-align: left;
          font-size: 15px;
        }

        .nav-button:hover {
          background: rgba(255,255,255,.08);
          color: #fff;
        }

        .nav-button.active {
          background: #2563eb;
          color: #fff;
          box-shadow: 0 12px 30px rgba(37,99,235,.35);
        }

        .sidebar-footer {
          margin-top: auto;
          display: grid;
          gap: 10px;
        }

        .ghost-button,
        .danger-button,
        .primary-button,
        .soft-button,
        .small-button {
          border: none;
          border-radius: 12px;
          padding: 10px 13px;
          cursor: pointer;
          font-weight: 800;
          font-size: 14px;
        }

        .primary-button {
          background: #2563eb;
          color: #fff;
          box-shadow: 0 10px 22px rgba(37,99,235,.22);
        }

        .soft-button {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .ghost-button {
          background: #f8fafc;
          color: #0f172a;
          border: 1px solid #e2e8f0;
        }

        .danger-button {
          background: #fee2e2;
          color: #991b1b;
        }

        .small-button {
          padding: 8px 10px;
          border-radius: 10px;
          background: #f1f5f9;
          color: #0f172a;
        }

        .logout-button {
          width: 100%;
          background: rgba(255,255,255,.08);
          color: #fff;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 14px;
          padding: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .content {
          padding: 26px;
          min-width: 0;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 22px;
        }

        .page-title {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
        }

        .page-subtitle {
          margin-top: 6px;
          color: #64748b;
          font-size: 14px;
        }

        .top-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .kpi-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 12px 28px rgba(15,23,42,.06);
        }

        .kpi-label {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .kpi-value {
          margin-top: 10px;
          font-size: 34px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .section-grid {
          display: grid;
          grid-template-columns: minmax(320px, 420px) 1fr;
          gap: 18px;
          align-items: start;
        }

        .customers-top-panel,
        .customers-list-panel,
        .customer-form-panel {
          width: 100%;
        }

        .customers-topbar {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .customers-search {
          max-width: none;
        }

        .compact-form {
          grid-template-columns: repeat(2, minmax(220px, 1fr));
          align-items: end;
        }

        .compact-form .inline-info-box,
        .compact-form .checkbox-row,
        .compact-form .form-actions,
        .compact-form .form-section-title {
          grid-column: 1 / -1;
        }

        .form-section-title {
          border-top: 1px solid #e2e8f0;
          padding-top: 14px;
          margin-top: 4px;
        }

        .compact-table-wrap table,
        .customers-table {
          min-width: 860px;
        }

        .customer-detail-row td {
          background: #f8fafc;
        }

        .customer-detail-box {
          display: grid;
          grid-template-columns: minmax(260px, .9fr) 1.1fr;
          gap: 18px;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #fff;
        }

        .customer-detail-actions {
          margin-top: 10px;
        }

        .mini-device-list {
          display: grid;
          gap: 8px;
          margin-top: 12px;
        }

        .mini-device-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #fff;
        }

        .mini-device-item span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .panel {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 12px 28px rgba(15,23,42,.06);
          margin-bottom: 18px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .panel-title {
          margin: 0;
          font-size: 20px;
        }

        .panel-subtitle {
          color: #64748b;
          font-size: 13px;
          margin-top: 4px;
        }

        .form-grid {
          display: grid;
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field label {
          color: #475569;
          font-size: 13px;
          font-weight: 800;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 11px 12px;
          font-size: 14px;
          outline: none;
          background: #fff;
          color: #0f172a;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,.12);
        }

        textarea {
          min-height: 82px;
          resize: vertical;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .toolbar {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .search-input {
          max-width: 360px;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          min-width: 760px;
        }

        th {
          text-align: left;
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .04em;
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
          font-size: 14px;
        }

        tr:last-child td {
          border-bottom: none;
        }

        .row-title {
          font-weight: 900;
          color: #0f172a;
        }

        .row-subtitle {
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .action-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .badge-green {
          background: #dcfce7;
          color: #166534;
        }

        .badge-yellow {
          background: #fef9c3;
          color: #854d0e;
        }

        .badge-orange {
          background: #ffedd5;
          color: #9a3412;
        }

        .badge-red {
          background: #fee2e2;
          color: #991b1b;
        }

        .badge-blue {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.2fr .8fr;
          gap: 18px;
        }

        .quick-list {
          display: grid;
          gap: 10px;
        }

        .quick-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 14px;
          padding: 12px;
        }

        .amazon-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 14px;
        }

        .product-card {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 14px;
          background: #fff;
          display: grid;
          gap: 10px;
        }

        .product-card img {
          width: 100%;
          height: 150px;
          object-fit: contain;
          background: #f8fafc;
          border-radius: 14px;
          padding: 8px;
        }

        .qr-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,.62);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 9999;
        }

        .qr-modal {
          width: 100%;
          max-width: 430px;
          background: #fff;
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 24px 70px rgba(0,0,0,.30);
        }

        .qr-image {
          width: 260px;
          max-width: 100%;
          background: #fff;
          padding: 12px;
          border-radius: 20px;
          border: 1px solid #e5e7eb;
        }

        .inline-info-box {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px;
          background: #f8fafc;
          display: grid;
          gap: 10px;
        }

        .checkbox-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.35;
          cursor: pointer;
        }

        .checkbox-row input {
          width: auto;
          margin-top: 2px;
        }

        .mode-tabs {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .mode-button {
          border: 1px solid #dbe4ef;
          border-radius: 16px;
          padding: 13px 14px;
          background: #fff;
          color: #334155;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(15,23,42,.05);
        }

        .mode-button.active {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }

        .mode-help {
          margin: -2px 0 14px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
        }

        .daily-chart {
          display: grid;
          grid-template-columns: repeat(14, minmax(18px, 1fr));
          gap: 8px;
          align-items: end;
          min-height: 190px;
          padding: 18px 4px 4px;
        }

        .daily-bar-wrap {
          display: grid;
          gap: 8px;
          align-items: end;
          text-align: center;
          color: #64748b;
          font-size: 11px;
        }

        .daily-bar {
          width: 100%;
          min-height: 6px;
          border-radius: 999px 999px 6px 6px;
          background: linear-gradient(180deg, #2563eb, #93c5fd);
        }

        .daily-value {
          color: #0f172a;
          font-weight: 900;
          font-size: 12px;
        }

        .mobile-nav {
          display: none;
        }

        @media (max-width: 1100px) {
          .admin-shell {
            grid-template-columns: 1fr;
          }

          .sidebar {
            display: none;
          }

          .content {
            padding: 18px;
            padding-bottom: 92px;
          }

          .mobile-nav {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            position: fixed;
            left: 10px;
            right: 10px;
            bottom: 10px;
            background: rgba(15,23,42,.96);
            border: 1px solid rgba(255,255,255,.10);
            border-radius: 20px;
            padding: 8px;
            z-index: 1000;
            box-shadow: 0 18px 40px rgba(0,0,0,.25);
          }

          .mobile-nav button {
            border: none;
            background: transparent;
            color: #cbd5e1;
            font-size: 11px;
            display: grid;
            gap: 3px;
            cursor: pointer;
          }

          .mobile-nav button.active {
            color: #fff;
            font-weight: 900;
          }

          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .section-grid,
          .dashboard-grid,
          .compact-form,
          .customer-detail-box {
            grid-template-columns: 1fr;
          }

          .mini-device-item {
            align-items: flex-start;
            flex-direction: column;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .top-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 640px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }

          .page-title {
            font-size: 25px;
          }
        }
      `}</style>

      <aside className="sidebar">
        <div className="brand-box">
          <img
            className="brand-wordmark"
            src="/brand/smart-assistance-wordmark-card.png?v=39"
            alt="Smart Assistance"
          />
          <div className="brand-subtitle">Admin Dashboard</div>
        </div>

        <nav className="nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-button ${activeSection === item.id ? "active" : ""}`}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1 className="page-title">{renderTopbarTitle()}</h1>
            <div className="page-subtitle">
              Gestione clienti con dispositivo, offerte affiliate e onboarding WebApp.
            </div>
          </div>

          <div className="top-actions">
            <button type="button" className="ghost-button" onClick={loadData}>
              Aggiorna
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setActiveSection("customers")}
            >
              Nuovo cliente
            </button>
          </div>
        </header>

        {loading && (
          <section className="panel">
            Caricamento dati...
          </section>
        )}

        {!loading && activeSection === "dashboard" && (
          <>
            <section className="kpi-grid">
              <KpiCard label="Clienti" value={users.length} />
              <KpiCard label="Dispositivi" value={devices.length} />
              <KpiCard label="Offerte" value={offers.length} />
              <KpiCard label="Click 24h" value={clickStats.summary?.clicks_24h || 0} />
            </section>

            {/* PATCH_64_2_SAFE_WEBAPP_ANALYTICS_ADMIN_UI */}
            <section className="panel" style={{ marginTop: "18px", marginBottom: "18px" }}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Statistiche WebApp cliente</h2>
                  <div className="panel-subtitle">Utenti online, visite e picchi raccolti dalle aperture della WebApp cliente.</div>
                </div>
                <button type="button" className="ghost-button" onClick={loadData}>Aggiorna</button>
              </div>

              <section className="kpi-grid" style={{ marginTop: "16px" }}>
                <KpiCard label="Online ora" value={formatInteger(webAppAnalytics.summary?.online_now)} />
                <KpiCard label="Attivi 5 min" value={formatInteger(webAppAnalytics.summary?.active_5m)} />
                <KpiCard label="Visite totali" value={formatInteger(webAppAnalytics.summary?.total_visits)} />
                <KpiCard label="Visite oggi" value={formatInteger(webAppAnalytics.summary?.visits_today)} />
                <KpiCard label="Visite 7 giorni" value={formatInteger(webAppAnalytics.summary?.visits_7d)} />
                <KpiCard label="Utenti unici" value={formatInteger(webAppAnalytics.summary?.unique_customers_total)} />
                <KpiCard label="Picco globale" value={formatInteger(webAppAnalytics.summary?.peak_online_global)} />
                <KpiCard label="Picco oggi" value={formatInteger(webAppAnalytics.summary?.peak_online_today)} />
              </section>

              <div className="panel-subtitle" style={{ marginTop: "10px" }}>
                Ultima attivita WebApp: {formatSystemDate(webAppAnalytics.summary?.last_activity_at)}
              </div>

              <div className="table-wrap" style={{ marginTop: "16px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Stato</th>
                      <th>Cliente</th>
                      <th>Pagina</th>
                      <th>Evento</th>
                      <th>Visite sessione</th>
                      <th>Ultima attivita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(webAppAnalytics.recent_sessions || []).length === 0 ? (
                      <tr><td colSpan="6">Nessuna sessione WebApp registrata.</td></tr>
                    ) : (
                      (webAppAnalytics.recent_sessions || []).map((session, index) => (
                        <tr key={(session.session_id || session.customer_id || "session") + "-" + index}>
                          <td><span className={session.online ? "badge badge-green" : "badge badge-blue"}>{session.online ? "Online" : "Offline"}</span></td>
                          <td>{String((session.customer_code || "") + " " + (session.nome || "") + " " + (session.cognome || "")).trim() || "Cliente"}</td>
                          <td>{session.last_page || "-"}</td>
                          <td>{session.last_event || "-"}</td>
                          <td>{formatInteger(session.visits_count)}</td>
                          <td>{formatSystemDate(session.last_seen_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Garanzie in scadenza</h2>
                    <div className="panel-subtitle">
                      Alert rapidi sui dispositivi entro 90 giorni.
                    </div>
                  </div>
                  <span className="badge badge-blue">{expiring90} entro 90gg</span>
                </div>

                <div className="kpi-grid">
                  <KpiCard label="Entro 30gg" value={expiring30} compact />
                  <KpiCard label="Entro 60gg" value={expiring60} compact />
                  <KpiCard label="Entro 90gg" value={expiring90} compact />
                </div>

                <div className="quick-list">
                  {expiringDevices.slice(0, 8).length === 0 ? (
                    <div className="quick-item">
                      Nessuna garanzia in scadenza.
                    </div>
                  ) : (
                    expiringDevices.slice(0, 8).map((device) => (
                      <div key={device.id} className="quick-item">
                        <div>
                          <div className="row-title">
                            {device.nome} {device.cognome}
                          </div>
                          <div className="row-subtitle">
                            {device.marca} {device.modello}
                          </div>
                        </div>
                        <span className={getWarrantyClass(device.scadenza_garanzia)}>
                          {formatDate(device.scadenza_garanzia)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Click offerte</h2>
                    <div className="panel-subtitle">
                      Monitoraggio rapido conversioni.
                    </div>
                  </div>
                </div>

                <section className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <KpiCard label="Totali" value={clickStats.summary?.total_clicks || 0} compact />
                  <KpiCard label="7 giorni" value={clickStats.summary?.clicks_7d || 0} compact />
                </section>

                <div className="quick-list">
                  {(clickStats.topProducts || []).slice(0, 5).length === 0 ? (
                    <div className="quick-item">
                      Nessun click registrato.
                    </div>
                  ) : (
                    clickStats.topProducts.slice(0, 5).map((item, index) => (
                      <div key={item.asin || item.titolo || index} className="quick-item">
                        <div>
                          <div className="row-title">{item.titolo}</div>
                          <div className="row-subtitle">Prodotto cliccato</div>
                        </div>
                        <span className="badge badge-blue">{item.clicks}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {!loading && activeSection === "customers" && (
          <>
            <section className="panel customers-top-panel">
              <div className="customers-topbar">
                <div>
                  <h2 className="panel-title">Clienti registrati</h2>
                  <div className="panel-subtitle">
                    {filteredUsers.length} clienti visualizzati. Lista pulita con dettagli apribili a richiesta.
                  </div>
                </div>

                <div className="action-row">
                  <button type="button" className="primary-button" onClick={openNewCustomerForm}>
                    Nuovo cliente
                  </button>

                  <button type="button" className="soft-button" onClick={openBroadcastModal}>
                    Invio messaggio a tutti i clienti
                  </button>
                </div>
              </div>

              <input
                className="search-input customers-search"
                placeholder="Cerca cliente per nome, telefono o mail..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </section>

            {(customerDeviceMode === "new" || editingUserId) && (
              <section className="panel customer-form-panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      {editingUserId ? "Modifica cliente" : "Nuovo cliente + dispositivo"}
                    </h2>
                    <div className="panel-subtitle">
                      Inserisci i dati essenziali del cliente. Il primo dispositivo è obbligatorio solo per un nuovo cliente.
                    </div>
                  </div>

                  <button type="button" className="ghost-button" onClick={closeCustomerForms}>
                    Chiudi
                  </button>
                </div>

                <form className="form-grid compact-form" onSubmit={saveUser}>
                  <Field label="Nome">
                    <input
                      required
                      value={userForm.nome}
                      onChange={(e) => setUserForm({ ...userForm, nome: e.target.value })}
                    />
                  </Field>

                  <Field label="Cognome">
                    <input
                      required
                      value={userForm.cognome}
                      onChange={(e) => setUserForm({ ...userForm, cognome: e.target.value })}
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                  </Field>

                  <Field label="Telefono">
                    <input
                      value={userForm.telefono}
                      onChange={(e) => setUserForm({ ...userForm, telefono: e.target.value })}
                    />
                  </Field>

                  <div className="form-section-title">
                    <div className="row-title">Privacy e consensi</div>
                    <div className="row-subtitle">
                      Registra solo consensi confermati dal cliente. Il testo legale completo deve restare nella tua informativa.
                      Puoi revocare marketing e WhatsApp dai dettagli cliente o da questo modulo.
                    </div>
                  </div>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(userForm.privacy_consent)}
                      onChange={(e) => setUserForm({ ...userForm, privacy_consent: e.target.checked })}
                    />
                    Privacy obbligatoria: il cliente ha preso visione dell'informativa privacy
                  </label>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(userForm.marketing_consent)}
                      onChange={(e) => setUserForm({ ...userForm, marketing_consent: e.target.checked })}
                    />
                    Marketing/offerte affiliate: mostra offerte nella WebApp cliente
                  </label>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(userForm.whatsapp_consent)}
                      onChange={(e) => setUserForm({
                        ...userForm,
                        whatsapp_consent: e.target.checked,
                        broadcast_opt_out: !e.target.checked,
                      })}
                    />
                    WhatsApp: consenti messaggi e broadcast manuali
                  </label>

                  <Field label="Nota consenso">
                    <textarea
                      placeholder="Esempio: consenso raccolto in negozio durante configurazione WebApp"
                      value={userForm.consent_note || ""}
                      onChange={(e) => setUserForm({ ...userForm, consent_note: e.target.value })}
                    />
                  </Field>

                  {!editingUserId && (
                    <>
                      <div className="form-section-title">
                        <div className="row-title">Primo dispositivo</div>
                        <div className="row-subtitle">Obbligatorio quando registri un nuovo cliente.</div>
                      </div>

                      <Field label="Marca">
                        <select
                          required
                          value={newCustomerDeviceForm.marca}
                          onChange={(e) => setNewCustomerDeviceForm({ ...newCustomerDeviceForm, marca: e.target.value })}
                        >
                          <option value="">Seleziona marca</option>
                          {BRANDS.map((brand) => (
                            <option key={brand} value={brand}>{brand}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Modello">
                        <input
                          required
                          value={newCustomerDeviceForm.modello}
                          onChange={(e) => setNewCustomerDeviceForm({ ...newCustomerDeviceForm, modello: e.target.value })}
                        />
                      </Field>

                      <Field label="Categoria prodotto">
                        <select
                          required
                          value={newCustomerDeviceForm.categoria}
                          onChange={(e) => setNewCustomerDeviceForm({ ...newCustomerDeviceForm, categoria: e.target.value })}
                        >
                          <option value="">Seleziona categoria</option>
                          {PRODUCT_CATEGORIES.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Inizio garanzia / data acquisto">
                        <input
                          type="date"
                          value={newCustomerDeviceForm.data_acquisto}
                          onChange={(e) => updateNewCustomerWarrantyStart(e.target.value)}
                        />
                      </Field>

                      <Field label="Scadenza garanzia">
                        <input
                          type="date"
                          value={newCustomerDeviceForm.scadenza_garanzia}
                          onChange={(e) => setNewCustomerDeviceForm({ ...newCustomerDeviceForm, scadenza_garanzia: e.target.value })}
                        />
                      </Field>

                      <Field label="Note dispositivo">
                        <textarea
                          value={newCustomerDeviceForm.note}
                          onChange={(e) => setNewCustomerDeviceForm({ ...newCustomerDeviceForm, note: e.target.value })}
                        />
                      </Field>

                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={newCustomerReceiptQrAfterSave}
                          onChange={(e) => setNewCustomerReceiptQrAfterSave(e.target.checked)}
                        />
                        Genera QR telefono dopo la creazione
                      </label>
                    </>
                  )}

                  <div className="form-actions">
                    <button type="submit" className="primary-button">
                      {editingUserId ? "Salva cliente" : "Crea cliente + dispositivo"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {(customerDeviceMode === "device" || editingDeviceId) && (
              <section className="panel customer-form-panel" id="existing-device-form">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      {editingDeviceId ? "Modifica dispositivo" : "Aggiungi dispositivo"}
                    </h2>
                    <div className="panel-subtitle">
                      Modulo rapido per aggiungere o modificare un dispositivo cliente.
                    </div>
                  </div>

                  <button type="button" className="ghost-button" onClick={closeCustomerForms}>
                    Chiudi
                  </button>
                </div>

                <form className="form-grid compact-form" onSubmit={saveDevice}>
                  {!editingDeviceId && (
                    <Field label="Cliente">
                      <select
                        required
                        value={deviceForm.user_id}
                        onChange={(e) => setDeviceForm({ ...deviceForm, user_id: e.target.value })}
                      >
                        <option value="">Seleziona cliente</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.customer_code} - {user.nome} {user.cognome}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <Field label="Marca">
                    <select
                      required={!editingDeviceId}
                      value={deviceForm.marca}
                      onChange={(e) => setDeviceForm({ ...deviceForm, marca: e.target.value })}
                    >
                      <option value="">Seleziona marca</option>
                      {BRANDS.map((brand) => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Modello">
                    <input
                      required={!editingDeviceId}
                      value={deviceForm.modello}
                      onChange={(e) => setDeviceForm({ ...deviceForm, modello: e.target.value })}
                    />
                  </Field>

                  <Field label="Categoria prodotto">
                    <select
                      required
                      value={deviceForm.categoria}
                      onChange={(e) => setDeviceForm({ ...deviceForm, categoria: e.target.value })}
                    >
                      <option value="">Seleziona categoria</option>
                      {PRODUCT_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Inizio garanzia / data acquisto">
                    <input
                      type="date"
                      value={deviceForm.data_acquisto}
                      onChange={(e) => updateDeviceWarrantyStart(e.target.value)}
                    />
                  </Field>

                  <Field label="Scadenza garanzia">
                    <input
                      type="date"
                      value={deviceForm.scadenza_garanzia}
                      onChange={(e) => setDeviceForm({ ...deviceForm, scadenza_garanzia: e.target.value })}
                    />
                  </Field>

                  <Field label="Note">
                    <textarea
                      value={deviceForm.note}
                      onChange={(e) => setDeviceForm({ ...deviceForm, note: e.target.value })}
                    />
                  </Field>

                  {editingDeviceId && editingDevice ? (
                    <div className="inline-info-box">
                      <div>
                        <div className="row-title">Scontrino acquisto</div>
                        <div className="row-subtitle">Gestione scontrino del dispositivo selezionato.</div>
                      </div>

                      <div className="action-row">
                        <button type="button" className="primary-button" onClick={() => createReceiptUploadQr(editingDevice)}>
                          QR telefono
                        </button>

                        {editingDevice.receipt_data_url && (
                          <>
                            <button type="button" className="small-button" onClick={() => openDeviceReceipt(editingDevice)}>
                              Apri
                            </button>

                            <button type="button" className="danger-button" onClick={() => deleteDeviceReceipt(editingDevice)}>
                              Rimuovi
                            </button>
                          </>
                        )}

                        <label className="small-button" style={{ cursor: "pointer" }}>
                          {editingDevice.receipt_data_url ? "Sostituisci da PC" : "Carica da PC"}
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            style={{ display: "none" }}
                            onChange={(event) => uploadDeviceReceipt(editingDevice, event)}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={deviceReceiptQrAfterSave}
                        onChange={(e) => setDeviceReceiptQrAfterSave(e.target.checked)}
                      />
                      Genera QR telefono dopo il salvataggio
                    </label>
                  )}

                  <div className="form-actions">
                    <button type="submit" className="primary-button">
                      {editingDeviceId ? "Salva dispositivo" : "Aggiungi dispositivo"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section className="panel customers-list-panel">
              <div className="table-wrap compact-table-wrap">
                <table className="customers-table">
                  <thead>
                    <tr>
                      <th>Nome e cognome</th>
                      <th>Telefono</th>
                      <th>Email</th>
                      <th>Dettagli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="4">Nessun cliente trovato.</td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const expanded = expandedCustomerId === user.id;
                        const customerDevices = getCustomerDevices(user);

                        return (
                          <React.Fragment key={user.id}>
                            <tr>
                              <td>
                                <div className="row-title">{user.nome} {user.cognome}</div>
                                <div className="row-subtitle">
                                  {user.customer_code || "-"}
                                  <span className={user.privacy_consent ? "badge badge-green" : "badge badge-red"} style={{ marginLeft: "8px" }}>
                                    Privacy {user.privacy_consent ? "OK" : "NO"}
                                  </span>
                                  <span className={user.marketing_consent ? "badge badge-blue" : "badge badge-orange"} style={{ marginLeft: "8px" }}>
                                    Marketing {user.marketing_consent ? "OK" : "NO"}
                                  </span>
                                  <span className={user.whatsapp_consent ? "badge badge-green" : "badge badge-orange"} style={{ marginLeft: "8px" }}>
                                    WhatsApp {user.whatsapp_consent ? "OK" : "NO"}
                                  </span>
                                </div>
                              </td>
                              <td>{user.telefono || "-"}</td>
                              <td>{user.email || "-"}</td>
                              <td>
                                <button type="button" className="soft-button" onClick={() => toggleCustomerDetails(user.id)}>
                                  {expanded ? "Chiudi" : "Dettagli"}
                                </button>
                              </td>
                            </tr>

                            {expanded && (
                              <tr className="customer-detail-row">
                                <td colSpan="4">
                                  <div className="customer-detail-box">
                                    <div>
                                      <div className="row-title">WebApp e contatti</div>

                      {/* PATCH_81_PRODUCTION_SOFT_UI */}
                      {(() => {
                        const productionKey = String(user.id);
                        const productionData = productionSoftByUser[productionKey] || {};
                        const analytics = productionData.analytics || {};
                        const loadingProduction = Boolean(productionSoftLoadingByUser[productionKey]);
                        const hasProductionData = Boolean(productionData.success);
                        const privacyOk = Boolean(user.privacy_consent);
                        const marketingOk = Boolean(user.marketing_consent);
                        const whatsappOk = Boolean(user.whatsapp_consent) && !Boolean(user.broadcast_opt_out);

                        return (
                          <div
                            style={{
                              marginTop: "12px",
                              marginBottom: "12px",
                              padding: "12px",
                              borderRadius: "16px",
                              border: "1px solid rgba(148,163,184,.22)",
                              background: "rgba(15,23,42,.42)"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start", flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontWeight: 800, color: "#e5e7eb" }}>Produzione soft</div>
                                <div className="muted-text">
                                  {hasProductionData
                                    ? `Ultimo accesso WebApp: ${formatSystemDate(analytics.last_seen_at || analytics.last_event_at)}`
                                    : productionData.error || "Premi Aggiorna per leggere accessi e visite del cliente."}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => loadProductionSoftSummary(user, { force: true })}
                                disabled={loadingProduction}
                                style={{
                                  border: "1px solid rgba(147,197,253,.35)",
                                  background: "rgba(37,99,235,.16)",
                                  color: "#bfdbfe",
                                  borderRadius: "999px",
                                  padding: "8px 12px",
                                  cursor: loadingProduction ? "not-allowed" : "pointer",
                                  fontWeight: 800
                                }}
                              >
                                {loadingProduction ? "Aggiorno..." : "Aggiorna dati WebApp"}
                              </button>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                                gap: "8px",
                                marginTop: "12px"
                              }}
                            >
                              <div className="quick-item" style={{ padding: "10px" }}>
                                <div>
                                  <div className="muted-text">Visite</div>
                                  <div className="row-title">{formatInteger(analytics.visits_total || 0)}</div>
                                </div>
                              </div>
                              <div className="quick-item" style={{ padding: "10px" }}>
                                <div>
                                  <div className="muted-text">7 giorni</div>
                                  <div className="row-title">{formatInteger(analytics.visits_7d || 0)}</div>
                                </div>
                              </div>
                              <div className="quick-item" style={{ padding: "10px" }}>
                                <div>
                                  <div className="muted-text">Sessioni</div>
                                  <div className="row-title">{formatInteger(analytics.sessions_total || 0)}</div>
                                </div>
                              </div>
                              <div className="quick-item" style={{ padding: "10px" }}>
                                <div>
                                  <div className="muted-text">Stato</div>
                                  <div className="row-title">{Number(analytics.online_now || 0) > 0 ? "Online" : Number(analytics.active_5m || 0) > 0 ? "Attivo" : "Offline"}</div>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                              <span className={privacyOk ? "badge badge-green" : "badge badge-red"}>Privacy {privacyOk ? "OK" : "NO"}</span>
                              <span className={marketingOk ? "badge badge-green" : "badge"}>Marketing {marketingOk ? "OK" : "NO"}</span>
                              <span className={whatsappOk ? "badge badge-green" : "badge"}>WhatsApp {whatsappOk ? "OK" : "NO"}</span>
                            </div>
                          </div>
                        );
                      })()}
                                      <div className="action-row customer-detail-actions">
                                        {user.app_token ? (
                                          <>
                                            <button type="button" className="small-button" onClick={() => openCustomerApp(user)}>
                                              Apri WebApp
                                            </button>
                                            <button type="button" className="small-button" onClick={() => copyCustomerAppUrl(user)}>
                                              Copia link
                                            </button>
                                            <button type="button" className="small-button" onClick={() => openCustomerQr(user)}>
                                              QR
                                            </button>
                                            <button type="button" className="small-button" onClick={() => openCustomerWhatsApp(user)}>
                                              WhatsApp
                                            </button>
                                            <button type="button" className="small-button" onClick={() => openCustomWhatsAppModal(user)}>
                                              Msg libero
                                            </button>
                                            <button type="button" className="small-button" onClick={() => copyCustomerOnboardingMessage(user)}>
                                              Copia msg
                                            </button>
                                          </>
                                        ) : (
                                          <span className="badge badge-red">Token assente</span>
                                        )}
                                      </div>

                                      <div className="inline-info-box" style={{ marginTop: "12px" }}>
                                        <div>
                                          <div className="row-title">Consensi comunicazione</div>
                                          <div className="row-subtitle">
                                            Privacy: {user.privacy_consent ? "attiva" : "mancante"} ·
                                            Marketing: {user.marketing_consent ? "attivo" : "non attivo"} ·
                                            WhatsApp: {user.whatsapp_consent ? "attivo" : "non attivo"}
                                          </div>
                                          {user.consent_note && (
                                            <div className="row-subtitle" style={{ marginTop: "4px" }}>
                                              Nota: {user.consent_note}
                                            </div>
                                          )}
                                        </div>

                                        <div className="action-row" style={{ justifyContent: "flex-end" }}>
                                          <button
                                            type="button"
                                            className={user.marketing_consent ? "danger-button" : "primary-button"}
                                            onClick={() => updateCustomerConsents(
                                              user,
                                              { marketing_consent: !user.marketing_consent },
                                              user.marketing_consent ? "Consenso marketing disattivato" : "Consenso marketing attivato"
                                            )}
                                          >
                                            {user.marketing_consent ? "Disattiva marketing" : "Attiva marketing"}
                                          </button>

                                          <button
                                            type="button"
                                            className={user.whatsapp_consent ? "danger-button" : "primary-button"}
                                            onClick={() => toggleBroadcastOptOut(user)}
                                          >
                                            {user.whatsapp_consent ? "Disattiva WhatsApp" : "Attiva WhatsApp"}
                                          </button>

                                          <button
                                            type="button"
                                            className="danger-button"
                                            onClick={() => revokeOptionalConsents(user)}
                                          >
                                            Revoca opzionali
                                          </button>

                                          <button
                                            type="button"
                                            className="soft-button"
                                            onClick={() => exportCustomerPrivacy(user)}
                                          >
                                            Esporta privacy
                                          </button>

                                          <button
                                            type="button"
                                            className="soft-button"
                                            onClick={() => editUser(user)}
                                          >
                                            Modifica consensi
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <div className="row-title">Dispositivi</div>
                                      <div className="row-subtitle" style={{ marginBottom: "8px" }}>
                                        {customerDevices.length} dispositivi registrati.
                                      </div>
                                      <div className="action-row customer-detail-actions">
                                        <button type="button" className="soft-button" onClick={() => startAddDeviceForCustomer(user)}>
                                          Aggiungi device
                                        </button>
                                        <button type="button" className="soft-button" onClick={() => editUser(user)}>
                                          Modifica cliente
                                        </button>
                                        <button type="button" className="danger-button" onClick={() => deleteUser(user.id)}>
                                          Elimina cliente
                                        </button>
                                      </div>

                                      {customerDevices.length > 0 && (
                                        <div className="mini-device-list">
                                          {customerDevices.map((device) => (
                                            <div key={device.id} className="mini-device-item">
                                              <div>
                                                <strong>{device.marca} {device.modello}</strong>
                                                <span>{getDeviceCategoryLabel(device.categoria)} · Garanzia {formatDate(device.scadenza_garanzia)}</span>
                                              </div>
                                              <div className="action-row">
                                                <button type="button" className="small-button" onClick={() => editDevice(device)}>
                                                  Modifica
                                                </button>
                                                <button type="button" className="primary-button" onClick={() => createReceiptUploadQr(device)}>
                                                  QR scontrino
                                                </button>
                                                {device.receipt_data_url && (
                                                  <button type="button" className="small-button" onClick={() => openDeviceReceipt(device)}>
                                                    Apri scontrino
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!loading && activeSection === "devices" && (
          <section className="section-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    {editingDeviceId ? "Modifica dispositivo" : "Nuovo dispositivo"}
                  </h2>
                  <div className="panel-subtitle">
                    Collega il prodotto al cliente.
                  </div>
                </div>
              </div>

              <form className="form-grid" onSubmit={saveDevice}>
                {!editingDeviceId && (
                  <Field label="Cliente">
                    <select
                      required
                      value={deviceForm.user_id}
                      onChange={(e) => setDeviceForm({ ...deviceForm, user_id: e.target.value })}
                    >
                      <option value="">Seleziona cliente</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.customer_code} - {user.nome} {user.cognome}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Marca">
                  <select
                    value={deviceForm.marca}
                    onChange={(e) => setDeviceForm({ ...deviceForm, marca: e.target.value })}
                  >
                    <option value="">Seleziona marca</option>
                    {BRANDS.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Modello">
                  <input
                    value={deviceForm.modello}
                    onChange={(e) => setDeviceForm({ ...deviceForm, modello: e.target.value })}
                  />
                </Field>

                <Field label="Categoria prodotto">
                    <select
                      required
                      value={deviceForm.categoria}
                      onChange={(e) => setDeviceForm({ ...deviceForm, categoria: e.target.value })}
                    >
                      <option value="">Seleziona categoria</option>
                      {PRODUCT_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                <Field label="Inizio garanzia / data acquisto">
                  <input
                    type="date"
                    value={deviceForm.data_acquisto}
                    onChange={(e) => updateDeviceWarrantyStart(e.target.value)}
                  />
                </Field>

                <Field label="Scadenza garanzia">
                  <input
                    type="date"
                    value={deviceForm.scadenza_garanzia}
                    onChange={(e) => setDeviceForm({ ...deviceForm, scadenza_garanzia: e.target.value })}
                  />
                </Field>

                <Field label="Note">
                  <textarea
                    value={deviceForm.note}
                    onChange={(e) => setDeviceForm({ ...deviceForm, note: e.target.value })}
                  />
                </Field>

                <div className="form-actions">
                  <button type="submit" className="primary-button">
                    {editingDeviceId ? "Salva modifiche" : "Crea dispositivo"}
                  </button>

                  {editingDeviceId && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setEditingDeviceId(null);
                        setDeviceForm(EMPTY_DEVICE_FORM);
                      }}
                    >
                      Annulla
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="panel">
              <div className="toolbar">
                <div>
                  <h2 className="panel-title">Dispositivi registrati</h2>
                  <div className="panel-subtitle">
                    {filteredDevices.length} dispositivi visualizzati.
                  </div>
                </div>

                <input
                  className="search-input"
                  placeholder="Cerca dispositivo..."
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                />
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Dispositivo</th>
                      <th>Garanzia</th>
                      <th>Note</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan="5">Nessun dispositivo trovato.</td>
                      </tr>
                    ) : (
                      filteredDevices.map((device) => (
                        <tr key={device.id}>
                          <td>
                            <div className="row-title">{device.nome} {device.cognome}</div>
                            <div className="row-subtitle">{device.customer_code || "-"}</div>
                          </td>
                          <td>
                            <div className="row-title">{device.marca} {device.modello}</div>
                            <div className="row-subtitle">{getDeviceCategoryLabel(device.categoria)}</div>
                          </td>
                          <td>
                            <span className={getWarrantyClass(device.scadenza_garanzia)}>
                              {formatDate(device.scadenza_garanzia)}
                            </span>
                          </td>
                          <td>{device.note || "-"}</td>
                          <td>
                            <div className="action-row">
                              <button type="button" className="soft-button" onClick={() => editDevice(device)}>
                                Modifica
                              </button>
                              <button type="button" className="danger-button" onClick={() => deleteDevice(device.id)}>
                                Elimina
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {!loading && activeSection === "guides" && (
          <>
            <section className="section-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      {editingGuideId ? "Modifica guida WebApp" : "Nuova guida WebApp"}
                    </h2>
                    <div className="panel-subtitle">
                      Guide e consigli visualizzati nella sezione Aiuto della WebApp cliente.
                    </div>
                  </div>

                  {editingGuideId && (
                    <button type="button" className="ghost-button" onClick={resetGuideForm}>
                      Nuova guida
                    </button>
                  )}
                </div>

                <form className="form-grid" onSubmit={saveGuide}>
                  <Field label="Icona">
                    <input
                      value={guideForm.icon}
                      onChange={(e) => setGuideForm({ ...guideForm, icon: e.target.value })}
                      placeholder=""
                    />
                  </Field>

                  <Field label="Categoria dispositivo">
                    <select
                      value={guideForm.categoria}
                      onChange={(e) => setGuideForm({ ...guideForm, categoria: e.target.value })}
                    >
                      {GUIDE_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Ordine">
                    <input
                      type="number"
                      value={guideForm.sort_order}
                      onChange={(e) => setGuideForm({ ...guideForm, sort_order: e.target.value })}
                    />
                  </Field>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(guideForm.enabled)}
                      onChange={(e) => setGuideForm({ ...guideForm, enabled: e.target.checked })}
                    />
                    Guida attiva nella WebApp
                  </label>

                  <Field label="Titolo">
                    <input
                      required
                      value={guideForm.title}
                      onChange={(e) => setGuideForm({ ...guideForm, title: e.target.value })}
                      placeholder="Esempio: Backup foto e contatti"
                    />
                  </Field>

                  <Field label="Descrizione">
                    <textarea
                      required
                      value={guideForm.description}
                      onChange={(e) => setGuideForm({ ...guideForm, description: e.target.value })}
                      placeholder="Testo breve visualizzato nella WebApp cliente"
                    />
                  </Field>

                  <div className="form-actions">
                    <button type="submit" className="primary-button">
                      {editingGuideId ? "Salva guida" : "Crea guida"}
                    </button>

                    <button type="button" className="soft-button" onClick={resetGuideForm}>
                      Pulisci
                    </button>
                  </div>
                </form>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Guide pubblicate</h2>
                    <div className="panel-subtitle">
                      {filteredGuides.length} guide visualizzate. Le guide generali appaiono a tutti.
                    </div>
                  </div>
                </div>

                <input
                  className="search-input"
                  placeholder="Cerca guida..."
                  value={guideSearch}
                  onChange={(e) => setGuideSearch(e.target.value)}
                />

                <div className="table-wrap" style={{ marginTop: "14px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Guida</th>
                        <th>Categoria</th>
                        <th>Ordine</th>
                        <th>Stato</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGuides.length === 0 ? (
                        <tr>
                          <td colSpan="5">Nessuna guida trovata.</td>
                        </tr>
                      ) : (
                        filteredGuides.map((guide) => (
                          <tr key={guide.id}>
                            <td>
                              <div className="row-title">
                                {guide.title}
                              </div>
                              <div className="row-subtitle">
                                {guide.description}
                              </div>
                            </td>
                            <td>{getGuideCategoryLabel(guide.categoria)}</td>
                            <td>{guide.sort_order}</td>
                            <td>
                              <span className={guide.enabled ? "badge badge-green" : "badge badge-orange"}>
                                {guide.enabled ? "Attiva" : "Nascosta"}
                              </span>
                            </td>
                            <td>
                              <div className="action-row">
                                <button type="button" className="small-button" onClick={() => editGuide(guide)}>
                                  Modifica
                                </button>
                                <button type="button" className="danger-button" onClick={() => deleteGuide(guide.id)}>
                                  Elimina
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}

        {!loading && activeSection === "offers" && (
          <>
            <section className="section-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      {editingOfferId ? "Modifica offerta" : "Nuova offerta"}
                    </h2>
                    <div className="panel-subtitle">
                      Gestione manuale prodotti affiliati.
                    </div>
                  </div>
                </div>

                <form className="form-grid" onSubmit={saveOffer}>
                  <Field label="Categoria">
                    <select
                      value={offerForm.categoria}
                      onChange={(e) => setOfferForm({ ...offerForm, categoria: e.target.value })}
                    >
                      {OFFER_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Partner">
                    <select
                      value={offerForm.partner}
                      onChange={(e) => setOfferForm({ ...offerForm, partner: e.target.value })}
                    >
                      {OFFER_PARTNERS.map((partner) => (
                        <option key={partner.value} value={partner.value}>
                          {partner.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Titolo">
                    <input
                      required
                      value={offerForm.titolo}
                      onChange={(e) => setOfferForm({ ...offerForm, titolo: e.target.value })}
                      placeholder="Es. Cover Samsung Galaxy consigliata"
                    />
                  </Field>

                  <Field label="Descrizione">
                    <textarea
                      value={offerForm.descrizione}
                      onChange={(e) => setOfferForm({ ...offerForm, descrizione: e.target.value })}
                      placeholder="Descrizione breve visibile nella WebApp cliente"
                    />
                  </Field>

                  <Field label="Template rapidi">
                    <div className="action-row">
                      <button type="button" className="small-button" onClick={() => fillOfferTemplate("cover")}>
                        Cover
                      </button>
                      <button type="button" className="small-button" onClick={() => fillOfferTemplate("vetro")}>
                        Vetro
                      </button>
                      <button type="button" className="small-button" onClick={() => fillOfferTemplate("caricatore")}>
                        Caricatore
                      </button>
                    </div>
                  </Field>

                  <Field label="Link affiliato">
                    <input
                      required
                      type="url"
                      value={offerForm.affiliate_url}
                      onChange={(e) => setOfferForm({ ...offerForm, affiliate_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </Field>

                  <Field label="URL immagine">
                    <input
                      type="url"
                      value={offerForm.image_url}
                      onChange={(e) => setOfferForm({ ...offerForm, image_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </Field>

                  <div className="inline-info-box">
                    <div>
                      <div className="row-title">Anteprima WebApp cliente</div>
                      <div className="row-subtitle">
                        Controlla titolo, descrizione, immagine e link prima di salvare.
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "78px 1fr",
                        gap: "12px",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          width: "78px",
                          height: "78px",
                          borderRadius: "14px",
                          border: "1px solid #e2e8f0",
                          background: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        {offerForm.image_url ? (
                          <img
                            src={offerForm.image_url}
                            alt="Anteprima offerta"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <span className="row-subtitle">No img</span>
                        )}
                      </div>

                      <div>
                        <div className="row-title">{offerForm.titolo || "Titolo offerta"}</div>
                        <div className="row-subtitle">{offerForm.descrizione || "Descrizione offerta"}</div>
                        <div className="action-row" style={{ marginTop: "8px" }}>
                          <span className="badge badge-blue">{getOfferCategoryLabel(offerForm.categoria)}</span>
                          <span className="badge badge-green">{getOfferPartnerLabel(offerForm.partner)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="action-row">
                      <button type="button" className="soft-button" onClick={() => openOfferLink()}>
                        Prova link
                      </button>
                      <button type="button" className="soft-button" onClick={() => copyOfferLink()}>
                        Copia link
                      </button>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="primary-button">
                      {editingOfferId ? "Salva modifiche" : "Crea offerta"}
                    </button>

                    {editingOfferId && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setEditingOfferId(null);
                          setOfferForm(EMPTY_OFFER_FORM);
                        }}
                      >
                        Annulla
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div>
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Import Amazon</h2>
                      <div className="panel-subtitle">
                        Cerca prodotti e importali nelle offerte. I prodotti Amazon vengono importati come Accessori.
                      </div>
                    </div>
                  </div>

                  <div className="toolbar">
                    <input
                      placeholder="Es. cover Samsung S24"
                      value={amazonSearch}
                      onChange={(e) => setAmazonSearch(e.target.value)}
                    />
                    <button type="button" className="primary-button" onClick={searchAmazon}>
                      Cerca
                    </button>
                  </div>

                  {amazonSearchMessage && (
                    <div className="panel-subtitle" style={{ marginBottom: "12px" }}>
                      {amazonSearchMessage}
                    </div>
                  )}

                  {amazonResults.length > 0 && (
                    <div className="amazon-grid">
                      {amazonResults.map((item, index) => (
                        <article key={item.asin || item.affiliate_url || index} className="product-card">
                          {item.image_url && (
                            <img src={item.image_url} alt={item.titolo || "Prodotto"} />
                          )}
                          <div className="row-title">
                            {item.titolo || "Prodotto Amazon"}
                          </div>

                          <div className="field">
                            <label>Categoria importazione</label>
                            <select
                              value={getAmazonImportCategory(item, index)}
                              onChange={(e) =>
                                setAmazonImportCategories({
                                  ...amazonImportCategories,
                                  [getAmazonImportKey(item, index)]: e.target.value,
                                })
                              }
                            >
                              {OFFER_CATEGORIES.map((category) => (
                                <option key={category.value} value={category.value}>
                                  {category.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            className="soft-button"
                            onClick={() => importAmazonProduct(item, getAmazonImportCategory(item, index))}
                          >
                            Importa in {getOfferCategoryLabel(getAmazonImportCategory(item, index))}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel">
                  <div className="toolbar">
                    <div>
                      <h2 className="panel-title">Offerte registrate</h2>
                      <div className="panel-subtitle">
                        {filteredOffers.length} offerte visualizzate.
                      </div>
                    </div>

                    <input
                      className="search-input"
                      placeholder="Cerca offerta..."
                      value={offerSearch}
                      onChange={(e) => setOfferSearch(e.target.value)}
                    />
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Prodotto</th>
                          <th>Categoria</th>
                          <th>Partner</th>
                          <th>Link</th>
                          <th>Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOffers.length === 0 ? (
                          <tr>
                            <td colSpan="5">Nessuna offerta trovata.</td>
                          </tr>
                        ) : (
                          filteredOffers.map((offer) => (
                            <tr key={offer.id}>
                              <td>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                  {offer.image_url && (
                                    <img
                                      src={offer.image_url}
                                      alt={offer.titolo || "Offerta"}
                                      style={{
                                        width: "54px",
                                        height: "54px",
                                        objectFit: "contain",
                                        borderRadius: "10px",
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                      }}
                                    />
                                  )}
                                  <div>
                                    <div className="row-title">{offer.titolo || "-"}</div>
                                    <div className="row-subtitle">{offer.descrizione || ""}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="badge badge-blue">{getOfferCategoryLabel(offer.categoria)}</span>
                              </td>
                              <td>
                                <span className="badge badge-green">{getOfferPartnerLabel(offer.partner)}</span>
                              </td>
                              <td>
                                {offer.affiliate_url ? (
                                  <div className="action-row">
                                    <button type="button" className="small-button" onClick={() => openOfferLink(offer)}>
                                      Apri
                                    </button>
                                    <button type="button" className="small-button" onClick={() => copyOfferLink(offer)}>
                                      Copia
                                    </button>
                                  </div>
                                ) : "-"}
                              </td>
                              <td>
                                <div className="action-row">
                                  <button type="button" className="soft-button" onClick={() => editOffer(offer)}>
                                    Modifica
                                  </button>
                                  <button type="button" className="danger-button" onClick={() => deleteOffer(offer.id)}>
                                    Elimina
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {!loading && activeSection === "live" && (
          <>
            <section className="section-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Offerte Live</h2>
                    <div className="panel-subtitle">
                      Pubblicazione automatica da canali Telegram autorizzati.
                    </div>
                  </div>
                  <button type="button" className="soft-button" onClick={loadData}>
                    Aggiorna
                  </button>
                </div>

                {liveMessage && (
                  <div className="inline-info-box" style={{ marginBottom: "14px" }}>
                    {liveMessage}
                  </div>
                )}

                {liveMonitor && (
                  <div className="stats-grid" style={{ marginBottom: "16px" }}>
                    <div className="stat-card">
                      <div className="stat-label">Servizio Telegram</div>
                      <div className="stat-value" style={{ fontSize: "22px" }}>
                        <span className={getLiveServiceBadge(liveMonitor.service?.status)}>
                          {getLiveServiceLabel(liveMonitor.service?.status)}
                        </span>
                      </div>
                      <div className="stat-foot">
                        Ultimo segnale: {formatLiveAge(liveMonitor.service?.heartbeat_age_seconds)}
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-label">Offerte live attive</div>
                      <div className="stat-value">{liveMonitor.counts?.active_live || 0}</div>
                      <div className="stat-foot">
                        Importate oggi: {liveMonitor.counts?.imported_today || 0}
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-label">Canali abilitati</div>
                      <div className="stat-value">{liveMonitor.sources?.enabled_sources || 0}</div>
                      <div className="stat-foot">
                        Totali configurati: {liveMonitor.sources?.total_sources || 0}
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-label">Ultimo import</div>
                      <div className="stat-value" style={{ fontSize: "18px" }}>
                        {liveMonitor.latestOffer?.asin || "-"}
                      </div>
                      <div className="stat-foot">
                        {liveMonitor.latestOffer?.source_channel || "Nessuna offerta importata"}
                      </div>
                    </div>
                  </div>
                )}

                <form className="form-grid" onSubmit={saveLiveSettings}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(liveSettings.enabled)}
                      onChange={(e) => setLiveSettings({ ...liveSettings, enabled: e.target.checked })}
                    />
                    <span>Mostra la sezione Offerte live nella WebApp cliente</span>
                  </label>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(liveSettings.telegram_auto_import_enabled)}
                      onChange={(e) => setLiveSettings({ ...liveSettings, telegram_auto_import_enabled: e.target.checked })}
                    />
                    <span>Import automatico Telegram attivo</span>
                  </label>

                  <Field label="Tag affiliato Amazon">
                    <input
                      placeholder="esempio: tuotag-21"
                      value={liveSettings.amazon_tag || ""}
                      onChange={(e) => setLiveSettings({ ...liveSettings, amazon_tag: e.target.value })}
                    />
                  </Field>

                  <Field label="Durata offerte live">
                    <select
                      value={String(liveSettings.ttl_hours || 24)}
                      onChange={(e) => setLiveSettings({ ...liveSettings, ttl_hours: Number(e.target.value) })}
                    >
                      <option value="12">12 ore</option>
                      <option value="24">24 ore</option>
                      <option value="48">48 ore</option>
                      <option value="72">72 ore</option>
                    </select>
                  </Field>

                  <Field label="Offerte per pagina nella WebApp">
                    <select
                      value={String(liveSettings.max_visible || 20)}
                      onChange={(e) => setLiveSettings({ ...liveSettings, max_visible: Number(e.target.value) })}
                    >
                      <option value="10">10 offerte</option>
                      <option value="20">20 offerte</option>
                      <option value="30">30 offerte</option>
                      <option value="50">50 offerte</option>
                    </select>
                  </Field>

                  <button type="submit" className="primary-button">
                    Salva impostazioni live
                  </button>
                </form>

                <div className="inline-info-box" style={{ marginTop: "14px" }}>
                  <strong>Nota tecnica:</strong> l'import automatico usa il servizio <code>sa-telegram-live</code> con account Telegram dedicato.
                  I canali sotto sono la whitelist letta dal servizio.
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Canali Telegram autorizzati</h2>
                    <div className="panel-subtitle">
                      Usa @nomecanale oppure ID numerico del canale.
                    </div>
                  </div>
                </div>

                <form className="form-grid" onSubmit={addLiveSource}>
                  <Field label="Canale">
                    <input
                      placeholder="@nomecanale"
                      value={liveSourceForm.channel_ref}
                      onChange={(e) => setLiveSourceForm({ ...liveSourceForm, channel_ref: e.target.value })}
                    />
                  </Field>

                  <Field label="Descrizione">
                    <input
                      placeholder="esempio: Offerte Amazon tech"
                      value={liveSourceForm.label}
                      onChange={(e) => setLiveSourceForm({ ...liveSourceForm, label: e.target.value })}
                    />
                  </Field>

                  <button type="submit" className="primary-button">
                    Aggiungi canale
                  </button>
                </form>

                <div className="table-wrap" style={{ marginTop: "14px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Canale</th>
                        <th>Stato</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveSources.length === 0 ? (
                        <tr>
                          <td colSpan="3">Nessun canale configurato.</td>
                        </tr>
                      ) : (
                        liveSources.map((source) => (
                          <tr key={source.id}>
                            <td>
                              <div className="row-title">{source.channel_ref}</div>
                              <div className="row-subtitle">{source.label || "-"}</div>
                            </td>
                            <td>
                              <span className={source.enabled ? "badge badge-green" : "badge badge-yellow"}>
                                {source.enabled ? "Attivo" : "Disattivato"}
                              </span>
                            </td>
                            <td>
                              <div className="action-row">
                                <button type="button" className="soft-button" onClick={() => toggleLiveSource(source)}>
                                  {source.enabled ? "Disattiva" : "Attiva"}
                                </button>
                                <button type="button" className="danger-button" onClick={() => deleteLiveSource(source.id)}>
                                  Elimina
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="section-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Test importazione</h2>
                    <div className="panel-subtitle">
                      Incolla un post Telegram o un link Amazon per verificare estrazione ASIN e tag affiliato.
                    </div>
                  </div>
                </div>

                <form className="form-grid" onSubmit={importLiveText}>
                  <Field label="Testo offerta">
                    <textarea
                      rows="7"
                      placeholder="Incolla qui il messaggio Telegram..."
                      value={liveImportText}
                      onChange={(e) => setLiveImportText(e.target.value)}
                    />
                  </Field>

                  <button type="submit" className="primary-button">
                    Importa test live
                  </button>
                </form>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Ultime offerte live</h2>
                    <div className="panel-subtitle">
                      {liveOffers.length} offerte registrate negli ultimi import.
                    </div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Offerta</th>
                        <th>Fonte</th>
                        <th>Stato</th>
                        <th>Scadenza</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveOffers.length === 0 ? (
                        <tr>
                          <td colSpan="5">Nessuna offerta live importata.</td>
                        </tr>
                      ) : (
                        liveOffers.map((offer) => (
                          <tr key={offer.id}>
                            <td>
                              <div className="row-title">{offer.title || offer.asin}</div>
                              <div className="row-subtitle">
                                {offer.asin} · {offer.price_text || "prezzo non rilevato"}
                              </div>
                            </td>
                            <td>
                              <div className="row-title">{offer.source_channel || "-"}</div>
                              <div className="row-subtitle">{offer.category || "generale"}</div>
                            </td>
                            <td>
                              <span className={offer.status === "published" ? "badge badge-green" : "badge badge-yellow"}>
                                {getLiveStatusLabel(offer.status)}
                              </span>
                            </td>
                            <td>{formatLiveDate(offer.expires_at)}</td>
                            <td>
                              <div className="action-row">
                                <button type="button" className="soft-button" onClick={() => openOfferLink({ affiliate_url: offer.affiliate_url })}>
                                  Apri
                                </button>
                                {offer.status === "published" ? (
                                  <button type="button" className="danger-button" onClick={() => updateLiveOfferStatus(offer, "hidden")}>
                                    Nascondi
                                  </button>
                                ) : (
                                  <button type="button" className="soft-button" onClick={() => updateLiveOfferStatus(offer, "published")}>
                                    Pubblica
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}


        {!loading && activeSection === "system" && (
          <>
            <section className="kpi-grid">
              <KpiCard label="Stato generale" value={getSystemStatusLabel(systemStatus?.overall_status)} />
              <KpiCard label="Backup recenti" value={systemStatus?.backup?.count || 0} />
              <KpiCard label="Check storici" value={systemStatus?.history?.count || 0} />
              <KpiCard label="Offerte Live 24h" value={systemStatus?.live?.imported_24h || 0} />
              {/* PATCH_64_8_SYSTEM_ANALYTICS_FRONTEND_KPI */}
              <KpiCard label="Sessioni WebApp" value={formatInteger(systemStatus?.analytics?.sessions_total)} />
              <KpiCard label="WhatsApp" value={getSystemStatusLabel(systemStatus?.services?.whatsapp?.status)} />
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Servizi principali</h2>
                    <div className="panel-subtitle">Stato letto dal backend e dall'ultimo report giornaliero automatico.</div>
                  </div>
                  <span className={getSystemBadgeClass(systemStatus?.overall_status)}>{getSystemStatusLabel(systemStatus?.overall_status)}</span>
                </div>
                <div className="quick-list">
                  {getSystemServiceList().map((service) => (
                    <div key={service.label} className="quick-item">
                      <div>
                        <div className="row-title">{service.label}</div>
                        <div className="muted-text">{service.message || "-"}</div>
                      </div>
                      <span className={getSystemBadgeClass(service.status)}>{getSystemStatusLabel(service.status)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                {/* PATCH_69A_SYSTEM_REPORT_EXTENDED_FRONTEND_PANEL */}
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Ultimo check giornaliero</h2>
                    <div className="panel-subtitle">Report automatico con backup, ripristinabilita ZIP, Offerte Live e Analytics WebApp.</div>
                  </div>
                  {systemStatus?.report?.available && (
                    <span className={getSystemBadgeClass(systemStatus.report.normalized_status || systemStatus?.overall_status)}>
                      {systemStatus.report.status || getSystemStatusLabel(systemStatus.report.normalized_status || systemStatus?.overall_status)}
                    </span>
                  )}
                </div>
                {!systemStatus?.report?.available ? (
                  <div className="quick-item">Report non disponibile.</div>
                ) : (
                  <div className="quick-list">
                    <div className="quick-item"><div><div className="row-title">Stato report</div><div className="muted-text">{systemStatus.report.status_line || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Data</div><div className="muted-text">{formatSystemDate(systemStatus.report.data)}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Backup ZIP</div><div className="muted-text">{systemStatus.report.backup || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Verifica backup</div><div className="muted-text">{systemStatus.report.backup_restore_check || "-"}</div></div></div>
                    {/* PATCH_70A_BACKUP_RETENTION_FRONTEND_REPORT */}
                    <div className="quick-item"><div><div className="row-title">Retention backup</div><div className="muted-text">{systemStatus.report.backup_retention || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Backend</div><div className="muted-text">{systemStatus.report.backend || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Frontend</div><div className="muted-text">{systemStatus.report.frontend || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Dominio pubblico</div><div className="muted-text">{systemStatus.report.public || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">PostgreSQL dump</div><div className="muted-text">{systemStatus.report.postgres_dump || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Offerte Live</div><div className="muted-text">{systemStatus.report.live_quality || systemStatus.report.live || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Ultima offerta Live</div><div className="muted-text">{systemStatus.report.live_last || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Analytics WebApp</div><div className="muted-text">{systemStatus.report.analytics || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Durata</div><div className="muted-text">{systemStatus.report.duration || "-"}</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Avvisi/Errori report</div><div className="muted-text">{(systemStatus.report.warnings || []).length} avvisi / {(systemStatus.report.errors || []).length} errori</div></div></div>
                    <div className="quick-item"><div><div className="row-title">Notifica WhatsApp</div><div className="muted-text">{systemStatus.notification?.available ? `WhatsApp: ${systemStatus.notification.whatsapp || "-"} / Email: ${systemStatus.notification.email || "-"}` : "Non disponibile"}</div></div></div>
                  </div>
                )}
              </div>
            </section>

            {/* PATCH_64_8_SYSTEM_ANALYTICS_FRONTEND_UI */}
            <section className="panel" style={{ marginTop: "18px" }}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Analytics WebApp</h2>
                  <div className="panel-subtitle">Stato tecnico del tracciamento WebApp e della retention eventi.</div>
                </div>
                <span className={getSystemBadgeClass(systemStatus?.analytics?.status)}>{getSystemStatusLabel(systemStatus?.analytics?.status)}</span>
              </div>

              <section className="kpi-grid">
                <KpiCard label="Sessioni totali" value={formatInteger(systemStatus?.analytics?.sessions_total)} compact />
                <KpiCard label="Online ora" value={formatInteger(systemStatus?.analytics?.online_now)} compact />
                <KpiCard label="Attivi 5 min" value={formatInteger(systemStatus?.analytics?.active_5m)} compact />
                <KpiCard label="Eventi totali" value={formatInteger(systemStatus?.analytics?.events_total)} compact />
                <KpiCard label="Visite totali" value={formatInteger(systemStatus?.analytics?.visits_total)} compact />
                <KpiCard label="Retention" value={(formatInteger(systemStatus?.analytics?.retention_days || 90) + " gg")} compact />
              </section>

              <div className="quick-list" style={{ marginTop: "14px" }}>
                <div className="quick-item"><div><div className="row-title">Ultimo evento registrato</div><div className="muted-text">{formatSystemDate(systemStatus?.analytics?.last_event_at)}</div></div></div>
                <div className="quick-item"><div><div className="row-title">Ultima sessione vista</div><div className="muted-text">{formatSystemDate(systemStatus?.analytics?.last_session_seen_at)}</div></div></div>
                <div className="quick-item"><div><div className="row-title">Messaggio tecnico</div><div className="muted-text">{systemStatus?.analytics?.message || "Non disponibile"}</div></div></div>
              </div>
            </section>

            <section className="panel" style={{ marginTop: "18px" }}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Backup disponibili</h2>
                  <div className="panel-subtitle">Percorso server: {systemStatus?.backup_root || "-"}</div>
                </div>
                <button type="button" className="ghost-button" onClick={loadData}>Aggiorna stato</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>File</th><th>Dimensione</th><th>Data</th></tr></thead>
                  <tbody>
                    {(systemStatus?.backup?.files || []).length === 0 ? (
                      <tr><td colSpan="3">Nessun backup trovato.</td></tr>
                    ) : (
                      (systemStatus?.backup?.files || []).map((file) => (
                        <tr key={file.name}><td>{file.name}</td><td>{formatFileSize(file.size_bytes)}</td><td>{formatSystemDate(file.last_modified)}</td></tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel" style={{ marginTop: "18px" }}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Storico backup e check</h2>
                  <div className="panel-subtitle">Ultime esecuzioni dello script giornaliero con verifica backup, Offerte Live e Analytics.</div>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data</th><th>Esito</th><th>Backup</th><th>Verifica backup</th><th>Offerte Live</th><th>WhatsApp</th><th>Durata</th><th>Avvisi/Errori</th></tr></thead>
                  <tbody>
                    {(systemStatus?.history?.items || []).length === 0 ? (
                      <tr><td colSpan="8">Nessuno storico trovato.</td></tr>
                    ) : (
                      (systemStatus?.history?.items || []).map((item) => (
                        <tr key={item.key || item.run_dir_name || item.zip_name}>
                          <td>{formatSystemDate(item.date)}</td>
                          <td><span className={getSystemBadgeClass(item.normalized_status)}>{item.status || "-"}</span></td>
                          <td>{item.zip_name || item.backup || "-"}</td>
                          {/* PATCH_69A_SYSTEM_REPORT_EXTENDED_FRONTEND_HISTORY */}
                          <td>{item.backup_restore_check || "-"}</td>
                          <td>{item.live_offers_quality || item.live_offers_24h || "-"}</td>
                          <td>{item.whatsapp || "-"}</td>
                          <td>{item.duration_seconds !== null && item.duration_seconds !== undefined ? `${item.duration_seconds}s` : "-"}</td>
                          <td>{item.warnings_count || 0}/{item.errors_count || 0}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dashboard-grid" style={{ marginTop: "18px" }}>
              <div className="panel">
                <div className="panel-header"><div><h2 className="panel-title">Avvisi recenti</h2><div className="panel-subtitle">Elementi da verificare, ma non necessariamente bloccanti.</div></div></div>
                <div className="quick-list">
                  {(systemStatus?.warnings || []).length === 0 ? <div className="quick-item">Nessun avviso.</div> : (systemStatus?.warnings || []).map((warning, index) => <div key={`${warning}-${index}`} className="quick-item"><div className="muted-text">{warning}</div></div>)}
                </div>
              </div>
              <div className="panel">
                <div className="panel-header"><div><h2 className="panel-title">Errori recenti</h2><div className="panel-subtitle">Se presenti, richiedono controllo prima del prossimo Git.</div></div></div>
                <div className="quick-list">
                  {(systemStatus?.errors || []).length === 0 ? <div className="quick-item">Nessun errore.</div> : (systemStatus?.errors || []).map((error, index) => <div key={`${error}-${index}`} className="quick-item"><div className="muted-text">{error}</div></div>)}
                </div>
              </div>
            </section>
          </>
        )}

        {!loading && activeSection === "stats" && (
          <>
            <section className="kpi-grid">
              <KpiCard label="Click totali" value={formatInteger(clickStats.summary?.total_clicks)} />
              <KpiCard label="Click 24h" value={formatInteger(clickStats.summary?.clicks_24h)} />
              <KpiCard label="Click 7 giorni" value={formatInteger(clickStats.summary?.clicks_7d)} />
              <KpiCard label="Click 30 giorni" value={formatInteger(clickStats.summary?.clicks_30d)} />
              <KpiCard label="Clienti 7 giorni" value={formatInteger(clickStats.summary?.unique_customers_7d)} />
              <KpiCard label="Prodotti cliccati" value={formatInteger(clickStats.summary?.unique_products)} />
            </section>

            <section className="panel" style={{ marginBottom: "18px" }}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Andamento ultimi 14 giorni</h2>
                  <div className="panel-subtitle">
                    Click giornalieri sulle offerte affiliate e sui contenuti tracciati.
                  </div>
                </div>

                <button type="button" className="primary-button" onClick={exportClickStatsCsv}>
                  Esporta CSV
                </button>
              </div>

              <div className="daily-chart">
                {(clickStats.dailyClicks || []).map((item) => {
                  const clicks = Number(item.clicks || 0);
                  const height = Math.max(6, Math.round((clicks / getMaxDailyClicks()) * 150));

                  return (
                    <div key={item.day || item.label} className="daily-bar-wrap">
                      <div className="daily-value">{clicks}</div>
                      <div className="daily-bar" style={{ height: `${height}px` }} />
                      <div>{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <h2 className="panel-title">Prodotti più cliccati</h2>
                <div className="table-wrap" style={{ marginTop: "14px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Click</th>
                        <th>7 giorni</th>
                        <th>Prodotto</th>
                        <th>Ultimo click</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clickStats.topProducts || []).length === 0 ? (
                        <tr>
                          <td colSpan="4">Nessun click registrato.</td>
                        </tr>
                      ) : (
                        clickStats.topProducts.map((item, index) => (
                          <tr key={`${item.asin || item.titolo || index}-${index}`}>
                            <td><span className="badge badge-blue">{item.clicks}</span></td>
                            <td><span className="badge badge-green">{item.clicks_7d || 0}</span></td>
                            <td>
                              <div className="row-title">{item.titolo}</div>
                              {item.affiliate_url && (
                                <button type="button" className="small-button" onClick={() => window.open(item.affiliate_url, "_blank")}>
                                  Apri link
                                </button>
                              )}
                            </td>
                            <td>{item.last_click ? new Date(item.last_click).toLocaleString("it-IT") : "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <h2 className="panel-title">Fonti click</h2>
                <div className="table-wrap" style={{ marginTop: "14px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fonte</th>
                        <th>Click</th>
                        <th>7 giorni</th>
                        <th>Ultimo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clickStats.sourceStats || []).length === 0 ? (
                        <tr>
                          <td colSpan="4">Nessuna fonte registrata.</td>
                        </tr>
                      ) : (
                        clickStats.sourceStats.map((item) => (
                          <tr key={item.source}>
                            <td><span className="badge badge-blue">{item.source || "webapp"}</span></td>
                            <td>{item.clicks}</td>
                            <td>{item.clicks_7d || 0}</td>
                            <td>{item.last_click ? new Date(item.last_click).toLocaleString("it-IT") : "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <h2 className="panel-title">Clienti più attivi</h2>
                <div className="table-wrap" style={{ marginTop: "14px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Click</th>
                        <th>7 giorni</th>
                        <th>Ultimo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clickStats.customerStats || []).length === 0 ? (
                        <tr>
                          <td colSpan="4">Nessun cliente registrato nelle statistiche.</td>
                        </tr>
                      ) : (
                        clickStats.customerStats.map((item, index) => (
                          <tr key={`${item.customer_code || "unknown"}-${index}`}>
                            <td>
                              {item.customer_code
                                ? `${item.customer_code} - ${item.nome || ""} ${item.cognome || ""}`.trim()
                                : "Cliente non disponibile"}
                            </td>
                            <td>{item.clicks}</td>
                            <td>{item.clicks_7d || 0}</td>
                            <td>{item.last_click ? new Date(item.last_click).toLocaleString("it-IT") : "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <h2 className="panel-title">Ultimi click</h2>
                <div className="table-wrap" style={{ marginTop: "14px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Ora</th>
                        <th>Cliente</th>
                        <th>Prodotto</th>
                        <th>Fonte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clickStats.recentClicks || []).length === 0 ? (
                        <tr>
                          <td colSpan="4">Nessun click recente.</td>
                        </tr>
                      ) : (
                        clickStats.recentClicks.map((click, index) => (
                          <tr key={`${click.created_at}-${index}`}>
                            <td>{new Date(click.created_at).toLocaleString("it-IT")}</td>
                            <td>
                              {click.customer_code
                                ? `${click.customer_code} - ${click.nome || ""} ${click.cognome || ""}`
                                : "Cliente non disponibile"}
                            </td>
                            <td>{click.titolo || "-"}</td>
                            <td>{click.source || "webapp"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}

        {broadcastModalOpen && (
          <div className="qr-backdrop" onClick={closeBroadcastModal}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Broadcast WhatsApp clienti</h2>
                  <div className="panel-subtitle">
                    Invio guidato tramite WhatsApp: il sistema apre WhatsApp per ogni cliente, poi confermi l'invio dall'app.
                  </div>
                </div>

                <button type="button" className="ghost-button" onClick={closeBroadcastModal}>
                  Chiudi
                </button>
              </div>

              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={5}
                placeholder="Scrivi il messaggio..."
              />

              <div className="inline-info-box" style={{ marginTop: "12px" }}>
                <div>
                  <div className="row-title">
                    {getBroadcastCustomers().length > 0
                      ? `Clienti inclusi nel broadcast: ${getBroadcastCustomers().length}`
                      : "Nessun cliente valido o tutti esclusi dai broadcast"}
                  </div>
                  <div className="row-subtitle">
                    {broadcastIndex < getBroadcastCustomers().length
                      ? `Prossimo: ${getBroadcastCustomers()[broadcastIndex]?.nome || ""} ${getBroadcastCustomers()[broadcastIndex]?.cognome || ""} (${broadcastIndex + 1}/${getBroadcastCustomers().length})`
                      : getBroadcastCustomers().length > 0
                        ? "Hai aperto WhatsApp per tutti i clienti in lista."
                        : "Aggiungi un numero di telefono o reincludi almeno un cliente nei broadcast."}
                  </div>
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={sendAutomaticBroadcast}
                    disabled={broadcastSending}
                    style={{ opacity: broadcastSending ? 0.65 : 1 }}
                  >
                    {broadcastSending ? "Invio in corso..." : "Invia broadcast automatico"}
                  </button>
                  <button type="button" className="soft-button" onClick={openNextBroadcastWhatsApp}>
                    Invia al prossimo cliente
                  </button>
                  <button type="button" className="soft-button" onClick={copyBroadcastMessage}>
                    Copia testo
                  </button>
                </div>
              </div>

              {broadcastResult && (
                <div className="inline-info-box" style={{ marginTop: "12px" }}>
                  <div>
                    <div className="row-title">
                      {broadcastResult.success ? "Risultato broadcast" : "Errore broadcast"}
                    </div>
                    <div className="row-subtitle">
                      {broadcastResult.success
                        ? `Inviati: ${broadcastResult.sent_count || 0} · Errori: ${broadcastResult.failed_count || 0} · Saltati: ${broadcastResult.skipped_count || 0}`
                        : (broadcastResult.error || "Errore non specificato")}
                    </div>
                  </div>
                </div>
              )}

              {broadcastHistory.length > 0 && (
                <div className="inline-info-box" style={{ marginTop: "12px" }}>
                  <div>
                    <div className="row-title">Ultimi broadcast</div>
                    <div className="row-subtitle">
                      {broadcastHistory.slice(0, 3).map((item) =>
                        `${new Date(item.created_at).toLocaleString("it-IT")} · inviati ${item.sent_count}/${item.target_count}`
                      ).join(" | ")}
                    </div>
                  </div>
                </div>
              )}

              <div className="table-wrap" style={{ marginTop: "14px", maxHeight: "420px", overflow: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Telefono</th>
                      <th>Invio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getBroadcastCustomers().length === 0 ? (
                      <tr>
                        <td colSpan="3">Nessun cliente valido o tutti esclusi dai broadcast.</td>
                      </tr>
                    ) : (
                      getBroadcastCustomers().map((user) => (
                        <tr key={user.id}>
                          <td>{user.nome} {user.cognome}</td>
                          <td>{user.telefono}</td>
                          <td>
                            <button type="button" className="primary-button" onClick={() => openBroadcastWhatsApp(user)}>
                              Invia su WhatsApp
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="panel-subtitle" style={{ marginTop: "12px" }}>
                Nota: il broadcast automatico usa WAHA se configurato nel backend. In alternativa puoi usare l'invio guidato cliente per cliente.
              </div>
            </div>
          </div>
        )}

        {qrModalUser && (
          <div className="qr-backdrop" onClick={closeCustomerQr}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">QR WebApp cliente</h2>
                  <div className="panel-subtitle">
                    {qrModalUser.nome} {qrModalUser.cognome}
                  </div>
                </div>

                <button type="button" className="ghost-button" onClick={closeCustomerQr}>
                  Chiudi
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <img
                  className="qr-image"
                  src={getCustomerQrImageUrl(qrModalUser)}
                  alt={`QR Code WebApp ${qrModalUser.nome || ""}`}
                />
              </div>

              <div style={{ marginTop: "16px" }}>
                <input
                  readOnly
                  value={getCustomerAppUrl(qrModalUser)}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button type="button" className="soft-button" onClick={() => copyCustomerAppUrl(qrModalUser)}>
                  Copia link
                </button>
                <button type="button" className="soft-button" onClick={() => copyCustomerOnboardingMessage(qrModalUser)}>
                  Copia msg
                </button>
                <button type="button" className="primary-button" onClick={() => openCustomerApp(qrModalUser)}>
                  Apri WebApp
                </button>
              </div>
            </div>
          </div>
        )}

        {whatsAppModalUser && (
          <div className="qr-backdrop" onClick={() => setWhatsAppModalUser(null)}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">WhatsApp personalizzato</h2>
                  <div className="panel-subtitle">
                    {whatsAppModalUser.nome} {whatsAppModalUser.cognome} · {whatsAppModalUser.telefono || "telefono non disponibile"}
                  </div>
                </div>

                <button type="button" className="ghost-button" onClick={() => setWhatsAppModalUser(null)}>
                  Chiudi
                </button>
              </div>

              <div className="inline-info-box" style={{ marginTop: "14px" }}>
                <div className="row-title">Template rapidi</div>
                <div className="action-row">
                  <button type="button" className="small-button" onClick={() => setWhatsAppMessage(getWhatsAppTemplate("welcome", whatsAppModalUser))}>
                    Benvenuto
                  </button>
                  <button type="button" className="small-button" onClick={() => setWhatsAppMessage(getWhatsAppTemplate("promo", whatsAppModalUser))}>
                    Promo
                  </button>
                  <button type="button" className="small-button" onClick={() => setWhatsAppMessage(getWhatsAppTemplate("assistenza", whatsAppModalUser))}>
                    Assistenza
                  </button>
                  <button type="button" className="small-button" onClick={() => setWhatsAppMessage(getWhatsAppTemplate("scontrino", whatsAppModalUser))}>
                    Scontrino
                  </button>
                </div>
              </div>

              <Field label="Messaggio">
                <textarea
                  value={whatsAppMessage}
                  onChange={(e) => setWhatsAppMessage(e.target.value)}
                  placeholder="Scrivi qui il messaggio WhatsApp per il cliente..."
                  style={{ minHeight: "180px", marginTop: "12px" }}
                />
              </Field>

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button type="button" className="primary-button" onClick={sendCustomWhatsApp}>
                  Apri WhatsApp
                </button>

                <button type="button" className="soft-button" onClick={copyCustomWhatsAppMessage}>
                  Copia testo
                </button>

                <button type="button" className="ghost-button" onClick={() => setWhatsAppMessage("")}>
                  Pulisci
                </button>
              </div>

              <div className="panel-subtitle" style={{ marginTop: "14px", lineHeight: 1.5 }}>
                Il messaggio viene aperto in WhatsApp Web/App già compilato. L'invio finale resta manuale, così puoi controllarlo prima di mandarlo.
              </div>
            </div>
          </div>
        )}

        {receiptUploadModal && (
          <div className="qr-backdrop" onClick={() => setReceiptUploadModal(null)}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Upload scontrino da telefono</h2>
                  <div className="panel-subtitle">
                    {receiptUploadModal.device.marca} {receiptUploadModal.device.modello}
                  </div>
                </div>

                <button type="button" className="ghost-button" onClick={() => setReceiptUploadModal(null)}>
                  Chiudi
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <img
                  className="qr-image"
                  src={getReceiptUploadQrImageUrl(receiptUploadModal.uploadUrl)}
                  alt="QR upload scontrino"
                />
              </div>

              <div style={{ marginTop: "16px" }}>
                <input
                  readOnly
                  value={receiptUploadModal.uploadUrl}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button type="button" className="soft-button" onClick={copyReceiptUploadUrl}>
                  Copia link
                </button>

                <button type="button" className="primary-button" onClick={() => window.open(receiptUploadModal.uploadUrl, "_blank")}>
                  Apri pagina
                </button>
              </div>

              <div className="panel-subtitle" style={{ marginTop: "14px", lineHeight: 1.5 }}>
                Scansiona il QR con il telefono del negozio, fotografa lo scontrino e caricalo direttamente.
                Il link scade alle {new Date(receiptUploadModal.expires_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.
              </div>
            </div>
          </div>
        )}

        <nav className="mobile-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeSection === item.id ? "active" : ""}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}

function KpiCard({ label, value, compact = false }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={compact ? { fontSize: "26px" } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}



