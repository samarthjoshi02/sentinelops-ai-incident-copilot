export const dynamic = "force-static";
import { Settings, Shield, Lock, Bell, Server } from "lucide-react";

export default function SettingsPage() {
  const sections = [
    { icon: Shield, title: "Security Protocols", desc: "Manage authentication, RBAC, and access tokens." },
    { icon: Server, title: "Infrastructure", desc: "Configure database connections and Enkrypt AI Gateways." },
    { icon: Bell, title: "Alerting", desc: "Set up PagerDuty, Slack, and email notifications." },
    { icon: Lock, title: "Audit Logs", desc: "View immutable logs of all agent and user actions." },
  ];

  return (
    <div className="space-y-6 font-mono max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-wide flex items-center">
          <Settings className="w-6 h-6 mr-3 text-cyber-muted" />
          [ SYSTEM_SETTINGS ]
        </h1>
        <p className="text-xs text-cyber-muted mt-1 uppercase tracking-wider">Configure platform integrations and security</p>
      </div>

      <div className="glass-panel p-8 rounded-lg border border-cyber-border bg-cyber-bg/50">
        <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-cyber-border">
          <div className="p-3 bg-amber-950/50 border border-cyber-warning/30 rounded-lg">
            <Lock className="w-6 h-6 text-cyber-warning" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Restricted Access</h2>
            <p className="text-sm text-cyber-muted">Settings configuration is limited to users with the <span className="text-cyber-warning font-bold">ADMIN</span> role.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 pointer-events-none">
          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <div key={idx} className="p-5 border border-cyber-border rounded bg-cyber-card/20 flex items-start space-x-4">
                <div className="p-2 bg-cyber-bg border border-cyber-border rounded text-cyber-muted">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">{section.title}</h3>
                  <p className="text-xs text-cyber-muted leading-relaxed">{section.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-cyber-border text-center">
          <p className="text-xs text-cyber-muted uppercase tracking-wider">
            Configuration module will be enabled in v1.1 deployment.
          </p>
        </div>
      </div>
    </div>
  );
}
