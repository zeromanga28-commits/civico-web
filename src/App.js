import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection, addDoc, getDocs, updateDoc, doc,
  serverTimestamp, query, orderBy, where
} from "firebase/firestore";

const ADMIN_EMAIL = "prefeitura@civico.com";
const CLOUDINARY_CLOUD = "dgyikpjcs";
const CLOUDINARY_PRESET = "jnr0m04h";

const STATUS = {
  aberto:           { label: "Aberto",          emoji: "🔴", cor: "#B91C1C", bg: "#FEE2E2" },
  "em analise":     { label: "Em análise",      emoji: "🔵", cor: "#1D4ED8", bg: "#DBEAFE" },
  "em atendimento": { label: "Em atendimento",  emoji: "🟡", cor: "#B45309", bg: "#FEF3C7" },
  resolvido:        { label: "Resolvido",        emoji: "🟢", cor: "#0A7C4E", bg: "#DCFCE7" },
  finalizado:       { label: "Finalizado",       emoji: "⚫", cor: "#475569", bg: "#F1F5F9" },
};
const FLUXO_STATUS = ["aberto", "em analise", "em atendimento", "resolvido", "finalizado"];

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
    if (!["image/jpeg", "image/png"].includes(arquivo.type)) {
      alert("Apenas arquivos JPG e PNG são aceitos.");
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 5MB.");
      return;
    }
    setFoto(arquivo);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(arquivo);
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: "#0D1F4E", display: "block", marginBottom: 8 }}>
        📷 Foto do problema <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 400 }}>(opcional · JPG/PNG · máx 5MB)</span>
      </label>

      {preview ? (
        <div style={{ position: "relative" }}>
          <img src={preview} alt="preview" style={{ width: "100%", borderRadius: 12, maxHeight: 220, objectFit: "cover", border: "2px solid #E2E8F0" }} />
          <button
            onClick={() => { setFoto(null); setPreview(null); }}
            style={{ position: "absolute", top: 8, right: 8, background: "#B91C1C", color: "white", border: "none", borderRadius: 20, width: 28, height: 28, cursor: "pointer", fontSize: 16, fontWeight: 700 }}
          >×</button>
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

async function uploadCloudinary(arquivo) {
  const formData = new FormData();
  formData.append("file", arquivo);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: formData,
  });
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

export default function App() {
  const [tela, setTela]               = useState("login");
  const [tipoLogin, setTipoLogin]     = useState("cidadao");
  const [email, setEmail]             = useState("");
  const [senha, setSenha]             = useState("");
  const [erro, setErro]               = useState("");
  const [usuario, setUsuario]         = useState(null);
  const [titulo, setTitulo]           = useState("");
  const [descricao, setDescricao]     = useState("");
  const [categoria, setCategoria]     = useState("");
  const [foto, setFoto]               = useState(null);
  const [preview, setPreview]         = useState(null);
  const [enviando, setEnviando]       = useState(false);
  const [sucesso, setSucesso]         = useState(false);
  const [chamados, setChamados]               = useState([]);
  const [meusChamados, setMeusChamados]       = useState([]);
  const [carregando, setCarregando]           = useState(false);
  const [chamadoDetalhe, setChamadoDetalhe]   = useState(null);
  const [historicoDetalhe, setHistoricoDetalhe] = useState([]);
  const [obsStatus, setObsStatus]             = useState("");

  async function entrar() {
    setErro("");
    try {
      const result = await signInWithEmailAndPassword(auth, email, senha);
      const isAdmin = result.user.email === ADMIN_EMAIL;
      if (tipoLogin === "admin" && !isAdmin)  { await signOut(auth); setErro("Acesso negado para este e-mail."); return; }
      if (tipoLogin === "cidadao" && isAdmin) { await signOut(auth); setErro("Use o acesso Administração."); return; }
      setUsuario(result.user);
      setTela(isAdmin ? "painel" : "home");
    } catch (e) { setErro("E-mail ou senha incorretos."); }
  }

  async function cadastrar() {
    setErro("");
    if (!email || !senha) { setErro("Preencha e-mail e senha."); return; }
    if (senha.length < 6) { setErro("Senha precisa ter pelo menos 6 caracteres."); return; }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, senha);
      setUsuario(result.user);
      setTela("home");
    } catch (e) {
      if (e.code === "auth/email-already-in-use") setErro("Este e-mail já está cadastrado.");
      else setErro("Erro ao cadastrar. Tente novamente.");
    }
  }

  async function sair() {
    await signOut(auth);
    setUsuario(null); setEmail(""); setSenha("");
    setTela("login");
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
        fotoURL: fotoURL || null,
        criadoEm: serverTimestamp()
      });
      await addDoc(collection(db, "chamados", docRef.id, "historico"), {
        status: "aberto", obs: "Ocorrência registrada pelo cidadão.",
        criadoEm: serverTimestamp()
      });
      setSucesso(true);
      setTitulo(""); setDescricao(""); setCategoria("");
      setFoto(null); setPreview(null);
    } catch (e) { alert("Erro ao enviar. Tente novamente."); console.error(e); }
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

  useEffect(() => { if (tela === "meus-chamados") carregarMeusChamados(); }, [tela]);

  async function carregarChamados() {
    setCarregando(true);
    try {
      const q = query(collection(db, "chamados"), orderBy("criadoEm", "desc"));
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
      setObsStatus("");
      carregarChamados();
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
          <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>📅 {chamadoDetalhe.criadoEm?.toDate ? chamadoDetalhe.criadoEm.toDate().toLocaleDateString("pt-BR") : ""}</div>
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
                <div style={{ fontSize: 12, color: "#94A3B8", display: "flex", gap: 12 }}>
                  <span>📂 {c.categoria}</span>
                  <span>📅 {c.criadoEm?.toDate ? c.criadoEm.toDate().toLocaleDateString("pt-BR") : ""}</span>
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
      <div style={{ background: "linear-gradient(135deg,#0D1F4E,#1B4FD8)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "white" }}>🏛️ Administração</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Cívico — Gestão de Chamados</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={carregarChamados} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>🔄</button>
          <button onClick={sair} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Sair</button>
        </div>
      </div>
      <div style={{ padding: "20px 16px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total",      valor: chamados.length, cor: "#1B4FD8" },
            { label: "Em Aberto",  valor: chamados.filter(c => c.status === "aberto").length, cor: "#B91C1C" },
            { label: "Resolvidos", valor: chamados.filter(c => c.status === "resolvido" || c.status === "finalizado").length, cor: "#0A7C4E" },
          ].map((s, i) => (
            <div key={i} style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.cor }}>{s.valor}</div>
              <div style={{ fontSize: 13, color: "#64748B" }}>{s.label}</div>
            </div>
          ))}
        </div>
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
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1F4E", marginBottom: 4 }}>{c.titulo}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>{c.descricao}</div>
              {c.fotoURL && (
                <div style={{ marginBottom: 10 }}>
                  <img src={c.fotoURL} alt="foto" style={{ width: "100%", maxWidth: 320, borderRadius: 10, maxHeight: 180, objectFit: "cover" }} />
                </div>
              )}
              <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 10 }}>👤 {c.email}</div>
              <input
                placeholder="Observação (opcional)"
                value={obsStatus}
                onChange={e => setObsStatus(e.target.value)}
                style={{ ...inputStyle, fontSize: 13, padding: "8px 12px", marginBottom: 8 }}
              />
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
            <div style={{ fontSize: 15, color: "#64748B", marginBottom: 28 }}>Sua solicitação foi registrada.</div>
            <Btn onClick={() => setSucesso(false)}>Reportar outro</Btn>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
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
        <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>🏙️ Cívico</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{usuario?.email}</span>
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
        </div>
        <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 12, padding: 4, marginBottom: 24 }}>
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
