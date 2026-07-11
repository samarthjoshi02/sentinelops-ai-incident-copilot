"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Upload, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface LogUploadModalProps {
  onClose: () => void;
}

export default function LogUploadModal({ onClose }: LogUploadModalProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a log file to ingest.");
      return;
    }
    if (title.length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("severity", severity);

    try {
      // API URL for the backend fastify server
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4112/api";
      
      const response = await fetch(`${apiUrl}/incidents/pipeline`, {
        method: "POST",
        body: formData,
        credentials: "include", // Send Auth.js cookies
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload log and create incident.");
      }

      // Success
      router.refresh(); // Refresh current route to show new incident
      onClose(); // Close modal
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during ingestion.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg glass-panel rounded-lg shadow-2xl border border-cyber-border overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-cyber-border bg-cyber-bg/50">
          <h2 className="text-lg font-bold text-white font-mono flex items-center">
            <Upload className="w-5 h-5 mr-2 text-cyber-primary" />
            [ INGEST_LOG_PIPELINE ]
          </h2>
          <button onClick={onClose} type="button" className="p-1 text-cyber-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-cyber-danger/40 rounded flex items-start space-x-3 text-sm text-red-200 font-mono">
              <AlertTriangle className="w-5 h-5 text-cyber-danger flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 font-mono">
            <div>
              <label className="block text-xs text-cyber-muted uppercase tracking-wider mb-2">Incident Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Database Connection Pool Exhaustion"
                className="w-full px-4 py-2 text-sm rounded glass-input transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-xs text-cyber-muted uppercase tracking-wider mb-2">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief context about where this log came from..."
                className="w-full px-4 py-2 text-sm rounded glass-input min-h-[80px] transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-xs text-cyber-muted uppercase tracking-wider mb-2">Initial Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-4 py-2 text-sm rounded glass-input transition-all duration-200 appearance-none"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-cyber-muted uppercase tracking-wider mb-2">Log File (.log, .txt, .json, .csv)</label>
              <div className="relative border-2 border-dashed border-cyber-border rounded-lg p-6 hover:border-cyber-primary/50 transition-colors bg-cyber-card/10 text-center">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".log,.txt,.json,.csv"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  {file ? (
                    <>
                      <FileText className="w-8 h-8 text-cyber-success" />
                      <span className="text-sm text-cyber-success font-bold">{file.name}</span>
                      <span className="text-xs text-cyber-muted">{(file.size / 1024).toFixed(1)} KB</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-cyber-muted" />
                      <span className="text-sm text-white">Click or drag file to upload</span>
                      <span className="text-xs text-cyber-muted">Max size: 10MB</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-cyber-border flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded font-mono text-cyber-muted hover:text-white transition-colors"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 text-sm rounded font-mono font-bold text-white glow-btn flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{loading ? "PROCESSING..." : "INITIATE INGESTION"}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
