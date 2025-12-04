// jhonp9/pw_otra_f/pw_otra_f-da43e77ca85f163b483dcad2d37ca90dd34b4584/src/paginas/StreamRoom.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';

interface MensajeChat {
    user: string;
    msg: string;
    nivel: number;
    rol: string;
}

const StreamRoom = () => {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const [streamInfo, setStreamInfo] = useState<any>(null);
    const [chat, setChat] = useState<MensajeChat[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [regalos, setRegalos] = useState<any[]>([]);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    
    // Estado Overlay
    const [overlayGift, setOverlayGift] = useState<string | null>(null);

    // Estado Streamer
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentStreamId, setCurrentStreamId] = useState<number|null>(null);
    const [metaXpStreamer, setMetaXpStreamer] = useState(1000);
    
    // Polling Ref
    const lastCheckRef = useRef<number>(Date.now());

    // 1. Cargar datos iniciales
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
                    
                    // Verificar si ya está streameando (para recuperar estado al refrescar)
                    const streams = await api.get('/streams');
                    const myStream = streams.find((s:any) => s.usuarioId === Number(id));
                    if(myStream) {
                        setIsStreaming(true);
                        setCurrentStreamId(myStream.id);
                    }

                } catch (e) { console.error("Error cargando streamer"); }
            }
            const regalosData = await api.get('/shop/regalos');
            setRegalos(regalosData);
        };
        fetchDatos();
    }, [id]);

    // 2. REQ 20: POLLING PARA OVERLAY DEL STREAMER (Cada 3 segundos)
    useEffect(() => {
        let interval: any;
        if (user?.rol === 'streamer' && Number(user.id) === Number(id)) {
            interval = setInterval(async () => {
                try {
                    const eventos = await api.get(`/shop/eventos?since=${lastCheckRef.current}`);
                    if (eventos.length > 0) {
                        // Tomar el último evento para mostrar
                        const ultimo = eventos[eventos.length - 1];
                        setOverlayGift(ultimo.detalle);
                        lastCheckRef.current = Date.now(); // Actualizar timestamp
                        
                        // Auto ocultar a los 4 seg
                        setTimeout(() => setOverlayGift(null), 4000);
                        
                        // Añadir al chat como sistema
                        setChat(prev => [...prev, {
                            user: "SISTEMA",
                            msg: ultimo.detalle,
                            nivel: 0,
                            rol: "sistema"
                        }]);
                    }
                } catch (e) { /* silent fail */ }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [user, id]);

    // 3. Manejar Chat y XP
    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !mensaje.trim()) return;

        // REQ 11: 1 Punto por mensaje
        const res = await api.post('/user/chat-xp', { 
            userId: user.id, 
            currentMetaXp: metaXpStreamer 
        });
        
        // REQ 14: Notificación nivel
        if (res.subioNivel) {
             setModal({ 
                isOpen: true, 
                title: '¡SUBISTE DE NIVEL! 🚀', 
                message: `Has alcanzado el Nivel ${res.nivel} en este canal.` 
            });
        }
        
        // ¡IMPORTANTE! Refrescar usuario siempre para ver progreso de XP en Dashboard o perfil
        refreshUser();

        const nuevoMensaje: MensajeChat = {
            user: user.nombre,
            msg: mensaje,
            nivel: res.nivel || user.nivelEspectador,
            rol: user.rol
        };
        setChat([...chat, nuevoMensaje]);
        setMensaje("");
    };

    // 4. Enviar Regalo (Espectador)
    const handleEnviarRegalo = async (regalo: any) => {
        if (!user) return;
        
        // REQ 19: Enviamos streamerId para que el backend sepa a quien notificar
        const res = await api.post('/shop/enviar', { 
            viewerId: user.id, 
            regaloId: regalo.id,
            streamerId: id // El ID de la URL es el del streamer
        });
        
        if (res.success) {
            await refreshUser();
            
            // Animación Local (Feedback inmediato al que envía)
            setOverlayGift(`Enviaste ${regalo.icono}`);
            setTimeout(() => setOverlayGift(null), 4000);

            setChat([...chat, { 
                user: "SISTEMA", 
                msg: `${user.nombre} ha enviado ${regalo.nombre} 🎁`,
                nivel: 0,
                rol: "sistema"
            }]);

            if (res.subioNivel) {
                setModal({ isOpen: true, title: '¡NIVEL SUBIDO!', message: `Felicidades, has alcanzado el Nivel ${res.nivel} 🎉` });
            }
        } else {
            setModal({ isOpen: true, title: 'ERROR', message: res.msg || 'Saldo insuficiente' });
        }
    };

    // 5. Control Stream
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
        } else {
            const res = await api.post('/streams/stop', { 
                userId: user.id, 
                streamId: currentStreamId 
            });
            setIsStreaming(false);
            setCurrentStreamId(null);
            
            // REQ 16: Aviso al subir de nivel por horas
            if (res.subioNivel) {
                setModal({ isOpen:true, title:'¡LEVEL UP STREAMER!', message:`Has subido al nivel ${res.nivel} por tus horas transmitidas.`});
            } else {
                setModal({ isOpen:true, title:'Stream Finalizado', message:'Tus horas han sido registradas.'});
            }
            refreshUser(); // Actualizar horas
        }
    };

    if (!streamInfo) return <div className="text-center mt-40">Cargando sala...</div>;

    return (
        <div className="stream-room-layout">
            <MiModal isOpen={modal.isOpen} onClose={()=>setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message}/>
            
            {/* OVERLAY ANIMADO (Para Streamer y Viewer) */}
            {overlayGift && (
                <div className="gift-overlay-animation">
                    <h1 className="text-neon" style={{fontSize:'3rem'}}>🎉 {overlayGift} 🎉</h1>
                </div>
            )}

            <div className="video-column">
                <div className="video-player-container">
                    <h1 className="text-neon" style={{fontSize:'3rem'}}>
                        {isStreaming ? "EN VIVO 🔴" : "OFFLINE ⚫"}
                    </h1>
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
                        <p key={i} className="chat-msg">
                            {c.nivel > 0 && (
                                <span className="badge-level" style={{background: '#333', color: 'white', padding: '2px 5px', borderRadius: '4px', fontSize: '0.7rem', marginRight: '5px'}}>
                                    Lvl {c.nivel}
                                </span>
                            )}
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