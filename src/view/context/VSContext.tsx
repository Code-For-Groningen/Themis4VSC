import { createContext } from "react";

type VSApi = {
    postMessage(message: any): void;
    onMessage(handler: (message: any) => void): void;
    onceMessage(handler: (message: any) => boolean): void;
};

// @ts-ignore
let api = window.acquireVsCodeApi();

let VSContext = createContext({
    ...api,
    onMessage: (handler: (message: any) => void) => window.addEventListener('message', event => handler(event.data)),
    onceMessage: (handler: (message: any) => boolean) => window.addEventListener('message', event => {
        if (handler(event.data))
            window.removeEventListener('message', handler);
    }),
});

export default VSContext;
export { VSApi };