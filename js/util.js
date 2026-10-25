(function (global) {
    'use strict';

    var cfg = global.KARAOKE || {};

    function roomId() {
        var raw = '';
        try {
            raw = new URLSearchParams(global.location.search).get('sala') || '';
        } catch (e) {
            raw = '';
        }
        return String(raw).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
    }

    function dbPath() {
        var id = roomId();
        return id ? 'karaoke_' + id : 'karaoke';
    }

    function playerPageUrl() {
        var url;
        if (global.location.protocol === 'http:' || global.location.protocol === 'https:') {
            url = new URL('jogador.html', global.location.href);
        } else {
            url = new URL(cfg.publishedPlayerUrl);
        }
        var id = roomId();
        if (id) url.searchParams.set('sala', id);
        else url.searchParams.delete('sala');
        return url.href;
    }

    function decodeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&#(\d+);/g, function (_, n) {
                var code = Number(n);
                return code > 0 && code < 1114112 ? String.fromCodePoint(code) : _;
            })
            .replace(/&#x([0-9a-f]+);/gi, function (_, n) {
                var code = parseInt(n, 16);
                return code > 0 && code < 1114112 ? String.fromCodePoint(code) : _;
            })
            .replace(/&quot;/g, '"')
            .replace(/&apos;|&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    }

    function cleanName(name) {
        return String(name == null ? '' : name).replace(/[\u0000-\u001F]/g, '').trim().slice(0, 20);
    }

    function scoreKey(name) {
        var clean = cleanName(decodeHtml(name)).replace(/[.#$[\]/]/g, '').trim();
        return clean || 'Cantor';
    }

    function playerKey(item) {
        if (!item) return '';
        return String(item.playerId || item.odPlayerId || '');
    }

    function safeDataImage(url) {
        if (typeof url !== 'string' || url.length > 700000) return '';
        return /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(url) ? url : '';
    }

    function parseYouTubeId(input) {
        var text = String(input || '').trim();
        if (!text) return '';
        if (/^[\w-]{11}$/.test(text)) return text;
        var url;
        try {
            url = new URL(text);
        } catch (e) {
            return '';
        }
        var host = url.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') {
            var shortId = (url.pathname.split('/').filter(Boolean)[0] || '').split('?')[0];
            return /^[\w-]{11}$/.test(shortId) ? shortId : '';
        }
        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
            var fromQuery = url.searchParams.get('v') || '';
            if (/^[\w-]{11}$/.test(fromQuery)) return fromQuery;
            var parts = url.pathname.split('/').filter(Boolean);
            var markers = ['embed', 'shorts', 'live', 'v'];
            for (var i = 0; i < parts.length; i++) {
                if (markers.indexOf(parts[i]) !== -1 && /^[\w-]{11}$/.test(parts[i + 1] || '')) {
                    return parts[i + 1];
                }
            }
        }
        return '';
    }

    function scoreRows(scores) {
        if (!scores || typeof scores !== 'object') return [];
        return Object.keys(scores).map(function (key) {
            var val = scores[key];
            if (typeof val === 'number') return { name: key, points: val };
            if (val && typeof val === 'object') {
                return { name: String(val.name || key), points: Number(val.points) || 0 };
            }
            return null;
        }).filter(Boolean).sort(function (a, b) {
            return b.points - a.points;
        });
    }

    function storageKey(part) {
        return 'karaoke_' + (roomId() || 'principal') + '_' + part;
    }

    global.KaraokeUtil = {
        roomId: roomId,
        dbPath: dbPath,
        playerPageUrl: playerPageUrl,
        decodeHtml: decodeHtml,
        cleanName: cleanName,
        scoreKey: scoreKey,
        playerKey: playerKey,
        safeDataImage: safeDataImage,
        parseYouTubeId: parseYouTubeId,
        scoreRows: scoreRows,
        storageKey: storageKey
    };
})(window);
