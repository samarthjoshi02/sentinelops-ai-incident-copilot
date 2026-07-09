import "dotenv/config";
import { prisma } from "./shared/db.js";
import { incidentOrchestrationWorkflow, workflowEventBus } from "workflows";
import { ExecutionStatus } from "@prisma/client";

const PORT = 4111;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = (process.env.AUTH_SECRET || "").replace(/^["']|["']$/g, "");

async function runTests() {
  console.log("====================================================");
  console.log("SentinelOps AI - Phase 4C Root Cause Analysis Verification");
  console.log("====================================================");

  // Seed data
  const incident = await prisma.incident.create({
    data: {
      title: "Active Incident: Latency spikes on checkout microservice",
      description: "Severe latency spikes. Checkout endpoint returning 504 gateway timeout.",
      status: "TRIGGERED",
      severity: "HIGH",
      source: "API"
    }
  });
  console.log(`✅ Incident provisioned in PostgreSQL database. ID: ${incident.id}`);

  const workflowExecution = await prisma.workflowExecution.create({
    data: {
      incidentId: incident.id,
      workflowName: "In-Process Root Cause Analysis E2E Test",
      status: ExecutionStatus.RUNNING,
      state: { status: "TRIGGERED", incidentId: incident.id }
    }
  });

  // Setup test mocks to simulate completed upstream steps (Anomaly Detection & Historical Retrieval)
  const anomalies = [
    {
      timestamp: new Date().toISOString(),
      severity: "CRITICAL",
      message: "FATAL: connection pool exhausted (max 100 clients reached)",
      signatureHash: "sha256-pool-exhausted"
    }
  ];

  const retrievedIncidents = [
    {
      id: "seed-inc-101",
      title: "Database latency connection pool exhaustion",
      similarity: 0.94
    }
  ];

  const runbooks = [
    {
      id: "seed-rb-202",
      title: "Transactions DB Saturation Runbook",
      description: "Scale DB connection settings and purge client handles."
    }
  ];

  const postMortems = [
    {
      id: "seed-pm-303",
      summary: "Purged idle caches and scaled database connection limits."
    }
  ];

  const knowledgeSummary = "Similar past incidents indicate a high probability of connection pool exhaustion caused by surge in transaction workloads. Scaling connections is recommended.";

  // Track event bus triggers
  const customEventsCaptured: any[] = [];
  workflowEventBus.on("custom", (data) => {
    customEventsCaptured.push(data);
    console.log(`[Event Bus] 📡 Custom Signal: ${data.type}`);
  });

  console.log("\n🔄 Executing Mastra Orchestrator Workflow (In-Process)...");
  const run = await incidentOrchestrationWorkflow.createRun();
  const logsRaw = "FATAL: connection pool exhausted (max 100 clients reached) query pool limit reached.";

  const result = await run.start({
    inputData: {
      incidentId: incident.id,
      logsRaw
    },
    initialState: {
      incidentId: incident.id,
      workflowExecutionId: workflowExecution.id,
      logsRaw,
      anomalies,
      retrievedIncidents,
      runbooks,
      postMortems,
      knowledgeSummary,
      confidenceScore: 0.94,
      status: "INVESTIGATING"
    }
  });

  console.log(`✅ Workflow execution status: ${result.status}`);

  // --- 3. VERIFY ROOT CAUSE PERSISTENCE ---
  console.log("\n🔄 Validating RootCause persistence and context update...");

  // Check RootCause database records
  const dbRootCause = await prisma.rootCause.findUnique({
    where: { incidentId: incident.id }
  });

  if (!dbRootCause) {
    throw new Error("FAIL: RootCause record was not persisted to Neon PostgreSQL.");
  }
  console.log("✅ RootCause successfully written to DB:");
  console.log(`   Summary: "${dbRootCause.summary}"`);
  console.log(`   Confidence: ${dbRootCause.confidence * 100}%`);
  console.log(`   Evidence: "${dbRootCause.evidence}"`);

  const findings = dbRootCause.findings as any;
  if (!findings || !findings.rootCauses || findings.rootCauses.length === 0) {
    throw new Error("FAIL: Detailed findings JSON was not saved in findings field.");
  }
  console.log("   ➔ Saved hypotheses details in JSON:");
  for (const rc of findings.rootCauses) {
    console.log(`     - Title: "${rc.title}" (Confidence: ${rc.confidence}, Affected Services: ${rc.affectedServices?.join(", ")})`);
  }

  // --- 4. VERIFY OBSERVABILITY METRICS & EVENTS ---
  console.log("\n🔄 Checking Event Bus custom signal counts...");
  const eventTypes = customEventsCaptured.map(e => e.type);

  const requiredEvents = ["RCA_STARTED", "RCA_ANALYSIS_COMPLETED", "RCA_RESULTS_STORED"];
  for (const eventName of requiredEvents) {
    if (!eventTypes.includes(eventName)) {
      throw new Error(`FAIL: Event Bus did not capture required signal "${eventName}".`);
    }
    console.log(`✅ Custom event confirmed: "${eventName}"`);
  }

  // Check recorded properties in RCA_ANALYSIS_COMPLETED
  const compEvent = customEventsCaptured.find(e => e.type === "RCA_ANALYSIS_COMPLETED");
  console.log(`   ➔ Captured metrics: Latency=${compEvent.latencyMs}ms, OverallConfidence=${compEvent.overallConfidence}, EvidenceCount=${compEvent.evidenceCount}`);
  if (typeof compEvent.latencyMs !== "number" || typeof compEvent.overallConfidence !== "number" || typeof compEvent.evidenceCount !== "number") {
    throw new Error("FAIL: Observability event payload missing latency, confidence, or evidence counts.");
  }

  // Check AgentExecution audits for RCA Analyst Agent
  const rcaExecs = await prisma.agentExecution.findMany({
    where: {
      incidentId: incident.id,
      agentName: "RCA Analyst Agent"
    }
  });
  console.log(`✅ AgentExecutions found for RCA Analyst Agent: ${rcaExecs.length}`);
  if (rcaExecs.length === 0) {
    throw new Error("FAIL: No AgentExecution logs written for RCA Analyst Agent.");
  }
  
  const actualRcaExec = rcaExecs.find(e => {
    const payload = e.output as any;
    return payload && payload.rcaResult !== undefined;
  });

  if (!actualRcaExec) {
    throw new Error("FAIL: No AgentExecution found with actual rcaResult output payload.");
  }

  const payload = actualRcaExec.output as any;
  console.log(`   ➔ Duration: ${payload?.analysisDurationMs}ms`);
  if (typeof payload?.analysisDurationMs !== "number") {
    throw new Error("FAIL: RCA execution output missing analysisDurationMs.");
  }

  // Check timeline audits
  const timelineEvents = await prisma.incidentTimeline.findMany({
    where: { incidentId: incident.id }
  });
  const rcaTimeline = timelineEvents.filter(t => t.eventDescription.includes("Root cause identified."));
  console.log(`✅ RCA Timeline entries: ${rcaTimeline.length}`);
  if (rcaTimeline.length === 0) {
    throw new Error("FAIL: RootCause timeline event not written to PostgreSQL.");
  }
  for (const event of rcaTimeline) {
    const metadata = event.metadata as any;
    console.log(`   ➔ Event description: "${event.eventDescription}"`);
    console.log(`     Metadata: overallConfidence=${metadata?.overallConfidence}, reasoningDurationMs=${metadata?.reasoningDurationMs}`);
    if (typeof metadata?.overallConfidence !== "number" || typeof metadata?.reasoningDurationMs !== "number") {
      throw new Error("FAIL: Timeline event metadata missing overallConfidence or reasoningDurationMs.");
    }
  }

  // --- 5. HTTP API GATEWAY TEST ---
  console.log("\n🔄 Testing via Fastify API endpoint POST /api/incidents/:id/remediate...");
  
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

  // Clean up PostgreSQL db
  console.log("\n🔄 Cleaning up test records in Neon PostgreSQL database...");
  await prisma.incident.delete({ where: { id: incident.id } });
  await prisma.incident.delete({ where: { id: httpIncident.id } });
  console.log("✅ Test incident records deleted.");

  console.log("====================================================");
  console.log("🎉 ALL ROOT CAUSE ANALYSIS AGENT E2E TESTS PASSED! 🎉");
  console.log("====================================================");
}

runTests().catch((err) => {
  console.error("\n❌ Verification run encountered errors:", err);
  process.exit(1);
});
