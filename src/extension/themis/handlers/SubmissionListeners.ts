import * as vscode from "vscode";
import { FileInfo, Message, PickFilesRequest, PickFilesResponse, SubmitRequest, SubmitResponse } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handlePickFiles(context: vscode.ExtensionContext, client: ThemisClient, webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "pick-files-request") { return; }
        const req = message as PickFilesRequest;

        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            canSelectFiles: true,
            canSelectFolders: false,
            openLabel: "Select files to submit",
        });

        const files: FileInfo[] = (uris || []).map(uri => ({
            name: uri.path.split("/").pop() || uri.fsPath,
            path: uri.fsPath,
        }));

        const resp: PickFilesResponse = {
            type: "pick-files-response",
            id: req.id,
            files,
        };
        webview.postMessage(resp);
    }, undefined, context.subscriptions);
}

export function handleSubmit(context: vscode.ExtensionContext, client: ThemisClient, webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "submit-request") { return; }
        const req = message as SubmitRequest;

        const filePaths = req.files.map(f => f.path);
        const result = await client.submitFiles(req.assignmentPath, filePaths);

        const resp: SubmitResponse = {
            type: "submit-response",
            id: req.id,
            success: result.success,
            error: result.error,
            resultsPath: result.resultsPath,
        };
        webview.postMessage(resp);
    }, undefined, context.subscriptions);
}
