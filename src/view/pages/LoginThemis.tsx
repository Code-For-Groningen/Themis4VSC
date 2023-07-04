import * as React from 'react';
import { useState } from 'react';
import useThemisClient from '../hooks/useThemisClient';

function LoginThemis(props: { setLoggedIn: (loggedIn: boolean) => void }) {
    let [username, setUsername] = useState('');
    let [password, setPassword] = useState('');

    let [error, setError] = useState<string | undefined>(undefined);

    let client = useThemisClient();

    return <>
        <h2>Login</h2>
        {error && <p>{error}</p>}
        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={() => {
            client.attemptLogin(username, password).then(success => {
                if (success) {
                    props.setLoggedIn(true);
                } else {
                    setError('Invalid username or password');
                }
            });
        }}>Login</button>
    </>;
}

export default LoginThemis;