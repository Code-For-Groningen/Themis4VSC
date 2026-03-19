import { ExtensionContext, Webview } from "vscode";
import { Message, NavigationRequest, NavigationResponse } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleNavigationRequest(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "navigation-request") { return; }
        const req = message as NavigationRequest;

        try {
            const children = await client.getNavigation(req.path);
            const resp: NavigationResponse = {
                type: "navigation-response",
                id: req.id,
                children,
            };
            webview.postMessage(resp);
        } catch (err: any) {
            const resp: NavigationResponse = {
                type: "navigation-response",
                id: req.id,
                children: [],
            };
            webview.postMessage(resp);
        }
    }, undefined, context.subscriptions);
}
