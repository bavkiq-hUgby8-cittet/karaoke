# 🎤 Karaokê dos Veloso

Sistema completo de karaokê digital para festas em família!

---

## 📁 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Tela da TV/Projetor (operador) |
| `jogador.html` | Tela do celular (todos os participantes) |

---

## 🔥 CONFIGURAÇÃO DO FIREBASE (OBRIGATÓRIO!)

### Passo 1: Acessar as Regras do Realtime Database

1. Abra: https://console.firebase.google.com/project/karaoke-46db0/database/karaoke-46db0-default-rtdb/rules

### Passo 2: Configurar as Regras

**Apague tudo** que está lá e cole isso:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### Passo 3: Publicar

Clique no botão **"Publicar"**

> ⚠️ **IMPORTANTE:** Sem essa configuração, o sistema NÃO funciona! O Firebase bloqueia todas as operações de leitura e escrita por padrão.

---

## 🚀 Deploy no GitHub Pages

1. Acesse seu repositório no GitHub
2. Faça upload/atualize os 2 arquivos HTML
3. Vá em **Settings** → **Pages**
4. Certifique-se que está configurado para **main** / **root**
5. Aguarde o deploy (geralmente 1-2 minutos)

Seu site estará em: `https://bavkiq-hugby8-cittet.github.io/karaoke/`

---

## 🎮 Como Funciona

### Na TV/Projetor (Operador)

1. Abra `index.html` no navegador
2. Aguarde aparecer "🟢 Conectado" no topo
3. O QR Code aparece automaticamente
4. Controles disponíveis:
   - ▶️ **Tocar** - Inicia o vídeo
   - ⏭️ **Próximo** - Pula para votação
   - ⏹️ **Parar** - Para o vídeo
   - 🔄 **Resetar** - Limpa tudo (fila + placar)

5. **Opção de Microfone:**
   - 📱 No celular do cantor (padrão)
   - 🖥️ No computador (microfone físico no PC)

### No Celular (Jogadores)

1. Escaneie o QR Code ou acesse: `https://bavkiq-hugby8-cittet.github.io/karaoke/jogador.html`
2. Digite seu nome e clique em "Entrar"
3. Aguarde aparecer "🟢 Conectado"

**Para cantar:**
1. Clique em "🎤 Quero Cantar!"
2. Busque uma música (digite e clique 🔍)
3. Toque na música desejada
4. Aguarde sua vez na fila
5. Quando for sua vez:
   - Se microfone no celular: ative o microfone e cante
   - Se microfone no operador: pegue o microfone e cante
6. Sempre olhe para a TV onde passa o vídeo!

**Para votar:**
1. Quando alguém terminar de cantar, aparece a votação
2. Toque nas estrelas (1 a 5)
3. Clique em "Votar"
4. Você tem 15 segundos!

---

## ⭐ Sistema de Pontuação

A pontuação final combina:

| Componente | Peso |
|------------|------|
| 🔥 Energia vocal | 40% |
| ⭐ Média dos votos | 60% |

**Energia vocal:** Medida pelo volume do microfone durante a música.
**Votos:** Média das estrelas dadas pela plateia (1-5).

---

## 🎯 Fluxo Visual

```
┌─────────────────────────────────────────────────┐
│                📺 TV (index.html)                │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐ │
│  │   Vídeo YouTube  │  │  📱 QR Code          │ │
│  │   (Karaokê)      │  │  📋 Fila             │ │
│  └──────────────────┘  │  🏆 Placar           │ │
│                        │  🎤 Opção Microfone  │ │
│  ┌──────────────────┐  └──────────────────────┘ │
│  │ 🎙️ Cantor Atual  │                          │
│  │ Nome + Música    │                          │
│  │ 🔥 Energia       │                          │
│  └──────────────────┘                          │
│                                                  │
│  [▶️ Tocar] [⏭️ Próximo] [⏹️ Parar] [🔄 Reset] │
└─────────────────────────────────────────────────┘
                       ▲
                       │ Firebase (sincroniza tudo)
                       ▼
┌─────────────────────────────────────────────────┐
│         📱 📱 📱 Celulares (jogador.html)        │
│                                                  │
│  • Entrar com nome                              │
│  • Ver quem está cantando                       │
│  • Pedir música e entrar na fila                │
│  • Ativar microfone quando for a vez            │
│  • Votar quando alguém terminar                 │
│  • Ver fila e placar                            │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Credenciais (já configuradas)

| Serviço | Valor |
|---------|-------|
| Firebase Project | karaoke-46db0 |
| Database URL | https://karaoke-46db0-default-rtdb.firebaseio.com |
| YouTube API Key | AIzaSyA3Qbdoyqg0EzUPrT0Qo_-HbygKLjTczoc |
| GitHub Pages URL | https://bavkiq-hugby8-cittet.github.io/karaoke |

---

## 🐛 Troubleshooting

### "🔴 Desconectado" no status
- Verifique sua conexão com a internet
- Verifique se as regras do Firebase foram configuradas

### QR Code não aparece
- Atualize a página (F5)
- Verifique se o JavaScript está habilitado

### Música não carrega na TV
- O vídeo precisa existir no YouTube
- Alguns vídeos podem estar bloqueados

### Votação não aparece
- O cantor atual não vê a própria votação
- Certifique-se de que a música terminou ou clicou em "Próximo"

### Microfone não funciona
- Permita o acesso ao microfone quando solicitado
- Use HTTPS (GitHub Pages já usa)
- Alguns navegadores bloqueiam microfone em HTTP

---

## 💡 Dicas

- Busque músicas com "karaoke" no nome para vídeos com letra
- O celular vibra quando é a vez de cantar!
- O cantor não vota em si mesmo
- A energia vocal mede volume, não afinação (é mais divertido!)
- Use "Próximo" para pular se alguém desistir

---

## 🎉 Divirta-se!

Feito com ❤️ para a família Veloso!
