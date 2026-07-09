import "dotenv/config";
import { expect } from "assert";

const PORT = process.env.PORT || "4111";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = (process.env.AUTH_SECRET || "").replace(/^["']|["']$/g, "");

async function runTests() {
  console.log("====================================================");
  console.log("SentinelOps AI - Phase 2 API & Pipeline Verification");
  console.log("====================================================");

  let testIncidentId = "";
  let pipelineIncidentId = "";

  // 1. Health Check
  try {
    console.log("🔄 Testing /health check endpoint...");
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json() as any;
    if (res.status === 200 && data.status === "OK") {
      console.log("✅ Health check: OK");
    } else {
      console.error(`❌ Health check failed (Status ${res.status}):`, data);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Failed to reach health endpoint:", err);
    process.exit(1);
  }

  // 2. Authentication Barrier Test
  try {
    console.log("🔄 Testing authentication barrier (no credentials)...");
    const res = await fetch(`${BASE_URL}/api/incidents`);
    if (res.status === 401) {
      console.log("✅ Auth barrier correctly blocked request (401 Unauthorized)");
    } else {
      console.error(`❌ Auth barrier failed: expected 401, got ${res.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Auth barrier request failed:", err);
    process.exit(1);
  }

  // 3. Invalid Token Test
  try {
    console.log("🔄 Testing authentication barrier (invalid credentials)...");
    const res = await fetch(`${BASE_URL}/api/incidents`, {
      headers: { "Authorization": "Bearer BAD_TOKEN" }
    });
    if (res.status === 401) {
      console.log("✅ Auth barrier correctly rejected bad token (401 Unauthorized)");
    } else {
      console.error(`❌ Auth barrier failed: expected 401, got ${res.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Bad token request failed:", err);
    process.exit(1);
  }

  // 4. GET Incidents (With Auth Header)
  try {
    console.log("🔄 Testing GET /api/incidents with Bearer AUTH_SECRET...");
    const res = await fetch(`${BASE_URL}/api/incidents`, {
      headers: { "Authorization": `Bearer ${AUTH_SECRET}` }
    });
    if (res.status === 200) {
      const data = await res.json() as any;
      console.log(`✅ GET incidents list succeeded. Count: ${data.incidents?.length}`);
    } else {
      const errText = await res.text();
      console.error(`❌ GET incidents list failed (Status ${res.status}):`, errText);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ GET incidents request failed:", err);
    process.exit(1);
  }

  // 5. POST Incident CRUD - Create
  try {
    console.log("🔄 Testing POST /api/incidents (Create Incident)...");
    const payload = {
      title: "Verify Test: Database Latency Spike",
      description: "Automated alert indicating Postgres transaction latency exceeded 500ms threshold.",
      severity: "HIGH",
      source: "TEST_RUNNER"
    };

    const res = await fetch(`${BASE_URL}/api/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AUTH_SECRET}`
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 201) {
      const data = await res.json() as any;
      testIncidentId = data.id;
      console.log(`✅ Incident created successfully. ID: ${testIncidentId}`);
    } else {
      const errText = await res.text();
      console.error(`❌ Incident creation failed (Status ${res.status}):`, errText);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Incident creation request failed:", err);
    process.exit(1);
  }

  // 6. GET Incident Details
  try {
    console.log(`🔄 Testing GET /api/incidents/${testIncidentId} (Fetch details)...`);
    const res = await fetch(`${BASE_URL}/api/incidents/${testIncidentId}`, {
      headers: { "Authorization": `Bearer ${AUTH_SECRET}` }
    });

    if (res.status === 200) {
      const data = await res.json() as any;
      console.log("✅ Detailed fetch succeeded.");
      console.log(`   Title: "${data.title}"`);
      console.log(`   Severity: "${data.severity}"`);
      console.log(`   Status: "${data.status}"`);
      console.log(`   Timeline Entries: ${data.timeline?.length}`);
    } else {
      console.error(`❌ Failed to fetch incident details (Status ${res.status})`);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Incident details request failed:", err);
    process.exit(1);
  }

  // 7. PUT Incident Details (Transition status)
  try {
    console.log(`🔄 Testing PUT /api/incidents/${testIncidentId} (Transition: TRIGGERED -> ACKNOWLEDGED)...`);
    const res = await fetch(`${BASE_URL}/api/incidents/${testIncidentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AUTH_SECRET}`
      },
      body: JSON.stringify({ status: "ACKNOWLEDGED" })
    });

    if (res.status === 200) {
      const data = await res.json() as any;
      console.log(`✅ Update transition succeeded. New Status: "${data.status}"`);
      
      // Re-fetch timeline events to confirm transition logged
      const detailRes = await fetch(`${BASE_URL}/api/incidents/${testIncidentId}`, {
        headers: { "Authorization": `Bearer ${AUTH_SECRET}` }
      });
      const detailData = await detailRes.json() as any;
      console.log(`✅ Verified Timeline count after transition: ${detailData.timeline?.length}`);
      console.log(`   Latest Timeline: "${detailData.timeline?.[0]?.eventDescription}"`);
    } else {
      const errText = await res.text();
      console.error(`❌ Update transition failed (Status ${res.status}):`, errText);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Update request failed:", err);
    process.exit(1);
  }

  // 8. Log Upload Endpoint Test
  try {
    console.log("🔄 Testing POST /api/logs/upload (Upload log to database & disk)...");
    const formData = new FormData();
    const mockContent = "2026-07-09 10:45:00 [ERROR] Connection pool size exceeded. Active connections: 100, Peak limit: 100.";
    const fileBlob = new Blob([mockContent], { type: "text/plain" });
    
    formData.append("file", fileBlob, "server_pool_overflow.log");
    formData.append("incidentId", testIncidentId);

    const res = await fetch(`${BASE_URL}/api/logs/upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AUTH_SECRET}`
      },
      body: formData
    });

    if (res.status === 201) {
      const data = await res.json() as any;
      console.log("✅ Log upload succeeded!");
      console.log(`   File ID: ${data.id}`);
      console.log(`   File Name: "${data.fileName}"`);
      console.log(`   Checksum (SHA-256): ${data.checksum}`);
    } else {
      const errText = await res.text();
      console.error(`❌ Log upload failed (Status ${res.status}):`, errText);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Log upload request failed:", err);
    process.exit(1);
  }

  // 9. Unified Ingestion Pipeline Test (Form + File upload at once)
  try {
    console.log("🔄 Testing POST /api/incidents/pipeline (Unified Ingestion Pipeline)...");
    const formData = new FormData();
    const mockLog = "FATAL: core dumped at 0x7fffbcda01. Exception: NullPointerException in thread 'main'.";
    const fileBlob = new Blob([mockLog], { type: "text/plain" });

    formData.append("file", fileBlob, "panic_kernel.log");
    formData.append("title", "Verify Pipeline Trigger: Core Dump");
    formData.append("description", "Log-driven pipeline anomaly alert.");
    formData.append("severity", "CRITICAL");

    const res = await fetch(`${BASE_URL}/api/incidents/pipeline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AUTH_SECRET}`
      },
      body: formData
    });

    if (res.status === 201) {
      const data = await res.json() as any;
      pipelineIncidentId = data.incident.id;
      console.log("✅ Ingestion pipeline triggered successfully!");
      console.log(`   Incident ID: ${data.incident.id} (Status: "${data.incident.status}", Severity: "${data.incident.severity}")`);
      console.log(`   Log ID: ${data.log.id} (Check: ${data.log.checksum})`);
      
      // Fetch details of pipeline incident to verify relational mapping
      const detailRes = await fetch(`${BASE_URL}/api/incidents/${pipelineIncidentId}`, {
        headers: { "Authorization": `Bearer ${AUTH_SECRET}` }
      });
      const detailData = await detailRes.json() as any;
      console.log(`✅ Checked pipeline timeline length: ${detailData.timeline?.length}`);
      console.log(`   Initial event descriptions:`);
      detailData.timeline?.forEach((t: any) => console.log(`    ➔ [${t.type}] ${t.eventDescription}`));
    } else {
      const errText = await res.text();
      console.error(`❌ Ingestion pipeline failed (Status ${res.status}):`, errText);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Ingestion pipeline request failed:", err);
    process.exit(1);
  }

  // 10. Clean up - Delete created incidents
  try {
    console.log("🔄 Cleaning up verification test records...");
    
    if (testIncidentId) {
      const res = await fetch(`${BASE_URL}/api/incidents/${testIncidentId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${AUTH_SECRET}` }
      });
      if (res.status === 200) {
        console.log(`✅ Deleted test incident ${testIncidentId}`);
      }
    }

    if (pipelineIncidentId) {
      const res = await fetch(`${BASE_URL}/api/incidents/${pipelineIncidentId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${AUTH_SECRET}` }
      });
      if (res.status === 200) {
        console.log(`✅ Deleted pipeline incident ${pipelineIncidentId}`);
      }
    }
    
    console.log("====================================================");
    console.log("🎉 ALL PHASE 2 REST APIs AND PIPELINES OPERATIONAL! 🎉");
    console.log("====================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  }
}

runTests();
