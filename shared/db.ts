import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

const cleanConnectionString = connectionString.replace(/^["']|["']$/g, "");

// Instantiate a single shared pg Pool and PrismaClient
const pool = new pg.Pool({ connectionString: cleanConnectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
