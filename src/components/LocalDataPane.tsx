"use client";

import { useEffect, useState, useCallback } from "react";
import { Database, RefreshCw, ExternalLink, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const LOCAL_SUPABASE_STUDIO = "http://localhost:54323";
const LOCAL_SUPABASE_API    = "http://localhost:54321";

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

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch(`${LOCAL_SUPABASE_API}/rest/v1/`, { method: "HEAD" });
      setConnected(res.ok || res.status === 404); // 404 = running but no anon key, still up
    } catch {
      setConnected(false);
    }
  }, []);

  const fetchTableData = useCallback(async (tableName: string): Promise<TableData> => {
    try {
      const res = await fetch(`/api/local-data?table=${encodeURIComponent(tableName)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return { name: tableName, rows: [], count: 0, error: err.error ?? res.statusText };
      }
      const data = await res.json();
      return { name: tableName, rows: data.rows ?? [], count: data.count ?? 0 };
    } catch (e) {
      return { name: tableName, rows: [], count: 0, error: String(e) };
    }
  }, []);

  const loadAllTables = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(TABLES.map(fetchTableData));
    setTables(results);
    setLoading(false);
  }, [fetchTableData]);

  useEffect(() => {
    checkConnection();
    loadAllTables();
  }, [checkConnection, loadAllTables]);

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
          <strong>Local Supabase is not running.</strong> Start it with:
          <pre style={{ margin: "0.5rem 0 0", background: "rgba(0,0,0,0.3)", padding: "0.5rem", borderRadius: "0.25rem" }}>
            supabase start
          </pre>
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
