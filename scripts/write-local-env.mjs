// Writes .env.local (app) and .env.test.local (tests only) from the running local Supabase stack.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const raw = execSync("npx supabase status -o env", { encoding: "utf8" });
const status = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const apiUrl = status.API_URL;
const anonKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
const serviceKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
if (!apiUrl || !anonKey || !serviceKey) {
  console.error("Could not read keys from `supabase status`. Is `npm run db:start` running?");
  process.exit(1);
}

writeFileSync(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
    "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
    "",
  ].join("\n"),
);
writeFileSync(".env.test.local", [`SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`, ""].join("\n"));
console.log("Wrote .env.local and .env.test.local");
