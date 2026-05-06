export type Message = {
    type: string;
}

export type Identifiable = {
    id: string;
}


export interface LoggedInUserInformation {
    studentId: string;
    name: string;
}


export interface CheckLoginRequest extends Message, Identifiable {
    type: "check-login-request";
}

export interface CheckLoginResponse extends Message, Identifiable {
    type: "check-login-response";
    loggedIn: boolean;
    user: LoggedInUserInformation | null;
}

export interface LoginRequest extends Message, Identifiable {
    type: "login-request";
    username: string;
    password: string;
    totp: string;
}

export interface LoginResponse extends Message, Identifiable {
    type: "login-response";
    success: boolean;
    user: LoggedInUserInformation | null;
}

export interface LogoutRequest extends Message, Identifiable {
    type: "logout-request";
}

export interface LogoutResponse extends Message, Identifiable {
    type: "logout-response";
}


export type CourseNode = {
    title: string;
    path: string;
    submittable: boolean;
    icon: string;
    children?: CourseNode[];
    childrenLoaded?: boolean;
    isExam?: boolean;
    isQuiz?: boolean;
    visible?: boolean;
};

export interface NavigationRequest extends Message, Identifiable {
    type: "navigation-request";
    path: string;
}

export interface NavigationResponse extends Message, Identifiable {
    type: "navigation-response";
    children: CourseNode[];
}


export interface AssignmentOptionFile {
    name: string;
    url: string;
}

export interface AssignmentOption {
    name: string;
    value: string;
    description?: string;
    /**
     * File links extracted from the cfg-val (e.g. for "Downloads", "Reference",
     * "Insertable", "Overridable" — Themis renders these as <a href="/file..."> lists).
     */
    files?: AssignmentOptionFile[];
}

export interface AssignmentOptionGroup {
    name: string;
    options: AssignmentOption[];
}

export interface AssignmentTestCase {
    name: string;
    hint: string;
    visible: boolean;
    input: string;
    output: string;
}

export interface Assignment {
    node: CourseNode;
    options: AssignmentOptionGroup[];
    testCases: AssignmentTestCase[];
    grade?: string;
    deadline?: string;
}

export interface AssignmentRequest extends Message, Identifiable {
    type: "assignment-request";
    path: string;
}

export interface AssignmentResponse extends Message, Identifiable {
    type: "assignment-response";
    assignment: Assignment;
}


export interface FileInfo {
    name: string;
    path: string;
}

export interface PickFilesRequest extends Message, Identifiable {
    type: "pick-files-request";
}

export interface PickFilesResponse extends Message, Identifiable {
    type: "pick-files-response";
    files: FileInfo[];
}

export interface SubmitRequest extends Message, Identifiable {
    type: "submit-request";
    assignmentPath: string;
    files: FileInfo[];
}

export interface SubmitResponse extends Message, Identifiable {
    type: "submit-response";
    success: boolean;
    error?: string;
    resultsPath?: string;
}


// All Themis status values from the judge server
export type ThemisStatus =
    | "passed" | "failed" | "error" | "pending" | "queued" | "none"
    | "compilerr" | "runtimerr" | "timeout" | "outlimit" | "diff" | "deadline";

export interface TestCaseResult {
    name: string;
    status: ThemisStatus;
    details?: string;
    message?: string;
    grade?: string;
    hint?: string;
    /** Themis /file URL for the reference (expected) output. */
    expectedUrl?: string;
    /** Themis /file URL for the submission's actual stdout. */
    actualUrl?: string;
    /** Themis /file URL for the submission's stderr. */
    errorUrl?: string;
    /** Themis /file URL for the precomputed diff (expected vs actual). */
    diffUrl?: string;
    /** Themis /file URL for the test input (stdin). */
    inputUrl?: string;
}

export interface SubmissionResult {
    status: ThemisStatus;
    testCases: TestCaseResult[];
    summary?: string;
    percentage?: number;
}

export interface ResultsRequest extends Message, Identifiable {
    type: "results-request";
    path: string;
}

export interface ResultsResponse extends Message, Identifiable {
    type: "results-response";
    result: SubmissionResult;
}

export interface ResultsUpdateMessage extends Message {
    type: "results-update";
    path: string;
    result: SubmissionResult;
}

export interface WatchResultsRequest extends Message, Identifiable {
    type: "watch-results-request";
    path: string;
}

export interface WatchResultsResponse extends Message, Identifiable {
    type: "watch-results-response";
}

export interface UnwatchResultsRequest extends Message, Identifiable {
    type: "unwatch-results-request";
}


export interface PinnedItem {
    path: string;
    title: string;
    submittable: boolean;
}

export interface PinItemRequest extends Message, Identifiable {
    type: "pin-item-request";
    path: string;
    title: string;
    submittable: boolean;
    pinned: boolean;
}

export interface PinItemResponse extends Message, Identifiable {
    type: "pin-item-response";
    pinnedItems: PinnedItem[];
}

export interface GetPinnedItemsRequest extends Message, Identifiable {
    type: "get-pinned-items-request";
}

export interface GetPinnedItemsResponse extends Message, Identifiable {
    type: "get-pinned-items-response";
    pinnedItems: PinnedItem[];
}


export interface SubmitFromExplorerNotification extends Message {
    type: "submit-from-explorer";
    files: FileInfo[];
}


export interface SubmissionSummary {
    path: string;
    date: string;
    status: string;
    score?: string;
}

export interface GetHistoryRequest extends Message, Identifiable {
    type: "get-history-request";
    assignmentPath: string;
}

export interface GetHistoryResponse extends Message, Identifiable {
    type: "get-history-response";
    submissions: SubmissionSummary[];
}


export interface GetActiveFileRequest extends Message, Identifiable {
    type: "get-active-file-request";
}

export interface GetActiveFileResponse extends Message, Identifiable {
    type: "get-active-file-response";
    file: FileInfo | null;
}


export interface DownloadInputsRequest extends Message, Identifiable {
    type: "download-inputs-request";
    assignmentPath: string;
}

export interface DownloadInputsResponse extends Message, Identifiable {
    type: "download-inputs-response";
    success: boolean;
    count: number;
    error?: string;
}


export interface ShowDiffRequest extends Message {
    type: "show-diff-request";
    testCaseName: string;
    expected: string;
    actual: string;
}


/**
 * Open a diff editor in VS Code by fetching the expected and actual outputs
 * from Themis (raw /file URLs) on the extension host.
 */
export interface ShowResultDiffRequest extends Message {
    type: "show-result-diff-request";
    testCaseName: string;
    expectedUrl: string;
    actualUrl: string;
}


/**
 * Open a single Themis file in a new VS Code editor tab (read-only preview).
 */
export interface ViewThemisFileRequest extends Message {
    type: "view-themis-file-request";
    url: string;
    suggestedName: string;
}


/**
 * Save a single file from Themis to disk via a Save dialog.
 */
export interface DownloadFileRequest extends Message, Identifiable {
    type: "download-file-request";
    url: string;
    suggestedName: string;
}

export interface DownloadFileResponse extends Message, Identifiable {
    type: "download-file-response";
    success: boolean;
    error?: string;
    savedPath?: string;
}


export interface PasteTerminalRequest extends Message {
    type: "paste-terminal-request";
    command: string;
}


export interface ShowTestCaseIORequest extends Message {
    type: "show-testcase-io-request";
    testCaseName: string;
    input: string;
    output: string;
}
