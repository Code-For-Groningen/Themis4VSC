import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { ExtensionContext, Uri, Webview, commands, window as vscWindow } from "vscode";
import { Message, ShowResultDiffRequest } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleShowResultDiff(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "show-result-diff-request") { return; }
        const req = message as ShowResultDiffRequest;

        try {
            const [expected, actual] = await Promise.all([
                client.fetchRawFile(req.expectedUrl),
                client.fetchRawFile(req.actualUrl),
            ]);

            // Distinct subdirs so VS Code shows the directory in the tab when basenames collide,
            // and so the labels next to the filenames make it obvious which side is which.
            const root = path.join(os.tmpdir(), "themis-diff");
            const expectedDir = path.join(root, "themis-expected");
            const actualDir = path.join(root, "your-output");
            for (const d of [expectedDir, actualDir]) {
                if (!fs.existsSync(d)) { fs.mkdirSync(d, { recursive: true }); }
            }
            const safeName = req.testCaseName.replace(/[^a-zA-Z0-9_-]/g, "_") || "case";
            const expectedPath = path.join(expectedDir, `${safeName}.txt`);
            const actualPath = path.join(actualDir, `${safeName}.txt`);
            fs.writeFileSync(expectedPath, expected, "utf-8");
            fs.writeFileSync(actualPath, actual, "utf-8");

            // Title format: "<LEFT> ↔ <RIGHT>". Themis (expected) on the left so a green "+"
            // shows what your output added vs what Themis wanted.
            await commands.executeCommand(
                "vscode.diff",
                Uri.file(expectedPath),
                Uri.file(actualPath),
                `Themis expected (${req.testCaseName}) ↔ Your output (${req.testCaseName})`,
                { preview: true },
            );
        } catch (err: any) {
            vscWindow.showErrorMessage(`Themis: failed to load diff for ${req.testCaseName}: ${err.message || err}`);
        }
    }, undefined, context.subscriptions);
}
