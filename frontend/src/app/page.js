"use client";

import { useEffect, useMemo, useState } from "react";

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
  { value: "desktop", label: "Desktop" },
];

const EMPTY_USER_FORM = {
  nome: "",
  cognome: "",
  email: "",
  telefono: "",
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
  categoria: "",
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

  const [clickStats, setClickStats] = useState({
    summary: {
      total_clicks: 0,
      clicks_24h: 0,
      clicks_7d: 0,
    },
    topProducts: [],
    recentClicks: [],
  });

  const [qrModalUser, setQrModalUser] = useState(null);
  const [receiptUploadModal, setReceiptUploadModal] = useState(null);
  const [whatsAppModalUser, setWhatsAppModalUser] = useState(null);
  const [whatsAppMessage, setWhatsAppMessage] = useState("");
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
    });

    setDeviceReceiptQrAfterSave(false);
    setActiveSection("customers");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startAddDeviceForCustomer(user) {
    setEditingDeviceId(null);
    setDeviceForm({
      ...EMPTY_DEVICE_FORM,
      user_id: user.id,
    });
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

  async function saveOffer(e) {
    e.preventDefault();

    try {
      const isEdit = editingOfferId !== null;

      const res = await apiFetch(
        isEdit
          ? `${API_URL}/api/offers/${editingOfferId}`
          : `${API_URL}/api/offers`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(offerForm),
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

  async function searchAmazon() {
    if (!amazonSearch.trim()) {
      alert("Inserisci una ricerca");
      return;
    }

    try {
      const res = await apiFetch(
        `${API_URL}/api/amazon/search?q=${encodeURIComponent(amazonSearch)}`
      );

      const data = await res.json();

      setAmazonResults(data?.SearchResult?.Items || []);
    } catch (err) {
      alert(err.message);
    }
  }

  async function importAmazonProduct(item) {
    try {
      const offer = {
        categoria: "smartphone",
        partner: "amazon",
        titolo: item.ItemInfo?.Title?.DisplayValue || "",
        descrizione: item.ItemInfo?.Title?.DisplayValue || "",
        affiliate_url: item.DetailPageURL || "",
        image_url: item.Images?.Primary?.Medium?.URL || "",
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

      alert("Prodotto importato");
      await loadData();
    } catch (err) {
      alert(err.message);
    }
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
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 4px 18px;
          border-bottom: 1px solid rgba(255,255,255,.10);
        }

        .brand-icon {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          background: linear-gradient(135deg,#2563eb,#60a5fa);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          box-shadow: 0 12px 30px rgba(37,99,235,.35);
        }

        .brand-title {
          font-size: 19px;
          font-weight: 900;
          line-height: 1.1;
        }

        .brand-subtitle {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 3px;
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
          .dashboard-grid {
            grid-template-columns: 1fr;
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
          <div className="brand-icon">SA</div>
          <div>
            <div className="brand-title">Smart Assistance</div>
            <div className="brand-subtitle">Admin Dashboard</div>
          </div>
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
          <section className="section-grid">
            <div>
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      {editingUserId ? "Modifica cliente" : "Nuovo cliente + dispositivo"}
                    </h2>
                    <div className="panel-subtitle">
                      Il flusso corretto è cliente + primo dispositivo. Se il cliente esiste già, aggiungi solo il dispositivo.
                    </div>
                  </div>
                </div>

                <form className="form-grid" onSubmit={saveUser}>
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

                  {!editingUserId && (
                    <>
                      <div
                        style={{
                          marginTop: "8px",
                          paddingTop: "14px",
                          borderTop: "1px solid #e2e8f0",
                        }}
                      >
                        <h3 style={{ margin: "0 0 4px" }}>Primo dispositivo</h3>
                        <div className="panel-subtitle">
                          Obbligatorio quando registri un nuovo cliente.
                        </div>
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

                      <Field label="Data acquisto">
                        <input
                          type="date"
                          value={newCustomerDeviceForm.data_acquisto}
                          onChange={(e) => setNewCustomerDeviceForm({ ...newCustomerDeviceForm, data_acquisto: e.target.value })}
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

                      <div className="inline-info-box">
                        <div>
                          <div className="row-title">Scontrino acquisto</div>
                          <div className="row-subtitle">
                            Il dispositivo viene creato prima del QR. Subito dopo il salvataggio apriamo il QR per caricarlo da telefono.
                          </div>
                        </div>

                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={newCustomerReceiptQrAfterSave}
                            onChange={(e) => setNewCustomerReceiptQrAfterSave(e.target.checked)}
                          />
                          Genera QR telefono dopo la creazione
                        </label>
                      </div>
                    </>
                  )}

                  <div className="form-actions">
                    <button type="submit" className="primary-button">
                      {editingUserId ? "Salva cliente" : "Crea cliente + dispositivo"}
                    </button>

                    {editingUserId && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setEditingUserId(null);
                          setUserForm(EMPTY_USER_FORM);
                        }}
                      >
                        Annulla
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="panel" id="existing-device-form">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      {editingDeviceId ? "Modifica dispositivo" : "Aggiungi dispositivo a cliente esistente"}
                    </h2>
                    <div className="panel-subtitle">
                      Usa questo modulo quando il cliente è già registrato.
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

                  <Field label="Data acquisto">
                    <input
                      type="date"
                      value={deviceForm.data_acquisto}
                      onChange={(e) => setDeviceForm({ ...deviceForm, data_acquisto: e.target.value })}
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

                  <div className="inline-info-box">
                    <div>
                      <div className="row-title">Scontrino acquisto</div>
                      <div className="row-subtitle">
                        {editingDeviceId
                          ? "Gestisci subito lo scontrino del dispositivo selezionato."
                          : "Il dispositivo viene creato prima del QR. Subito dopo il salvataggio apriamo il QR per caricarlo da telefono."}
                      </div>
                    </div>

                    {editingDeviceId && editingDevice ? (
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
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="primary-button">
                      {editingDeviceId ? "Salva dispositivo" : "Aggiungi dispositivo"}
                    </button>

                    {(editingDeviceId || deviceForm.user_id) && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setEditingDeviceId(null);
                          setDeviceForm(EMPTY_DEVICE_FORM);
                          setDeviceReceiptQrAfterSave(false);
                        }}
                      >
                        Annulla
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div>
              <div className="panel">
                <div className="toolbar">
                  <div>
                    <h2 className="panel-title">Clienti registrati</h2>
                    <div className="panel-subtitle">
                      {filteredUsers.length} clienti visualizzati.
                    </div>
                  </div>

                  <input
                    className="search-input"
                    placeholder="Cerca cliente..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Contatti</th>
                        <th>WebApp</th>
                        <th>Onboarding</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="5">Nessun cliente trovato.</td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.id}>
                            <td>
                              <div className="row-title">
                                {user.nome} {user.cognome}
                              </div>
                              <div className="row-subtitle">
                                {user.customer_code || "-"}
                              </div>
                            </td>
                            <td>
                              <div>{user.email || "-"}</div>
                              <div className="row-subtitle">{user.telefono || "-"}</div>
                            </td>
                            <td>
                              {user.app_token ? (
                                <div className="action-row">
                                  <button type="button" className="small-button" onClick={() => openCustomerApp(user)}>
                                    Apri
                                  </button>
                                  <button type="button" className="small-button" onClick={() => copyCustomerAppUrl(user)}>
                                    Copia
                                  </button>
                                </div>
                              ) : (
                                <span className="badge badge-red">Token assente</span>
                              )}
                            </td>
                            <td>
                              {user.app_token ? (
                                <div className="action-row">
                                  <button type="button" className="small-button" onClick={() => copyCustomerOnboardingMessage(user)}>
                                    Copia msg
                                  </button>
                                  <button type="button" className="small-button" onClick={() => openCustomerWhatsApp(user)}>
                                    WhatsApp
                                  </button>
                                  <button type="button" className="small-button" onClick={() => openCustomWhatsAppModal(user)}>
                                    Msg libero
                                  </button>
                                  <button type="button" className="small-button" onClick={() => openCustomerQr(user)}>
                                    QR
                                  </button>
                                </div>
                              ) : (
                                <span className="row-subtitle">Non disponibile</span>
                              )}
                            </td>
                            <td>
                              <div className="action-row">
                                <button type="button" className="soft-button" onClick={() => startAddDeviceForCustomer(user)}>
                                  Aggiungi device
                                </button>
                                <button type="button" className="soft-button" onClick={() => editUser(user)}>
                                  Modifica
                                </button>
                                <button type="button" className="danger-button" onClick={() => deleteUser(user.id)}>
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

              <div className="panel">
                <div className="toolbar">
                  <div>
                    <h2 className="panel-title">Dispositivi associati</h2>
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
                        <th>Scontrino</th>
                        <th>Note</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.length === 0 ? (
                        <tr>
                          <td colSpan="6">Nessun dispositivo trovato.</td>
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
                              <div className="row-subtitle">{device.categoria || "-"}</div>
                            </td>
                            <td>
                              <span className={getWarrantyClass(device.scadenza_garanzia)}>
                                {formatDate(device.scadenza_garanzia)}
                              </span>
                            </td>
                            <td>
                              <div className="action-row">
                                {device.receipt_data_url && (
                                  <>
                                    <button type="button" className="small-button" onClick={() => openDeviceReceipt(device)}>
                                      Apri
                                    </button>
                                    <button type="button" className="danger-button" onClick={() => deleteDeviceReceipt(device)}>
                                      Rimuovi
                                    </button>
                                  </>
                                )}

                                <label className="small-button" style={{ cursor: "pointer" }}>
                                  {device.receipt_data_url ? "Sostituisci" : "Carica da PC"}
                                  <input
                                    type="file"
                                    accept="application/pdf,image/jpeg,image/png,image/webp"
                                    style={{ display: "none" }}
                                    onChange={(event) => uploadDeviceReceipt(device, event)}
                                  />
                                </label>

                                <button type="button" className="primary-button" onClick={() => createReceiptUploadQr(device)}>
                                  QR telefono
                                </button>
                              </div>

                              {device.receipt_uploaded_at && (
                                <div className="row-subtitle">
                                  Caricato il {formatDate(device.receipt_uploaded_at)}
                                </div>
                              )}
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
            </div>
          </section>
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

                <Field label="Data acquisto">
                  <input
                    type="date"
                    value={deviceForm.data_acquisto}
                    onChange={(e) => setDeviceForm({ ...deviceForm, data_acquisto: e.target.value })}
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
                            <div className="row-subtitle">{device.categoria || "-"}</div>
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
                    <input
                      value={offerForm.categoria}
                      onChange={(e) => setOfferForm({ ...offerForm, categoria: e.target.value })}
                    />
                  </Field>

                  <Field label="Partner">
                    <input
                      value={offerForm.partner}
                      onChange={(e) => setOfferForm({ ...offerForm, partner: e.target.value })}
                    />
                  </Field>

                  <Field label="Titolo">
                    <input
                      value={offerForm.titolo}
                      onChange={(e) => setOfferForm({ ...offerForm, titolo: e.target.value })}
                    />
                  </Field>

                  <Field label="Descrizione">
                    <textarea
                      value={offerForm.descrizione}
                      onChange={(e) => setOfferForm({ ...offerForm, descrizione: e.target.value })}
                    />
                  </Field>

                  <Field label="Link affiliato">
                    <input
                      value={offerForm.affiliate_url}
                      onChange={(e) => setOfferForm({ ...offerForm, affiliate_url: e.target.value })}
                    />
                  </Field>

                  <Field label="URL immagine">
                    <input
                      value={offerForm.image_url}
                      onChange={(e) => setOfferForm({ ...offerForm, image_url: e.target.value })}
                    />
                  </Field>

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
                        Cerca prodotti e importali nelle offerte.
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

                  {amazonResults.length > 0 && (
                    <div className="amazon-grid">
                      {amazonResults.map((item, index) => (
                        <article key={item.ASIN || index} className="product-card">
                          {item.Images?.Primary?.Medium?.URL && (
                            <img src={item.Images.Primary.Medium.URL} alt={item.ItemInfo?.Title?.DisplayValue || "Prodotto"} />
                          )}
                          <div className="row-title">
                            {item.ItemInfo?.Title?.DisplayValue || "Prodotto Amazon"}
                          </div>
                          <button type="button" className="soft-button" onClick={() => importAmazonProduct(item)}>
                            Importa
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
                              <td>{offer.categoria || "-"}</td>
                              <td>{offer.partner || "-"}</td>
                              <td>
                                {offer.affiliate_url ? (
                                  <button type="button" className="small-button" onClick={() => window.open(offer.affiliate_url, "_blank")}>
                                    Apri
                                  </button>
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
              <KpiCard label="Click totali" value={clickStats.summary?.total_clicks || 0} />
              <KpiCard label="Click 24h" value={clickStats.summary?.clicks_24h || 0} />
              <KpiCard label="Click 7 giorni" value={clickStats.summary?.clicks_7d || 0} />
              <KpiCard label="Prodotti cliccati" value={(clickStats.topProducts || []).length} />
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <h2 className="panel-title">Prodotti più cliccati</h2>
                <div className="table-wrap" style={{ marginTop: "14px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Click</th>
                        <th>Prodotto</th>
                        <th>Ultimo click</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clickStats.topProducts || []).length === 0 ? (
                        <tr>
                          <td colSpan="3">Nessun click registrato.</td>
                        </tr>
                      ) : (
                        clickStats.topProducts.map((item, index) => (
                          <tr key={item.asin || item.titolo || index}>
                            <td><span className="badge badge-blue">{item.clicks}</span></td>
                            <td>{item.titolo}</td>
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
                        <th>Fonte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clickStats.recentClicks || []).length === 0 ? (
                        <tr>
                          <td colSpan="3">Nessun click recente.</td>
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
