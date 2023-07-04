import { CheckLoginRequest, CheckLoginResponse, Course, CoursesRefreshRequest, CoursesRefreshResponse, CoursesRequest, CoursesResponse, LoggedInUserInformation, LoginRequest, LoginResponse, LogoutRequest, LogoutResponse, Message } from "../../protocol/protocol";
import useVSApi from "./useVSApi";

function useThemisClient() {
    let vsApi = useVSApi();

    return {
        loggedInUser: undefined as LoggedInUserInformation | undefined,

        async isLoggedIn() {
            let id = Math.random().toString() + Math.random().toString();
            return new Promise<boolean>((resolve, reject) => {
                vsApi.onceMessage((message: Message) => {
                    if (message.type !== "check-login-response") {
                        return false;
                    }
                    let response = message as CheckLoginResponse;
                    if (response.id !== id)
                        return false;

                    let success = response.loggedIn;
                    if (success)
                        this.loggedInUser = response.user;

                    resolve(success);
                    return true;
                });

                let messageToPost: CheckLoginRequest = {
                    type: "check-login-request",
                    id: id,
                };

                vsApi.postMessage(messageToPost);
            });
        },

        async attemptLogin(username: string, password: string) {
            let id = Math.random().toString() + Math.random().toString();

            // LoginRequest -> LoginResponse
            return new Promise<boolean>((resolve, reject) => {
                vsApi.onceMessage((message: Message) => {
                    if (message.type !== "login-response") {
                        return false;
                    }
                    let response = message as LoginResponse;
                    if (response.id !== id)
                        return false;

                    let success = response.success;
                    if (success)
                        this.loggedInUser = response.user;

                    resolve(success);
                    return true;
                });

                let messageToPost: LoginRequest = {
                    type: "login-request",
                    id: id,
                    username: username,
                    password: password,
                };

                vsApi.postMessage(messageToPost);
            });
        },

        async getRootCourse() {
            let id = Math.random().toString() + Math.random().toString();

            return new Promise<Course>((resolve, reject) => {
                vsApi.onceMessage((message: Message) => {
                    if (message.type !== "courses-response") {
                        return false;
                    }
                    let response = message as CoursesResponse;
                    if (response.id !== id)
                        return false;

                    resolve(response.course);
                    return true;
                });

                let messageToPost: CoursesRequest = {
                    type: "courses-request",
                    id: id,
                };

                vsApi.postMessage(messageToPost);
            });
        },

        async refreshCourses() {
            let id = Math.random().toString() + Math.random().toString();

            return new Promise<Boolean>((resolve, reject) => {
                vsApi.onceMessage((message: Message) => {
                    if (message.type !== "courses-refresh-response") {
                        return false;
                    }
                    let response = message as CoursesRefreshResponse;
                    if (response.id !== id)
                        return false;

                    resolve(true);
                    return true;
                });

                let messageToPost: CoursesRefreshRequest = {
                    type: "courses-refresh-request",
                    id: id,
                };

                vsApi.postMessage(messageToPost);
            });
        },

        async logout() {
            let id = Math.random().toString() + Math.random().toString();

            return new Promise<Boolean>((resolve, reject) => {
                vsApi.onceMessage((message: Message) => {
                    if (message.type !== "logout-response") {
                        return false;
                    }
                    let response = message as LogoutResponse;
                    if (response.id !== id)
                        return false;

                    resolve(true);
                    return true;
                });

                let messageToPost: LogoutRequest = {
                    type: "logout-request",
                    id: id,
                };

                vsApi.postMessage(messageToPost);
            });
        }
    };
}

export default useThemisClient;