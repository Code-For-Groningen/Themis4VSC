import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { FileInfo, LoggedInUserInformation, CourseNode } from "../protocol/protocol";
import useThemisClient from "./hooks/useThemisClient";
import useVSApi from "./hooks/useVSApi";
import LoginThemis from "./pages/LoginThemis";
import SubmittingView from "./pages/SubmittingView";
import ExerciseView from "./pages/ExerciseView";
import ResultsView from "./pages/ResultsView";
import { ArrowLeft, LogOut, ChevronDown, ChevronRight, X, FileUp } from "lucide-react";

type Page =
    | { kind: "courses" }
    | { kind: "exercise"; node: CourseNode; extraFiles?: FileInfo[] }
    | { kind: "results"; path: string };

type SidebarState = {
    page: Page;
    resultsPath: string | null;
    resultsCollapsed: boolean;
    isLoggedIn: boolean;
    loggedAs: LoggedInUserInformation | null;
    browsePath: string | null;
    browseTitle: string;
};

function ThemisSidebar() {
    const client = useThemisClient();
    const vsApi = useVSApi();

    // Restore state from VS Code webview state API
    const saved = vsApi.getState<SidebarState>();

    const [isLoggedIn, setIsLoggedIn] = useState<boolean | undefined>(saved?.isLoggedIn);
    const [loggedAs, setLoggedAs] = useState<LoggedInUserInformation | null>(saved?.loggedAs || null);
    const [page, setPage] = useState<Page>(saved?.page || { kind: "courses" });
    const [resultsPath, setResultsPath] = useState<string | null>(saved?.resultsPath || null);
    const [resultsCollapsed, setResultsCollapsed] = useState(saved?.resultsCollapsed ?? false);
    const [pendingFiles, setPendingFiles] = useState<FileInfo[]>([]);
    // Browse state (lifted from SubmittingView so it survives navigation back)
    const [browsePath, setBrowsePath] = useState<string | null>(saved?.browsePath || null);
    const [browseTitle, setBrowseTitle] = useState<string>(saved?.browseTitle || "");

    // Resizable results panel
    const [resultsPanelHeight, setResultsPanelHeight] = useState(300);
    const resizing = useRef(false);

    // Persist state on every change
    useEffect(() => {
        vsApi.setState<SidebarState>({
            page,
            resultsPath,
            resultsCollapsed,
            isLoggedIn: isLoggedIn ?? false,
            loggedAs,
            browsePath,
            browseTitle,
        });
    }, [page, resultsPath, resultsCollapsed, isLoggedIn, loggedAs, browsePath, browseTitle]); // eslint-disable-line react-hooks/exhaustive-deps

    // Check login on mount (even if we have saved state, verify it's still valid)
    useEffect(() => {
        client.isLoggedIn().then(({ loggedIn, user }) => {
            setIsLoggedIn(loggedIn);
            if (user) { setLoggedAs(user); }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for files submitted from explorer context menu
    useEffect(() => {
        const handler = (message: any) => {
            if (message.type === "submit-from-explorer") {
                const files: FileInfo[] = message.files || [];
                setPage(prev => {
                    if (prev.kind === "exercise") {
                        // Replace extraFiles with new files from context menu, don't merge
                        return { ...prev, extraFiles: files };
                    }
                    return prev;
                });
                setPendingFiles(prev => {
                    if (page.kind !== "exercise") {
                        return [...prev, ...files];
                    }
                    return prev;
                });
            }
        };
        vsApi.onMessage(handler);
        return () => vsApi.offMessage(handler);
    }, [page.kind]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelectAssignment = useCallback((node: CourseNode) => {
        const extra = pendingFiles.length > 0 ? pendingFiles : undefined;
        setPage({ kind: "exercise", node, extraFiles: extra });
        if (extra) { setPendingFiles([]); }
    }, [pendingFiles]);

    const handleResultsReady = useCallback((path: string) => {
        setResultsPath(path);
        setResultsCollapsed(false);
        // Clear temporary files from context menu submission after successful submit
        setPage(prev => prev.kind === "exercise" ? { ...prev, extraFiles: undefined } : prev);
    }, []);

    // Drag to resize results panel
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        resizing.current = true;
        const startY = e.clientY;
        const startH = resultsPanelHeight;

        const onMove = (ev: MouseEvent) => {
            if (!resizing.current) { return; }
            const delta = startY - ev.clientY;
            setResultsPanelHeight(Math.max(120, Math.min(window.innerHeight * 0.8, startH + delta)));
        };
        const onUp = () => {
            resizing.current = false;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, [resultsPanelHeight]);

    if (isLoggedIn === undefined) {
        return <div className="loading">Loading...</div>;
    }

    if (!isLoggedIn) {
        return <LoginThemis onLoggedIn={(user) => {
            setLoggedAs(user);
            setIsLoggedIn(true);
        }} />;
    }

    return <div className="sidebar-split">
        {/* Top section */}
        <div className="sidebar-main">
            <div className="sidebar-header">
                <span className="sidebar-header-title">Themis</span>
                <div className="sidebar-header-actions">
                    {page.kind !== "courses" && (
                        <button className="btn-icon-action" title="Back to courses" onClick={() => setPage({ kind: "courses" })}>
                            <ArrowLeft size={14} />
                        </button>
                    )}
                    <button className="btn-icon-action" title="Logout" onClick={async () => {
                        await client.logout();
                        setIsLoggedIn(false);
                        setLoggedAs(null);
                        setPage({ kind: "courses" });
                        setResultsPath(null);
                    }}>
                        <LogOut size={14} />
                    </button>
                </div>
            </div>
            <div className="sidebar-user">
                {loggedAs ? `${loggedAs.name} (${loggedAs.studentId})` : ""}
            </div>

            {/* Pending files banner */}
            {pendingFiles.length > 0 && page.kind === "courses" && (
                <div className="alert alert-info">
                    <FileUp size={14} style={{ marginRight: 6, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{pendingFiles.length} file(s) ready to submit. Select an assignment.</span>
                    <button className="btn-icon-action" onClick={() => setPendingFiles([])}>
                        <X size={12} />
                    </button>
                </div>
            )}

            {page.kind === "courses" && (
                <SubmittingView
                    onSelectAssignment={handleSelectAssignment}
                    browsePath={browsePath}
                    browseTitle={browseTitle}
                    onBrowseChange={(path, title) => { setBrowsePath(path); setBrowseTitle(title); }}
                />
            )}
            {page.kind === "exercise" && (
                <ExerciseView
                    node={page.node}
                    extraFiles={page.extraFiles}
                    onResults={handleResultsReady}
                    onBack={() => setPage({ kind: "courses" })}
                />
            )}
        </div>

        {/* Bottom section: live results panel */}
        {resultsPath && (
            <div className={`sidebar-results-panel ${resultsCollapsed ? "collapsed" : ""}`}
                style={resultsCollapsed ? undefined : { height: resultsPanelHeight }}>
                {/* Resize handle */}
                {!resultsCollapsed && (
                    <div className="results-resize-handle" onMouseDown={handleResizeStart} />
                )}
                <div className="results-panel-header" onClick={() => setResultsCollapsed(!resultsCollapsed)}>
                    <span className="results-panel-title">
                        {resultsCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        <span style={{ marginLeft: 4 }}>Submission Results</span>
                    </span>
                    <button className="btn-icon-action" title="Close" onClick={(e) => {
                        e.stopPropagation();
                        setResultsPath(null);
                    }}><X size={12} /></button>
                </div>
                {!resultsCollapsed && (
                    <div className="results-panel-body">
                        <ResultsView path={resultsPath} />
                    </div>
                )}
            </div>
        )}
    </div>;
}

export default ThemisSidebar;