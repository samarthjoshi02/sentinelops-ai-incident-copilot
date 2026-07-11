import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, FileText, Activity, User, ShieldAlert, Zap, Server } from "lucide-react";
import RemediationButton from "@/components/RemediationButton";

export const dynamic = "force-dynamic";

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(date);
}

export default async function IncidentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const incidentId = resolvedParams.id;

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      reporter: { select: { name: true, role: true } },
      timeline: { orderBy: { timestamp: "desc" } },
      logFiles: true,
      telemetryEvents: true,
      rootCause: true,
      remediationPlan: true,
      workflowExecutions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!incident) {
    notFound();
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "text-cyber-danger border-cyber-danger bg-red-950/30";
      case "HIGH": return "text-orange-400 border-orange-500/50 bg-orange-950/30";
      case "MEDIUM": return "text-cyber-warning border-cyber-warning/50 bg-amber-950/30";
      case "LOW": return "text-cyber-success border-cyber-success/50 bg-emerald-950/30";
      default: return "text-cyber-muted border-cyber-border";
    }
  };

  return (
    <div className="space-y-6 font-mono max-w-7xl mx-auto pb-12">
      {/* Header Navigation */}
      <div className="flex items-center space-x-4 mb-2">
        <Link 
          href="/dashboard/incidents"
          className="p-2 hover:bg-cyber-card/50 rounded-full transition-colors text-cyber-muted hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="text-xs text-cyber-muted uppercase tracking-wider">
          INCIDENT / {incident.id.substring(0, 8)}
        </span>
      </div>

      {/* Title & Actions Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end space-y-4 md:space-y-0">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-3xl font-bold text-white tracking-wide">{incident.title}</h1>
            <span className={`px-2 py-1 border rounded text-[10px] tracking-wider uppercase ${getSeverityColor(incident.severity)}`}>
              {incident.severity}
            </span>
          </div>
          <p className="text-sm text-cyber-muted max-w-3xl leading-relaxed">
            {incident.description || "No description provided."}
          </p>
        </div>
        
        {/* Remediation Action */}
        <RemediationButton incidentId={incident.id} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        
        {/* Left Column: Details & Logs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-lg">
              <span className="text-[10px] text-cyber-muted uppercase tracking-wider block mb-1">Status</span>
              <span className="text-white font-bold">{incident.status}</span>
            </div>
            <div className="glass-panel p-4 rounded-lg">
              <span className="text-[10px] text-cyber-muted uppercase tracking-wider block mb-1">Source</span>
              <span className="text-white font-bold flex items-center">
                <Server className="w-3.5 h-3.5 mr-1.5 text-cyber-primary" />
                {incident.source}
              </span>
            </div>
            <div className="glass-panel p-4 rounded-lg">
              <span className="text-[10px] text-cyber-muted uppercase tracking-wider block mb-1">Reporter</span>
              <span className="text-white font-bold flex items-center">
                <User className="w-3.5 h-3.5 mr-1.5 text-cyber-primary" />
                {incident.reporter?.name || "System"}
              </span>
            </div>
            <div className="glass-panel p-4 rounded-lg">
              <span className="text-[10px] text-cyber-muted uppercase tracking-wider block mb-1">Created At</span>
              <span className="text-white font-bold text-sm">{formatTime(incident.createdAt)}</span>
            </div>
          </div>

          {/* Connected Artifacts */}
          <div className="glass-panel p-6 rounded-lg border border-cyber-border">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-cyber-primary" />
              [ CONNECTED_ARTIFACTS ]
            </h3>
            
            {incident.logFiles.length === 0 ? (
              <p className="text-sm text-cyber-muted italic">No log files or telemetry attached to this incident.</p>
            ) : (
              <div className="space-y-3">
                {incident.logFiles.map((log) => (
                  <div key={log.id} className="flex justify-between items-center p-3 bg-cyber-bg/50 border border-cyber-border rounded hover:border-cyber-primary/30 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-950/30 rounded text-cyber-primary">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{log.fileName}</p>
                        <p className="text-[10px] text-cyber-muted mt-0.5">{(log.fileSize / 1024).toFixed(1)} KB • {log.fileType}</p>
                      </div>
                    </div>
                    <button className="text-xs text-cyber-primary hover:text-white transition-colors uppercase tracking-wider">
                      View Raw
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Workflows Executed */}
          <div className="glass-panel p-6 rounded-lg border border-cyber-border">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-purple-400" />
              [ WORKFLOW_EXECUTIONS ]
            </h3>
            
            {incident.workflowExecutions.length === 0 ? (
              <p className="text-sm text-cyber-muted italic">No AI remediation workflows have been executed yet.</p>
            ) : (
              <div className="space-y-3">
                {incident.workflowExecutions.map((exec) => (
                  <div key={exec.id} className="p-3 bg-cyber-bg/50 border border-cyber-border rounded">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-white font-bold">{exec.workflowName}</span>
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-purple-950/30 text-purple-400 border border-purple-500/30">
                        {exec.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-cyber-muted flex justify-between">
                      <span>ID: {exec.id.substring(0, 8)}</span>
                      <span>{formatTime(exec.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Timeline */}
        <div className="glass-panel p-6 rounded-lg border border-cyber-border h-fit">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-cyber-primary" />
            [ INCIDENT_TIMELINE ]
          </h3>

          <div className="relative border-l-2 border-cyber-border/50 ml-3 space-y-8">
            {incident.timeline.map((event, idx) => {
              const isLatest = idx === 0;
              let EventIcon = Activity;
              let iconColor = "text-cyber-muted";
              let bgColor = "bg-cyber-bg";
              
              if (event.type === "SYSTEM") {
                EventIcon = Server;
                iconColor = "text-cyber-primary";
                bgColor = "bg-blue-950";
              } else if (event.type === "AI_AGENT") {
                EventIcon = Zap;
                iconColor = "text-purple-400";
                bgColor = "bg-purple-950";
              } else if (event.type === "HUMAN") {
                EventIcon = User;
                iconColor = "text-cyber-success";
                bgColor = "bg-emerald-950";
              } else if (event.type === "METRIC_TRIGGER") {
                EventIcon = ShieldAlert;
                iconColor = "text-cyber-danger";
                bgColor = "bg-red-950";
              }

              return (
                <div key={event.id} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-2 border-cyber-bg flex items-center justify-center ${bgColor}`}>
                    <EventIcon className={`w-3.5 h-3.5 ${iconColor}`} />
                  </div>

                  <div className={`flex flex-col ${isLatest ? "opacity-100" : "opacity-70"}`}>
                    <span className="text-[10px] text-cyber-muted uppercase tracking-wider mb-1">
                      {formatTime(event.timestamp)}
                    </span>
                    <p className={`text-sm ${isLatest ? "text-white" : "text-gray-300"} leading-relaxed`}>
                      {event.eventDescription}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
