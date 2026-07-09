"use client";

import { useState } from "react";
import Link from "next/link";
import { loginUser } from "../../actions/auth";
import { signIn } from "next-auth/react";
import { Shield, Key, Mail, AlertTriangle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await loginUser(null, formData);
      if (res && res.error) {
        setError(res.error);
        setLoading(false);
      }
    } catch (err: any) {
      // In next-auth, redirects throw an error which must propagate.
      // If it's not a redirect, handle it as an auth failure.
      if (err.message && err.message.includes("NEXT_REDIRECT")) {
        throw err;
      }
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" });
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
          <span className="text-sm font-mono text-cyber-muted">SECURE OPERATIONS PORTAL</span>
        </div>

        {/* Card Panel */}
        <div className="glass-panel p-8 rounded-lg shadow-2xl relative">
          <h2 className="text-2xl font-bold text-white mb-6 text-center font-mono">[ SIGN_IN ]</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-cyber-danger/40 rounded flex items-start space-x-3 text-sm text-red-200">
              <AlertTriangle className="w-5 h-5 text-cyber-danger flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-mono text-cyber-muted uppercase tracking-wider mb-2">Email Address</label>
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
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-mono text-cyber-muted uppercase tracking-wider">Password</label>
                <Link href="/auth/forgot-password" className="text-xs font-mono text-cyber-primary hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 text-sm rounded glass-input transition-all duration-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded text-sm font-mono font-bold text-white glow-btn flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{loading ? "AUTHENTICATING..." : "VERIFY CREDENTIALS"}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-cyber-border" />
            </div>
            <div className="relative flex justify-center text-xs font-mono">
              <span className="bg-[#0c1424] px-3 text-cyber-muted uppercase tracking-wider">OR SIGN IN WITH</span>
            </div>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-3 px-4 border border-cyber-border rounded hover:bg-cyber-card/40 transition-all duration-200 text-sm font-mono text-white flex items-center justify-center space-x-3"
          >
            {/* Simple Google SVG Icon */}
            <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>GOOGLE WORKSPACE</span>
          </button>

          <p className="mt-8 text-center text-xs font-mono text-cyber-muted">
            New operative?{" "}
            <Link href="/auth/register" className="text-cyber-primary hover:underline">
              Register Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
