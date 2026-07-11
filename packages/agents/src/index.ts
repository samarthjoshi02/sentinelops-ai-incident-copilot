import { buildCrispePrompt } from "prompts";
import { runCommanderDecision } from "./commander.js";

export interface AgentMetadata {
  id: string;
  name: string;
  role: string;
  description: string;
  promptTemplate: string;
  allowedTools: string[];
}

export const AGENT_REGISTRY: Record<string, AgentMetadata> = {
  "anomaly-detector": {
    id: "anomaly-detector",
    name: "Anomaly Detector Agent",
    role: "Senior Telemetry Analyst",
    description: "Parses telemetry metrics and application error signatures to flag anomalies.",
    promptTemplate: "anomaly-detector",
    allowedTools: ["log-parser"]
  },
  "rca-analyst": {
    id: "rca-analyst",
    name: "RCA Analyst Agent",
    role: "Staff Systems Diagnostician",
    description: "Diagnoses root causes and tracks confidence factors.",
    promptTemplate: "rca-analyst",
    allowedTools: []
  },
  "remediation-specialist": {
    id: "remediation-specialist",
    name: "Remediation Specialist Agent",
    role: "DevOps Automation Expert",
    description: "Maps diagnoses to runbooks and triggers automated mitigations.",
    promptTemplate: "remediation-specialist",
    allowedTools: ["remediation-executor"]
  },
  "safety-validator": {
    id: "safety-validator",
    name: "Safety Validator Agent",
    role: "AI Safety & Guardrails Specialist",
    description: "Validates AI-generated remediation plans using Enkrypt AI before execution.",
    promptTemplate: "safety-validator",
    allowedTools: []
  },
  "timeline-scribe": {
    id: "timeline-scribe",
    name: "Timeline Scribe Agent",
    role: "System Operations Scribe",
    description: "Constructs chronological incident event logs.",
    promptTemplate: "timeline-scribe",
    allowedTools: ["timeline-scribe"]
  },
  "post-mortem-scribe": {
    id: "post-mortem-scribe",
    name: "Post-Mortem Scribe Agent",
    role: "Post-Mortem Scribe",
    description: "Synthesizes outcomes into blameless post-mortem reports.",
    promptTemplate: "post-mortem-scribe",
    allowedTools: ["post-mortem-generator"]
  },
  "knowledge-librarian": {
    id: "knowledge-librarian",
    name: "Knowledge Librarian Agent",
    role: "System Librarian",
    description: "Updates tags and suggestions inside runbooks based on findings.",
    promptTemplate: "knowledge-librarian",
    allowedTools: []
  },
  "incident-commander": {
    id: "incident-commander",
    name: "Incident Commander Agent",
    role: "Principal Incident Commander",
    description: "Coordinates SRE operations, delegates tasks, and sends alerts.",
    promptTemplate: "incident-commander",
    allowedTools: []
  },
  "historical-retriever": {
    id: "historical-retriever",
    name: "Historical Retrieval Agent",
    role: "Senior Historical Retrieval Specialist",
    description: "Queries semantic memories in Qdrant database to locate past similar incidents, post-mortems, and runbooks.",
    promptTemplate: "historical-retriever",
    allowedTools: []
  }
};

export class AgentRouter {
  /**
   * Evaluates the workflow state context and determines the next target agent ID to invoke.
   */
  route(state: {
    status: string;
    anomaliesCount: number;
    hasDiagnosis: boolean;
    hasRemediation: boolean;
    hasSafetyValidation: boolean;
    hasPostMortem: boolean;
  }): string {
    if (state.status === "TRIGGERED" && state.anomaliesCount === 0) {
      return "anomaly-detector";
    }
    if (state.anomaliesCount > 0 && !state.hasDiagnosis) {
      return "rca-analyst";
    }
    if (state.hasDiagnosis && !state.hasRemediation) {
      return "remediation-specialist";
    }

    if (state.hasRemediation && !state.hasSafetyValidation) {
      return "safety-validator";
    }
    if (state.hasSafetyValidation && !state.hasPostMortem) {
      return "post-mortem-scribe";
    }
    return "incident-commander";
  }

  /**
   * Dynamic AI-driven routing decision using the Incident Commander agent.
   */
  async routeDynamic(state: {
    incidentId: string;
    status: string;
    logsRaw?: string;
    anomalies?: any[];
    rootCause?: any;
    remediationPlan?: any;
    postMortem?: any;
  }) {
    return runCommanderDecision(state);
  }

  /**
   * Fetches full configuration (metadata and CRISPE prompt) for the routed agent.
   */
  getAgentConfig(agentId: string, additionalContext?: string) {
    const meta = AGENT_REGISTRY[agentId];
    if (!meta) {
      throw new Error(`Agent ${agentId} is not registered in the system.`);
    }

    return {
      ...meta,
      systemPrompt: buildCrispePrompt(meta.promptTemplate, additionalContext)
    };
  }
}

export * from "./commander.js";
export * from "./historical_retriever.js";
export * from "./rca_analyst.js";
