import * as React from 'react';
import { useState } from 'react';
import { LoggedInUserInformation } from '../../protocol/protocol';
import useThemisClient from '../hooks/useThemisClient';

function LoginThemis(props: { onLoggedIn: (user: LoggedInUserInformation) => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [totp, setTotp] = useState('');
    const [error, setError] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);

    const client = useThemisClient();

    const handleLogin = async () => {
        if (!username || !password) {
            setError('Please enter username and password');
            return;
        }
        if (!totp) {
            setError('Please enter your 2FA code');
            return;
        }
        setLoading(true);
        setError(undefined);
        try {
            const { success, user } = await client.attemptLogin(username, password, totp);
            if (success && user) {
                props.onLoggedIn(user);
            } else {
                setError('Login failed — check your credentials and 2FA code');
            }
        } catch {
            setError('Connection failed');
        }
        setLoading(false);
    };

    return <div className="login-container">
        <h3 className="login-title">Themis Login</h3>
        <p className="login-subtitle">Sign in with your RUG credentials</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label className="form-label">Student ID</label>
        <input
            className="form-input"
            type="text"
            placeholder="e.g. s1234567"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            disabled={loading}
        />
        <label className="form-label">Password</label>
        <input
            className="form-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            disabled={loading}
        />
        <label className="form-label">2FA Code (TOTP)</label>
        <input
            className="form-input"
            type="text"
            placeholder="6-digit code"
            value={totp}
            onChange={e => setTotp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            disabled={loading}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
        />
        <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
        </button>
    </div>;
}

export default LoginThemis;