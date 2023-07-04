// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import ThemisClient from './themis/ThemisClient';
import ThemisSidebarProvider from './themis/ThemisSidebarProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let client = new ThemisClient(context);

	// Build the sidebar element
	let sidebarProvider = new ThemisSidebarProvider(context, client);

	// Register the sidebar element
	let subscription = vscode.window.registerWebviewViewProvider('themis-sidebar', sidebarProvider);
	context.subscriptions.push(subscription);
}

// This method is called when your extension is deactivated
export function deactivate() { }
