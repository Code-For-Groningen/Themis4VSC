import { ExtensionContext, Webview } from "vscode";
import { CheckLoginRequest, CheckLoginResponse, LoginRequest, LoginResponse, LogoutRequest, LogoutResponse, Message } from "../../../protocol/protocol";
import ThemisClient from "../ThemisClient";

export function handleCheckLogin(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "check-login-request") { return; }
        const req = message as CheckLoginRequest;
        
        console.log("[THEMIS] handleCheckLogin: Received check-login-request");

        let user = await client.checkLogin();

        if (!user) {
            console.log("[THEMIS] handleCheckLogin: Not logged in, attempting auto-login with stored credentials");
            // Try stored credentials
            const username = await context.secrets.get("themis-username");
            const password = await context.secrets.get("themis-password");
            const totp = await context.secrets.get("themis-totp");
            if (username && password && totp) {
                console.log(`[THEMIS] handleCheckLogin: Found stored credentials for ${username}, attempting login`);
                user = await client.login(username, password, totp);
                if (user) {
                    console.log(`[THEMIS] handleCheckLogin: Auto-login successful: ${user.studentId}`);
                } else {
                    console.log("[THEMIS] handleCheckLogin: Auto-login failed");
                }
            } else {
                console.log("[THEMIS] handleCheckLogin: No stored credentials available");
            }
        } else {
            console.log(`[THEMIS] handleCheckLogin: Already logged in as ${user.studentId}`);
        }

        const resp: CheckLoginResponse = {
            type: "check-login-response",
            id: req.id,
            loggedIn: user !== null,
            user,
        };
        console.debug("[THEMIS] handleCheckLogin: Sending response", { loggedIn: resp.loggedIn, user: resp.user });
        webview.postMessage(resp);
    }, undefined, context.subscriptions);
}

export function handleAttemptLogin(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "login-request") { return; }
        const req = message as LoginRequest;

        console.log(`[THEMIS] handleAttemptLogin: Received login-request for user ${req.username}`);
        console.log(`[THEMIS] handleAttemptLogin: Starting login with username=${req.username}, totp=***`);
        
        const user = await client.login(req.username, req.password, req.totp);
        if (user) {
            console.log(`[THEMIS] handleAttemptLogin: Login successful for ${user.studentId}, storing credentials`);
            await context.secrets.store("themis-username", req.username);
            await context.secrets.store("themis-password", req.password);
            await context.secrets.store("themis-totp", req.totp);
        } else {
            console.log(`[THEMIS] handleAttemptLogin: Login failed for ${req.username}`);
        }

        const resp: LoginResponse = {
            type: "login-response",
            id: req.id,
            success: user !== null,
            user,
        };
        console.debug("[THEMIS] handleAttemptLogin: Sending response", { success: resp.success, user: resp.user });
        webview.postMessage(resp);
    }, undefined, context.subscriptions);
}

export function handleLogout(context: ExtensionContext, client: ThemisClient, webview: Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "logout-request") { return; }
        const req = message as LogoutRequest;

        console.log("[THEMIS] handleLogout: Received logout-request");
        await client.logout();
        console.log("[THEMIS] handleLogout: Client logged out, clearing stored credentials");
        await context.secrets.delete("themis-username");
        await context.secrets.delete("themis-password");
        await context.secrets.delete("themis-totp");

        const resp: LogoutResponse = {
            type: "logout-response",
            id: req.id,
        };
        console.debug("[THEMIS] handleLogout: Sending logout response");
        webview.postMessage(resp);
    }, undefined, context.subscriptions);
}