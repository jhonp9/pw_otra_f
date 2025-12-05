import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';

interface MensajeChat {
    id: number;
    usuarioNombre: string;
    contenido: string;
    nivelUsuario: number;
    rolUsuario: string;
}

// --- COMPONENTES OVERLAY (ESTILOS INLINE PARA EFECTOS VISUALES) ---

const GiftOverlay = ({ data }: { data: any }) => {
    if (!data) return null;
    return (
        <div className="gift-overlay-animation">
            <div style={{ fontSize: '5rem', marginBottom: '10px', filter: 'drop-shadow(0 0 20px gold)' }}>
                🎁
            </div>
            <h2 className="text-neon" style={{ margin: 0, fontSize: '2.5rem', textTransform: 'uppercase' }}>
                ¡NUEVO REGALO!
            </h2>
            <div style={{background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '10px', marginTop: '15px'}}>
                <p className="text-white" style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                    {data.detalle}
                </p>
            </div>
        </div>
    );
};

const LevelUpOverlay = ({ nivel }: { nivel: number }) => {
    if (!nivel) return null;
    return (
        <div className="gift-overlay-animation" style={{ borderColor: '#ff0055', boxShadow: '0 0 50px #ff0055' }}>
            <div style={{ fontSize: '5rem', marginBottom: '10px' }}>🚀</div>
            <h2 style={{ color: '#ff0055', margin: 0, fontSize: '2.5rem' }}>¡SUBISTE DE NIVEL!</h2>
            <p className="text-white" style={{ fontSize: '1.5rem', marginTop: '10px' }}>
                Ahora eres Streamer <strong>Nivel {nivel}</strong>
            </p>
            <small className="text-muted">¡Tu constancia tiene recompensa!</small>
        </div>
    );
};

// ------------------------------------------------------------------

const StreamRoom = () => {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    
    const [streamInfo, setStreamInfo] = useState<any>(null);
    const [chat, setChat] = useState<MensajeChat[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [regalos, setRegalos] = useState<any[]>([]);
    
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    
    // --- ESTADOS PARA OVERLAYS ---
    const [activeGift, setActiveGift] = useState<any>(null);
    const [activeLevelUp, setActiveLevelUp] = useState<number | null>(null);

    const [streamEnded, setStreamEnded] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [sessionDuration, setSessionDuration] = useState(0); 

    const [configNivelesStreamer, setConfigNivelesStreamer] = useState<Record<string, number>>({});
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000); 
    
    const lastProcessedMsgId = useRef<number>(0);
    const lastGiftId = useRef<number>(0); // Para no repetir alertas de regalos viejos
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Carga inicial
    useEffect(() => {
        const fetchDatos = async () => {
            if (id) {
                try {
                    const streamerData = await api.get(`/user/${id}`);
                    setMetaXpStreamer(streamerData.metaXp || 1000);
                    try {
                        const config = streamerData.configNiveles ? JSON.parse(streamerData.configNiveles) : {};
                        setConfigNivelesStreamer(config);
                    } catch (e) { setConfigNivelesStreamer({}); }

                    setStreamInfo({ 
                        id, 
                        titulo: `Canal de ${streamerData.nombre}`, 
                        usuario: streamerData.nombre, 
                        nivel: streamerData.nivelStreamer 
                    });
                    
                    const regalosData = await api.get('/shop/regalos');
                    setRegalos(regalosData);
                    
                    const status = await api.get(`/streams/status/${id}`);
                    if (status.isLive) {
                        setIsStreaming(true);
                        setCurrentStreamId(status.streamId);
                        if(status.inicio) setSessionStartTime(new Date(status.inicio).getTime());
                    } else if (user && Number(user.id) !== Number(id)) {
                        setStreamEnded(true);
                    }
                } catch (e) { console.error("Error cargando sala"); }
            }
        };
        fetchDatos();
    }, [id, user]);

    // Scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat]);

    // Timer Visual
    useEffect(() => {
        let interval: any;
        if (isStreaming && sessionStartTime) {
            interval = setInterval(() => {
                const now = Date.now();
                setSessionDuration((now - sessionStartTime) / 1000);
            }, 1000);
        } else {
            setSessionDuration(0);
        }
        return () => clearInterval(interval);
    }, [isStreaming, sessionStartTime]);

    // --- HEARTBEAT & NIVEL (CADA 5 SEGUNDOS) ---
    useEffect(() => {
        if (!id) return;
        const pulseInterval = setInterval(async () => {
            try {
                const status = await api.get(`/streams/status/${id}`);
                
                // Manejo de estado del stream (Offline/Online)
                if (status.isLive && status.streamId !== currentStreamId) {
                    setChat([]); 
                    setCurrentStreamId(status.streamId);
                    setIsStreaming(true);
                    setStreamEnded(false);
                    if(status.inicio) setSessionStartTime(new Date(status.inicio).getTime());
                    lastProcessedMsgId.current = 0;
                } else if (!status.isLive && isStreaming) {
                    setIsStreaming(false);
                    setStreamEnded(true);
                    setCurrentStreamId(null);
                    setSessionStartTime(null);
                }

                // SI SOY EL STREAMER: Enviar pulso
                if (user?.rol === 'streamer' && Number(user.id) === Number(id) && isStreaming && currentStreamId) {
                    const pulseRes = await api.post('/streams/pulse', { userId: user.id, streamId: currentStreamId });
                    
                    // REQUERIMIENTO: DETECCIÓN DE NIVEL EN VIVO (ACUMULADO)
                    if (pulseRes.subioNivel) {
                        setActiveLevelUp(pulseRes.nivel); // Mostrar Overlay
                        setStreamInfo((prev:any) => ({...prev, nivel: pulseRes.nivel})); // Actualizar UI Info
                        await refreshUser(); 
                        setTimeout(() => setActiveLevelUp(null), 6000); // Ocultar tras 6s
                    }
                }
            } catch (e) { /* ignore */ }
        }, 5000); 
        
        return () => clearInterval(pulseInterval);
    }, [id, user, currentStreamId, isStreaming]);

    // --- POLLINGS RÁPIDOS (CHAT & REGALOS) - CADA 3 SEGUNDOS ---
    useEffect(() => {
        if (!currentStreamId) return;
        
        const fastInterval = setInterval(async () => {
            // 1. Chat Polling (Igual que antes)
            try {
                const msgs: MensajeChat[] = await api.get(`/chat/${currentStreamId}`);
                if (lastProcessedMsgId.current === 0 && msgs.length > 0) {
                    lastProcessedMsgId.current = msgs[msgs.length - 1].id;
                    setChat(msgs);
                } else {
                    const nuevos = msgs.filter(m => m.id > lastProcessedMsgId.current);
                    if (nuevos.length > 0) {
                        setChat(msgs);
                        lastProcessedMsgId.current = msgs[msgs.length - 1].id;
                    }
                }
            } catch (e) { /* ignore */ }

            // 2. REQUERIMIENTO: Overlay de Regalos (Solo si soy el Streamer)
            if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
                try {
                    const eventos = await api.get(`/shop/eventos?userId=${user.id}&lastId=${lastGiftId.current}`);
                    
                    if (eventos && eventos.length > 0) {
                        const nuevoUltimoId = eventos[eventos.length - 1].id;

                        // CORRECCIÓN: Si lastGiftId es 0 (primera carga), NO mostramos overlay, 
                        // solo actualizamos el puntero para esperar al SIGUIENTE regalo real.
                        if (lastGiftId.current === 0) {
                            lastGiftId.current = nuevoUltimoId;
                        } else {
                            // Si ya estábamos sincronizados y llega uno nuevo, mostramos overlay
                            lastGiftId.current = nuevoUltimoId;
                            const ultimoRegalo = eventos[eventos.length - 1];
                            setActiveGift(ultimoRegalo);
                            
                            // Ocultar Overlay después de 5 segundos
                            setTimeout(() => setActiveGift(null), 5000);
                        }
                    }
                } catch(e) { console.error(e); }
            }

        }, 3000); 
        
        return () => clearInterval(fastInterval);
    }, [currentStreamId, user, id]);

    // ... (El resto de funciones: handleChat, handleEnviarRegalo, toggleStream se mantienen igual)
    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !mensaje.trim() || !currentStreamId) return;
        const msgContent = mensaje;
        setMensaje(""); 

        try {
            const resXp = await api.post('/user/chat-xp', { userId: user.id, streamerId: id });
            await refreshUser(); 
            if (resXp.subioNivel) {
                setModal({ isOpen: true, title: '¡NIVEL UP!', message: `¡Felicidades! Has alcanzado el Nivel ${resXp.nivel} de espectador.` });
            }
            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: user.nombre,
                contenido: msgContent,
                nivel: resXp.nivel || user.nivelEspectador, 
                rol: user.rol,
                streamId: currentStreamId
            });
        } catch (error) { console.error("Error chat", error); }
    };

    const handleEnviarRegalo = async (regalo: any) => {
        if (!user || !currentStreamId) return;
        const res = await api.post('/shop/enviar', { 
            viewerId: user.id, 
            regaloId: regalo.id,
            streamerId: id 
        });
        
        if (res.success) {
            await refreshUser();
            // Enviamos mensaje al chat para que todos lo vean
            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: "SISTEMA",
                contenido: `¡${user.nombre} envió ${regalo.nombre} ${regalo.icono}!`,
                nivel: 0,
                rol: "sistema",
                streamId: currentStreamId
            });
            if (res.subioNivel) {
                setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `¡Felicidades! Ahora eres nivel ${res.nivel}.` });
            }
        } else {
            setModal({ isOpen: true, title: 'Error', message: res.msg || 'Saldo insuficiente' });
        }
    };

    const toggleStream = async () => {
        if (!user || user.rol !== 'streamer') return;
        if (!isStreaming) {
            const res = await api.post('/streams/start', { userId: user.id, titulo: streamInfo.titulo });
            setChat([]); 
            setCurrentStreamId(res.streamId);
            setIsStreaming(true);
            setStreamEnded(false);
            setSessionStartTime(Date.now()); 
            lastProcessedMsgId.current = 0; 
        } else {
            const stopRes = await api.post('/streams/stop', { userId: user.id, streamId: currentStreamId });
            setIsStreaming(false);
            setCurrentStreamId(null);
            setSessionStartTime(null);
            
            if (stopRes.subioNivel) {
                setModal({ isOpen:true, title:'¡SUBISTE DE NIVEL!', message: `Felicidades, terminaste tu transmisión siendo Nivel ${stopRes.nivel}.`});
            } else {
                setModal({ isOpen:true, title:'Stream Finalizado', message:'Transmisión terminada correctamente.'});
            }
            refreshUser();
        }
    };

    const formatSessionTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    };

    const calcularProgreso = () => {
        if (!user) return { percent: 0, target: 1000 };
        const currentLvl = user.nivelEspectador;
        const nextLvl = currentLvl + 1;
        let targetXp = configNivelesStreamer[nextLvl.toString()];
        if (!targetXp) {
            targetXp = currentLvl * metaXpStreamer;
            if (user.puntosXP >= targetXp) targetXp = user.puntosXP + metaXpStreamer;
        }
        const prevTargetXp = configNivelesStreamer[currentLvl.toString()] || ((currentLvl - 1) * metaXpStreamer);
        const totalLevelRange = targetXp - prevTargetXp;
        const currentLevelProgress = user.puntosXP - prevTargetXp;
        let percent = (currentLevelProgress / totalLevelRange) * 100;
        return { current: user.puntosXP, target: targetXp, percent: Math.max(0, Math.min(100, percent)) };
    };

    const progressData = calcularProgreso();

    if (!streamInfo) return <div className="text-center mt-40">Cargando sala...</div>;

    return (
        <div className="stream-room-layout">
            {/* --- REQUERIMIENTO: OVERLAYS ANIMADOS --- */}
            {activeGift && <GiftOverlay data={activeGift} />}
            {activeLevelUp && <LevelUpOverlay nivel={activeLevelUp} />}

            <MiModal isOpen={modal.isOpen} onClose={()=>setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message}/>
            
            <div className="video-column">
                <div className="video-player-container">
                    {streamEnded ? (
                        <div className="text-center">
                            <h1 className="text-muted" style={{fontSize:'3rem'}}>OFFLINE 💤</h1>
                            <button onClick={()=>navigate('/')} className="btn-regresar mt-20">Salir</button>
                        </div>
                    ) : (
                        <div style={{textAlign: 'center', width: '100%'}}>
                            <h1 className="text-neon" style={{fontSize:'3rem'}}>{isStreaming ? "EN VIVO 🔴" : "ESPERANDO..."}</h1>
                            {isStreaming && (
                                <h2 style={{fontFamily: 'monospace', fontSize: '2.5rem', marginTop: '10px', color: 'white'}}>
                                    ⏱ {formatSessionTime(sessionDuration)}
                                </h2>
                            )}
                        </div>
                    )}
                </div>
                <div className="stream-info-bar">
                    <div>
                        <h3 style={{margin:0}}>{streamInfo.titulo}</h3>
                        <p className="text-muted text-small">{streamInfo.usuario} • Nivel Streamer: {streamInfo.nivel}</p>
                    </div>
                    {user?.rol === 'streamer' && Number(user.id) === Number(id) && (
                        <button onClick={toggleStream} className={isStreaming ? "btn-delete" : "btn-neon"}>
                            {isStreaming ? "TERMINAR TRANSMISIÓN" : "INICIAR TRANSMISIÓN"}
                        </button>
                    )}
                </div>
            </div>

            <div className="chat-column">
                {user && user.rol === 'espectador' && (
                    <div style={{padding: '15px', background: '#111', borderBottom: '1px solid #333'}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', marginBottom:'5px'}}>
                            <span className="text-neon bold">Nivel {user.nivelEspectador}</span>
                            <span className="text-muted">{user.puntosXP} / {progressData.target} XP</span>
                        </div>
                        <div style={{width:'100%', height:'8px', background:'#333', borderRadius:'4px', overflow:'hidden'}}>
                            <div style={{width:`${progressData.percent}%`, height:'100%', background:'var(--neon)', transition:'width 0.5s'}}></div>
                        </div>
                    </div>
                )}

                <div className="chat-messages">
                    {chat.map((c, i) => (
                        <div key={i} className="chat-msg">
                            {c.rolUsuario === 'sistema' ? (
                                <div style={{color:'var(--neon)', textAlign:'center', fontSize:'0.8rem', margin:'5px 0', border:'1px dashed #333', padding:'5px'}}>{c.contenido}</div>
                            ) : (
                                <span>
                                    {c.nivelUsuario > 0 && <span style={{background:'#333', padding:'2px 4px', borderRadius:'3px', fontSize:'0.7rem', marginRight:'5px'}}>Lvl {c.nivelUsuario}</span>}
                                    <strong style={{color: c.rolUsuario==='streamer'?'var(--neon)':'white'}}>{c.usuarioNombre}:</strong> {c.contenido}
                                </span>
                            )}
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
                
                <div className="chat-input-area">
                    <form onSubmit={handleChat} style={{display:'flex', gap:'5px'}}>
                        <input value={mensaje} onChange={e=>setMensaje(e.target.value)} className="chat-input" placeholder="Enviar mensaje..." disabled={!isStreaming}/>
                        <button className="btn-chat">➤</button>
                    </form>
                </div>
                
                {user?.rol === 'espectador' && isStreaming && (
                    <div className="gifts-panel">
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                             <span className="text-small">Tu saldo: <span className="text-neon">{user.monedas} 💰</span></span>
                        </div>
                        <div className="gift-grid-compact"> 
                            {regalos.map(r => (
                                <button key={r.id} onClick={()=>handleEnviarRegalo(r)} className="gift-btn-compact" disabled={user.monedas < r.costo}>
                                    <div style={{fontSize:'1.5rem'}}>{r.icono}</div>
                                    <div style={{fontSize:'0.7rem', fontWeight:'bold', marginTop:'2px'}}>{r.nombre}</div>
                                    <div style={{fontSize:'0.6rem', color:'var(--neon)'}}>{r.costo} 💰</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default StreamRoom;