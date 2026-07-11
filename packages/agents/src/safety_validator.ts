import { EnkryptAISafetyService } from "tools";

export interface SafetyValidationResult {
    safe: boolean;
    reason?: string;
}

const safetyService = new EnkryptAISafetyService();

/**
 * Validate an AI-generated remediation plan before execution.
 */
export async function validateRemediationPlan(
    remediationPlan: string
): Promise<SafetyValidationResult> {
    return await safetyService.validateResponse(remediationPlan);
}