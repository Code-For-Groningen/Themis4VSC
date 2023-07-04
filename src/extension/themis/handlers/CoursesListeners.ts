import { ExtensionContext, Webview } from "vscode";
import { Course, CoursesRefreshRequest, CoursesRefreshResponse, CoursesRequest, CoursesResponse, Message } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleCourseRequest(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage((message: Message) => {
        if (message.type !== "courses-request") {
            return;
        }

        let parsedMessage = message as CoursesRequest;

        client.indexCourses().then(course => {

            let responseMessage: CoursesResponse = {
                type: "courses-response",
                id: parsedMessage.id,
                course: course,
            };

            webview.postMessage(responseMessage);
        });
    }, undefined, context.subscriptions);
}

export function handleCourseRefreshRequest(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage((message: Message) => {
        if (message.type !== "courses-refresh-request") {
            return;
        }

        let parsedMessage = message as CoursesRefreshRequest;

        client.wipeCourseCache();

        let responseMessage: CoursesRefreshResponse = {
            type: "courses-refresh-response",
            id: parsedMessage.id,
        };

        webview.postMessage(responseMessage);
    }, undefined, context.subscriptions);
}
