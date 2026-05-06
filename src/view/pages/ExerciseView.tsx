import * as React from 'react';
import { useEffect, useState } from 'react';
import { Assignment, CourseNode, FileInfo, SubmissionSummary } from '../../protocol/protocol';
import useThemisClient from '../hooks/useThemisClient';
import {
    Clock, Calendar, Terminal, Award, AlertTriangle, Timer,
    FilePlus, FileText, X, Upload, Download, History, Eye, Send
} from 'lucide-react';

// Config groups to show; everything else is hidden
const SHOWN_GROUPS = new Set(["general", "dates", "execution"]);

function isISODate(val: string) {
    return /^\d{4}-\d{2}-\d{2}T/.test(val);
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) { return iso; }
    return d.toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function relativeTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    if (diff < 0) { return `${days > 0 ? `${days}d ` : ''}${hours}h ago`; }
    if (days === 0) { return hours === 0 ? 'soon' : `in ${hours}h`; }
    return `in ${days}d ${hours}h`;
}

function ConfigIcon(props: { groupName: string }) {
    const g = props.groupName.toLowerCase();
    if (g === 'dates') { return <Calendar size={12} className="icon-muted" />; }
    if (g === 'execution') { return <Terminal size={12} className="icon-muted" />; }
    return null;
}

function ConfigValue(props: { value: string; groupName: string }) {
    const { value, groupName } = props;
    if (!value) { return <span className="config-value-empty">—</span>; }
    if (groupName.toLowerCase() === 'execution') {
        return <code className="config-code">{value}</code>;
    }
    // Accept ISO dates and common JS Date.toString() formats
    const tryDate = isISODate(value) ? value : (value.length > 15 && !isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : null);
    if (tryDate) {
        const rel = relativeTime(tryDate);
        return (
            <span className="config-date" title={new Date(tryDate).toLocaleString()}>
                {formatDate(tryDate)}
                {rel && <span className="config-date-rel">{rel}</span>}
            </span>
        );
    }
    return <span>{value}</span>;
}

function compactValue(value: string, limit = 80): string {
    const singleLine = value.replace(/\s+/g, ' ').trim();
    if (singleLine.length <= limit) { return singleLine; }
    return `${singleLine.slice(0, limit - 1)}…`;
}

function DeadlineLabel(props: { deadline: string }) {
    const deadline = new Date(props.deadline);
    if (isNaN(deadline.getTime())) {
        return <div className="deadline-label">{props.deadline}</div>;
    }
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    let cls = "deadline-label";
    let text: string;
    let Icon = Clock;
    if (diff <= 0) {
        cls += " deadline-past";
        text = "Past deadline";
    } else if (days < 1) {
        cls += " deadline-urgent";
        text = `${hours}h left`;
        Icon = AlertTriangle;
    } else if (days < 3) {
        cls += " deadline-soon";
        text = `${days}d ${hours}h left`;
        Icon = Timer;
    } else if (days < 7) {
        cls += " deadline-upcoming";
        text = `${days}d left`;
    } else {
        text = `${days}d left`;
    }

    return <div className={cls} title={deadline.toLocaleString()}>
        <Icon size={12} style={{ marginRight: 4, verticalAlign: -1 }} />{text}
    </div>;
}

function ExerciseView(props: {
    node: CourseNode;
    extraFiles?: FileInfo[];
    onResults: (path: string) => void;
    onBack: () => void;
}) {
    const { node, extraFiles, onResults } = props;
    const client = useThemisClient();
    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<FileInfo[]>(extraFiles || []);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const [history, setHistory] = useState<SubmissionSummary[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        client.getAssignment(node.path).then(a => {
            setAssignment(a);
            setLoading(false);
        });
        setHistoryLoading(true);
        client.getHistory(node.path).then(h => {
            setHistory(h);
            setHistoryLoading(false);
        }).catch(() => setHistoryLoading(false));
    }, [node.path]); // eslint-disable-line react-hooks/exhaustive-deps

    // Merge in extra files when they change (from context menu)
    useEffect(() => {
        if (extraFiles && extraFiles.length > 0) {
            setFiles(prev => {
                const existingPaths = new Set(prev.map(f => f.path));
                const newFiles = extraFiles.filter(f => !existingPaths.has(f.path));
                return [...prev, ...newFiles];
            });
        }
    }, [extraFiles]);

    const handlePickFiles = async () => {
        const picked = await client.pickFiles();
        if (picked.length > 0) {
            setFiles(prev => [...prev, ...picked]);
        }
    };

    const handleAddActiveFile = async () => {
        const f = await client.getActiveFile();
        if (f) {
            setFiles(prev => prev.some(x => x.path === f.path) ? prev : [...prev, f]);
        }
    };

    const handleRemoveFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (files.length === 0) {
            setError("Please select at least one file to submit");
            return;
        }
        setSubmitting(true);
        setError(undefined);

        try {
            const result = await client.submit(node.path, files);

            if (result.success && result.resultsPath) {
                onResults(result.resultsPath);
            } else if (result.success) {
                onResults(`/stats${node.path}/@latest`);
            } else {
                setError(result.error || "Submission failed");
            }
        } catch (e: any) {
            setError(e?.message || "Submission failed");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="loading">Loading assignment...</div>;
    }

    return <div className="exercise-view">
        <div className="exercise-header">
            <div className="exercise-title">{node.title}</div>
            {assignment?.grade && (
                <div className="grade-badge"><Award size={12} style={{ marginRight: 4 }} />{assignment.grade}</div>
            )}
        </div>

        {/* Deadline display */}
        {assignment?.deadline && (
            <DeadlineLabel deadline={assignment.deadline} />
        )}

        {/* Assignment config */}
        {assignment && assignment.options.length > 0 && (() => {
            const visible = assignment.options.filter(g => SHOWN_GROUPS.has(g.name.toLowerCase()));
            if (visible.length === 0) { return null; }
            return (
                <div className="config-section">
                    {visible.map((group, gi) => (
                        <div key={gi} className="config-group">
                            <div className="config-group-name">
                                <ConfigIcon groupName={group.name} />
                                <span>{group.name}</span>
                            </div>
                            <div className="config-options-list">
                                {group.options
                                    .filter(opt => !(group.name.toLowerCase() === 'execution' && opt.name.toLowerCase() === 'check'))
                                    .map((opt, oi) => {
                                    if (group.name.toLowerCase() === 'execution') {
                                        return (
                                            <div key={oi} className="config-exec-item">
                                                <span className="config-option-name" title={opt.description || opt.name}>{opt.name}</span>
                                                <div className="config-exec-row">
                                                    <code className="config-code" title={opt.value || '—'}>{opt.value || '—'}</code>
                                                    <button
                                                        className="btn-icon-action"
                                                        title="Paste to active terminal"
                                                        onClick={() => client.pasteToTerminal(opt.value)}
                                                    >
                                                        <Terminal size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }
                                    if (opt.files && opt.files.length > 0) {
                                        return (
                                            <div key={oi} className="config-option" style={{ alignItems: "flex-start" }}>
                                                <span className="config-option-name" title={opt.description || opt.name}>{opt.name}</span>
                                                <span className="config-option-value-wrap">
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                                                        {opt.files.map((f, fi) => (
                                                            <button
                                                                key={fi}
                                                                className="btn-link"
                                                                title={`Download ${f.name}`}
                                                                onClick={() => client.downloadFile(f.url, f.name)}
                                                                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                                                            >
                                                                <Download size={11} /> {f.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={oi} className="config-option">
                                            <span className="config-option-name" title={opt.description || opt.name}>{opt.name}</span>
                                            <span className="config-option-value-wrap" title={opt.value}>
                                                <ConfigValue value={compactValue(opt.value)} groupName={group.name} />
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            );
        })()}

        {/* Test cases + download inputs */}
        {assignment && assignment.testCases.length > 0 && (
            <div className="section">
                <div className="section-title-row">
                    <div className="section-title"><Eye size={11} /> Test Cases</div>
                    <button className="btn-link" onClick={() => client.downloadInputs(node.path)}>
                        <Download size={11} /> Download inputs
                    </button>
                </div>
                <div className="tc-cards-grid">
                    {assignment.testCases.map((tc, i) => (
                        <button
                            key={i}
                            className="tc-card"
                            onClick={() => client.showTestCaseIO(tc.name, tc.input || '', tc.output || '')}
                            title={`Click to view ${tc.name} input/output`}
                        >
                            <span className="tc-card-name">{tc.name}</span>
                            {tc.hint && <span className="tc-card-hint">{tc.hint}</span>}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* File picker */}
        <div className="section">
            <div className="section-title"><Upload size={11} /> Files to submit</div>
            {files.length === 0 && <div className="file-list-empty">No files selected</div>}
            {files.map((f, i) => (
                <div key={i} className="file-list-item">
                    <FileText size={13} className="icon-muted" style={{ marginRight: 6, flexShrink: 0 }} />
                    <span className="file-list-item-name">{f.name}</span>
                    <button className="btn-icon-action" onClick={() => handleRemoveFile(i)}>
                        <X size={12} />
                    </button>
                </div>
            ))}
        </div>

        {/* Error */}
        {error && <div className="alert alert-error">{error}</div>}

        {/* Submission History */}
        {(history.length > 0 || historyLoading) && (
            <div className="section">
                <div className="section-title"><History size={11} /> History</div>
                {historyLoading && <div className="loading">Loading...</div>}
                {history.map((sub, i) => (
                    <div key={i} className="history-item" onClick={() => onResults(sub.path)}>
                        <span className="history-date">{sub.date}</span>
                        <span className={`status-badge status-badge--${sub.status}`}>{sub.status}</span>
                        {sub.score && <span className="history-score">{sub.score}</span>}
                    </div>
                ))}
            </div>
        )}

        {/* Actions */}
        <div className="submit-actions">
            <button className="btn btn-secondary" onClick={handlePickFiles}>
                <FilePlus size={13} style={{ marginRight: 4 }} /> Browse
            </button>
            <button className="btn btn-secondary" onClick={handleAddActiveFile}>
                <FileText size={13} style={{ marginRight: 4 }} /> Active
            </button>
            <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || files.length === 0}
            >
                <Send size={13} style={{ marginRight: 4 }} />
                {submitting ? "Submitting..." : "Submit"}
            </button>
        </div>
    </div>;
}

export default ExerciseView;