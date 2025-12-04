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
    
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    const [overlayEvent, setOverlayEvent] = useState<string | null>(null);
    const [streamEnded, setStreamEnded] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000);
    
    const lastCheckRef = useRef<number>(Date.now());
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchDatos = async () => {
            if (id) {
                try {
                    const streamerData = await api.get(`/user/${id}`);
                    setMetaXpStreamer(streamerData.metaXp || 1000);
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

    useEffect(() => {
        if (!id) return;

        const interval = setInterval(async () => {
            try {
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

                // REQ: Overlay animado para el Streamer
                if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
                    const eventos = await api.get(`/shop/eventos?since=${lastCheckRef.current}`);
                    if (eventos.length > 0) {
                        const ultimo = eventos[eventos.length - 1];
                        triggerOverlay(ultimo.detalle);
                        lastCheckRef.current = Date.now();
                    }
                }

            } catch (e) { /* ignore */ }
        }, 2000); 

        return () => clearInterval(interval);
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
            const resXp = await api.post('/user/chat-xp', { 
                userId: user.id, 
                currentMetaXp: metaXpStreamer 
            });

            await refreshUser(); 

            if (resXp.subioNivel) {
                setModal({ isOpen: true, title: '¡LEVEL UP! 🚀', message: `¡Felicidades! Has alcanzado el nivel ${resXp.nivel}.` });
            }

            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: user.nombre,
                contenido: msgContent,
                nivel: resXp.nivel || user.nivelEspectador, 
                rol: user.rol,
                streamId: currentStreamId
            });

        } catch (error) {
            console.error("Error enviando mensaje", error);
        }
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
            // Feedback local inmediato
            if (user.rol === 'streamer' && Number(user.id) === Number(id)) {
                 triggerOverlay(`¡REGALO! ${regalo.nombre} ${regalo.icono}`);
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
                setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `Nivel ${res.nivel} alcanzado por tu generosidad.` });
            }
        } else {
            setModal({ isOpen: true, title: 'Error', message: res.msg || 'Saldo insuficiente' });
        }
    };

    const toggleStream = async () => {
        if (!user || user.rol !== 'streamer') return;

        if (!isStreaming) {
            const res = await api.post('/streams/start', { 
                userId: user.id, 
                titulo: streamInfo.titulo, 
                categoria: "General" 
            });
            setChat([]); 
            setCurrentStreamId(res.streamId);
            setIsStreaming(true);
            setStreamEnded(false);
        } else {
            const res = await api.post('/streams/stop', { 
                userId: user.id, 
                streamId: currentStreamId 
            });
            setIsStreaming(false);
            setCurrentStreamId(null);
            
            if (res.subioNivel) {
                setModal({ isOpen:true, title:'¡LEVEL UP STREAMER!', message:`¡Has subido al nivel ${res.nivel} por tus horas de transmisión!`});
            } else {
                setModal({ isOpen:true, title:'Stream Finalizado', message:'Tus horas han sido registradas exitosamente.'});
            }
            refreshUser();
        }
    };

    const xpNeeded = metaXpStreamer;
    const currentXp = user ? user.puntosXP % xpNeeded : 0;
    const progressPercent = Math.min((currentXp / xpNeeded) * 100, 100);

    if (!streamInfo) return <div className="text-center mt-40">Cargando sala...</div>;

    return (
        <div className="stream-room-layout">
            <MiModal isOpen={modal.isOpen} onClose={()=>setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message}/>
            
            {/* REQ: Overlay Animado (Visualización) */}
            {overlayEvent && (
                <div style={{
                    position: 'fixed',
                    top: '30%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0, 255, 65, 0.9)',
                    color: 'black',
                    padding: '30px 50px',
                    borderRadius: '20px',
                    zIndex: 9999,
                    boxShadow: '0 0 50px #00ff41',
                    animation: 'bounceIn 0.5s',
                    textAlign: 'center',
                    border: '5px solid white'
                }}>
                    <h1 style={{fontSize:'3rem', margin:0, fontWeight: 900}}>¡NUEVO EVENTO!</h1>
                    <h2 style={{fontSize:'2rem', margin:'10px 0'}}>{overlayEvent}</h2>
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
                    <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                        <div className="profile-avatar-small" style={{width:'50px', height:'50px', background:'#333', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', overflow:'hidden'}}>
                            {streamInfo.usuario.charAt(0)}
                        </div>
                        <div>
                            <h3 style={{margin:0}}>{streamInfo.titulo}</h3>
                            <p className="text-muted text-small">{streamInfo.categoria}</p>
                        </div>
                    </div>
                    {user?.rol === 'streamer' && Number(user.id) === Number(id) && (
                        <button onClick={toggleStream} className={isStreaming ? "btn-delete" : "btn-neon"}>
                            {isStreaming ? "TERMINAR STREAM" : "INICIAR STREAM"}
                        </button>
                    )}
                </div>
            </div>

            <div className="chat-column">
                {user && user.rol === 'espectador' && (
                    <div style={{padding: '10px', background: '#111', borderBottom: '1px solid #333'}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', marginBottom:'5px'}}>
                            <span className="text-neon">Nivel {user.nivelEspectador}</span>
                            <span className="text-muted">{Math.floor(currentXp)} / {xpNeeded} XP</span>
                        </div>
                        <div style={{width:'100%', height:'6px', background:'#333', borderRadius:'3px'}}>
                            <div style={{width:`${progressPercent}%`, height:'100%', background:'var(--neon)', borderRadius:'3px', transition:'width 0.3s'}}></div>
                        </div>
                    </div>
                )}

                <div className="chat-messages">
                    {chat.length === 0 && <div className="text-center text-muted mt-20">¡El chat está tranquilo! Saluda 👋</div>}
                    {chat.map((c, i) => (
                        <div key={i} className="chat-msg">
                            {c.rolUsuario === 'sistema' ? (
                                <div style={{background:'rgba(0,255,65,0.1)', padding:'5px', borderRadius:'4px', textAlign:'center', color:'var(--neon)', fontSize:'0.85rem'}}>
                                    {c.contenido}
                                </div>
                            ) : (
                                <>
                                    {c.nivelUsuario > 0 && (
                                        <span style={{background:'#333', padding:'2px 5px', borderRadius:'4px', fontSize:'0.7rem', marginRight:'6px', color:'#fff'}}>
                                            Lvl {c.nivelUsuario}
                                        </span>
                                    )}
                                    <span className={c.rolUsuario === 'streamer' ? "text-neon bold" : "bold"}>
                                        {c.usuarioNombre}:
                                    </span> 
                                    <span style={{marginLeft:'5px', color:'#ddd'}}>{c.contenido}</span>
                                </>
                            )}
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
                
                <div className="chat-input-area">
                    <form onSubmit={handleChat} style={{display:'flex', gap:'5px'}}>
                        <input 
                            value={mensaje} 
                            onChange={e=>setMensaje(e.target.value)} 
                            className="chat-input" 
                            placeholder={isStreaming ? "Escribe algo..." : "Stream offline"} 
                            disabled={!user || streamEnded || !isStreaming}
                        />
                        <button className="btn-chat" disabled={!user || streamEnded || !isStreaming}>➤</button>
                    </form>
                </div>
                
                {/* REQ: Lista de regalos con NOMBRE visible */}
                {user?.rol === 'espectador' && isStreaming && (
                    <div className="gifts-panel">
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                             <span className="text-small">Saldo: <span className="text-neon">{user.monedas} 💰</span></span>
                        </div>
                        <div className="gift-grid-compact" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}> 
                            {regalos.map(r => (
                                <button key={r.id} onClick={()=>handleEnviarRegalo(r)} className="gift-btn-compact" disabled={user.monedas < r.costo} style={{ padding: '8px', height: 'auto' }}>
                                    <div style={{fontSize:'1.5rem'}}>{r.icono}</div>
                                    <div style={{fontSize:'0.75rem', fontWeight:'bold', margin: '2px 0'}}>{r.nombre}</div>
                                    <div style={{fontSize:'0.7rem', color: 'var(--neon)'}}>{r.costo} 💰</div>
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