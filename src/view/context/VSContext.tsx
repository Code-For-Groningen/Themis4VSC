import { createContext } from "react";

type MessageHandler = (message: any) => boolean;

type VSApi = {
    postMessage(message: any): void;
    onMessage(handler: (message: any) => void): void;
    onceMessage(handler: MessageHandler): void;
};

// @ts-ignore
const api = window.acquireVsCodeApi();

const handlers: MessageHandler[] = [];

window.addEventListener('message', (event) => {
    const data = event.data;
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
        window.addEventListener('message', (event) => handler(event.data));
    },
    onceMessage: (handler: MessageHandler) => {
        handlers.push(handler);
    },
};

const VSContext = createContext<VSApi>(vsApi);

export default VSContext;
export { VSApi };