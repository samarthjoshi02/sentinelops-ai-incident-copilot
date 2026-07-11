import { createWorkflow, createStep } from "@mastra/core/workflows";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";
import { EventEmitter } from "events";

// Import registries and stubs
import { AgentRouter, runHistoricalRetrieval, runRootCauseAnalysis } from "agents";
import {
  logParserTool,
  timelineBuilderTool,
  remediationExecutorTool,
  postMortemGeneratorTool,
  QdrantMemoryService,
  EnkryptAISafetyService
} from "tools";

// Import shared database connection
import { prisma } from "../../../shared/db.js";
import { ExecutionStatus, TimelineEventType, IncidentStatus, IncidentSeverity } from "@prisma/client";

// Clean PostgreSQL connection string
const cleanConnectionString = (process.env.DATABASE_URL || "").replace(/^["']|["']$/g, "");

// 1. PostgreSQL Workflow Snapshot Persistence
export const pgWorkflowStore = new PostgresStore({
  id: "postgres-workflow-store",
  connectionString: cleanConnectionString,
  ssl: cleanConnectionString.includes("neon.tech") ? { rejectUnauthorized: false } : false,
});

// 2. Workflow Event Bus
class WorkflowEventBus extends EventEmitter {
  emitEvent(event: string, payload: any) {
    this.emit(event, { ...payload, timestamp: new Date().toISOString() });
  }
}
export const workflowEventBus = new WorkflowEventBus();

// 3. Workflow State (Context Manager Schema)
export const workflowStateSchema = z.object({
  incidentId: z.string(),
  workflowExecutionId: z.string(),
  logsRaw: z.string().default(""),
  anomalies: z.array(z.any()).default([]),
  retrievedIncidents: z.array(z.any()).default([]),
  runbooks: z.array(z.any()).default([]),
  postMortems: z.array(z.any()).default([]),
  knowledgeSummary: z.string().default(""),
  evidence: z.array(z.string()).default([]),
  confidenceScore: z.number().default(0),
  rootCause: z.any().optional(),
  remediationPlan: z.any().optional(),
  safetyValidation: z.any().optional(),
  postMortem: z.any().optional(),
  status: z.string().default("TRIGGERED")
});

export type IncidentWorkflowState = z.infer<typeof workflowStateSchema>;

// Instantiate Services
const router = new AgentRouter();
const qdrantMemory = new QdrantMemoryService();
const enkryptSafety = new EnkryptAISafetyService();

/**
 * 4. Step 1: Telemetry parsing & Anomaly Detection
 * inputSchema matches the workflow's inputSchema (incidentId, logsRaw)
 */
const anomalyDetectionStep = createStep({
  id: "anomaly-detection-step",
  inputSchema: z.object({
    incidentId: z.string(),
    logsRaw: z.string()
  }),
  outputSchema: z.object({ anomalies: z.array(z.any()) }),
  stateSchema: workflowStateSchema,
  execute: async ({ inputData, state, setState }) => {
    const typedState = state as IncidentWorkflowState;
    const { incidentId, workflowExecutionId, logsRaw } = typedState;

    workflowEventBus.emitEvent("step:started", { step: "anomaly-detection-step", incidentId });

    // Dynamic AI routing via Incident Commander
    const commanderStart = Date.now();
    const decision = await router.routeDynamic({
      incidentId,
      status: typedState.status,
      logsRaw,
      anomalies: typedState.anomalies || [],
      rootCause: typedState.rootCause,
      remediationPlan: typedState.remediationPlan,
      postMortem: typedState.postMortem
    });
    const commanderDuration = Date.now() - commanderStart;

    const commanderExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: "Incident Commander Agent",
        status: ExecutionStatus.COMPLETED,
        input: { currentStatus: typedState.status },
        output: { decision, durationMs: commanderDuration },
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: "incident-commander", executionId: commanderExec.id });
    workflowEventBus.emitEvent("agent:completed", { agentId: "incident-commander", executionId: commanderExec.id });

    await prisma.incidentTimeline.create({
      data: {
        incidentId,
        eventDescription: `[Orchestration] Incident Commander Agent dynamic choice: routed to ${decision.nextAgentId}. Transition: ${decision.workflowTransition}. Reasoning: ${decision.reasoning}`,
        type: TimelineEventType.AI_AGENT,
        metadata: {
          confidence: decision.confidence,
          durationMs: commanderDuration
        }
      }
    });

    const routedAgentId = decision.nextAgentId;
    const agentConfig = router.getAgentConfig(routedAgentId, `Logs: ${logsRaw}`);

    // Create Agent Execution Audit Log (Prisma)
    const agentExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: agentConfig.name,
        status: ExecutionStatus.RUNNING,
        input: { logsLength: logsRaw.length }
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: routedAgentId, executionId: agentExec.id });

    // Safety validation stubs
    const promptCheck = await enkryptSafety.validatePrompt(agentConfig.systemPrompt);
    if (!promptCheck.safe) {
      throw new Error(`Enkrypt AI Safety violation: ${promptCheck.reason}`);
    }

    // Execute Log Parser Tool
    const parseResult = await (logParserTool.execute as any)({ logsRaw });
    const anomalies = parseResult.anomalies;

    // Update db execution state
    await prisma.agentExecution.update({
      where: { id: agentExec.id },
      data: {
        status: ExecutionStatus.COMPLETED,
        output: { anomaliesFound: anomalies.length, anomalies },
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:completed", { agentId: routedAgentId, executionId: agentExec.id });

    // Transition incident status to INVESTIGATING
    await prisma.$transaction(async (tx) => {
      await tx.incident.update({
        where: { id: incidentId },
        data: { status: IncidentStatus.INVESTIGATING }
      });
      await tx.incidentTimeline.create({
        data: {
          incidentId,
          eventDescription: `Telemetry analyzed. Isolated ${anomalies.length} anomaly signature(s). Agent: ${agentConfig.name}`,
          type: TimelineEventType.AI_AGENT
        }
      });
    });

    // Update state context
    const nextState: IncidentWorkflowState = {
      ...typedState,
      anomalies,
      status: "INVESTIGATING"
    };
    await setState(nextState);

    // Update workflow progress
    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: ExecutionStatus.RUNNING,
        state: nextState as any
      }
    });

    workflowEventBus.emitEvent("step:completed", { step: "anomaly-detection-step", incidentId });

    return { anomalies };
  }
});

/**
 * 4.5 Step 1.5: Historical Retrieval & Context Enrichment
 * inputSchema matches anomalyDetectionStep outputSchema
 */
const historicalRetrievalStep = createStep({
  id: "historical-retrieval-step",
  inputSchema: z.object({ anomalies: z.array(z.any()) }),
  outputSchema: z.object({ retrievalResult: z.any() }),
  stateSchema: workflowStateSchema,
  execute: async ({ inputData, state, setState }) => {
    const typedState = state as IncidentWorkflowState;
    const { incidentId, workflowExecutionId, logsRaw } = typedState;

    workflowEventBus.emitEvent("step:started", { step: "historical-retrieval-step", incidentId });
    workflowEventBus.emitEvent("custom", { type: "HISTORICAL_RETRIEVAL_STARTED", incidentId });

    // Dynamic AI routing via Incident Commander
    const commanderStart = Date.now();
    const decision = await router.routeDynamic({
      incidentId,
      status: typedState.status,
      logsRaw,
      anomalies: typedState.anomalies || [],
      retrievedIncidents: typedState.retrievedIncidents || [],
      rootCause: typedState.rootCause,
      remediationPlan: typedState.remediationPlan,
      postMortem: typedState.postMortem
    });
    const commanderDuration = Date.now() - commanderStart;

    const commanderExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: "Incident Commander Agent",
        status: ExecutionStatus.COMPLETED,
        input: { currentStatus: typedState.status },
        output: { decision, durationMs: commanderDuration },
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: "incident-commander", executionId: commanderExec.id });
    workflowEventBus.emitEvent("agent:completed", { agentId: "incident-commander", executionId: commanderExec.id });

    await prisma.incidentTimeline.create({
      data: {
        incidentId,
        eventDescription: `[Orchestration] Incident Commander Agent dynamic choice: routed to ${decision.nextAgentId}. Transition: ${decision.workflowTransition}. Reasoning: ${decision.reasoning}`,
        type: TimelineEventType.AI_AGENT,
        metadata: {
          confidence: decision.confidence,
          durationMs: commanderDuration
        }
      }
    });

    const routedAgentId = decision.nextAgentId;
    const agentConfig = router.getAgentConfig(routedAgentId);

    const agentExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: agentConfig.name,
        status: ExecutionStatus.RUNNING,
        input: { logsRaw }
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: routedAgentId, executionId: agentExec.id });

    // Execute Historical Retrieval
    const searchStart = Date.now();
    const retrievalResult = await runHistoricalRetrieval({
      incidentId,
      logsRaw
    });
    const searchDuration = Date.now() - searchStart;

    workflowEventBus.emitEvent("custom", { type: "QDRANT_QUERY_COMPLETED", incidentId, durationMs: searchDuration });

    await prisma.agentExecution.update({
      where: { id: agentExec.id },
      data: {
        status: ExecutionStatus.COMPLETED,
        output: {
          retrievalResult,
          searchDurationMs: searchDuration
        },
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:completed", { agentId: routedAgentId, executionId: agentExec.id });
    workflowEventBus.emitEvent("custom", { type: "MEMORY_CONTEXT_UPDATED", incidentId });

    // Update shared workflow state and DB
    const nextState: IncidentWorkflowState = {
      ...typedState,
      retrievedIncidents: retrievalResult.retrievedIncidents,
      runbooks: retrievalResult.runbooks,
      postMortems: retrievalResult.postMortems,
      knowledgeSummary: retrievalResult.knowledgeSummary,
      evidence: retrievalResult.evidence,
      confidenceScore: retrievalResult.confidence
    };
    await setState(nextState);

    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: ExecutionStatus.RUNNING,
        state: nextState as any
      }
    });

    // Timeline event detailing summarized memory context
    await prisma.incidentTimeline.create({
      data: {
        incidentId,
        eventDescription: `Historical Context Retrieved. Matches found: ${retrievalResult.retrievedIncidents.length} past incident(s), ${retrievalResult.runbooks.length} runbook(s). Summary: ${retrievalResult.knowledgeSummary}`,
        type: TimelineEventType.AI_AGENT,
        metadata: {
          confidenceScore: retrievalResult.confidence,
          latencyMs: searchDuration
        }
      }
    });

    workflowEventBus.emitEvent("custom", { type: "HISTORICAL_RETRIEVAL_COMPLETED", incidentId });
    workflowEventBus.emitEvent("step:completed", { step: "historical-retrieval-step", incidentId });

    return { retrievalResult };
  }
});

/**
 * 5. Step 2: Root Cause Analysis
 * inputSchema matches historicalRetrievalStep outputSchema
 */
const rootCauseAnalysisStep = createStep({
  id: "root-cause-analysis-step",
  inputSchema: z.object({ retrievalResult: z.any() }),
  outputSchema: z.object({ rootCause: z.any() }),
  stateSchema: workflowStateSchema,
  execute: async ({ inputData, state, setState }) => {
    const typedState = state as IncidentWorkflowState;
    const { incidentId, workflowExecutionId, anomalies } = typedState;

    workflowEventBus.emitEvent("step:started", { step: "root-cause-analysis-step", incidentId });

    // Dynamic AI routing via Incident Commander
    const commanderStart = Date.now();
    const decision = await router.routeDynamic({
      incidentId,
      status: typedState.status,
      logsRaw: typedState.logsRaw || "",
      anomalies,
      retrievedIncidents: typedState.retrievedIncidents || [],
      rootCause: typedState.rootCause,
      remediationPlan: typedState.remediationPlan,
      postMortem: typedState.postMortem
    });
    const commanderDuration = Date.now() - commanderStart;

    const commanderExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: "Incident Commander Agent",
        status: ExecutionStatus.COMPLETED,
        input: { currentStatus: typedState.status },
        output: { decision, durationMs: commanderDuration },
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: "incident-commander", executionId: commanderExec.id });
    workflowEventBus.emitEvent("agent:completed", { agentId: "incident-commander", executionId: commanderExec.id });

    await prisma.incidentTimeline.create({
      data: {
        incidentId,
        eventDescription: `[Orchestration] Incident Commander Agent dynamic choice: routed to ${decision.nextAgentId}. Transition: ${decision.workflowTransition}. Reasoning: ${decision.reasoning}`,
        type: TimelineEventType.AI_AGENT,
        metadata: {
          confidence: decision.confidence,
          durationMs: commanderDuration
        }
      }
    });

    const routedAgentId = decision.nextAgentId;
    const agentConfig = router.getAgentConfig(routedAgentId, `Anomalies: ${JSON.stringify(anomalies)}`);

    const agentExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: agentConfig.name,
        status: ExecutionStatus.RUNNING,
        input: { anomaliesCount: anomalies.length }
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: routedAgentId, executionId: agentExec.id });

    // Execute RCA Analyst Agent
    const analysisStart = Date.now();

    workflowEventBus.emitEvent("custom", {
      type: "RCA_STARTED",
      incidentId
    });

    const rcaResult = await runRootCauseAnalysis({
      incidentId,
      logsRaw: typedState.logsRaw || "",
      anomalies: typedState.anomalies || [],
      retrievedIncidents: typedState.retrievedIncidents || [],
      runbooks: typedState.runbooks || [],
      postMortems: typedState.postMortems || [],
      knowledgeSummary: typedState.knowledgeSummary || ""
    });

    const analysisDuration = Date.now() - analysisStart;

    workflowEventBus.emitEvent("custom", {
      type: "RCA_ANALYSIS_COMPLETED",
      incidentId,
      latencyMs: analysisDuration,
      overallConfidence: rcaResult.overallConfidence,
      evidenceCount: rcaResult.rootCauses.reduce((acc, rc) => acc + (rc.evidence?.length || 0), 0)
    });

    // Write diagnostic RootCause in PostgreSQL
    const rootCauseRecord = await prisma.$transaction(async (tx) => {
      const summaryText = rcaResult.rootCauses.map(rc => rc.title).join(", ") || rcaResult.reasoning;
      const evidenceText = rcaResult.rootCauses.flatMap(rc => rc.evidence).join("; ");

      const rc = await tx.rootCause.create({
        data: {
          incidentId,
          summary: summaryText,
          confidence: rcaResult.overallConfidence,
          evidence: evidenceText,
          findings: rcaResult as any
        }
      });

      // Insert timeline entry detailing root causes diagnosed
      const firstCause = rcaResult.rootCauses[0];
      const desc = `Root cause identified. Diagnostic confidence: ${Math.round(rcaResult.overallConfidence * 100)}%. Primary Cause: ${firstCause?.title || "Unknown"}. Details: ${firstCause?.description || "No description provided."}`;

      await tx.incidentTimeline.create({
        data: {
          incidentId,
          eventDescription: desc,
          type: TimelineEventType.AI_AGENT,
          metadata: {
            overallConfidence: rcaResult.overallConfidence,
            evidenceCount: rcaResult.rootCauses.reduce((acc, rc) => acc + (rc.evidence?.length || 0), 0),
            reasoningDurationMs: analysisDuration
          }
        }
      });

      return rc;
    });

    workflowEventBus.emitEvent("custom", {
      type: "RCA_RESULTS_STORED",
      incidentId,
      rootCauseId: rootCauseRecord.id
    });

    await prisma.agentExecution.update({
      where: { id: agentExec.id },
      data: {
        status: ExecutionStatus.COMPLETED,
        output: {
          rcaResult,
          analysisDurationMs: analysisDuration
        },
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:completed", { agentId: routedAgentId, executionId: agentExec.id });

    // Update shared context state
    const nextState: IncidentWorkflowState = {
      ...typedState,
      rootCause: rcaResult
    };
    await setState(nextState);

    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: ExecutionStatus.RUNNING,
        state: nextState as any
      }
    });

    workflowEventBus.emitEvent("step:completed", { step: "root-cause-analysis-step", incidentId });

    return { rootCause: nextState.rootCause };
  }
});

/**
 * 6. Step 3: Runbook Remediation Selection & Execution
 * inputSchema matches rootCauseAnalysisStep outputSchema
 */
const remediationStep = createStep({
  id: "remediation-step",
  inputSchema: z.object({ rootCause: z.any() }),
  outputSchema: z.object({ remediationPlan: z.any() }),
  stateSchema: workflowStateSchema,
  execute: async ({ inputData, state, setState }) => {
    const typedState = state as IncidentWorkflowState;
    const { incidentId, workflowExecutionId, rootCause } = typedState;

    workflowEventBus.emitEvent("step:started", { step: "remediation-step", incidentId });

    // Dynamic AI routing via Incident Commander
    const commanderStart = Date.now();
    const decision = await router.routeDynamic({
      incidentId,
      status: typedState.status,
      logsRaw: typedState.logsRaw || "",
      anomalies: typedState.anomalies || [],
      retrievedIncidents: typedState.retrievedIncidents || [],
      rootCause,
      remediationPlan: typedState.remediationPlan,
      postMortem: typedState.postMortem
    });
    const commanderDuration = Date.now() - commanderStart;

    const commanderExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: "Incident Commander Agent",
        status: ExecutionStatus.COMPLETED,
        input: { currentStatus: typedState.status },
        output: { decision, durationMs: commanderDuration },
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: "incident-commander", executionId: commanderExec.id });
    workflowEventBus.emitEvent("agent:completed", { agentId: "incident-commander", executionId: commanderExec.id });

    await prisma.incidentTimeline.create({
      data: {
        incidentId,
        eventDescription: `[Orchestration] Incident Commander Agent dynamic choice: routed to ${decision.nextAgentId}. Transition: ${decision.workflowTransition}. Reasoning: ${decision.reasoning}`,
        type: TimelineEventType.AI_AGENT,
        metadata: {
          confidence: decision.confidence,
          durationMs: commanderDuration
        }
      }
    });

    const routedAgentId = decision.nextAgentId;
    const agentConfig = router.getAgentConfig(routedAgentId, `Diagnosis: ${JSON.stringify(rootCause)}`);

    const agentExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: agentConfig.name,
        status: ExecutionStatus.RUNNING,
        input: { rootCause }
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: routedAgentId, executionId: agentExec.id });

    // Configure steps
    const mockSteps = [
      { order: 1, action: "Clear temporary client connection hooks", type: "AUTOMATED" },
      { order: 2, action: "Increase max connection parameters in DB settings", type: "AUTOMATED" }
    ];

    // Execute Remediation Specialists' executor tool
    const execResult = await (remediationExecutorTool.execute as any)({
      planId: "remediate-db-saturation",
      steps: mockSteps
    });

    const remediationText = JSON.stringify(execResult);

    const safetyResult = await enkryptSafety.validateResponse(remediationText);

    if (!safetyResult.safe) {
      throw new Error(
        `Enkrypt AI blocked remediation: ${safetyResult.reason}`
      );
    }

    // Write Remediation Plan and transition incident status to RESOLVED
    const remediationPlanRecord = await prisma.$transaction(async (tx) => {
      const plan = await tx.remediationPlan.create({
        data: {
          incidentId,
          description: "Scale DB connection settings and purge client handles.",
          steps: mockSteps as any,
          status: "COMPLETED"
        }
      });

      await tx.incident.update({
        where: { id: incidentId },
        data: { status: IncidentStatus.RESOLVED }
      });

      await tx.incidentTimeline.create({
        data: {
          incidentId,
          eventDescription: `Remediation executed. Remediation status: COMPLETED. Incident status updated to RESOLVED.`,
          type: TimelineEventType.AI_AGENT
        }
      });

      await tx.incidentTimeline.create({
        data: {
          incidentId,
          eventDescription: `[Enkrypt AI] Safety validation passed. Remediation output cleared by guardrails.`,
          type: TimelineEventType.AI_AGENT,
          metadata: { safe: safetyResult.safe }
        }
      });

      return plan;
    });

    await prisma.agentExecution.update({
      where: { id: agentExec.id },
      data: {
        status: ExecutionStatus.COMPLETED,
        output: remediationPlanRecord as any,
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:completed", { agentId: routedAgentId, executionId: agentExec.id });

    const nextState: IncidentWorkflowState = {
      ...typedState,
      remediationPlan: remediationPlanRecord,
      safetyValidation: safetyResult,
      status: "RESOLVED"
    };
    await setState(nextState);

    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: ExecutionStatus.RUNNING,
        state: nextState as any
      }
    });

    workflowEventBus.emitEvent("step:completed", { step: "remediation-step", incidentId });

    return { remediationPlan: nextState.remediationPlan };
  }
});

/**
 * 7. Step 4: Post-Mortem Logging & Timeline Audit
 * inputSchema matches remediationStep outputSchema
 */
const reportingStep = createStep({
  id: "reporting-step",
  inputSchema: z.object({ remediationPlan: z.any() }),
  outputSchema: z.object({ postMortem: z.any() }),
  stateSchema: workflowStateSchema,
  execute: async ({ inputData, state, setState }) => {
    const typedState = state as IncidentWorkflowState;
    const { incidentId, workflowExecutionId, rootCause, remediationPlan } = typedState;

    workflowEventBus.emitEvent("step:started", { step: "reporting-step", incidentId });

    // Dynamic AI routing via Incident Commander
    const commanderStart = Date.now();
    const decision = await router.routeDynamic({
      incidentId,
      status: typedState.status,
      logsRaw: typedState.logsRaw || "",
      anomalies: typedState.anomalies || [],
      retrievedIncidents: typedState.retrievedIncidents || [],
      rootCause,
      remediationPlan,
      postMortem: typedState.postMortem
    });
    const commanderDuration = Date.now() - commanderStart;

    const commanderExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: "Incident Commander Agent",
        status: ExecutionStatus.COMPLETED,
        input: { currentStatus: typedState.status },
        output: { decision, durationMs: commanderDuration },
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: "incident-commander", executionId: commanderExec.id });
    workflowEventBus.emitEvent("agent:completed", { agentId: "incident-commander", executionId: commanderExec.id });

    await prisma.incidentTimeline.create({
      data: {
        incidentId,
        eventDescription: `[Orchestration] Incident Commander Agent dynamic choice: routed to ${decision.nextAgentId}. Transition: ${decision.workflowTransition}. Reasoning: ${decision.reasoning}`,
        type: TimelineEventType.AI_AGENT,
        metadata: {
          confidence: decision.confidence,
          durationMs: commanderDuration
        }
      }
    });

    const routedAgentId = decision.nextAgentId;
    const agentConfig = router.getAgentConfig(routedAgentId);

    const agentExec = await prisma.agentExecution.create({
      data: {
        incidentId,
        agentName: agentConfig.name,
        status: ExecutionStatus.RUNNING,
        input: { rootCause, remediationPlan }
      }
    });

    workflowEventBus.emitEvent("agent:invoked", { agentId: routedAgentId, executionId: agentExec.id });

    // Generate blameless Post-Mortem
    const pmResult = await (postMortemGeneratorTool.execute as any)({
      title: "Database latency pool saturation",
      summary: rootCause?.summary || "Surge in slow transaction threads",
      timeline: [
        "System alerts triggered",
        "Anomalies parsed by detector",
        "RCA located slow query",
        "Remediation specialist scale client connection threshold limit"
      ],
      rootCause: rootCause?.summary || "Connection limit reached",
      remediation: "Purged idle caches and scaled configuration size."
    });

    // Write Post-Mortem record to DB and transition incident to CLOSED
    const postMortemRecord = await prisma.$transaction(async (tx) => {
      const pm = await tx.postMortem.create({
        data: {
          incidentId,
          summary: rootCause?.summary || "Incident resolved successfully.",
          rootCauseAnalysis: rootCause?.summary || "",
          preventativeActions: "Optimize indexing rules and add query timeouts.",
          status: "PUBLISHED"
        }
      });

      await tx.incident.update({
        where: { id: incidentId },
        data: { status: IncidentStatus.CLOSED }
      });

      await tx.incidentTimeline.create({
        data: {
          incidentId,
          eventDescription: "Post-incident review generated. Operational post-mortem report archived.",
          type: TimelineEventType.AI_AGENT
        }
      });

      return pm;
    });

    await prisma.agentExecution.update({
      where: { id: agentExec.id },
      data: {
        status: ExecutionStatus.COMPLETED,
        output: postMortemRecord as any,
        completedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("agent:completed", { agentId: routedAgentId, executionId: agentExec.id });

    const nextState: IncidentWorkflowState = {
      ...typedState,
      postMortem: postMortemRecord,
      status: "CLOSED"
    };
    await setState(nextState);

    // Mark workflow execution as COMPLETED
    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: ExecutionStatus.COMPLETED,
        state: nextState as any,
        updatedAt: new Date()
      }
    });

    workflowEventBus.emitEvent("step:completed", { step: "reporting-step", incidentId });

    return { postMortem: nextState.postMortem };
  }
});

/**
 * 8. Mastra Incident Ingestion & Remediation Orchestrator Workflow
 */
export const incidentOrchestrationWorkflow = createWorkflow({
  id: "incident-orchestration-workflow",
  inputSchema: z.object({
    incidentId: z.string(),
    logsRaw: z.string()
  }),
  outputSchema: z.object({
    status: z.string(),
    incidentId: z.string()
  }),
  stateSchema: workflowStateSchema
})
  .then(anomalyDetectionStep)
  .then(historicalRetrievalStep)
  .then(rootCauseAnalysisStep)
  .then(remediationStep)
  .then(reportingStep)
  .commit();
