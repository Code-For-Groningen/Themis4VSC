import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { Message, ViewThemisFileRequest } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleViewThemisFile(context: vscode.ExtensionContext, client: ThemisClient, webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "view-themis-file-request") { return; }
        const req = message as ViewThemisFileRequest;

        try {
            const content = await client.fetchRawFile(req.url);

            const tmpDir = path.join(os.tmpdir(), "themis-view");
            if (!fs.existsSync(tmpDir)) { fs.mkdirSync(tmpDir, { recursive: true }); }
            const safeName = (req.suggestedName || "themis-file.txt").replace(/[^a-zA-Z0-9._-]/g, "_");
            const filePath = path.join(tmpDir, safeName);
            fs.writeFileSync(filePath, content, "utf-8");

            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
        } catch (err: any) {
            vscode.window.showErrorMessage(`Themis: failed to open ${req.suggestedName}: ${err.message || err}`);
        }
    }, undefined, context.subscriptions);
}
