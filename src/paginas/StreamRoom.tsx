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
    const { id } = useParams(); // ID del Streamer (Dueño del canal)
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    
    // Estados de Datos
    const [streamInfo, setStreamInfo] = useState<any>(null);
    const [chat, setChat] = useState<MensajeChat[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [regalos, setRegalos] = useState<any[]>([]);
    
    // Estados de UI
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    const [overlayEvent, setOverlayEvent] = useState<string | null>(null);
    const [streamEnded, setStreamEnded] = useState(false);

    // Estado Streamer (Solo si soy el dueño)
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000);
    
    // Refs para polling
    const lastCheckRef = useRef<number>(Date.now());
    const chatEndRef = useRef<HTMLDivElement>(null);

    // 1. CARGA INICIAL
    useEffect(() => {
        const fetchDatos = async () => {
            if (id) {
                try {
                    // Obtener info del dueño del canal
                    const streamerData = await api.get(`/user/${id}`);
                    setMetaXpStreamer(streamerData.metaXp || 1000);
                    setStreamInfo({ 
                        id, 
                        titulo: `Canal de ${streamerData.nombre}`, 
                        usuario: streamerData.nombre, 
                        categoria: "General" 
                    });

                    // Cargar Regalos disponibles
                    const regalosData = await api.get('/shop/regalos');
                    setRegalos(regalosData);

                    // Verificar estado inicial del stream
                    const status = await api.get(`/streams/status/${id}`);
                    if (status.isLive) {
                        setIsStreaming(true);
                        setCurrentStreamId(status.streamId);
                    } else if (Number(user?.id) !== Number(id)) {
                        // Si no soy el dueño y no está en vivo
                        setStreamEnded(true);
                    }
                } catch (e) { console.error("Error cargando sala"); }
            }
        };
        fetchDatos();
    }, [id, user]);

    // 2. SCROLL AUTOMÁTICO AL CHAT
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat]);

    // 3. POLLING PRINCIPAL (Cada 2 segundos)
    useEffect(() => {
        if (!id) return;

        const interval = setInterval(async () => {
            // A. Sincronizar Chat
            try {
                const msgs = await api.get(`/chat/${id}`);
                setChat(msgs);
            } catch (e) { /* ignore */ }

            // B. Verificar Estado del Stream (Para espectadores)
            if (user?.rol === 'espectador' || (user?.rol === 'streamer' && Number(user.id) !== Number(id))) {
                try {
                    const status = await api.get(`/streams/status/${id}`);
                    if (!status.isLive) {
                        setStreamEnded(true);
                        setIsStreaming(false);
                    } else {
                        setStreamEnded(false);
                        setIsStreaming(true);
                    }
                } catch (e) { /* ignore */ }
            }

            // C. Overlay de Eventos (Solo para el Streamer Dueño)
            if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
                try {
                    const eventos = await api.get(`/shop/eventos?since=${lastCheckRef.current}`);
                    if (eventos.length > 0) {
                        const ultimo = eventos[eventos.length - 1];
                        triggerOverlay(ultimo.detalle);
                        lastCheckRef.current = Date.now();
                        
                        // Si el evento implica envío de regalo, ya se guardó en DB, 
                        // pero podemos inyectar mensaje de sistema localmente si se desea, 
                        // aunque es mejor que el backend de chat lo maneje.
                    }
                } catch (e) { /* ignore */ }
            }

        }, 2000); // Polling cada 2s

        return () => clearInterval(interval);
    }, [id, user]);

    // Helper para Overlay
    const triggerOverlay = (texto: string) => {
        setOverlayEvent(texto);
        setTimeout(() => setOverlayEvent(null), 5000);
    };

    // 4. MANEJO DE CHAT (Envía al backend)
    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !mensaje.trim()) return;

        const msgContent = mensaje;
        setMensaje(""); // Limpiar input inmediatamente (UX)

        // A. Sumar XP (Requerimiento 11)
        const resXp = await api.post('/user/chat-xp', { 
            userId: user.id, 
            currentMetaXp: metaXpStreamer 
        });

        // B. Notificar Nivel (Requerimiento 14)
        if (resXp.subioNivel) {
            setModal({ 
                isOpen: true, 
                title: '¡LEVEL UP! 🚀', 
                message: `¡Felicidades! Has alcanzado el Nivel ${resXp.nivel}.` 
            });
            refreshUser();
        }

        // C. Enviar mensaje a DB para sincronización
        await api.post('/chat/enviar', {
            userId: user.id,
            nombre: user.nombre,
            contenido: msgContent,
            nivel: resXp.nivel || user.nivelEspectador, // Usar nivel actualizado
            rol: user.rol,
            streamId: id
        });
    };

    // 5. ENVIAR REGALO
    const handleEnviarRegalo = async (regalo: any) => {
        if (!user) return;
        
        const res = await api.post('/shop/enviar', { 
            viewerId: user.id, 
            regaloId: regalo.id,
            streamerId: id 
        });
        
        if (res.success) {
            await refreshUser();
            
            // Animación Local para el que envía
            triggerOverlay(`Enviaste ${regalo.nombre} ${regalo.icono}`);

            // Enviar mensaje de sistema al chat
            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: "SISTEMA",
                contenido: `${user.nombre} ha enviado ${regalo.nombre} ${regalo.icono} 🎁`,
                nivel: 0,
                rol: "sistema",
                streamId: id
            });

            if (res.subioNivel) {
                setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `¡Wow! Tu apoyo te llevó al Nivel ${res.nivel} 🎉` });
            }
        } else {
            setModal({ isOpen: true, title: 'Ups', message: res.msg || 'Saldo insuficiente' });
        }
    };

    // 6. CONTROL DEL STREAM (Solo Dueño)
    const toggleStream = async () => {
        if (!user || user.rol !== 'streamer') return;

        if (!isStreaming) {
            const res = await api.post('/streams/start', { 
                userId: user.id, 
                titulo: streamInfo.titulo, 
                categoria: "General" 
            });
            setCurrentStreamId(res.streamId);
            setIsStreaming(true);
            setStreamEnded(false);
        } else {
            const res = await api.post('/streams/stop', { 
                userId: user.id, 
                streamId: currentStreamId 
            });
            setIsStreaming(false);
            
            // Requerimiento 16: Aviso al subir de nivel por horas
            if (res.subioNivel) {
                triggerOverlay(`¡SUBISTE A NIVEL DE STREAMER ${res.nivel}! 📈`);
                setModal({ isOpen:true, title:'¡LEVEL UP STREAMER!', message:`Has subido al nivel ${res.nivel} por tus horas transmitidas.`});
            } else {
                setModal({ isOpen:true, title:'Stream Finalizado', message:'Tus horas han sido registradas exitosamente.'});
            }
            refreshUser();
        }
    };

    // RENDER
    if (!streamInfo) return <div className="text-center mt-40">Cargando sala...</div>;

    return (
        <div className="stream-room-layout">
            <MiModal isOpen={modal.isOpen} onClose={()=>setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message}/>
            
            {/* OVERLAY ANIMADO (Centro de pantalla) */}
            {overlayEvent && (
                <div className="gift-overlay-animation">
                    <h1 className="text-neon" style={{fontSize:'2.5rem', textAlign:'center'}}>{overlayEvent}</h1>
                </div>
            )}

            {/* COLUMNA IZQUIERDA: VIDEO */}
            <div className="video-column">
                <div className="video-player-container" style={{position: 'relative'}}>
                    {streamEnded ? (
                        <div style={{textAlign:'center'}}>
                            <h1 className="text-muted" style={{fontSize:'3rem'}}>OFFLINE 💤</h1>
                            <p>El stream ha finalizado.</p>
                            <button onClick={()=>navigate('/')} className="btn-regresar mt-20">Ir al Inicio</button>
                        </div>
                    ) : (
                        <h1 className="text-neon" style={{fontSize:'3rem'}}>
                            {isStreaming ? "EN VIVO 🔴" : "ESPERANDO STREAM..."}
                        </h1>
                    )}
                </div>
                
                <div className="stream-info-bar">
                    <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                        <div className="profile-avatar-small" style={{width:'60px', height:'60px', fontSize:'1.5rem', background: '#333', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center'}}>
                            {streamInfo.usuario.charAt(0)}
                        </div>
                        <div>
                            <h2 style={{margin:0}}>{streamInfo.titulo}</h2>
                            <p className="text-muted">{streamInfo.usuario} • {streamInfo.categoria}</p>
                        </div>
                    </div>
                    
                    {/* Botones del Streamer */}
                    {user?.rol === 'streamer' && Number(user.id) === Number(id) && (
                        <button onClick={toggleStream} className={isStreaming ? "btn-delete" : "btn-neon"}>
                            {isStreaming ? "TERMINAR STREAM 🔴" : "INICIAR STREAM 📡"}
                        </button>
                    )}
                </div>
            </div>

            {/* COLUMNA DERECHA: CHAT */}
            <div className="chat-column">
                <div className="chat-messages">
                    {chat.map((c, i) => (
                        <div key={i} className="chat-msg" style={{marginBottom: '8px'}}>
                            {c.rolUsuario === 'sistema' ? (
                                <div style={{background: 'rgba(0, 255, 65, 0.1)', padding: '5px', borderRadius: '4px', textAlign: 'center', color: 'var(--neon)', fontSize: '0.85rem'}}>
                                    {c.contenido}
                                </div>
                            ) : (
                                <>
                                    {c.nivelUsuario > 0 && (
                                        <span className="badge-level" style={{background: '#333', color: 'white', padding: '2px 5px', borderRadius: '4px', fontSize: '0.7rem', marginRight: '5px'}}>
                                            Lvl {c.nivelUsuario}
                                        </span>
                                    )}
                                    <span className={c.rolUsuario === 'streamer' ? "text-neon bold" : "text-white bold"}>
                                        {c.usuarioNombre}:
                                    </span> 
                                    <span style={{marginLeft: '5px', color: '#ccc'}}>{c.contenido}</span>
                                </>
                            )}
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
                
                <div className="chat-input-area">
                    <form onSubmit={handleChat} style={{display:'flex', width:'100%', gap:'5px'}}>
                        <input 
                            value={mensaje} 
                            onChange={e=>setMensaje(e.target.value)} 
                            className="chat-input" 
                            placeholder={user ? "Escribe..." : "Inicia sesión para chatear"} 
                            disabled={!user || streamEnded}
                        />
                        <button className="btn-chat" disabled={!user || streamEnded}>➤</button>
                    </form>
                </div>
                
                {/* Panel de Regalos (Solo Espectador) */}
                {user?.rol === 'espectador' && !streamEnded && (
                    <div className="gifts-panel">
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                             <span className="text-small">Saldo: <span className="text-neon">{user.monedas} 💰</span></span>
                             <span className="text-small">Nivel: {user.nivelEspectador}</span>
                        </div>
                        <div className="gift-grid-compact">
                            {regalos.map(r => (
                                <button key={r.id} onClick={()=>handleEnviarRegalo(r)} className="gift-btn-compact" disabled={user.monedas < r.costo} title={`Costo: ${r.costo}`}>
                                    <div style={{fontSize:'1.5rem'}}>{r.icono}</div>
                                    <div style={{fontSize:'0.8rem'}}>{r.costo}</div>
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