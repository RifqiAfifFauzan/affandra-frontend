import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', atau 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (authMode === 'register') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Registrasi berhasil! Silakan cek email jika butuh konfirmasi, atau langsung login.');
        setAuthMode('login');
      }
    } else if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMsg('Email atau password salah.');
      } else {
        onLoginSuccess(data.user);
      }
    } else if (authMode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Tautan pemulihan kata sandi telah dikirim ke email kamu. Silakan periksa kotak masuk.');
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212', color: '#E0E0E0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '32px', backgroundColor: '#1A1A1A', borderRadius: '16px', border: '1px solid #2A2A2A', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        
        <h2 style={{ textAlign: 'center', fontFamily: 'Georgia, serif', color: '#f3ece5', marginBottom: '8px' }}>Affandra</h2>
        <p style={{ textAlign: 'center', color: '#888', fontSize: '14px', marginBottom: '24px' }}>
          {authMode === 'register' && 'Buat Akun Keluarga Baru'}
          {authMode === 'login' && 'Masuk untuk Akses Sistem'}
          {authMode === 'forgot' && 'Pemulihan Kata Sandi'}
        </p>

        {errorMsg && (
          <div style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid rgba(255, 68, 68, 0.3)' }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '6px' }}>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
              style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#121212', border: '1px solid #333', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
              placeholder="nama@email.com"
            />
          </div>

          {authMode !== 'forgot' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '6px' }}>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required
                style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#121212', border: '1px solid #333', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
                placeholder="••••••••"
              />
              
              {/* Posisi "Lupa password?" dipindah ke bawah input password */}
              {authMode === 'login' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button 
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setErrorMsg(''); setSuccessMsg(''); }}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    Lupa password?
                  </button>
                </div>
              )}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#fff', color: '#000', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', marginTop: '8px' }}
          >
            {loading ? 'Memproses...' : (
              authMode === 'register' ? 'Daftar Akun' : 
              authMode === 'login' ? 'Masuk' : 'Kirim Link Pemulihan'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#888' }}>
          {authMode === 'forgot' ? (
            <button 
              onClick={() => { setAuthMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
            >
              ← Kembali ke halaman Masuk
            </button>
          ) : (
            <>
              {authMode === 'register' ? 'Sudah punya akun? ' : 'Belum punya akun? '}
              <button 
                onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setErrorMsg(''); setSuccessMsg(''); }}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
              >
                {authMode === 'register' ? 'Masuk di sini' : 'Daftar sekarang'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}