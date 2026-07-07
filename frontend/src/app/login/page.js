"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  async function login(e) {
    e.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessageType("error");
      setMessage("Inserisci email e password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.token) {
        setMessageType("error");
        setMessage(data.message || "Credenziali non valide.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("sa_token", data.token);

      if (data.user) {
        localStorage.setItem("sa_user", JSON.stringify(data.user));
      }

      setMessageType("success");
      setMessage("Accesso riuscito. Apertura dashboard...");
      window.location.href = "/";
    } catch (err) {
      setMessageType("error");
      setMessage("Impossibile contattare il server. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset(e) {
    e.preventDefault();
    setMessage("");

    const targetEmail = (forgotEmail || email || "").trim();

    if (!targetEmail) {
      setMessageType("error");
      setMessage("Inserisci l'email da recuperare.");
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail })
      });

      const data = await res.json().catch(() => ({}));

      setMessageType(res.ok ? "success" : "error");
      setMessage(
        data.message ||
          "Se l'indirizzo è registrato, la procedura di recupero è stata avviata."
      );
    } catch (err) {
      setMessageType("error");
      setMessage("Impossibile avviare il recupero password. Riprova tra poco.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Smart Assistance login">
        <div className="brand-pill">Smart Assistance</div>
        <h1>Gestione assistenza e WebApp clienti</h1>
        <p>
          Accedi al pannello amministrativo per gestire clienti, dispositivi,
          offerte live, privacy, guide e report di sistema.
        </p>

        <div className="login-badges">
          <span>Admin Dashboard</span>
          <span>Backup monitorati</span>
          <span>WebApp clienti</span>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card-header">
          <p className="eyebrow">Accesso riservato</p>
          <h2>Accedi al pannello</h2>
          <p>Usa le credenziali amministratore Smart Assistance.</p>
        </div>

        <form onSubmit={login} className="login-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="admin@smartassistance.local"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (!forgotEmail) setForgotEmail(e.target.value);
              }}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="La tua password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {message ? (
            <div className={`login-message ${messageType}`} role="status">
              {message}
            </div>
          ) : null}

          <button type="submit" disabled={loading}>
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>

          <button
            type="button"
            className="forgot-button"
            onClick={() => {
              setShowForgot((value) => !value);
              setMessage("");
              setForgotEmail((value) => value || email);
            }}
          >
            Password dimenticata?
          </button>
        </form>

        {showForgot ? (
          <form className="forgot-panel" onSubmit={requestPasswordReset}>
            <h3>Recupero password</h3>
            <p>
              Inserisci l'email dell'account. Se è registrata, verrà generato un
              link monouso con scadenza breve.
            </p>

            <label>
              <span>Email da recuperare</span>
              <input
                type="email"
                autoComplete="username"
                placeholder="email account"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </label>

            <button type="submit" className="secondary-action" disabled={forgotLoading}>
              {forgotLoading ? "Invio richiesta..." : "Avvia recupero"}
            </button>
          </form>
        ) : null}

        <div className="login-footer-note">
          Area protetta con token amministratore, rate limit login e reset password monouso.
        </div>
      </section>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
          gap: 34px;
          align-items: center;
          padding: 48px;
          color: #e5eefc;
          background:
            radial-gradient(circle at top left, rgba(56, 189, 248, 0.24), transparent 34%),
            radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.24), transparent 34%),
            linear-gradient(135deg, #07111f 0%, #0b1220 42%, #111827 100%);
          font-family: Arial, Helvetica, sans-serif;
        }

        .login-hero { max-width: 680px; }

        .brand-pill {
          display: inline-flex;
          padding: 9px 14px;
          border: 1px solid rgba(125, 211, 252, 0.38);
          border-radius: 999px;
          color: #bae6fd;
          background: rgba(15, 23, 42, 0.72);
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .login-hero h1 {
          margin: 26px 0 18px;
          font-size: clamp(38px, 5vw, 68px);
          line-height: 0.96;
          letter-spacing: -0.06em;
        }

        .login-hero p {
          max-width: 560px;
          color: #b6c7de;
          font-size: 18px;
          line-height: 1.65;
        }

        .login-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 28px;
        }

        .login-badges span {
          padding: 10px 13px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.26);
          color: #dbeafe;
          font-size: 13px;
          font-weight: 700;
        }

        .login-card {
          width: 100%;
          max-width: 460px;
          justify-self: center;
          border-radius: 30px;
          padding: 30px;
          background: rgba(248, 250, 252, 0.96);
          color: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.52);
          box-shadow: 0 30px 90px rgba(2, 6, 23, 0.42);
        }

        .login-card-header { margin-bottom: 24px; }

        .eyebrow {
          margin: 0 0 8px;
          color: #2563eb;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.12em;
          font-weight: 800;
        }

        .login-card h2 {
          margin: 0 0 8px;
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        .login-card-header p:not(.eyebrow), .forgot-panel p {
          margin: 0;
          color: #64748b;
          line-height: 1.5;
        }

        .login-form, .forgot-panel {
          display: grid;
          gap: 16px;
        }

        .forgot-panel {
          margin-top: 18px;
          padding: 18px;
          border-radius: 20px;
          background: #eef6ff;
          border: 1px solid #bfdbfe;
        }

        .forgot-panel h3 {
          margin: 0;
          font-size: 18px;
        }

        label {
          display: grid;
          gap: 8px;
          font-size: 13px;
          color: #334155;
          font-weight: 800;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe3ee;
          border-radius: 16px;
          padding: 14px 15px;
          outline: none;
          color: #0f172a;
          background: #ffffff;
          font-size: 15px;
        }

        input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

        button[type="submit"], .secondary-action {
          margin-top: 4px;
          border: 0;
          border-radius: 16px;
          padding: 14px 18px;
          color: white;
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 16px 35px rgba(37, 99, 235, 0.28);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .forgot-button {
          border: 0;
          background: transparent;
          color: #2563eb;
          font-weight: 800;
          cursor: pointer;
          padding: 8px;
        }

        .forgot-button:hover { text-decoration: underline; }

        .login-message {
          padding: 12px 14px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.45;
          border: 1px solid transparent;
        }

        .login-message.error {
          color: #991b1b;
          background: #fee2e2;
          border-color: #fecaca;
        }

        .login-message.success {
          color: #166534;
          background: #dcfce7;
          border-color: #bbf7d0;
        }

        .login-message.info {
          color: #1e3a8a;
          background: #dbeafe;
          border-color: #bfdbfe;
        }

        .login-footer-note {
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 860px) {
          .login-page {
            grid-template-columns: 1fr;
            padding: 28px 18px;
          }

          .login-hero h1 { font-size: 40px; }

          .login-card {
            max-width: none;
            padding: 24px;
            border-radius: 24px;
          }
        }
      `}</style>
    </main>
  );
}
