"use client";

import { motion } from "framer-motion";
import { Activity, ShieldAlert, Cpu, Heart, Database, AlertCircle, Sparkles, Terminal } from "lucide-react";

export default function DashboardPage() {
  const systemStatus = [
    { name: "Neon PostgreSQL", type: "Database", status: "Operational", latency: "12ms", icon: Database, color: "text-cyber-success" },
    { name: "Qdrant Vector DB", type: "Vector Recall", status: "Active", latency: "8ms", icon: Terminal, color: "text-cyber-primary" },
    { name: "Google Gemini 2.5", type: "Cognitive Processor", status: "Active", latency: "140ms", icon: Cpu, color: "text-purple-400" },
    { name: "Enkrypt AI Gateways", type: "Integrity Checks", status: "Protected", latency: "25ms", icon: Activity, color: "text-cyber-danger" },
  ];

  return (
    <div className="space-y-8 font-mono">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide">[ SECURE_DASHBOARD_OVERVIEW ]</h1>
          <p className="text-xs text-cyber-muted mt-1 uppercase">SentinelOps AI Multi-Agent Coordinator Node</p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1 bg-blue-950/40 border border-cyber-primary/30 rounded text-xs text-cyber-primary">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>PIPELINE ENGINE: ONLINE</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-6 rounded-lg relative overflow-hidden"
        >
          <div className="absolute right-3 top-3 p-1.5 bg-blue-900/20 border border-cyber-primary/20 rounded">
            <Activity className="w-5 h-5 text-cyber-primary" />
          </div>
          <span className="text-xs text-cyber-muted uppercase tracking-wider block">Mean Time To Detect</span>
          <span className="text-3xl font-extrabold text-white mt-3 block">1.8m</span>
          <span className="text-xs text-cyber-success mt-2 block">↓ 32% since deployment</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6 rounded-lg relative overflow-hidden"
        >
          <div className="absolute right-3 top-3 p-1.5 bg-emerald-900/20 border border-cyber-success/20 rounded">
            <Heart className="w-5 h-5 text-cyber-success" />
          </div>
          <span className="text-xs text-cyber-muted uppercase tracking-wider block">Mean Time To Respond</span>
          <span className="text-3xl font-extrabold text-white mt-3 block">14.5m</span>
          <span className="text-xs text-cyber-success mt-2 block">↓ 45% since deployment</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-6 rounded-lg relative overflow-hidden"
        >
          <div className="absolute right-3 top-3 p-1.5 bg-red-900/20 border border-cyber-danger/20 rounded">
            <ShieldAlert className="w-5 h-5 text-cyber-danger" />
          </div>
          <span className="text-xs text-cyber-muted uppercase tracking-wider block">Safety Validation Confidence</span>
          <span className="text-3xl font-extrabold text-white mt-3 block">99.8%</span>
          <span className="text-xs text-cyber-primary mt-2 block">0 dangerous commands executed</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6 rounded-lg relative overflow-hidden"
        >
          <div className="absolute right-3 top-3 p-1.5 bg-amber-900/20 border border-cyber-warning/20 rounded">
            <AlertCircle className="w-5 h-5 text-cyber-warning" />
          </div>
          <span className="text-xs text-cyber-muted uppercase tracking-wider block">Post-Mortem Reports Generated</span>
          <span className="text-3xl font-extrabold text-white mt-3 block">0</span>
          <span className="text-xs text-cyber-muted mt-2 block">No incidents detected yet</span>
        </motion.div>
      </div>

      {/* Systems Status Table */}
      <div className="glass-panel p-6 rounded-lg">
        <h2 className="text-lg font-bold text-white mb-6 font-mono">[ CONNECTED_SERVICES_INTEGRATIONS ]</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-cyber-border text-cyber-muted font-mono uppercase tracking-wider">
                <th className="pb-3 font-semibold">Service Name</th>
                <th className="pb-3 font-semibold">Type</th>
                <th className="pb-3 font-semibold">Latency</th>
                <th className="pb-3 font-semibold">Security State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-border font-mono">
              {systemStatus.map((service) => {
                const Icon = service.icon;
                return (
                  <tr key={service.name} className="hover:bg-cyber-card/15 transition-all duration-150">
                    <td className="py-4 flex items-center space-x-3 text-white font-medium">
                      <div className={`p-1.5 rounded bg-cyber-bg border border-cyber-border ${service.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{service.name}</span>
                    </td>
                    <td className="py-4 text-cyber-muted">{service.type}</td>
                    <td className="py-4 text-cyber-primary">{service.latency}</td>
                    <td className="py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono uppercase bg-emerald-950/30 border border-cyber-success/30 text-cyber-success">
                        [ {service.status} ]
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Simulation Info */}
      <div className="glass-panel p-6 rounded-lg border-l-2 border-cyber-primary">
        <h3 className="text-white font-bold mb-2 uppercase tracking-wide">Foundation Sandbox Notice</h3>
        <p className="text-xs text-cyber-muted leading-relaxed max-w-3xl">
          The foundation layer of SentinelOps AI is now operational. You can securely authenticate using credentials or Google OAuth, load database states from Prisma, query vector spaces from Qdrant, and validate safety triggers using Enkrypt AI. The orchestrator AI agent loop and incident timeline workflows will be deployed in the subsequent phase.
        </p>
      </div>
    </div>
  );
}
