import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import {
  collection, addDoc, getDocs, updateDoc, doc,
  serverTimestamp, query, orderBy, where
} from "firebase/firestore";
import L from "leaflet";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const CLOUDINARY_CLOUD = process.env.REACT_APP_CLOUDINARY_CLOUD;
const CLOUDINARY_PRESET = process.env.REACT_APP_CLOUDINARY_PRESET;

const STATUS = {
  aberto:           { label: "Aberto",          emoji: "🔴", cor: "#B91C1C", bg: "#FEE2E2" },
  "em analise":     { label: "Em análise",      emoji: "🔵", cor: "#1D4ED8", bg: "#DBEAFE" },
  "em atendimento": { label: "Em atendimento",  emoji: "🟡", cor: "#B45309", bg: "#FEF3C7" },
  resolvido:        { label: "Resolvido",        emoji: "🟢", cor: "#0A7C4E", bg: "#DCFCE7" },
  finalizado:       { label: "Finalizado",       emoji: "⚫", cor: "#475569", bg: "#F1F5F9" },
};
const FLUXO_STATUS = ["aberto", "em analise", "em atendimento", "resolvido", "finalizado"];

const CATEGORIA_COR = {
  buraco:     "#B91C1C",
  iluminacao: "#B45309",
  lixo:       "#1D4ED8",
  calcada:    "#7C3AED",
  arvore:     "#0A7C4E",
  esgoto:     "#0E7490",
  outro:      "#475569",
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ── COMPONENTES ───────────────────────────────────────────────────────────
function Btn({ onClick, children, color = "blue", disabled = false }) {
  const [pressed, setPressed] = useState(false);
  const bg = {
    blue:  "linear-gradient(135deg,#0D1F4E,#1B4FD8)",
    green: "linear-gradient(135deg,#0A7C4E,#10B981)",
    gray:  "#94A3B8",
  };
  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); if (!disabled) onClick(); }}
      onPointerLeave={() => setPressed(false)}
      disabled={disabled}
      style={{
        width: "100%", padding: "16px", borderRadius: 12,
        background: disabled ? bg.gray : bg[color],
        color: "white", fontSize: 16, fontWeight: 700,
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        marginBottom: 12,
        transform: pressed ? "scale(0.97)" : "scale(1)",
        boxShadow: pressed ? "0 2px 8px rgba(0,0,0,0.15)" : "0 4px 16px rgba(0,0,0,0.18)",
        transition: "transform 0.1s, box-shadow 0.1s",
        WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
      }}
    >{children}</button>
  );
}

function Card({ onClick, children, highlight = false }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onPointerDown={() => onClick && setPressed(true)}
      onPointerUp={() => { setPressed(false); if (onClick) onClick(); }}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: pressed ? "#EEF3FE" : "white",
        borderRadius: 20, padding: 24,
        boxShadow: pressed ? "0 2px 8px rgba(0,0,0,0.08)" : "0 4px 20px rgba(0,0,0,0.06)",
        cursor: onClick ? "pointer" : "default",
        border: highlight ? "2px solid #1B4FD8" : "2px solid #F1F5F9",
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "transform 0.1s, box-shadow 0.1s, background 0.1s",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none", touchAction: "manipulation",
      }}
    >{children}</div>
  );
}

function Link({ onClick, children }) {
  return (
    <span onPointerUp={() => onClick()} style={{
      color: "#1B4FD8", fontWeight: 700, cursor: "pointer",
      padding: "8px 4px", display: "inline-block",
      WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
    }}>{children}</span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS["aberto"];
  return (
    <span style={{
      background: s.bg, color: s.cor, fontSize: 12, fontWeight: 700,
      padding: "4px 12px", borderRadius: 20, display: "inline-block"
    }}>{s.emoji} {s.label}</span>
  );
}

function Timeline({ historico }) {
  if (!historico || historico.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1F4E", marginBottom: 10 }}>📋 Histórico</div>
      <div style={{ position: "relative", paddingLeft: 20 }}>
        <div style={{ position: "absolute", left: 7, top: 0, bottom: 0, width: 2, background: "#E2E8F0" }} />
        {historico.map((h, i) => {
          const s = STATUS[h.status] || STATUS["aberto"];
          return (
            <div key={i} style={{ position: "relative", marginBottom: 14 }}>
              <div style={{ position: "absolute", left: -20, top: 2, width: 14, height: 14, borderRadius: "50%", background: s.cor, border: "2px solid white", boxShadow: "0 0 0 2px " + s.cor }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: s.cor }}>{s.emoji} {s.label}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{h.criadoEm?.toDate ? h.criadoEm.toDate().toLocaleString("pt-BR") : ""}</div>
              {h.obs && <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{h.obs}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── UPLOAD DE FOTO ────────────────────────────────────────────────────────
function UploadFoto({ foto, setFoto, preview, setPreview }) {
  function handleArquivo(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    if (!["image/jpeg", "image/png"].includes(arquivo.type)) { alert("Apenas JPG e PNG."); return; }
    if (arquivo.size > 5 * 1024 * 1024) { alert("Máximo 5MB."); return; }
    setFoto(arquivo);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(arquivo);
  }
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>
        📷 Foto <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 400 }}>(opcional · JPG/PNG · máx 5MB)</span>
      </label>
      {preview ? (
        <div style={{ position: "relative" }}>
          <img src={preview} alt="preview" style={{ width: "100%", borderRadius: 12, maxHeight: 220, objectFit: "cover", border: "2px solid #E2E8F0" }} />
          <button onClick={() => { setFoto(null); setPreview(null); }}
            style={{ position: "absolute", top: 8, right: 8, background: "#B91C1C", color: "white", border: "none", borderRadius: 20, width: 28, height: 28, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
        </div>
      ) : (
        <label style={{ display: "block", border: "2px dashed #CBD5E1", borderRadius: 12, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: "#F8FAFC" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
          <div style={{ fontSize: 14, color: "#64748B" }}>Clique para adicionar uma foto</div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>JPG ou PNG · máx 5MB</div>
          <input type="file" accept="image/jpeg,image/png" onChange={handleArquivo} style={{ display: "none" }} />
        </label>
      )}
    </div>
  );
}

// ── MAPA LEAFLET ──────────────────────────────────────────────────────────
function MapaChamados({ chamados }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (mapInstanceRef.current) return;
    mapInstanceRef.current = L.map(mapRef.current).setView([-15.7801, -47.9292], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(mapInstanceRef.current);
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.eachLayer(layer => { if (layer instanceof L.Marker) layer.remove(); });
    const validos = chamados.filter(c => c.latitude && c.longitude);
    if (validos.length === 0) return;
    validos.forEach(c => {
      const cor = CATEGORIA_COR[c.categoria] || "#475569";
      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 24 14 24s14-14.667 14-24C28 6.268 21.732 0 14 0z" fill="${cor}"/><circle cx="14" cy="14" r="6" fill="white"/></svg>`;
      const icon = L.divIcon({ html: svgIcon, className: "", iconSize: [28, 38], iconAnchor: [14, 38] });
      const s = STATUS[c.status] || STATUS["aberto"];
      const popup = `<div style="min-width:200px;font-family:Arial,sans-serif"><div style="font-weight:700;font-size:14px;color:#0D1F4E;margin-bottom:6px">${c.titulo}</div><div style="font-size:12px;color:#64748B;margin-bottom:6px">${c.descricao}</div><span style="background:${s.bg};color:${s.cor};font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">${s.emoji} ${s.label}</span>${c.fotoURL ? `<br/><img src="${c.fotoURL}" style="width:100%;border-radius:6px;margin-top:8px;max-height:120px;object-fit:cover"/>` : ""}</div>`;
      L.marker([c.latitude, c.longitude], { icon }).addTo(mapInstanceRef.current).bindPopup(popup);
    });
    mapInstanceRef.current.setView([validos[0].latitude, validos[0].longitude], 13);
  }, [chamados]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {Object.entries(CATEGORIA_COR).map(([cat, cor]) => (
          <span key={cat} style={{ background: cor + "22", color: cor, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: `1px solid ${cor}44` }}>● {cat}</span>
        ))}
      </div>
      <div ref={mapRef} style={{ width: "100%", height: 460, borderRadius: 16, overflow: "hidden", border: "2px solid #E2E8F0" }} />
      {chamados.filter(c => c.latitude && c.longitude).length === 0 && (
        <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, marginTop: 12 }}>Nenhum chamado com localização ainda.</div>
      )}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({ chamados }) {
  const porCategoria = Object.entries(
    chamados.reduce((acc, c) => { acc[c.categoria] = (acc[c.categoria] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value, fill: CATEGORIA_COR[name] || "#475569" }));

  const porStatus = Object.entries(
    chamados.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: STATUS[name]?.label || name, value, fill: STATUS[name]?.cor || "#475569" }));

  const porMes = chamados.reduce((acc, c) => {
    if (!c.criadoEm?.toDate) return acc;
    const d = c.criadoEm.toDate();
    const key = `${MESES[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const dadosMes = Object.entries(porMes).slice(-6).map(([mes, total]) => ({ mes, total }));

  const resolvidos = chamados.filter(c => (c.status === "resolvido" || c.status === "finalizado") && c.criadoEm?.toDate);
  const tempoMedio = resolvidos.length > 0
    ? (resolvidos.reduce((acc, c) => acc + (Date.now() - c.criadoEm.toDate().getTime()) / (1000 * 60 * 60 * 24), 0) / resolvidos.length).toFixed(1)
    : null;

  const cardStyle = { background: "white", borderRadius: 16, padding: 24, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: 20 };
  const tituloGrafico = { fontSize: 15, fontWeight: 700, color: "#0D1F4E", marginBottom: 16 };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total de Chamados", valor: chamados.length, cor: "#1B4FD8", emoji: "📋" },
          { label: "Em Aberto", valor: chamados.filter(c => c.status === "aberto").length, cor: "#B91C1C", emoji: "🔴" },
          { label: "Em Andamento", valor: chamados.filter(c => c.status === "em analise" || c.status === "em atendimento").length, cor: "#B45309", emoji: "🟡" },
          { label: "Resolvidos", valor: chamados.filter(c => c.status === "resolvido" || c.status === "finalizado").length, cor: "#0A7C4E", emoji: "🟢" },
          { label: "Tempo Médio (dias)", valor: tempoMedio || "—", cor: "#7C3AED", emoji: "⏱️" },
        ].map((k, i) => (
          <div key={i} style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", borderTop: `4px solid ${k.cor}` }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{k.emoji}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.cor }}>{k.valor}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={cardStyle}>
        <div style={tituloGrafico}>📂 Ocorrências por Categoria</div>
        {porCategoria.length === 0 ? <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Sem dados ainda</div> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porCategoria} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Chamados" radius={[6, 6, 0, 0]}>
                {porCategoria.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={cardStyle}>
        <div style={tituloGrafico}>📊 Ocorrências por Status</div>
        {porStatus.length === 0 ? <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Sem dados ainda</div> : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {porStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={cardStyle}>
        <div style={tituloGrafico}>📅 Chamados por Mês</div>
        {dadosMes.length === 0 ? <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Sem dados ainda</div> : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dadosMes} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" name="Chamados" stroke="#1B4FD8" strokeWidth={3} dot={{ fill: "#1B4FD8", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── LIGHTBOX ──────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
      <img src={src} alt="foto ampliada" onClick={e => e.stopPropagation()} style={{ maxWidth: "94vw", maxHeight: "90vh", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.6)", objectFit: "contain" }} />
      <button onClick={onClose} style={{ position: "fixed", top: 20, right: 20, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 20, width: 40, height: 40, fontSize: 20, cursor: "pointer", fontWeight: 700 }}>×</button>
    </div>
  );
}

async function uploadCloudinary(arquivo) {
  const formData = new FormData();
  formData.append("file", arquivo);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: formData });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Erro no upload");
  return data.secure_url;
}

const inputStyle = {
  width: "100%", padding: "14px 16px", borderRadius: 12,
  border: "1.5px solid #E2E8F0", fontSize: 16,
  marginBottom: 12, boxSizing: "border-box", outline: "none",
  WebkitAppearance: "none", touchAction: "manipulation",
};

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────
export default function App() {
  const [tela, setTela]               = useState("login");
  const [tipoLogin, setTipoLogin]     = useState("cidadao");
  const [email, setEmail]             = useState("");
  const [senha, setSenha]             = useState("");
  const [erro, setErro]               = useState("");
  const [usuario, setUsuario]         = useState(null);
  const [municipio, setMunicipio]     = useState(null);
  const [municipios, setMunicipios]   = useState([]);
  const [municipioSel, setMunicipioSel] = useState("");
  const [titulo, setTitulo]           = useState("");
  const [descricao, setDescricao]     = useState("");
  const [categoria, setCategoria]     = useState("");
  const [foto, setFoto]               = useState(null);
  const [preview, setPreview]         = useState(null);
  const [enviando, setEnviando]       = useState(false);
  const [sucesso, setSucesso]         = useState(false);
  const [localizacao, setLocalizacao] = useState(null);
  const [chamados, setChamados]               = useState([]);
  const [meusChamados, setMeusChamados]       = useState([]);
  const [carregando, setCarregando]           = useState(false);
  const [chamadoDetalhe, setChamadoDetalhe]   = useState(null);
  const [historicoDetalhe, setHistoricoDetalhe] = useState([]);
  const [obsStatus, setObsStatus]             = useState("");
  const [abaPainel, setAbaPainel]             = useState("dashboard");
  const [fotoLightbox, setFotoLightbox]       = useState(null);

  // Carrega municípios ativos
  useEffect(() => {
    async function carregarMunicipios() {
      try {
        const q = query(collection(db, "municipios"), where("ativo", "==", true));
        const snap = await getDocs(q);
        setMunicipios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
    }
    carregarMunicipios();
  }, []);

  // ── AUTH ──────────────────────────────────────────────────────────────────
  async function entrar() {
    setErro("");
    if (!municipioSel) { setErro("Selecione sua cidade."); return; }
    try {
      const result = await signInWithEmailAndPassword(auth, email, senha);
      const munSelecionado = municipios.find(m => m.id === municipioSel);
      const isAdmin = result.user.email === munSelecionado?.adminEmail;
      if (tipoLogin === "admin" && !isAdmin) { await signOut(auth); setErro("Acesso negado para este e-mail."); return; }
      if (tipoLogin === "cidadao" && isAdmin) { await signOut(auth); setErro("Use o acesso Administração."); return; }
      setUsuario(result.user);
      setMunicipio(munSelecionado);
      setTela(isAdmin ? "painel" : "home");
    } catch (e) { setErro("E-mail ou senha incorretos."); }
  }

  async function cadastrar() {
    setErro("");
    if (!municipioSel) { setErro("Selecione sua cidade."); return; }
    if (!email || !senha) { setErro("Preencha e-mail e senha."); return; }
    if (senha.length < 6) { setErro("Senha precisa ter pelo menos 6 caracteres."); return; }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, senha);
      setUsuario(result.user);
      setMunicipio(municipios.find(m => m.id === municipioSel));
      setTela("home");
    } catch (e) {
      if (e.code === "auth/email-already-in-use") setErro("E-mail já cadastrado.");
      else setErro("Erro ao cadastrar. Tente novamente.");
    }
  }

  async function esqueceuSenha() {
    if (!email) { setErro("Digite seu e-mail primeiro."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      alert("E-mail de redefinição enviado!");
    } catch (e) { setErro("E-mail não encontrado."); }
  }

  async function sair() {
    await signOut(auth);
    setUsuario(null); setEmail(""); setSenha("");
    setMunicipio(null); setMunicipioSel("");
    setTela("login");
  }

  function capturarLocalizacao() {
    if (!navigator.geolocation) { alert("Dispositivo não suporta geolocalização."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocalizacao({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => alert("Não foi possível obter localização.")
    );
  }

  async function enviarReporte() {
    if (!titulo || !descricao || !categoria) { alert("Preencha todos os campos!"); return; }
    setEnviando(true);
    try {
      let fotoURL = null;
      if (foto) fotoURL = await uploadCloudinary(foto);
      const docRef = await addDoc(collection(db, "chamados"), {
        titulo, descricao, categoria, status: "aberto",
        email: usuario.email, userId: usuario.uid,
        municipioId: municipio.id,
        municipioNome: municipio.nome,
        fotoURL: fotoURL || null,
        latitude: localizacao?.latitude || null,
        longitude: localizacao?.longitude || null,
        criadoEm: serverTimestamp()
      });
      await addDoc(collection(db, "chamados", docRef.id, "historico"), {
        status: "aberto", obs: "Ocorrência registrada pelo cidadão.", criadoEm: serverTimestamp()
      });
      setSucesso(true);
      setTitulo(""); setDescricao(""); setCategoria("");
      setFoto(null); setPreview(null); setLocalizacao(null);
    } catch (e) { alert("Erro ao enviar."); console.error(e); }
    setEnviando(false);
  }

  async function carregarMeusChamados() {
    if (!usuario) return;
    setCarregando(true);
    try {
      const q = query(collection(db, "chamados"), where("userId", "==", usuario.uid), orderBy("criadoEm", "desc"));
      const snap = await getDocs(q);
      setMeusChamados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setCarregando(false);
  }

  async function abrirDetalhe(chamado) {
    setChamadoDetalhe(chamado);
    try {
      const q = query(collection(db, "chamados", chamado.id, "historico"), orderBy("criadoEm", "asc"));
      const snap = await getDocs(q);
      setHistoricoDetalhe(snap.docs.map(d => d.data()));
    } catch (e) { setHistoricoDetalhe([]); }
    setTela("detalhe");
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tela === "meus-chamados") carregarMeusChamados(); }, [tela]);

  async function carregarChamados() {
    if (!municipio) return;
    setCarregando(true);
    try {
      const q = query(collection(db, "chamados"), where("municipioId", "==", municipio.id), orderBy("criadoEm", "desc"));
      const snap = await getDocs(q);
      setChamados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setCarregando(false);
  }

  async function mudarStatus(id, novoStatus) {
    try {
      await updateDoc(doc(db, "chamados", id), { status: novoStatus });
      await addDoc(collection(db, "chamados", id, "historico"), {
        status: novoStatus, obs: obsStatus || "", criadoEm: serverTimestamp()
      });
      setObsStatus(""); carregarChamados();
    } catch (e) { alert("Erro ao atualizar status."); }
  }

  useEffect(() => { if (tela === "painel") carregarChamados(); }, [tela]);

  // ── DETALHE ───────────────────────────────────────────────────────────────
  if (tela === "detalhe" && chamadoDetalhe) return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Arial, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#0D1F4E,#1B4FD8)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => setTela("meus-chamados")} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 14 }}>← Voltar</button>
        <div style={{ fontSize: 20, fontWeight: 900, color: "white" }}>📋 Detalhe do Chamado</div>
      </div>
      <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div style={{ marginBottom: 12 }}><StatusBadge status={chamadoDetalhe.status} /></div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0D1F4E", marginBottom: 8 }}>{chamadoDetalhe.titulo}</div>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 8 }}>{chamadoDetalhe.descricao}</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 4 }}>📂 {chamadoDetalhe.categoria}</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 4 }}>📅 {chamadoDetalhe.criadoEm?.toDate ? chamadoDetalhe.criadoEm.toDate().toLocaleDateString("pt-BR") : ""}</div>
          {chamadoDetalhe.latitude && <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>📍 Localização registrada</div>}
          {chamadoDetalhe.fotoURL && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1F4E", marginBottom: 8 }}>📷 Foto</div>
              <img src={chamadoDetalhe.fotoURL} alt="foto" style={{ width: "100%", borderRadius: 12, maxHeight: 260, objectFit: "cover" }} />
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1F4E", marginBottom: 10 }}>Progresso</div>
            <div style={{ display: "flex", gap: 4 }}>
              {FLUXO_STATUS.map((s, i) => {
                const idx = FLUXO_STATUS.indexOf(chamadoDetalhe.status);
                const ativo = i <= idx;
                const st = STATUS[s];
                return (
                  <div key={s} style={{ flex: 1 }}>
                    <div style={{ height: 6, borderRadius: 3, background: ativo ? st.cor : "#E2E8F0", marginBottom: 4 }} />
                    <div style={{ fontSize: 9, color: ativo ? st.cor : "#94A3B8", textAlign: "center", fontWeight: 700 }}>{st.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <Timeline historico={historicoDetalhe} />
        </div>
      </div>
    </div>
  );

  // ── MEUS CHAMADOS ─────────────────────────────────────────────────────────
  if (tela === "meus-chamados") return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Arial, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#0D1F4E,#1B4FD8)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => setTela("home")} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 14 }}>← Voltar</button>
        <div style={{ fontSize: 20, fontWeight: 900, color: "white" }}>📋 Meus Chamados</div>
      </div>
      <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
        {carregando ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}>Carregando...</div>
        ) : meusChamados.length === 0 ? (
          <div style={{ background: "white", borderRadius: 20, padding: 40, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0D1F4E", marginBottom: 8 }}>Nenhum chamado ainda</div>
            <div style={{ fontSize: 14, color: "#64748B", marginBottom: 24 }}>Você ainda não reportou nenhum problema.</div>
            <Btn onClick={() => setTela("reporte")}>Reportar agora</Btn>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {meusChamados.map(c => (
              <div key={c.id} onClick={() => abrirDetalhe(c)} style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", cursor: "pointer", border: "2px solid #F1F5F9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0D1F4E", flex: 1, marginRight: 12 }}>{c.titulo}</div>
                  <StatusBadge status={c.status} />
                </div>
                {c.fotoURL && <img src={c.fotoURL} alt="foto" style={{ width: "100%", borderRadius: 10, maxHeight: 140, objectFit: "cover", marginBottom: 8 }} />}
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 6 }}>{c.descricao}</div>
                <div style={{ fontSize: 12, color: "#94A3B8", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>📂 {c.categoria}</span>
                  <span>📅 {c.criadoEm?.toDate ? c.criadoEm.toDate().toLocaleDateString("pt-BR") : ""}</span>
                  {c.latitude && <span>📍 Localização</span>}
                </div>
                <div style={{ fontSize: 12, color: "#1B4FD8", marginTop: 8, fontWeight: 700 }}>Ver detalhes →</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── PAINEL ADMIN ──────────────────────────────────────────────────────────
  if (tela === "painel") return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Arial, sans-serif" }}>
      <Lightbox src={fotoLightbox} onClose={() => setFotoLightbox(null)} />
      <div style={{ background: "linear-gradient(135deg,#0D1F4E,#1B4FD8)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "white" }}>🏛️ {municipio?.nome}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Cívico — Gestão de Chamados</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={carregarChamados} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>🔄</button>
          <button onClick={sair} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Sair</button>
        </div>
      </div>
      <div style={{ background: "white", borderBottom: "1px solid #E2E8F0", display: "flex" }}>
        {[["dashboard","📊 Dashboard"], ["lista","📋 Chamados"], ["mapa","🗺️ Mapa"]].map(([aba, label]) => (
          <button key={aba} onClick={() => setAbaPainel(aba)} style={{
            padding: "14px 20px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
            background: "transparent",
            color: abaPainel === aba ? "#1B4FD8" : "#94A3B8",
            borderBottom: abaPainel === aba ? "3px solid #1B4FD8" : "3px solid transparent",
          }}>{label}</button>
        ))}
      </div>
      <div style={{ padding: "20px 16px", maxWidth: 1100, margin: "0 auto" }}>
        {abaPainel === "dashboard" && (carregando ? <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>Carregando...</div> : <Dashboard chamados={chamados} />)}
        {abaPainel === "mapa" && (
          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0D1F4E", marginBottom: 16 }}>🗺️ Mapa de Ocorrências</div>
            <MapaChamados chamados={chamados} />
          </div>
        )}
        {abaPainel === "lista" && (
          <div style={{ background: "white", borderRadius: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ background: "#0D1F4E", padding: "14px 20px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>📋 Chamados Recebidos</div>
            </div>
            {carregando ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Carregando...</div>
            ) : chamados.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
                Nenhum chamado ainda.<br /><br />
                <button onClick={carregarChamados} style={{ background: "#1B4FD8", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 700 }}>Carregar chamados</button>
              </div>
            ) : chamados.map((c, i) => (
              <div key={c.id} style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <StatusBadge status={c.status} />
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>{c.categoria}</span>
                  {c.latitude && <span style={{ fontSize: 12, color: "#0A7C4E", fontWeight: 700 }}>📍 Com localização</span>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1F4E", marginBottom: 4 }}>{c.titulo}</div>
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>{c.descricao}</div>
                {c.fotoURL && (
                  <div style={{ marginBottom: 10, cursor: "zoom-in" }} onClick={() => setFotoLightbox(c.fotoURL)}>
                    <img src={c.fotoURL} alt="foto" style={{ width: "100%", maxWidth: 320, borderRadius: 10, maxHeight: 180, objectFit: "cover" }} />
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>🔍 Clique para ampliar</div>
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 10 }}>👤 {c.email}</div>
                <input placeholder="Observação (opcional)" value={obsStatus} onChange={e => setObsStatus(e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: "8px 12px", marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {FLUXO_STATUS.filter(s => s !== c.status).map(s => {
                    const st = STATUS[s];
                    return (
                      <button key={s} onClick={() => mudarStatus(c.id, s)}
                        style={{ background: st.bg, color: st.cor, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                      >{st.emoji} {st.label}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── REPORTE ───────────────────────────────────────────────────────────────
  if (tela === "reporte") return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Arial, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#0D1F4E,#1B4FD8)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => { setTela("home"); setSucesso(false); }} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 14 }}>← Voltar</button>
        <div style={{ fontSize: 20, fontWeight: 900, color: "white" }}>📸 Reportar Problema</div>
      </div>
      <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
        {sucesso ? (
          <div style={{ background: "white", borderRadius: 20, padding: 40, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0A7C4E", marginBottom: 8 }}>Reporte enviado!</div>
            <div style={{ fontSize: 15, color: "#64748B", marginBottom: 28 }}>Sua solicitação foi registrada em {municipio?.nome}.</div>
            <Btn onClick={() => setSucesso(false)}>Reportar outro</Btn>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ background: "#EEF3FE", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "#1B4FD8", fontWeight: 700 }}>🏙️ {municipio?.nome} — {municipio?.estado}</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                <option value="">Selecione...</option>
                <option value="buraco">🕳️ Buraco na rua</option>
                <option value="iluminacao">💡 Iluminação pública</option>
                <option value="lixo">🗑️ Lixo acumulado</option>
                <option value="calcada">🚶 Calçada danificada</option>
                <option value="arvore">🌳 Árvore caída</option>
                <option value="esgoto">💧 Esgoto a céu aberto</option>
                <option value="outro">📌 Outro</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>Título</label>
              <input placeholder="Ex: Buraco na Rua das Flores" value={titulo} onChange={e => setTitulo(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>Descrição</label>
              <textarea placeholder="Descreva o problema..." value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <UploadFoto foto={foto} setFoto={setFoto} preview={preview} setPreview={setPreview} />
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>
                📍 Localização <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 400 }}>(opcional)</span>
              </label>
              {localizacao ? (
                <div style={{ background: "#DCFCE7", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#0A7C4E", fontWeight: 700 }}>✅ Localização capturada!</span>
                  <button onClick={() => setLocalizacao(null)} style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Remover</button>
                </div>
              ) : (
                <button onClick={capturarLocalizacao} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "2px dashed #CBD5E1", background: "#F8FAFC", cursor: "pointer", fontSize: 14, color: "#64748B", fontWeight: 600 }}>
                  📍 Capturar minha localização
                </button>
              )}
            </div>
            <Btn onClick={enviarReporte} disabled={enviando}>{enviando ? "Enviando..." : "📤 Enviar Reporte"}</Btn>
          </div>
        )}
      </div>
    </div>
  );

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (tela === "home") return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Arial, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#0D1F4E,#1B4FD8)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>🏙️ Cívico</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{municipio?.nome} — {municipio?.estado}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={sair} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Sair</button>
        </div>
      </div>
      <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ color: "#0D1F4E", fontSize: 26, fontWeight: 900, marginBottom: 6 }}>Olá! 👋</h2>
        <p style={{ color: "#64748B", marginBottom: 28 }}>O que você quer fazer hoje?</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card onClick={() => setTela("reporte")} highlight>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📸</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1F4E", marginBottom: 6 }}>Reportar Problema</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>Registre um problema na sua cidade</div>
          </Card>
          <Card onClick={() => setTela("meus-chamados")}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1F4E", marginBottom: 6 }}>Meus Chamados</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>Acompanhe o status dos seus reportes</div>
          </Card>
        </div>
      </div>
    </div>
  );

  // ── LOGIN / CADASTRO ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0D1F4E 0%,#1B4FD8 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 24, padding: "40px 32px", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: "#0D1F4E", letterSpacing: -1 }}>🏙️ Cívico</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>A cidade nas suas mãos</div>
        </div>

        {/* Seletor de cidade */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>🏙️ Selecione sua cidade</label>
          <select value={municipioSel} onChange={e => setMunicipioSel(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
            <option value="">Selecione...</option>
            {municipios.map(m => (
              <option key={m.id} value={m.id}>{m.nome} — {m.estado}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {[["cidadao", "👤 Cidadão"], ["admin", "🏛️ Administração"]].map(([val, label]) => (
            <button key={val} onClick={() => { setTipoLogin(val); setErro(""); setTela("login"); }}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 9, border: "none", cursor: "pointer",
                fontSize: val === "admin" ? 13 : 14, fontWeight: 700,
                background: tipoLogin === val ? "white" : "transparent",
                color: tipoLogin === val ? "#0D1F4E" : "#94A3B8",
                boxShadow: tipoLogin === val ? "0 2px 8px rgba(0,0,0,0.10)" : "none",
                transition: "all 0.2s",
              }}
            >{label}</button>
          ))}
        </div>

        {erro && <div style={{ background: "#FEE2E2", color: "#B91C1C", fontSize: 14, marginBottom: 16, padding: "10px 14px", borderRadius: 10, textAlign: "center" }}>{erro}</div>}
        <input placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} />
        <input placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} type="password" style={{ ...inputStyle, marginBottom: 20 }} />

        {tela === "login" ? (
          <>
            <Btn onClick={entrar}>Entrar</Btn>
            {tipoLogin === "cidadao" && (
              <div style={{ textAlign: "center", fontSize: 14, color: "#94A3B8", marginTop: 4 }}>
                Não tem conta?{" "}
                <Link onClick={() => { setTela("cadastro"); setErro(""); }}>Cadastre-se</Link>
              </div>
            )}
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <Link onClick={esqueceuSenha}>Esqueci minha senha</Link>
            </div>
          </>
        ) : (
          <>
            <Btn onClick={cadastrar} color="green">Criar conta</Btn>
            <div style={{ textAlign: "center", fontSize: 14, color: "#94A3B8", marginTop: 4 }}>
              Já tem conta?{" "}
              <Link onClick={() => { setTela("login"); setErro(""); }}>Entrar</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}