import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';
// Eliminamos la importación de formatHoursToHHMMSS si no la usamos aquí,
// ya que usaremos una función local para el cronómetro de sesión.

interface MensajeChat {
    id: number;
    usuarioNombre: string;
    contenido: string;
    nivelUsuario: number;
    rolUsuario: string;
}

// Definición correcta del estado del Modal
interface ModalState {
    isOpen: boolean;
    title: string;
    message: React.ReactNode; // Permite string o JSX
}

const StreamRoom = () => {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    
    const [streamInfo, setStreamInfo] = useState<any>(null);
    const [chat, setChat] = useState<MensajeChat[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [regalos, setRegalos] = useState<any[]>([]);
    
    // Estado del Modal con tipos corregidos
    const [modal, setModal] = useState<ModalState>({ 
        isOpen: false, 
        title: '', 
        message: '' 
    });
    
    const [streamEnded, setStreamEnded] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    
    // Timer de Sesión
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [sessionDuration, setSessionDuration] = useState(0); // En segundos

    const [configNivelesStreamer, setConfigNivelesStreamer] = useState<Record<string, number>>({});
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000); 
    
    const lastProcessedMsgId = useRef<number>(0);
    const lastEventTime = useRef<number>(Date.now()); 
    const chatEndRef = useRef<HTMLDivElement>(null);

    // 1. Carga Inicial
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
                        categoria: "General", 
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

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat]);

    // 2. CRONÓMETRO DE SESIÓN
    useEffect(() => {
        let interval: any;
        if (isStreaming && sessionStartTime) {
            interval = setInterval(() => {
                const now = Date.now();
                const diffSeconds = (now - sessionStartTime) / 1000;
                setSessionDuration(diffSeconds > 0 ? diffSeconds : 0);
            }, 1000);
        } else {
            setSessionDuration(0);
        }
        return () => clearInterval(interval);
    }, [isStreaming, sessionStartTime]);

    // 3. HEARTBEAT (10s)
    useEffect(() => {
        if (!id) return;
        const pulseInterval = setInterval(async () => {
            try {
                const status = await api.get(`/streams/status/${id}`);
                
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

                if (user?.rol === 'streamer' && Number(user.id) === Number(id) && isStreaming && currentStreamId) {
                    const pulseRes = await api.post('/streams/pulse', { userId: user.id, streamId: currentStreamId });
                    
                    if (pulseRes.subioNivel) {
                        setModal({ 
                            isOpen: true, 
                            title: '¡LEVEL UP STREAMER! 🎉', 
                            message: `¡Has subido al nivel ${pulseRes.nivel}!` 
                        });
                        setStreamInfo((prev:any) => ({...prev, nivel: pulseRes.nivel}));
                        await refreshUser();
                    }
                }
            } catch (e) { /* ignore */ }
        }, 10000); 
        return () => clearInterval(pulseInterval);
    }, [id, user, currentStreamId, isStreaming]);

    // 4. POLLINGS
    useEffect(() => {
        if (!currentStreamId) return;
        
        const fastInterval = setInterval(async () => {
            // Chat
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

            // Eventos Regalo (Overlay Streamer)
            if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
                try {
                    const eventos = await api.get(`/shop/eventos?userId=${user.id}&since=${lastEventTime.current}`);
                    if (eventos && eventos.length > 0) {
                        lastEventTime.current = new Date(eventos[eventos.length - 1].fecha).getTime();
                        
                        const ultimoRegalo = eventos[eventos.length - 1];
                        setModal({
                            isOpen: true,
                            title: '🎁 ¡REGALO RECIBIDO!',
                            message: (
                                <div>
                                    <p style={{fontSize: '1.2rem', marginBottom:'10px', color: 'white'}}>{ultimoRegalo.detalle}</p>
                                    <small className="text-neon">¡Sigue así!</small>
                                </div>
                            )
                        });
                    }
                } catch(e) { console.error(e); }
            }

        }, 3000); 
        
        return () => clearInterval(fastInterval);
    }, [currentStreamId, user, id]);

    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !mensaje.trim() || !currentStreamId) return;
        const msgContent = mensaje;
        setMensaje(""); 

        try {
            const resXp = await api.post('/user/chat-xp', { userId: user.id, streamerId: id });
            await refreshUser(); 
            if (resXp.subioNivel) {
                setModal({ isOpen: true, title: '¡NIVEL UP!', message: `¡Nivel ${resXp.nivel} alcanzado!` });
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
            setModal({ 
                isOpen: true, 
                title: '¡REGALO ENVIADO! 🚀', 
                message: `Has enviado ${regalo.nombre} exitosamente.` 
            });
            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: "SISTEMA",
                contenido: `¡${user.nombre} envió ${regalo.nombre} ${regalo.icono}!`,
                nivel: 0,
                rol: "sistema",
                streamId: currentStreamId
            });
            if (res.subioNivel) {
                setTimeout(() => setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `¡Felicidades! Ahora eres nivel ${res.nivel}.` }), 2000);
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
            await api.post('/streams/stop', { userId: user.id, streamId: currentStreamId });
            setIsStreaming(false);
            setCurrentStreamId(null);
            setSessionStartTime(null);
            setModal({ isOpen:true, title:'Stream Finalizado', message:'Live terminado.'});
            refreshUser();
        }
    };

    // Función local para formatear el tiempo de sesión
    const formatSessionTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    };

    const calcularProgreso = () => {
        if (!user) return { current: 0, target: 1000, percent: 0 };
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
        percent = Math.max(0, Math.min(100, percent));
        return { current: user.puntosXP, target: targetXp, percent };
    };

    const progressData = calcularProgreso();

    if (!streamInfo) return <div className="text-center mt-40">Cargando sala...</div>;

    return (
        <div className="stream-room-layout">
            <MiModal isOpen={modal.isOpen} onClose={()=>setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message}/>
            
            <div className="video-column">
                <div className="video-player-container">
                    {streamEnded ? (
                        <div style={{textAlign:'center'}}>
                            <h1 className="text-muted" style={{fontSize:'3rem'}}>OFFLINE 💤</h1>
                            <button onClick={()=>navigate('/')} className="btn-regresar mt-20">Salir</button>
                        </div>
                    ) : (
                        <div style={{textAlign: 'center', width: '100%'}}>
                            <h1 className="text-neon" style={{fontSize:'3rem'}}>{isStreaming ? "EN VIVO 🔴" : "ESPERANDO..."}</h1>
                            {/* CRONÓMETRO DE SESIÓN */}
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
                        <p className="text-muted text-small">{streamInfo.usuario} • Nivel {streamInfo.nivel}</p>
                    </div>
                    {user?.rol === 'streamer' && Number(user.id) === Number(id) && (
                        <button onClick={toggleStream} className={isStreaming ? "btn-delete" : "btn-neon"}>
                            {isStreaming ? "TERMINAR" : "INICIAR"}
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