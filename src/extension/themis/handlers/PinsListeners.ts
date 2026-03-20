import * as vscode from "vscode";
import { Message, PinItemRequest, PinItemResponse, GetPinnedItemsRequest, GetPinnedItemsResponse, PinnedItem } from "../../../protocol/protocol";

const PINNED_KEY = "themis-pinned-items";

function getPinnedItems(context: vscode.ExtensionContext): PinnedItem[] {
    // Migrate from old string[] format if needed
    const raw = context.globalState.get<any>(PINNED_KEY, []);
    if (raw.length > 0 && typeof raw[0] === "string") {
        return (raw as string[]).map(p => ({
            path: p,
            title: p.split("/").filter(Boolean).pop() || p,
            submittable: true,
        }));
    }
    return raw as PinnedItem[];
}

async function setPinnedItems(context: vscode.ExtensionContext, items: PinnedItem[]) {
    await context.globalState.update(PINNED_KEY, items);
}

export function handlePinItem(context: vscode.ExtensionContext, webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "pin-item-request") { return; }
        const req = message as PinItemRequest;

        const current = getPinnedItems(context);
        let updated: PinnedItem[];
        if (req.pinned) {
            const alreadyPinned = current.some(i => i.path === req.path);
            updated = alreadyPinned ? current : [...current, { path: req.path, title: req.title, submittable: req.submittable }];
        } else {
            updated = current.filter(i => i.path !== req.path);
        }
        await setPinnedItems(context, updated);

        const resp: PinItemResponse = {
            type: "pin-item-response",
            id: req.id,
            pinnedItems: updated,
        };
        webview.postMessage(resp);
    }, undefined, context.subscriptions);
}

export function handleGetPinnedItems(context: vscode.ExtensionContext, webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: Message) => {
        if (message.type !== "get-pinned-items-request") { return; }
        const req = message as GetPinnedItemsRequest;

        const resp: GetPinnedItemsResponse = {
            type: "get-pinned-items-response",
            id: req.id,
            pinnedItems: getPinnedItems(context),
        };
        webview.postMessage(resp);
    }, undefined, context.subscriptions);
}
