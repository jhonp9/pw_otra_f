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

// Componente Interno para el Overlay de Regalos (Animado)
const GiftOverlay = ({ data }: { data: any }) => {
    if (!data) return null;
    return (
        <div className="gift-overlay-animation">
            <div style={{ fontSize: '4rem', marginBottom: '10px', filter: 'drop-shadow(0 0 10px #00ff41)' }}>
                🎁
            </div>
            <h2 className="text-neon" style={{ margin: 0, fontSize: '2rem' }}>¡NUEVO REGALO!</h2>
            <p className="text-white" style={{ fontSize: '1.2rem', marginTop: '10px', fontWeight: 'bold' }}>
                {data.detalle}
            </p>
        </div>
    );
};

// Componente Interno para Overlay de Nivel (Streamer)
const LevelUpOverlay = ({ nivel }: { nivel: number }) => {
    if (!nivel) return null;
    return (
        <div className="gift-overlay-animation" style={{ borderColor: '#ff0055', boxShadow: '0 0 50px #ff0055' }}>
            <div style={{ fontSize: '4rem', marginBottom: '10px' }}>🚀</div>
            <h2 style={{ color: '#ff0055', margin: 0, fontSize: '2rem' }}>¡SUBISTE DE NIVEL!</h2>
            <p className="text-white" style={{ fontSize: '1.2rem', marginTop: '10px' }}>
                Ahora eres Streamer <strong>Nivel {nivel}</strong>
            </p>
            <small className="text-muted">Gracias a tu tiempo total de transmisión.</small>
        </div>
    );
};

const StreamRoom = () => {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    
    const [streamInfo, setStreamInfo] = useState<any>(null);
    const [chat, setChat] = useState<MensajeChat[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [regalos, setRegalos] = useState<any[]>([]);
    
    // Modales estándar (para errores o avisos simples)
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    
    // Overlays Animados (Estados temporales)
    const [activeGift, setActiveGift] = useState<any>(null);
    const [activeLevelUp, setActiveLevelUp] = useState<number | null>(null);

    const [streamEnded, setStreamEnded] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    
    // Timer Visual
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [sessionDuration, setSessionDuration] = useState(0); 

    // Configuración de niveles del streamer dueño del canal
    const [configNivelesStreamer, setConfigNivelesStreamer] = useState<Record<string, number>>({});
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000); 
    
    const lastProcessedMsgId = useRef<number>(0);
    const lastGiftId = useRef<number>(0); 
    const chatEndRef = useRef<HTMLDivElement>(null);

    // 1. Carga Inicial de Datos
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

    // Scroll chat automático
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat]);

    // 2. Cronómetro Visual (Solo visual, no afecta lógica de niveles)
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

    // 3. HEARTBEAT (Cada 10s) - Maneja el Nivel del Streamer (Tiempo Total)
    useEffect(() => {
        if (!id) return;
        const pulseInterval = setInterval(async () => {
            try {
                const status = await api.get(`/streams/status/${id}`);
                
                // Detectar cambios de estado del stream
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

                // SI SOY EL STREAMER: Enviar pulso para sumar tiempo total
                if (user?.rol === 'streamer' && Number(user.id) === Number(id) && isStreaming && currentStreamId) {
                    const pulseRes = await api.post('/streams/pulse', { userId: user.id, streamId: currentStreamId });
                    
                    // Si el backend confirma que subimos de nivel (calculado con tiempo total)
                    if (pulseRes.subioNivel) {
                        // Disparamos Overlay de Nivel
                        setActiveLevelUp(pulseRes.nivel);
                        setStreamInfo((prev:any) => ({...prev, nivel: pulseRes.nivel}));
                        await refreshUser(); 
                        // Ocultar overlay después de 6 segundos
                        setTimeout(() => setActiveLevelUp(null), 6000);
                    }
                }
            } catch (e) { /* ignore */ }
        }, 10000); 
        return () => clearInterval(pulseInterval);
    }, [id, user, currentStreamId, isStreaming]);

    // 4. POLLINGS RÁPIDOS (Chat y Regalos) - Cada 3s
    useEffect(() => {
        if (!currentStreamId) return;
        
        const fastInterval = setInterval(async () => {
            // A. Chat
            try {
                const msgs: MensajeChat[] = await api.get(`/chat/${currentStreamId}`);
                if (lastProcessedMsgId.current === 0 && msgs.length > 0) {
                    // Carga inicial, no notificar todo
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

            // B. Eventos Regalo (Solo para el Streamer dueño del canal)
            if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
                try {
                    // Consulta eventos nuevos (ID mayor al último visto)
                    const eventos = await api.get(`/shop/eventos?userId=${user.id}&lastId=${lastGiftId.current}`);
                    
                    if (eventos && eventos.length > 0) {
                        // Actualizamos cursor
                        lastGiftId.current = eventos[eventos.length - 1].id;
                        
                        // Tomamos el último regalo para mostrar
                        const ultimoRegalo = eventos[eventos.length - 1];
                        
                        // Disparamos el Overlay Animado
                        setActiveGift(ultimoRegalo);
                        // Ocultar automáticamente tras 5 segundos
                        setTimeout(() => setActiveGift(null), 5000);
                    }
                } catch(e) { console.error(e); }
            }

        }, 3000); 
        
        return () => clearInterval(fastInterval);
    }, [currentStreamId, user, id]);

    // --- MANEJADORES DE INTERACCIÓN ---

    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !mensaje.trim() || !currentStreamId) return;
        const msgContent = mensaje;
        setMensaje(""); 

        try {
            const resXp = await api.post('/user/chat-xp', { userId: user.id, streamerId: id });
            await refreshUser(); // Actualizar mis puntos locales
            
            // Si el espectador sube de nivel, le avisamos con un modal simple
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
            // Mensaje en chat para que todos lo vean
            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: "SISTEMA",
                contenido: `¡${user.nombre} envió ${regalo.nombre} ${regalo.icono}!`,
                nivel: 0,
                rol: "sistema",
                streamId: currentStreamId
            });
            // Feedback local al espectador
            if (res.subioNivel) {
                setModal({ isOpen: true, title: '¡REGALO ENVIADO & LEVEL UP!', message: `Envío exitoso. ¡Subiste al nivel ${res.nivel}!` });
            } else {
                // Pequeña notificación visual temporal podría ser mejor, pero usamos modal por consistencia
                setModal({ isOpen: true, title: 'Regalo Enviado', message: `Has apoyado al streamer con ${regalo.nombre}` });
            }
        } else {
            setModal({ isOpen: true, title: 'Error', message: res.msg || 'No tienes suficientes monedas' });
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
            await api.post('/streams/stop', { userId: user.id, streamId: currentStreamId });
            setIsStreaming(false);
            setCurrentStreamId(null);
            setSessionStartTime(null);
            await refreshUser();
        }
    };

    const formatSessionTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    };

    // Cálculo visual de progreso para espectador
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
            {/* OVERLAYS ANIMADOS (Prioridad Visual) */}
            {activeGift && <GiftOverlay data={activeGift} />}
            {activeLevelUp && <LevelUpOverlay nivel={activeLevelUp} />}

            {/* Modal Estándar (Alertas) */}
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