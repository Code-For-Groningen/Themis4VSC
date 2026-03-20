import * as vscode from 'vscode';
import { ExtensionContext, Webview } from 'vscode';
import { Message, PasteTerminalRequest } from '../../../protocol/protocol';

export function handlePasteTerminal(_context: ExtensionContext, webview: Webview) {
    webview.onDidReceiveMessage((message: Message) => {
        if (message.type !== "paste-terminal-request") { return; }
        const req = message as PasteTerminalRequest;
        if (!req.command) { return; }
        const terminal = vscode.window.activeTerminal;
        if (terminal) {
            terminal.sendText(req.command, false);
        } else {
            vscode.window.showWarningMessage("No active terminal. Open a terminal first.");
        }
    });
}
