import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus.js';
import { supabase } from './supabaseClient';

export default function AIChat({ user }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [input, setInput] = useState('');
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); 
  
  // STATE UNTUK ZOOM FOTO (LIGHTBOX)
  const [modalImg, setModalImg] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [remainingLimit, setRemainingLimit] = useState('-');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredSessionId, setHoveredSessionId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // STATE UNTUK RESPONSIF MOBILE (SIDEBAR DRAWER)
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
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
        const response = await fetch(`http://affandra-backend-q8xn5128w-affandra.vercel.app/api/sessions?userId=${user.id}`);
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
        const response = await fetch(`http://affandra-backend-q8xn5128w-affandra.vercel.app/api/sessions/${activeSessionId}/messages`);
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
        await fetch(`http://affandra-backend-q8xn5128w-affandra.vercel.app/api/sessions/${id}`, {
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
        await fetch(`http://affandra-backend-q8xn5128w-affandra.vercel.app/api/sessions/${id}`, { method: 'DELETE' });
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
    setIsLoading(true);

    const formData = new FormData();
    formData.append('userId', user.id);
    formData.append('message', messageText);
    formData.append('history', JSON.stringify(currentMessages));
    formData.append('sessionId', activeSessionId.toString());
    formData.append('sessionTitle', sessionTitle);

    if (currentFile) {
      formData.append('file', currentFile);
    }

    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      const response = await fetch('http://affandra-backend-q8xn5128w-affandra.vercel.app/api/chat', {
        method: 'POST',
        body: formData 
      });

      const data = await response.json();
      const aiReply = response.ok ? data.reply : `⚠️ Error: ${data.error}`;

      if (data.limit) {
        setRemainingLimit(data.limit);
      }

      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...newMessages, { role: 'model', parts: [{ text: aiReply }] }] } : s
      ));
    } catch (error) {
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...newMessages, { role: 'model', parts: [{ text: "⚠️ Gagal terhubung ke server backend." }] }] } : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden', backgroundColor: '#121212', color: '#E0E0E0', fontFamily: 'system-ui, sans-serif', position: 'relative' }}>
      
      {/* MODAL LIGHTBOX UNTUK ZOOM FOTO */}
      {modalImg && (
        <div 
          onClick={() => setModalImg(null)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh',
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={modalImg} alt="Zoomed" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }} />
            <button 
              onClick={() => setModalImg(null)}
              style={{
                position: 'absolute', top: '-15px', right: '-15px', background: '#333', color: '#fff',
                border: '1px solid #555', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
                fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
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
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999 }}
        />
      )}

      {/* SIDEBAR */}
      <div style={{ 
        width: '280px', 
        backgroundColor: '#1A1A1A', 
        padding: '16px', 
        display: isMobile ? (isMobileSidebarOpen ? 'flex' : 'none') : 'flex', 
        flexDirection: 'column', 
        borderRight: '1px solid #2A2A2A', 
        boxSizing: 'border-box',
        position: isMobile ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        height: '100dvh',
        zIndex: 1000,
        boxShadow: isMobile ? '4px 0 20px rgba(0,0,0,0.5)' : 'none'
      }}>
        
        {/* Tombol Tutup Sidebar Khusus Mobile */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '18px', cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Tombol New Chat */}
        <button onClick={createNewChat} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', backgroundColor: '#2A2A2A', color: '#fff', border: '1px solid #444', cursor: 'pointer', fontWeight: 'bold' }}>
          ➕ New Chat
        </button>

        {/* Daftar Riwayat Chat */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', marginBottom: '8px' }}>RIWAYAT CHAT</div>
          
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
                borderRadius: '6px', 
                cursor: 'pointer', 
                backgroundColor: session.id === activeSessionId ? '#2A2A2A' : 'transparent', 
                color: session.id === activeSessionId ? '#fff' : '#aaa', 
                fontSize: '14px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                transition: 'background 0.2s'
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
                  style={{ width: '100%', background: '#121212', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '4px' }}
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '16px', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                >
                  ⋮
                </button>
              )}

              {menuOpenId === session.id && (
                <div style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  top: '36px', 
                  backgroundColor: '#333', 
                  borderRadius: '6px', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)', 
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  width: '120px'
                }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(session.id);
                      setEditTitle(session.title);
                      setMenuOpenId(null);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#fff', padding: '10px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #444' }}
                  >
                    ✏️ Rename
                  </button>
                  <button 
                    onClick={(e) => deleteSession(session.id, e)}
                    style={{ background: 'transparent', border: 'none', color: '#ff4444', padding: '10px', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}
                  >
                    🗑️ Hapus
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* PROFIL & TOMBOL LOGOUT DI BAWAH SIDEBAR */}
        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={user?.email}>
            👤 {user?.email || 'Pengguna'}
          </div>
          <button 
            onClick={() => supabase.auth.signOut()} 
            style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', padding: '4px 8px' }}
            title="Keluar Akun"
          >
            Logout
          </button>
        </div>

      </div>

      {/* MAIN CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', overflow: 'hidden' }}>
        
        {/* HEADER */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1A1A1A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '80px' }}>
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
          
          <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', color: '#f3ece5', fontSize: '20px', fontWeight: 'normal', textAlign: 'center' }}>Affandra</h2>
          
          <div style={{ minWidth: '80px', textAlign: 'right', fontSize: '11px', color: '#888', fontWeight: 'bold' }}>
            ⚡ Sisa: {remainingLimit}
          </div>
        </div>

        {/* MESSAGES LIST */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
          <div style={{ width: '100%', maxWidth: '680px' }}>
            {(!activeSession?.messages || activeSession.messages.length === 0) && (
              <div style={{ textAlign: 'center', color: '#555', marginTop: '15vh', fontSize: '14px', padding: '0 20px' }}>Ketik sesuatu atau unggah file untuk memulai...</div>
            )}
            
            {(activeSession?.messages || []).map((msg, index) => {
              const textContent = msg.parts?.[0]?.text || '';
              
              return (
                <div key={index} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '20px', width: '100%' }}>
                  <div style={{ 
                    background: msg.role === 'user' ? '#2A2A2A' : 'transparent', 
                    color: '#E0E0E0', 
                    padding: msg.role === 'user' ? '10px 16px' : '4px', 
                    borderRadius: '16px', 
                    maxWidth: '100%', 
                    width: msg.role === 'model' ? '100%' : 'auto',
                    fontSize: '15px', 
                    lineHeight: '1.6', 
                    wordBreak: 'break-word', 
                    overflowWrap: 'anywhere' 
                  }}>
                    {msg.role === 'user' ? (
                      <div>
                        {msg.imageUrl && (
                          <div 
                            onClick={() => setModalImg(msg.imageUrl)}
                            style={{ marginBottom: '8px', borderRadius: '8px', overflow: 'hidden', maxWidth: '220px', border: '1px solid #444', cursor: 'zoom-in' }}
                            title="Klik untuk memperbesar foto"
                          >
                            <img src={msg.imageUrl} alt="Uploaded preview" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                          </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap' }}>{textContent}</div>
                      </div>
                    ) : (
                      <ReactMarkdown
                        components={{
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <div style={{ margin: '16px 0', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', backgroundColor: '#1E1E1E' }}>
                                <div style={{ backgroundColor: '#252525', padding: '8px 16px', fontSize: '12px', color: '#aaa', borderBottom: '1px solid #333', fontWeight: 'bold' }}>
                                  {match[1].toUpperCase()}
                                </div>
                                <SyntaxHighlighter
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  customStyle={{ margin: 0, padding: '16px', backgroundColor: '#161616', fontSize: '14px' }}
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code style={{ backgroundColor: '#2a2a2a', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#ff79c6' }} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {textContent}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && <div style={{ color: '#666', fontSize: '14px', fontStyle: 'italic', marginBottom: '24px' }}>Affandra sedang berpikir...</div>}
            <div ref={messagesEndRef} /> 
          </div>
        </div>

        {/* INPUT AREA (MODERN ROUNDED CAPSULE STYLE DENGAN SAFE AREA) */}
        <div style={{ 
          padding: '16px 20px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          backgroundColor: '#121212',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'
        }}>
          <div style={{ width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {selectedFile && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                {previewUrl ? (
                  <div 
                    onClick={() => setModalImg(previewUrl)}
                    style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '12px', border: '2px solid #333', overflow: 'hidden', backgroundColor: '#1E1E1E', cursor: 'zoom-in' }}
                    title="Klik untuk memperbesar"
                  >
                    <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      onClick={(e) => { e.stopPropagation(); clearFile(); }} 
                      style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1E1E1E', padding: '8px 14px', borderRadius: '8px', border: '1px solid #333', fontSize: '13px', color: '#E0E0E0' }}>
                    📄 {selectedFile.name} 
                    <button onClick={clearFile} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '14px', marginLeft: '4px' }}>✕</button>
                  </div>
                )}
              </div>
            )}

            {/* Input Box Melengkung Modern */}
            <div style={{ display: 'flex', backgroundColor: '#1E1E1E', borderRadius: '24px', border: '1px solid #333', padding: '8px 14px', alignItems: 'center', gap: '8px' }}>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, application/pdf" style={{ display: 'none' }} />
              
              {/* Tombol Plus (+) */}
              <button 
                onClick={() => fileInputRef.current.click()} 
                style={{ background: '#2A2A2A', border: 'none', color: '#aaa', width: '32px', height: '32px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s', flexShrink: 0 }} 
                title="Unggah Gambar atau PDF"
              >
                +
              </button>
              
              {/* Textarea */}
              <textarea 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onPaste={handlePaste} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', padding: '8px', fontSize: '15px', resize: 'none', fontFamily: 'system-ui, sans-serif', minWidth: '0' }} 
                placeholder="Tanyakan sesuatu..." 
              />
              
              {/* Bagian Kanan: Label Model, Mikrofon, dan Tombol Kirim */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {!isMobile && (
                  <span style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
                    Flash-Lite Mendalam ▾
                  </span>
                )}

                <button style={{ background: 'none', border: 'none', color: '#888', fontSize: '16px', cursor: 'pointer', padding: '4px' }} title="Input Suara">
                  🎤
                </button>

                <button 
                  onClick={() => sendMessage()} 
                  disabled={isLoading || (!input.trim() && !selectedFile)} 
                  style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', 
                    cursor: (isLoading || (!input.trim() && !selectedFile)) ? 'not-allowed' : 'pointer', 
                    backgroundColor: (isLoading || (!input.trim() && !selectedFile)) ? '#333' : '#3B82F6', 
                    color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', transition: '0.2s', flexShrink: 0
                  }}
                  title="Kirim"
                >
                  ↑
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}