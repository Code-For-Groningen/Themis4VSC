import {
    Assignment,
    AssignmentRequest,
    AssignmentResponse,
    CheckLoginRequest,
    CheckLoginResponse,
    CourseNode,
    DownloadFileRequest,
    DownloadFileResponse,
    DownloadInputsRequest,
    DownloadInputsResponse,
    FileInfo,
    GetActiveFileRequest,
    GetActiveFileResponse,
    GetHistoryRequest,
    GetHistoryResponse,
    GetPinnedItemsRequest,
    GetPinnedItemsResponse,
    LoggedInUserInformation,
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    LogoutResponse,
    Message,
    NavigationRequest,
    NavigationResponse,
    PasteTerminalRequest,
    PickFilesRequest,
    PickFilesResponse,
    PinItemRequest,
    PinItemResponse,
    PinnedItem,
    ResultsRequest,
    ResultsResponse,
    ShowTestCaseIORequest,
    SubmissionResult,
    SubmissionSummary,
    SubmitRequest,
    SubmitResponse,
    WatchResultsRequest,
    WatchResultsResponse,
    UnwatchResultsRequest,
} from "../../protocol/protocol";
import useVSApi from "./useVSApi";

function makeId(): string {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function useThemisClient() {
    const vsApi = useVSApi();

    function request<TReq extends Message, TResp extends Message>(
        requestMsg: TReq,
        responseType: string,
        id: string,
    ): Promise<TResp> {
        return new Promise((resolve) => {
            vsApi.onceMessage((message: Message) => {
                if (message.type !== responseType) { return false; }
                if ((message as any).id !== id) { return false; }
                resolve(message as TResp);
                return true;
            });
            vsApi.postMessage(requestMsg);
        });
    }

    return {
        async isLoggedIn(): Promise<{ loggedIn: boolean; user: LoggedInUserInformation | null }> {
            const id = makeId();
            const resp = await request<CheckLoginRequest, CheckLoginResponse>(
                { type: "check-login-request", id },
                "check-login-response",
                id,
            );
            return { loggedIn: resp.loggedIn, user: resp.user };
        },

        async attemptLogin(username: string, password: string, totp: string): Promise<{ success: boolean; user: LoggedInUserInformation | null }> {
            const id = makeId();
            const resp = await request<LoginRequest, LoginResponse>(
                { type: "login-request", id, username, password, totp },
                "login-response",
                id,
            );
            return { success: resp.success, user: resp.user };
        },

        async logout(): Promise<void> {
            const id = makeId();
            await request<LogoutRequest, LogoutResponse>(
                { type: "logout-request", id },
                "logout-response",
                id,
            );
        },

        async getNavigation(path: string): Promise<CourseNode[]> {
            const id = makeId();
            const resp = await request<NavigationRequest, NavigationResponse>(
                { type: "navigation-request", id, path },
                "navigation-response",
                id,
            );
            return resp.children;
        },

        async getAssignment(path: string): Promise<Assignment> {
            const id = makeId();
            const resp = await request<AssignmentRequest, AssignmentResponse>(
                { type: "assignment-request", id, path },
                "assignment-response",
                id,
            );
            return resp.assignment;
        },

        async pickFiles(): Promise<FileInfo[]> {
            const id = makeId();
            const resp = await request<PickFilesRequest, PickFilesResponse>(
                { type: "pick-files-request", id },
                "pick-files-response",
                id,
            );
            return resp.files;
        },

        async submit(assignmentPath: string, files: FileInfo[]): Promise<{ success: boolean; error?: string; resultsPath?: string }> {
            const id = makeId();
            const resp = await request<SubmitRequest, SubmitResponse>(
                { type: "submit-request", id, assignmentPath, files },
                "submit-response",
                id,
            );
            return { success: resp.success, error: resp.error, resultsPath: resp.resultsPath };
        },

        async getResults(path: string): Promise<SubmissionResult> {
            const id = makeId();
            const resp = await request<ResultsRequest, ResultsResponse>(
                { type: "results-request", id, path },
                "results-response",
                id,
            );
            return resp.result;
        },

        async getPinnedItems(): Promise<PinnedItem[]> {
            const id = makeId();
            const resp = await request<GetPinnedItemsRequest, GetPinnedItemsResponse>(
                { type: "get-pinned-items-request", id },
                "get-pinned-items-response",
                id,
            );
            return resp.pinnedItems;
        },

        async pinItem(path: string, title: string, submittable: boolean, pinned: boolean): Promise<PinnedItem[]> {
            const id = makeId();
            const resp = await request<PinItemRequest, PinItemResponse>(
                { type: "pin-item-request", id, path, title, submittable, pinned },
                "pin-item-response",
                id,
            );
            return resp.pinnedItems;
        },

        async getActiveFile(): Promise<FileInfo | null> {
            const id = makeId();
            const resp = await request<GetActiveFileRequest, GetActiveFileResponse>(
                { type: "get-active-file-request", id },
                "get-active-file-response",
                id,
            );
            return resp.file;
        },

        async watchResults(path: string): Promise<void> {
            const id = makeId();
            await request<WatchResultsRequest, WatchResultsResponse>(
                { type: "watch-results-request", id, path },
                "watch-results-response",
                id,
            );
        },

        unwatchResults(): void {
            vsApi.postMessage({ type: "unwatch-results-request" } as UnwatchResultsRequest);
        },

        async getHistory(assignmentPath: string): Promise<SubmissionSummary[]> {
            const id = makeId();
            const resp = await request<GetHistoryRequest, GetHistoryResponse>(
                { type: "get-history-request", id, assignmentPath },
                "get-history-response",
                id,
            );
            return resp.submissions;
        },

        showDiff(testCaseName: string, expected: string, actual: string): void {
            vsApi.postMessage({ type: "show-diff-request", testCaseName, expected, actual });
        },

        showResultDiff(testCaseName: string, expectedUrl: string, actualUrl: string): void {
            vsApi.postMessage({
                type: "show-result-diff-request",
                testCaseName,
                expectedUrl,
                actualUrl,
            });
        },

        viewFile(url: string, suggestedName: string): void {
            vsApi.postMessage({
                type: "view-themis-file-request",
                url,
                suggestedName,
            });
        },

        async downloadFile(url: string, suggestedName: string): Promise<{ success: boolean; savedPath?: string; error?: string }> {
            const id = makeId();
            const resp = await request<DownloadFileRequest, DownloadFileResponse>(
                { type: "download-file-request", id, url, suggestedName },
                "download-file-response",
                id,
            );
            return { success: resp.success, savedPath: resp.savedPath, error: resp.error };
        },

        async downloadInputs(assignmentPath: string): Promise<{ success: boolean; count: number; error?: string }> {
            const id = makeId();
            const resp = await request<DownloadInputsRequest, DownloadInputsResponse>(
                { type: "download-inputs-request", id, assignmentPath },
                "download-inputs-response",
                id,
            );
            return { success: resp.success, count: resp.count, error: resp.error };
        },

        pasteToTerminal(command: string): void {
            vsApi.postMessage({ type: "paste-terminal-request", command } as PasteTerminalRequest);
        },

        showTestCaseIO(testCaseName: string, input: string, output: string): void {
            vsApi.postMessage({
                type: "show-testcase-io-request",
                testCaseName,
                input,
                output,
            } as ShowTestCaseIORequest);
        },
    };
}

export default useThemisClient;