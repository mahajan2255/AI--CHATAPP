import React, { useState } from 'react';

function Login({ onLogin, onSwitchToRegister }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`http://${window.location.hostname}:3001/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                onLogin(data.user);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError("Failed to login");
        }
    };

    return (
        <div className="glass-container" style={{ maxWidth: '400px', height: 'auto', padding: '40px', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Welcome Back</h2>
            {error && <div style={{ color: '#ff6b6b', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit" className="btn" style={{ marginTop: '10px' }}>Login</button>
            </form>
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Don't have an account? <span onClick={onSwitchToRegister} style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>Register</span>
            </p>
        </div>
    );
}

export default Login;
