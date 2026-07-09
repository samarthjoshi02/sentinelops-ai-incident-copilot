import "dotenv/config";
import { prisma } from "./shared/db.js";
import { incidentOrchestrationWorkflow, workflowEventBus, pgWorkflowStore } from "workflows";
import { ExecutionStatus, IncidentStatus } from "@prisma/client";

const PORT = 4111;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = (process.env.AUTH_SECRET || "").replace(/^["']|["']$/g, "");

async function runTests() {
  console.log("====================================================");
  console.log("SentinelOps AI - Phase 4A Commander Agent Verification");
  console.log("====================================================");

  // --- PREPARATION ---
  console.log("🔄 Initializing PostgreSQL Workflow Storage...");
  await pgWorkflowStore.init();
  console.log("✅ PostgreSQL Storage ready.");

  // Create a mock incident for test run
  console.log("🔄 Provisioning temporary incident in Neon Database...");
  const incident = await prisma.incident.create({
    data: {
      title: "Orchestrator Commander E2E Test: Thread saturation",
      description: "High system latency spike on query endpoints.",
      status: "TRIGGERED",
      severity: "CRITICAL",
      source: "API"
    }
  });
  console.log(`✅ Incident provisioned. ID: ${incident.id}`);

  // Create a database trace record for the workflow execution
  const workflowExecution = await prisma.workflowExecution.create({
    data: {
      incidentId: incident.id,
      workflowName: "In-Process Commander AI Test",
      status: ExecutionStatus.RUNNING,
      state: { status: "TRIGGERED", incidentId: incident.id }
    }
  });
  console.log(`✅ Database WorkflowExecution tracked. ID: ${workflowExecution.id}`);

  // Subscribe to event bus
  const eventsCaptured: string[] = [];
  workflowEventBus.on("agent:invoked", (data) => {
    eventsCaptured.push(data.agentId);
    console.log(`[Event Bus] 🤖 Agent invoked: ${data.agentId}`);
  });

  // --- 1. RUN IN-PROCESS WORKFLOW ---
  console.log("\n🔄 Executing Mastra Orchestrator Workflow (In-Process)...");
  const run = await incidentOrchestrationWorkflow.createRun();
  const logsRaw = "FATAL: connection pool exhausted (max 100 clients reached)";

  const result = await run.start({
    inputData: {
      incidentId: incident.id,
      logsRaw
    },
    initialState: {
      incidentId: incident.id,
      workflowExecutionId: workflowExecution.id,
      logsRaw,
      anomalies: [],
      status: "TRIGGERED"
    }
  });

  console.log(`✅ Workflow execution finished with status: ${result.status}`);

  // --- 2. VALIDATE AI COMMANDER DB ENTRIES ---
  console.log("\n🔄 Validating database records written by the Incident Commander Agent...");

  // Verify Incident Commander AgentExecutions exist
  const commanderExecs = await prisma.agentExecution.findMany({
    where: {
      incidentId: incident.id,
      agentName: "Incident Commander Agent"
    }
  });

  console.log(`✅ Incident Commander executions found in DB: ${commanderExecs.length}`);
  if (commanderExecs.length === 0) {
    throw new Error("FAIL: No AgentExecution logs written for Incident Commander Agent.");
  }

  for (const exec of commanderExecs) {
    const outputData = exec.output as any;
    console.log(`   ➔ Commander Step Executed. Status: ${exec.status}`);
    console.log(`     Reasoning: "${outputData?.decision?.reasoning}"`);
    console.log(`     Next Agent routed: "${outputData?.decision?.nextAgentId}"`);
    console.log(`     Confidence: ${outputData?.decision?.confidence * 100}%`);
    console.log(`     Duration: ${outputData?.durationMs}ms`);
    
    // Assert structured schema fields
    if (!outputData?.decision?.reasoning) throw new Error("FAIL: Commander output missing reasoning field.");
    if (!outputData?.decision?.nextAgentId) throw new Error("FAIL: Commander output missing nextAgentId field.");
    if (typeof outputData?.decision?.confidence !== "number") throw new Error("FAIL: Commander output missing confidence field.");
    if (typeof outputData?.durationMs !== "number") throw new Error("FAIL: Commander output missing durationMs field.");
  }

  // Verify IncidentTimeline entries contain duration and confidence metadata
  const timelineEvents = await prisma.incidentTimeline.findMany({
    where: { incidentId: incident.id }
  });
  console.log(`✅ Timeline events found: ${timelineEvents.length}`);
  const orchestrationTimeline = timelineEvents.filter(e => e.eventDescription.includes("[Orchestration]"));
  console.log(`✅ Orchestration Timeline events: ${orchestrationTimeline.length}`);
  if (orchestrationTimeline.length === 0) {
    throw new Error("FAIL: No Orchestration dynamic timeline events logged.");
  }

  for (const event of orchestrationTimeline) {
    const metadata = event.metadata as any;
    console.log(`   ➔ Event: "${event.eventDescription}"`);
    console.log(`     Metadata: Confidence=${metadata?.confidence}, DurationMs=${metadata?.durationMs}`);
    if (typeof metadata?.confidence !== "number" || typeof metadata?.durationMs !== "number") {
      throw new Error("FAIL: Timeline orchestration event metadata is missing confidence or durationMs.");
    }
  }

  // --- 3. TEST VIA FASTIFY HTTP API GATEWAY ---
  console.log("\n🔄 Testing via Fastify API endpoint POST /api/incidents/:id/remediate...");
  
  // Create another incident for HTTP test
  const httpIncident = await prisma.incident.create({
    data: {
      title: "Commander HTTP E2E Test: Saturation Spike",
      description: "Gateway response timeout.",
      status: "TRIGGERED",
      severity: "HIGH",
      source: "API"
    }
  });

  const response = await fetch(`${BASE_URL}/api/incidents/${httpIncident.id}/remediate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AUTH_SECRET}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FAIL: Remediation HTTP API returned status ${response.status}: ${errorText}`);
  }

  const responseData: any = await response.json();
  console.log("✅ HTTP API Remediation request succeeded.");
  console.log(`   Mastra Run ID: ${responseData.mastraRunId}`);
  console.log(`   Workflow Status: ${responseData.status}`);

  // Clean up
  console.log("\n🔄 Cleaning up test records in Neon PostgreSQL database...");
  await prisma.incident.delete({ where: { id: incident.id } });
  await prisma.incident.delete({ where: { id: httpIncident.id } });
  console.log("✅ Test incident records deleted.");

  console.log("====================================================");
  console.log("🎉 ALL COMMANDER AI ORCHESTRATION CHECKS PASSED! 🎉");
  console.log("====================================================");
}

runTests().catch((err) => {
  console.error("\n❌ Verification run encountered errors:", err);
  process.exit(1);
});
