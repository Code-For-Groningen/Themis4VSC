import { createContext } from "react";

type MessageHandler = (message: any) => boolean;

type VSApi = {
    postMessage(message: any): void;
    onMessage(handler: (message: any) => void): void;
    offMessage(handler: (message: any) => void): void;
    onceMessage(handler: MessageHandler): void;
    getState<T = any>(): T | undefined;
    setState<T = any>(state: T): void;
};

// @ts-ignore
const api = window.acquireVsCodeApi();

const handlers: MessageHandler[] = [];
const persistentHandlers: Set<(message: any) => void> = new Set();

window.addEventListener('message', (event) => {
    const data = event.data;
    // Persistent handlers
    for (const h of persistentHandlers) {
        h(data);
    }
    // Process "once" handlers (return true to remove)
    for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i](data)) {
            handlers.splice(i, 1);
        }
    }
});

const vsApi: VSApi = {
    postMessage: (message: any) => api.postMessage(message),
    onMessage: (handler: (message: any) => void) => {
        persistentHandlers.add(handler);
    },
    offMessage: (handler: (message: any) => void) => {
        persistentHandlers.delete(handler);
    },
    onceMessage: (handler: MessageHandler) => {
        handlers.push(handler);
    },
    getState: <T = any>(): T | undefined => api.getState(),
    setState: <T = any>(state: T): void => api.setState(state),
};

const VSContext = createContext<VSApi>(vsApi);

export default VSContext;
export { VSApi };