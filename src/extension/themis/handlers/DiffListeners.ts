import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { ExtensionContext, Uri, Webview, commands } from "vscode";
import { Message, ShowDiffRequest } from "../../../protocol/protocol";

export function handleShowDiff(context: ExtensionContext, webview: Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "show-diff-request") { return; }
        const req = message as ShowDiffRequest;

        const tmpDir = path.join(os.tmpdir(), "themis-diff");
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const safeName = req.testCaseName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const expectedPath = path.join(tmpDir, `${safeName}_expected.txt`);
        const actualPath = path.join(tmpDir, `${safeName}_actual.txt`);

        fs.writeFileSync(expectedPath, req.expected, "utf-8");
        fs.writeFileSync(actualPath, req.actual, "utf-8");

        await commands.executeCommand(
            "vscode.diff",
            Uri.file(expectedPath),
            Uri.file(actualPath),
            `Expected vs Actual: ${req.testCaseName}`,
        );
    }, undefined, context.subscriptions);
}
