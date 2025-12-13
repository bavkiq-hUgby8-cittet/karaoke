# 🎤 Karaokê dos Veloso

Sistema de karaokê digital para festas em família com votação da plateia!

## 📁 Arquivos

- `index.html` - Tela do Operador (TV/Projetor)
- `cantor.html` - Tela do Cantor (celular via QR Code)
- `plateia.html` - Tela da Plateia (votação via QR Code)

## ✅ Configuração (JÁ FEITA!)

As credenciais já estão configuradas nos arquivos:

- **Firebase:** karaoke-46db0
- **YouTube Data API v3:** Ativa

Só precisa fazer o deploy no GitHub Pages!

## 🚀 Deploy no GitHub Pages

1. Crie um repositório no GitHub (ex: `karaoke-veloso`)
2. Faça upload dos 3 arquivos HTML
3. Vá em **Settings** → **Pages**
4. Em "Source", selecione **main** e **/ (root)**
5. Clique em **Save**
6. Aguarde alguns minutos e acesse o link gerado

## 🎮 Como Usar

### Na TV (Operador)
1. Abra `index.html` no navegador da TV
2. Os QR codes aparecerão automaticamente
3. Use os botões para controlar: Tocar, Próximo, Parar
4. Busque músicas e selecione para adicionar

### No Celular (Cantor)
1. Escaneie o QR Code "Cantor"
2. Digite seu nome e entre na fila
3. Busque e selecione sua música
4. Quando for sua vez, ative o microfone e cante!
5. Olhe para a TV onde passa o vídeo de karaokê

### No Celular (Plateia)
1. Escaneie o QR Code "Plateia"
2. Digite seu nome
3. Acompanhe quem está cantando e a energia vocal
4. Quando a música acabar, vote de 1 a 5 estrelas!

## ⭐ Sistema de Pontuação

A pontuação final combina:
- **40%** - Energia vocal (quanto mais cantar, mais pontos!)
- **60%** - Média dos votos da plateia (1-5 estrelas)

## 🛠️ Regras do Firebase (Recomendado)

No Firebase Console, vá em **Realtime Database** → **Regras** e cole:

```json
{
  "rules": {
    "karaoke": {
      ".read": true,
      ".write": true,
      "queue": {
        ".indexOn": ["timestamp"]
      }
    }
  }
}
```

Clique em **Publicar**.

## 💡 Dicas

- Busque músicas com "karaoke" no nome para vídeos com letra
- A energia vocal detecta volume, não tom (é mais divertido assim!)
- O timer de votação é de 15 segundos
- Cantores reconectam automaticamente se recarregarem a página
- O celular vibra quando é a vez do cantor!

## 🔧 Credenciais (Referência)

**Firebase:**
```
Project ID: karaoke-46db0
Database URL: https://karaoke-46db0-default-rtdb.firebaseio.com
```

**YouTube API Key:**
```
AIzaSyA3Qbdoyqg0EzUPrT0Qo_-HbygKLjTczoc
```

## 🎉 Divirta-se!

Feito com ❤️ para a família Veloso!
