import * as fs from 'fs';
import * as vscode from 'vscode';
import { Uri, WebviewView, WebviewViewProvider } from "vscode";
import { handleAssignmentRequest } from './handlers/AssignmentListeners';
import { handleNavigationRequest } from './handlers/CoursesListeners';
import { handleAttemptLogin, handleCheckLogin, handleLogout } from './handlers/LoginListeners';
import { handleResultsRequest } from './handlers/ResultsListeners';
import { handlePickFiles, handleSubmit } from './handlers/SubmissionListeners';
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

        let cssFile = vscode.Uri.file(vscode.Uri.joinPath(this._extensionUri, 'src', 'public', 'sidebar.css').fsPath);
        let cssUrl = webviewView.webview.asWebviewUri(cssFile);

        html = html.replace("%react%", String(reactUrl));
        html = html.replace("%css%", String(cssUrl));

        this.registerListeners();

        webviewView.webview.html = html;
    }

    private registerListeners() {
        const ctx = this._context;
        const client = this._client;
        const webview = this._view!.webview;

        // Auth
        handleCheckLogin(ctx, client, webview);
        handleAttemptLogin(ctx, client, webview);
        handleLogout(ctx, client, webview);

        // Navigation
        handleNavigationRequest(ctx, client, webview);

        // Assignment details
        handleAssignmentRequest(ctx, client, webview);

        // Submission
        handlePickFiles(ctx, client, webview);
        handleSubmit(ctx, client, webview);

        // Results
        handleResultsRequest(ctx, client, webview);
    }
}

export default ThemisSidebarProvider;