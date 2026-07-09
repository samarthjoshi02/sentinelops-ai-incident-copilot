import { Agent } from "@mastra/core/agent";
import { buildCrispePrompt } from "prompts";
import { z } from "zod";

// 1. Instantiates RCA Analyst Agent using Google Gemini
export const rcaAnalystAgent = new Agent({
  id: "rca-analyst-agent",
  name: "RCA Analyst Agent",
  instructions: buildCrispePrompt("rca-analyst"),
  model: "google/gemini-2.0-flash"
});

// 2. Structured JSON Output Schema
export const rcaOutputSchema = z.object({
  rootCauses: z.array(
    z.object({
      title: z.string().describe("Descriptive title of the identified root cause"),
      description: z.string().describe("Detailed narrative explanation of the failure mechanism"),
      confidence: z.number().min(0).max(1).describe("Probability score of this cause being correct"),
      evidence: z.array(z.string()).describe("Evidence points (such as log lines or metrics) supporting this cause"),
      affectedServices: z.array(z.string()).describe("A list of systems or microservices affected by this cause"),
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).describe("Severity level of this root cause")
    })
  ).describe("A ranked list of candidate root causes"),
  overallConfidence: z.number().min(0).max(1).describe("Aggregated confidence score of the diagnosis"),
  reasoning: z.string().describe("Consolidated blameless reasoning explaining the overall diagnostic deduction"),
  recommendedNextAgent: z.string().describe("The SRE agent recommended to run next, typically remediation-agent")
});

export type RcaDecision = z.infer<typeof rcaOutputSchema>;

/**
 * 3. runRootCauseAnalysis
 * Prompts the RCA Analyst Agent with telemetry anomalies, raw logs,
 * and retrieved memory context from Qdrant, yielding a structured JSON diagnosis.
 */
export async function runRootCauseAnalysis(stateContext: {
  incidentId: string;
  logsRaw: string;
  anomalies: any[];
  retrievedIncidents: any[];
  runbooks: any[];
  postMortems: any[];
  knowledgeSummary: string;
}): Promise<RcaDecision> {
  const anomaliesText = JSON.stringify(stateContext.anomalies, null, 2);

  const retrievedText = `
Historical Incidents matches:
${stateContext.retrievedIncidents.map(h => `- [ID: ${h.id}] Title: ${h.title}, Similarity Score: ${h.similarity}`).join("\n") || "No historical incidents found."}

Runbooks matches:
${stateContext.runbooks.map(h => `- [ID: ${h.id}] Title: ${h.title}, Description: ${h.description}`).join("\n") || "No runbooks found."}

Post-Mortems matches:
${stateContext.postMortems.map(h => `- [ID: ${h.id}] Summary: ${h.summary}`).join("\n") || "No post-mortems found."}

Knowledge Summary:
${stateContext.knowledgeSummary || "No knowledge base documents found."}
  `.trim();

  const promptStr = `
Analyze the active SRE incident details:
Incident ID: ${stateContext.incidentId}
Logs: "${stateContext.logsRaw}"

Isolated Anomalies:
${anomaliesText}

Retrieved SRE Memory Context (Qdrant):
${retrievedText}

Task:
1. Identify the most probable underlying root cause(s). Do not suggest remediations or action items.
2. Produce ranked hypotheses with individual confidence, evidence logs/anomalies, and affected services.
3. Consolidate your reasoning and select the next recommended SRE agent.
4. Output structured JSON conforming to the schema.
`.trim();

  // Structured Generation using Mastra Agent
  const response = await rcaAnalystAgent.generate(promptStr, {
    structuredOutput: {
      schema: rcaOutputSchema
    }
  });

  if (!response.object) {
    throw new Error("RCA Analyst Agent did not return a valid structured output JSON response.");
  }

  return response.object;
}
