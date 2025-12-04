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
    
    // Estados para Modals y Overlays
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    const [overlayEvent, setOverlayEvent] = useState<string | null>(null);
    
    const [streamEnded, setStreamEnded] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    
    // Configuración de Niveles
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000);
    const [configNivelesStreamer, setConfigNivelesStreamer] = useState<Record<string, number>>({});
    
    // Referencia para control de polling de eventos
    const lastCheckRef = useRef<number>(Date.now());
    const chatEndRef = useRef<HTMLDivElement>(null);

    // 1. Carga Inicial de Datos de la Sala
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
                    
                    // Cargar regalos disponibles
                    const regalosData = await api.get('/shop/regalos');
                    setRegalos(regalosData);
                    
                    // Verificar estado del stream
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

    // Scroll automático al chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat]);

    // 2. INTERVALO LENTO (36s) - Sincronización de estado y Niveles del Streamer
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

                // Heartbeat para sumar horas al streamer
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

    // 3. INTERVALO RÁPIDO (3s) - Chat y Detección de Regalos (Overlay)
    useEffect(() => {
        if (!currentStreamId) return;
        
        const fastInterval = setInterval(async () => {
            try {
                // a) Actualizar Chat
                const msgs = await api.get(`/chat/${currentStreamId}`);
                setChat(msgs);

                // b) Chequear Eventos (Solo si soy el Streamer dueño del canal)
                if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
                    // Consultar eventos ocurridos DESPUÉS de la última revisión
                    const eventos = await api.get(`/shop/eventos?since=${lastCheckRef.current}`);
                    
                    if (eventos && eventos.length > 0) {
                        // Tomar el último evento (para simplificar la UI)
                        const ultimo = eventos[eventos.length - 1];
                        
                        // 1. Mostrar Modal de Alerta
                        setModal({
                            isOpen: true,
                            title: '¡REGALO RECIBIDO! 🎁',
                            message: ultimo.detalle 
                        });

                        // 2. Activar Overlay Flotante en video
                        triggerOverlay(ultimo.detalle);
                        
                        // Actualizar referencia de tiempo para no repetir eventos
                        // Usamos la fecha del último evento + 1ms para asegurar
                        lastCheckRef.current = new Date(ultimo.fecha).getTime(); 
                    } else {
                        // Si no hay eventos, simplemente avanzamos el reloj para mantener sincronía
                        // (opcional, pero ayuda si el reloj del server y cliente difieren mucho)
                        lastCheckRef.current = Date.now();
                    }
                }
            } catch (e) { /* ignore */ }
        }, 3000);
        
        return () => clearInterval(fastInterval);
    }, [currentStreamId, user, id]);

    const triggerOverlay = (texto: string) => {
        setOverlayEvent(null); // Resetear para permitir re-animación
        setTimeout(() => {
            setOverlayEvent(texto);
            // Ocultar después de 6 segundos
            setTimeout(() => setOverlayEvent(null), 6000);
        }, 100);
    };

    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !mensaje.trim() || !currentStreamId) return;
        const msgContent = mensaje;
        setMensaje(""); 

        try {
            // Sumar XP por chat
            const resXp = await api.post('/user/chat-xp', { userId: user.id, streamerId: id });
            await refreshUser(); 
            
            if (resXp.subioNivel) {
                setModal({ isOpen: true, title: '¡NIVEL UP!', message: `¡Nivel ${resXp.nivel} alcanzado!` });
            }
            
            // Enviar mensaje
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
            
            // Feedback para el espectador
            setModal({ 
                isOpen: true, 
                title: '¡REGALO ENVIADO! 🚀', 
                message: `Has enviado ${regalo.nombre} exitosamente.` 
            });
            
            // Mensaje automático en chat
            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: "SISTEMA",
                contenido: `${user.nombre} envió ${regalo.nombre} ${regalo.icono} 🎁`,
                nivel: 0,
                rol: "sistema",
                streamId: currentStreamId
            });

            if (res.subioNivel) {
                setTimeout(() => {
                    setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `¡Felicidades! Ahora eres nivel ${res.nivel}.` });
                }, 2000);
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

    // Cálculo de Progreso Espectador (Barra Visual)
    const calcularProgreso = () => {
        if (!user) return { current: 0, target: 1000, percent: 0 };
        const currentLvl = user.nivelEspectador;
        const nextLvl = currentLvl + 1;
        let targetXp = configNivelesStreamer[nextLvl.toString()];
        
        // Fallback lineal si no hay config
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
            
            {/* OVERLAY FLOTANTE (Solo visible si hay evento activo) */}
            {overlayEvent && (
                <div style={{
                    position: 'fixed', top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
                    background: 'rgba(0,0,0,0.9)', border: '4px solid var(--neon)', color: 'white',
                    padding: '30px', borderRadius: '20px', zIndex: 9999,
                    boxShadow: '0 0 50px var(--neon)', animation: 'bounceIn 0.5s', textAlign: 'center', minWidth: '300px'
                }}>
                    <h1 className="text-neon" style={{fontSize:'2rem', margin:0}}>🎁 NUEVO REGALO</h1>
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
                {/* BARRA DE PROGRESO DE ESPECTADOR */}
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