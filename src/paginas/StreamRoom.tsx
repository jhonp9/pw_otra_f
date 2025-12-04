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
    const { id } = useParams(); // Este es el ID del USUARIO (Streamer)
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

    // Estado Streamer
    const [isStreaming, setIsStreaming] = useState(false);
    
    // <--- CAMBIO CLAVE 1: currentStreamId almacenará el ID de la TRANSMISIÓN única, no del usuario
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
                    const streamerData = await api.get(`/user/${id}`);
                    setMetaXpStreamer(streamerData.metaXp || 1000);
                    setStreamInfo({ 
                        id, 
                        titulo: `Canal de ${streamerData.nombre}`, 
                        usuario: streamerData.nombre, 
                        categoria: "General" 
                    });

                    const regalosData = await api.get('/shop/regalos');
                    setRegalos(regalosData);

                    const status = await api.get(`/streams/status/${id}`);
                    if (status.isLive) {
                        setIsStreaming(true);
                        setCurrentStreamId(status.streamId); // Guardamos el ID de la sesión actual
                    } else if (Number(user?.id) !== Number(id)) {
                        setStreamEnded(true);
                    }
                } catch (e) { console.error("Error cargando sala"); }
            }
        };
        fetchDatos();
    }, [id, user]);

    // 2. SCROLL AUTOMÁTICO
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat]);

    // 3. POLLING PRINCIPAL (Chat y Estado)
    useEffect(() => {
        if (!id) return;

        const interval = setInterval(async () => {
            // <--- CAMBIO CLAVE 2: Consultar chat usando currentStreamId (Sesión), no 'id' (Usuario)
            if (currentStreamId) {
                try {
                    const msgs = await api.get(`/chat/${currentStreamId}`);
                    setChat(msgs);
                } catch (e) { /* ignore */ }
            }

            // Verificar Estado del Stream
            if (user?.rol === 'espectador' || (user?.rol === 'streamer' && Number(user.id) !== Number(id))) {
                try {
                    const status = await api.get(`/streams/status/${id}`);
                    if (!status.isLive) {
                        setStreamEnded(true);
                        setIsStreaming(false);
                        setCurrentStreamId(null); // Limpiamos ID si acaba
                    } else {
                        setStreamEnded(false);
                        setIsStreaming(true);
                        // Importante: Si el espectador llega tarde, aquí obtenemos el ID de sesión
                        if (status.streamId !== currentStreamId) {
                            setCurrentStreamId(status.streamId);
                        }
                    }
                } catch (e) { /* ignore */ }
            }

            // Overlay de Eventos (Solo Streamer)
            if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
                try {
                    const eventos = await api.get(`/shop/eventos?since=${lastCheckRef.current}`);
                    if (eventos.length > 0) {
                        const ultimo = eventos[eventos.length - 1];
                        triggerOverlay(ultimo.detalle);
                        lastCheckRef.current = Date.now();
                    }
                } catch (e) { /* ignore */ }
            }

        }, 2000); 

        return () => clearInterval(interval);
    }, [id, user, currentStreamId]); // Agregamos currentStreamId a dependencias

    const triggerOverlay = (texto: string) => {
        setOverlayEvent(texto);
        setTimeout(() => setOverlayEvent(null), 5000);
    };

    // 4. MANEJO DE CHAT
    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        // Validamos que exista currentStreamId (que el stream esté activo)
        if (!user || !mensaje.trim() || !currentStreamId) return;

        const msgContent = mensaje;
        setMensaje(""); 

        const resXp = await api.post('/user/chat-xp', { 
            userId: user.id, 
            currentMetaXp: metaXpStreamer 
        });

        if (resXp.subioNivel) {
            setModal({ 
                isOpen: true, 
                title: '¡LEVEL UP! 🚀', 
                message: `¡Felicidades! Has alcanzado el Nivel ${resXp.nivel}.` 
            });
            refreshUser();
        }

        // <--- CAMBIO CLAVE 3: Enviamos currentStreamId al backend
        await api.post('/chat/enviar', {
            userId: user.id,
            nombre: user.nombre,
            contenido: msgContent,
            nivel: resXp.nivel || user.nivelEspectador, 
            rol: user.rol,
            streamId: currentStreamId // ID de la sesión
        });
    };

    // 5. ENVIAR REGALO
    const handleEnviarRegalo = async (regalo: any) => {
        if (!user || !currentStreamId) return;
        
        const res = await api.post('/shop/enviar', { 
            viewerId: user.id, 
            regaloId: regalo.id,
            streamerId: id 
        });
        
        if (res.success) {
            await refreshUser();
            triggerOverlay(`Enviaste ${regalo.nombre} ${regalo.icono}`);

            // <--- CAMBIO CLAVE 4: Mensaje de sistema con currentStreamId
            await api.post('/chat/enviar', {
                userId: user.id,
                nombre: "SISTEMA",
                contenido: `${user.nombre} ha enviado ${regalo.nombre} ${regalo.icono} 🎁`,
                nivel: 0,
                rol: "sistema",
                streamId: currentStreamId
            });

            if (res.subioNivel) {
                setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `¡Wow! Tu apoyo te llevó al Nivel ${res.nivel} 🎉` });
            }
        } else {
            setModal({ isOpen: true, title: 'Ups', message: res.msg || 'Saldo insuficiente' });
        }
    };

    // 6. CONTROL DEL STREAM
    const toggleStream = async () => {
        if (!user || user.rol !== 'streamer') return;

        if (!isStreaming) {
            // INICIAR
            const res = await api.post('/streams/start', { 
                userId: user.id, 
                titulo: streamInfo.titulo, 
                categoria: "General" 
            });
            setCurrentStreamId(res.streamId); // Guardamos nuevo ID
            setIsStreaming(true);
            setStreamEnded(false);
            setChat([]); // <--- ¡LIMPIAMOS EL CHAT LOCALMENTE AL INICIAR!
        } else {
            // DETENER
            const res = await api.post('/streams/stop', { 
                userId: user.id, 
                streamId: currentStreamId 
            });
            setIsStreaming(false);
            setCurrentStreamId(null); // Reseteamos ID
            
            if (res.subioNivel) {
                triggerOverlay(`¡SUBISTE A NIVEL DE STREAMER ${res.nivel}! 📈`);
                setModal({ isOpen:true, title:'¡LEVEL UP STREAMER!', message:`Has subido al nivel ${res.nivel} por tus horas transmitidas.`});
            } else {
                setModal({ isOpen:true, title:'Stream Finalizado', message:'Tus horas han sido registradas exitosamente.'});
            }
            refreshUser();
        }
    };

    if (!streamInfo) return <div className="text-center mt-40">Cargando sala...</div>;

    return (
        <div className="stream-room-layout">
            <MiModal isOpen={modal.isOpen} onClose={()=>setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message}/>
            
            {overlayEvent && (
                <div className="gift-overlay-animation">
                    <h1 className="text-neon" style={{fontSize:'2.5rem', textAlign:'center'}}>{overlayEvent}</h1>
                </div>
            )}

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
                    
                    {user?.rol === 'streamer' && Number(user.id) === Number(id) && (
                        <button onClick={toggleStream} className={isStreaming ? "btn-delete" : "btn-neon"}>
                            {isStreaming ? "TERMINAR STREAM 🔴" : "INICIAR STREAM 📡"}
                        </button>
                    )}
                </div>
            </div>

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
                            placeholder={isStreaming ? "Escribe..." : "Stream Offline"} 
                            disabled={!user || streamEnded || !isStreaming}
                        />
                        <button className="btn-chat" disabled={!user || streamEnded || !isStreaming}>➤</button>
                    </form>
                </div>
                
                {user?.rol === 'espectador' && !streamEnded && isStreaming && (
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