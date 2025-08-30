// scripts/generate-stats.js
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    timezone: "Z", // pour récupérer des dates stables (UTC)
  });

  // Comptage par jour (inscriptions quotidiennes)
  const [rows] = await conn.execute(`
    SELECT DATE(ua_date_join) AS d, COUNT(*) AS daily_count
    FROM users_activities
    GROUP BY DATE(ua_date_join)
    ORDER BY d ASC
  `);

  await conn.end();

  // Ajout du cumul total
  let cumulative = 0;
  const out = rows.map(r => {
    cumulative += Number(r.daily_count);
    // r.d est "YYYY-MM-DD" (string) via mysql2 -> on le garde tel quel
    return { date: r.d, daily_count: Number(r.daily_count), cumulative_count: cumulative };
  });

  // Écrit dans dist/data/members.json
  const targetDir = path.join("dist", "data");
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "members.json"), JSON.stringify(out, null, 2));

  // Copie le site statique vers dist/
  copyDir("site", "dist");

  console.log("✅ Généré : dist/data/members.json + site copié dans dist/");
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

main().catch(err => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
