import {
    Assignment,
    AssignmentRequest,
    AssignmentResponse,
    CheckLoginRequest,
    CheckLoginResponse,
    CourseNode,
    FileInfo,
    LoggedInUserInformation,
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    LogoutResponse,
    Message,
    NavigationRequest,
    NavigationResponse,
    PickFilesRequest,
    PickFilesResponse,
    ResultsRequest,
    ResultsResponse,
    SubmissionResult,
    SubmitRequest,
    SubmitResponse,
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
    };
}

export default useThemisClient;