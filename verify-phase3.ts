import "dotenv/config";
import { prisma } from "./shared/db.js";
import { incidentOrchestrationWorkflow, workflowEventBus, pgWorkflowStore } from "workflows";
import { ExecutionStatus, IncidentStatus } from "@prisma/client";

const PORT = 4111;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = (process.env.AUTH_SECRET || "").replace(/^["']|["']$/g, "");

async function runTests() {
  console.log("====================================================");
  console.log("SentinelOps AI - Phase 3 Orchestration Verification");
  console.log("====================================================");

  // --- PREPARATION ---
  console.log("🔄 Initializing PostgreSQL Workflow Storage...");
  await pgWorkflowStore.init();
  console.log("✅ PostgreSQL Storage ready.");

  // Create a mock incident for test run
  console.log("🔄 Provisioning temporary incident in Neon Database...");
  const incident = await prisma.incident.create({
    data: {
      title: "Orchestration Test: Memory Leak Spike",
      description: "High system load and telemetry spikes.",
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
      workflowName: "In-Process Test Workflow",
      status: ExecutionStatus.RUNNING,
      state: { status: "TRIGGERED", incidentId: incident.id }
    }
  });
  console.log(`✅ Database WorkflowExecution tracked. ID: ${workflowExecution.id}`);

  // --- 1. TEST EVENT BUS & ROUTING IN-PROCESS ---
  console.log("\n🔄 Subscribing to WorkflowEventBus in-process...");
  const eventsCaptured: string[] = [];
  workflowEventBus.on("step:started", (data) => {
    const msg = `[Event Bus] 🚀 Step started: ${data.step} (Incident: ${data.incidentId})`;
    eventsCaptured.push(msg);
    console.log(msg);
  });
  workflowEventBus.on("agent:invoked", (data) => {
    const msg = `[Event Bus] 🤖 Agent invoked: ${data.agentId} (Exec ID: ${data.executionId})`;
    eventsCaptured.push(msg);
    console.log(msg);
  });
  workflowEventBus.on("agent:completed", (data) => {
    const msg = `[Event Bus] 🏁 Agent completed: ${data.agentId}`;
    eventsCaptured.push(msg);
    console.log(msg);
  });
  workflowEventBus.on("step:completed", (data) => {
    const msg = `[Event Bus] ✅ Step completed: ${data.step}`;
    eventsCaptured.push(msg);
    console.log(msg);
  });

  console.log("\n🔄 Executing Mastra Orchestrator Workflow (In-Process)...");
  const run = await incidentOrchestrationWorkflow.createRun();
  const logsRaw = "Out of memory error OOM terminated thread pool.";

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

  console.log(`✅ Workflow execution status: ${result.status}`);
  console.log(`✅ Event bus capture count: ${eventsCaptured.length}`);

  if (eventsCaptured.length === 0) {
    throw new Error("FAIL: WorkflowEventBus did not capture any events.");
  }

  // --- 2. VERIFY DB INTEGRATION ---
  console.log("\n🔄 Validating database records created by the workflow steps...");
  
  // Verify RootCause
  const rc = await prisma.rootCause.findUnique({
    where: { incidentId: incident.id }
  });
  if (!rc) throw new Error("FAIL: RootCause record not found in database.");
  console.log(`✅ RootCause verified: "${rc.summary}" (Confidence: ${rc.confidence * 100}%)`);

  // Verify RemediationPlan
  const plan = await prisma.remediationPlan.findUnique({
    where: { incidentId: incident.id }
  });
  if (!plan) throw new Error("FAIL: RemediationPlan record not found in database.");
  console.log(`✅ RemediationPlan verified: "${plan.description}"`);

  // Verify PostMortem
  const pm = await prisma.postMortem.findUnique({
    where: { incidentId: incident.id }
  });
  if (!pm) throw new Error("FAIL: PostMortem record not found in database.");
  console.log(`✅ PostMortem verified: Archived successfully.`);

  // Verify AgentExecution count
  const agentExecs = await prisma.agentExecution.findMany({
    where: { incidentId: incident.id }
  });
  console.log(`✅ AgentExecutions found in database: ${agentExecs.length}`);
  if (agentExecs.length === 0) throw new Error("FAIL: No AgentExecution logs written to DB.");
  for (const exec of agentExecs) {
    console.log(`   ➔ Agent: ${exec.agentName} | Status: ${exec.status}`);
  }

  // Verify Incident status transitions
  const finalIncident = await prisma.incident.findUnique({
    where: { id: incident.id }
  });
  console.log(`✅ Final Incident DB Status: ${finalIncident?.status}`);
  if (finalIncident?.status !== "CLOSED") {
    throw new Error(`FAIL: Expected final incident status to be CLOSED, got ${finalIncident?.status}`);
  }

  // --- 3. TEST VIA FASTIFY HTTP API GATEWAY ---
  console.log("\n🔄 Testing via Fastify API endpoint POST /api/incidents/:id/remediate...");
  
  // Create another incident for HTTP test
  const httpIncident = await prisma.incident.create({
    data: {
      title: "Orchestration HTTP API Test: Saturation Spike",
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

  // Clean up HTTP Incident
  console.log("\n🔄 Cleaning up test records in Neon PostgreSQL database...");
  await prisma.incident.delete({ where: { id: incident.id } });
  await prisma.incident.delete({ where: { id: httpIncident.id } });
  console.log("✅ Test incident records deleted.");

  console.log("====================================================");
  console.log("🎉 ALL PHASE 3 ORCHESTRATION CHECKS COMPLETED! 🎉");
  console.log("====================================================");
}

runTests().catch((err) => {
  console.error("\n❌ Verification run encountered errors:", err);
  process.exit(1);
});
