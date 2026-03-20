import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { DownloadInputsRequest, DownloadInputsResponse, Message } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleDownloadInputs(context: vscode.ExtensionContext, client: ThemisClient, webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "download-inputs-request") { return; }
        const req = message as DownloadInputsRequest;

        try {
            const folder = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                openLabel: "Select folder for test inputs",
            });

            if (!folder || folder.length === 0) {
                const resp: DownloadInputsResponse = {
                    type: "download-inputs-response",
                    id: req.id,
                    success: false,
                    count: 0,
                    error: "No folder selected",
                };
                webview.postMessage(resp);
                return;
            }

            const destDir = folder[0].fsPath;
            const inputs = await client.downloadTestInputs(req.assignmentPath);

            for (const input of inputs) {
                const filePath = path.join(destDir, input.name);
                fs.writeFileSync(filePath, input.content, "utf-8");
            }

            const resp: DownloadInputsResponse = {
                type: "download-inputs-response",
                id: req.id,
                success: true,
                count: inputs.length,
            };
            webview.postMessage(resp);

            if (inputs.length > 0) {
                vscode.window.showInformationMessage(`Downloaded ${inputs.length} test input(s) to ${destDir}`);
            } else {
                vscode.window.showWarningMessage("No test inputs found for this assignment.");
            }
        } catch (err: any) {
            const resp: DownloadInputsResponse = {
                type: "download-inputs-response",
                id: req.id,
                success: false,
                count: 0,
                error: err.message || "Download failed",
            };
            webview.postMessage(resp);
        }
    }, undefined, context.subscriptions);
}
