export type Message = {
    type: string;
}

export type Identifiable = {
    id: string;
}

// ─── User Info ───

export interface LoggedInUserInformation {
    studentId: string;
    name: string;
}

// ─── Authentication ───

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

// ─── Courses (Navigation API) ───

export type CourseNode = {
    title: string;
    path: string;
    submittable: boolean;
    icon: string;
    children?: CourseNode[];
    childrenLoaded?: boolean;
};

export interface NavigationRequest extends Message, Identifiable {
    type: "navigation-request";
    path: string;
}

export interface NavigationResponse extends Message, Identifiable {
    type: "navigation-response";
    children: CourseNode[];
}

// ─── Assignment Details ───

export interface AssignmentOption {
    name: string;
    value: string;
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
}

export interface AssignmentRequest extends Message, Identifiable {
    type: "assignment-request";
    path: string;
}

export interface AssignmentResponse extends Message, Identifiable {
    type: "assignment-response";
    assignment: Assignment;
}

// ─── File Submission ───

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

// ─── Submission Results ───

export type TestCaseStatus = "passed" | "failed" | "error" | "pending" | "running";

export interface TestCaseResult {
    name: string;
    status: TestCaseStatus;
    details?: string;
}

export interface SubmissionResult {
    status: "compiling" | "running" | "judging" | "done" | "error";
    testCases: TestCaseResult[];
    summary?: string;
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
