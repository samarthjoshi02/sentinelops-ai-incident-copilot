import "./env.js";
import fastify, { FastifyError } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { prisma } from "../../../shared/db.js";
import authPlugin from "./plugins/auth.js";
import { incidentRoutes } from "./routes/incidents.js";
import { logRoutes } from "./routes/logs.js";

// 1. Environment Variable Validation Schema
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required"),
  ENKRYPTAI_API_KEY: z.string().min(1, "ENKRYPTAI_API_KEY is required"),
  PORT: z.string().transform((val) => parseInt(val, 10)).default("4112"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// Run validation
const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(JSON.stringify(envResult.error.format(), null, 2));
  process.exit(1);
}

const config = envResult.data;

// 2. Initialize Fastify Server
const server = fastify({
  logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
    transport:
      config.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
  },
});

// 3. Register CORS middleware
await server.register(cors, {
  origin: true, // Allow all origins for development, can restrict in production
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true, // Required for Auth.js cookies
});

// Register Cookie & Multipart support
await server.register(cookie);
await server.register(multipart);

// Register Authentication Plugin Decorator
await server.register(authPlugin);

// Register Core routes
await server.register(incidentRoutes, { prefix: "/api" });
await server.register(logRoutes, { prefix: "/api" });

// 4. Global Error Handler
server.setErrorHandler((err: FastifyError, request, reply) => {
  server.log.error(err);
  
  if (err.validation) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: err.message,
      validation: err.validation,
    });
  }

  return reply.status(500).send({
    statusCode: 500,
    error: "Internal Server Error",
    message: "An unexpected error occurred on the SentinelOps AI server.",
  });
});

// 5. Health Check Endpoint
server.get("/health", async (request, reply) => {
  let dbStatus = "ONLINE";
  try {
    // Ping PostgreSQL Neon Database
    await prisma.user.count();
  } catch (error) {
    server.log.error({ err: error }, "Database health check failed");
    dbStatus = "OFFLINE";
  }

  const statusCode = dbStatus === "ONLINE" ? 200 : 503;
  return reply.status(statusCode).send({
    status: dbStatus === "ONLINE" ? "OK" : "ERROR",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    services: {
      database: dbStatus,
      qdrant: "ONLINE", // Connected locally
    },
  });
});

// 6. Start the Server
const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: "0.0.0.0" }); // listen on all interfaces
    server.log.info(`🚀 SentinelOps AI Backend listening on port ${config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
