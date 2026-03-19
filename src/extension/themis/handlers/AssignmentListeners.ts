import { ExtensionContext, Webview } from "vscode";
import { AssignmentRequest, AssignmentResponse, Message } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleAssignmentRequest(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "assignment-request") { return; }
        const req = message as AssignmentRequest;

        try {
            const assignment = await client.getAssignment(req.path);
            const resp: AssignmentResponse = {
                type: "assignment-response",
                id: req.id,
                assignment,
            };
            webview.postMessage(resp);
        } catch (err: any) {
            const resp: AssignmentResponse = {
                type: "assignment-response",
                id: req.id,
                assignment: {
                    node: { title: "", path: req.path, submittable: true, icon: "code" },
                    options: [],
                    testCases: [],
                },
            };
            webview.postMessage(resp);
        }
    }, undefined, context.subscriptions);
}
