"use client";

import { useState } from "react";
import { Play, Activity, AlertTriangle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface RemediationButtonProps {
  incidentId: string;
}

export default function RemediationButton({ incidentId }: RemediationButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleRemediate = async () => {
    setLoading(true);
    setStatus("running");
    setMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4112/api";
      const response = await fetch(`${apiUrl}/incidents/${incidentId}/remediate`, {
        method: "POST",
        credentials: "include", // Send Auth.js cookies
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to trigger remediation workflow.");
      }

      setStatus("success");
      setMessage("Remediation workflow initiated successfully.");
      
      // Refresh to update timeline and status
      setTimeout(() => {
        router.refresh();
      }, 1500);

    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleRemediate}
        disabled={loading || status === "success"}
        className={`flex items-center space-x-2 px-4 py-2 rounded text-sm font-mono transition-all duration-200 
          ${status === "success" 
            ? "bg-emerald-950/40 text-cyber-success border border-cyber-success/50" 
            : "bg-blue-950/40 hover:bg-blue-900/60 text-cyber-primary border border-cyber-primary/50 glow-btn"
          } 
          disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <Activity className="w-4 h-4 animate-spin" />
        ) : status === "success" ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        <span>
          {loading ? "INITIALIZING AGENT..." : status === "success" ? "WORKFLOW TRIGGERED" : "RUN REMEDIATION AGENT"}
        </span>
      </button>

      {message && (
        <div className={`mt-2 flex items-center space-x-2 text-xs font-mono 
          ${status === "error" ? "text-cyber-danger" : "text-cyber-success"}`}>
          {status === "error" && <AlertTriangle className="w-3.5 h-3.5" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
