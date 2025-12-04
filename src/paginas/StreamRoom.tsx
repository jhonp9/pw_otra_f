import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';

// Agregar interface para tipar mejor el chat
interface MensajeChat {
    user: string;
    msg: string;
    nivel: number; // Req 13: Nivel en chat
    rol: string;
}

const StreamRoom = () => {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const [streamInfo, setStreamInfo] = useState<any>(null); // Datos del stream
    const [chat, setChat] = useState<MensajeChat[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [regalos, setRegalos] = useState<any[]>([]);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    
    
    // Estado Overlay (Animación para Streamer y Espectadores)
    const [overlayGift, setOverlayGift] = useState<string | null>(null);

    // Estado Control Stream (Solo Streamer)
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000);

    // 1. Cargar datos iniciales
    useEffect(() => {
        const fetchDatos = async () => {
            // Cargar datos del usuario dueño del stream para obtener su metaXp
            // Esto asume que tienes un endpoint /api/user/:id que devuelve metaXp
            if (id) {
                try {
                    const streamerData = await api.get(`/user/${id}`);
                    setMetaXpStreamer(streamerData.metaXp || 1000); // Guardamos la config
                    
                    setStreamInfo({ 
                        id, 
                        titulo: `Canal de ${streamerData.nombre}`, 
                        usuario: streamerData.nombre, 
                        categoria: "General" 
                    });
                } catch (e) {
                    console.error("Error cargando streamer");
                }
            }
            const regalosData = await api.get('/shop/regalos');
            setRegalos(regalosData);
        };
        fetchDatos();
    }, [id]);

    // 2. Manejar Chat y XP
    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !mensaje.trim()) return;

        // REQ 22: Enviamos currentMetaXp al backend
        const res = await api.post('/user/chat-xp', { 
            userId: user.id, 
            currentMetaXp: metaXpStreamer 
        });
        
        // ... (resto de lógica de chat, notificaciones, etc)
        if (res.subioNivel) {
             setModal({ 
                isOpen: true, 
                title: '¡SUBISTE DE NIVEL! 🚀', 
                message: `Has alcanzado el Nivel ${res.nivel} en este canal.` 
            });
            refreshUser();
        }

        const nuevoMensaje: MensajeChat = {
            user: user.nombre,
            msg: mensaje,
            nivel: res.nivel || user.nivelEspectador,
            rol: user.rol
        };
        setChat([...chat, nuevoMensaje]);
        setMensaje("");
    };

    // 3. Enviar Regalo
    const handleEnviarRegalo = async (regalo: any) => {
        if (!user) return;
        
        const res = await api.post('/shop/enviar', { viewerId: user.id, regaloId: regalo.id });
        
        if (res.success) {
            await refreshUser(); // Actualizar saldo y nivel
            
            // Animación Overlay
            setOverlayGift(`${user.nombre} envió ${regalo.icono}`);
            setTimeout(() => setOverlayGift(null), 4000);

            // Mensaje en Chat
            setChat([...chat, { 
                user: "SISTEMA", 
                msg: `${user.nombre} ha enviado ${regalo.nombre} 🎁`,
                nivel: 0,           // ← Add default nivel
                rol: "sistema"      // ← Add rol
                }]);

            // Alerta de Nivel
            if (res.subioNivel) {
                setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `Felicidades, has alcanzado el Nivel ${res.nivel} 🎉` });
            }
        } else {
            setModal({ isOpen: true, title: 'ERROR', message: res.msg || 'Saldo insuficiente' });
        }
    };

    // 4. Control del Stream (Start/Stop) - Solo Streamer
    const toggleStream = async () => {
        if (!user || user.rol !== 'streamer') return;

        if (!isStreaming) {
            const res = await api.post('/streams/start', { 
                userId: user.id, 
                titulo: "Mi Super Stream", 
                categoria: "Gaming" 
            });
            setCurrentStreamId(res.streamId);
            setIsStreaming(true);
        } else {
            const res = await api.post('/streams/stop', { 
                userId: user.id, 
                streamId: currentStreamId 
            });
            setIsStreaming(false);
            
            if (res.subioNivel) {
                setModal({ isOpen:true, title:'¡LEVEL UP STREAMER!', message:`Has subido al nivel ${res.nivel} por tus horas transmitidas.`});
            } else {
                setModal({ isOpen:true, title:'Stream Finalizado', message:'Tus horas han sido registradas.'});
            }
        }
    };

    if (!streamInfo) return <div className="text-center mt-40">Cargando sala...</div>;

    return (
        <div className="stream-room-layout">
            <MiModal isOpen={modal.isOpen} onClose={()=>setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message}/>
            
            {/* OVERLAY ANIMADO (Requerimiento) */}
            {overlayGift && (
                <div className="gift-overlay-animation">
                    <h1 className="text-neon" style={{fontSize:'3rem'}}>🎉 {overlayGift} 🎉</h1>
                </div>
            )}

            {/* COLUMNA VIDEO */}
            <div className="video-column">
                <div className="video-player-container">
                    <h1 className="text-neon" style={{fontSize:'3rem'}}>
                        {isStreaming ? "EN VIVO 🔴" : "OFFLINE ⚫"}
                    </h1>
                </div>
                
                <div className="stream-info-bar">
                    <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                        <div className="profile-avatar-small" style={{width:'60px', height:'60px', fontSize:'1.5rem'}}>S</div>
                        <div>
                            <h2 style={{margin:0}}>{streamInfo.titulo}</h2>
                            <p className="text-muted">{streamInfo.usuario} • {streamInfo.categoria}</p>
                        </div>
                    </div>
                    
                    {/* Botón solo visible para el Streamer */}
                    {user?.rol === 'streamer' && Number(user.id) === Number(id) && (
                        <button onClick={toggleStream} className={isStreaming ? "btn-delete" : "btn-neon"}>
                            {isStreaming ? "TERMINAR STREAM 🔴" : "INICIAR STREAM 📡"}
                        </button>
                    )}
                </div>
            </div>

            {/* COLUMNA CHAT */}
            <div className="chat-column">
                <div className="chat-messages">
                    {chat.map((c, i) => (
                        <p key={i} className="chat-msg">
                            {/* Req 13: Badge de Nivel */}
                            <span className="badge-level" style={{
                                background: '#333', 
                                color: 'white', 
                                padding: '2px 5px', 
                                borderRadius: '4px', 
                                fontSize: '0.7rem',
                                marginRight: '5px'
                            }}>
                                Lvl {c.nivel}
                            </span>
                            
                            {/* Nombre con color según rol */}
                            <span className={c.rol === 'streamer' ? "text-neon bold" : "text-white bold"}>
                                {c.user}:
                            </span> 
                            <span style={{marginLeft: '5px', color: '#ccc'}}>{c.msg}</span>
                        </p>
                    ))}
                </div>
                
                <div className="chat-input-area">
                    <form onSubmit={handleChat} style={{display:'flex', width:'100%', gap:'5px'}}>
                        <input 
                            value={mensaje} 
                            onChange={e=>setMensaje(e.target.value)} 
                            className="chat-input" 
                            placeholder={user ? "Escribe..." : "Inicia sesión para chatear"} 
                            disabled={!user}
                        />
                        <button className="btn-chat" disabled={!user}>➤</button>
                    </form>
                </div>
                
                {/* Panel de Regalos (Solo Espectadores) */}
                {user?.rol === 'espectador' && (
                    <div className="gifts-panel">
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                             <span className="text-small">Tus Monedas: <span className="text-neon">{user.monedas}</span></span>
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