import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../../../../shared/db.js";
import { TimelineEventType, IncidentSeverity, IncidentStatus } from "@prisma/client";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

// Make sure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to validate file extension
const ALLOWED_EXTENSIONS = [".log", ".txt", ".json", ".csv"];
function validateExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

export async function logRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // 1. POST /api/logs/upload - Raw Log upload and DB registration
  fastify.post("/logs/upload", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file({
        limits: {
          fileSize: 10 * 1024 * 1024 // 10MB limit
        }
      });

      if (!data) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "No log file was provided in the multipart request."
        });
      }

      const filename = data.filename;
      if (!validateExtension(filename)) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: `Forbidden file extension. Allowed extensions are: ${ALLOWED_EXTENSIONS.join(", ")}`
        });
      }

      // Check if incidentId is provided as a field
      const incidentId = data.fields.incidentId 
        ? (data.fields.incidentId as any).value as string 
        : undefined;

      // Verify incident existence if incidentId is provided
      if (incidentId) {
        const incidentExists = await prisma.incident.findUnique({ where: { id: incidentId } });
        if (!incidentExists) {
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: `Target incident with ID ${incidentId} does not exist.`
          });
        }
      }

      // Generate unique path & handle streams
      const fileId = crypto.randomUUID();
      const ext = path.extname(filename);
      const targetFilename = `${fileId}${ext}`;
      const targetPath = path.join(UPLOADS_DIR, targetFilename);

      const hash = crypto.createHash("sha256");
      const writeStream = fs.createWriteStream(targetPath);

      let fileSize = 0;
      let limitExceeded = false;

      // Calculate hash & size on stream data
      data.file.on("data", (chunk: Buffer) => {
        fileSize += chunk.length;
        if (fileSize > 10 * 1024 * 1024) {
          limitExceeded = true;
          data.file.destroy(); // Cancel stream
        } else {
          hash.update(chunk);
        }
      });

      // Pipe file to target path
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        data.file.pipe(writeStream);
      });

      if (limitExceeded) {
        // Delete partial file
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        return reply.status(413).send({
          statusCode: 413,
          error: "Payload Too Large",
          message: "Uploaded file size exceeds the maximum limit of 10MB."
        });
      }

      const checksum = hash.digest("hex");
      const uploaderId = request.user?.id;

      // Create database record
      const logFileRecord = await prisma.$transaction(async (tx) => {
        const log = await tx.logFile.create({
          data: {
            id: fileId,
            fileName: filename,
            fileType: data.mimetype,
            fileSize,
            filePath: targetPath,
            checksum,
            incidentId,
            uploaderId
          }
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            userId: uploaderId,
            action: "LOG_FILE_UPLOADED",
            entityType: "LogFile",
            entityId: log.id,
            details: { fileName: filename, fileSize, checksum, incidentId }
          }
        });

        // If linked to an incident, append timeline log
        if (incidentId) {
          await tx.incidentTimeline.create({
            data: {
              incidentId,
              eventDescription: `Log file "${filename}" was uploaded and linked by ${request.user?.name || "Operative"}.`,
              type: TimelineEventType.HUMAN
            }
          });
        }

        return log;
      });

      return reply.status(201).send(logFileRecord);
    } catch (error: any) {
      fastify.log.error("Log upload error:", error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Failed to upload and parse log file."
      });
    }
  });

  // 2. POST /api/incidents/pipeline - Ingest log and auto-create Incident
  fastify.post("/incidents/pipeline", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file({
        limits: {
          fileSize: 10 * 1024 * 1024
        }
      });

      if (!data) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Pipeline requires a multipart file parameter."
        });
      }

      const filename = data.filename;
      const mimetype = data.mimetype;
      const fileStream = data.file;

      // Extract and validate title
      const titleField = data.fields.title ? (data.fields.title as any).value as string : undefined;
      const title = titleField?.trim();
      if (!title || title.length < 3) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Pipeline requires an incident 'title' of at least 3 characters."
        });
      }

      // Extract description
      const description = data.fields.description 
        ? (data.fields.description as any).value as string 
        : undefined;

      // Validate extension
      if (!validateExtension(filename)) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: `Forbidden log extension. Whitelist: ${ALLOWED_EXTENSIONS.join(", ")}`
        });
      }

      // Parse severity
      let severity = IncidentSeverity.MEDIUM;
      const severityField = data.fields.severity 
        ? (data.fields.severity as any).value as string 
        : undefined;

      if (severityField && Object.values(IncidentSeverity).includes(severityField as any)) {
        severity = severityField as IncidentSeverity;
      }

      // Generate paths
      const fileId = crypto.randomUUID();
      const ext = path.extname(filename);
      const targetFilename = `${fileId}${ext}`;
      const targetPath = path.join(UPLOADS_DIR, targetFilename);

      const hash = crypto.createHash("sha256");
      const writeStream = fs.createWriteStream(targetPath);

      let fileSize = 0;
      let limitExceeded = false;

      fileStream.on("data", (chunk: Buffer) => {
        fileSize += chunk.length;
        if (fileSize > 10 * 1024 * 1024) {
          limitExceeded = true;
          fileStream.destroy();
        } else {
          hash.update(chunk);
        }
      });

      // Write stream
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        fileStream.pipe(writeStream);
      });

      if (limitExceeded) {
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        return reply.status(413).send({
          statusCode: 413,
          error: "Payload Too Large",
          message: "Uploaded log file exceeds 10MB limit."
        });
      }

      const checksum = hash.digest("hex");
      const userId = request.user?.id;

      // Start database transactions: Register File -> Create Incident -> Linked Timeline
      const result = await prisma.$transaction(async (tx) => {
        const incident = await tx.incident.create({
          data: {
            title,
            description: description || `Ingested from log file: ${filename}`,
            severity,
            status: IncidentStatus.TRIGGERED,
            source: "PIPELINE",
            reporterId: userId
          }
        });

        const log = await tx.logFile.create({
          data: {
            id: fileId,
            fileName: filename,
            fileType: mimetype,
            fileSize,
            filePath: targetPath,
            checksum,
            incidentId: incident.id,
            uploaderId: userId
          }
        });

        // Initial timeline logs
        await tx.incidentTimeline.createMany({
          data: [
            {
              incidentId: incident.id,
              eventDescription: `Incident automatically registered via log ingestion pipeline. Severity: ${severity}.`,
              type: TimelineEventType.SYSTEM
            },
            {
              incidentId: incident.id,
              eventDescription: `Log file "${filename}" (Size: ${(fileSize / 1024).toFixed(1)} KB) successfully uploaded and linked to analyzer targets.`,
              type: TimelineEventType.SYSTEM
            }
          ]
        });

        // Audit Trail
        await tx.auditLog.create({
          data: {
            userId,
            action: "PIPELINE_INGESTION_TRIGGERED",
            entityType: "Incident",
            entityId: incident.id,
            details: { title, logFileId: log.id, fileName: filename, checksum }
          }
        });

        return { incident, log };
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: `Pipeline ingestion and incident registration failed: ${error.message}`
      });
    }
  });
}
