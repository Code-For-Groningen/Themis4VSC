import { ExtensionContext, Webview } from "vscode";
import { Message, ResultsRequest, ResultsResponse } from "../../../protocol/protocol";
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
