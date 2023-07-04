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
    user: LoggedInUserInformation;
}

export interface LoginRequest extends Message, Identifiable {
    type: "login-request";
    username: string;
    password: string;
}

export interface LoginResponse extends Message, Identifiable {
    type: "login-response";
    success: boolean;
    user: LoggedInUserInformation;
}

export interface LogoutRequest extends Message, Identifiable {
    type: "logout-request";
}

export interface LogoutResponse extends Message, Identifiable {
    type: "logout-response";
}

export type Course = {
    title: string;
    path: string;
    courses: Course[];
};

export interface CoursesRequest extends Message, Identifiable {
    type: "courses-request";
}

export interface CoursesResponse extends Message, Identifiable {
    type: "courses-response";
    course: Course;
}

export interface CoursesRefreshRequest extends Message, Identifiable {
    type: "courses-refresh-request";
}

export interface CoursesRefreshResponse extends Message, Identifiable {
    type: "courses-refresh-response";
}

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
    input: string; // These are links to the files containing the input and output
    output: string; // for the test case
}

export interface Assignment {
    course: Course; // The course object backing this assignment 

    options: AssignmentOptionGroup[];
    testCases: AssignmentTestCase[];
}

export interface AssignmentRequest extends Message, Identifiable {
    type: "assignment-request";
    course: Course;
}

export interface AssignmentResponse extends Message, Identifiable {
    type: "assignment-response";
    assignment: Assignment;
}
