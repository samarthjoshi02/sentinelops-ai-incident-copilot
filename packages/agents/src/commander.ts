import { Agent } from "@mastra/core/agent";
import { buildCrispePrompt } from "prompts";
import { z } from "zod";

// 1. Instantiates Incident Commander Agent using Google Gemini
export const incidentCommanderAgent = new Agent({
  id: "incident-commander-agent",
  name: "Incident Commander Agent",
  instructions: buildCrispePrompt("incident-commander"),
  model: "google/gemini-2.0-flash"
});

// 2. Structured JSON Output Schema
export const commanderOutputSchema = z.object({
  reasoning: z.string().describe("Explanation explaining the routing transition choice"),
  nextAgentId: z.enum([
    "anomaly-detector",
    "historical-retriever",
    "rca-analyst",
    "remediation-specialist",
    "post-mortem-scribe",
    "incident-commander"
  ]).describe("The target SRE agent delegated to execute the next step"),
  confidence: z.number().min(0).max(1).describe("Confidence score of the routing choice"),
  workflowTransition: z.string().describe("Shorthand summary of transition path, e.g., TRIGGERED -> INVESTIGATING"),
  statusUpdate: z.enum([
    "TRIGGERED",
    "INVESTIGATING",
    "MITIGATING",
    "RESOLVED",
    "CLOSED"
  ]).describe("New incident status")
});

export type CommanderDecision = z.infer<typeof commanderOutputSchema>;

/**
 * 3. runCommanderDecision
 * Prompt Gemini with the current SRE execution context state, obtaining a validated decision shape.
 */
export async function runCommanderDecision(stateContext: {
  incidentId: string;
  status: string;
  logsRaw?: string;
  anomalies?: any[];
  retrievedIncidents?: any[];
  rootCause?: any;
  remediationPlan?: any;
  postMortem?: any;
}): Promise<CommanderDecision> {
  const promptStr = `
Analyze the current Incident execution context state:
- Incident ID: ${stateContext.incidentId}
- Current Status: ${stateContext.status}
- Logs Raw length: ${stateContext.logsRaw?.length || 0} characters
- Isolated Anomalies count: ${stateContext.anomalies?.length || 0} items
- Has Historical Memory Searched: ${!!(stateContext.retrievedIncidents && stateContext.retrievedIncidents.length > 0)}
- Has Root Cause Diagnosed: ${!!stateContext.rootCause}
- Has Remediation Executed: ${!!stateContext.remediationPlan}
- Has Post-Mortem Generated: ${!!stateContext.postMortem}

Rules for selection:
- If current status is TRIGGERED and anomalies are empty, select "anomaly-detector".
- If anomalies exist but historical memory (searched incidents/runbooks) has not been retrieved, select "historical-retriever".
- If historical memory has been retrieved but root cause is missing, select "rca-analyst".
- If root cause exists but remediation plan is missing, select "remediation-specialist".
- If remediation plan is completed but post-mortem is missing, select "post-mortem-scribe".
- If everything is resolved and post-mortem is archived, select "incident-commander" to finalize.

Analyze the state, provide your blameless reasoning, determine the next agent ID to route, and select the status update.
`.trim();

  // Structured Generation using Mastra Agent
  const response = await incidentCommanderAgent.generate(promptStr, {
    structuredOutput: {
      schema: commanderOutputSchema
    }
  });

  if (!response.object) {
    throw new Error("Incident Commander Agent did not return a valid structured output JSON response.");
  }

  return response.object;
}
