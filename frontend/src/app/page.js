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
  broadcast_opt_out: false,
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

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "customers", label: "Clienti & Device", icon: "👥" },
  { id: "offers", label: "Offerte", icon: "🎁" },
  { id: "stats", label: "Statistiche", icon: "📈" },
];

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [offers, setOffers] = useState([]);

  const [userSearch, setUserSearch] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [offerSearch, setOfferSearch] = useState("");

  const [editingUserId, setEditingUserId] = useState(null);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editingOfferId, setEditingOfferId] = useState(null);

  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [newCustomerDeviceForm, setNewCustomerDeviceForm] = useState(EMPTY_DEVICE_FORM);
  const [deviceForm, setDeviceForm] = useState(EMPTY_DEVICE_FORM);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER_FORM);

  const [amazonSearch, setAmazonSearch] = useState("");
  const [amazonResults, setAmazonResults] = useState([]);
  const [amazonSearchMessage, setAmazonSearchMessage] = useState("");
  const [amazonImportCategories, setAmazonImportCategories] = useState({});

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

  async function loadData() {
    try {
      setLoading(true);

      const [usersRes, devicesRes, offersRes] = await Promise.all([
        apiFetch(`${API_URL}/api/users`),
        apiFetch(`${API_URL}/api/devices`),
        apiFetch(`${API_URL}/api/offers`),
      ]);

      const [usersData, devicesData, offersData] = await Promise.all([
        usersRes.json(),
        devicesRes.json(),
        offersRes.json(),
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setDevices(Array.isArray(devicesData) ? devicesData : []);
      setOffers(Array.isArray(offersData) ? offersData : []);

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
    const normalized = normalizeDeviceCategory(category);

    if (normalized === "notebook") return "💻";
    if (normalized === "desktop") return "🖥️";
    if (normalized === "smartphone") return "📱";

    return "🔧";
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

  function getBroadcastCustomers() {
    return users.filter((user) =>
      getWhatsAppPhone(user) &&
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
    const phone = getWhatsAppPhone(user);
    const message = encodeURIComponent(getCustomerOnboardingMessage(user));

    if (!phone) {
      alert("Telefono cliente non disponibile");
      return;
    }

    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  }

  function openCustomWhatsAppModal(user) {
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
              <span>{item.icon}</span>
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
                            {getDeviceIcon(device.categoria)} {device.marca} {device.modello}
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

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(userForm.broadcast_opt_out)}
                      onChange={(e) => setUserForm({ ...userForm, broadcast_opt_out: e.target.checked })}
                    />
                    Non includere questo cliente nei broadcast WhatsApp
                  </label>

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
                                  {user.broadcast_opt_out && (
                                    <span className="badge badge-orange" style={{ marginLeft: "8px" }}>
                                      No broadcast
                                    </span>
                                  )}
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
                                          <div className="row-title">Broadcast WhatsApp</div>
                                          <div className="row-subtitle">
                                            {user.broadcast_opt_out
                                              ? "Questo cliente è escluso dai messaggi broadcast automatici."
                                              : "Questo cliente riceve i messaggi broadcast automatici."}
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          className={user.broadcast_opt_out ? "primary-button" : "danger-button"}
                                          onClick={() => toggleBroadcastOptOut(user)}
                                        >
                                          {user.broadcast_opt_out ? "Includi nei broadcast" : "Non includere nei broadcast"}
                                        </button>
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
                                                <strong>{getDeviceIcon(device.categoria)} {device.marca} {device.modello}</strong>
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
                            <div className="row-title">{getDeviceIcon(device.categoria)} {device.marca} {device.modello}</div>
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
              <span>{item.icon}</span>
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
