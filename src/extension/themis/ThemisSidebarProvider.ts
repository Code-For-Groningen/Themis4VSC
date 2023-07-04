import * as fs from 'fs';
import * as vscode from 'vscode';
import { Uri, WebviewView, WebviewViewProvider } from "vscode";
import { handleCourseRefreshRequest, handleCourseRequest } from './handlers/CoursesListeners';
import { handleDebugging } from './handlers/DebuggingListeners';
import { handleAttemptLogin, handleCheckLogin, handleLogout } from './handlers/LoginListeners';
import ThemisClient from "./ThemisClient";

class ThemisSidebarProvider implements WebviewViewProvider {
    _view?: WebviewView;
    _extensionUri: Uri;
    _context: vscode.ExtensionContext;
    _client: ThemisClient;

    constructor(context: vscode.ExtensionContext, client: ThemisClient) {
        this._context = context;
        this._extensionUri = context.extensionUri;
        this._client = client;
    }

    public async resolveWebviewView(webviewView: WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        let diskPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'public', 'index.html')
            .with({ scheme: 'vscode-resource' });
        let html = fs.readFileSync(diskPath.fsPath, 'utf-8');

        let reactScript = vscode.Uri.file(vscode.Uri.joinPath(this._extensionUri, 'dist', 'react.js').fsPath);
        let reactUrl = webviewView.webview.asWebviewUri(reactScript);

        html = html.replace("%react%", String(reactUrl));

        this.registerListeners();

        webviewView.webview.html = html;
    }

    private registerListeners() {
        handleCheckLogin(this._context, this._client, this._view!.webview);
        handleAttemptLogin(this._context, this._client, this._view!.webview);
        handleLogout(this._context, this._client, this._view!.webview);

        handleCourseRequest(this._context, this._client, this._view!.webview);
        handleCourseRefreshRequest(this._context, this._client, this._view!.webview);

        handleDebugging(this._context, this._client, this._view!.webview);
    }
}

export default ThemisSidebarProvider;