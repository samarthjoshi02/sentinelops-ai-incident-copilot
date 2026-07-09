"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Activity, Cpu, Sparkles, Terminal, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-cyber-bg">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
      
      {/* Scanner Effect */}
      <div className="absolute inset-x-0 h-40 cyber-scanline pointer-events-none opacity-20" />

      {/* Header */}
      <header className="relative w-full border-b border-cyber-border glass-panel px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-900/40 rounded-lg border border-cyber-primary/40 glass-card-glow">
            <Shield className="w-6 h-6 text-cyber-primary" />
          </div>
          <span className="font-mono text-xl font-bold tracking-wider text-white">
            SENTINEL<span className="text-cyber-primary">OPS</span>
          </span>
        </div>
        
        <div className="flex space-x-4">
          <Link href="/auth/login" className="px-4 py-2 text-sm font-mono text-cyber-muted hover:text-white transition-colors duration-200">
            [ LOGIN ]
          </Link>
          <Link href="/auth/register" className="px-4 py-2 text-sm font-mono text-cyber-primary border border-cyber-primary/30 rounded-md hover:bg-cyber-primary/10 transition-all duration-200">
            [ REGISTER ]
          </Link>
        </div>
      </header>

      {/* Main Hero */}
      <main className="relative flex-grow flex flex-col justify-center items-center px-6 py-20 text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          {/* Tag */}
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-950/50 border border-cyber-primary/30 text-cyber-primary text-xs font-mono mb-8">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>AI-AGENT ORCHESTRATION PIPELINE ACTIVE</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6">
            Autonomous Incident Response <br />
            <span className="bg-gradient-to-r from-cyber-primary via-blue-400 to-indigo-500 bg-clip-text text-transparent">
              & Post-Mortem Copilot
            </span>
          </h1>

          <p className="text-lg md:text-xl text-cyber-muted max-w-2xl mx-auto mb-10 leading-relaxed">
             SentinelOps AI orchestrates autonomous agents to ingest logs, run root-cause analysis, recommend remediation actions, and output secure, structured post-mortems in seconds.
          </p>

          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center items-center">
            <Link href="/auth/register" className="px-8 py-4 font-mono font-bold text-white rounded-md glow-btn flex items-center space-x-2">
              <span>DEPLOYS ENCRYPTED PIPELINE</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/auth/login" className="px-8 py-4 font-mono font-bold text-cyber-primary border border-cyber-primary/30 rounded-md hover:bg-cyber-primary/10 transition-colors duration-200">
              [ ACCESS TERMINAL ]
            </Link>
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-24">
          <div className="glass-panel p-6 rounded-lg text-left glass-panel-hover transition-all duration-300">
            <Activity className="w-8 h-8 text-cyber-primary mb-4" />
            <h3 className="text-white font-mono text-lg mb-2">MTTD Reduction</h3>
            <p className="text-sm text-cyber-muted leading-relaxed">
              Anomaly detection agent scans structured logs, isolating abnormal events and patterns in real-time.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-lg text-left glass-panel-hover transition-all duration-300">
            <Cpu className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-white font-mono text-lg mb-2">Enkrypt AI Safety</h3>
            <p className="text-sm text-cyber-muted leading-relaxed">
              Integrity layer scans generated CLI steps and commands to prevent hallucination, exfiltration, or unauthorized runs.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-lg text-left glass-panel-hover transition-all duration-300">
            <Terminal className="w-8 h-8 text-indigo-400 mb-4" />
            <h3 className="text-white font-mono text-lg mb-2">Qdrant Memory</h3>
            <p className="text-sm text-cyber-muted leading-relaxed">
              Retrieval of historical incidents, prior root-causes, and runbooks to speed up mitigation and resolve loops.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-cyber-border py-6 px-6 flex flex-col md:flex-row justify-between items-center text-xs text-cyber-muted font-mono bg-cyber-bg/50 z-10">
        <div>&copy; {new Date().getFullYear()} SentinelOps AI. All Rights Reserved.</div>
        <div className="flex space-x-6 mt-4 md:mt-0">
          <span className="text-cyber-success">[ DB ONLINE ]</span>
          <span className="text-cyber-primary">[ GEMINI OK ]</span>
          <span className="text-cyber-primary">[ ENKRYPT AI OK ]</span>
        </div>
      </footer>
    </div>
  );
}
