import { ExtensionContext, Webview } from "vscode";
import { CheckLoginRequest, CheckLoginResponse, LoginRequest, LoginResponse, LogoutRequest, LogoutResponse, Message } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleCheckLogin(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage((message: Message) => {
        if (message.type !== "check-login-request")
            return;
        let parsedMessage = message as CheckLoginRequest;

        client.getClient().get("https://themis.housing.rug.nl/course/").then(async (response) => {
            let possibleLogin = client.checkLoggedInPage(response.data);

            if (possibleLogin === null) {
                // Session expired, try to login with the stored credentials
                let username = await context.secrets.get("themis-username");
                let password = await context.secrets.get("themis-password");

                if (username && password) {
                    let loggedInUser = await client.login(username, password);
                    if (loggedInUser)
                        possibleLogin = loggedInUser;
                }
            }

            let responseMessage: CheckLoginResponse = {
                type: "check-login-response",
                id: parsedMessage.id,
                loggedIn: possibleLogin !== null,
                user: possibleLogin
            };

            webview.postMessage(responseMessage);
        });
    }, undefined, context.subscriptions);
}

export function handleAttemptLogin(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage((message: Message) => {
        if (message.type !== "login-request")
            return;
        let parsedMessage = message as LoginRequest;

        client.login(parsedMessage.username, parsedMessage.password).then(loggedInUser => {
            if (loggedInUser) {
                // Store into the secret for later use
                context.secrets.store("themis-username", parsedMessage.username);
                context.secrets.store("themis-password", parsedMessage.password);
            }

            let responseMessage: LoginResponse = {
                type: "login-response",
                id: parsedMessage.id,
                success: loggedInUser !== null,
                user: loggedInUser
            };

            webview.postMessage(responseMessage);
        });
    }, undefined, context.subscriptions);
}

export function handleLogout(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage((message: Message) => {
        if (message.type !== "logout-request")
            return;
        let parsedMessage = message as LogoutRequest;

        client.logout().then(success => {
            if (success) {
                // Remove from the secret
                context.secrets.delete("themis-username");
                context.secrets.delete("themis-password");
            }

            let responseMessage: LogoutResponse = {
                type: "logout-response",
                id: parsedMessage.id,
            };

            webview.postMessage(responseMessage);
        });
    }, undefined, context.subscriptions);
}