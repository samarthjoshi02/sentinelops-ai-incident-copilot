"use client";

import { motion } from "framer-motion";
import { User, Shield, Key, Fingerprint, Lock, Server, Cpu, Database } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="space-y-8 font-mono">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide">[ SECURITY_PROFILE ]</h1>
          <p className="text-xs text-cyber-muted mt-1 uppercase">Operator Clearance Level: Tier-1</p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-950/40 border border-cyber-success/30 rounded text-xs text-cyber-success">
          <Shield className="w-3.5 h-3.5" />
          <span>ACCESS: GRANTED</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Details */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel p-6 rounded-lg border-t-2 border-cyber-primary"
          >
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-cyber-bg border border-cyber-primary/50 flex items-center justify-center text-cyber-primary relative overflow-hidden">
                <div className="absolute inset-0 cyber-scanline"></div>
                <User className="w-8 h-8 relative z-10" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white uppercase">System Operator</h2>
                <p className="text-xs text-cyber-primary font-mono mt-1">ID: SO-8994-Alpha</p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-cyber-border/50">
                <span className="text-cyber-muted flex items-center gap-2"><Fingerprint className="w-4 h-4"/> Authentication</span>
                <span className="text-white">Biometric / 2FA</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-cyber-border/50">
                <span className="text-cyber-muted flex items-center gap-2"><Lock className="w-4 h-4"/> Clearance</span>
                <span className="text-cyber-danger">Top Secret (L5)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-cyber-border/50">
                <span className="text-cyber-muted flex items-center gap-2"><Key className="w-4 h-4"/> Session Token</span>
                <span className="text-cyber-success">Valid (Expires 4h)</span>
              </div>
            </div>
            
            <button className="w-full mt-6 py-2.5 glow-btn rounded text-sm text-white font-bold uppercase tracking-wider">
              Rotate Access Keys
            </button>
          </motion.div>
        </div>

        {/* Project Info */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel p-6 rounded-lg"
          >
            <h2 className="text-xl font-bold text-white mb-4 border-b border-cyber-border/50 pb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyber-primary" />
              [ ABOUT_SENTINEL_OPS_AI ]
            </h2>
            <div className="space-y-4 text-sm text-cyber-muted leading-relaxed">
              <p>
                <strong className="text-cyber-primary">SentinelOps AI</strong> is a next-generation autonomous incident response and threat intelligence platform designed for modern cloud architectures.
              </p>
              <p>
                By utilizing multi-agent LLM systems, SentinelOps reduces the <span className="text-white border-b border-dashed border-cyber-muted">Mean Time To Detect (MTTD)</span> and <span className="text-white border-b border-dashed border-cyber-muted">Mean Time To Respond (MTTR)</span> for critical security incidents. Our system proactively monitors logs, correlates vector-based semantic threat patterns, and recommends actionable remediation steps.
              </p>
              
              <h3 className="text-white font-bold mt-6 mb-2 flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                Core Architecture Stack
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <li className="p-3 bg-cyber-bg/50 border border-cyber-border rounded flex items-start gap-3">
                  <Database className="w-5 h-5 text-blue-400 shrink-0" />
                  <div>
                    <span className="block text-white font-bold mb-1">Neon PostgreSQL</span>
                    <span className="text-xs">Serverless Relational Data</span>
                  </div>
                </li>
                <li className="p-3 bg-cyber-bg/50 border border-cyber-border rounded flex items-start gap-3">
                  <Database className="w-5 h-5 text-cyber-danger shrink-0" />
                  <div>
                    <span className="block text-white font-bold mb-1">Qdrant Vector DB</span>
                    <span className="text-xs">Semantic Threat Memory</span>
                  </div>
                </li>
                <li className="p-3 bg-cyber-bg/50 border border-cyber-border rounded flex items-start gap-3">
                  <Cpu className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="block text-white font-bold mb-1">Google Gemini 2.5</span>
                    <span className="text-xs">Cognitive Analysis Engine</span>
                  </div>
                </li>
                <li className="p-3 bg-cyber-bg/50 border border-cyber-border rounded flex items-start gap-3">
                  <Shield className="w-5 h-5 text-cyber-warning shrink-0" />
                  <div>
                    <span className="block text-white font-bold mb-1">Enkrypt AI</span>
                    <span className="text-xs">LLM Safety & Guardrails</span>
                  </div>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
