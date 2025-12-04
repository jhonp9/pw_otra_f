import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';

interface MensajeChat {
    id?: number;
    usuarioNombre: string;
    contenido: string;
    nivelUsuario: number;
    rolUsuario: string;
}

const StreamRoom = () => {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    
    const [streamInfo, setStreamInfo] = useState<any>(null);
    const [chat, setChat] = useState<MensajeChat[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [regalos, setRegalos] = useState<any[]>([]);
    
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    const [overlayEvent, setOverlayEvent] = useState<string | null>(null);
    
    const [streamEnded, setStreamEnded] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    
    // Configuración de Niveles del Streamer
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000);
    const [configNivelesStreamer, setConfigNivelesStreamer] = useState<Record<string, number>>({});
    
    const lastCheckRef = useRef<number>(Date.now());
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Carga inicial
    useEffect(() => {
        const fetchDatos = async () => {
            if (id) {
                try {
                    const streamerData = await api.get(`/user/${id}`);
                    setMetaXpStreamer(streamerData.metaXp || 1000);
                    
                    // Parsear configuración de niveles personalizada
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

    // Intervalo Lento (36s) - Pulse y Estado
    useEffect(() => {
        if (!id) return;
        const slowInterval = setInterval(async () => {
            try {
                const status = await api.get(`/streams/status/${id}`);
                
                if (status.isLive && status.streamId !== currentStreamId) {
                    setChat([]); 
                    setCurrentStreamId(status.streamId);
                    setIsStreaming(true);
                    setStreamEnded(false);
                } else if (!status.isLive && isStreaming) {
                    setIsStreaming(false);
                    setStreamEnded(true);
                    setCurrentStreamId(null);
                }

                if (user?.rol === 'streamer' && Number(user.id) === Number(id) && isStreaming && currentStreamId) {
                    const pulseRes = await api.post('/streams/pulse', { userId: user.id, streamId: currentStreamId });
                    if (pulseRes.subioNivel) {
                        setModal({ 
                            isOpen: true, 
                            title: '¡LEVEL UP STREAMER! 🎉', 
                            message: `¡Has subido al nivel ${pulseRes.nivel}!` 
                        });
                        await refreshUser();
                    }
                }
            } catch (e) { /* ignore */ }
        }, 36000); 
        return () => clearInterval(slowInterval);
    }, [id, user, currentStreamId, isStreaming]);

    // Intervalo Rápido (3s) - Chat y Eventos
    useEffect(() => {
        if (!currentStreamId) return;
        const fastInterval = setInterval(async () => {
            try {
                const msgs = await api.get(`/chat/${currentStreamId}`);
                setChat(msgs);

                if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
                    const eventos = await api.get(`/shop/eventos?since=${lastCheckRef.current}`);
                    if (eventos && eventos.length > 0) {
                        const ultimo = eventos[eventos.length - 1];
                        triggerOverlay(ultimo.detalle);
                        lastCheckRef.current = Date.now();
                    }
                }
            } catch (e) { /* ignore */ }
        }, 3000);
        return () => clearInterval(fastInterval);
    }, [currentStreamId, user, id]);

    const triggerOverlay = (texto: string) => {
        setOverlayEvent(null);
        setTimeout(() => {
            setOverlayEvent(texto);
            setTimeout(() => setOverlayEvent(null), 6000);
        }, 100);
    };

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
            triggerOverlay(`¡ENVIASTE ${regalo.nombre}! ${regalo.icono}`);
            
            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: "SISTEMA",
                contenido: `${user.nombre} envió ${regalo.nombre} ${regalo.icono} 🎁`,
                nivel: 0,
                rol: "sistema",
                streamId: currentStreamId
            });

            if (res.subioNivel) {
                setTimeout(() => setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `Nivel ${res.nivel}!` }), 1000);
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
        } else {
            await api.post('/streams/stop', { userId: user.id, streamId: currentStreamId });
            setIsStreaming(false);
            setCurrentStreamId(null);
            setModal({ isOpen:true, title:'Stream Finalizado', message:'Live terminado.'});
            refreshUser();
        }
    };

    // CÁLCULO DE PROGRESO (AQUÍ USAMOS metaXpStreamer)
    const calcularProgreso = () => {
        if (!user) return { current: 0, target: 1000, percent: 0 };
        
        const currentLvl = user.nivelEspectador;
        const nextLvl = currentLvl + 1;
        
        // 1. Buscar si hay config específica para el siguiente nivel
        let targetXp = configNivelesStreamer[nextLvl.toString()];
        
        // 2. Si no hay config específica, usar el fallback lineal (metaXpStreamer)
        if (!targetXp) {
            // Ejemplo: Nivel 1 -> Meta 1000. Nivel 2 -> Meta 2000.
            targetXp = currentLvl * metaXpStreamer;
            // Si el usuario ya tiene más XP que la meta lineal (por cambios de config), ajustar
            if (user.puntosXP >= targetXp) targetXp = user.puntosXP + metaXpStreamer;
        }

        // XP necesaria desde el nivel anterior (para que la barra empiece vacía al subir de nivel)
        // Estimación del "piso" del nivel actual
        const prevTargetXp = configNivelesStreamer[currentLvl.toString()] || ((currentLvl - 1) * metaXpStreamer);
        
        const totalLevelRange = targetXp - prevTargetXp;
        const currentLevelProgress = user.puntosXP - prevTargetXp;
        
        let percent = (currentLevelProgress / totalLevelRange) * 100;
        percent = Math.max(0, Math.min(100, percent)); // Limitar entre 0 y 100

        return { current: user.puntosXP, target: targetXp, percent };
    };

    const progressData = calcularProgreso();

    if (!streamInfo) return <div className="text-center mt-40">Cargando sala...</div>;

    return (
        <div className="stream-room-layout">
            <MiModal isOpen={modal.isOpen} onClose={()=>setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message}/>
            
            {overlayEvent && (
                <div style={{
                    position: 'fixed', top: '25%', left: '50%', transform: 'translate(-50%, -50%)',
                    background: 'rgba(0,0,0,0.95)', border: '3px solid var(--neon)', color: 'white',
                    padding: '30px', borderRadius: '15px', zIndex: 9999,
                    boxShadow: '0 0 40px var(--neon)', animation: 'bounceIn 0.5s', textAlign: 'center'
                }}>
                    <h1 className="text-neon" style={{fontSize:'2rem', margin:0}}>🎁 EVENTO</h1>
                    <h2 style={{fontSize:'1.5rem', margin:'10px 0'}}>{overlayEvent}</h2>
                </div>
            )}

            <div className="video-column">
                <div className="video-player-container">
                    {streamEnded ? (
                        <div style={{textAlign:'center'}}>
                            <h1 className="text-muted" style={{fontSize:'3rem'}}>OFFLINE 💤</h1>
                            <button onClick={()=>navigate('/')} className="btn-regresar mt-20">Salir</button>
                        </div>
                    ) : (
                        <h1 className="text-neon" style={{fontSize:'3rem'}}>{isStreaming ? "EN VIVO 🔴" : "ESPERANDO..."}</h1>
                    )}
                </div>
                <div className="stream-info-bar">
                    <div><h3 style={{margin:0}}>{streamInfo.titulo}</h3></div>
                    {user?.rol === 'streamer' && Number(user.id) === Number(id) && (
                        <button onClick={toggleStream} className={isStreaming ? "btn-delete" : "btn-neon"}>
                            {isStreaming ? "TERMINAR" : "INICIAR"}
                        </button>
                    )}
                </div>
            </div>

            <div className="chat-column">
                {/* BARRA DE PROGRESO (Corregido: ahora se muestra) */}
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
                                <div style={{color:'var(--neon)', textAlign:'center', fontSize:'0.8rem', margin:'5px 0'}}>{c.contenido}</div>
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
                        <input value={mensaje} onChange={e=>setMensaje(e.target.value)} className="chat-input" placeholder="Chat..." disabled={!isStreaming}/>
                        <button className="btn-chat">➤</button>
                    </form>
                </div>
                
                {user?.rol === 'espectador' && isStreaming && (
                    <div className="gifts-panel">
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                             <span className="text-small">Saldo: <span className="text-neon">{user.monedas} 💰</span></span>
                        </div>
                        <div className="gift-grid-compact" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}> 
                            {regalos.map(r => (
                                <button key={r.id} onClick={()=>handleEnviarRegalo(r)} className="gift-btn-compact" disabled={user.monedas < r.costo} style={{ padding: '8px', flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                                    <div style={{fontSize:'1.8rem', marginRight:'8px'}}>{r.icono}</div>
                                    <div style={{textAlign:'left', flex:1}}>
                                        <div style={{fontSize:'0.8rem', fontWeight:'bold', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.nombre}</div>
                                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.7rem'}}>
                                            <span style={{color: 'var(--neon)'}}>{r.costo} 💰</span>
                                            <span style={{color: '#aaa'}}>+{r.puntos} XP</span>
                                        </div>
                                    </div>
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