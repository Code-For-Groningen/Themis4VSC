import { ExtensionContext, Webview, window as vscWindow } from "vscode";
import { Message, ResultsRequest, ResultsResponse, ResultsUpdateMessage, WatchResultsRequest, WatchResultsResponse, UnwatchResultsRequest, SubmissionResult, ThemisStatus } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleResultsRequest(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "results-request") { return; }
        const req = message as ResultsRequest;

        try {
            const result = await client.getResults(req.path);
            const resp: ResultsResponse = {
                type: "results-response",
                id: req.id,
                result,
            };
            webview.postMessage(resp);
        } catch (err: any) {
            const resp: ResultsResponse = {
                type: "results-response",
                id: req.id,
                result: { status: "error", testCases: [], summary: err.message },
            };
            webview.postMessage(resp);
        }
    }, undefined, context.subscriptions);
}

export function handleWatchResults(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    let lastStatus: string | null = null;

    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type === "watch-results-request") {
            const req = message as WatchResultsRequest;
            lastStatus = null;
            client.watchResults(req.path, (result) => {
                const update: ResultsUpdateMessage = {
                    type: "results-update",
                    path: req.path,
                    result,
                };
                webview.postMessage(update);

                // Notify when judging finishes
                const terminal: ThemisStatus[] = ["passed", "failed", "error", "compilerr", "runtimerr", "timeout", "outlimit", "diff", "deadline"];
                if (terminal.includes(result.status as ThemisStatus) && lastStatus !== result.status) {
                    notifyJudgingComplete(result);
                }
                lastStatus = result.status;
            });
            const resp: WatchResultsResponse = {
                type: "watch-results-response",
                id: req.id,
            };
            webview.postMessage(resp);
        }
        if (message.type === "unwatch-results-request") {
            client.unwatchResults();
            lastStatus = null;
        }
    }, undefined, context.subscriptions);
}

function notifyJudgingComplete(result: SubmissionResult) {
    const passed = result.testCases.filter(tc => tc.status === "passed").length;
    const total = result.testCases.length;
    const statusLabel = result.status.charAt(0).toUpperCase() + result.status.slice(1);
    const msg = total > 0
        ? `Themis: ${passed}/${total} tests passed (${statusLabel})`
        : `Themis: ${statusLabel}`;

    const isSuccess = result.status === "passed" || (total > 0 && passed === total);
    if (isSuccess) {
        vscWindow.showInformationMessage(msg, "View Results");
    } else {
        vscWindow.showWarningMessage(msg, "View Results");
    }
}
