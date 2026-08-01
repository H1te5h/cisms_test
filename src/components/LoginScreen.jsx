import React, { useState } from 'react';
import { Shield, Key, Eye, EyeOff, User } from 'lucide-react';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // MFA Step state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [correctOtp, setCorrectOtp] = useState('');

  // Demo users with default secure credentials
  const demoUsers = [
    { email: 'owner@cisms.com', password: 'owner123', name: 'John Doe', role: 'Owner', desc: 'All operations & settings (pw: owner123)' },
    { email: 'admin@cisms.com', password: 'admin123', name: 'Sarah Connor', role: 'Admin', desc: 'Manage Catalog & Logistics (pw: admin123)' },
    { email: 'manager@cisms.com', password: 'manager123', name: 'Alex Mercer', role: 'Manager', desc: 'Approve POs & Orders (pw: manager123)' },
    { email: 'member@cisms.com', password: 'member123', name: 'Marcus Fenix', role: 'Member', desc: 'Pack boxes & Shipping (pw: member123)' }
  ];

  const handleSelectDemo = (user) => {
    setEmail(user.email);
    setPassword(user.password);
  };

  const handlePreLoginSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;

    // Simulate OTP generation (Standard 2FA presentation flow)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setCorrectOtp(otp);
    setMfaStep(true);
    setMfaError('');
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    // Verify OTP matches
    if (mfaCode === correctOtp || mfaCode === '123456') {
      const res = await onLogin(email, password);
      if (!res || !res.success) {
        setMfaError(res?.error || 'Invalid credentials or connection issue.');
        setMfaStep(false); // send back to enter password
      }
    } else {
      setMfaError(`Invalid code! Enter the code displayed below or '123456'.`);
    }
  };

  return (
    <div className="login-wrapper" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(circle at 10% 20%, var(--bg-tertiary) 0%, var(--bg-primary) 90%)',
      padding: '24px'
    }}>
      <div className="card glass" style={{
        width: '460px',
        maxWidth: '100%',
        padding: '36px',
        borderRadius: 'var(--border-radius-lg)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            background: 'var(--accent-color)',
            color: 'white',
            width: '48px',
            height: '48px',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}>
            <Shield size={24} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700 }}>
            {mfaStep ? 'Verification Required' : 'CISMS Enterprise Control'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
            {mfaStep ? '2FA Token authentication pipeline active' : 'Secure single sign-on access to supply chain operations'}
          </p>
        </div>

        {!mfaStep ? (
          <form onSubmit={handlePreLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="input-group">
              <label className="input-label">Corporate Email Address</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="input-control" 
                  style={{ paddingLeft: '40px' }}
                  placeholder="name@cisms.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Key size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="input-control" 
                  style={{ paddingLeft: '40px', paddingRight: '40px' }}
                  placeholder="••••••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', width: '100%', padding: '12px' }}>
              Authenticate Credentials
            </button>

            <div style={{ margin: '8px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Quick Access Roles</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {demoUsers.map((u) => (
                <button
                  key={u.role}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleSelectDemo(u)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: email === u.email ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    backgroundColor: email === u.email ? 'var(--accent-light)' : 'var(--bg-secondary)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontWeight: 700 }}>{u.role}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{u.email}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{u.desc}</span>
                </button>
              ))}
            </div>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ 
              backgroundColor: 'var(--warning-light)', 
              border: '1px solid var(--warning)', 
              borderRadius: 'var(--border-radius-md)', 
              padding: '12px', 
              fontSize: '13px', 
              color: 'var(--text-primary)',
              lineHeight: '140%'
            }}>
              Multi-Factor Authentication (MFA) is active. A verification token has been simulated to your authenticator.
            </div>

            <div className="input-group">
              <label className="input-label" style={{ textAlign: 'center', display: 'block', fontSize: '14px', marginBottom: '8px' }}>
                Enter 6-Digit Verification PIN
              </label>
              <input 
                type="text" 
                maxLength="6"
                className="input-control" 
                style={{ 
                  textAlign: 'center', 
                  fontSize: '24px', 
                  letterSpacing: '8px', 
                  fontWeight: 700,
                  fontFamily: 'var(--mono)',
                  padding: '12px'
                }}
                placeholder="000000"
                required
                autoFocus
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              />
              {mfaError && (
                <span style={{ color: 'var(--danger)', fontSize: '12px', textAlign: 'center', marginTop: '4px' }}>
                  {mfaError}
                </span>
              )}
            </div>

            <div style={{ 
              backgroundColor: 'var(--accent-light)', 
              borderRadius: 'var(--border-radius-md)', 
              padding: '12px', 
              textAlign: 'center',
              border: '1px dashed var(--accent-color)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Generated Authenticator Token: </span>
              <strong style={{ fontFamily: 'var(--mono)', fontSize: '16px', color: 'var(--accent-color)', marginLeft: '6px' }}>{correctOtp}</strong>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, justifyContent: 'center' }} 
                onClick={() => setMfaStep(false)}
              >
                Back
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 2, justifyContent: 'center' }}
              >
                Verify & Enter
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
