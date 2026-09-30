/**
 * 台詞大亂鬥 - 5000則即興電子字卡系統 (Vercel Production Edition)
 * 負責人：游安晟
 * 地點：E125
 */

// 讀取 quotes.js 中全數 5,000 則龐大字卡庫
function getMasterQuotePool() {
    if (typeof masterQuotes !== 'undefined' && Array.isArray(masterQuotes) && masterQuotes.length > 0) {
        return masterQuotes;
    }
    // Fallback if quotes.js is still loading
    return [
        "這不是逼我去買大腸包小腸嗎？",
        "阿姨，我真的不想努力了。",
        "這一切都是外星人的陰謀！",
        "你這樣做，跟鹹魚有什麼分別？",
        "降龍十八掌的第一式是什麼？"
    ];
}

/**
 * 亂數種子生成器 (Mulberry32 PRNG)
 * 確保依據 Seed 能進行可預測但徹底無偏見的洗牌
 */
function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/**
 * 種子型 Fisher-Yates 洗牌演算法
 */
function seededFisherYatesShuffle(array, seed) {
    const shuffled = [...array];
    const prng = mulberry32(seed);
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 取得 URL 中的演員號碼參數 (?p=1 或 ?seat=1)
function getUrlSeatParameter() {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p') || params.get('seat');
    if (p && !isNaN(parseInt(p, 10))) {
        return parseInt(p, 10);
    }
    return 0; // 0 代表自動高熵獨立隨機模式
}

/**
 * 生成或取得當前演員的分區題庫 (5000則題庫 100% 絕不重複分流)
 */
function getPlayerQuoteSubpool() {
    const fullPool = getMasterQuotePool();
    const seat = getUrlSeatParameter();
    const savedSeat = sessionStorage.getItem('player_seat_id');
    const activeSeat = savedSeat !== null ? parseInt(savedSeat, 10) : seat;

    if (activeSeat > 0) {
        // 每位演員分配 400 ~ 500 張專屬完全不重疊的字卡區段 (Actor 1: 0..499, Actor 2: 500..999...)
        const chunkSize = Math.floor(fullPool.length / 10); // 500 張/演員
        const startIndex = (activeSeat - 1) * chunkSize;
        const endIndex = activeSeat === 10 ? fullPool.length : startIndex + chunkSize;
        return {
            quotes: fullPool.slice(startIndex, endIndex),
            seatName: `🎭 演員 ${activeSeat} 號 (專屬分流區段 #${startIndex + 1}~${endIndex})`,
            seatId: activeSeat
        };
    }

    // 0: 高熵種子隨機模式 (加密 Hash Seed 徹底打亂 5,000 則)
    let deviceSeed = sessionStorage.getItem('player_device_seed');
    if (!deviceSeed) {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        deviceSeed = array[0] || Date.now();
        sessionStorage.setItem('player_device_seed', deviceSeed);
    }

    return {
        quotes: fullPool,
        seatName: "🎲 自動高熵獨立模式 (全庫 5000 則)",
        seatId: 0
    };
}

/**
 * 讀取或初始化個人 Session 牌庫
 */
function getOrInitPlayerDeck() {
    const deckStorageKey = 'player_deck_5000';
    const drawnStorageKey = 'player_drawn_5000';

    let deckData = sessionStorage.getItem(deckStorageKey);
    let drawnData = sessionStorage.getItem(drawnStorageKey);

    const poolInfo = getPlayerQuoteSubpool();

    if (!deckData) {
        let seed = parseInt(sessionStorage.getItem('player_device_seed') || '12345', 10);
        if (poolInfo.seatId > 0) {
            seed = poolInfo.seatId * 99991;
        }
        const shuffled = seededFisherYatesShuffle(poolInfo.quotes, seed);
        sessionStorage.setItem(deckStorageKey, JSON.stringify(shuffled));
        sessionStorage.setItem(drawnStorageKey, JSON.stringify([]));
        return { deck: shuffled, drawn: [], poolInfo };
    }

    return {
        deck: JSON.parse(deckData),
        drawn: drawnData ? JSON.parse(drawnData) : [],
        poolInfo
    };
}

// 聲音控制
let soundEnabled = true;
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx && typeof AudioContext !== 'undefined') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'draw') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'flip') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(260, now + 0.12);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'alert') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.setValueAtTime(250, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'reset') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch (e) {
        console.warn("Audio error:", e);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('sound-icon');
    if (btn) {
        btn.textContent = soundEnabled ? '🔊' : '🔇';
    }
}

/**
 * 隨機抽取台詞 drawCard()
 */
function drawCard() {
    const { deck, drawn, poolInfo } = getOrInitPlayerDeck();

    if (deck.length === 0) {
        playSound('alert');
        showToast("字卡已全部抽完", "你的專屬區段題庫已全數抽取完畢！\n可點擊「重置我的牌庫」開啟新一輪比賽。", "⚠️");
        return;
    }

    const drawnCard = deck.pop();
    drawn.push(drawnCard);

    sessionStorage.setItem('player_deck_5000', JSON.stringify(deck));
    sessionStorage.setItem('player_drawn_5000', JSON.stringify(drawn));
    sessionStorage.setItem('player_current_card_5000', drawnCard);

    playSound('draw');

    const cardEl = document.getElementById('card-element');
    cardEl.classList.remove('state-empty', 'state-revealed');
    cardEl.classList.add('state-drawn', 'state-drawing');

    setTimeout(() => {
        cardEl.classList.remove('state-drawing');
    }, 400);

    document.getElementById('mask-title-text').textContent = "🔒 台詞已抽到！";
    document.getElementById('mask-hint-text').textContent = "（點擊此框即可查看即興台詞）";
    document.getElementById('lock-icon').textContent = "🔒";

    document.getElementById('quote-text-display').textContent = drawnCard;
    document.getElementById('card-index-badge').textContent = `字卡 #${drawn.length}`;

    updateUIState();
}

/**
 * 卡片點擊遮罩開關 toggleReveal()
 */
function toggleReveal() {
    const cardEl = document.getElementById('card-element');

    if (cardEl.classList.contains('state-empty')) {
        playSound('alert');
        showToast("提示", "請先點擊上方「隨機抽取台詞」按鈕開始抽卡！", "💡");
        return;
    }

    playSound('flip');

    if (cardEl.classList.contains('state-revealed')) {
        cardEl.classList.remove('state-revealed');
    } else {
        cardEl.classList.add('state-revealed');
    }
}

/**
 * 重置牌庫 resetCurrentDeck()
 */
function resetCurrentDeck() {
    sessionStorage.removeItem('player_deck_5000');
    sessionStorage.removeItem('player_drawn_5000');
    sessionStorage.removeItem('player_current_card_5000');

    getOrInitPlayerDeck();

    playSound('reset');
    resetCardUI();
    updateUIState();

    showToast("牌庫已重置", "已成功將您的專屬題庫重新進行 Fisher-Yates 洗牌！", "🔄");
}

function resetAllDecks() {
    sessionStorage.clear();
    getOrInitPlayerDeck();

    playSound('reset');
    resetCardUI();
    updateUIState();

    showToast("全部重置成功", "個人 Session 紀錄與抽卡進度均已清空重置！", "🧹");
}

function resetCardUI() {
    const cardEl = document.getElementById('card-element');
    cardEl.className = 'brawl-card state-empty';

    document.getElementById('mask-title-text').textContent = "點擊「隨機抽取台詞」";
    document.getElementById('mask-hint-text').textContent = "點擊上方按鈕抽取屬於你的即興台詞";
    document.getElementById('lock-icon').textContent = "🔒";
    document.getElementById('quote-text-display').textContent = "點擊此處展開台詞";
}

/**
 * 更新介面狀態與進度顯示
 */
function updateUIState() {
    const { deck, drawn, poolInfo } = getOrInitPlayerDeck();
    const totalCount = deck.length + drawn.length;

    // 演員標籤
    document.getElementById('player-seat-text').textContent = poolInfo.seatName;

    // 剩餘張數
    const remainingEl = document.getElementById('remaining-count');
    remainingEl.textContent = `${deck.length} / ${totalCount}`;

    const drawnStatusTag = document.getElementById('drawn-status-tag');
    if (drawn.length === 0) {
        drawnStatusTag.textContent = "尚未抽卡";
    } else {
        drawnStatusTag.textContent = `已抽 ${drawn.length} 張卡`;
    }

    // 歷史紀錄
    const historyList = document.getElementById('history-list');
    const historyCount = document.getElementById('history-count');
    
    historyCount.textContent = drawn.length;
    historyList.innerHTML = '';

    if (drawn.length === 0) {
        historyList.innerHTML = '<li class="history-item"><span class="history-quote" style="color: var(--text-muted); text-align: center; width: 100%;">尚無抽取紀錄</span></li>';
    } else {
        drawn.forEach((quote, index) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.innerHTML = `
                <span class="history-num">#${index + 1}</span>
                <span class="history-quote">${escapeHtml(quote)}</span>
            `;
            historyList.appendChild(li);
        });
    }
}

// 演員號碼選單 Modal
function openSeatModal() {
    const modal = document.getElementById('seat-modal');
    const currentSeat = getUrlSeatParameter() || parseInt(sessionStorage.getItem('player_seat_id') || '0', 10);
    
    const btns = document.querySelectorAll('.seat-select-btn');
    btns.forEach((btn, idx) => {
        if (idx === currentSeat) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    modal.classList.remove('hidden');
}

function closeSeatModal(event) {
    if (event && event.target !== document.getElementById('seat-modal') && !event.target.classList.contains('modal-close-btn')) {
        return;
    }
    document.getElementById('seat-modal').classList.add('hidden');
}

function selectSeat(seatId) {
    sessionStorage.setItem('player_seat_id', seatId);
    sessionStorage.removeItem('player_deck_5000');
    sessionStorage.removeItem('player_drawn_5000');
    sessionStorage.removeItem('player_current_card_5000');

    closeSeatModal();
    resetCardUI();
    updateUIState();
    playSound('reset');

    showToast("身份切換成功", seatId === 0 ? "已切換至「自動獨立模式」" : `已切換至「演員 ${seatId} 號」，分配獨立不重複卡庫！`, "🎭");
}

function toggleHistory() {
    const container = document.getElementById('history-list-container');
    const header = document.querySelector('.history-header');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        header.classList.add('open');
    } else {
        container.classList.add('hidden');
        header.classList.remove('open');
    }
}

function showToast(title, message, icon = "⚠️") {
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-msg').innerText = message;
    document.getElementById('toast-icon').textContent = icon;

    const modal = document.getElementById('toast-modal');
    modal.classList.remove('hidden');
}

function closeToast(event) {
    if (event && event.target !== document.getElementById('toast-modal') && !event.target.classList.contains('toast-close-btn')) {
        return;
    }
    document.getElementById('toast-modal').classList.add('hidden');
}

// 現場 QR Code 彈窗
function openQrModal() {
    const modal = document.getElementById('qr-modal');
    modal.classList.remove('hidden');
    updateQrCodeForSeat();
}

function updateQrCodeForSeat() {
    const select = document.getElementById('qr-seat-select');
    const seatId = select ? parseInt(select.value, 10) : 0;
    
    const container = document.getElementById('qr-canvas-container');
    const urlText = document.getElementById('qr-url-text');
    
    const baseUrl = window.location.origin + window.location.pathname;
    const targetUrl = seatId > 0 ? `${baseUrl}?p=${seatId}` : baseUrl;

    urlText.textContent = targetUrl;
    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        new QRCode(container, {
            text: targetUrl,
            width: 180,
            height: 180,
            colorDark: "#090d16",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(targetUrl)}" alt="QR Code" style="width: 180px; height: 180px;">`;
    }
}

function closeQrModal(event) {
    if (event && event.target !== document.getElementById('qr-modal') && !event.target.classList.contains('modal-close-btn')) {
        return;
    }
    document.getElementById('qr-modal').classList.add('hidden');
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
    const currentCard = sessionStorage.getItem('player_current_card_5000');
    const { drawn } = getOrInitPlayerDeck();

    const cardEl = document.getElementById('card-element');
    cardEl.classList.remove('state-revealed');

    if (currentCard && drawn.length > 0) {
        cardEl.classList.remove('state-empty');
        cardEl.classList.add('state-drawn');
        
        document.getElementById('mask-title-text').textContent = "🔒 台詞已抽到！";
        document.getElementById('mask-hint-text').textContent = "（點擊此框即可查看即興台詞）";
        document.getElementById('quote-text-display').textContent = currentCard;
        document.getElementById('card-index-badge').textContent = `字卡 #${drawn.length}`;
    } else {
        resetCardUI();
    }

    updateUIState();
});
