import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus.js';
import { supabase } from './supabaseClient';

// URL backend produksi Vercel
const BACKEND_URL = 'https://affandra-backend.vercel.app';

// Komponen Kustom untuk Blok Kode dengan Tombol Copy
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return !inline && match ? (
    <div style={{ position: 'relative', margin: '16px 0', borderRadius: '10px', overflow: 'hidden', border: '1px solid #27272a', backgroundColor: '#121214' }}>
      <div style={{ backgroundColor: '#1a1a1e', padding: '8px 16px', fontSize: '12px', color: '#a1a1aa', borderBottom: '1px solid #27272a', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{match[1].toUpperCase()}</span>
        <button
          onClick={handleCopyCode}
          style={{
            background: '#27272a',
            color: '#fff',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
        >
          {copied ? 'Copied! ✓' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        customStyle={{ margin: 0, padding: '16px', backgroundColor: '#0f0f0f', fontSize: '14px' }}
        {...props}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  ) : (
    <code style={{ backgroundColor: '#27272a', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#f472b6' }} {...props}>
      {children}
    </code>
  );
};

export default function AIChat({ user }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [input, setInput] = useState('');
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); 
  
  // STATE UNTUK ZOOM FOTO (LIGHTBOX)
  const [modalImg, setModalImg] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null); 
  const abortControllerRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredSessionId, setHoveredSessionId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // STATE UNTUK RESPONSIF MOBILE & DETEKSI PERANGKAT
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      // Deteksi berdasarkan lebar layar atau sentuhan perangkat
      const mobileCheck = window.innerWidth < 768 || 'ontouchstart' in window;
      setIsMobile(mobileCheck);
      if (window.innerWidth >= 768 && !('ontouchstart' in window)) {
        setIsMobileSidebarOpen(false);
      }
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions?userId=${user.id}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
          const formattedSessions = data.map(s => ({ ...s, messages: [] }));
          setSessions(formattedSessions);
          setActiveSessionId(formattedSessions[0].id);
        } else {
          const newSessionId = Date.now().toString();
          setSessions([{ id: newSessionId, title: 'Obrolan Baru', messages: [] }]);
          setActiveSessionId(newSessionId);
        }
      } catch (error) {
        console.error("Gagal mengambil data sesi:", error);
      }
    };
    fetchSessions();
  }, [user.id]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeSessionId) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions/${activeSessionId}/messages`);
        const data = await response.json();
        
        const formattedMessages = (data || []).map(msg => ({
          role: msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content || '' }]
        }));
        
        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? { ...s, messages: formattedMessages } : s
        ));
      } catch (error) {
        console.error("Gagal mengambil pesan:", error);
      }
    };

    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (currentSession && currentSession.title !== 'Obrolan Baru') {
      fetchMessages();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isLoading]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const createNewChat = () => {
    const newSessionId = Date.now().toString();
    const newSession = { id: newSessionId, title: 'Obrolan Baru', messages: [] };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSessionId);
    if (isMobile) setIsMobileSidebarOpen(false);
  };

  const saveRename = async (id) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    
    const sessionToEdit = sessions.find(s => s.id === id);
    if (sessionToEdit && sessionToEdit.title !== editTitle && sessionToEdit.title !== 'Obrolan Baru') {
      try {
        await fetch(`${BACKEND_URL}/api/sessions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: editTitle })
        });
      } catch (error) {
        console.error("Gagal mengganti nama:", error);
      }
    }
    
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: editTitle } : s));
    setEditingId(null);
  };

  const deleteSession = async (id, e) => {
    if (e) e.stopPropagation();
    const confirmDelete = window.confirm("Yakin ingin menghapus obrolan ini?");
    if (!confirmDelete) return;

    try {
      const sessionToDelete = sessions.find(s => s.id === id);
      if (sessionToDelete && sessionToDelete.title !== 'Obrolan Baru') {
        await fetch(`${BACKEND_URL}/api/sessions/${id}`, { method: 'DELETE' });
      }
      
      const updatedSessions = sessions.filter(s => s.id !== id);
      
      if (updatedSessions.length === 0) {
        const newSessionId = Date.now().toString();
        setSessions([{ id: newSessionId, title: 'Obrolan Baru', messages: [] }]);
        setActiveSessionId(newSessionId);
      } else {
        setSessions(updatedSessions);
        if (activeSessionId === id) {
          setActiveSessionId(updatedSessions[0].id);
        }
      }
    } catch (error) {
      console.error("Gagal menghapus obrolan:", error);
    }
    setMenuOpenId(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null); 
      }
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
          break;
        }
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setSessions(prev => prev.map(s => 
      s.id === activeSessionId ? { ...s, messages: [...s.messages, { role: 'model', parts: [{ text: "⚠️ Respon dihentikan oleh pengguna." }] }] } : s
    ));
  };

  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 130)}px`;
    }
  };

  const sendMessage = async (textToSend) => {
    const messageText = typeof textToSend === 'string' ? textToSend : input;
    if (!messageText.trim() && !selectedFile) return;

    const currentFile = selectedFile;
    const currentPreviewUrl = previewUrl;

    const newUserMessage = { 
      role: 'user', 
      parts: [{ text: messageText }],
      imageUrl: currentFile && currentFile.type.startsWith('image/') ? currentPreviewUrl : null,
      fileName: currentFile ? currentFile.name : null
    };
    
    const currentMessages = activeSession?.messages || [];
    let sessionTitle = activeSession?.title || 'Obrolan Baru';
    
    if (currentMessages.length === 0) {
      sessionTitle = messageText.length > 20 ? messageText.substring(0, 20) + '...' : (messageText || currentFile?.name || 'Obrolan Baru');
    }

    const newMessages = [...currentMessages, newUserMessage];

    setSessions(prev => prev.map(s => 
      s.id === activeSessionId ? { ...s, title: sessionTitle, messages: newMessages } : s
    ));
    
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; 
    }
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const formData = new FormData();
    formData.append('userId', user.id);
    formData.append('message', messageText);
    formData.append('history', JSON.stringify(currentMessages));
    formData.append('sessionId', activeSessionId ? activeSessionId.toString() : '');
    formData.append('sessionTitle', sessionTitle);

    if (currentFile) {
      formData.append('file', currentFile);
    }

    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      const data = await response.json();
      const aiReply = response.ok ? data.reply : `⚠️ Error: ${data.error}`;

      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...newMessages, { role: 'model', parts: [{ text: aiReply }] }] } : s
      ));
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Fetch dibatalkan oleh pengguna.");
      } else {
        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? { ...s, messages: [...newMessages, { role: 'model', parts: [{ text: "⚠️ Gagal terhubung ke server backend." }] }] } : s
        ));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden', backgroundColor: '#0f0f0f', color: '#E4E4E7', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative' }}>
      
      {/* MODAL LIGHTBOX UNTUK ZOOM FOTO */}
      {modalImg && (
        <div 
          onClick={() => setModalImg(null)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh',
            backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 2000,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={modalImg} alt="Zoomed" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} />
            <button 
              onClick={() => setModalImg(null)}
              style={{
                position: 'absolute', top: '-15px', right: '-15px', background: '#27272a', color: '#fff',
                border: '1px solid #3f3f46', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer',
                fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* BACKDROP UNTUK MOBILE SIDEBAR */}
      {isMobile && isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* SIDEBAR */}
      <div style={{ 
        width: '280px', 
        backgroundColor: '#18181b', 
        padding: '16px', 
        display: isMobile ? (isMobileSidebarOpen ? 'flex' : 'none') : 'flex', 
        flexDirection: 'column', 
        borderRight: '1px solid #27272a', 
        boxSizing: 'border-box',
        position: isMobile ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        height: '100dvh',
        zIndex: 1000,
        boxShadow: isMobile ? '4px 0 24px rgba(0,0,0,0.6)' : 'none'
      }}>
        
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          </div>
        )}

        <button 
          onClick={createNewChat} 
          style={{ 
            width: '100%', padding: '12px 16px', marginBottom: '20px', borderRadius: '10px', 
            backgroundColor: '#27272a', color: '#fff', border: '1px solid #3f3f46', 
            cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', gap: '8px', fontSize: '14px', transition: 'background 0.2s' 
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
        >
          <span>➕</span> Obrolan Baru
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '2px' }}>
          <div style={{ fontSize: '11px', color: '#71717a', fontWeight: '600', marginBottom: '8px', letterSpacing: '0.5px', paddingLeft: '4px' }}>RIWAYAT CHAT</div>
          
          {(sessions || []).map(session => (
            <div 
              key={session.id} 
              onMouseEnter={() => setHoveredSessionId(session.id)}
              onMouseLeave={() => setHoveredSessionId(null)}
              onClick={() => {
                setActiveSessionId(session.id);
                setEditingId(null);
                if (isMobile) setIsMobileSidebarOpen(false);
              }} 
              style={{ 
                position: 'relative', 
                padding: '10px 12px', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                backgroundColor: session.id === activeSessionId ? '#27272a' : 'transparent', 
                color: session.id === activeSessionId ? '#fff' : '#a1a1aa', 
                fontSize: '14px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                transition: 'background 0.15s, color 0.15s'
              }}
            >
              {editingId === session.id ? (
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => saveRename(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename(session.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  style={{ width: '100%', background: '#0f0f0f', color: '#fff', border: '1px solid #3f3f46', borderRadius: '4px', padding: '4px 8px', fontSize: '14px', outline: 'none' }}
                />
              ) : (
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, paddingRight: '20px' }}>
                  💬 {session.title}
                </div>
              )}

              {(hoveredSessionId === session.id || menuOpenId === session.id) && editingId !== session.id && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === session.id ? null : session.id);
                  }} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d4d4d8', fontSize: '16px', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                >
                  ⋮
                </button>
              )}

              {menuOpenId === session.id && (
                <div style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  top: '38px', 
                  backgroundColor: '#27272a', 
                  borderRadius: '8px', 
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)', 
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  width: '130px',
                  border: '1px solid #3f3f46'
                }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(session.id);
                      setEditTitle(session.title);
                      setMenuOpenId(null);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#fff', padding: '10px 12px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #3f3f46' }}
                  >
                    ✏️ Ganti Nama
                  </button>
                  <button 
                    onClick={(e) => deleteSession(session.id, e)}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', padding: '10px 12px', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}
                  >
                    🗑️ Hapus
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={user?.email}>
            👤 {user?.email || 'Pengguna'}
          </div>
          <button 
            onClick={() => supabase.auth.signOut()} 
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: '4px 8px' }}
            title="Keluar Akun"
          >
            Logout
          </button>
        </div>

      </div>

      {/* MAIN CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', overflow: 'hidden', backgroundColor: '#0f0f0f' }}>
        
        {/* TOP HEADER */}
        <div style={{ 
          padding: '14px 20px', 
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '1px solid #27272a',
          backgroundColor: '#121214'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '40px' }}>
            {isMobile && (
              <button 
                onClick={() => setIsMobileSidebarOpen(true)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', padding: '0' }}
                title="Buka Menu"
              >
                ☰
              </button>
            )}
          </div> 
          
          <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', color: '#f4f4f5', fontSize: '18px', fontWeight: 'normal', letterSpacing: '0.5px', textAlign: 'center' }}>Affandra</h2>
          
          <div style={{ minWidth: '40px' }}></div>
        </div>

        {/* CHAT MESSAGES SCROLL CONTAINER */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
          <div style={{ width: '100%', maxWidth: '720px' }}>
            {(!activeSession?.messages || activeSession.messages.length === 0) && (
              <div style={{ textAlign: 'center', marginTop: '15vh', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '36px' }}>✨</div>
                <h3 style={{ margin: 0, color: '#f4f4f5', fontSize: '20px', fontWeight: '500' }}>Ada yang bisa dibantu hari ini?</h3>
                <p style={{ margin: 0, color: '#a1a1aa', fontSize: '14px', maxWidth: '400px', lineHeight: '1.5' }}>
                  Ketik pertanyaan, diskusikan ide, atau unggah dokumen dan gambar untuk memulai obrolan dengan Affandra.
                </p>
              </div>
            )}
            
            {(activeSession?.messages || []).map((msg, index) => {
              const textContent = msg.parts?.[0]?.text || '';
              const isUser = msg.role === 'user';
              
              return (
                <div key={index} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '24px', width: '100%' }}>
                  <div style={{ 
                    background: isUser ? '#27272a' : 'transparent', 
                    color: '#e4e4e7', 
                    padding: isUser ? '12px 18px' : '4px 0', 
                    borderRadius: isUser ? '18px 18px 4px 18px' : '0', 
                    maxWidth: isUser ? '85%' : '100%', 
                    width: isUser ? 'auto' : '100%',
                    fontSize: '15px', 
                    lineHeight: '1.7', 
                    wordBreak: 'break-word', 
                    overflowWrap: 'anywhere',
                    boxShadow: isUser ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
                  }}>
                    {isUser ? (
                      <div>
                        {msg.imageUrl && (
                          <div 
                            onClick={() => setModalImg(msg.imageUrl)}
                            style={{ marginBottom: '10px', borderRadius: '10px', overflow: 'hidden', maxWidth: '240px', border: '1px solid #3f3f46', cursor: 'zoom-in' }}
                            title="Klik untuk memperbesar foto"
                          >
                            <img src={msg.imageUrl} alt="Uploaded preview" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                          </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap' }}>{textContent}</div>
                      </div>
                    ) : (
                      <div className="markdown-content" style={{ color: '#f4f4f5' }}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table({ children }) {
                              return (
                                <div style={{ overflowX: 'auto', margin: '16px 0', borderRadius: '8px', border: '1px solid #27272a' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                                    {children}
                                  </table>
                                </div>
                              );
                            },
                            th({ children }) {
                              return <th style={{ backgroundColor: '#18181b', padding: '10px 14px', borderBottom: '1px solid #27272a', color: '#f4f4f5', fontWeight: '600' }}>{children}</th>;
                            },
                            td({ children }) {
                              return <td style={{ padding: '10px 14px', borderBottom: '1px solid #27272a', color: '#d4d4d8' }}>{children}</td>;
                            },
                            p({ children }) {
                              return <p style={{ margin: '0 0 12px 0' }}>{children}</p>;
                            },
                            ul({ children }) {
                              return <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px' }}>{children}</ul>;
                            },
                            ol({ children }) {
                              return <ol style={{ margin: '0 0 12px 0', paddingLeft: '20px' }}>{children}</ol>;
                            },
                            li({ children }) {
                              return <li style={{ marginBottom: '4px' }}>{children}</li>;
                            },
                            code: CodeBlock
                          }}
                        >
                          {textContent}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a1a1aa', fontSize: '14px', fontStyle: 'italic', marginBottom: '24px' }}>
                <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>✨</span> Affandra sedang berpikir...
              </div>
            )}
            <div ref={messagesEndRef} /> 
          </div>
        </div>

        {/* INPUT AREA */}
        <div style={{ 
          padding: '16px 20px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          backgroundColor: '#0f0f0f',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'
        }}>
          <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {selectedFile && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                {previewUrl ? (
                  <div 
                    onClick={() => setModalImg(previewUrl)}
                    style={{ position: 'relative', width: '72px', height: '72px', borderRadius: '10px', border: '1px solid #3f3f46', overflow: 'hidden', backgroundColor: '#18181b', cursor: 'zoom-in' }}
                    title="Klik untuk memperbesar"
                  >
                    <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      onClick={(e) => { e.stopPropagation(); clearFile(); }} 
                      style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#18181b', padding: '8px 14px', borderRadius: '8px', border: '1px solid #3f3f46', fontSize: '13px', color: '#e4e4e7' }}>
                    📄 {selectedFile.name} 
                    <button onClick={clearFile} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '14px', marginLeft: '4px' }}>✕</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', backgroundColor: '#18181b', borderRadius: '24px', border: '1px solid #27272a', padding: '8px 14px', alignItems: 'flex-end', gap: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, application/pdf" style={{ display: 'none' }} />
              
              <button 
                onClick={() => fileInputRef.current.click()} 
                style={{ background: '#27272a', border: 'none', color: '#a1a1aa', width: '34px', height: '34px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s', flexShrink: 0, marginBottom: '2px' }} 
                title="Unggah Gambar atau PDF"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
              >
                +
              </button>
              
              {/* TEXTAREA: ENTER KIRIM DI PC, ENTER TURUN BARIS DI HP */}
              <textarea 
                ref={textareaRef}
                value={input} 
                onChange={handleTextareaInput} 
                onPaste={handlePaste} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (isMobile) {
                      // Jika di HP, biarkan Enter murni turun baris (newline)
                      return;
                    } else {
                      // Jika di PC/Laptop, tekan Enter langsung kirim (kecuali tahan Shift)
                      if (!e.shiftKey) {
                        e.preventDefault();
                        if (!isLoading) sendMessage();
                      }
                    }
                  }
                }}
                rows={1}
                style={{ 
                  flex: 1, 
                  background: 'transparent', 
                  border: 'none', 
                  outline: 'none', 
                  color: '#fff', 
                  padding: '8px 0', 
                  fontSize: '15px', 
                  resize: 'none', 
                  fontFamily: 'system-ui, sans-serif', 
                  minWidth: '0',
                  maxHeight: '130px',
                  overflowY: 'auto',
                  lineHeight: '1.4'
                }} 
                placeholder="Tanyakan sesuatu pada Affandra..." 
              />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginBottom: '2px' }}>
                {isLoading ? (
                  <button 
                    onClick={stopGeneration}
                    style={{ 
                      width: '34px', height: '34px', borderRadius: '50%', 
                      backgroundColor: '#ef4444', color: '#fff', border: 'none', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      cursor: 'pointer', transition: '0.2s', fontSize: '12px', flexShrink: 0 
                    }}
                    title="Hentikan Respon"
                  >
                    ⏹
                  </button>
                ) : (
                  <button 
                    onClick={() => sendMessage()} 
                    disabled={!input.trim() && !selectedFile} 
                    style={{ 
                      width: '34px', height: '34px', borderRadius: '50%', 
                      cursor: (!input.trim() && !selectedFile) ? 'not-allowed' : 'pointer', 
                      backgroundColor: (!input.trim() && !selectedFile) ? '#27272a' : '#3b82f6', 
                      color: (!input.trim() && !selectedFile) ? '#71717a' : '#ffffff', 
                      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      transition: 'all 0.2s', flexShrink: 0,
                      boxShadow: (!input.trim() && !selectedFile) ? 'none' : '0 2px 10px rgba(59, 130, 246, 0.4)'
                    }}
                    title="Kirim"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"></line>
                      <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}