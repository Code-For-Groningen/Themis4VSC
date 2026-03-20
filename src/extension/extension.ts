import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ThemisClient from './themis/ThemisClient';
import ThemisSidebarProvider from './themis/ThemisSidebarProvider';
import { FileInfo } from '../protocol/protocol';

function collectFiles(uri: vscode.Uri): FileInfo[] {
	const stat = fs.statSync(uri.fsPath);
	if (stat.isFile()) {
		return [{ name: path.basename(uri.fsPath), path: uri.fsPath }];
	}
	if (stat.isDirectory()) {
		const entries = fs.readdirSync(uri.fsPath);
		const files: FileInfo[] = [];
		for (const entry of entries) {
			const full = path.join(uri.fsPath, entry);
			const s = fs.statSync(full);
			if (s.isFile()) {
				files.push({ name: entry, path: full });
			}
		}
		return files;
	}
	return [];
}

export function activate(context: vscode.ExtensionContext) {
	const client = new ThemisClient(context);
	const sidebarProvider = new ThemisSidebarProvider(context, client);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('themis-sidebar', sidebarProvider, {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);

	// Context menu: Submit to Themis
	context.subscriptions.push(
		vscode.commands.registerCommand('themis4vsc.submitToThemis', (_clickedUri: vscode.Uri, selectedUris?: vscode.Uri[]) => {
			const uris = selectedUris && selectedUris.length > 0 ? selectedUris : (_clickedUri ? [_clickedUri] : []);
			if (uris.length === 0) {
				vscode.window.showWarningMessage('No files selected.');
				return;
			}
			const files: FileInfo[] = uris.flatMap(uri => collectFiles(uri));
			if (files.length === 0) {
				vscode.window.showWarningMessage('No files found in selection.');
				return;
			}
			sidebarProvider.postMessage({ type: 'submit-from-explorer', files });
			// Focus the Themis sidebar
			vscode.commands.executeCommand('themis-sidebar.focus');
		})
	);
}

export function deactivate() { }
