const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`Variabile ${name} mancante`);
  }

  return value;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function main() {
  const apiId = Number.parseInt(requiredEnv("TELEGRAM_API_ID"), 10);
  const apiHash = requiredEnv("TELEGRAM_API_HASH");
  const sessionFile = process.env.TELEGRAM_SESSION_FILE || "/app/session/telegram.session";

  if (!Number.isFinite(apiId)) {
    throw new Error("TELEGRAM_API_ID non valido");
  }

  ensureParentDir(sessionFile);

  const existingSession = fs.existsSync(sessionFile)
    ? fs.readFileSync(sessionFile, "utf8").trim()
    : "";

  const rl = readline.createInterface({ input, output });

  try {
    const client = new TelegramClient(
      new StringSession(existingSession),
      apiId,
      apiHash,
      {
        connectionRetries: 5
      }
    );

    await client.start({
      phoneNumber: async () => rl.question("Numero Telegram dedicato, formato internazionale (+39...): "),
      password: async () => rl.question("Password 2FA Telegram, se richiesta: "),
      phoneCode: async () => rl.question("Codice ricevuto su Telegram: "),
      onError: (err) => console.error("LOGIN TELEGRAM ERROR:", err.message || err)
    });

    const savedSession = client.session.save();

    fs.writeFileSync(sessionFile, savedSession, "utf8");

    const me = await client.getMe();

    console.log("");
    console.log("Login Telegram completato.");
    console.log(`Account: ${me.username ? "@" + me.username : me.firstName || me.id}`);
    console.log(`Sessione salvata in: ${sessionFile}`);
    console.log("");

    await client.disconnect();
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("LOGIN FAILED:", err.message || err);
  process.exit(1);
});
