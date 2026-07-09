"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPassword } from "../../actions/auth";
import { Shield, Key, Mail, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await resetPassword(null, formData);
      if (res && res.error) {
        setError(res.error);
        setLoading(false);
      } else if (res && res.success) {
        setSuccess(true);
        setLoading(false);
        setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
      }
    } catch (err: any) {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-cyber-bg px-4 overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20" />

      <div className="w-full max-w-md relative z-10">
        {/* Title Brand */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-blue-900/40 rounded-lg border border-cyber-primary/40 glass-card-glow">
              <Shield className="w-6 h-6 text-cyber-primary" />
            </div>
            <span className="font-mono text-2xl font-bold tracking-wider text-white">
              SENTINEL<span className="text-cyber-primary">OPS</span>
            </span>
          </Link>
          <span className="text-sm font-mono text-cyber-muted">CREDENTIAL RESET STATION</span>
        </div>

        {/* Card Panel */}
        <div className="glass-panel p-8 rounded-lg shadow-2xl relative">
          <h2 className="text-2xl font-bold text-white mb-6 text-center font-mono">[ PASSWORD_RESET_FORM ]</h2>

          {success ? (
            <div className="mb-6 p-6 bg-emerald-950/30 border border-cyber-success/40 rounded text-center text-cyber-success font-mono flex flex-col items-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-cyber-success" />
              <div>
                <p className="font-bold text-sm">PASSWORD UPDATE SUCCESSFUL</p>
                <p className="text-xs text-cyber-muted mt-2 leading-relaxed">Redirecting to login portal...</p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-red-950/30 border border-cyber-danger/40 rounded flex items-start space-x-3 text-sm text-red-200">
                  <AlertTriangle className="w-5 h-5 text-cyber-danger flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-mono text-cyber-muted uppercase tracking-wider mb-2">Registered Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-4 py-3 text-sm rounded glass-input transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-cyber-muted uppercase tracking-wider mb-2">New Security Password</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-4 py-3 text-sm rounded glass-input transition-all duration-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded text-sm font-mono font-bold text-white glow-btn flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{loading ? "PROCESSING..." : "UPDATE CREDENTIALS"}</span>
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </>
          )}

          <p className="mt-8 text-center text-xs font-mono text-cyber-muted">
            Abort reset?{" "}
            <Link href="/auth/login" className="text-cyber-primary hover:underline">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
