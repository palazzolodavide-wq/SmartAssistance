"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function PasswordResetPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
  }, []);

  async function resetPassword(e) {
    e.preventDefault();
    setMessage("");

    if (!token) {
      setMessageType("error");
      setMessage("Token mancante o non valido.");
      return;
    }

    if (password.length < 8) {
      setMessageType("error");
      setMessage("La nuova password deve contenere almeno 8 caratteri.");
      return;
    }

    if (password !== confirmPassword) {
      setMessageType("error");
      setMessage("Le due password non coincidono.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json().catch(() => ({}));

      setMessageType(res.ok ? "success" : "error");
      setMessage(data.message || (res.ok ? "Password aggiornata." : "Reset non riuscito."));

      if (res.ok) {
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setMessageType("error");
      setMessage("Impossibile completare il reset. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="reset-page">
      <section className="reset-card">
        <div className="brand-pill">Smart Assistance</div>
        <p className="eyebrow">Recupero password</p>
        <h1>Reimposta password</h1>
        <p className="lead">
          Inserisci una nuova password. Il link è monouso e scade automaticamente.
        </p>

        <form onSubmit={resetPassword}>
          <label>
            <span>Nuova password</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Almeno 8 caratteri"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label>
            <span>Conferma password</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Ripeti nuova password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>

          {message ? (
            <div className={`message ${messageType}`} role="status">
              {message}
            </div>
          ) : null}

          <button type="submit" disabled={loading}>
            {loading ? "Aggiornamento..." : "Aggiorna password"}
          </button>
        </form>

        <a className="back-link" href="/login">Torna al login</a>
      </section>

      <style jsx>{`
        .reset-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          color: #0f172a;
          background:
            radial-gradient(circle at top left, rgba(56, 189, 248, 0.24), transparent 34%),
            linear-gradient(135deg, #07111f 0%, #0b1220 52%, #111827 100%);
          font-family: Arial, Helvetica, sans-serif;
        }

        .reset-card {
          width: 100%;
          max-width: 460px;
          border-radius: 30px;
          padding: 30px;
          background: rgba(248, 250, 252, 0.96);
          box-shadow: 0 30px 90px rgba(2, 6, 23, 0.42);
        }

        .brand-pill {
          display: inline-flex;
          padding: 9px 14px;
          border-radius: 999px;
          color: #075985;
          background: #e0f2fe;
          font-weight: 900;
        }

        .eyebrow {
          margin: 22px 0 8px;
          color: #2563eb;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.12em;
          font-weight: 800;
        }

        h1 {
          margin: 0 0 10px;
          font-size: 34px;
          letter-spacing: -0.04em;
        }

        .lead {
          margin: 0 0 24px;
          color: #64748b;
          line-height: 1.5;
        }

        form {
          display: grid;
          gap: 16px;
        }

        label {
          display: grid;
          gap: 8px;
          color: #334155;
          font-size: 13px;
          font-weight: 800;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe3ee;
          border-radius: 16px;
          padding: 14px 15px;
          color: #0f172a;
          background: #ffffff;
          font-size: 15px;
          outline: none;
        }

        input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

        button {
          border: 0;
          border-radius: 16px;
          padding: 14px 18px;
          color: white;
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .message {
          padding: 12px 14px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.45;
        }

        .message.error {
          color: #991b1b;
          background: #fee2e2;
          border: 1px solid #fecaca;
        }

        .message.success {
          color: #166534;
          background: #dcfce7;
          border: 1px solid #bbf7d0;
        }

        .back-link {
          display: inline-flex;
          margin-top: 20px;
          color: #2563eb;
          font-weight: 800;
          text-decoration: none;
        }

        .back-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </main>
  );
}
