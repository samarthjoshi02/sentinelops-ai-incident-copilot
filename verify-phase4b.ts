import "dotenv/config";
import { prisma } from "./shared/db.js";
import { incidentOrchestrationWorkflow, workflowEventBus, pgWorkflowStore } from "workflows";
import { QdrantMemoryService, generateGeminiEmbedding } from "tools";
import { ExecutionStatus, IncidentStatus } from "@prisma/client";

const PORT = 4111;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = (process.env.AUTH_SECRET || "").replace(/^["']|["']$/g, "");

async function runTests() {
  console.log("====================================================");
  console.log("SentinelOps AI - Phase 4B Historical Retrieval Verification");
  console.log("====================================================");

  const seedIncId = "seed-inc-101";
  const seedRbId = "seed-rb-202";
  const seedPmId = "seed-pm-303";

  // --- 1. SETUP QDRANT COLLECTIONS ---
  console.log("🔄 Initializing Qdrant collections...");
  const qdrant = new QdrantMemoryService();
  try {
    await qdrant.init();
    console.log("✅ Qdrant collections ready.");

    // Seed sample records
    console.log("🔄 Seeding historical SRE database documents in Qdrant...");
    const seedIncText = "Connection pool exhausted (max 100 clients reached) latency spikes.";
    const seedRbText = "Purge idle database clients and scale connection limits.";
    const seedPmText = "Surge in transactions database clients caused saturation. Purged active handles.";

    const seedIncVector = await generateGeminiEmbedding(seedIncText);
    const seedRbVector = await generateGeminiEmbedding(seedRbText);
    const seedPmVector = await generateGeminiEmbedding(seedPmText);

    await qdrant.upsert("historical_incidents", seedIncId, seedIncVector, {
      title: "Database latency connection pool exhaustion",
      severity: "CRITICAL",
      service: "transactions-api"
    });

    await qdrant.upsert("runbooks", seedRbId, seedRbVector, {
      title: "Transactions DB Saturation Runbook",
      description: "Scale DB connection settings and purge client handles."
    });

    await qdrant.upsert("postmortems", seedPmId, seedPmVector, {
      title: "Post-Mortem: DB connection limits saturated",
      summary: "Purged idle caches and scaled database connection limits."
    });

    console.log("✅ Qdrant database seeded with vector profiles.");
  } catch (err) {
    console.warn("⚠️ Qdrant server is offline. Skipping seeding step (using mock fallbacks).");
  }

  // --- 2. RUN WORKFLOW IN-PROCESS ---
  console.log("\n🔄 Provisioning temporary incident in Neon Database...");
  const incident = await prisma.incident.create({
    data: {
      title: "Active Incident: High connection pool saturation",
      description: "Severe query latency spikes. Client connection limit exhausted.",
      status: "TRIGGERED",
      severity: "CRITICAL",
      source: "API"
    }
  });
  console.log(`✅ Incident provisioned. ID: ${incident.id}`);

  const workflowExecution = await prisma.workflowExecution.create({
    data: {
      incidentId: incident.id,
      workflowName: "In-Process Historical Retrieval E2E Test",
      status: ExecutionStatus.RUNNING,
      state: { status: "TRIGGERED", incidentId: incident.id }
    }
  });

  // Track event bus triggers
  const customEventsCaptured: string[] = [];
  workflowEventBus.on("custom", (data) => {
    customEventsCaptured.push(data.type);
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
      anomalies: [],
      status: "TRIGGERED"
    }
  });

  console.log(`✅ Workflow execution status: ${result.status}`);

  // --- 3. VERIFY RETRIEVED CONTEXT ---
  console.log("\n🔄 Validating shared context variables and dynamic logs...");
  
  // Verify database record updates
  const updatedExecution = await prisma.workflowExecution.findUnique({
    where: { id: workflowExecution.id }
  });

  const stateData = updatedExecution?.state as any;
  console.log(`✅ Shared Context Memory Summaries:`);
  console.log(`   Knowledge Summary: "${stateData?.knowledgeSummary}"`);
  console.log(`   Runbooks found count: ${stateData?.runbooks?.length}`);
  console.log(`   Post-Mortems found count: ${stateData?.postMortems?.length}`);
  console.log(`   Incidents matched count: ${stateData?.retrievedIncidents?.length}`);
  console.log(`   Confidence Score: ${stateData?.confidenceScore * 100}%`);

  if (!stateData?.knowledgeSummary) throw new Error("FAIL: WorkflowState is missing knowledgeSummary context.");
  if (!stateData?.runbooks || stateData.runbooks.length === 0) throw new Error("FAIL: WorkflowState is missing runbooks context.");
  if (!stateData?.retrievedIncidents || stateData.retrievedIncidents.length === 0) throw new Error("FAIL: WorkflowState is missing retrievedIncidents context.");

  // Verify custom event bus triggers
  const requiredEvents = [
    "HISTORICAL_RETRIEVAL_STARTED",
    "QDRANT_QUERY_COMPLETED",
    "MEMORY_CONTEXT_UPDATED",
    "HISTORICAL_RETRIEVAL_COMPLETED"
  ];
  for (const eventName of requiredEvents) {
    if (!customEventsCaptured.includes(eventName)) {
      throw new Error(`FAIL: Event Bus did not capture required signal "${eventName}".`);
    }
    console.log(`✅ Event Bus event confirmed: "${eventName}"`);
  }

  // Verify AgentExecution audits for Historical Retrieval Agent
  const retrievalExecs = await prisma.agentExecution.findMany({
    where: {
      incidentId: incident.id,
      agentName: "Historical Retrieval Agent"
    }
  });
  console.log(`✅ AgentExecutions found for Historical Retrieval Agent: ${retrievalExecs.length}`);
  if (retrievalExecs.length === 0) {
    throw new Error("FAIL: No AgentExecution logs written for Historical Retrieval Agent.");
  }
  for (const exec of retrievalExecs) {
    const payload = exec.output as any;
    console.log(`   ➔ Duration: ${payload?.searchDurationMs}ms`);
    console.log(`     Retrieved counts: Incidents=${payload?.retrievalResult?.retrievedIncidents?.length}`);
    if (typeof payload?.searchDurationMs !== "number") throw new Error("FAIL: Retrieval execution output missing searchDurationMs.");
  }

  // Verify dynamic timeline entry
  const timelineEvents = await prisma.incidentTimeline.findMany({
    where: { incidentId: incident.id }
  });
  const retrievalTimeline = timelineEvents.filter(t => t.eventDescription.includes("Historical Context Retrieved."));
  console.log(`✅ Retrieval Timeline entries: ${retrievalTimeline.length}`);
  if (retrievalTimeline.length === 0) {
    throw new Error("FAIL: Historical context timeline event not written to PostgreSQL.");
  }
  for (const event of retrievalTimeline) {
    const metadata = event.metadata as any;
    console.log(`   ➔ Event description: "${event.eventDescription}"`);
    console.log(`     Metadata: ConfidenceScore=${metadata?.confidenceScore}, LatencyMs=${metadata?.latencyMs}`);
    if (typeof metadata?.confidenceScore !== "number" || typeof metadata?.latencyMs !== "number") {
      throw new Error("FAIL: Timeline event metadata is missing confidenceScore or latencyMs.");
    }
  }

  // --- 4. HTTP API TEST GATEWAY ---
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

  // Clean up Qdrant points
  console.log("\n🔄 Cleaning up test records in Qdrant collections...");
  try {
    const qdrantClient = (qdrant as any).client;
    await qdrantClient.delete("historical_incidents", { points: [seedIncId] });
    await qdrantClient.delete("runbooks", { points: [seedRbId] });
    await qdrantClient.delete("postmortems", { points: [seedPmId] });
    console.log("✅ Seed vectors deleted.");
  } catch (err) {
    console.warn("⚠️ Qdrant server is offline. Skipping Qdrant vector points cleanup.");
  }

  // Clean up PostgreSQL db
  console.log("\n🔄 Cleaning up test records in Neon PostgreSQL database...");
  await prisma.incident.delete({ where: { id: incident.id } });
  await prisma.incident.delete({ where: { id: httpIncident.id } });
  console.log("✅ Test incident records deleted.");

  console.log("====================================================");
  console.log("🎉 ALL HISTORICAL RETRIEVAL SPECIALIST TESTS PASSED! 🎉");
  console.log("====================================================");
}

runTests().catch((err) => {
  console.error("\n❌ Verification run encountered errors:", err);
  process.exit(1);
});
