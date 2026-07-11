import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { FileText, ShieldAlert, BookOpen, Clock, Activity, ArrowRight, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

export default async function PostMortemsPage() {
  const postMortems = await prisma.postMortem.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      incident: {
        select: {
          id: true,
          title: true,
          severity: true,
        }
      }
    }
  });

  return (
    <div className="space-y-6 font-mono max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center">
            <BookOpen className="w-6 h-6 mr-3 text-purple-400" />
            [ POST_MORTEM_REPORTS ]
          </h1>
          <p className="text-xs text-cyber-muted mt-1 uppercase tracking-wider">AI-generated incident analyses and learnings</p>
        </div>
      </div>

      {postMortems.length === 0 ? (
        <div className="glass-panel p-12 rounded-lg border border-cyber-border text-center flex flex-col items-center">
          <div className="p-4 bg-purple-950/20 rounded-full mb-4">
            <BookOpen className="w-12 h-12 text-purple-400/40" />
          </div>
          <p className="text-white mb-2 uppercase tracking-wide">No Post-Mortems Generated Yet.</p>
          <p className="text-xs text-cyber-muted max-w-md mx-auto">
            Run the AI Remediation Agent on a triggered incident to automatically generate a post-mortem report here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {postMortems.map((report) => (
            <div key={report.id} className="glass-panel rounded-lg border border-cyber-border overflow-hidden flex flex-col hover:border-purple-500/30 transition-all duration-300">
              
              {/* Card Header */}
              <div className="p-5 border-b border-cyber-border bg-cyber-bg/30">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2 text-xs text-cyber-muted uppercase tracking-wider">
                    <ShieldAlert className="w-3.5 h-3.5 text-cyber-primary" />
                    <span>INCIDENT / {report.incident.id.substring(0, 8)}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950/30 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                    COMPLETED
                  </span>
                </div>
                <h3 className="text-white font-bold leading-tight line-clamp-2">{report.incident.title}</h3>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-grow space-y-4">
                <div>
                  <h4 className="text-[10px] text-cyber-muted uppercase tracking-wider mb-1 flex items-center">
                    <Activity className="w-3 h-3 mr-1" /> Executive Summary
                  </h4>
                  <p className="text-sm text-gray-300 line-clamp-3 leading-relaxed">
                    {report.summary}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-[10px] text-cyber-muted uppercase tracking-wider mb-1 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" /> Key Preventative Action
                  </h4>
                  <p className="text-sm text-cyber-primary line-clamp-2">
                    {report.preventativeActions[0] || "No actions specified."}
                  </p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-5 border-t border-cyber-border bg-cyber-bg/50 flex justify-between items-center">
                <div className="flex items-center space-x-1.5 text-xs text-cyber-muted">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTimeAgo(report.createdAt)}</span>
                </div>
                <Link
                  href={`/dashboard/incidents/${report.incident.id}`}
                  className="flex items-center space-x-1 text-xs text-purple-400 hover:text-white transition-colors uppercase tracking-wider font-bold"
                >
                  <span>Read Full Report</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
