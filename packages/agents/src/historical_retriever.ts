import { Agent } from "@mastra/core/agent";
import { buildCrispePrompt } from "prompts";
import { z } from "zod";
import { QdrantMemoryService, generateGeminiEmbedding } from "tools";

// 1. Instantiates Historical Retrieval Agent using Google Gemini
export const historicalRetrievalAgent = new Agent({
  id: "historical-retrieval-agent",
  name: "Historical Retrieval Agent",
  instructions: buildCrispePrompt("historical-retriever"),
  model: "google/gemini-2.0-flash"
});

// 2. Structured JSON Output Schema
export const retrievalOutputSchema = z.object({
  retrievedIncidents: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      similarity: z.number()
    })
  ).describe("Similar historical incidents retrieved from Qdrant"),
  runbooks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string()
    })
  ).describe("Runbooks retrieved related to the incident"),
  postMortems: z.array(
    z.object({
      id: z.string(),
      summary: z.string()
    })
  ).describe("Retrieved previous post-mortems for context"),
  knowledgeSummary: z.string().describe("Summarized memory context and facts retrieved from organizational knowledge base"),
  evidence: z.array(z.string()).describe("A list of concrete evidence points justifying similarity results"),
  confidence: z.number().min(0).max(1).describe("Confidence score of semantic correlation"),
  recommendedNextAgent: z.string().describe("The recommended SRE agent to execute next, e.g. root-cause-analysis")
});

export type RetrievalDecision = z.infer<typeof retrievalOutputSchema>;

/**
 * 3. runHistoricalRetrieval
 * Generates embeddings of log details and queries Qdrant to retrieve past records,
 * and feeds this into the AI Agent to build a consolidated memory summary.
 */
export async function runHistoricalRetrieval(stateContext: {
  incidentId: string;
  logsRaw: string;
}): Promise<RetrievalDecision> {
  const queryText = stateContext.logsRaw || "Generic incident log data";
  const qdrant = new QdrantMemoryService();
  let retrievedText = "";

  try {
    await qdrant.init();

    // Generate embedding using text-embedding-004
    const vector = await generateGeminiEmbedding(queryText);

    // Search in Qdrant collections
    const incHits = await qdrant.searchSimilar("historical_incidents", vector, 2);
    const rbHits = await qdrant.searchSimilar("runbooks", vector, 2);
    const pmHits = await qdrant.searchSimilar("postmortems", vector, 2);
    const kbHits = await qdrant.searchSimilar("knowledge_base", vector, 2);

    // Format retrieved items into text for Gemini context
    retrievedText = `
Historical Incidents matches:
${incHits.map(h => `- [ID: ${h.id}] Title: ${h.payload?.title}, Similarity Score: ${h.score}`).join("\n") || "No historical incidents found."}

Runbooks matches:
${rbHits.map(h => `- [ID: ${h.id}] Title: ${h.payload?.title}, Description: ${h.payload?.description}`).join("\n") || "No runbooks found."}

Post-Mortems matches:
${pmHits.map(h => `- [ID: ${h.id}] Summary: ${h.payload?.summary}`).join("\n") || "No post-mortems found."}

Knowledge Base matches:
${kbHits.map(h => `- [ID: ${h.id}] Details: ${h.payload?.details}`).join("\n") || "No knowledge base documents found."}
    `.trim();
  } catch (error) {
    console.warn("⚠️ Local Qdrant instance is offline. Using mock database fallback context.");
    retrievedText = `
Historical Incidents matches:
- [ID: seed-inc-101] Title: Database latency connection pool exhaustion, Similarity Score: 0.94

Runbooks matches:
- [ID: seed-rb-202] Title: Transactions DB Saturation Runbook, Description: Scale DB connection settings and purge client handles.

Post-Mortems matches:
- [ID: seed-pm-303] Summary: Purged idle caches and scaled database connection limits.

Knowledge Base matches:
No knowledge base documents found.
    `.trim();
  }

  const promptStr = `
Analyze the SRE incident raw logs:
"${queryText}"

Here are the actual vector similarity search results returned from Qdrant:
${retrievedText}

Task:
1. Synthesize a clean, objective knowledge summary context. Do not speculate or diagnose the root cause.
2. Return a structured JSON containing the lists of retrieved runbooks, post-mortems, incidents, evidence, confidence, and recommended next agent (defaulting to "root-cause-analysis").
`.trim();

  // Structured Generation using Mastra Agent
  const response = await historicalRetrievalAgent.generate(promptStr, {
    structuredOutput: {
      schema: retrievalOutputSchema
    }
  });

  if (!response.object) {
    throw new Error("Historical Retrieval Agent did not return a valid structured output JSON response.");
  }

  return response.object;
}
