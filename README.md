# 🎤 Karaokê dos Veloso

Karaokê da família para a TV e para o celular. A TV mostra o vídeo, a fila e o placar. Cada pessoa entra pelo celular, pede uma música, aplaude, manda reação e vota.

Não havia data fixa de 2025 no projeto. Esta versão é a mesma brincadeira, pronta para usar de novo no Natal de 2026.

---

## Arquivos

| Arquivo | Função |
|---------|--------|
| `index.html` | Tela da TV / projetor |
| `jogador.html` | Tela do celular |
| `teste.html` | Diagnóstico antes da festa |
| `js/` | Lógica compartilhada |
| `css/` | Visual |
| `vendor/` | QR Code e cartão para salvar, guardados no próprio site |

---

## Publicar no GitHub Pages

1. Envie a branch para o `main` (o pull request precisa ser aceito).
2. Em **Settings → Pages**, a fonte deve ser a branch `main` e a pasta raiz (`/`).
3. O endereço continua `https://bavkiq-hugby8-cittet.github.io/karaoke/`.

Dá para abrir os HTML direto no computador, mas a câmera e o celular da plateia precisam do site em HTTPS. Na festa, use o GitHub Pages.

---

## Como jogar

### Na TV

1. Abra `index.html`.
2. Toque em **Começar**.
3. Espere **Conectado** no topo.
4. Aponte o QR Code (ou copie o link) para todo mundo entrar.
5. Quando a música entrar, toque em **Tocar** se o vídeo não começar sozinho. O navegador só libera o som depois de um toque na TV.
6. **Pausar**, **Votar**, **Pular** e **Reset** ficam na barra de baixo.
7. A votação também abre sozinha quando o vídeo termina. Dura 20 segundos.

O **✕** ao lado de cada nome tira a pessoa da fila.

**Reset** apaga a fila, o placar, as fotos e a votação da sala. Não use no meio da festa sem querer.

### No celular

1. Escaneie o QR Code ou abra `jogador.html`.
2. A foto é opcional. Digite o nome e toque em **Entrar**.
3. **Quero cantar**, busque a música (a busca já procura versão de karaokê) ou cole um link do YouTube.
4. Quando for a sua vez, olhe para a TV. O celular avisa e vibra uma vez.
5. Quem está assistindo aplaude, manda emoji, frase e foto para o telão.
6. Na votação, escolha as estrelas e confirme. Quem cantou não vota em si.
7. No fim, o cantor pode salvar um cartão da performance.

---

## Pontuação

| Parte | Como entra |
|-------|------------|
| Aplausos | 1 ponto a cada 10 aplausos, no máximo 50 |
| Estrelas | média de 1 a 5, multiplicada por 10 (no máximo 50) |

O total vai para o placar, somando se a mesma pessoa cantar de novo. A nota mede a energia da plateia, não a afinação.

O site não usa o microfone do celular. O microfone de verdade continua na caixa de som, do lado de fora do navegador.

---

## Sala de ensaio

Abra a TV com `index.html?sala=ensaio`. O QR Code já leva o celular para a mesma sala. Serve para testar sem mexer na fila e no placar da festa. Sem `sala` na URL, todo mundo cai na sala principal.

---

## Firebase

O jogo só sincroniza se o Realtime Database estiver aberto para a família.

1. Abra as [regras do projeto karaoke-46db0](https://console.firebase.google.com/project/karaoke-46db0/database/karaoke-46db0-default-rtdb/rules).
2. Publique:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Isso é o que faz a festa funcionar sem login. Também deixa qualquer pessoa que descubra o endereço ler e apagar a fila, o placar e as fotos. Não coloque senha, endereço ou dado sensível nesse banco. Antes da festa, confira em `teste.html` se a escrita passa.

| Item | Valor |
|------|--------|
| Projeto | `karaoke-46db0` |
| Banco | `https://karaoke-46db0-default-rtdb.firebaseio.com` |
| Chave do YouTube | está em `js/config.js` (visível para quem abre o site) |

A chave do YouTube gasta a cota de busca de quem copiar o arquivo. No Google Cloud, o ideal é restringir essa chave ao endereço `https://bavkiq-hugby8-cittet.github.io/*`. Se a cota acabar no dia, o celular ainda aceita colar o link do vídeo.

---

## Se algo falhar

| Sintoma | O que fazer |
|---------|-------------|
| **Reconectando...** ou **Sem permissão** | Internet, e as regras do Firebase acima |
| QR Code não aparece | O link embaixo do QR continua valendo. Atualize a página |
| Vídeo mudo ou parado | Toque em **Tocar** na TV |
| "não deixa tocar fora do YouTube" | Essa versão bloqueia embed. Escolha outra, ou cole outro link |
| Busca sem resultado | Cole o link do YouTube |
| Câmera negada | Permita a câmera e use o site em HTTPS |
| Votação não aparece para quem cantou | É de propósito: a pessoa não vota na própria música |

---

## Antes de projetar

Abra `teste.html` na TV e no celular. Firebase, QR Code e busca precisam estar verdes. A câmera só é obrigatória para quem for tirar foto.

Na sala principal ainda pode existir um pedido antigo (Jessica, "Oceano", de fevereiro de 2026). Se ele aparecer na fila, use **Reset** uma vez antes da festa, ou toque no **✕**. Esse pedido não foi apagado daqui.
