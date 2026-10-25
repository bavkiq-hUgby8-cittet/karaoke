(function () {
    'use strict';

    var U = window.KaraokeUtil;
    var CFG = window.KARAOKE;
    var results = { firebase: null, qr: null, search: null, youtube: null, camera: null };
    var db;

    document.addEventListener('DOMContentLoaded', function () {
        document.getElementById('writeBtn').addEventListener('click', testWrite);
        document.getElementById('readBtn').addEventListener('click', testRead);
        document.getElementById('searchBtn').addEventListener('click', testSearch);
        document.getElementById('cameraBtn').addEventListener('click', testCamera);
        initFirebase();
        initQR();
        initYouTube();
        renderSummary();
    });

    function log(id, message, kind) {
        var box = document.getElementById(id);
        var line = document.createElement('div');
        line.className = kind || '';
        line.textContent = message;
        box.appendChild(line);
        box.scrollTop = box.scrollHeight;
    }

    function setStatus(id, text, ok) {
        var el = document.getElementById(id);
        el.textContent = text;
        el.className = 'status ' + (ok === true ? 'ok' : ok === false ? 'error' : '');
    }

    function initFirebase() {
        if (typeof firebase === 'undefined') {
            log('firebaseLog', 'O script do Firebase não carregou.', 'bad');
            setStatus('firebaseStatus', 'Erro', false);
            results.firebase = false;
            renderSummary();
            return;
        }
        try {
            firebase.initializeApp(CFG.firebase);
            db = firebase.database();
            log('firebaseLog', 'SDK carregado. Projeto ' + CFG.firebase.projectId + '.', 'ok');
            db.ref('.info/connected').on('value', function (snap) {
                var on = snap.val() === true;
                setStatus('firebaseStatus', on ? 'Conectado' : 'Reconectando...', on ? true : null);
                if (on) {
                    log('firebaseLog', 'Conexão em tempo real ativa.', 'ok');
                    results.firebase = true;
                    renderSummary();
                }
            });
        } catch (error) {
            log('firebaseLog', error.message, 'bad');
            setStatus('firebaseStatus', 'Erro', false);
            results.firebase = false;
            renderSummary();
        }
    }

    function diagRef() {
        return db.ref('karaoke_diagnostico');
    }

    function testWrite() {
        if (!db) return;
        log('firebaseLog', 'Gravando em karaoke_diagnostico (não mexe na festa)...');
        diagRef().set({
            mensagem: 'Teste de escrita',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(function () {
            log('firebaseLog', 'Escrita ok.', 'ok');
            return diagRef().remove();
        }).then(function () {
            log('firebaseLog', 'Registro de teste apagado.', 'ok');
        }).catch(function (error) {
            log('firebaseLog', 'Falhou: ' + error.message, 'bad');
            log('firebaseLog', 'Confira se as regras do Realtime Database permitem leitura e escrita.', 'bad');
            results.firebase = false;
            setStatus('firebaseStatus', 'Sem permissão', false);
            renderSummary();
        });
    }

    function testRead() {
        if (!db) return;
        log('firebaseLog', 'Lendo a sala principal (só as chaves)...');
        db.ref('karaoke').once('value').then(function (snap) {
            var val = snap.val() || {};
            log('firebaseLog', 'Leitura ok. Chaves: ' + (Object.keys(val).join(', ') || '(vazia)'), 'ok');
        }).catch(function (error) {
            log('firebaseLog', 'Falhou: ' + error.message, 'bad');
        });
    }

    function initQR() {
        var url = U.playerPageUrl();
        if (typeof QRCode === 'undefined' || !QRCode.toDataURL) {
            log('qrLog', 'vendor/qrcode.min.js não carregou.', 'bad');
            setStatus('qrStatus', 'Erro', false);
            results.qr = false;
            renderSummary();
            return;
        }
        QRCode.toDataURL(url, { width: 300, margin: 1 }, function (err, dataUrl) {
            if (err || !dataUrl) {
                log('qrLog', 'Falha ao desenhar o QR Code.', 'bad');
                setStatus('qrStatus', 'Erro', false);
                results.qr = false;
            } else {
                document.getElementById('qrImg').src = dataUrl;
                log('qrLog', 'QR gerado neste próprio site.', 'ok');
                log('qrLog', url);
                setStatus('qrStatus', 'Ok', true);
                results.qr = true;
            }
            renderSummary();
        });
    }

    function testSearch() {
        var params = new URLSearchParams({
            part: 'snippet',
            maxResults: '1',
            q: 'evidencias karaoke',
            type: 'video',
            videoEmbeddable: 'true',
            key: CFG.youtubeApiKey
        });
        log('searchLog', 'Consultando a busca do YouTube...');
        fetch('https://www.googleapis.com/youtube/v3/search?' + params.toString())
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok) {
                    var reason = result.data.error && result.data.error.message;
                    log('searchLog', reason || 'A busca falhou.', 'bad');
                    setStatus('searchStatus', 'Erro', false);
                    results.search = false;
                } else {
                    var item = (result.data.items || [])[0];
                    var title = item && item.snippet ? item.snippet.title : '(sem título)';
                    log('searchLog', 'Busca ok. Exemplo: ' + title, 'ok');
                    setStatus('searchStatus', 'Ok', true);
                    results.search = true;
                }
                renderSummary();
            })
            .catch(function () {
                log('searchLog', 'Sem rede para falar com o YouTube.', 'bad');
                setStatus('searchStatus', 'Erro', false);
                results.search = false;
                renderSummary();
            });
    }

    function initYouTube() {
        log('ytLog', 'Carregando o player do YouTube...');
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = function () {
            log('ytLog', 'A API do player não carregou.', 'bad');
            setStatus('ytStatus', 'Erro', false);
            results.youtube = false;
            renderSummary();
        };
        window.onYouTubeIframeAPIReady = function () {
            log('ytLog', 'API do player carregada.', 'ok');
            new YT.Player('youtubeTest', {
                videoId: 'M7lc1UVf-VE',
                playerVars: { autoplay: 0, rel: 0, playsinline: 1 },
                events: {
                    onReady: function () {
                        log('ytLog', 'Player pronto. O vídeo de teste é o demo oficial do YouTube.', 'ok');
                        setStatus('ytStatus', 'Ok', true);
                        results.youtube = true;
                        renderSummary();
                    },
                    onError: function (event) {
                        log('ytLog', 'O player abriu, mas este vídeo retornou o erro ' + event.data + '.', 'bad');
                        log('ytLog', 'Erro 101 ou 150: o dono bloqueou incorporar. Erro 100: vídeo indisponível.', 'bad');
                        setStatus('ytStatus', 'Vídeo recusado', false);
                        results.youtube = false;
                        renderSummary();
                    }
                }
            });
        };
        document.head.appendChild(tag);
    }

    function testCamera() {
        log('cameraLog', 'Pedindo a câmera...');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            log('cameraLog', 'Este navegador não oferece câmera aqui.', 'bad');
            setStatus('cameraStatus', 'Indisponível', false);
            results.camera = false;
            renderSummary();
            return;
        }
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(function (stream) {
            stream.getTracks().forEach(function (track) { track.stop(); });
            log('cameraLog', 'Câmera autorizada. O jogo usa a câmera para a foto de perfil e para o telão.', 'ok');
            setStatus('cameraStatus', 'Ok', true);
            results.camera = true;
            renderSummary();
        }).catch(function (error) {
            log('cameraLog', error.message || 'Permissão negada.', 'bad');
            setStatus('cameraStatus', 'Negada', false);
            results.camera = false;
            renderSummary();
        });
    }

    function renderSummary() {
        var list = document.getElementById('summary');
        list.replaceChildren();
        [
            ['Firebase', results.firebase],
            ['QR Code', results.qr],
            ['Busca do YouTube', results.search],
            ['Player do YouTube', results.youtube],
            ['Câmera', results.camera]
        ].forEach(function (row) {
            var item = document.createElement('li');
            var mark = row[1] === true ? '✅' : row[1] === false ? '❌' : '⏳';
            var text = row[1] === true ? 'funcionando' : row[1] === false ? 'com problema' : 'aguardando';
            item.textContent = mark + ' ' + row[0] + ': ' + text;
            list.appendChild(item);
        });
    }
})();
