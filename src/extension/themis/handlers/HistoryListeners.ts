import { ExtensionContext, Webview } from "vscode";
import { Message, GetHistoryRequest, GetHistoryResponse } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleGetHistory(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "get-history-request") { return; }
        const req = message as GetHistoryRequest;

        try {
            const submissions = await client.getSubmissionHistory(req.assignmentPath);
            const resp: GetHistoryResponse = {
                type: "get-history-response",
                id: req.id,
                submissions,
            };
            webview.postMessage(resp);
        } catch (err: any) {
            const resp: GetHistoryResponse = {
                type: "get-history-response",
                id: req.id,
                submissions: [],
            };
            webview.postMessage(resp);
        }
    }, undefined, context.subscriptions);
}
