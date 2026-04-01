"use client";

import { useEffect, useState, useCallback } from "react";
import { Database, RefreshCw, ExternalLink, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const LOCAL_SUPABASE_STUDIO = "http://localhost:54323";

type TableRow = Record<string, unknown>;

interface TableData {
  name: string;
  rows: TableRow[];
  count: number;
  error?: string;
}

const TABLES = ["caenan_calls", "caenan_call_messages", "tts_history", "api_keys", "api_usage", "user_assistants", "user_agents"];

export default function LocalDataPane() {
  const [connected, setConnected]     = useState<boolean | null>(null);
  const [tables, setTables]           = useState<TableData[]>([]);
  const [activeTable, setActiveTable] = useState<string>(TABLES[0]);
  const [loading, setLoading]         = useState(false);

  const [retrying, setRetrying] = useState(false);

  // Ping local Supabase directly from the browser — Electron can reach 127.0.0.1,
  // Vercel cannot. This gives the correct "is it running on this machine" answer.
  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:54321/rest/v1/', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      setConnected(res.ok || res.status === 401); // 401 = DB up, just needs auth
      return res.ok || res.status === 401;
    } catch {
      setConnected(false);
      return false;
    }
  }, []);

  // Auto-retry every 5 s for up to 90 s after app launch (Supabase takes ~15-30 s to start)
  useEffect(() => {
    let attempts = 0;
    const MAX = 18; // 18 × 5 s = 90 s
    let timer: ReturnType<typeof setTimeout>;

    const tryConnect = async () => {
      const ok = await checkConnection();
      if (!ok && attempts < MAX) {
        attempts++;
        setRetrying(true);
        timer = setTimeout(tryConnect, 5000);
      } else {
        setRetrying(false);
        if (ok) loadAllTables();
      }
    };

    tryConnect();
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTableData = useCallback(async (tableName: string): Promise<TableData> => {
    try {
      const res = await fetch(`/api/local-data?table=${encodeURIComponent(tableName)}`);
      const data = await res.json().catch(() => ({}));
      if (data.offline) return { name: tableName, rows: [], count: 0 };
      if (!res.ok) return { name: tableName, rows: [], count: 0, error: data.error ?? res.statusText };
      return { name: tableName, rows: data.rows ?? [], count: data.count ?? 0 };
    } catch {
      return { name: tableName, rows: [], count: 0 };
    }
  }, []);

  const loadAllTables = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(TABLES.map(fetchTableData));
    setTables(results);
    setLoading(false);
  }, [fetchTableData]);

  const current = tables.find((t) => t.name === activeTable);
  const columns = current?.rows?.[0] ? Object.keys(current.rows[0]) : [];

  return (
    <div className="tab-pane active" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Database size={16} />
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Local Data</span>
          <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>· Supabase local instance</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {connected === null && <Loader2 size={14} className="animate-spin" />}
          {connected === true  && <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--ok, #4ade80)" }}><CheckCircle2 size={13} /> Connected</span>}
          {connected === false && <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--bad, #f87171)" }}><XCircle size={13} /> Offline</span>}
          <button
            type="button"
            className="btn icon-only w-8! h-8!"
            onClick={() => { checkConnection(); loadAllTables(); }}
            disabled={loading}
            title="Refresh"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
          <a
            href={LOCAL_SUPABASE_STUDIO}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
            title="Open Supabase Studio"
          >
            <ExternalLink size={13} /> Studio
          </a>
        </div>
      </div>

      {/* Connection info box when offline */}
      {connected === false && (
        <div className="p-3 rounded-lg border border-bad/30 bg-bad/5 text-xs" style={{ lineHeight: 1.6 }}>
          {retrying ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Loader2 size={13} className="animate-spin" />
              Starting local services… this may take up to 60 s on first launch.
            </span>
          ) : (
            <>
              <strong>Local Supabase is not running.</strong> It should start automatically with the app.
              Click refresh to retry, or run <code style={{ background: "rgba(0,0,0,0.3)", padding: "0 4px", borderRadius: 3 }}>supabase start</code> manually.
            </>
          )}
        </div>
      )}

      {/* Table tabs */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {TABLES.map((t) => {
          const td = tables.find((x) => x.name === t);
          return (
            <button
              key={t}
              type="button"
              className={`btn${activeTable === t ? "" : " secondary"}`}
              style={{ fontSize: "0.72rem", padding: "0.25rem 0.65rem" }}
              onClick={() => setActiveTable(t)}
            >
              {t}
              {td && !td.error && (
                <span style={{ marginLeft: "0.35rem", opacity: 0.6 }}>({td.count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table viewer */}
      <div style={{ overflow: "auto", borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.08)" }}>
        {current?.error ? (
          <div className="p-4 text-xs" style={{ color: "var(--bad, #f87171)" }}>
            {current.error}
          </div>
        ) : loading ? (
          <div className="p-4 text-xs opacity-50 flex items-center gap-2">
            <Loader2 size={13} className="animate-spin" /> Loading…
          </div>
        ) : columns.length === 0 ? (
          <div className="p-4 text-xs opacity-40">No rows in <code>{activeTable}</code>.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                {columns.map((col) => (
                  <th key={col} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, opacity: 0.7, whiteSpace: "nowrap" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(current?.rows ?? []).map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {columns.map((col) => (
                    <td key={col} style={{ padding: "0.45rem 0.75rem", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.85 }}
                      title={String(row[col] ?? "")}>
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
