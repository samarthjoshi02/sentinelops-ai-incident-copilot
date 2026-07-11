export const dynamic = "force-static";
import { Book, Construction } from "lucide-react";

export default function KnowledgeBasePage() {
  return (
    <div className="space-y-6 font-mono max-w-7xl mx-auto h-[80vh] flex flex-col items-center justify-center">
      <div className="glass-panel p-12 rounded-lg border border-cyber-border text-center max-w-2xl w-full flex flex-col items-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
          <div className="relative p-6 bg-blue-950/40 border border-cyber-primary/30 rounded-full">
            <Book className="w-16 h-16 text-cyber-primary" />
          </div>
          <div className="absolute -bottom-2 -right-2 p-2 bg-amber-950/80 border border-cyber-warning rounded-full">
            <Construction className="w-6 h-6 text-cyber-warning" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-4 tracking-wide">[ KNOWLEDGE_BASE ]</h1>
        <div className="h-px w-24 bg-cyber-primary/50 mx-auto mb-6"></div>
        
        <p className="text-cyber-muted text-sm leading-relaxed mb-8">
          The central repository for AI-generated runbooks, past resolutions, and system topology definitions is currently under construction. Future updates will allow the Remediation Agent to autonomously index and retrieve organizational knowledge here.
        </p>

        <div className="inline-flex items-center px-4 py-2 bg-blue-900/20 border border-cyber-primary/20 rounded text-cyber-primary text-xs uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-cyber-primary animate-pulse mr-2"></span>
          Deployment Scheduled
        </div>
      </div>
    </div>
  );
}
