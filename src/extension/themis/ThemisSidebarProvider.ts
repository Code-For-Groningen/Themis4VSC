import * as fs from 'fs';
import * as vscode from 'vscode';
import { Uri, WebviewView, WebviewViewProvider } from "vscode";
import { handleAssignmentRequest } from './handlers/AssignmentListeners';
import { handleNavigationRequest } from './handlers/CoursesListeners';
import { handleAttemptLogin, handleCheckLogin, handleLogout } from './handlers/LoginListeners';
import { handleResultsRequest, handleWatchResults } from './handlers/ResultsListeners';
import { handlePickFiles, handleSubmit, handleGetActiveFile } from './handlers/SubmissionListeners';
import { handlePinItem, handleGetPinnedItems } from './handlers/PinsListeners';
import { handleGetHistory } from './handlers/HistoryListeners';
import { handleShowDiff } from './handlers/DiffListeners';
import { handleShowResultDiff } from './handlers/ResultDiffListeners';
import { handleDownloadInputs } from './handlers/DownloadListeners';
import { handleDownloadFile } from './handlers/DownloadFileListeners';
import { handleViewThemisFile } from './handlers/ViewFileListeners';
import { handlePasteTerminal } from './handlers/TerminalListeners';
import { handleShowTestCaseIO } from './handlers/TestCaseListeners';
import ThemisClient from "./ThemisClient";

class ThemisSidebarProvider implements WebviewViewProvider {
    _view?: WebviewView;
    _extensionUri: Uri;
    _context: vscode.ExtensionContext;
    _client: ThemisClient;
    private _listenersRegistered = false;

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

        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'public', 'index.html');
        let html = fs.readFileSync(htmlPath.fsPath, 'utf-8');

        let reactScript = vscode.Uri.file(vscode.Uri.joinPath(this._extensionUri, 'dist', 'react.js').fsPath);
        let reactUrl = webviewView.webview.asWebviewUri(reactScript);

        let cssFile = vscode.Uri.file(vscode.Uri.joinPath(this._extensionUri, 'dist', 'public', 'sidebar.css').fsPath);
        let cssUrl = webviewView.webview.asWebviewUri(cssFile);

        html = html.replace("%react%", String(reactUrl));
        html = html.replace("%css%", String(cssUrl));

        if (!this._listenersRegistered) {
            this.registerListeners();
            this._listenersRegistered = true;
        }

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
        handleGetActiveFile(ctx, webview);
        handleSubmit(ctx, client, webview);

        // Results
        handleResultsRequest(ctx, client, webview);
        handleWatchResults(ctx, client, webview);

        // Pins
        handlePinItem(ctx, webview);
        handleGetPinnedItems(ctx, webview);

        // Submission history
        handleGetHistory(ctx, client, webview);

        // Diff viewer
        handleShowDiff(ctx, webview);
        handleShowResultDiff(ctx, client, webview);

        // Download inputs
        handleDownloadInputs(ctx, client, webview);
        handleDownloadFile(ctx, client, webview);
        handleViewThemisFile(ctx, client, webview);

        // Paste to terminal
        handlePasteTerminal(ctx, webview);

        // Test case viewer
        handleShowTestCaseIO(ctx, client, webview);
    }

    public postMessage(message: any) {
        this._view?.webview.postMessage(message);
    }
}

export default ThemisSidebarProvider;