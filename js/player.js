(function () {
    'use strict';

    var U = window.KaraokeUtil;
    var CFG = window.KARAOKE;
    var gameRef;
    var listenersReady = false;
    var player = {
        id: null,
        name: '',
        photo: null,
        queueId: null,
        inQueue: false,
        isMyTurn: false,
        joining: false
    };
    var voting = { id: null, selected: 0, voted: false };
    var myApplause = 0;
    var cameraStream = null;
    var modalStream = null;
    var currentSingerId = null;
    var voteTimer = null;
    var wasMyTurn = false;
    var toastTimer = null;
    var lastResultSeen = '';

    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('pagehide', stopCameras);

    function init() {
        var sala = U.roomId();
        if (sala) {
            var badge = document.getElementById('roomBadge');
            badge.hidden = false;
            badge.textContent = 'Sala ' + sala;
        }

        document.getElementById('photoBtn').addEventListener('click', handlePhoto);
        document.getElementById('joinBtn').addEventListener('click', joinGame);
        document.getElementById('nameInput').addEventListener('keydown', function (event) {
            if (event.key === 'Enter') joinGame();
        });
        document.getElementById('joinQueueBtn').addEventListener('click', showSearch);
        document.getElementById('leaveQueueBtn').addEventListener('click', leaveQueue);
        document.getElementById('resetUserBtn').addEventListener('click', resetUser);
        document.getElementById('backBtn').addEventListener('click', hideSearch);
        document.getElementById('cancelSearchBtn').addEventListener('click', hideSearch);
        document.getElementById('searchForm').addEventListener('submit', searchMusic);
        document.getElementById('linkForm').addEventListener('submit', usePastedLink);
        document.getElementById('applauseBtn').addEventListener('click', sendApplause);
        document.getElementById('photoCaptureBtn').addEventListener('click', openPhotoModal);
        document.getElementById('closePhotoBtn').addEventListener('click', closePhotoModal);
        document.getElementById('discardPhotoBtn').addEventListener('click', closePhotoModal);
        document.getElementById('captureBtn').addEventListener('click', capturePhoto);
        document.getElementById('sendPhotoBtn').addEventListener('click', sendPhoto);
        document.getElementById('voteBtn').addEventListener('click', submitVote);
        document.getElementById('downloadBtn').addEventListener('click', downloadCard);
        document.getElementById('closeShareBtn').addEventListener('click', closeShareCard);

        document.querySelectorAll('.emoji-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { sendEmoji(btn.getAttribute('data-emoji')); });
        });
        document.querySelectorAll('.phrase-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { sendPhrase(btn.getAttribute('data-phrase')); });
        });
        document.querySelectorAll('.vote-star').forEach(function (btn) {
            btn.addEventListener('click', function () { selectStar(Number(btn.getAttribute('data-value'))); });
        });

        if (typeof firebase === 'undefined') {
            document.getElementById('bootError').hidden = false;
            setStatus(false, 'Firebase não carregou');
            return;
        }

        firebase.initializeApp(CFG.firebase);
        gameRef = firebase.database().ref(U.dbPath());
        firebase.database().ref('.info/connected').on('value', function (snap) {
            var on = snap.val() === true;
            setStatus(on, on ? 'Conectado' : 'Reconectando...');
        });

        lastResultSeen = sessionStorage.getItem(U.storageKey('result')) || '';
        if (!checkSession()) document.getElementById('nameInput').focus();
    }

    function setStatus(online, text) {
        document.getElementById('statusDot').classList.toggle('online', !!online);
        document.getElementById('statusText').textContent = text;
    }

    function checkSession() {
        var id = localStorage.getItem(U.storageKey('id'));
        var name = localStorage.getItem(U.storageKey('name'));
        var photo = localStorage.getItem(U.storageKey('photo'));
        if (!id && !U.roomId()) {
            id = localStorage.getItem('karaoke_id');
            name = localStorage.getItem('karaoke_name');
            photo = localStorage.getItem('karaoke_photo');
        }
        if (!id || !name) return false;
        player.id = id;
        player.name = U.cleanName(name);
        player.photo = U.safeDataImage(photo);
        enterMain();
        return true;
    }

    function joinGame() {
        var name = U.cleanName(document.getElementById('nameInput').value);
        if (!name) {
            showToast('Digite seu nome!', 'error');
            return;
        }
        stopStream(cameraStream);
        cameraStream = null;
        player.id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        player.name = name;
        try {
            localStorage.setItem(U.storageKey('id'), player.id);
            localStorage.setItem(U.storageKey('name'), player.name);
            if (player.photo) localStorage.setItem(U.storageKey('photo'), player.photo);
            else localStorage.removeItem(U.storageKey('photo'));
        } catch (e) {
            showToast('Não deu para salvar a foto neste celular', 'error');
            player.photo = player.photo || null;
        }
        enterMain();
    }

    function enterMain() {
        document.getElementById('userName').textContent = player.name;
        var avatar = document.getElementById('userAvatar');
        avatar.replaceChildren();
        if (player.photo) {
            var img = document.createElement('img');
            img.src = player.photo;
            img.alt = '';
            avatar.appendChild(img);
        } else {
            avatar.textContent = '🎤';
        }
        showScreen('main');
        setupListeners();
    }

    function setupListeners() {
        if (listenersReady) return;
        listenersReady = true;
        var onErr = function (err) {
            console.error(err);
            setStatus(false, 'Sem permissão');
            showToast('O Firebase bloqueou o acesso. Confira as regras.', 'error');
        };
        gameRef.child('queue').on('value', function (snap) { handleQueue(snap.val()); }, onErr);
        gameRef.child('scores').on('value', function (snap) { renderScores(snap.val()); }, onErr);
        gameRef.child('voting').on('value', function (snap) { handleVoting(snap.val()); }, onErr);
        gameRef.child('lastResult').on('value', function (snap) { checkMyResult(snap.val()); }, onErr);
        var ref = gameRef.child('participants/' + player.id);
        ref.set({ name: player.name, timestamp: firebase.database.ServerValue.TIMESTAMP });
        ref.onDisconnect().remove();
    }

    function resetUser() {
        if (!confirm('Sair e entrar com outro nome?')) return;
        stopCameras();
        if (player.queueId) gameRef.child('queue/' + player.queueId).remove();
        if (player.id) gameRef.child('participants/' + player.id).remove();
        ['id', 'name', 'photo', 'result'].forEach(function (part) {
            localStorage.removeItem(U.storageKey(part));
        });
        if (!U.roomId()) {
            localStorage.removeItem('karaoke_id');
            localStorage.removeItem('karaoke_name');
            localStorage.removeItem('karaoke_photo');
        }
        location.reload();
    }

    function showScreen(name) {
        document.querySelectorAll('.screen').forEach(function (screen) {
            var active = screen.id === name + 'Screen';
            screen.classList.toggle('active', active);
            screen.hidden = !active;
        });
    }

    function showSearch() {
        showScreen('search');
        document.getElementById('searchInput').focus();
    }

    function hideSearch() {
        showScreen('main');
        document.getElementById('searchResults').replaceChildren(statusNode('Digite o nome da música ou cole um link.'));
        document.getElementById('searchInput').value = '';
        document.getElementById('linkInput').value = '';
    }

    async function handlePhoto() {
        var video = document.getElementById('cameraVideo');
        var img = document.getElementById('photoImg');
        var placeholder = document.getElementById('photoPlaceholder');
        var btn = document.getElementById('photoBtn');
        if (!cameraStream) {
            try {
                cameraStream = await openCamera('user');
                video.srcObject = cameraStream;
                video.muted = true;
                video.hidden = false;
                img.hidden = true;
                placeholder.hidden = true;
                btn.textContent = '📸 Capturar';
                btn.classList.add('capturing');
            } catch (e) {
                showToast(cameraError(e), 'error');
            }
            return;
        }
        var data = grabFrame(video, 240, 0.72);
        if (!data) {
            showToast('Aguarde a câmera ligar', 'error');
            return;
        }
        player.photo = data;
        img.src = data;
        img.hidden = false;
        video.hidden = true;
        stopStream(cameraStream);
        cameraStream = null;
        btn.textContent = '🔄 Trocar foto';
        btn.classList.remove('capturing');
    }

    function cameraError(error) {
        if (!window.isSecureContext) return 'A câmera precisa de HTTPS. Abra o site do GitHub Pages.';
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'Este navegador não libera a câmera.';
        if (error && error.name === 'NotAllowedError') return 'Permita o uso da câmera para tirar a foto.';
        if (error && error.name === 'NotFoundError') return 'Nenhuma câmera encontrada.';
        return 'Câmera indisponível agora.';
    }

    async function openCamera(facing) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('unsupported');
        }
        var attempts = facing === 'environment'
            ? [{ video: { facingMode: { ideal: 'environment' } }, audio: false }, { video: true, audio: false }]
            : [{ video: { facingMode: { ideal: 'user' } }, audio: false }, { video: true, audio: false }];
        var last;
        for (var i = 0; i < attempts.length; i++) {
            try {
                return await navigator.mediaDevices.getUserMedia(attempts[i]);
            } catch (e) {
                last = e;
            }
        }
        throw last;
    }

    function grabFrame(video, size, quality) {
        if (!video.videoWidth || !video.videoHeight) return '';
        var canvas = document.getElementById('photoCanvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        var side = Math.min(video.videoWidth, video.videoHeight);
        var x = (video.videoWidth - side) / 2;
        var y = (video.videoHeight - side) / 2;
        ctx.drawImage(video, x, y, side, side, 0, 0, size, size);
        return canvas.toDataURL('image/jpeg', quality);
    }

    function stopStream(stream) {
        if (!stream) return;
        stream.getTracks().forEach(function (track) { track.stop(); });
    }

    function stopCameras() {
        stopStream(cameraStream);
        stopStream(modalStream);
        cameraStream = null;
        modalStream = null;
    }

    async function openPhotoModal() {
        if (!currentSingerId || player.isMyTurn) {
            showToast('Aguarde alguém cantar', 'error');
            return;
        }
        document.getElementById('photoModal').classList.add('show');
        document.getElementById('photoModalStatus').textContent = '📸 Aponte para o cantor';
        document.getElementById('modalVideo').hidden = false;
        document.getElementById('modalPhoto').hidden = true;
        document.getElementById('photoCaptureActions').hidden = false;
        document.getElementById('photoSendActions').hidden = true;
        try {
            modalStream = await openCamera('environment');
            var video = document.getElementById('modalVideo');
            video.srcObject = modalStream;
            video.muted = true;
        } catch (e) {
            showToast(cameraError(e), 'error');
            closePhotoModal();
        }
    }

    function closePhotoModal() {
        document.getElementById('photoModal').classList.remove('show');
        stopStream(modalStream);
        modalStream = null;
        var video = document.getElementById('modalVideo');
        if (video) video.srcObject = null;
    }

    function capturePhoto() {
        var video = document.getElementById('modalVideo');
        var data = grabFrame(video, 480, 0.62);
        if (!data) {
            showToast('Aguarde a imagem da câmera', 'error');
            return;
        }
        stopStream(modalStream);
        modalStream = null;
        var img = document.getElementById('modalPhoto');
        img.src = data;
        img.hidden = false;
        video.hidden = true;
        document.getElementById('photoModalStatus').textContent = '✅ Foto capturada!';
        document.getElementById('photoCaptureActions').hidden = true;
        document.getElementById('photoSendActions').hidden = false;
        if (navigator.vibrate) navigator.vibrate(40);
    }

    function sendPhoto() {
        var data = U.safeDataImage(document.getElementById('modalPhoto').src);
        if (!data || !currentSingerId) return;
        gameRef.child('photos').push({
            image: data,
            senderName: player.name,
            senderPhoto: player.photo || null,
            singerId: currentSingerId,
            timestamp: Date.now()
        }).then(function () {
            showToast('Foto enviada! 📸', 'success');
            if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
            closePhotoModal();
        }).catch(function () {
            showToast('A foto não foi enviada', 'error');
        });
    }

    function sendApplause() {
        if (!currentSingerId || player.isMyTurn) return;
        gameRef.child('applause').transaction(function (current) {
            return (current || 0) + 1;
        });
        gameRef.child('reactions').push({
            type: 'clap',
            name: player.name,
            photo: player.photo || null,
            timestamp: Date.now()
        });
        myApplause += 1;
        document.getElementById('myApplause').textContent = String(myApplause);
        if (navigator.vibrate) navigator.vibrate(20);
    }

    function sendEmoji(emoji) {
        if (!currentSingerId || player.isMyTurn || !emoji) return;
        gameRef.child('reactions').push({
            type: 'emoji',
            value: emoji,
            name: player.name,
            photo: player.photo || null,
            timestamp: Date.now()
        });
        if (navigator.vibrate) navigator.vibrate(20);
        showToast(emoji + ' enviado!', 'success');
    }

    function sendPhrase(phrase) {
        if (!currentSingerId || player.isMyTurn || !phrase) return;
        gameRef.child('reactions').push({
            type: 'phrase',
            value: phrase,
            name: player.name,
            photo: player.photo || null,
            timestamp: Date.now()
        });
        if (navigator.vibrate) navigator.vibrate(20);
        showToast('"' + phrase + '"', 'success');
    }

    function searchMusic(event) {
        event.preventDefault();
        var query = document.getElementById('searchInput').value.trim();
        if (!query) return;
        if (/youtu(\.be|be\.com)/i.test(query) || /^https?:/i.test(query)) {
            var id = U.parseYouTubeId(query);
            if (!id) {
                showToast('Esse link não parece do YouTube', 'error');
                return;
            }
            useVideoId(id);
            return;
        }
        runSearch(query);
    }

    function usePastedLink(event) {
        event.preventDefault();
        var id = U.parseYouTubeId(document.getElementById('linkInput').value);
        if (!id) {
            showToast('Cole um link válido do YouTube', 'error');
            return;
        }
        useVideoId(id);
    }

    async function useVideoId(id) {
        var title = 'Karaokê';
        try {
            var res = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
            if (res.ok) {
                var data = await res.json();
                title = U.decodeHtml(data.title || title);
            }
        } catch (e) {}
        selectMusic(id, title);
    }

    async function runSearch(query) {
        var box = document.getElementById('searchResults');
        box.replaceChildren(statusNode('Buscando versões de karaokê...'));
        var params = new URLSearchParams({
            part: 'snippet',
            maxResults: '8',
            q: query + ' karaoke',
            type: 'video',
            videoEmbeddable: 'true',
            relevanceLanguage: 'pt',
            regionCode: 'BR',
            key: CFG.youtubeApiKey
        });
        try {
            var res = await fetch('https://www.googleapis.com/youtube/v3/search?' + params.toString());
            var data = await res.json();
            if (!res.ok) {
                box.replaceChildren(statusNode(searchError(data) + ' Você também pode colar o link.'));
                return;
            }
            var items = data.items || [];
            if (!items.length) {
                box.replaceChildren(statusNode('Nenhuma versão encontrada. Tente outro nome ou cole o link.'));
                return;
            }
            box.replaceChildren();
            items.forEach(function (item) {
                if (!item.id || !item.id.videoId) return;
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'result-item';
                var thumb = item.snippet && item.snippet.thumbnails
                    ? (item.snippet.thumbnails.medium || item.snippet.thumbnails.default || {})
                    : {};
                if (thumb.url) {
                    var img = document.createElement('img');
                    img.src = thumb.url;
                    img.alt = '';
                    btn.appendChild(img);
                }
                var title = document.createElement('div');
                title.className = 'title';
                var text = U.decodeHtml(item.snippet && item.snippet.title || 'Karaokê');
                title.textContent = text;
                btn.appendChild(title);
                btn.addEventListener('click', function () {
                    selectMusic(item.id.videoId, text);
                });
                box.appendChild(btn);
            });
        } catch (e) {
            box.replaceChildren(statusNode('Sem conexão para buscar. Cole o link do YouTube.'));
        }
    }

    function searchError(data) {
        var reason = data && data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason;
        if (reason === 'quotaExceeded') return 'A cota de busca do YouTube acabou hoje.';
        if (reason === 'keyInvalid' || reason === 'accessNotConfigured') return 'A chave do YouTube foi recusada.';
        return 'A busca do YouTube falhou.';
    }

    function statusNode(text) {
        var div = document.createElement('div');
        div.className = 'search-status';
        div.textContent = text;
        return div;
    }

    function selectMusic(videoId, title) {
        if (player.inQueue || player.joining) {
            showToast('Você já está na fila', 'error');
            return;
        }
        if (!/^[\w-]{11}$/.test(videoId)) {
            showToast('Vídeo inválido', 'error');
            return;
        }
        player.joining = true;
        var ref = gameRef.child('queue').push();
        ref.set({
            playerId: player.id,
            odPlayerId: player.id,
            name: player.name,
            photo: player.photo || null,
            song: U.decodeHtml(title).slice(0, 140),
            videoId: videoId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(function () {
            player.queueId = ref.key;
            player.inQueue = true;
            player.joining = false;
            hideSearch();
            showToast('Você entrou na fila!', 'success');
            updateButtons();
        }).catch(function (err) {
            player.joining = false;
            console.error(err);
            showToast('Não foi possível entrar na fila', 'error');
        });
    }

    function leaveQueue() {
        if (!player.queueId) return;
        gameRef.child('queue/' + player.queueId).remove().then(function () {
            player.queueId = null;
            player.inQueue = false;
            player.isMyTurn = false;
            wasMyTurn = false;
            showToast('Você saiu da fila', 'success');
            updateButtons();
            document.getElementById('myTurnCard').hidden = true;
            document.getElementById('currentSingerCard').hidden = false;
        }).catch(function () {
            showToast('Não foi possível sair da fila', 'error');
        });
    }

    function handleQueue(queue) {
        renderQueue(queue);
        renderCurrentSinger(queue);
        checkMyPosition(queue);
    }

    function queueItems(queue) {
        if (!queue) return [];
        return Object.keys(queue).map(function (id) {
            return Object.assign({ id: id }, queue[id]);
        }).sort(function (a, b) {
            return (a.timestamp || 0) - (b.timestamp || 0);
        });
    }

    function renderQueue(queue) {
        var list = document.getElementById('queueList');
        var items = queueItems(queue);
        list.replaceChildren();
        if (!items.length) {
            list.appendChild(emptyBlock('🎵', 'Fila vazia'));
            return;
        }
        items.forEach(function (item, index) {
            var mine = U.playerKey(item) === player.id;
            var row = document.createElement('div');
            row.className = 'queue-item' + (mine ? ' me' : '');
            var pos = document.createElement('div');
            pos.className = 'pos';
            pos.textContent = String(index + 1);
            var avatar = document.createElement('div');
            avatar.className = 'avatar';
            var photo = U.safeDataImage(item.photo);
            if (photo) {
                var img = document.createElement('img');
                img.src = photo;
                img.alt = '';
                avatar.appendChild(img);
            } else {
                avatar.textContent = '🎤';
            }
            var info = document.createElement('div');
            info.className = 'info';
            var name = document.createElement('div');
            name.className = 'name';
            name.textContent = (item.name || 'Sem nome') + (mine ? ' (você)' : '');
            var song = document.createElement('div');
            song.className = 'song';
            song.textContent = U.decodeHtml(item.song || '');
            info.append(name, song);
            row.append(pos, avatar, info);
            list.appendChild(row);
        });
    }

    function renderCurrentSinger(queue) {
        var box = document.getElementById('currentSinger');
        var interaction = document.getElementById('interactionSection');
        var items = queueItems(queue);
        if (!items.length) {
            box.replaceChildren(emptyBlock('🎤', 'Ninguém cantando'));
            interaction.classList.remove('active');
            currentSingerId = null;
            return;
        }
        var first = items[0];
        if (currentSingerId !== first.id) {
            myApplause = 0;
            document.getElementById('myApplause').textContent = '0';
        }
        currentSingerId = first.id;
        var card = document.createElement('div');
        card.className = 'current-singer';
        var label = document.createElement('div');
        label.className = 'label';
        label.textContent = 'No palco';
        var name = document.createElement('div');
        name.className = 'name';
        name.textContent = first.name || 'Sem nome';
        var song = document.createElement('div');
        song.className = 'song';
        song.textContent = U.decodeHtml(first.song || '');
        card.append(label, name, song);
        box.replaceChildren(card);
        var mine = U.playerKey(first) === player.id;
        interaction.classList.toggle('active', !mine);
    }

    function checkMyPosition(queue) {
        var previousTurn = wasMyTurn;
        var statusEl = document.getElementById('userStatus');
        var myTurnCard = document.getElementById('myTurnCard');
        var singerCard = document.getElementById('currentSingerCard');
        player.inQueue = false;
        player.isMyTurn = false;
        var items = queueItems(queue);
        if (!items.length) {
            statusEl.textContent = 'Assistindo';
            statusEl.className = 'user-status';
            myTurnCard.hidden = true;
            singerCard.hidden = false;
            wasMyTurn = false;
            updateButtons();
            return;
        }
        var myIndex = items.findIndex(function (item) { return U.playerKey(item) === player.id; });
        if (myIndex === 0) {
            player.inQueue = true;
            player.isMyTurn = true;
            player.queueId = items[0].id;
            statusEl.textContent = '🎤 Sua vez!';
            statusEl.className = 'user-status singing';
            myTurnCard.hidden = false;
            document.getElementById('myTurnSong').textContent = U.decodeHtml(items[0].song || '');
            singerCard.hidden = true;
            if (!previousTurn && navigator.vibrate) navigator.vibrate([180, 80, 180]);
        } else if (myIndex > 0) {
            player.inQueue = true;
            player.queueId = items[myIndex].id;
            statusEl.textContent = '#' + (myIndex + 1) + ' na fila';
            statusEl.className = 'user-status queue';
            myTurnCard.hidden = true;
            singerCard.hidden = false;
        } else {
            statusEl.textContent = 'Assistindo';
            statusEl.className = 'user-status';
            myTurnCard.hidden = true;
            singerCard.hidden = false;
        }
        wasMyTurn = player.isMyTurn;
        updateButtons();
    }

    function updateButtons() {
        var joinBtn = document.getElementById('joinQueueBtn');
        var leaveBtn = document.getElementById('leaveQueueBtn');
        if (player.isMyTurn) {
            joinBtn.hidden = true;
            leaveBtn.hidden = true;
        } else if (player.inQueue) {
            joinBtn.hidden = true;
            leaveBtn.hidden = false;
        } else {
            joinBtn.hidden = false;
            leaveBtn.hidden = true;
        }
    }

    function handleVoting(data) {
        var card = document.getElementById('votingCard');
        var interaction = document.getElementById('interactionSection');
        if (!data || !data.active) {
            card.hidden = true;
            resetVoting();
            clearInterval(voteTimer);
            return;
        }
        interaction.classList.remove('active');
        var singerKey = data.playerId || '';
        if ((singerKey && singerKey === player.id) || data.singerId === player.queueId) {
            card.hidden = true;
            return;
        }
        if (data.singerId !== voting.id) {
            resetVoting();
            voting.id = data.singerId;
            if (navigator.vibrate) navigator.vibrate([160, 70, 160]);
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (data.startTime) startVoteTimer(data.startTime);
        }
        card.hidden = false;
        document.getElementById('votingFor').textContent = data.singerName || '';
        document.getElementById('votingSong').textContent = U.decodeHtml(data.singerSong || '');
    }

    function startVoteTimer(startTime) {
        var timerEl = document.getElementById('voteTimerBig');
        clearInterval(voteTimer);
        var localStart = Date.now();
        var already = Math.max(0, Math.floor((localStart - startTime) / 1000));
        var update = function () {
            var elapsed = already + Math.floor((Date.now() - localStart) / 1000);
            var remaining = Math.max(0, CFG.voteSeconds - elapsed);
            timerEl.textContent = String(remaining);
            timerEl.classList.toggle('urgent', remaining <= 5 && remaining > 0);
            if (remaining <= 0) clearInterval(voteTimer);
        };
        update();
        voteTimer = setInterval(update, 250);
    }

    function selectStar(value) {
        if (voting.voted || !value) return;
        voting.selected = value;
        document.querySelectorAll('.vote-star').forEach(function (star) {
            star.classList.toggle('active', Number(star.getAttribute('data-value')) <= value);
        });
        var btn = document.getElementById('voteBtn');
        btn.disabled = false;
        var labels = ['', 'Fraco', 'Regular', 'Bom!', 'Ótimo!', 'Incrível!'];
        btn.textContent = 'Votar ' + value + ' ⭐ · ' + labels[value];
        if (navigator.vibrate) navigator.vibrate(20);
    }

    function submitVote() {
        if (!voting.selected || voting.voted || !player.id) return;
        gameRef.child('voting/votes/' + player.id).set(voting.selected).then(function () {
            voting.voted = true;
            var btn = document.getElementById('voteBtn');
            btn.disabled = true;
            btn.textContent = '✓ Voto enviado!';
            btn.classList.add('voted');
            if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
            showToast('Voto enviado!', 'success');
        }).catch(function () {
            showToast('Não foi possível votar', 'error');
        });
    }

    function resetVoting() {
        voting = { id: null, selected: 0, voted: false };
        document.querySelectorAll('.vote-star').forEach(function (star) { star.classList.remove('active'); });
        var btn = document.getElementById('voteBtn');
        btn.disabled = true;
        btn.textContent = 'Toque nas estrelas';
        btn.classList.remove('voted');
        var timer = document.getElementById('voteTimerBig');
        timer.textContent = String(CFG.voteSeconds);
        timer.classList.remove('urgent');
    }

    function checkMyResult(result) {
        if (!result || !result.finishedAt || !result.playerId) return;
        if (result.playerId !== player.id) return;
        if (Math.abs(Date.now() - result.finishedAt) > 15 * 60 * 1000) return;
        if (String(result.finishedAt) === lastResultSeen) return;
        lastResultSeen = String(result.finishedAt);
        try { sessionStorage.setItem(U.storageKey('result'), lastResultSeen); } catch (e) {}
        showShareCard(result);
    }

    function showShareCard(result) {
        document.getElementById('shareName').textContent = result.singerName || player.name;
        document.getElementById('shareSong').textContent = U.decodeHtml(result.singerSong || '');
        var applause = Number(result.applause) || 0;
        document.getElementById('shareApplauseCount').textContent = String(applause);
        document.getElementById('shareApplauseFill').style.width = Math.min(100, (applause / 500) * 100) + '%';

        var avg = parseFloat(result.voteAvg);
        if (isNaN(avg)) avg = 0;
        document.getElementById('shareAvgText').textContent = result.voteAvg || '0';
        var stars = document.getElementById('shareStars');
        stars.replaceChildren();
        var full = Math.round(avg);
        for (var i = 0; i < 5; i++) {
            var star = document.createElement('span');
            star.className = 'star' + (i >= full ? ' empty' : '');
            star.textContent = '⭐';
            stars.appendChild(star);
        }
        document.getElementById('sharePoints').textContent = String(result.totalScore || 0);

        var photo = U.safeDataImage(result.singerPhoto) || player.photo;
        var img = document.getElementById('sharePhotoImg');
        var fallback = document.getElementById('shareNoPhoto');
        if (photo) {
            img.src = photo;
            img.hidden = false;
            fallback.hidden = true;
        } else {
            img.removeAttribute('src');
            img.hidden = true;
            fallback.hidden = false;
        }
        document.getElementById('shareCard').classList.add('show');
        if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 120]);
    }

    function closeShareCard() {
        document.getElementById('shareCard').classList.remove('show');
    }

    async function downloadCard() {
        if (typeof html2canvas !== 'function') {
            showToast('Não foi possível gerar a imagem', 'error');
            return;
        }
        try {
            var canvas = await html2canvas(document.getElementById('sharePreview'), {
                backgroundColor: null,
                scale: 2,
                useCORS: true,
                logging: false
            });
            var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
            if (!blob) throw new Error('imagem vazia');
            var safeName = (player.name || 'veloso').replace(/[^\w\-]+/g, '-').slice(0, 24);
            var file = new File([blob], 'karaoke-' + safeName + '.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Karaokê dos Veloso' });
                showToast('Imagem pronta', 'success');
                return;
            }
            var link = document.createElement('a');
            link.download = file.name;
            link.href = URL.createObjectURL(blob);
            link.click();
            setTimeout(function () { URL.revokeObjectURL(link.href); }, 2500);
            showToast('Imagem salva!', 'success');
        } catch (e) {
            if (e && e.name === 'AbortError') return;
            console.error(e);
            showToast('Não foi possível salvar a imagem', 'error');
        }
    }

    function renderScores(scores) {
        var list = document.getElementById('scoreboard');
        var rows = U.scoreRows(scores);
        list.replaceChildren();
        if (!rows.length) {
            list.appendChild(emptyBlock('⭐', 'Sem pontuações'));
            return;
        }
        var medals = ['🥇', '🥈', '🥉'];
        rows.forEach(function (row, index) {
            var item = document.createElement('div');
            item.className = 'score-item';
            if (index < 3) {
                var medal = document.createElement('span');
                medal.className = 'medal';
                medal.textContent = medals[index];
                item.appendChild(medal);
            } else {
                var rank = document.createElement('div');
                rank.className = 'rank';
                rank.textContent = String(index + 1);
                item.appendChild(rank);
            }
            var name = document.createElement('div');
            name.className = 'name';
            name.textContent = row.name;
            var pts = document.createElement('div');
            pts.className = 'pts';
            pts.textContent = row.points + ' pts';
            item.append(name, pts);
            list.appendChild(item);
        });
    }

    function emptyBlock(icon, text) {
        var wrap = document.createElement('div');
        wrap.className = 'empty-list';
        var i = document.createElement('div');
        i.className = 'icon';
        i.textContent = icon;
        var p = document.createElement('p');
        p.textContent = text;
        wrap.append(i, p);
        return wrap;
    }

    function showToast(message, type) {
        var toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + (type || '') + ' show';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2600);
    }
})();
