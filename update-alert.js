// update-alert.js
// Перевіряє стан повітряної тривоги в Рівненському районі через API alerts.in.ua
// і записує результат у Firebase Realtime Database.
//
// Змінні середовища (задаються через GitHub Secrets):
//   FIREBASE_SERVICE_ACCOUNT - вміст JSON-файлу service account (весь файл одним рядком/текстом)
//   ALERTS_TOKEN             - токен API alerts.in.ua

const admin = require("firebase-admin");

const OBLAST_NAME = "Рівненська область";
const RAION_NAME = "Рівненський район";
const DB_PATH = "alerts/rivne_district"; // TODO: підправ під свою структуру бази

// --- Firebase init ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://liceum28-63003-default-rtdb.firebaseio.com",
});

const db = admin.database();

// --- alerts.in.ua ---
const ALERTS_TOKEN = process.env.ALERTS_TOKEN;
const ALERTS_URL = "https://api.alerts.in.ua/v1/alerts/active.json";

async function fetchActiveAlerts() {
  const res = await fetch(ALERTS_URL, {
    headers: { Authorization: `Bearer ${ALERTS_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`alerts.in.ua API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.alerts || [];
}

// Тривога в районі активна, якщо:
//  - є тривога на рівні всієї Рівненської області (oblast), АБО
//  - є окрема тривога саме на Рівненський район (raion)
function isRivneDistrictAlertActive(alerts) {
  return alerts.some((alert) => {
    if (alert.location_oblast !== OBLAST_NAME) return false;
    if (alert.location_type === "oblast") return true;
    if (alert.location_type === "raion" && alert.location_title === RAION_NAME) return true;
    return false;
  });
}

async function main() {
  const alerts = await fetchActiveAlerts();
  const active = isRivneDistrictAlertActive(alerts);

  await db.ref(DB_PATH).set({
    active,
    updatedAt: admin.database.ServerValue.TIMESTAMP,
  });

  console.log(`[${new Date().toISOString()}] Рівненський район: active=${active}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Помилка:", err);
    process.exit(1);
  });
