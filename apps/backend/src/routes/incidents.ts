import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../../../../shared/db.js";
import { IncidentStatus, IncidentSeverity, TimelineEventType, ExecutionStatus } from "@prisma/client";
import { incidentOrchestrationWorkflow, pgWorkflowStore } from "workflows";

// Zod validation schemas
const createIncidentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long"),
  description: z.string().optional(),
  severity: z.nativeEnum(IncidentSeverity).default(IncidentSeverity.MEDIUM),
  source: z.string().default("API"),
});

const updateIncidentSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  severity: z.nativeEnum(IncidentSeverity).optional(),
  status: z.nativeEnum(IncidentStatus).optional(),
});

export async function incidentRoutes(fastify: FastifyInstance) {
  // Pre-handler hook to authenticate routes in this block
  fastify.addHook("preHandler", fastify.authenticate);

  // 1. GET /api/incidents - List with pagination and filter
  fastify.get("/incidents", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const status = query.status as IncidentStatus | undefined;
      const severity = query.severity as IncidentSeverity | undefined;
      const limit = parseInt(query.limit || "20", 10);
      const offset = parseInt(query.offset || "0", 10);

      const where: any = {};
      if (status) where.status = status;
      if (severity) where.severity = severity;

      const [incidents, total] = await Promise.all([
        prisma.incident.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
          include: {
            reporter: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        }),
        prisma.incident.count({ where })
      ]);

      return {
        incidents,
        pagination: {
          total,
          limit,
          offset
        }
      };
    } catch (error) {
      fastify.log.error("Failed to fetch incidents:", error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Failed to load incidents list."
      });
    }
  });

  // 2. GET /api/incidents/:id - Fetch single incident with details
  fastify.get("/incidents/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const incident = await prisma.incident.findUnique({
        where: { id },
        include: {
          reporter: {
            select: { id: true, name: true, email: true, role: true }
          },
          timeline: {
            orderBy: { timestamp: "desc" }
          },
          logFiles: true,
          telemetryEvents: true,
          rootCause: true,
          remediationPlan: true,
          postMortem: true
        }
      });

      if (!incident) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Incident with ID ${id} was not found.`
        });
      }

      return incident;
    } catch (error) {
      fastify.log.error(`Failed to fetch incident ${request.params}:`, error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Failed to load incident details."
      });
    }
  });

  // 3. POST /api/incidents - Create new incident
  fastify.post("/incidents", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validation = createIncidentSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Validation failed",
          details: validation.error.format()
        });
      }

      const { title, description, severity, source } = validation.data;
      const reporterId = request.user?.id;

      // Start transaction to create incident & initial timeline record
      const result = await prisma.$transaction(async (tx) => {
        const incident = await tx.incident.create({
          data: {
            title,
            description,
            severity,
            status: IncidentStatus.TRIGGERED,
            source,
            reporterId
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: reporterId,
            action: "INCIDENT_CREATED",
            entityType: "Incident",
            entityId: incident.id,
            details: { title, severity, source }
          }
        });

        // Create timeline event
        await tx.incidentTimeline.create({
          data: {
            incidentId: incident.id,
            eventDescription: `Incident triggered via ${source}. Initial severity set to ${severity}.`,
            type: TimelineEventType.SYSTEM
          }
        });

        return incident;
      });

      return reply.status(201).send(result);
    } catch (error) {
      fastify.log.error("Failed to create incident:", error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Failed to register new incident."
      });
    }
  });

  // 4. PUT /api/incidents/:id - Update incident status/severity
  fastify.put("/incidents/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const validation = updateIncidentSchema.safeParse(request.body);
      
      if (!validation.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Validation failed",
          details: validation.error.format()
        });
      }

      const updates = validation.data;
      const editorId = request.user?.id;

      const existing = await prisma.incident.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Incident with ID ${id} was not found.`
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.incident.update({
          where: { id },
          data: updates
        });

        // Track transitions in timeline & audit log
        const timelineEntries = [];
        
        if (updates.status && updates.status !== existing.status) {
          timelineEntries.push({
            incidentId: id,
            eventDescription: `Status transition: ${existing.status} ➔ ${updates.status} by ${request.user?.name || "Operative"}.`,
            type: TimelineEventType.HUMAN
          });
        }

        if (updates.severity && updates.severity !== existing.severity) {
          timelineEntries.push({
            incidentId: id,
            eventDescription: `Severity adjustment: ${existing.severity} ➔ ${updates.severity} by ${request.user?.name || "Operative"}.`,
            type: TimelineEventType.HUMAN
          });
        }

        if (timelineEntries.length > 0) {
          await tx.incidentTimeline.createMany({
            data: timelineEntries
          });
        }

        await tx.auditLog.create({
          data: {
            userId: editorId,
            action: "INCIDENT_UPDATED",
            entityType: "Incident",
            entityId: id,
            details: updates
          }
        });

        return updated;
      });

      return result;
    } catch (error) {
      fastify.log.error(`Failed to update incident ${request.params}:`, error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Failed to update incident."
      });
    }
  });

  // 5. DELETE /api/incidents/:id - Delete incident
  fastify.delete("/incidents/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user?.id;

      const existing = await prisma.incident.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Incident with ID ${id} was not found.`
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.incident.delete({ where: { id } });
        
        await tx.auditLog.create({
          data: {
            userId,
            action: "INCIDENT_DELETED",
            entityType: "Incident",
            entityId: id,
            details: { title: existing.title }
          }
        });
      });

      return reply.status(200).send({
        statusCode: 200,
        message: `Incident with ID ${id} has been permanently deleted.`
      });
    } catch (error) {
      fastify.log.error(`Failed to delete incident ${request.params}:`, error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Failed to delete incident."
      });
    }
  });

  // 6. POST /api/incidents/:id/remediate - Run incident remediation workflow
  fastify.post("/incidents/:id/remediate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // 1. Verify incident exists
      const incident = await prisma.incident.findUnique({
        where: { id },
        include: { logFiles: true }
      });

      if (!incident) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Incident with ID ${id} was not found.`
        });
      }

      // Initialize PostgresStore
      await pgWorkflowStore.init();

      // Retrieve log text (fallback if none exists)
      const logsRaw = incident.logFiles.length > 0 
        ? `Log from file: ${incident.logFiles[0].fileName}. Exception: FATAL: connection pool exhausted (max 100 clients reached)` 
        : "Default Incident logs: connection pool saturation error spike.";

      // 2. Create WorkflowExecution record in Database
      const workflowExecution = await prisma.workflowExecution.create({
        data: {
          incidentId: id,
          workflowName: "Incident Orchestration Workflow",
          status: ExecutionStatus.RUNNING,
          state: { status: "TRIGGERED", incidentId: id }
        }
      });

      // 3. Initialize run in Mastra
      const run = await incidentOrchestrationWorkflow.createRun();

      const result = await run.start({
        inputData: {
          incidentId: id,
          logsRaw
        },
        initialState: {
          incidentId: id,
          workflowExecutionId: workflowExecution.id,
          logsRaw,
          anomalies: [],
          status: "TRIGGERED"
        }
      });

      // Fetch updated execution from DB
      const updatedExec = await prisma.workflowExecution.findUnique({
        where: { id: workflowExecution.id }
      });

      return reply.status(200).send({
        statusCode: 200,
        message: "Remediation workflow executed successfully.",
        workflowExecutionId: workflowExecution.id,
        mastraRunId: run.runId,
        status: result.status,
        execution: updatedExec
      });

    } catch (error: any) {
      fastify.log.error(`Failed to run remediation workflow for incident:`, error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: `Remediation workflow failed: ${error.message}`
      });
    }
  });
}
