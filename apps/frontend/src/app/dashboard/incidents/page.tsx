import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AlertCircle, FileText, Activity, Server, Clock, ArrowRight } from "lucide-react";
import IncidentActions from "@/components/IncidentActions";

export const dynamic = "force-dynamic";

function formatTimeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
}

export default async function IncidentCenterPage() {
  const incidents = await prisma.incident.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { name: true } },
      logFiles: { select: { id: true } },
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "text-cyber-danger border-cyber-danger bg-red-950/30";
      case "HIGH": return "text-orange-400 border-orange-500/50 bg-orange-950/30";
      case "MEDIUM": return "text-cyber-warning border-cyber-warning/50 bg-amber-950/30";
      case "LOW": return "text-cyber-success border-cyber-success/50 bg-emerald-950/30";
      default: return "text-cyber-muted border-cyber-border";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "TRIGGERED": return "text-cyber-danger";
      case "INVESTIGATING": return "text-cyber-warning";
      case "MITIGATING": return "text-purple-400";
      case "RESOLVED": return "text-cyber-success";
      case "CLOSED": return "text-cyber-muted";
      default: return "text-cyber-muted";
    }
  };

  return (
    <div className="space-y-6 font-mono max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center">
            <Activity className="w-6 h-6 mr-3 text-cyber-primary" />
            [ INCIDENT_CENTER ]
          </h1>
          <p className="text-xs text-cyber-muted mt-1 uppercase tracking-wider">Monitor and investigate system anomalies</p>
        </div>
        <IncidentActions />
      </div>

      {/* Stats/Filters row (Optional for now) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass-panel p-4 rounded-lg flex items-center justify-between border-l-2 border-cyber-danger">
          <div>
            <span className="text-xs text-cyber-muted uppercase tracking-wider">Active Threats</span>
            <span className="block text-2xl font-bold text-white mt-1">
              {incidents.filter(i => i.status !== "RESOLVED" && i.status !== "CLOSED").length}
            </span>
          </div>
          <AlertCircle className="w-8 h-8 text-cyber-danger/50" />
        </div>
        <div className="glass-panel p-4 rounded-lg flex items-center justify-between border-l-2 border-cyber-warning">
          <div>
            <span className="text-xs text-cyber-muted uppercase tracking-wider">Total Incidents</span>
            <span className="block text-2xl font-bold text-white mt-1">{incidents.length}</span>
          </div>
          <Server className="w-8 h-8 text-cyber-warning/50" />
        </div>
        <div className="glass-panel p-4 rounded-lg flex items-center justify-between border-l-2 border-cyber-primary">
          <div>
            <span className="text-xs text-cyber-muted uppercase tracking-wider">Log Files Analyzed</span>
            <span className="block text-2xl font-bold text-white mt-1">
              {incidents.reduce((acc, curr) => acc + curr.logFiles.length, 0)}
            </span>
          </div>
          <FileText className="w-8 h-8 text-cyber-primary/50" />
        </div>
      </div>

      {/* Incidents Table */}
      <div className="glass-panel rounded-lg overflow-hidden border border-cyber-border">
        {incidents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Server className="w-12 h-12 text-cyber-muted/30 mb-4" />
            <p className="text-cyber-muted mb-2 uppercase tracking-wide">No active incidents detected.</p>
            <p className="text-xs text-cyber-muted/60">System is operating within normal parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-cyber-card/30 border-b border-cyber-border text-xs text-cyber-muted uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Incident ID</th>
                  <th className="px-6 py-4 font-semibold">Title</th>
                  <th className="px-6 py-4 font-semibold">Severity</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Time</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/50">
                {incidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-cyber-card/20 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-cyber-primary font-mono text-xs">{incident.id.substring(0, 8)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium truncate max-w-md">{incident.title}</span>
                        <span className="text-xs text-cyber-muted truncate max-w-md mt-0.5">{incident.source}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 border rounded text-[10px] tracking-wider uppercase ${getSeverityColor(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(incident.status).replace("text-", "bg-")}`} />
                        <span className={`text-xs uppercase tracking-wide ${getStatusColor(incident.status)}`}>
                          {incident.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1.5 text-cyber-muted text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTimeAgo(incident.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/dashboard/incidents/${incident.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-900/20 hover:bg-blue-900/40 border border-cyber-primary/30 rounded text-cyber-primary text-xs transition-colors"
                      >
                        <span>Analyze</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
