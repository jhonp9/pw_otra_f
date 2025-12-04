// jhonp9/pw_otra_f/pw_otra_f-6420afd1c27951a0e347ec5e5f14f39cefa7bcce/src/paginas/StreamRoom.tsx
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
    
    // Modal para mensajes importantes (Nivel subido, stream terminado)
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    // Overlay solo para el Streamer (regalos recibidos)
    const [overlayEvent, setOverlayEvent] = useState<string | null>(null);
    
    const [streamEnded, setStreamEnded] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    
    const lastCheckRef = useRef<number>(Date.now());
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Carga inicial
    useEffect(() => {
        const fetchDatos = async () => {
            if (id) {
                try {
                    const streamerData = await api.get(`/user/${id}`);
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

    // LÓGICA DE PULSE Y POLLING
    useEffect(() => {
        if (!id) return;

        const interval = setInterval(async () => {
            try {
                // 1. Verificar estado del stream y chat
                const status = await api.get(`/streams/status/${id}`);
                
                if (status.isLive && status.streamId !== currentStreamId) {
                    setChat([]); 
                    setCurrentStreamId(status.streamId);
                    setIsStreaming(true);
                    setStreamEnded(false);
                } 
                else if (!status.isLive && isStreaming) {
                    setIsStreaming(false);
                    setStreamEnded(true);
                    setCurrentStreamId(null);
                }

                if (status.streamId) {
                    const msgs = await api.get(`/chat/${status.streamId}`);
                    setChat(msgs);
                }

                // 2. Lógica del Streamer: Heartbeat (Pulse) y Overlay
                if (user?.rol === 'streamer' && Number(user.id) === Number(id) && isStreaming && currentStreamId) {
                    // a) Enviar latido para sumar horas y verificar nivel
                    const pulseRes = await api.post('/streams/pulse', { userId: user.id, streamId: currentStreamId });
                    
                    if (pulseRes.subioNivel) {
                        setModal({ isOpen: true, title: '¡NIVEL STREAMER UP!', message: `¡Has subido al nivel ${pulseRes.nivel} en vivo!` });
                        // Actualizamos info local
                        await refreshUser();
                    }

                    // b) Verificar eventos para el Overlay
                    const eventos = await api.get(`/shop/eventos?since=${lastCheckRef.current}`);
                    if (eventos.length > 0) {
                        // Tomar el evento más reciente
                        const ultimo = eventos[eventos.length - 1];
                        triggerOverlay(ultimo.detalle); // Mostrar overlay visual
                        lastCheckRef.current = Date.now(); // Actualizar timestamp para no repetir
                    }
                }

            } catch (e) { /* ignore */ }
        }, 36000); // 36 segundos (coincide con 0.01 horas para sincronía perfecta)

        // Intervalo rápido separado para chat (2s) para que se sienta fluido
        const chatInterval = setInterval(async () => {
             if(currentStreamId) {
                 const msgs = await api.get(`/chat/${currentStreamId}`);
                 setChat(msgs);
             }
        }, 2000);

        return () => { clearInterval(interval); clearInterval(chatInterval); };
    }, [id, user, currentStreamId, isStreaming]);

    const triggerOverlay = (texto: string) => {
        setOverlayEvent(texto);
        setTimeout(() => setOverlayEvent(null), 6000);
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
                setModal({ isOpen: true, title: '¡NIVEL UP!', message: `¡Felicidades! Eres nivel ${resXp.nivel}.` });
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
        
        // Mostrar Modal Confirmación de Envío
        setModal({ isOpen: true, title: 'Enviando...', message: 'Procesando tu regalo...' });

        const res = await api.post('/shop/enviar', { 
            viewerId: user.id, 
            regaloId: regalo.id,
            streamerId: id 
        });
        
        if (res.success) {
            await refreshUser();
            setModal({ isOpen: true, title: '¡REGALO ENVIADO!', message: `Has enviado ${regalo.nombre} exitosamente.` });
            
            // Si el streamer es el mismo usuario (testeo), mostrar overlay local
            if (user.rol === 'streamer' && Number(user.id) === Number(id)) {
                 triggerOverlay(`¡AUTO-REGALO! ${regalo.nombre} ${regalo.icono}`);
            }
            
            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: "SISTEMA",
                contenido: `${user.nombre} envió ${regalo.nombre} ${regalo.icono} 🎁`,
                nivel: 0,
                rol: "sistema",
                streamId: currentStreamId
            });

            if (res.subioNivel) {
                // Pequeño delay para que no se solape con el modal de "Regalo enviado"
                setTimeout(() => {
                    setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `Nivel ${res.nivel} alcanzado por tu generosidad.` });
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
            setModal({ isOpen:true, title:'Stream Finalizado', message:'Transmisión terminada.'});
            refreshUser();
        }
    };

    if (!streamInfo) return <div className="text-center mt-40">Cargando sala...</div>;

    return (
        <div className="stream-room-layout">
            <MiModal isOpen={modal.isOpen} onClose={()=>setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message}/>
            
            {/* OVERLAY DEL STREAMER (FIXED, GRANDE) */}
            {overlayEvent && (
                <div style={{
                    position: 'fixed',
                    top: '20%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0, 0, 0, 0.9)',
                    border: '4px solid var(--neon)',
                    color: 'white',
                    padding: '40px',
                    borderRadius: '20px',
                    zIndex: 9999,
                    boxShadow: '0 0 50px var(--neon)',
                    animation: 'bounceIn 0.5s',
                    textAlign: 'center',
                    minWidth: '400px'
                }}>
                    <h1 style={{fontSize:'3rem', margin:0, color: 'var(--neon)'}}>¡NUEVO REGALO!</h1>
                    <h2 style={{fontSize:'1.8rem', margin:'20px 0'}}>{overlayEvent}</h2>
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
                        <h1 className="text-neon" style={{fontSize:'3rem'}}>
                            {isStreaming ? "EN VIVO 🔴" : "ESPERANDO..."}
                        </h1>
                    )}
                </div>
                
                <div className="stream-info-bar">
                    <div>
                        <h3 style={{margin:0}}>{streamInfo.titulo}</h3>
                        <p className="text-muted">Nivel Streamer: {streamInfo.nivel}</p>
                    </div>
                    {user?.rol === 'streamer' && Number(user.id) === Number(id) && (
                        <button onClick={toggleStream} className={isStreaming ? "btn-delete" : "btn-neon"}>
                            {isStreaming ? "TERMINAR" : "INICIAR"}
                        </button>
                    )}
                </div>
            </div>

            <div className="chat-column">
                <div className="chat-messages">
                    {chat.map((c, i) => (
                        <div key={i} className="chat-msg">
                            {c.rolUsuario === 'sistema' ? (
                                <div style={{color:'var(--neon)', textAlign:'center', margin:'5px 0', border:'1px dashed var(--neon)', padding:'5px'}}>{c.contenido}</div>
                            ) : (
                                <span><strong style={{color: c.rolUsuario==='streamer'?'var(--neon)':'white'}}>{c.usuarioNombre} (Lvl {c.nivelUsuario}):</strong> {c.contenido}</span>
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
                
                {/* REQ: XP Visible en Regalos */}
                {user?.rol === 'espectador' && isStreaming && (
                    <div className="gifts-panel">
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                             <span className="text-small">Tu Saldo: <span className="text-neon">{user.monedas} 💰</span></span>
                        </div>
                        <div className="gift-grid-compact" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}> 
                            {regalos.map(r => (
                                <button key={r.id} onClick={()=>handleEnviarRegalo(r)} className="gift-btn-compact" disabled={user.monedas < r.costo} style={{ padding: '10px', height: 'auto', flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                                    <div style={{fontSize:'1.5rem', marginRight:'10px'}}>{r.icono}</div>
                                    <div style={{textAlign:'left'}}>
                                        <div style={{fontSize:'0.8rem', fontWeight:'bold'}}>{r.nombre}</div>
                                        <div style={{fontSize:'0.7rem', color: 'var(--neon)'}}>{r.costo} 💰</div>
                                        <div style={{fontSize:'0.65rem', color: '#888'}}>+{r.puntos} XP</div> {/* XP VISIBLE */}
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