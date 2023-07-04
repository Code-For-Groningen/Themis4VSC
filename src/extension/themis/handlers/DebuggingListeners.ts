import { ExtensionContext, Webview } from "vscode";
import { Message } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleDebugging(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage((message: Message) => {
        console.log("INCOMING: " + JSON.stringify(message));
    });
} 