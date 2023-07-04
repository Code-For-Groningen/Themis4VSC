import * as React from "react";
import { useState, useEffect } from "react";
import { LoggedInUserInformation } from "../protocol/protocol";
import VSContext from "./context/VSContext";
import useThemisClient from "./hooks/useThemisClient";
import useVSApi from "./hooks/useVSApi";
import LoginThemis from "./pages/LoginThemis";
import SubmittingView from "./pages/SubmittingView";

function formatLoggedInUser(user: LoggedInUserInformation) {
    if (!user)
        return "Not logged in";
    return `${user.name} (${user.studentId})`;
}

function ThemisSidebar() {
    let client = useThemisClient();
    let [isLoggedIn, setIsLoggedIn] = useState<boolean>(undefined);
    let [loggedAs, setLoggedAs] = useState<LoggedInUserInformation>(undefined);

    useEffect(() => {
        client.isLoggedIn()
            .then(loggedIn => setIsLoggedIn(loggedIn))
            .then(() => {
                setLoggedAs(client.loggedInUser);
            });
    });

    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1>Themis</h1>
            <button onClick={async () => {
                await client.logout();
                setIsLoggedIn(false);
            }}>
                Logout
            </button>
        </div>
        <div>
            Logged in as: {formatLoggedInUser(loggedAs)}
        </div>
        {isLoggedIn === undefined ? <p>Loading...</p> :
            isLoggedIn ? <SubmittingView /> :
                <LoginThemis setLoggedIn={(logged) => setIsLoggedIn(logged)} />
        }
    </div>;
}

export default ThemisSidebar;