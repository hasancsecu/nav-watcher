import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();

/**
 * Parse a .env file into a key-value object without printing secrets.
 * Next.js loads .env.local automatically, but Prisma CLI and tsx do not.
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

const dotEnv = parseEnvFile(path.join(rootDir, ".env"));
const dotEnvLocal = parseEnvFile(path.join(rootDir, ".env.local"));

// Precedence: process.env (if already set externally) -> .env.local -> .env
const mergedEnv = {
  ...dotEnv,
  ...dotEnvLocal,
  ...process.env,
};

// If .env had file:./dev.db but .env.local has a real Postgres URL, ensure .env.local wins
if (dotEnvLocal.DATABASE_URL) {
  mergedEnv.DATABASE_URL = dotEnvLocal.DATABASE_URL;
}
if (dotEnvLocal.POSTGRES_URL && !mergedEnv.POSTGRES_URL) {
  mergedEnv.POSTGRES_URL = dotEnvLocal.POSTGRES_URL;
}
if (dotEnvLocal.DATABASE_URL_POOLED && !mergedEnv.DATABASE_URL_POOLED) {
  mergedEnv.DATABASE_URL_POOLED = dotEnvLocal.DATABASE_URL_POOLED;
}

// For schema push / migrations, Prisma Postgres recommends the direct DATABASE_URL (or POSTGRES_URL)
const directPgUrl =
  mergedEnv.DATABASE_URL ||
  mergedEnv.POSTGRES_URL ||
  mergedEnv.PRISMA_DATABASE_URL ||
  mergedEnv.DATABASE_URL_POOLED ||
  "";

if (
  directPgUrl.startsWith("postgres://") ||
  directPgUrl.startsWith("postgresql://") ||
  directPgUrl.startsWith("prisma+postgres://")
) {
  mergedEnv.DATABASE_URL = directPgUrl;
}

const args = process.argv.slice(2);
const generateOnly = args.includes("--generate-only");

console.log("[DB Setup] Generating Prisma Client for PostgreSQL...");
execSync("npx prisma generate", { stdio: "inherit", env: mergedEnv });

if (!generateOnly) {
  try {
    console.log("[DB Setup] Pushing Prisma schema to PostgreSQL database...");
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      stdio: "inherit",
      env: mergedEnv,
    });
    console.log("[DB Setup] Schema successfully synced with PostgreSQL.");
  } catch (err) {
    console.warn(
      "[DB Setup] Notice: Could not reach PostgreSQL server at build time. Proceeding with Next.js build.",
      err instanceof Error ? err.message : ""
    );
  }
}
