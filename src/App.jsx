import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import AIChat from './AIChat';

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loadingUpdate, setLoadingUpdate] = useState(false);

  useEffect(() => {
    // 1. Cek langsung dari URL hash apakah ini link pemulihan password dari email
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsPasswordRecovery(true);
      setLoadingSession(false);
      return;
    }

    // 2. Cek sesi normal jika bukan link pemulihan
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    // 3. Listener perubahan status auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoadingUpdate(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    if (error) {
      setMessage('Gagal memperbarui password: ' + error.message);
      setLoadingUpdate(false);
    } else {
      alert('Password berhasil diubah! Silakan masuk kembali dengan password baru.');
      
      // Bersihkan URL dari hash token pemulihan
      window.history.replaceState({}, document.title, window.location.pathname);
      
      await supabase.auth.signOut();
      setIsPasswordRecovery(false);
      setNewPassword('');
      setSession(null);
      setLoadingUpdate(false);
    }
  };

  if (loadingSession) {
    return <div style={{ backgroundColor: '#121212', color: '#fff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Memuat Affandra...</div>;
  }

  // Jika terdeteksi mode pemulihan password, tampilkan form buat password baru
  if (isPasswordRecovery) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212', color: '#E0E0E0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: '400px', padding: '32px', backgroundColor: '#1A1A1A', borderRadius: '16px', border: '1px solid #2A2A2A', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          
          <h2 style={{ textAlign: 'center', fontFamily: 'Georgia, serif', color: '#f3ece5', marginBottom: '8px' }}>Affandra</h2>
          <p style={{ textAlign: 'center', color: '#888', fontSize: '14px', marginBottom: '24px' }}>Buat Kata Sandi Baru</p>

          {message && (
            <div style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid rgba(255, 68, 68, 0.3)' }}>
              {message}
            </div>
          )}

          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '6px' }}>Password Baru</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required
                style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#121212', border: '1px solid #333', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit" 
              disabled={loadingUpdate}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#fff', color: '#000', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', marginTop: '8px' }}
            >
              {loadingUpdate ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>

        </div>
      </div>
    );
  }

  return session ? <AIChat user={session.user} /> : <Auth onLoginSuccess={(user) => setSession({ user })} />;
}