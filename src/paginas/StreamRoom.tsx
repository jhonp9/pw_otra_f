// jhonp9/pw_otra_f/pw_otra_f-9f1b6a4baa37b2bcf11c6cd1b39d10e8ab587935/src/paginas/StreamRoom.tsx
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

interface ModalState {
    isOpen: boolean;
    title: string;
    message: React.ReactNode; 
}

const StreamRoom = () => {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    
    const [streamInfo, setStreamInfo] = useState<any>(null);
    const [chat, setChat] = useState<MensajeChat[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [regalos, setRegalos] = useState<any[]>([]);
    
    const [modal, setModal] = useState<ModalState>({ 
        isOpen: false, 
        title: '', 
        message: '' 
    });
    
    const [streamEnded, setStreamEnded] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    
    // Timer de Sesión (Visual)
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [sessionDuration, setSessionDuration] = useState(0); 

    const [configNivelesStreamer, setConfigNivelesStreamer] = useState<Record<string, number>>({});
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000); 
    
    const lastProcessedMsgId = useRef<number>(0);
    // CAMBIO: Usamos lastGiftId para rastrear regalos por ID, mucho más seguro que por tiempo
    const lastGiftId = useRef<number>(0); 
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
                        nivel: streamerData.nivelStreamer // Nivel inicial desde DB
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

    // 3. HEARTBEAT (10s) - LÓGICA DE NIVEL CORREGIDA
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

                // Si soy el streamer dueño del canal
                if (user?.rol === 'streamer' && Number(user.id) === Number(id) && isStreaming && currentStreamId) {
                    const pulseRes = await api.post('/streams/pulse', { userId: user.id, streamId: currentStreamId });
                    
                    // LÓGICA DE NIVEL BASADA EN TOTAL:
                    // pulseRes.nivel viene del backend calculado con user.horasStream (Total acumulado)
                    // Si el nivel que dice el backend es mayor al que tenemos en pantalla, avisamos.
                    if (streamInfo && pulseRes.nivel > streamInfo.nivel) {
                        setModal({ 
                            isOpen: true, 
                            title: '¡SUBISTE DE NIVEL! 🎉', 
                            message: `¡Increíble! Gracias a tu tiempo total de transmisión, ahora eres Nivel ${pulseRes.nivel}.` 
                        });
                        // Actualizamos el estado local inmediatamente
                        setStreamInfo((prev:any) => ({...prev, nivel: pulseRes.nivel}));
                        await refreshUser(); // Actualizamos contexto global
                    }
                }
            } catch (e) { /* ignore */ }
        }, 10000); 
        return () => clearInterval(pulseInterval);
    }, [id, user, currentStreamId, isStreaming, streamInfo]); // Agregamos streamInfo a dependencias para comparar nivel

    // 4. POLLINGS (CHAT y OVERLAY DE REGALOS)
    useEffect(() => {
        if (!currentStreamId) return;
        
        const fastInterval = setInterval(async () => {
            // A. Chat
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

            // B. Eventos Regalo (Overlay Streamer) - CORREGIDO
            if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
                try {
                    // Usamos lastGiftId para pedir solo eventos nuevos por ID
                    const eventos = await api.get(`/shop/eventos?userId=${user.id}&lastId=${lastGiftId.current}`);
                    
                    if (eventos && eventos.length > 0) {
                        // Actualizamos el último ID conocido
                        lastGiftId.current = eventos[eventos.length - 1].id;
                        
                        // Mostramos el último regalo recibido en el modal
                        const ultimoRegalo = eventos[eventos.length - 1];
                        console.log("Nuevo regalo detectado:", ultimoRegalo); // Debug

                        setModal({
                            isOpen: true,
                            title: '🎁 ¡REGALO RECIBIDO!',
                            message: (
                                <div style={{textAlign: 'center'}}>
                                    <div style={{fontSize: '4rem', marginBottom:'10px'}}>🎁</div>
                                    <p style={{fontSize: '1.5rem', fontWeight: 'bold', color: 'white', margin: '10px 0'}}>
                                        {ultimoRegalo.detalle}
                                    </p>
                                    <small className="text-neon">¡Sigue así, streamer!</small>
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