import * as React from 'react';
import { useEffect, useState } from 'react';
import { Assignment, CourseNode, FileInfo } from '../../protocol/protocol';
import useThemisClient from '../hooks/useThemisClient';

function ExerciseView(props: {
    node: CourseNode;
    onResults: (path: string) => void;
    onBack: () => void;
}) {
    const { node, onResults } = props;
    const client = useThemisClient();
    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);

    useEffect(() => {
        client.getAssignment(node.path).then(a => {
            setAssignment(a);
            setLoading(false);
        });
    }, [node.path]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePickFiles = async () => {
        const picked = await client.pickFiles();
        if (picked.length > 0) {
            setFiles(prev => [...prev, ...picked]);
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

        const result = await client.submit(node.path, files);

        if (result.success && result.resultsPath) {
            onResults(result.resultsPath);
        } else if (result.success) {
            onResults(`/stats${node.path}/@latest`);
        } else {
            setError(result.error || "Submission failed");
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="loading">Loading assignment...</div>;
    }

    return <div>
        <div className="exercise-title">{node.title}</div>

        {/* Assignment config */}
        {assignment && assignment.options.length > 0 && (
            <div style={{ marginBottom: 10 }}>
                {assignment.options.map((group, gi) => (
                    <div key={gi} className="config-group">
                        <div className="config-group-name">{group.name}</div>
                        {group.options.map((opt, oi) => (
                            <div key={oi} className="config-option">
                                <span className="config-option-name">{opt.name}:</span>
                                <span className="config-option-value">{opt.value}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        )}

        {/* Test cases */}
        {assignment && assignment.testCases.length > 0 && (
            <div style={{ marginBottom: 10 }}>
                <div className="section-title">Visible Test Cases</div>
                {assignment.testCases.map((tc, i) => (
                    <div key={i} className="testcase-item">
                        {tc.name}{tc.hint && <span className="testcase-hint"> — {tc.hint}</span>}
                    </div>
                ))}
            </div>
        )}

        {/* File picker */}
        <div style={{ marginBottom: 8 }}>
            <div className="section-title">Files to submit</div>
            {files.length === 0 && <div className="file-list-empty">No files selected</div>}
            {files.map((f, i) => (
                <div key={i} className="file-list-item">
                    <span className="file-list-item-name">{f.name}</span>
                    <button className="btn btn-icon btn-sm" onClick={() => handleRemoveFile(i)}>&times;</button>
                </div>
            ))}
        </div>

        {/* Error */}
        {error && <div className="alert alert-error">{error}</div>}

        {/* Actions */}
        <div className="submit-actions">
            <button className="btn btn-secondary" onClick={handlePickFiles}>+ Add Files</button>
            <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || files.length === 0}
            >
                {submitting ? "Submitting..." : "Submit"}
            </button>
        </div>
    </div>;
}

export default ExerciseView;