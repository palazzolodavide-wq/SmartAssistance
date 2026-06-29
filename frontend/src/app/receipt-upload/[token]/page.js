"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ReceiptUploadPage() {
  const params = useParams();
  const token = params?.token;

  const [info, setInfo] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scannerApplied, setScannerApplied] = useState(false);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function loadInfo() {
      try {
        setStatus("loading");
        setMessage("");

        const res = await fetch(`/api/receipt-upload/${token}`);
        const json = await res.json();

        if (!res.ok || json.success === false) {
          throw new Error(json.error || "Link non valido");
        }

        setInfo(json);
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Errore caricamento");
      }
    }

    if (token) {
      loadInfo();
    }
  }, [token]);

  function readFileAsDataUrl(selectedFile) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Impossibile leggere il file"));

      reader.readAsDataURL(selectedFile);
    });
  }

  function loadImageFromDataUrl(imageDataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Impossibile elaborare l'immagine"));

      image.src = imageDataUrl;
    });
  }

  function getPercentileFromHistogram(histogram, totalPixels, percentile) {
    const target = totalPixels * percentile;
    let sum = 0;

    for (let i = 0; i < histogram.length; i += 1) {
      sum += histogram[i];

      if (sum >= target) {
        return i;
      }
    }

    return 255;
  }

  async function applyScannerEffect(selectedFile) {
    const originalDataUrl = await readFileAsDataUrl(selectedFile);
    const image = await loadImageFromDataUrl(originalDataUrl);

    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const histogram = new Array(256).fill(0);
    const grayValues = new Uint8Array(width * height);

    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      const gray = Math.round(
        pixels[i] * 0.299 +
        pixels[i + 1] * 0.587 +
        pixels[i + 2] * 0.114
      );

      grayValues[p] = gray;
      histogram[gray] += 1;
    }

    const totalPixels = width * height;
    const low = getPercentileFromHistogram(histogram, totalPixels, 0.05);
    const high = Math.max(low + 24, getPercentileFromHistogram(histogram, totalPixels, 0.96));

    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      let clean = ((grayValues[p] - low) / (high - low)) * 255;

      clean = ((clean - 128) * 1.55) + 128 + 18;
      clean = Math.max(0, Math.min(255, clean));

      if (clean > 218) {
        clean = 255;
      } else if (clean < 38) {
        clean = 0;
      }

      pixels[i] = clean;
      pixels[i + 1] = clean;
      pixels[i + 2] = clean;
      pixels[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.88);
  }

  function buildScannedFilename(originalName) {
    const baseName = (originalName || "scontrino")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return `${baseName || "scontrino"}-scanner.jpg`;
  }

  async function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setMessage("Formato non supportato. Usa PDF, JPG, PNG o WEBP.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setMessage("File troppo grande. Limite massimo 5 MB.");
      return;
    }

    try {
      setMessage("");
      setScannerApplied(false);

      if (scannerEnabled && selectedFile.type.startsWith("image/")) {
        const scannedDataUrl = await applyScannerEffect(selectedFile);

        setFile({
          name: buildScannedFilename(selectedFile.name),
          type: "image/jpeg",
        });
        setDataUrl(scannedDataUrl);
        setPreviewUrl(scannedDataUrl);
        setScannerApplied(true);
        return;
      }

      const result = await readFileAsDataUrl(selectedFile);

      setFile(selectedFile);
      setDataUrl(result);
      setPreviewUrl(selectedFile.type === "application/pdf" ? "" : result);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function uploadReceipt() {
    if (!file || !dataUrl) {
      setMessage("Scatta o seleziona prima lo scontrino.");
      return;
    }

    try {
      setUploading(true);
      setMessage("");

      const res = await fetch(`/api/receipt-upload/${token}/receipt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name || "scontrino",
          mime_type: file.type,
          data_url: dataUrl,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Errore caricamento");
      }

      setStatus("done");
      setMessage("Scontrino caricato correttamente.");
    } catch (err) {
      setMessage(err.message || "Errore caricamento");
    } finally {
      setUploading(false);
    }
  }

  const customerName = `${info?.customer?.nome || ""} ${info?.customer?.cognome || ""}`.trim();
  const deviceName = `${info?.device?.marca || ""} ${info?.device?.modello || ""}`.trim();

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#0f172a",
      color: "#f8fafc",
      fontFamily: "Arial, sans-serif",
      padding: "18px",
    },
    shell: {
      maxWidth: "520px",
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
    card: {
      background: "#111827",
      border: "1px solid rgba(255,255,255,.08)",
      borderRadius: "22px",
      padding: "18px",
      marginBottom: "16px",
      boxShadow: "0 10px 28px rgba(0,0,0,.22)",
    },
    button: {
      width: "100%",
      border: "none",
      borderRadius: "18px",
      padding: "16px",
      background: "#2563eb",
      color: "white",
      fontWeight: "bold",
      fontSize: "17px",
      cursor: "pointer",
    },
    secondaryButton: {
      width: "100%",
      border: "1px solid rgba(255,255,255,.14)",
      borderRadius: "18px",
      padding: "16px",
      background: "rgba(255,255,255,.08)",
      color: "white",
      fontWeight: "bold",
      fontSize: "16px",
      cursor: "pointer",
      textAlign: "center",
      display: "block",
    },
    inputHidden: {
      display: "none",
    },
    preview: {
      width: "100%",
      maxHeight: "420px",
      objectFit: "contain",
      borderRadius: "18px",
      background: "#fff",
      marginTop: "14px",
    },
    muted: {
      color: "#cbd5e1",
      lineHeight: 1.5,
    },
  };

  if (status === "loading") {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <section style={styles.card}>Caricamento...</section>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <section style={styles.card}>
            <h1 style={{ marginTop: 0 }}>Link non disponibile</h1>
            <p style={styles.muted}>{message}</p>
          </section>
        </div>
      </main>
    );
  }

  if (status === "done") {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <section style={styles.hero}>
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>✅</div>
            <h1 style={{ margin: "0 0 10px" }}>Scontrino caricato</h1>
            <p style={styles.muted}>
              Puoi chiudere questa pagina. Lo scontrino è ora visibile nella WebApp cliente.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={{ fontSize: "14px", letterSpacing: ".08em", textTransform: "uppercase", opacity: .8, fontWeight: "bold" }}>
            Smart Assistance
          </div>
          <h1 style={{ margin: "16px 0 8px", fontSize: "30px", lineHeight: 1.1 }}>
            Carica scontrino
          </h1>
          <p style={styles.muted}>
            Scatta una foto allo scontrino o carica un file già presente sul telefono.
          </p>
        </section>

        <section style={styles.card}>
          <div style={{ color: "#93c5fd", fontWeight: "bold", marginBottom: "8px" }}>
            Cliente
          </div>
          <h2 style={{ margin: "0 0 6px" }}>{customerName || "Cliente"}</h2>
          <div style={styles.muted}>{info?.customer?.customer_code || ""}</div>

          <div style={{ height: "1px", background: "rgba(255,255,255,.10)", margin: "16px 0" }} />

          <div style={{ color: "#93c5fd", fontWeight: "bold", marginBottom: "8px" }}>
            Dispositivo
          </div>
          <h2 style={{ margin: 0 }}>{deviceName || "Dispositivo"}</h2>
          <div style={styles.muted}>{info?.device?.categoria || ""}</div>
        </section>

        <section style={styles.card}>
          <label
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.10)",
              borderRadius: "16px",
              padding: "14px",
              marginBottom: "14px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={scannerEnabled}
              onChange={(e) => setScannerEnabled(e.target.checked)}
              style={{
                width: "20px",
                height: "20px",
                marginTop: "2px",
              }}
            />
            <span>
              <strong>Effetto scanner automatico</strong>
              <br />
              <span style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: 1.45 }}>
                Migliora contrasto, bianco e nero, leggibilità e peso del file.
              </span>
            </span>
          </label>

          <label style={styles.secondaryButton}>
            📷 Scatta foto scontrino
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileChange}
              style={styles.inputHidden}
            />
          </label>

          <div style={{ height: "10px" }} />

          <label style={styles.secondaryButton}>
            📎 Carica file / PDF
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              style={styles.inputHidden}
            />
          </label>

          {file && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ color: "#cbd5e1", fontSize: "14px" }}>
                File selezionato: <strong>{file.name}</strong>
              </div>

              {scannerApplied && (
                <div
                  style={{
                    color: "#86efac",
                    fontSize: "14px",
                    marginTop: "8px",
                    lineHeight: 1.45,
                  }}
                >
                  Effetto scanner applicato automaticamente.
                </div>
              )}

              {previewUrl ? (
                <img src={previewUrl} alt="Anteprima scontrino" style={styles.preview} />
              ) : (
                <div style={{ ...styles.card, marginTop: "14px", background: "#1f2937" }}>
                  PDF selezionato.
                </div>
              )}
            </div>
          )}

          {message && (
            <div style={{ color: message.includes("correttamente") ? "#86efac" : "#fca5a5", marginTop: "14px", lineHeight: 1.45 }}>
              {message}
            </div>
          )}

          <div style={{ height: "16px" }} />

          <button
            type="button"
            onClick={uploadReceipt}
            disabled={uploading || !file}
            style={{
              ...styles.button,
              opacity: uploading || !file ? .55 : 1,
            }}
          >
            {uploading ? "Caricamento..." : "Salva scontrino"}
          </button>
        </section>

        <section style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Consiglio foto</h3>
          <p style={styles.muted}>
            Appoggia lo scontrino su una superficie scura, tieni il telefono parallelo e fotografa tutto il documento.
L'effetto scanner automatico è già attivo per le foto e migliora contrasto, bianco e leggibilità.
          </p>
        </section>
      </div>
    </main>
  );
}
