import * as React from "react";
import { useState, useEffect } from "react";
import { FileInfo, LoggedInUserInformation, CourseNode } from "../protocol/protocol";
import useThemisClient from "./hooks/useThemisClient";
import LoginThemis from "./pages/LoginThemis";
import SubmittingView from "./pages/SubmittingView";
import ExerciseView from "./pages/ExerciseView";
import ResultsView from "./pages/ResultsView";

type Page =
    | { kind: "courses" }
    | { kind: "exercise"; node: CourseNode }
    | { kind: "results"; path: string };

function ThemisSidebar() {
    const client = useThemisClient();
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | undefined>(undefined);
    const [loggedAs, setLoggedAs] = useState<LoggedInUserInformation | null>(null);
    const [page, setPage] = useState<Page>({ kind: "courses" });

    useEffect(() => {
        client.isLoggedIn().then(({ loggedIn, user }) => {
            setIsLoggedIn(loggedIn);
            if (user) { setLoggedAs(user); }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (isLoggedIn === undefined) {
        return <div className="loading">Loading...</div>;
    }

    if (!isLoggedIn) {
        return <LoginThemis onLoggedIn={(user) => {
            setLoggedAs(user);
            setIsLoggedIn(true);
        }} />;
    }

    return <div>
        <div className="sidebar-header">
            <span className="sidebar-header-title">Themis</span>
            <div className="sidebar-header-actions">
                {page.kind !== "courses" && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage({ kind: "courses" })}>Back</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={async () => {
                    await client.logout();
                    setIsLoggedIn(false);
                    setLoggedAs(null);
                    setPage({ kind: "courses" });
                }}>Logout</button>
            </div>
        </div>
        <div className="sidebar-user">
            {loggedAs ? `${loggedAs.name} (${loggedAs.studentId})` : ""}
        </div>

        {page.kind === "courses" && (
            <SubmittingView onSelectAssignment={(node) => setPage({ kind: "exercise", node })} />
        )}
        {page.kind === "exercise" && (
            <ExerciseView
                node={page.node}
                onResults={(path) => setPage({ kind: "results", path })}
                onBack={() => setPage({ kind: "courses" })}
            />
        )}
        {page.kind === "results" && (
            <ResultsView path={page.path} />
        )}
    </div>;
}

export default ThemisSidebar;