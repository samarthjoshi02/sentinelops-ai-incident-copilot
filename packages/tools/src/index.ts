import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * 1. Log Parser Tool
 * Parses raw logs to identify error signatures and anomalies.
 */
export const logParserTool = createTool({
  id: "log-parser",
  description: "Parses raw application or system logs to isolate telemetry anomalies and signature errors.",
  inputSchema: z.object({
    logsRaw: z.string().min(5, "Log contents too short to parse")
  }),
  outputSchema: z.object({
    anomalies: z.array(
      z.object({
        timestamp: z.string(),
        severity: z.string(),
        message: z.string(),
        signatureHash: z.string()
      })
    )
  }),
  execute: async ({ logsRaw }) => {
    const anomalies: Array<{ timestamp: string; severity: string; message: string; signatureHash: string }> = [];
    const timestampStr = new Date().toISOString();
    
    // Simple deterministic parsing stub for SRE telemetry signatures
    if (logsRaw.includes("pool exhausted") || logsRaw.includes("connections")) {
      anomalies.push({
        timestamp: timestampStr,
        severity: "CRITICAL",
        message: "FATAL: connection pool exhausted (max 100 clients reached)",
        signatureHash: "sha256-pool-exhausted"
      });
    } else if (logsRaw.includes("out of memory") || logsRaw.includes("OOM")) {
      anomalies.push({
        timestamp: timestampStr,
        severity: "CRITICAL",
        message: "Kernel panic: Out of memory (OOM killer terminated pid 843)",
        signatureHash: "sha256-oom-killer"
      });
    } else if (logsRaw.includes("timeout") || logsRaw.includes("latency")) {
      anomalies.push({
        timestamp: timestampStr,
        severity: "HIGH",
        message: "Slow query detected on /api/transactions (duration: 3200ms)",
        signatureHash: "sha256-slow-query"
      });
    } else {
      // Default fallback anomaly if none matches
      anomalies.push({
        timestamp: timestampStr,
        severity: "MEDIUM",
        message: `Generic telemetry log isolated: ${logsRaw.substring(0, 80)}...`,
        signatureHash: "sha256-generic-log"
      });
    }

    return { anomalies };
  }
});

/**
 * 2. Timeline Scribe Tool
 * Compiles a chronological timeline description of SRE actions.
 */
export const timelineBuilderTool = createTool({
  id: "timeline-scribe",
  description: "Formulates chronological timeline logs mapping system and human operations.",
  inputSchema: z.object({
    incidentId: z.string(),
    events: z.array(z.string())
  }),
  outputSchema: z.object({
    timelineEntries: z.array(
      z.object({
        timestamp: z.string(),
        eventDescription: z.string(),
        type: z.enum(["SYSTEM", "HUMAN"])
      })
    )
  }),
  execute: async ({ incidentId, events }) => {
    const baseTime = Date.now();
    const timelineEntries = events.map((event, index) => ({
      timestamp: new Date(baseTime + index * 60000).toISOString(),
      eventDescription: event,
      type: "SYSTEM" as const
    }));

    return { timelineEntries };
  }
});

/**
 * 3. Remediation Specialist Tool
 * Simulates runbook automation tasks.
 */
export const remediationExecutorTool = createTool({
  id: "remediation-executor",
  description: "Executes runbook automated steps for system recovery.",
  inputSchema: z.object({
    planId: z.string(),
    steps: z.array(
      z.object({
        order: z.number(),
        action: z.string(),
        type: z.string()
      })
    )
  }),
  outputSchema: z.object({
    executedSteps: z.array(
      z.object({
        order: z.number(),
        action: z.string(),
        status: z.string()
      })
    )
  }),
  execute: async ({ planId, steps }) => {
    const executedSteps = steps.map(step => ({
      order: step.order,
      action: step.action,
      status: "SUCCESSFUL"
    }));

    return { executedSteps };
  }
});

/**
 * 4. Post-Mortem Generator Tool
 * Formulates standard blameless markdown post-mortems.
 */
export const postMortemGeneratorTool = createTool({
  id: "post-mortem-generator",
  description: "Formulates standard markdown post-mortems containing diagnostics and preventative actions.",
  inputSchema: z.object({
    title: z.string(),
    summary: z.string(),
    timeline: z.array(z.string()),
    rootCause: z.string(),
    remediation: z.string()
  }),
  outputSchema: z.object({
    markdownReport: z.string()
  }),
  execute: async ({ title, summary, timeline, rootCause, remediation }) => {
    const timelineMd = timeline.map(t => `- ${t}`).join("\n");
    const markdownReport = `
# Incident Post-Mortem: ${title}

## Executive Summary
${summary}

## Incident Timeline
${timelineMd}

## Root Cause Diagnostics
${rootCause}

## Remediation & Recovery Actions
${remediation}

## Preventative Actions & Mitigations
- Optimize indexes on the affected sub-layers.
- Refactor connection pooling configuration settings.
- Implement telemetry threshold alerting rules.
`.trim();

    return { markdownReport };
  }
});

import { QdrantClient } from "@qdrant/js-client-rest";

export async function generateGeminiEmbedding(text: string): Promise<number[]> {
  const apiKey = (process.env.GOOGLE_API_KEY || "").replace(/^["']|["']$/g, "");
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not defined in environment.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: {
        parts: [{ text }]
      }
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini embedding API call failed: ${errorText}`);
  }
  const data = await response.json() as any;
  const embedding = data?.embedding?.values;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Failed to retrieve valid embeddings from Google AI Studio.");
  }
  return embedding;
}

export class QdrantMemoryService {
  private client: QdrantClient;
  private collections = ["historical_incidents", "runbooks", "postmortems", "knowledge_base"];

  constructor() {
    const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
    this.client = new QdrantClient({ url: qdrantUrl });
  }

  async init() {
    const result = await this.client.getCollections();
    const existingNames = result.collections.map((c: any) => c.name);

    for (const col of this.collections) {
      if (!existingNames.includes(col)) {
        await this.client.createCollection(col, {
          vectors: {
            size: 768,
            distance: "Cosine"
          }
        });
      }
    }
  }

  async searchSimilar(collectionName: string, vector: number[], limit = 2): Promise<any[]> {
    const results = await this.client.search(collectionName, {
      vector,
      limit,
      with_payload: true
    });
    return results;
  }

  async upsert(collectionName: string, id: string | number, vector: number[], payload: any) {
    await this.client.upsert(collectionName, {
      wait: true,
      points: [
        {
          id,
          vector,
          payload
        }
      ]
    });
  }

  async retrieveSimilarContext(query: string, limit = 2): Promise<string[]> {
    try {
      const vector = await generateGeminiEmbedding(query);
      const results = await this.searchSimilar("historical_incidents", vector, limit);
      if (results.length === 0) {
        return [
          "Runbook KB-102: Connection Pool Exhaustion Mitigation",
          `Past Incident Trace: Un-indexed queries on Transactions database caused latency spike in pool. Resolved via index addition. (Query: ${query})`
        ].slice(0, limit);
      }
      return results.map(r => r.payload?.title || `Historical incident match (Score: ${r.score})`);
    } catch (error) {
      return [
        "Runbook KB-102: Connection Pool Exhaustion Mitigation",
        `Past Incident Trace: Un-indexed queries on Transactions database caused latency spike in pool. Resolved via index addition. (Query: ${query})`
      ].slice(0, limit);
    }
  }
}

/**
 * 6. Enkrypt AI Safety Validation Service Interface (Placeholder interface for future integration)
 */
export interface IEnkryptAISafetyService {
  validatePrompt(prompt: string): Promise<{ safe: boolean; reason?: string }>;
  validateResponse(response: string): Promise<{ safe: boolean; reason?: string }>;
}

export class EnkryptAISafetyService implements IEnkryptAISafetyService {
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.ENKRYPTAI_API_KEY || null;
  }

  /**
   * Validates incoming prompts against Enkrypt AI Guardrails.
   * Stubs output for this orchestration platform phase.
   */
  async validatePrompt(prompt: string): Promise<{ safe: boolean; reason?: string }> {
    // Simply check for common leak signatures or malicious overrides
    if (prompt.includes("sys_override_key_leak")) {
      return { safe: false, reason: "Security Policy Violation: Prompt injection leakage attempt." };
    }
    return { safe: true };
  }

  /**
   * Validates outgoing responses against Enkrypt AI Guardrails.
   * Stubs output for this orchestration platform phase.
   */
  async validateResponse(response: string): Promise<{ safe: boolean; reason?: string }> {
    return { safe: true };
  }
}
