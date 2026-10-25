(function () {
    'use strict';

    var U = window.KaraokeUtil;
    var CFG = window.KARAOKE;
    var db;
    var gameRef;
    var currentSinger = null;
    var applauseTotal = 0;
    var photos = [];
    var ytPlayer = null;
    var playerToken = 0;
    var ytApiPromise = null;
    var wantedVideoId = null;
    var loadedVideoId = null;
    var hasPlayed = false;
    var votingActive = false;
    var voteTick = null;
    var votingTimer = null;
    var slideTimer = null;
    var endingVote = false;
    var overlayOpen = false;
    var toastTimer = null;

    document.addEventListener('DOMContentLoaded', init);
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && overlayOpen && !endingVote && voteTick) voteTick();
    });

    function init() {
        document.getElementById('startBtn').addEventListener('click', startApp);
        document.getElementById('btnPlay').addEventListener('click', togglePlay);
        document.getElementById('btnFullscreen').addEventListener('click', toggleFullscreen);
        initUx();
        document.getElementById('btnVote').addEventListener('click', startVoting);
        document.getElementById('btnSkip').addEventListener('click', skipSinger);
        document.getElementById('btnReset').addEventListener('click', resetAll);
        document.getElementById('playOverlayBtn').addEventListener('click', playVideo);
        document.getElementById('copyLink').addEventListener('click', copyLink);
        window.addEventListener('resize', resizePlayer);

        var sala = U.roomId();
        if (sala) {
            var badge = document.getElementById('roomBadge');
            badge.hidden = false;
            badge.textContent = 'Sala ' + sala;
        }

        if (typeof firebase === 'undefined') {
            document.getElementById('bootError').hidden = false;
            setStatus(false, 'Firebase não carregou');
            return;
        }
        initFirebase();
        document.getElementById('startBtn').focus();
    }

    function startApp() {
        document.getElementById('tutorial').classList.add('hidden');
        document.getElementById('app').classList.add('active');
        generateQR();
        try { if (localStorage.getItem('karaoke_fs') === '1') enterFullscreen(); } catch (e) {}
    }

    // ---- UX da TV: tocar/pausar, atalhos, tela cheia, cursor, confirmações ----
    var isPlaying = false;
    var skipArmed = null;
    var idleTimer = null;

    function setPlaying(on) {
        isPlaying = !!on;
        var b = document.getElementById('btnPlay');
        b.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
        b.classList.toggle('playing', isPlaying);
        b.querySelector('.ic').textContent = isPlaying ? '⏸' : '▶';
        b.querySelector('.lbl').textContent = isPlaying ? 'Pausar' : 'Tocar';
    }

    function setVoteAttention(on) {
        document.getElementById('btnVote').classList.toggle('attention', !!on);
    }

    function togglePlay() {
        if (isPlaying) pauseVideo(); else playVideo();
    }

    function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement; }

    function enterFullscreen() {
        var el = document.documentElement;
        var fn = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!fn) return;
        try { var r = fn.call(el); if (r && r.catch) r.catch(function () {}); } catch (e) {}
    }

    function toggleFullscreen() {
        if (fsElement()) {
            var ex = document.exitFullscreen || document.webkitExitFullscreen;
            if (ex) ex.call(document);
            try { localStorage.setItem('karaoke_fs', '0'); } catch (e) {}
        } else {
            enterFullscreen();
            try { localStorage.setItem('karaoke_fs', '1'); } catch (e) {}
        }
    }

    function onFsChange() {
        var on = !!fsElement();
        var b = document.getElementById('btnFullscreen');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.querySelector('.lbl').textContent = on ? 'Sair da tela cheia' : 'Tela cheia';
        setTimeout(resizePlayer, 150);
    }

    function wake() {
        document.body.classList.remove('idle');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () { document.body.classList.add('idle'); }, 3000);
    }

    function disarmSkip() {
        if (!skipArmed) return;
        clearTimeout(skipArmed);
        skipArmed = null;
        var b = document.getElementById('btnSkip');
        b.classList.remove('armed');
        b.querySelector('.lbl').textContent = 'Pular';
    }

    function openReset() {
        var d = document.getElementById('resetDialog');
        var input = document.getElementById('resetInput');
        input.value = '';
        document.getElementById('resetConfirm').disabled = true;
        d.hidden = false;
        input.focus();
    }

    function closeReset() {
        document.getElementById('resetDialog').hidden = true;
        document.getElementById('btnReset').focus();
    }

    function initUx() {
        setPlaying(false);
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        ['mousemove', 'mousedown', 'touchstart', 'keydown'].forEach(function (ev) {
            document.addEventListener(ev, wake, { passive: true });
        });
        wake();
        var input = document.getElementById('resetInput');
        input.addEventListener('input', function () {
            document.getElementById('resetConfirm').disabled = input.value.trim().toUpperCase() !== 'APAGAR';
        });
        document.getElementById('resetCancel').addEventListener('click', closeReset);
        document.getElementById('resetForm').addEventListener('submit', function (e) {
            e.preventDefault();
            if (input.value.trim().toUpperCase() !== 'APAGAR') return;
            document.getElementById('resetDialog').hidden = true;
            doReset();
        });
        document.addEventListener('keydown', function (e) {
            if (!document.getElementById('resetDialog').hidden) {
                if (e.key === 'Escape') closeReset();
                return;
            }
            if (!document.getElementById('app').classList.contains('active')) return;
            var t = e.target;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
            var k = e.key.toLowerCase();
            if (k === 'f') { e.preventDefault(); toggleFullscreen(); }
            else if (k === ' ' || k === 'k') {
                if (t && t.tagName === 'BUTTON' && k === ' ') return;
                e.preventDefault(); togglePlay();
            }
            else if (k === 'v') { e.preventDefault(); startVoting(); }
            else if (k === 'n') { e.preventDefault(); skipSinger(); }
        });
    }

    function initFirebase() {
        firebase.initializeApp(CFG.firebase);
        db = firebase.database();
        gameRef = db.ref(U.dbPath());
        db.ref('.info/connected').on('value', function (snap) {
            var on = snap.val() === true;
            setStatus(on, on ? 'Conectado' : 'Reconectando...');
        });

        var onErr = function (err) {
            console.error(err);
            setStatus(false, 'Sem permissão');
            showToast('O Firebase bloqueou a leitura. Confira as regras do banco.', 'error');
        };

        gameRef.child('queue').on('value', function (snap) {
            renderQueue(snap.val() || {});
        }, onErr);
        gameRef.child('scores').on('value', function (snap) {
            renderScores(snap.val());
        }, onErr);
        gameRef.child('voting').on('value', function (snap) {
            handleVoting(snap.val());
        }, onErr);
        gameRef.child('participants').on('value', function (snap) {
            var val = snap.val();
            var n = val ? Object.keys(val).length : 0;
            document.getElementById('participantsCount').textContent = '👥 ' + n;
        }, onErr);
        gameRef.child('reactions').on('child_added', function (snap) {
            var data = snap.val();
            if (data && data.timestamp && Date.now() - data.timestamp > 15000) {
                snap.ref.remove();
                return;
            }
            showReaction(data);
            snap.ref.remove();
        });
        gameRef.child('applause').on('value', function (snap) {
            applauseTotal = Number(snap.val()) || 0;
            updateApplauseMeter();
        });
        gameRef.child('photos').on('child_added', function (snap) {
            var val = snap.val();
            if (!val || !U.safeDataImage(val.image)) return;
            if (val.timestamp && Date.now() - val.timestamp > 3 * 60 * 60 * 1000) return;
            photos.push(val);
            if (photos.length > 12) photos.splice(0, photos.length - 12);
        });
    }

    function setStatus(online, text) {
        document.getElementById('statusDot').classList.toggle('online', !!online);
        document.getElementById('statusText').textContent = text;
    }

    function generateQR() {
        var url = U.playerPageUrl();
        var link = document.getElementById('qrUrl');
        link.href = url;
        link.title = url;
        link.textContent = url.replace(/^https?:\/\//, '').replace(/^([^/]+)\/.*?([^/]+\/[^/?]+(\?.*)?)$/, function (m, host, tail) {
            return host.split('.')[0] + '…/' + tail;
        });
        var img = document.getElementById('qrcode');
        if (typeof QRCode === 'undefined' || !QRCode.toDataURL) {
            img.alt = 'QR Code indisponível. Use o link abaixo.';
            showToast('Não foi possível gerar o QR Code. Use o link.', 'error');
            return;
        }
        QRCode.toDataURL(url, {
            width: 320,
            margin: 1,
            color: { dark: '#10002b', light: '#ffffff' }
        }, function (err, dataUrl) {
            if (err || !dataUrl) {
                img.alt = 'QR Code indisponível. Use o link abaixo.';
                showToast('Não foi possível gerar o QR Code. Use o link.', 'error');
                return;
            }
            img.src = dataUrl;
            img.alt = 'QR Code para entrar no karaokê';
        });
    }

    function copyLink() {
        var url = document.getElementById('qrUrl').href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                showToast('Link copiado', 'success');
            }).catch(function () {
                showToast('Selecione o link e copie', 'error');
            });
            return;
        }
        showToast('Selecione o link e copie', 'error');
    }

    function showReaction(r) {
        if (!r || typeof r !== 'object') return;
        var overlay = document.getElementById('reactionsOverlay');
        if (overlay.childElementCount > 24) overlay.firstElementChild.remove();

        if (r.type === 'clap') {
            var clap = document.createElement('div');
            clap.className = 'clap-burst';
            clap.textContent = '👏';
            clap.style.left = (Math.random() * 80 + 10) + '%';
            clap.style.top = (Math.random() * 60 + 20) + '%';
            overlay.appendChild(clap);
            setTimeout(function () { clap.remove(); }, 800);
            return;
        }

        var div = document.createElement('div');
        div.className = 'floating-reaction';
        div.style.left = (Math.random() * 70 + 8) + '%';

        if (r.type === 'emoji') {
            var emoji = document.createElement('span');
            emoji.className = 'emoji';
            emoji.textContent = String(r.value || '').slice(0, 8);
            div.appendChild(emoji);
        } else if (r.type === 'phrase') {
            var phrase = document.createElement('span');
            phrase.className = 'phrase';
            phrase.textContent = String(r.value || '').slice(0, 40);
            div.appendChild(phrase);
        } else {
            return;
        }

        if (r.name) {
            var sender = document.createElement('span');
            sender.className = 'sender';
            var photo = U.safeDataImage(r.photo);
            if (photo) {
                var img = document.createElement('img');
                img.src = photo;
                img.alt = '';
                sender.appendChild(img);
            }
            sender.appendChild(document.createTextNode(String(r.name).slice(0, 20)));
            div.appendChild(sender);
        }

        overlay.appendChild(div);
        setTimeout(function () { div.remove(); }, 4000);
    }

    function updateApplauseMeter() {
        var meter = document.getElementById('applauseMeter');
        if (!currentSinger) {
            meter.hidden = true;
            return;
        }
        meter.hidden = false;
        document.getElementById('applauseCount').textContent = String(applauseTotal);
        document.getElementById('applauseFill').style.width = Math.min(100, applauseTotal / 5) + '%';
    }

    function renderQueue(queue) {
        var items = Object.keys(queue).map(function (id) {
            return Object.assign({ id: id }, queue[id]);
        }).sort(function (a, b) {
            return (a.timestamp || 0) - (b.timestamp || 0);
        });

        document.getElementById('queueCount').textContent = String(items.length);
        var list = document.getElementById('queueList');
        list.replaceChildren();

        if (!items.length) {
            list.appendChild(emptyState('🎵', 'Fila vazia'));
            clearStage();
            return;
        }

        items.forEach(function (item, index) {
            list.appendChild(queueRow(item, index));
        });

        var first = items[0];
        var singerChanged = currentSinger && currentSinger.id !== first.id;
        if (singerChanged) {
            gameRef.child('applause').set(0);
            gameRef.child('photos').remove();
            photos = [];
            applauseTotal = 0;
            hasPlayed = false;
            updateApplauseMeter();
        }

        currentSinger = first;
        renderSinger(first);
        updateApplauseMeter();

        if (first.videoId && first.videoId !== loadedVideoId) loadVideo(first.videoId);
        else if (!first.videoId) clearVideo();
    }

    function queueRow(item, index) {
        var row = document.createElement('div');
        row.className = 'queue-item';

        var pos = document.createElement('div');
        pos.className = 'position';
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
        name.textContent = item.name || 'Sem nome';
        var song = document.createElement('div');
        song.className = 'song';
        song.textContent = U.decodeHtml(item.song || 'Escolhendo...');
        info.append(name, song);

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove-btn';
        remove.textContent = '✕';
        remove.setAttribute('aria-label', 'Remover ' + (item.name || 'da fila'));
        remove.addEventListener('click', function () {
            if (confirm('Remover ' + (item.name || 'esta pessoa') + ' da fila?')) {
                gameRef.child('queue/' + item.id).remove();
            }
        });

        row.append(pos, avatar, info, remove);
        return row;
    }

    function renderSinger(item) {
        var card = document.getElementById('singerCard');
        card.className = 'singer-card';
        card.replaceChildren();

        var avatar = document.createElement('div');
        avatar.className = 'singer-avatar';
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
        info.className = 'singer-info';
        var label = document.createElement('div');
        label.className = 'label';
        label.textContent = 'Cantando';
        var name = document.createElement('div');
        name.className = 'name';
        name.textContent = item.name || 'Sem nome';
        var song = document.createElement('div');
        song.className = 'song';
        song.textContent = U.decodeHtml(item.song || '');
        info.append(label, name, song);
        card.append(avatar, info);
        document.getElementById('placeholder').classList.add('hidden');
    }

    function clearStage() {
        currentSinger = null;
        loadedVideoId = null;
        wantedVideoId = null;
        hasPlayed = false;
        var card = document.getElementById('singerCard');
        card.className = 'singer-card empty';
        card.textContent = '🎤 Nenhum cantor';
        document.getElementById('placeholder').classList.remove('hidden');
        document.getElementById('applauseMeter').hidden = true;
        hidePlayOverlay();
        hideVideoError();
        destroyVideo();
    }

    function emptyState(icon, text) {
        var wrap = document.createElement('div');
        wrap.className = 'empty-state';
        var i = document.createElement('div');
        i.className = 'icon';
        i.textContent = icon;
        var p = document.createElement('p');
        p.textContent = text;
        wrap.append(i, p);
        return wrap;
    }

    function ensureYT() {
        if (window.YT && window.YT.Player) return Promise.resolve(true);
        if (ytApiPromise) return ytApiPromise;
        ytApiPromise = new Promise(function (resolve) {
            var done = false;
            var finish = function (ok) {
                if (done) return;
                done = true;
                resolve(ok);
            };
            var timeout = setTimeout(function () { finish(!!(window.YT && window.YT.Player)); }, 8000);
            var previous = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = function () {
                clearTimeout(timeout);
                if (typeof previous === 'function') previous();
                finish(true);
            };
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.async = true;
            tag.onerror = function () {
                clearTimeout(timeout);
                finish(false);
            };
            document.head.appendChild(tag);
        });
        return ytApiPromise;
    }

    function mountPlayerDiv() {
        var node = document.getElementById('ytPlayer');
        if (!node) {
            node = document.createElement('div');
            node.id = 'ytPlayer';
            var wrapper = document.getElementById('videoWrapper');
            wrapper.insertBefore(node, wrapper.firstChild);
        }
        return node;
    }

    function playerSize() {
        var box = document.getElementById('videoWrapper').getBoundingClientRect();
        return {
            width: Math.max(280, Math.round(box.width)),
            height: Math.max(158, Math.round(box.height))
        };
    }

    function resizePlayer() {
        if (!ytPlayer || !ytPlayer.setSize) return;
        var size = playerSize();
        try { ytPlayer.setSize(size.width, size.height); } catch (e) {}
    }

    function loadVideo(id) {
        if (!/^[\w-]{11}$/.test(id)) return;
        if (loadedVideoId === id && (ytPlayer || document.querySelector('#videoWrapper iframe'))) return;
        wantedVideoId = id;
        hasPlayed = false;
        hideVideoError();
        document.getElementById('placeholder').classList.add('hidden');
        showPlayOverlay('Toque para tocar com som');

        ensureYT().then(function (ok) {
            if (wantedVideoId !== id) return;
            if (!ok) {
                mountFallback(id);
                return;
            }
            var size = playerSize();
            if (ytPlayer && ytPlayer.loadVideoById) {
                loadedVideoId = id;
                ytPlayer.loadVideoById(id);
                return;
            }
            destroyVideo();
            wantedVideoId = id;
            mountPlayerDiv();
            var token = ++playerToken;
            try {
            ytPlayer = new YT.Player('ytPlayer', {
                width: size.width,
                height: size.height,
                videoId: id,
                playerVars: {
                    autoplay: 1,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    origin: location.origin
                },
                events: {
                    onReady: function (event) {
                        if (token !== playerToken) return;
                        loadedVideoId = id;
                        try { event.target.playVideo(); } catch (e) {}
                        resizePlayer();
                    },
                    onStateChange: function (event) {
                        if (token !== playerToken) return;
                        onPlayerState(event);
                    },
                    onError: function (event) {
                        if (token !== playerToken) return;
                        showVideoError(event.data);
                    }
                }
            });
            loadedVideoId = id;
            } catch (err) {
                console.error(err);
                mountFallback(id);
            }
        });
    }

    function mountFallback(id) {
        destroyVideo();
        wantedVideoId = id;
        loadedVideoId = id;
        var frame = document.createElement('iframe');
        frame.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
        frame.title = 'Vídeo de karaokê';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        document.getElementById('videoWrapper').insertBefore(frame, document.getElementById('videoWrapper').firstChild);
        showPlayOverlay('Se o vídeo não começar, use o play do YouTube');
    }

    function destroyVideo() {
        playerToken += 1;
        if (ytPlayer && ytPlayer.destroy) {
            try { ytPlayer.destroy(); } catch (e) {}
        }
        ytPlayer = null;
        var frame = document.querySelector('#videoWrapper iframe');
        if (frame) frame.remove();
        var leftover = document.getElementById('ytPlayer');
        if (leftover) leftover.remove();
    }

    function clearVideo() {
        loadedVideoId = null;
        wantedVideoId = null;
        destroyVideo();
        hidePlayOverlay();
        setPlaying(false);
        setVoteAttention(false);
    }

    function onPlayerState(event) {
        if (!window.YT || !YT.PlayerState) return;
        if (event.data === YT.PlayerState.PLAYING) {
            hasPlayed = true;
            setPlaying(true);
            setVoteAttention(false);
            hidePlayOverlay();
            hideVideoError();
        } else if (event.data === YT.PlayerState.PAUSED) {
            setPlaying(false);
        } else if (event.data === YT.PlayerState.ENDED) {
            setPlaying(false);
            if (currentSinger) setVoteAttention(true);
            hidePlayOverlay();
            if (currentSinger && !votingActive && !endingVote) startVoting();
        }
    }

    function playVideo() {
        hideVideoError();
        if (ytPlayer && ytPlayer.playVideo) {
            try { ytPlayer.playVideo(); } catch (e) {}
            return;
        }
        if (currentSinger && currentSinger.videoId) loadVideo(currentSinger.videoId);
    }

    function pauseVideo() {
        if (ytPlayer && ytPlayer.pauseVideo) {
            try { ytPlayer.pauseVideo(); } catch (e) {}
        }
    }

    function showPlayOverlay(message) {
        if (hasPlayed) return;
        var overlay = document.getElementById('playOverlay');
        overlay.hidden = false;
        document.getElementById('playOverlayText').textContent = message || 'Toque para tocar com som';
    }

    function hidePlayOverlay() {
        document.getElementById('playOverlay').hidden = true;
    }

    function showVideoError(code) {
        hidePlayOverlay();
        var messages = {
            2: 'O código desse vídeo é inválido.',
            5: 'O player do YouTube teve um erro. Tente tocar de novo.',
            100: 'Esse vídeo não está disponível.',
            101: 'O dono do vídeo não deixa tocar fora do YouTube. Peça outra versão.',
            150: 'O dono do vídeo não deixa tocar fora do YouTube. Peça outra versão.'
        };
        document.getElementById('videoErrorText').textContent = messages[code] || 'Não foi possível reproduzir este vídeo.';
        document.getElementById('videoError').hidden = false;
    }

    function hideVideoError() {
        document.getElementById('videoError').hidden = true;
    }

    function renderScores(scores) {
        var list = document.getElementById('scoreboard');
        var rows = U.scoreRows(scores);
        list.replaceChildren();
        if (!rows.length) {
            list.appendChild(emptyState('⭐', 'Sem pontuações'));
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

    function startVoting() {
        if (!currentSinger) {
            showToast('Ninguém na fila', 'error');
            return;
        }
        if (votingActive || endingVote) return;
        setVoteAttention(false);
        votingActive = true;
        var singer = currentSinger;
        var round = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        // Transação: se outra TV já abriu a votação, não sobrescreve os votos dela.
        gameRef.child('voting').transaction(function (current) {
            if (current && current.active) return;
            return {
                round: round,
                singerId: singer.id,
                playerId: U.playerKey(singer) || null,
                singerName: singer.name || 'Cantor',
                singerPhoto: U.safeDataImage(singer.photo) || null,
                singerSong: U.decodeHtml(singer.song || ''),
                applause: applauseTotal,
                active: true,
                startTime: firebase.database.ServerValue.TIMESTAMP
            };
        }).catch(function (err) {
            votingActive = false;
            console.error(err);
            showToast('Não foi possível abrir a votação', 'error');
        });
    }

    function handleVoting(voting) {
        if (!voting || !voting.active) {
            votingActive = false;
            if (overlayOpen && !endingVote) closeVotingOverlay();
            return;
        }
        votingActive = true;
        var values = Object.keys(voting.votes || {}).map(function (key) {
            return Number(voting.votes[key]);
        }).filter(function (n) { return !isNaN(n); });
        var count = values.length;
        var avg = count ? values.reduce(function (a, b) { return a + b; }, 0) / count : 0;
        document.getElementById('statVotes').textContent = String(count);
        document.getElementById('statAvg').textContent = count ? avg.toFixed(1) : '–';
        document.getElementById('statApplause').textContent = String(voting.applause || 0);
        if (!overlayOpen && voting.startTime) openVotingOverlay(voting);
    }

    function openVotingOverlay(voting) {
        overlayOpen = true;
        endingVote = false;
        document.getElementById('votingOverlay').classList.add('show');
        document.getElementById('votingSinger').textContent = voting.singerName || '';
        document.getElementById('votingSong').textContent = U.decodeHtml(voting.singerSong || '');
        startSlideshow();

        var total = CFG.voteSeconds;
        var timerEl = document.getElementById('votingTimer');
        var localStart = Date.now();
        var alreadyElapsed = 0;
        if (typeof voting.startTime === 'number') {
            alreadyElapsed = Math.max(0, Math.floor((Date.now() - voting.startTime) / 1000));
        }
        var tick = function () {
            var elapsed = alreadyElapsed + Math.floor((Date.now() - localStart) / 1000);
            var remaining = Math.max(0, total - elapsed);
            timerEl.textContent = String(remaining);
            timerEl.classList.toggle('urgent', remaining <= 5);
            if (remaining <= 0) finishVoting();
        };
        voteTick = tick;
        tick();
        clearInterval(votingTimer);
        votingTimer = setInterval(tick, 250);
    }

    function startSlideshow() {
        var display = document.getElementById('clipDisplay');
        var tag = document.getElementById('clipSenderTag');
        var index = 0;
        var show = function () {
            if (!photos.length) {
                display.replaceChildren(emptyState('📸', 'Nenhuma foto ainda'));
                tag.hidden = true;
                return;
            }
            var photo = photos[index % photos.length];
            index += 1;
            var img = document.createElement('img');
            img.src = U.safeDataImage(photo.image);
            img.alt = 'Foto enviada pela plateia';
            display.replaceChildren(img);
            if (photo.senderName) {
                tag.hidden = false;
                document.getElementById('clipSenderName').textContent = String(photo.senderName).slice(0, 20);
                var avatar = document.getElementById('clipSenderPhoto');
                var src = U.safeDataImage(photo.senderPhoto);
                if (src) {
                    avatar.src = src;
                    avatar.hidden = false;
                } else {
                    avatar.hidden = true;
                }
            } else {
                tag.hidden = true;
            }
        };
        show();
        clearInterval(slideTimer);
        slideTimer = setInterval(show, 2500);
    }

    function finishVoting() {
        if (endingVote) return;
        endingVote = true;
        clearInterval(votingTimer);
        clearInterval(slideTimer);

        // Transação: só UMA TV fecha a votação e soma os pontos, mesmo com várias abertas.
        var closed = null;
        gameRef.child('voting').transaction(function (current) {
            if (!current || !current.active) return;
            closed = current;
            return { active: false, round: current.round || null, closedAt: firebase.database.ServerValue.TIMESTAMP };
        }).then(function (res) {
            if (!res.committed || !closed) return null;
            var voting = closed;
            var values = Object.keys(voting.votes || {}).map(function (key) {
                return Number(voting.votes[key]);
            }).filter(function (n) { return !isNaN(n); });
            var voteCount = values.length;
            var voteAvg = voteCount ? values.reduce(function (a, b) { return a + b; }, 0) / voteCount : 0;
            var applauseScore = Math.min(50, Math.round((Number(voting.applause) || 0) / 10));
            var voteScore = Math.round(voteAvg * 10);
            var totalScore = applauseScore + voteScore;
            var name = voting.singerName || 'Cantor';
            var updates = {};
            updates.lastResult = {
                playerId: voting.playerId || null,
                singerName: name,
                singerPhoto: U.safeDataImage(voting.singerPhoto) || null,
                singerSong: voting.singerSong || '',
                applause: Number(voting.applause) || 0,
                voteAvg: voteAvg.toFixed(1),
                voteCount: voteCount,
                totalScore: totalScore,
                finishedAt: Date.now()
            };
            updates.applause = 0;
            updates.photos = null;
            if (voting.singerId) updates['queue/' + voting.singerId] = null;

            var writes = [gameRef.update(updates)];
            if (totalScore > 0) {
                writes.push(gameRef.child('scores/' + U.scoreKey(name)).transaction(function (current) {
                    var prev = typeof current === 'number' ? current : (current && current.points) || 0;
                    return { name: name, points: prev + totalScore };
                }));
            }
            return Promise.all(writes).then(function () {
                showToast(name + ': ' + totalScore + ' pts', 'success');
            });
        }).catch(function (err) {
            console.error(err);
            showToast('Erro ao encerrar a votação', 'error');
        }).finally(function () {
            photos = [];
            loadedVideoId = null;
            setTimeout(closeVotingOverlay, 1600);
        });
    }

    function closeVotingOverlay() {
        overlayOpen = false;
        endingVote = false;
        votingActive = false;
        clearInterval(votingTimer);
        clearInterval(slideTimer);
        document.getElementById('votingOverlay').classList.remove('show');
    }

    function skipSinger() {
        if (!currentSinger) return;
        var name = currentSinger.name || 'esta pessoa';
        var btn = document.getElementById('btnSkip');
        if (!skipArmed) {
            btn.classList.add('armed');
            btn.querySelector('.lbl').textContent = 'Pular ' + name + '? Toque de novo';
            skipArmed = setTimeout(disarmSkip, 3500);
            return;
        }
        disarmSkip();
        setVoteAttention(false);
        var updates = {};
        updates['queue/' + currentSinger.id] = null;
        updates.applause = 0;
        updates.photos = null;
        updates.voting = { active: false };
        photos = [];
        gameRef.update(updates).catch(function () {
            showToast('Não foi possível pular', 'error');
        });
    }

    function resetAll() {
        openReset();
    }

    function doReset() {
        clearInterval(votingTimer);
        clearInterval(slideTimer);
        gameRef.set(null).then(function () {
            location.reload();
        }).catch(function () {
            showToast('Não foi possível resetar', 'error');
        });
    }

    function showToast(message, type) {
        var toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + (type || '') + ' show';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove('show');
        }, 3200);
    }
})();
