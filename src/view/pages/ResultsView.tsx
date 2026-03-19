import * as React from 'react';
import { useEffect, useState } from 'react';
import { SubmissionResult, TestCaseResult } from '../../protocol/protocol';
import useThemisClient from '../hooks/useThemisClient';

function StatusBadge(props: { status: string }) {
    return <span className={`status-badge status-badge--${props.status}`}>{props.status}</span>;
}

function ResultsView(props: { path: string }) {
    const client = useThemisClient();
    const [result, setResult] = useState<SubmissionResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(true);

    const fetchResults = async () => {
        try {
            const r = await client.getResults(props.path);
            setResult(r);
            setLoading(false);
            if (r.status === "done" || r.status === "error") {
                setPolling(false);
            }
        } catch {
            setLoading(false);
            setPolling(false);
        }
    };

    useEffect(() => {
        fetchResults();
    }, [props.path]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!polling) { return; }
        const interval = setInterval(fetchResults, 3000);
        return () => clearInterval(interval);
    }, [polling]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return <div className="loading">Loading results...</div>;
    }

    if (!result) {
        return <div className="loading">Failed to load results.</div>;
    }

    return <div>
        <div className="results-header">
            <span style={{ fontWeight: 600, fontSize: 13 }}>Results</span>
            <StatusBadge status={result.status} />
        </div>

        {result.summary && (
            <div className="results-summary">{result.summary}</div>
        )}

        {result.testCases.length > 0 && result.testCases.map((tc, i) => (
            <div key={i} className="result-row">
                <div className="result-row-header">
                    <span>{tc.name}</span>
                    <StatusBadge status={tc.status} />
                </div>
                {tc.details && (
                    <div className="result-row-details">{tc.details}</div>
                )}
            </div>
        ))}

        {result.testCases.length === 0 && result.status !== "error" && (
            <div className="loading">
                {polling ? "Waiting for results..." : "No test case details available."}
            </div>
        )}

        {!polling && (
            <button className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }}
                onClick={() => { setPolling(true); fetchResults(); }}>
                Refresh
            </button>
        )}
    </div>;
}

export default ResultsView;
