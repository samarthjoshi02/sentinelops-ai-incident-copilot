import { PrismaClient } from "@prisma/client";
import { QdrantClient } from "@qdrant/js-client-rest";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

async function verifyPostgres() {
  console.log("🔄 Verifying Neon PostgreSQL connection via Prisma...");
  
  const connectionString = process.env.DATABASE_URL;
  console.log("Database connection string:", connectionString);
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not defined in environment.");
    return false;
  }
  
  // Clean quotes if any
  const cleanConnectionString = connectionString.replace(/^["']|["']$/g, "");
  
  const pool = new pg.Pool({ connectionString: cleanConnectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  try {
    // Attempt a simple count query
    const userCount = await prisma.user.count();
    console.log(`✅ PostgreSQL connection successful. User count: ${userCount}`);
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error);
    await prisma.$disconnect();
    return false;
  }
}

async function verifyQdrant() {
  console.log("🔄 Verifying local Qdrant connection...");
  const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
  const client = new QdrantClient({ url: qdrantUrl });
  try {
    const collections = await client.getCollections();
    console.log(`✅ Qdrant connection successful. Collections:`, collections);
    return true;
  } catch (error) {
    console.error("❌ Qdrant connection failed:", error);
    return false;
  }
}

async function verifyGemini() {
  console.log("🔄 Verifying Google Gemini API connection (Google AI Studio)...");
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("❌ GOOGLE_API_KEY is not defined in environment.");
    return false;
  }

  // Remove any surrounding quotes
  const cleanApiKey = apiKey.replace(/^["']|["']$/g, "");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanApiKey}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Respond with the word 'OK' only." }] }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Gemini API call failed with status ${response.status}:`, errorText);
      return false;
    }

    const data = await response.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    console.log(`✅ Gemini API connection successful. Response: "${text}"`);
    return true;
  } catch (error) {
    console.error("❌ Gemini API connection failed:", error);
    return false;
  }
}

async function verifyEnkryptAI() {
  console.log("🔄 Verifying Enkrypt AI Guardrails connection...");
  const apiKey = process.env.ENKRYPTAI_API_KEY;
  if (!apiKey) {
    console.error("❌ ENKRYPTAI_API_KEY is not defined in environment.");
    return false;
  }

  const cleanApiKey = apiKey.replace(/^["']|["']$/g, "");
  
  // Use the standard scan url
  const url = "https://api.enkryptai.com/guardrails/scan-url";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": cleanApiKey
      },
      body: JSON.stringify({
        url: "https://example.com",
        detectors: {
          injection_attack: { enabled: true }
        }
      })
    });

    // Enkrypt AI returns 200 on success. If 401, key is bad.
    if (response.status === 401) {
      console.error("❌ Enkrypt AI validation failed: 401 Unauthorized (Invalid API Key).");
      return false;
    }

    console.log(`✅ Enkrypt AI connection verified (HTTP Status: ${response.status}).`);
    return true;
  } catch (error) {
    console.error("❌ Enkrypt AI connection failed:", error);
    return false;
  }
}

function verifyAuthEnv() {
  console.log("🔄 Checking Auth.js & Google OAuth environment variables...");
  const authSecret = process.env.AUTH_SECRET;
  const googleId = process.env.AUTH_GOOGLE_ID;
  const googleSecret = process.env.AUTH_GOOGLE_SECRET;

  let valid = true;
  if (!authSecret || authSecret.replace(/^["']|["']$/g, "").length < 32) {
    console.error("❌ AUTH_SECRET must be defined and at least 32 characters long.");
    valid = false;
  } else {
    console.log("✅ AUTH_SECRET is set and valid.");
  }

  if (!googleId) {
    console.warn("⚠️ AUTH_GOOGLE_ID is missing.");
    valid = false;
  } else {
    console.log("✅ AUTH_GOOGLE_ID is set.");
  }

  if (!googleSecret || googleSecret === "your_google_client_secret_here") {
    console.warn("⚠️ AUTH_GOOGLE_SECRET is missing or set to placeholder.");
    valid = false;
  } else {
    console.log("✅ AUTH_GOOGLE_SECRET is set.");
  }

  return valid;
}

async function main() {
  console.log("====================================================");
  console.log("SentinelOps AI - Foundation Services Verification");
  console.log("====================================================");

  const postgresOk = await verifyPostgres();
  const qdrantOk = await verifyQdrant();
  const geminiOk = await verifyGemini();
  const enkryptOk = await verifyEnkryptAI();
  const authEnvOk = verifyAuthEnv();

  console.log("====================================================");
  if (postgresOk && qdrantOk && geminiOk && enkryptOk && authEnvOk) {
    console.log("🎉 Verification Completed: ALL SYSTEMS OPERATIONAL! 🎉");
    process.exit(0);
  } else {
    console.error("🚨 Verification Failed: Some services are offline/misconfigured. 🚨");
    process.exit(1);
  }
}

main();
