const fs = require("fs");
const path = require("path");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`Variabile ${name} mancante`);
  }

  return value;
}

function envNumber(name, fallback, min, max) {
  const parsed = Number.parseInt(process.env[name] || "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function envBoolean(name, fallback = false) {
  const value = String(process.env[name] || "").trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "y", "si", "sì", "on"].includes(value);
}

function normalizeChannelRef(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "@")
    .replace(/^t\.me\//i, "@")
    .replace(/\s+/g, "");
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("STATE READ ERROR:", err.message);
    return fallback;
  }
}

function saveJson(filePath, value) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error || data?.reason || text || response.statusText;
    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  return data;
}

function extractButtonUrls(message) {
  const urls = [];
  const rows = message?.replyMarkup?.rows || [];

  for (const row of rows) {
    const buttons = row?.buttons || [];

    for (const button of buttons) {
      const url = button?.url;

      if (url && /^https?:\/\//i.test(String(url))) {
        urls.push(String(url));
      }
    }
  }

  return urls;
}

function buildImportText(message) {
  const parts = [];

  const body = String(message?.message || message?.text || "").trim();

  if (body) {
    parts.push(body);
  }

  const buttonUrls = extractButtonUrls(message);

  for (const url of buttonUrls) {
    parts.push(url);
  }

  return parts.join("\n").trim();
}

function getMessageId(message) {
  const id = Number.parseInt(message?.id || message?.messageId || 0, 10);

  return Number.isFinite(id) ? id : 0;
}

async function createTelegramClient() {
  const apiId = Number.parseInt(requiredEnv("TELEGRAM_API_ID"), 10);
  const apiHash = requiredEnv("TELEGRAM_API_HASH");
  const sessionFile = process.env.TELEGRAM_SESSION_FILE || "/app/session/telegram.session";

  if (!Number.isFinite(apiId)) {
    throw new Error("TELEGRAM_API_ID non valido");
  }

  if (!fs.existsSync(sessionFile)) {
    throw new Error(`Sessione Telegram non trovata: ${sessionFile}. Esegui prima npm run login.`);
  }

  const session = fs.readFileSync(sessionFile, "utf8").trim();

  if (!session) {
    throw new Error(`Sessione Telegram vuota: ${sessionFile}. Esegui prima npm run login.`);
  }

  const client = new TelegramClient(
    new StringSession(session),
    apiId,
    apiHash,
    {
      connectionRetries: 5
    }
  );

  await client.connect();

  const authorized = await client.isUserAuthorized();

  if (!authorized) {
    throw new Error("Sessione Telegram non autorizzata. Riesegui npm run login.");
  }

  const me = await client.getMe();

  console.log(`Telegram account connesso: ${me.username ? "@" + me.username : me.firstName || me.id}`);

  return client;
}

async function getImportConfig(backendUrl, secret) {
  return requestJson(`${backendUrl}/api/live-offers/import-config`, {
    headers: {
      "X-Live-Import-Secret": secret
    }
  });
}

async function sendImport(backendUrl, secret, payload) {
  return requestJson(`${backendUrl}/api/live-offers/import-external`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Live-Import-Secret": secret
    },
    body: JSON.stringify(payload)
  });
}

async function sendHeartbeat(backendUrl, secret, payload) {
  try {
    await requestJson(`${backendUrl}/api/live-offers/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Live-Import-Secret": secret
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("HEARTBEAT ERROR:", err.message);
  }
}

async function getRecentMessages(client, channelRef, limit) {
  const entity = await client.getEntity(channelRef);
  const messages = await client.getMessages(entity, { limit });

  return Array.from(messages || [])
    .filter((message) => getMessageId(message) > 0)
    .sort((a, b) => getMessageId(a) - getMessageId(b));
}

async function processChannel({
  client,
  source,
  state,
  backendUrl,
  secret,
  lookback,
  importOldOnFirstRun
}) {
  const stats = {
    imported: 0,
    skipped: 0,
    errors: 0
  };
  const channelRef = normalizeChannelRef(source.channel_ref);
  const stateKey = channelRef.toLowerCase();

  if (!channelRef) {
    stats.skipped += 1;
    return stats;
  }

  let messages = [];

  try {
    messages = await getRecentMessages(client, channelRef, lookback);
  } catch (err) {
    console.error(`CHANNEL READ ERROR ${channelRef}:`, err.message);
    stats.errors += 1;
    return stats;
  }

  if (messages.length === 0) {
    return stats;
  }

  const latestId = Math.max(...messages.map(getMessageId));

  if (!state.lastIds[stateKey] && !importOldOnFirstRun) {
    state.lastIds[stateKey] = latestId;
    console.log(`CHANNEL INIT ${channelRef}: marcati come già letti fino a ${latestId}`);
    return stats;
  }

  const lastId = Number.parseInt(state.lastIds[stateKey] || 0, 10) || 0;
  const newMessages = messages.filter((message) => getMessageId(message) > lastId);

  for (const message of newMessages) {
    const messageId = getMessageId(message);
    const text = buildImportText(message);

    if (!text) {
      state.lastIds[stateKey] = Math.max(state.lastIds[stateKey] || 0, messageId);
      stats.skipped += 1;
      console.log(`LIVE SKIP ${channelRef} #${messageId}: testo/link assente`);
      continue;
    }

    try {
      const result = await sendImport(backendUrl, secret, {
        text,
        source_channel: channelRef,
        telegram_message_id: messageId
      });

      if (result.success) {
        stats.imported += 1;
        console.log(
          `LIVE IMPORT ${channelRef} #${messageId}: ${result.asin || result.offer?.asin || "ok"}${result.duplicate ? " duplicate-update" : ""}`
        );
      } else {
        stats.skipped += 1;
        console.log(`LIVE SKIP ${channelRef} #${messageId}: ${result.reason || result.error || "skip"}`);
      }
    } catch (err) {
      stats.errors += 1;
      console.error(`LIVE IMPORT ERROR ${channelRef} #${messageId}:`, err.message);
      continue;
    }

    state.lastIds[stateKey] = Math.max(state.lastIds[stateKey] || 0, messageId);
  }

  return stats;
}

async function main() {
  const backendUrl = requiredEnv("SMARTASSISTANCE_BACKEND_URL").replace(/\/+$/g, "");
  const secret = requiredEnv("LIVE_IMPORT_SECRET");
  const sessionFile = process.env.TELEGRAM_SESSION_FILE || "/app/session/telegram.session";
  const stateFile = process.env.TELEGRAM_STATE_FILE || "/app/session/telegram-live-state.json";
  const pollSeconds = envNumber("TELEGRAM_LIVE_POLL_SECONDS", 60, 15, 3600);
  const lookback = envNumber("TELEGRAM_LIVE_LOOKBACK", 20, 1, 100);
  const importOldOnFirstRun = envBoolean("TELEGRAM_IMPORT_OLD_ON_FIRST_RUN", false);

  ensureParentDir(sessionFile);
  ensureParentDir(stateFile);

  const client = await createTelegramClient();
  const state = loadJson(stateFile, { lastIds: {} });

  console.log(`Backend: ${backendUrl}`);
  console.log(`Polling: ogni ${pollSeconds}s; lookback ${lookback}; import storico iniziale: ${importOldOnFirstRun}`);

  while (true) {
    try {
      const config = await getImportConfig(backendUrl, secret);

      if (!config?.settings?.enabled || !config?.settings?.telegram_auto_import_enabled) {
        console.log("Offerte live o import Telegram disattivati da admin.");
        await sendHeartbeat(backendUrl, secret, {
          status: "paused",
          message: "Offerte live o import Telegram disattivati da admin",
          sources_count: 0,
          imported_count: 0,
          skipped_count: 0,
          error_count: 0
        });
        await sleep(pollSeconds * 1000);
        continue;
      }

      const sources = Array.isArray(config.sources) ? config.sources : [];

      if (sources.length === 0) {
        console.log("Nessun canale Telegram abilitato in admin.");
        await sendHeartbeat(backendUrl, secret, {
          status: "warning",
          message: "Nessun canale Telegram abilitato in admin",
          sources_count: 0,
          imported_count: 0,
          skipped_count: 0,
          error_count: 0
        });
        await sleep(pollSeconds * 1000);
        continue;
      }

      const totals = {
        imported: 0,
        skipped: 0,
        errors: 0
      };

      for (const source of sources) {
        const stats = await processChannel({
          client,
          source,
          state,
          backendUrl,
          secret,
          lookback,
          importOldOnFirstRun
        });

        totals.imported += stats?.imported || 0;
        totals.skipped += stats?.skipped || 0;
        totals.errors += stats?.errors || 0;
      }

      saveJson(stateFile, state);

      await sendHeartbeat(backendUrl, secret, {
        status: totals.errors > 0 ? "warning" : "ok",
        message: totals.errors > 0 ? "Polling completato con alcuni errori" : "Polling completato",
        sources_count: sources.length,
        imported_count: totals.imported,
        skipped_count: totals.skipped,
        error_count: totals.errors
      });
    } catch (err) {
      console.error("WORKER LOOP ERROR:", err.message);

      await sendHeartbeat(backendUrl, secret, {
        status: "error",
        message: err.message,
        sources_count: 0,
        imported_count: 0,
        skipped_count: 0,
        error_count: 1
      });
    }

    await sleep(pollSeconds * 1000);
  }
}

main().catch((err) => {
  console.error("FATAL:", err.message || err);
  process.exit(1);
});
