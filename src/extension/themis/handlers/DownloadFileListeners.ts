import * as fs from "fs";
import * as vscode from "vscode";
import { DownloadFileRequest, DownloadFileResponse, Message } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleDownloadFile(context: vscode.ExtensionContext, client: ThemisClient, webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "download-file-request") { return; }
        const req = message as DownloadFileRequest;

        const fail = (error: string) => {
            const resp: DownloadFileResponse = { type: "download-file-response", id: req.id, success: false, error };
            webview.postMessage(resp);
        };

        try {
            const target = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(req.suggestedName || "themis-file.txt"),
                saveLabel: "Save Themis file",
            });
            if (!target) { return fail("No path selected"); }

            const content = await client.fetchRawFile(req.url);
            fs.writeFileSync(target.fsPath, content, "utf-8");

            const resp: DownloadFileResponse = {
                type: "download-file-response",
                id: req.id,
                success: true,
                savedPath: target.fsPath,
            };
            webview.postMessage(resp);
            vscode.window.showInformationMessage(`Saved ${req.suggestedName} → ${target.fsPath}`);
        } catch (err: any) {
            fail(err.message || "Download failed");
        }
    }, undefined, context.subscriptions);
}
