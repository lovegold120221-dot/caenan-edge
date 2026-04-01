"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, ArrowRight, Monitor, Chrome, Globe, CheckCircle2, Mic, Phone, Database, Zap } from "lucide-react";

export default function LandingPage() {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [browser, setBrowser] = useState<"chrome" | "safari" | "edge" | "other">("other");
  const [installStep, setInstallStep] = useState<null | "guide">(null);
  const guideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) setBrowser("edge");
    else if (/Chrome\//.test(ua)) setBrowser("chrome");
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) setBrowser("safari");
  }, []);

  const scrollToGuide = () => {
    setInstallStep("guide");
    setTimeout(() => guideRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const features = [
    { icon: <Mic size={20} />, title: "Voice Studio", desc: "Clone voices, text-to-speech, and real-time speech recognition." },
    { icon: <Phone size={20} />, title: "Call Automation", desc: "AI phone agents that handle inbound and outbound calls 24/7." },
    { icon: <Database size={20} />, title: "Local First", desc: "Your data stays on your machine. Powered by a local Supabase instance." },
    { icon: <Zap size={20} />, title: "Instant Deploy", desc: "Connect to Vapi, ElevenLabs, and custom models in minutes." },
  ];

  const chromeSteps = [
    { n: 1, text: 'Open this page in Chrome or Edge.' },
    { n: 2, text: 'Click the install icon (⊕) in the address bar, or open the browser menu (⋮).' },
    { n: 3, text: 'Select "Install Caenan Edge…" and click Install.' },
    { n: 4, text: 'The app opens as a standalone window — no browser chrome.' },
  ];

  const safariSteps = [
    { n: 1, text: 'Open this page in Safari on macOS Sonoma / Ventura or iOS.' },
    { n: 2, text: 'Click the Share button (□↑) in the toolbar.' },
    { n: 3, text: 'Choose "Add to Dock" (macOS) or "Add to Home Screen" (iOS).' },
    { n: 4, text: 'Click Add — the app appears in your Dock or Home Screen.' },
  ];

  const steps = browser === "safari" ? safariSteps : chromeSteps;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "var(--font-inter, Inter, sans-serif)" }}>

      {/* ── NAV ── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", borderBottom: "1px solid #1a1a1a", position: "sticky", top: 0, background: "rgba(10,10,10,.85)", backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/images/logo.png" alt="Caenan" width={32} height={32} style={{ borderRadius: 8 }} />
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>Caenan Edge</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {canInstall && (
            <button onClick={install} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#a3e635", color: "#0a0a0a", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              <Download size={15} /> Install App
            </button>
          )}
          <a href="/app" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#1a1a1a", color: "#f5f5f5", border: "1px solid #2a2a2a", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            Launch App <ArrowRight size={14} />
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "100px 40px 60px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 20, fontSize: 12, color: "#a3e635", marginBottom: 32, fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a3e635", display: "inline-block" }} />
          Local AI · No cloud lock-in
        </div>

        <h1 style={{ fontSize: "clamp(42px,6vw,72px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.04em", margin: "0 0 24px" }}>
          Voice &amp; Call AI<br />
          <span style={{ color: "#a3e635" }}>on your machine.</span>
        </h1>

        <p style={{ fontSize: 18, color: "#888", maxWidth: 560, margin: "0 auto 48px", lineHeight: 1.7 }}>
          Caenan Edge runs your AI voice agents, call automation, and local data — entirely on your Mac. Install it once, own it forever.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {canInstall ? (
            <button onClick={install} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", background: "#a3e635", color: "#0a0a0a", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
              <Download size={18} /> Install Caenan Edge
            </button>
          ) : (
            <button onClick={scrollToGuide} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", background: "#a3e635", color: "#0a0a0a", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
              <Monitor size={18} /> How to Install
            </button>
          )}
          <a href="/app" style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", background: "#1a1a1a", color: "#f5f5f5", border: "1px solid #2a2a2a", borderRadius: 10, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
            Open in Browser <ArrowRight size={16} />
          </a>
        </div>

        {isInstalled && (
          <p style={{ marginTop: 20, color: "#a3e635", fontSize: 14, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            <CheckCircle2 size={16} /> Caenan Edge is installed on this device
          </p>
        )}
      </section>

      {/* ── FEATURES ── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "40px 40px 80px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20 }}>
        {features.map((f) => (
          <div key={f.title} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "24px 20px" }}>
            <div style={{ color: "#a3e635", marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
            <div style={{ color: "#666", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </section>

      {/* ── INSTALL GUIDE ── */}
      <section ref={guideRef} style={{ maxWidth: 720, margin: "0 auto", padding: "0 40px 100px" }}>
        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 16, overflow: "hidden" }}>
          {/* tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1e1e1e" }}>
            {([["chrome", <Chrome size={15} key="c" />, "Chrome / Edge"], ["safari", <Globe size={15} key="s" />, "Safari"]] as const).map(([id, icon, label]) => (
              <button key={id} onClick={() => setBrowser(id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "14px 20px", background: browser === id ? "#1a1a1a" : "transparent", color: browser === id ? "#f5f5f5" : "#555", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", borderBottom: browser === id ? "2px solid #a3e635" : "2px solid transparent" }}>
                {icon}{label}
              </button>
            ))}
          </div>

          <div style={{ padding: "32px 32px 28px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Install Caenan Edge</h2>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 28 }}>
              {browser === "safari" ? "Works on macOS Sonoma+ and iOS 16.4+" : "Works on Windows, macOS, and Linux with Chrome or Edge."}
            </p>

            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              {steps.map((s) => (
                <li key={s.n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <span style={{ minWidth: 28, height: 28, borderRadius: "50%", background: "#a3e635", color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{s.n}</span>
                  <span style={{ color: "#ccc", fontSize: 15, lineHeight: 1.6, paddingTop: 3 }}>{s.text}</span>
                </li>
              ))}
            </ol>

            <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {canInstall && (
                <button onClick={install} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", background: "#a3e635", color: "#0a0a0a", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  <Download size={15} /> Install Now
                </button>
              )}
              <a href="/app" style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", background: "#1a1a1a", color: "#ccc", border: "1px solid #2a2a2a", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                Skip — Open in Browser
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid #1a1a1a", padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#444", fontSize: 13 }}>
        <span>© 2026 Caenan</span>
        <a href="/app" style={{ color: "#666", textDecoration: "none" }}>Launch App →</a>
      </footer>
    </div>
  );
}
