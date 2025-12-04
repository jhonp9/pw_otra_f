import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../servicios/api';
import MiModal from '../componentes/MiModal';
import { Link, useNavigate } from 'react-router-dom';

const DashboardUnificado = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
    
    // Estado para compra de monedas
    const [monto, setMonto] = useState(100);
    const [showPayModal, setShowPayModal] = useState(false);
    const [tarjeta, setTarjeta] = useState({ nombre: '', num: '', cvc: '', exp: '' });
    
    // Configuración de Niveles NO LINEAL
    const [nivelesConfig, setNivelesConfig] = useState<Record<string, number>>({});
    const [nuevoNivelKey, setNuevoNivelKey] = useState(2);
    const [nuevoNivelXP, setNuevoNivelXP] = useState(2000);
    
    const [regalos, setRegalos] = useState<any[]>([]);
    const [nuevoRegalo, setNuevoRegalo] = useState({ nombre: '', costo: 0, puntos: 0, icono: '🎁' });

    useEffect(() => {
        if (user?.rol === 'streamer') {
            cargarRegalos();
            if(user.configNiveles) {
                try {
                    const parsed = JSON.parse(user.configNiveles);
                    setNivelesConfig(parsed);
                    const maxLvl = Math.max(...Object.keys(parsed).map(Number), 1);
                    setNuevoNivelKey(maxLvl + 1);
                } catch(e) { setNivelesConfig({}) }
            }
        }
    }, [user]);

    const cargarRegalos = async () => {
        const data = await api.get('/shop/regalos');
        setRegalos(data);
    };

    const agregarConfigNivel = () => {
        setNivelesConfig({ ...nivelesConfig, [nuevoNivelKey]: nuevoNivelXP });
        setNuevoNivelKey(nuevoNivelKey + 1);
        setNuevoNivelXP(nuevoNivelXP + 1000); 
    };

    const eliminarConfigNivel = (lvl: string) => {
        const nueva = { ...nivelesConfig };
        delete nueva[lvl];
        setNivelesConfig(nueva);
    };

    const handleGuardarConfig = async () => {
        if(!user) return;
        try {
            await api.put('/user/config', { userId: user.id, configNiveles: nivelesConfig });
            setModal({isOpen:true, title:'Guardado', message: 'Configuración de experiencia actualizada.'});
            refreshUser();
        } catch (error) {
            setModal({isOpen:true, title:'Error', message: 'No se pudo guardar.'});
        }
    };

    const handleProcesarPago = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        // Validación simple: campos no vacíos
        if(!tarjeta.nombre || !tarjeta.num || !tarjeta.exp || !tarjeta.cvc) return;

        setTimeout(async () => {
            const res = await api.post('/shop/comprar', { userId: user.id, monto });
            await refreshUser(); 
            setShowPayModal(false);
            setModal({ isOpen: true, title: '✅ PAGO EXITOSO', message: `Nuevo saldo: ${res.monedas}` });
            setTarjeta({ nombre:'', num: '', cvc: '', exp: '' });
        }, 1500);
    };

    const handleCrearRegalo = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!user) return;
        await api.post('/shop/regalos/crear', { ...nuevoRegalo, streamerId: user.id });
        await cargarRegalos();
        setNuevoRegalo({ nombre: '', costo: 0, puntos: 0, icono: '🎁' });
        setModal({ isOpen: true, title: 'REGALO CREADO', message: 'Disponible para tus espectadores.' });
    };

    const handleEliminarRegalo = async (id: number) => {
        await api.delete(`/shop/regalos/${id}`);
        cargarRegalos();
    };

    if (!user) return <div className="container text-center text-neon mt-40">Cargando...</div>;

    // Cálculo visual espectador
    const xpMeta = 1000; 
    const xpActualNivel = user.puntosXP % xpMeta;
    const porcentajeNivel = (xpActualNivel / xpMeta) * 100;

    // --- CÁLCULO VISUAL STREAMER CORREGIDO ---
    // Regla: 1 Nivel = 0.01 horas. 
    // Ejemplo: 0.015 horas -> (0.015 * 100) = 1.5 -> % 1 = 0.5 -> * 100 = 50%
    const porcentajeStreamer = Math.floor(((user.horasStream * 100) % 1) * 100);

    // Validación de formulario de pago
    const isFormValid = tarjeta.nombre && tarjeta.num && tarjeta.exp && tarjeta.cvc;

    return (
        <div className="container">
            <MiModal isOpen={modal.isOpen} onClose={() => setModal({...modal, isOpen:false})} type="alert" title={modal.title} message={modal.message} />
            
            {showPayModal && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <button onClick={() => setShowPayModal(false)} className="close-btn">✕</button>
                        <h2 className="text-neon text-center">Pasarela de Pago Segura</h2>
                        <form onSubmit={handleProcesarPago}>
                            <div style={{marginBottom: '15px'}}>
                                <label className="text-muted text-small">Titular de la Tarjeta</label>
                                <input className="auth-input" placeholder="Nombre como aparece en tarjeta" value={tarjeta.nombre} onChange={e=>setTarjeta({...tarjeta, nombre:e.target.value})} required />
                            </div>
                            <div style={{marginBottom: '15px'}}>
                                <label className="text-muted text-small">Número de Tarjeta</label>
                                <input className="auth-input" type="number" placeholder="0000 0000 0000 0000" value={tarjeta.num} onChange={e=>setTarjeta({...tarjeta, num:e.target.value})} required />
                            </div>
                            <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                                <div style={{flex:1}}>
                                    <label className="text-muted text-small">Expiración</label>
                                    <input className="auth-input" placeholder="MM/YY" value={tarjeta.exp} onChange={e=>setTarjeta({...tarjeta, exp:e.target.value})} required />
                                </div>
                                <div style={{flex:1}}>
                                    <label className="text-muted text-small">CVC</label>
                                    <input className="auth-input" type="password" placeholder="123" value={tarjeta.cvc} onChange={e=>setTarjeta({...tarjeta, cvc:e.target.value})} required />
                                </div>
                            </div>
                            <button disabled={!isFormValid} className="btn-neon w-100" style={{opacity: isFormValid ? 1 : 0.5}}>
                                {isFormValid ? `PAGAR $${monto/100}` : 'COMPLETE LOS DATOS'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="profile-header">
                <div className="profile-avatar">{user.nombre.charAt(0)}</div>
                <div>
                    <h1 className="text-neon">{user.nombre}</h1>
                    <p className="text-muted text-uppercase">{user.rol}</p>
                </div>
            </div>

            <div className="dashboard-layout">
                {user.rol === 'espectador' && (
                    <>
                        <div className="stat-card money">
                            <h3 className="text-neon">{user.monedas} 💰</h3>
                            <p className="text-muted">Saldo Disponible</p>
                            <div className="mt-20">
                                <select className="auth-input" style={{width:'auto', display:'inline-block', marginRight:'10px'}} value={monto} onChange={e=>setMonto(Number(e.target.value))}>
                                    <option value="100">100 ($1)</option>
                                    <option value="500">500 ($5)</option>
                                    <option value="1000">1000 ($10)</option>
                                    <option value="5000">5000 ($50)</option>
                                </select>
                                <button onClick={() => setShowPayModal(true)} className="btn-neon">COMPRAR</button>
                            </div>
                        </div>
                        <div className="stat-card">
                            <h3>Nivel {user.nivelEspectador}</h3>
                            <p className="text-muted">Total XP: {user.puntosXP}</p>
                            <div className="progress-bar-container mt-20" style={{background:'#333', height:'10px', borderRadius:'5px', overflow:'hidden'}}>
                                <div style={{width: `${porcentajeNivel}%`, background:'var(--neon)', height:'100%', transition:'width 0.5s'}}></div>
                            </div>
                            <p className="text-small text-muted mt-5">Progreso para siguiente nivel</p>
                        </div>
                    </>
                )}

                {user.rol === 'streamer' && (
                    <>
                        <div className="stat-card" style={{gridColumn: '1 / -1', border: '2px solid var(--neon)'}}>
                            <h2 style={{marginTop:0}}>Panel de Control</h2>
                            <button onClick={() => navigate(`/stream/${user.id}`)} className="btn-neon w-100">📡 IR A MI STREAM</button>
                        </div>

                        <div className="stat-card">
                            <h3>{user.horasStream.toFixed(3)}h</h3>
                            <p className="text-muted">Horas Totales</p>
                        </div>
                        
                        <div className="stat-card">
                            <h3>Nivel Streamer {user.nivelStreamer}</h3>
                            <div className="progress-bar-container mt-20" style={{background:'#333', height:'10px', borderRadius:'5px', overflow:'hidden'}}>
                                <div style={{width: `${porcentajeStreamer}%`, background:'#ff0055', height:'100%', transition:'width 0.5s'}}></div>
                            </div>
                            <p className="text-small text-muted mt-5">{porcentajeStreamer}% para siguiente nivel (Meta: 0.01h)</p>
                        </div>

                        <div className="dashboard-panel w-100 mt-20" style={{gridColumn: '1 / -1'}}>
                            <h3 className="section-title text-small">⚙️ Configuración de XP por Nivel</h3>
                            <p className="text-muted text-small">Define cuánta XP TOTAL necesita un usuario para alcanzar cada nivel.</p>
                            
                            <div style={{display:'flex', gap:'10px', alignItems:'flex-end', marginBottom:'20px'}}>
                                <div>
                                    <label className="text-small text-muted">Nivel</label>
                                    <input type="number" className="auth-input" value={nuevoNivelKey} onChange={e=>setNuevoNivelKey(Number(e.target.value))} style={{width:'80px', margin:0}} />
                                </div>
                                <div>
                                    <label className="text-small text-muted">XP Requerida</label>
                                    <input type="number" className="auth-input" value={nuevoNivelXP} onChange={e=>setNuevoNivelXP(Number(e.target.value))} style={{width:'120px', margin:0}} />
                                </div>
                                <button className="btn-neon" onClick={agregarConfigNivel}>Añadir Regla</button>
                            </div>

                            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'10px'}}>
                                {Object.entries(nivelesConfig).sort((a,b)=>Number(a[0])-Number(b[0])).map(([lvl, xp]) => (
                                    <div key={lvl} style={{background:'#222', padding:'10px', borderRadius:'5px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <span>Lvl {lvl}: <span className="text-neon">{xp} XP</span></span>
                                        <button onClick={()=>eliminarConfigNivel(lvl)} className="text-red" style={{background:'none', border:'none', cursor:'pointer'}}>✕</button>
                                    </div>
                                ))}
                            </div>
                            <button className="btn-secondary mt-20 w-100" onClick={handleGuardarConfig}>GUARDAR CAMBIOS</button>
                        </div>

                        <div className="dashboard-panel w-100 mt-20" style={{gridColumn: '1 / -1'}}>
                            <h3 className="section-title">Gestionar Regalos</h3>
                            <form onSubmit={handleCrearRegalo} className="gift-form mt-20">
                                <div className="input-row" style={{display:'flex', gap:'10px'}}>
                                    <input placeholder="Nombre" className="auth-input" value={nuevoRegalo.nombre} onChange={e=>setNuevoRegalo({...nuevoRegalo, nombre: e.target.value})} required/>
                                    <input placeholder="Icono" className="auth-input" style={{width:'80px'}} value={nuevoRegalo.icono} onChange={e=>setNuevoRegalo({...nuevoRegalo, icono: e.target.value})} required/>
                                </div>
                                <div className="input-row" style={{display:'flex', gap:'10px'}}>
                                    <input type="number" placeholder="Costo" className="auth-input" value={nuevoRegalo.costo || ''} onChange={e=>setNuevoRegalo({...nuevoRegalo, costo: Number(e.target.value)})} required/>
                                    <input type="number" placeholder="XP" className="auth-input" value={nuevoRegalo.puntos || ''} onChange={e=>setNuevoRegalo({...nuevoRegalo, puntos: Number(e.target.value)})} required/>
                                </div>
                                <button className="btn-neon w-100 mt-10">CREAR +</button>
                            </form>
                            <div className="gift-grid mt-20">
                                {regalos.map(r => (
                                    <div key={r.id} className="gift-card-compact" style={{border:'1px solid #333', padding:'10px', textAlign:'center', borderRadius:'8px'}}>
                                        <span style={{fontSize:'2rem'}}>{r.icono}</span>
                                        <p className="bold">{r.nombre}</p>
                                        <p className="text-small">{r.costo} Monedas / {r.puntos} XP</p>
                                        <button onClick={()=>handleEliminarRegalo(r.id)} className="btn-delete mt-10">Eliminar</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
            <div className="text-center mt-40">
                <Link to="/"><button className="btn-regresar">Volver al Inicio</button></Link>
            </div>
        </div>
    );
};
export default DashboardUnificado;