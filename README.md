# 🏙️ Cívico

> **A cidade nas suas mãos**  
> Plataforma SaaS B2G de gestão urbana para municípios brasileiros.

🌐 **Acesse:** [civico-web.vercel.app](https://civico-web.vercel.app)

---

## 📋 Sobre o Projeto

O Cívico é uma plataforma que conecta cidadãos e prefeituras, permitindo que moradores reportem problemas urbanos e acompanhem o status de atendimento em tempo real.

**Modelo de negócio:** B2G (Business to Government) — SaaS vendido para municípios brasileiros.

---

## ✅ Funcionalidades

### Cidadão
- 📱 Cadastro e login
- 📸 Reporte de problemas com foto, descrição e GPS
- 📋 Acompanhamento de chamados com timeline de status
- 🔍 Histórico detalhado de cada ocorrência

### Administração (Prefeitura)
- 📊 Dashboard com KPIs e gráficos (Recharts)
- 📋 Lista de chamados com mudança de status
- 🗺️ Mapa de ocorrências (Leaflet + OpenStreetMap)
- 🔍 Lightbox para visualização de fotos
- 🏙️ Multi-tenant por município

### Sistema
- 🔐 Autenticação Firebase (cidadão + admin)
- 🌆 Seletor de cidade na tela de login
- 👁️ Mostrar/esconder senha
- 💾 Lembrar e-mail automaticamente
- 📍 Captura de localização GPS
- 🔒 Regras de segurança Firestore

---

## 🛠️ Stack

| Tecnologia | Uso |
|---|---|
| React | Frontend |
| Firebase Auth | Autenticação |
| Firestore | Banco de dados |
| Cloudinary | Upload de fotos |
| Leaflet + OpenStreetMap | Mapa de ocorrências |
| Recharts | Gráficos do dashboard |
| Vercel | Hospedagem |

---

## 📁 Estrutura

```
civico-web/
├── public/
│   └── index.html          # Inclui CSS do Leaflet via CDN
├── src/
│   ├── App.js              # Componente principal (toda a lógica)
│   └── firebase.js         # Configuração do Firebase
├── .env                    # Variáveis de ambiente (não commitado)
└── .gitignore
```

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_CLOUDINARY_CLOUD=...
REACT_APP_CLOUDINARY_PRESET=...
```

---

## 🚀 Como rodar localmente

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm start

# Build para produção
npm run build
```

> ⚠️ Use **CMD** (não PowerShell) no Windows para evitar erros com npm.

---

## 🔥 Firestore — Regras de Segurança

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /municipios/{municipioId} {
      allow read: if true;
      allow write: if false;
    }
    match /chamados/{chamadoId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      match /historico/{docId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
      }
    }
  }
}
```

---

## 🏙️ Multi-tenant

Cada município é cadastrado na coleção `municipios` no Firestore:

```json
{
  "id": "maringa-pr",
  "nome": "Maringá",
  "estado": "PR",
  "ativo": true,
  "adminEmail": "prefeitura@civico.com"
}
```

---

## 📊 Status de Chamados

| Status | Descrição |
|---|---|
| 🔴 Aberto | Recém registrado |
| 🔵 Em análise | Em avaliação pela prefeitura |
| 🟡 Em atendimento | Equipe enviada ao local |
| 🟢 Resolvido | Problema solucionado |
| ⚫ Finalizado | Encerrado definitivamente |

---

## 💰 Planos

| Plano | Preço/mês |
|---|---|
| Básico | R$ 800 – 1.500 |
| Profissional | R$ 1.500 – 3.000 |
| Enterprise | R$ 3.000+ |

---

## 📱 Redes Sociais

- Instagram: [@somos.civico](https://instagram.com/somos.civico)
- GitHub: [somos-civico](https://github.com/somos-civico)

---

## 📌 Roadmap

- [x] Login / Cadastro / Esqueci senha
- [x] Reporte com foto e GPS
- [x] Sistema de status com histórico
- [x] Meus chamados com timeline
- [x] Mapa de ocorrências
- [x] Dashboard administrativo
- [x] Lightbox de fotos
- [x] Multi-tenant por município
- [x] Polimento visual
- [ ] Notificações por email
- [ ] App nativo (React Native)
- [ ] Domínio civico.com.br

---

*Cívico — A cidade nas suas mãos* 🏙️
