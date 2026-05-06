import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { SubmissionResult, ResultsUpdateMessage, Message, ThemisStatus } from '../../protocol/protocol';
import useThemisClient from '../hooks/useThemisClient';
import useVSApi from '../hooks/useVSApi';
import { CheckCircle, XCircle, AlertCircle, Loader, CircleDot, GitCompare, RefreshCw, Radio, Clock, Ban, FileWarning, Terminal, ArrowDownToLine, FileSearch } from 'lucide-react';

const STATUS_LABELS: Record<ThemisStatus, string> = {
    passed: "Passed",
    failed: "Failed",
    error: "Error",
    pending: "Pending",
    queued: "Queued",
    none: "No status",
    compilerr: "Compile error",
    runtimerr: "Runtime error",
    timeout: "Timeout",
    outlimit: "Output limit",
    diff: "Wrong output",
    deadline: "Missed deadline",
};

function StatusBadge(props: { status: string }) {
    const s = props.status as ThemisStatus;
    let Icon = CircleDot;
    if (s === "passed") { Icon = CheckCircle; }
    else if (s === "diff" || s === "failed") { Icon = XCircle; }
    else if (s === "error" || s === "compilerr" || s === "runtimerr") { Icon = AlertCircle; }
    else if (s === "pending" || s === "queued" || s === "none") { Icon = Loader; }
    else if (s === "timeout") { Icon = Clock; }
    else if (s === "outlimit") { Icon = ArrowDownToLine; }
    else if (s === "deadline") { Icon = Clock; }
    const label = STATUS_LABELS[s] || s;
    return <span className={`status-badge status-badge--${s}`}>
        <Icon size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{label}
    </span>;
}

function ResultsView(props: { path: string }) {
    const client = useThemisClient();
    const vsApi = useVSApi();
    const [result, setResult] = useState<SubmissionResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [live, setLive] = useState(false);
    const watchedPath = useRef<string | null>(null);

    const fetchResults = async () => {
        try {
            const r = await client.getResults(props.path);
            setResult(r);
            setLoading(false);
        } catch {
            setLoading(false);
        }
    };

    // Subscribe to live updates via socket.io
    useEffect(() => {
        fetchResults();

        client.watchResults(props.path).then(() => {
            setLive(true);
            watchedPath.current = props.path;
        }).catch(() => {
            // Socket unavailable, fall back to polling
        });

        const handler = (message: Message) => {
            if (message.type === "results-update") {
                const update = message as ResultsUpdateMessage;
                if (update.path === props.path) {
                    setResult(update.result);
                    setLoading(false);
                }
            }
            return false; // keep listening
        };
        vsApi.onMessage(handler);

        return () => {
            client.unwatchResults();
            watchedPath.current = null;
            vsApi.offMessage(handler);
        };
    }, [props.path]); // eslint-disable-line react-hooks/exhaustive-deps

    // Polling fallback when not live, or result still pending
    useEffect(() => {
        const terminal: ThemisStatus[] = ["passed", "failed", "error", "compilerr", "runtimerr", "timeout", "outlimit", "diff", "deadline"];
        const needsPolling = !result || !terminal.includes(result.status as ThemisStatus);
        if (!needsPolling) { return; }
        const interval = setInterval(fetchResults, live ? 10000 : 3000);
        return () => clearInterval(interval);
    }, [result?.status, live]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return <div className="loading">Loading results...</div>;
    }

    if (!result) {
        return <div className="loading">Failed to load results.</div>;
    }

    const terminalStatuses: ThemisStatus[] = ["passed", "failed", "error", "compilerr", "runtimerr", "timeout", "outlimit", "diff", "deadline"];
    const isDone = terminalStatuses.includes(result.status as ThemisStatus);

    return <div>
        <div className="results-header">
            <span style={{ fontWeight: 600, fontSize: 13 }}>Results</span>
            <StatusBadge status={result.status} />
            {live && <span className="live-indicator" title="Live updates active"><Radio size={12} /></span>}
        </div>

        {result.percentage !== undefined && (
            <div className="results-summary" style={{ fontSize: 13, fontWeight: 600 }}>{result.percentage}%</div>
        )}

        {result.summary && (
            <div className="results-summary">{result.summary}</div>
        )}

        {result.testCases.length > 0 && result.testCases.map((tc, i) => {
            const failedStatuses: ThemisStatus[] = ["failed", "diff", "error", "compilerr", "runtimerr", "timeout", "outlimit"];
            const canDiff = !!(tc.expectedUrl && tc.actualUrl);
            const showDiffAction = canDiff && failedStatuses.includes(tc.status as ThemisStatus);
            const onDiff = () => showDiffAction && client.showResultDiff(tc.name, tc.expectedUrl!, tc.actualUrl!);
            return (
                <div
                    key={i}
                    className="result-row"
                    onClick={showDiffAction ? onDiff : undefined}
                    title={showDiffAction ? "Click to view diff (expected vs actual)" : undefined}
                    style={showDiffAction ? { cursor: "pointer" } : undefined}
                >
                    <div className="result-row-header">
                        <span>{tc.name}</span>
                        <StatusBadge status={tc.status} />
                    </div>
                    {tc.message && (
                        <div className="result-row-details" style={{ opacity: 0.85 }}>{tc.message}</div>
                    )}
                    {tc.grade && (
                        <div className="result-row-details" style={{ fontWeight: 600 }}>Grade: {tc.grade}</div>
                    )}
                    {tc.hint && (
                        <div className="result-row-details" style={{ color: "var(--vscode-editorInfo-foreground, #3794ff)" }}>Hint: {tc.hint}</div>
                    )}
                    {tc.details && (
                        <div className="result-row-details">{tc.details}</div>
                    )}
                    {(showDiffAction || tc.inputUrl || tc.expectedUrl || tc.actualUrl || tc.errorUrl) && (
                        <div className="result-row-details" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}
                            onClick={(e) => e.stopPropagation()}>
                            {showDiffAction && (
                                <button className="btn-link" onClick={onDiff} title="Open VS Code diff editor: Themis expected (left) ↔ Your output (right)">
                                    <GitCompare size={11} style={{ marginRight: 3 }} /> Diff
                                </button>
                            )}
                            {tc.inputUrl && (
                                <button className="btn-link" title="Open input in new editor tab"
                                    onClick={() => client.viewFile(tc.inputUrl!, `${tc.name}.in`)}>
                                    <FileSearch size={11} style={{ marginRight: 3 }} /> Input
                                </button>
                            )}
                            {tc.expectedUrl && (
                                <button className="btn-link" title="Open Themis-expected output in new editor tab"
                                    onClick={() => client.viewFile(tc.expectedUrl!, `${tc.name}.expected.txt`)}>
                                    <FileSearch size={11} style={{ marginRight: 3 }} /> Expected
                                </button>
                            )}
                            {tc.actualUrl && (
                                <button className="btn-link" title="Open your submission's actual output in new editor tab"
                                    onClick={() => client.viewFile(tc.actualUrl!, `${tc.name}.actual.txt`)}>
                                    <FileSearch size={11} style={{ marginRight: 3 }} /> Actual
                                </button>
                            )}
                            {tc.errorUrl && (
                                <button className="btn-link" title="Open stderr in new editor tab"
                                    onClick={() => client.viewFile(tc.errorUrl!, `${tc.name}.stderr.txt`)}>
                                    <FileSearch size={11} style={{ marginRight: 3 }} /> stderr
                                </button>
                            )}
                        </div>
                    )}
                </div>
            );
        })}

        {result.testCases.length === 0 && !isDone && (
            <div className="loading">Waiting for results...</div>
        )}

        {isDone && (
            <button className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }}
                onClick={fetchResults}>
                <RefreshCw size={12} style={{ marginRight: 4 }} /> Refresh
            </button>
        )}
    </div>;
}

export default ResultsView;
