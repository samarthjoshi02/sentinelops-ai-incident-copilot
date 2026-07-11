"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import LogUploadModal from "./LogUploadModal";

export default function IncidentActions() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-950/40 hover:bg-blue-900/60 border border-cyber-primary/50 text-cyber-primary rounded text-sm font-mono transition-all duration-200 glow-btn"
        >
          <Upload className="w-4 h-4" />
          <span>Ingest Log</span>
        </button>
      </div>

      {isModalOpen && <LogUploadModal onClose={() => setIsModalOpen(false)} />}
    </>
  );
}
