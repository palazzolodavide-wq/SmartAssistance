"use client";

import { useEffect, useState } from "react";

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
  "Altra"
];

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
const [userSearch, setUserSearch] = useState("");
const [deviceSearch, setDeviceSearch] = useState("");
const [editingUserId, setEditingUserId] = useState(null);
const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [offers, setOffers] = useState([]);
  const [editingOfferId, setEditingOfferId] = useState(null);
const [clickStats, setClickStats] = useState({
  summary: {
    total_clicks: 0,
    clicks_24h: 0,
    clicks_7d: 0,
  },
  topProducts: [],
  recentClicks: [],
});
const [amazonSearch, setAmazonSearch] = useState("");
const [amazonResults, setAmazonResults] = useState([]);

        const [offerForm, setOfferForm] = useState({
          categoria: "",
          partner: "amazon",
          titolo: "",
          descrizione: "",
          affiliate_url: "",
        });


const today = new Date();

const expiring30 = devices.filter((d) => {

  if (!d.scadenza_garanzia) return false;

  const expiry = new Date(d.scadenza_garanzia);

  const diffDays = Math.ceil(
    (expiry - today) /
    (1000 * 60 * 60 * 24)
  );

  return diffDays >= 0 &&
         diffDays <= 30;

}).length;

const expiring60 = devices.filter((d) => {

  if (!d.scadenza_garanzia) return false;

  const expiry = new Date(d.scadenza_garanzia);

  const diffDays = Math.ceil(
    (expiry - today) /
    (1000 * 60 * 60 * 24)
  );

  return diffDays >= 0 &&
         diffDays <= 60;

}).length;

const expiring90 = devices.filter((d) => {

  if (!d.scadenza_garanzia) return false;

  const expiry = new Date(d.scadenza_garanzia);

  const diffDays = Math.ceil(
    (expiry - today) /
    (1000 * 60 * 60 * 24)
  );

  return diffDays >= 0 &&
         diffDays <= 90;

}).length;

function getWarrantyColor(dateString) {

  if (!dateString) return "";

  const expiry = new Date(dateString);

  const days = Math.ceil(
    (expiry - today) /
    (1000 * 60 * 60 * 24)
  );

  if (days < 0) {
    return "#ff9999";
  }

  if (days <= 30) {
    return "#ffcccc";
  }

  if (days <= 90) {
    return "#fff0b3";
  }

  return "#ccffcc";
}

function daysToExpiry(dateString) {

  if (!dateString) return 99999;

  const expiry = new Date(dateString);

  return Math.ceil(
    (expiry - today) /
    (1000 * 60 * 60 * 24)
  );
}

const expiringDevices = devices.filter((d) => {

  const days = daysToExpiry(
    d.scadenza_garanzia
  );

  return days >= 0 && days <= 90;

});

  const [userForm, setUserForm] = useState({
    nome: "",
    cognome: "",
    email: "",
    telefono: "",
  });

  const [deviceForm, setDeviceForm] = useState({
    user_id: "",
    marca: "",
    modello: "",
    categoria: "",
    data_acquisto: "",
    scadenza_garanzia: "",
    note: "",
  });

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
          const usersRes = await apiFetch(`${API_URL}/api/users`);
          const usersData = await usersRes.json();

          const devicesRes = await apiFetch(`${API_URL}/api/devices`);
          const devicesData = await devicesRes.json();

          const offersRes = await apiFetch(`${API_URL}/api/offers`);
          const offersData = await offersRes.json();

          try {
            const statsRes = await apiFetch(`${API_URL}/api/stats/clicks`);
            const statsData = await statsRes.json();

            if (statsData.success) {
              setClickStats(statsData);
            }
          } catch (statsErr) {
            console.error("Errore statistiche click", statsErr);
          }

          setUsers(usersData);
          setDevices(devicesData);
          setOffers(offersData);
    } catch (err) {
      console.error(err);
      alert("Errore caricamento dati");
    }
  }

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      window.location.href = "/login";
      return;
    }

    setAuthReady(true);
    loadData();
  }, []);

  async function saveUser(e) {
  e.preventDefault();

  try {

    const isEdit = editingUserId !== null;

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

    if (!isEdit && data.user?.app_token) {
      const appUrl = getCustomerAppUrl(data.user);
      alert(`Cliente creato. Link WebApp:\n${appUrl}`);
    } else {
      alert(
        isEdit
          ? "Cliente aggiornato"
          : "Cliente creato"
      );
    }

    setEditingUserId(null);

    setUserForm({
      nome: "",
      cognome: "",
      email: "",
      telefono: "",
    });

    await loadData();

  } catch (err) {

    alert(err.message);

  }
}

  async function saveDevice(e) {
    e.preventDefault();

    try {
      const isEdit = editingDeviceId !== null;

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
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore creazione dispositivo");
        return;
      }

      alert(
        isEdit
          ? "Dispositivo aggiornato"
          : "Dispositivo creato"
      );

      setEditingDeviceId(null);

      setDeviceForm({
        user_id: "",
        marca: "",
        modello: "",
        data_acquisto: "",
        scadenza_garanzia: "",
        note: "",
      });

      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }


  async function deleteUser(id) {

    if (!confirm("Sei sicuro di voler eliminare il cliente?")) {
      return;
    }

    try {

      const res = await apiFetch(
        `${API_URL}/api/users/${id}`,
        {
          method: "DELETE",
        }
      );

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
  async function deleteDevice(id) {

    if (!confirm("Sei sicuro di voler eliminare il dispositivo?")) {
      return;
    }

    try {

      const res = await apiFetch(
        `${API_URL}/api/devices/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore eliminazione");
        return;
      }

      alert("Dispositivo eliminato");

      await loadData();

    } catch (err) {

      alert(err.message);

    }
  }


  async function deleteOffer(id) {

    if (!confirm("Sei sicuro di voler eliminare l'offerta?")) {
      return;
    }

    try {

      const res = await apiFetch(
        `${API_URL}/api/offers/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Errore eliminazione");
        return;
      }

      alert("Offerta eliminata");

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
        alert(data.error || "Errore salvataggio");
        return;
      }

      alert(isEdit ? "Offerta aggiornata" : "Offerta creata");

      setEditingOfferId(null);

      setOfferForm({
        categoria: "",
        titolo: "",
        descrizione: "",
        affiliate_url: "",
      });

      await loadData();

    } catch (err) {

      alert(err.message);

    }
  }

async function searchAmazon() {

  try {

    const res = await apiFetch(
      `${API_URL}/api/amazon/search?q=${encodeURIComponent(amazonSearch)}`
    );

    const data = await res.json();

    setAmazonResults(
      data?.SearchResult?.Items || []
    );

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
        image_url: item.Images?.Primary?.Medium?.URL || ""
      };
      const res = await apiFetch(
          `${API_URL}/api/offers`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(offer)
          }
        );
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



  if (!authReady) {
    return (
      <main
        style={{
          padding: "30px",
          fontFamily: "Arial",
        }}
      >
        Verifica accesso...
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "30px",
        fontFamily: "Arial",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ margin: 0 }}>Smart Assistance</h1>

        <button
          type="button"
          onClick={logout}
          style={{
            border: "1px solid #ddd",
            background: "#f8fafc",
            borderRadius: "8px",
            padding: "10px 14px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            minWidth: "200px",
            borderRadius: "8px",
          }}
        >
          <h3>Clienti</h3>
          <h1>{users.length}</h1>
        </div>

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            minWidth: "200px",
            borderRadius: "8px",
          }}
        >
          <h3>Dispositivi</h3>
          <h1>{devices.length}</h1>
        </div>

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            minWidth: "200px",
            borderRadius: "8px",
          }}
        >
          <h3>Garanzie 30gg</h3>
          <h1>{expiring30}</h1>
        </div>

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            minWidth: "200px",
            borderRadius: "8px",
          }}
        >
          <h3>Garanzie 60gg</h3>
          <h1>{expiring60}</h1>
        </div>

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            minWidth: "200px",
            borderRadius: "8px",
          }}
        >
          <h3>Garanzie 90gg</h3>
          <h1>{expiring90}</h1>
        </div>

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            minWidth: "200px",
            borderRadius: "8px",
            background: "#f8fafc",
          }}
        >
          <h3>Click Totali</h3>
          <h1>{clickStats.summary?.total_clicks || 0}</h1>
        </div>

        <div
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            minWidth: "200px",
            borderRadius: "8px",
            background: "#f8fafc",
          }}
        >
          <h3>Click 24h</h3>
          <h1>{clickStats.summary?.clicks_24h || 0}</h1>
        </div>
      </div>

      <hr />

      <h2>Statistiche Click Offerte</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: "20px",
          marginBottom: "25px",
        }}
      >
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "15px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Prodotti più cliccati</h3>

          <table
            border="1"
            cellPadding="5"
            style={{ width: "100%" }}
          >
            <thead>
              <tr>
                <th>Click</th>
                <th>Prodotto</th>
              </tr>
            </thead>
            <tbody>
              {clickStats.topProducts?.length === 0 ? (
                <tr>
                  <td colSpan="2">Nessun click registrato.</td>
                </tr>
              ) : (
                clickStats.topProducts.map((item, index) => (
                  <tr key={item.asin || item.titolo || index}>
                    <td>{item.clicks}</td>
                    <td>{item.titolo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "15px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Ultimi click</h3>

          <table
            border="1"
            cellPadding="5"
            style={{ width: "100%" }}
          >
            <thead>
              <tr>
                <th>Ora</th>
                <th>Cliente</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {clickStats.recentClicks?.length === 0 ? (
                <tr>
                  <td colSpan="3">Nessun click recente.</td>
                </tr>
              ) : (
                clickStats.recentClicks.map((click, index) => (
                  <tr key={`${click.created_at}-${index}`}>
                    <td>
                      {new Date(click.created_at).toLocaleString("it-IT")}
                    </td>
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
        </section>
      </div>

      <hr />

<h2>Garanzie in Scadenza</h2>

<table
  border="1"
  cellPadding="5"
  style={{
    width: "100%",
    marginBottom: "20px",
  }}
>
  <thead>
    <tr>
      <th>Cliente</th>
      <th>Dispositivo</th>
      <th>Scadenza</th>
      <th>Giorni</th>
    </tr>
  </thead>

  <tbody>
    {expiringDevices.map((d) => (
      <tr key={d.id}>
        <td>
          {d.nome} {d.cognome}
        </td>

        <td>
          {d.marca} {d.modello}
        </td>

        <td>
          {new Date(
            d.scadenza_garanzia
          ).toLocaleDateString("it-IT")}
        </td>

        <td>
          {daysToExpiry(
            d.scadenza_garanzia
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>

      <hr />

      <h2>
  {editingUserId
    ? "Modifica Cliente"
    : "Nuovo Cliente"}
</h2>

      <form onSubmit={saveUser}>
        <input
          placeholder="Nome"
          value={userForm.nome}
          onChange={(e) =>
            setUserForm({
              ...userForm,
              nome: e.target.value,
            })
          }
        />

        <br />
        <br />

        <input
          placeholder="Cognome"
          value={userForm.cognome}
          onChange={(e) =>
            setUserForm({
              ...userForm,
              cognome: e.target.value,
            })
          }
        />

        <br />
        <br />

        <input
          placeholder="Email"
          value={userForm.email}
          onChange={(e) =>
            setUserForm({
              ...userForm,
              email: e.target.value,
            })
          }
        />

        <br />
        <br />

        <input
          placeholder="Telefono"
          value={userForm.telefono}
          onChange={(e) =>
            setUserForm({
              ...userForm,
              telefono: e.target.value,
            })
          }
        />

        <br />
        <br />

        <>
  <button type="submit">
    {editingUserId
      ? "Aggiorna Cliente"
      : "Salva Cliente"}
  </button>

  {editingUserId && (
    <button
      type="button"
      style={{ marginLeft: "10px" }}
      onClick={() => {
        setEditingUserId(null);

        setUserForm({
          nome: "",
          cognome: "",
          email: "",
          telefono: "",
        });
      }}
    >
      Annulla
    </button>
  )}
</>
      </form>

      <hr />

      <h2>
  {editingDeviceId
    ? "Modifica Dispositivo"
    : "Nuovo Dispositivo"}
</h2>

      <form onSubmit={saveDevice}>
        <select
          value={deviceForm.user_id}
          onChange={(e) =>
            setDeviceForm({
              ...deviceForm,
              user_id: e.target.value,
            })
          }
        >
          <option value="">
            Seleziona Cliente
          </option>

          {users
            .filter((u) => u.role === "customer")
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.customer_code} - {u.nome} {u.cognome}
              </option>
            ))}
        </select>

        <br />
        <br />

        <select
  value={deviceForm.marca}
  onChange={(e) =>
    setDeviceForm({
      ...deviceForm,
      marca: e.target.value,
    })
  }
>
  <option value="">
    Seleziona Marca
  </option>

  {BRANDS.map((brand) => (
    <option
      key={brand}
      value={brand}
    >
      {brand}
    </option>
  ))}
</select>

        <br />
        <br />

        <input
          placeholder="Modello"
          value={deviceForm.modello}
          onChange={(e) =>
            setDeviceForm({
              ...deviceForm,
              modello: e.target.value,
            })
          }
        />

        <br />
        <br />

        <label>Data Acquisto</label>
        <br />

        <input
  type="date"
  value={deviceForm.data_acquisto}
  onChange={(e) => {

    const purchaseDate = e.target.value;

    let warrantyDate = "";

    if (purchaseDate) {
      const d = new Date(purchaseDate);

      d.setFullYear(d.getFullYear() + 2);

      warrantyDate =
        d.toISOString().split("T")[0];
    }

    setDeviceForm({
      ...deviceForm,
      data_acquisto: purchaseDate,
      scadenza_garanzia: warrantyDate,
    });
  }}
/>

        <br />
        <br />

        <label>Scadenza Garanzia</label>
        <br />

        <input
          type="date"
          value={deviceForm.scadenza_garanzia}
          onChange={(e) =>
            setDeviceForm({
              ...deviceForm,
              scadenza_garanzia: e.target.value,
            })
          }
        />

        <br />
        <br />


            <label>Categoria</label>
            <br />

            <select
              value={deviceForm.categoria}
              onChange={(e) =>
                setDeviceForm({
                  ...deviceForm,
                  categoria: e.target.value,
                })
              }
            >
              <option value="">Seleziona categoria</option>
              <option value="smartphone">Smartphone</option>
              <option value="pc">PC</option>
              <option value="tablet">Tablet</option>
              <option value="tv">TV</option>
              <option value="stampante">Stampante</option>
              <option value="altro">Altro</option>
            </select>

            <br />
            <br />
        <textarea
          rows="4"
          cols="50"
          placeholder="Note"
          value={deviceForm.note}
          onChange={(e) =>
            setDeviceForm({
              ...deviceForm,
              note: e.target.value,
            })
          }
        />

        <br />
        <br />

        <button type="submit">
          Salva Dispositivo
        </button>
      </form>

      <hr />

      <hr />



        <hr />

        <h2>Ricerca Amazon</h2>

        <input
          type="text"
          placeholder="Galaxy S24"
          value={amazonSearch}
          onChange={(e) =>
            setAmazonSearch(e.target.value)
          }
        />

        <button
          type="button"
          style={{ marginLeft: "10px" }}
          onClick={searchAmazon}
        >
          Cerca
        </button>

        <br />
        <br />

        {amazonResults.map((item) => (

          <div
            key={item.ASIN}
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              marginBottom: "10px"
            }}
          >

            <img
              src={
                item.Images?.Primary?.Medium?.URL
              }
              width="120"
              alt=""
            />

            <br />
            <br />

            <strong>
              {item.ItemInfo?.Title?.DisplayValue}
            </strong>

            <br />
            <br />

            <button
              type="button"
              onClick={() =>
                importAmazonProduct(item)
              }
            >
              Importa Offerta
            </button>

          </div>

        ))}

    <h2>Gestione Offerte</h2>

    <form onSubmit={saveOffer}>

      <select
        value={offerForm.categoria}
        onChange={(e) =>
          setOfferForm({
            ...offerForm,
            categoria: e.target.value,
          })
        }
      >
        <option value="">Categoria</option>
        <option value="smartphone">Smartphone</option>
        <option value="pc">PC</option>
        <option value="tablet">Tablet</option>
        <option value="tv">TV</option>
        <option value="stampante">Stampante</option>
      </select>

      <br />
      <br />

      <select
        value={offerForm.partner}
        onChange={(e) =>
          setOfferForm({
            ...offerForm,
            partner: e.target.value,
          })
        }
      >
        <option value="amazon">Amazon</option>
        <option value="awin">Awin</option>
        <option value="ebay">eBay</option>
        <option value="altro">Altro</option>
      </select>

      <br />
      <br />

      <input
        placeholder="Titolo"
        value={offerForm.titolo}
        onChange={(e) =>
          setOfferForm({
            ...offerForm,
            titolo: e.target.value,
          })
        }
      />

      <br />
      <br />

      <textarea
        rows="3"
        cols="50"
        placeholder="Descrizione"
        value={offerForm.descrizione}
        onChange={(e) =>
          setOfferForm({
            ...offerForm,
            descrizione: e.target.value,
          })
        }
      />

      <br />
      <br />

      <input
        placeholder="Link affiliato"
        value={offerForm.affiliate_url}
        onChange={(e) =>
          setOfferForm({
            ...offerForm,
            affiliate_url: e.target.value,
          })
        }
      />

      <br />
      <br />

      <button type="submit">
        {editingOfferId
          ? "Aggiorna Offerta"
          : "Salva Offerta"}
      </button>

    </form>

    <br />

    <table border="1" cellPadding="5" style={{ width: "100%" }}>
      <thead>
        <tr>
          <th>Categoria</th>
          <th>Partner</th>
          <th>Titolo</th>
          <th>Azione</th>
        </tr>
      </thead>

      <tbody>
        {offers.map((o) => (
          <tr key={o.id}>
            <td>{o.categoria}</td>
            <td>{o.partner}</td>
            <td>{o.titolo}</td>

            <td>
              <button
                onClick={() => {
                  setEditingOfferId(o.id);

                  setOfferForm({
                    categoria: o.categoria || "",
                    partner: o.partner || "amazon",
                    titolo: o.titolo || "",
                    descrizione: o.descrizione || "",
                    affiliate_url: o.affiliate_url || "",
                  });
                }}
              >
                Modifica
              </button>

              <button
                style={{ marginLeft: "10px" }}
                onClick={() => deleteOffer(o.id)}
              >
                Elimina
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <hr />

<h2>Clienti Registrati</h2>

<input
  type="text"
  placeholder="Cerca cliente..."
  value={userSearch}
  onChange={(e) => setUserSearch(e.target.value)}
/>

<table border="1" cellPadding="5" style={{ width: "100%", marginTop: "10px" }}>
  <thead>
    <tr>
      <th>Codice</th>
      <th>Nome</th>
      <th>Email</th>
      <th>Telefono</th>
      <th>WebApp</th>
      <th>Azione</th>
    </tr>
  </thead>
  <tbody>
    {users
      .filter((u) => {
        const s = userSearch.toLowerCase();

        return (
          u.customer_code?.toLowerCase().includes(s) ||
          u.nome?.toLowerCase().includes(s) ||
          u.cognome?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s) ||
          u.telefono?.toLowerCase().includes(s)
        );
      })
      .map((u) => (
        <tr key={u.id}>
          <td>{u.customer_code}</td>
          <td>{u.nome} {u.cognome}</td>
          <td>{u.email}</td>
          <td>{u.telefono}</td>
          <td>
            {u.app_token ? (
              <>
                <button
                  type="button"
                  onClick={() => openCustomerApp(u)}
                >
                  Apri
                </button>

                <button
                  type="button"
                  style={{ marginLeft: "8px" }}
                  onClick={() => copyCustomerAppUrl(u)}
                >
                  Copia
                </button>
              </>
            ) : (
              <span style={{ color: "#999" }}>
                Token assente
              </span>
            )}
          </td>
<td>
  <button
    onClick={() => {
      setEditingUserId(u.id);

      setUserForm({
        nome: u.nome || "",
        cognome: u.cognome || "",
        email: u.email || "",
        telefono: u.telefono || "",
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }}
  >
        Modifica
  </button>

  <button
    style={{ marginLeft: "10px" }}
    onClick={() => deleteUser(u.id)}
  >
    Elimina
  </button>
</td>
        </tr>
      ))}
  </tbody>
</table>

<h2 style={{ marginTop: "30px" }}>
  Dispositivi Registrati
</h2>

<input
  type="text"
  placeholder="Cerca dispositivo..."
  value={deviceSearch}
  onChange={(e) => setDeviceSearch(e.target.value)}
/>

<table border="1" cellPadding="5" style={{ width: "100%", marginTop: "10px" }}>
  <thead>
    <tr>
      <th>Cliente</th>
      <th>Marca</th>
      <th>Modello</th>
      <th>Garanzia</th>
      <th>Azione</th>
    </tr>
  </thead>
  <tbody>
    {devices
      .filter((d) => {
        const s = deviceSearch.toLowerCase();

        return (
          d.nome?.toLowerCase().includes(s) ||
          d.cognome?.toLowerCase().includes(s) ||
          d.marca?.toLowerCase().includes(s) ||
          d.modello?.toLowerCase().includes(s)
        );
      })
      .map((d) => (
        <tr key={d.id}>
          <td>{d.nome} {d.cognome}</td>
          <td>{d.marca}</td>
          <td>{d.modello}</td>
          <td
            style={{
              backgroundColor: getWarrantyColor(
                d.scadenza_garanzia
              ),
              fontWeight: "bold",
            }}
          >
            {d.scadenza_garanzia
              ? new Date(d.scadenza_garanzia).toLocaleDateString("it-IT")
              : "-"}
          </td>

          <td>
            <button
              onClick={() => {

                setEditingDeviceId(d.id);

                setDeviceForm({
                      user_id: "",
                      marca: d.marca || "",
                      modello: d.modello || "",
                      categoria: d.categoria || "",
                      data_acquisto: d.data_acquisto
                        ? d.data_acquisto.substring(0,10)
                        : "",
                      scadenza_garanzia: d.scadenza_garanzia
                        ? d.scadenza_garanzia.substring(0,10)
                        : "",
                      note: d.note || "",
                    });
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });

              }}
            >
              Modifica
            </button>

            <button
              style={{
                marginLeft: "10px"
              }}
              onClick={() => deleteDevice(d.id)}
            >
              Elimina
            </button>

          </td>

        </tr>
      ))}
  </tbody>
</table>
    </main>
  );
}

































