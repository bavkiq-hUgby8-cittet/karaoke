# 🎤 Karaokê dos Veloso

Sistema de karaokê digital para festas em família!

## 📁 Arquivos

- `index.html` - Tela da TV/Projetor (operador)
- `jogador.html` - Tela do celular (todos os participantes)

## ✅ Tudo Configurado!

Firebase e YouTube API já estão configurados nos arquivos.

## 🚀 Como Usar

### 1. Suba no GitHub Pages
1. Crie um repositório no GitHub
2. Faça upload dos 2 arquivos HTML
3. Vá em **Settings** → **Pages** → Selecione **main** → **Save**
4. Aguarde e acesse o link gerado

### 2. Na Festa

**Na TV/Projetor:**
1. Abra o `index.html` no navegador
2. O QR Code aparece automaticamente
3. Use os botões: Tocar, Próximo, Parar, Resetar

**No Celular (todos):**
1. Escaneie o QR Code da TV
2. Digite seu nome e entre
3. Clique em **"Quero Cantar!"** para entrar na fila
4. Escolha uma música (busca no YouTube)
5. Quando for sua vez, ative o microfone e cante olhando pra TV!
6. Quando alguém terminar, vote de 1 a 5 estrelas

## 🎯 Dinâmica

```
📺 TV                           📱 Celulares
┌─────────────────┐            ┌─────────────────┐
│ Vídeo YouTube   │            │ Qualquer pessoa │
│ QR Code         │◄──────────►│ pode:           │
│ Fila            │  Firebase  │ - Assistir      │
│ Placar          │            │ - Pedir música  │
│ Controles       │            │ - Cantar        │
└─────────────────┘            │ - Votar         │
                               └─────────────────┘
```

## ⭐ Pontuação

- **40%** = Energia vocal (quanto mais canta, mais pontos)
- **60%** = Média dos votos da plateia (1-5 estrelas)
- Votação dura 15 segundos

## 🛠️ Regras do Firebase

No Firebase Console → Realtime Database → Regras:

```json
{
  "rules": {
    "karaoke": {
      ".read": true,
      ".write": true
    }
  }
}
```

## 💡 Dicas

- Busque músicas com "karaoke" no nome
- O celular vibra quando é a vez de cantar!
- Quem está cantando não vota em si mesmo
- O botão "Resetar" limpa tudo (fila + placar)

## 🔧 Credenciais (já configuradas)

**Firebase:** karaoke-46db0
**YouTube API:** AIzaSyA3Qbdoyqg0EzUPrT0Qo_-HbygKLjTczoc

---
Feito com ❤️ para a família Veloso!
