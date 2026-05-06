import * as fs from 'fs';
import * as vscode from 'vscode';
import { ExtensionContext, Webview, WebviewPanel } from 'vscode';
import { Message, ShowTestCaseIORequest } from '../../../protocol/protocol';
import ThemisClient from '../ThemisClient';

export function handleShowTestCaseIO(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    let panel: WebviewPanel | undefined;

    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "show-testcase-io-request") { return; }
        const req = message as ShowTestCaseIORequest;

        // Test cases from assignment metadata are Themis file URLs; always resolve them via raw fetch.
        let inputContent: string;
        let outputContent: string;
        try {
            inputContent = req.input ? await client.fetchRawFile(req.input) : '(no input file)';
        } catch (e) {
            inputContent = `(failed to load input: ${e})`;
        }
        try {
            outputContent = req.output ? await client.fetchRawFile(req.output) : '(no output file)';
        } catch (e) {
            outputContent = `(failed to load output: ${e})`;
        }

        // Create or reuse webview panel for test case view
        if (panel) {
            panel.reveal(vscode.ViewColumn.Beside);
            panel.title = `Test Case: ${req.testCaseName}`;
        } else {
            panel = vscode.window.createWebviewPanel(
                'themisTestCase',
                `Test Case: ${req.testCaseName}`,
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            panel.onDidDispose(() => { panel = undefined; });
        }
        // Save handler: panel posts { type: 'save', kind, name, content }
        const savedListener = panel.webview.onDidReceiveMessage(async (msg: any) => {
            if (!msg || msg.type !== "save") { return; }
            try {
                const target = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(msg.name),
                    saveLabel: `Save ${msg.kind}`,
                });
                if (!target) { return; }
                fs.writeFileSync(target.fsPath, msg.content, "utf-8");
                vscode.window.showInformationMessage(`Saved ${msg.kind} → ${target.fsPath}`);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Failed to save ${msg.kind}: ${e.message || e}`);
            }
        });
        panel.onDidDispose(() => savedListener.dispose());

        // Escape HTML content and generate split pane view
        const escapeHtml = (text: string) => {
            const map: Record<string, string> = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;',
            };
            return text.replace(/[&<>"']/g, char => map[char] || char);
        };

        panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Test Case: ${escapeHtml(req.testCaseName)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-editor-foreground, #d4d4d4);
        }
        .header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border, #3e3e42);
            font-weight: 500;
            font-size: 13px;
        }
        .content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        .pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border-right: 1px solid var(--vscode-panel-border, #3e3e42);
        }
        .pane:last-child {
            border-right: none;
        }
        .pane-label {
            padding: 8px 12px;
            background: var(--vscode-sideBar-background, #252526);
            border-bottom: 1px solid var(--vscode-panel-border, #3e3e42);
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-sideBarTitle-foreground, #cccccc);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .save-btn {
            padding: 3px 8px;
            border: 1px solid var(--vscode-button-border, transparent);
            background: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, white);
            border-radius: 2px;
            cursor: pointer;
            font-size: 11px;
        }
        .save-btn:hover {
            background: var(--vscode-button-hoverBackground, #1177bb);
        }
        .pane-content {
            flex: 1;
            overflow: auto;
            padding: 12px 16px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.5;
        }
        .button-close {
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 4px 8px;
            border: 1px solid var(--vscode-button-border, transparent);
            background: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, white);
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .button-close:hover {
            background: var(--vscode-button-hoverBackground, #1177bb);
        }
    </style>
</head>
<body>
    <div class="header">
        Test Case: <strong>${escapeHtml(req.testCaseName)}</strong>
    </div>
    <div class="content">
        <div class="pane">
            <div class="pane-label">
                <span>Input</span>
                <button class="save-btn" id="save-input">Save Input</button>
            </div>
            <div class="pane-content" id="input-content">${escapeHtml(inputContent)}</div>
        </div>
        <div class="pane">
            <div class="pane-label">
                <span>Expected Output</span>
                <button class="save-btn" id="save-output">Save Output</button>
            </div>
            <div class="pane-content" id="output-content">${escapeHtml(outputContent)}</div>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const inputText = ${JSON.stringify(inputContent)};
        const outputText = ${JSON.stringify(outputContent)};
        const baseName = ${JSON.stringify(req.testCaseName)};
        document.getElementById('save-input').addEventListener('click', () => {
            vscode.postMessage({ type: 'save', kind: 'input', name: baseName + '.in', content: inputText });
        });
        document.getElementById('save-output').addEventListener('click', () => {
            vscode.postMessage({ type: 'save', kind: 'expected output', name: baseName + '.out', content: outputText });
        });
    </script>
</body>
</html>`;
    });
}
