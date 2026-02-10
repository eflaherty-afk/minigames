/**
 * 掼蛋 - 经典四人扑克对战
 * 规则：两副牌，4人2v2，从2打到A
 */
(function () {
    'use strict';

    // ========== 常量 ==========
    const SUITS = ['spade', 'heart', 'diamond', 'club'];
    const SUIT_SYMBOL = { spade: '', heart: '', diamond: '', club: '' };
    const SUIT_COLOR = { spade: 'black', heart: 'red', diamond: 'red', club: 'black' };
    const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const RANK_VALUE = {};
    RANKS.forEach((r, i) => RANK_VALUE[r] = i + 2); // 2=2, 3=3, ..., A=14
    RANK_VALUE['JOKER_S'] = 16; // 小王
    RANK_VALUE['JOKER_B'] = 17; // 大王

    // 牌型常量
    const PLAY_TYPE = {
        SINGLE: 'single',           // 单张
        PAIR: 'pair',               // 对子
        TRIPLE: 'triple',           // 三同张
        TRIPLE_PAIR: 'triple_pair', // 三带二
        STRAIGHT: 'straight',       // 顺子(5+)
        DOUBLE_STRAIGHT: 'double_straight', // 连对(3+对)
        TRIPLE_STRAIGHT: 'triple_straight', // 钢板(2+三同)
        BOMB_4: 'bomb_4',           // 4炸
        BOMB_5: 'bomb_5',           // 5炸
        BOMB_6: 'bomb_6',           // 6炸
        BOMB_7: 'bomb_7',           // 7炸
        BOMB_8: 'bomb_8',           // 8炸
        STRAIGHT_FLUSH: 'straight_flush', // 同花顺(5+)
        ROCKET: 'rocket',           // 天王炸(双王)
    };

    // 炸弹等级排序
    const BOMB_RANK = {
        [PLAY_TYPE.BOMB_4]: 1,
        [PLAY_TYPE.BOMB_5]: 2,
        [PLAY_TYPE.BOMB_6]: 3,
        [PLAY_TYPE.STRAIGHT_FLUSH]: 4,
        [PLAY_TYPE.BOMB_7]: 5,
        [PLAY_TYPE.BOMB_8]: 6,
        [PLAY_TYPE.ROCKET]: 7,
    };

    const STORAGE_KEY = 'minigame_lobby_user';

    // ========== 用户数据 ==========
    function loadUserData() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (data && data.name && typeof data.coins === 'number') return data;
        } catch (e) {}
        return { name: '玩家', coins: 100 };
    }
    function saveUserData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    function addCoins(amount) {
        const data = loadUserData();
        data.coins += amount;
        if (data.coins < 0) data.coins = 0;
        saveUserData(data);
        return data.coins;
    }
    function getCoins() { return loadUserData().coins; }
    function getUserName() { return loadUserData().name; }

    // ========== 工具函数 ==========
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const $ = (id) => document.getElementById(id);

    // ========== 牌相关函数 ==========
    function createDeck() {
        const cards = [];
        // 两副牌
        for (let copy = 0; copy < 2; copy++) {
            for (const suit of SUITS) {
                for (const rank of RANKS) {
                    cards.push({ suit, rank, value: RANK_VALUE[rank], id: `${suit}_${rank}_${copy}` });
                }
            }
            cards.push({ suit: 'joker', rank: 'JOKER_S', value: RANK_VALUE['JOKER_S'], id: `joker_s_${copy}` });
            cards.push({ suit: 'joker', rank: 'JOKER_B', value: RANK_VALUE['JOKER_B'], id: `joker_b_${copy}` });
        }
        return cards; // 108张
    }

    function getCardDisplay(card) {
        if (card.rank === 'JOKER_S') return { text: '', suit: '小', cls: 'suit-joker-black' };
        if (card.rank === 'JOKER_B') return { text: '', suit: '大', cls: 'suit-joker-red' };
        return {
            text: card.rank,
            suit: SUIT_SYMBOL[card.suit],
            cls: `suit-${card.suit}`
        };
    }

    function isWild(card, currentLevel) {
        // 逢人配：当前等级的红心牌
        return card.suit === 'heart' && card.rank === currentLevel;
    }

    function cardSortValue(card, currentLevel) {
        let v = card.value * 10;
        // 王最大
        if (card.rank === 'JOKER_B') return 9999;
        if (card.rank === 'JOKER_S') return 9998;
        // 逢人配次之
        if (isWild(card, currentLevel)) return 9990;
        // 花色排序: 黑桃>红心>方块>梅花
        const suitOrder = { spade: 4, heart: 3, diamond: 2, club: 1 };
        v += (suitOrder[card.suit] || 0);
        return v;
    }

    function sortCards(cards, currentLevel) {
        return [...cards].sort((a, b) => cardSortValue(b, currentLevel) - cardSortValue(a, currentLevel));
    }

    // ========== 牌型识别 ==========
    function identifyPlay(cards, currentLevel) {
        if (!cards || cards.length === 0) return null;
        const n = cards.length;

        // 计算有效牌值（逢人配替换后的最优牌型）
        const wildCards = cards.filter(c => isWild(c, currentLevel));
        const normalCards = cards.filter(c => !isWild(c, currentLevel));
        const wildCount = wildCards.length;

        // 天王炸：4张王
        if (n === 4 && cards.every(c => c.rank === 'JOKER_S' || c.rank === 'JOKER_B')) {
            return { type: PLAY_TYPE.ROCKET, mainValue: 9999, length: 4 };
        }
        // 天王炸：2张大王+2张小王或含万能牌
        if (n === 2) {
            const jokers = cards.filter(c => c.rank === 'JOKER_S' || c.rank === 'JOKER_B');
            if (jokers.length + wildCount >= 2 && jokers.length >= 2 - wildCount) {
                if (cards.every(c => c.rank === 'JOKER_S' || c.rank === 'JOKER_B')) {
                    return { type: PLAY_TYPE.ROCKET, mainValue: 9999, length: 2 };
                }
            }
        }

        // 不含万能牌的简单情况
        const valueCounts = {};
        normalCards.forEach(c => {
            valueCounts[c.value] = (valueCounts[c.value] || 0) + 1;
        });
        const values = Object.keys(valueCounts).map(Number).sort((a, b) => a - b);

        // 炸弹(4-8同)
        if (n >= 4 && n <= 8) {
            // 检查是否所有牌点数相同(含万能牌)
            if (values.length <= 1 || (values.length === 0 && wildCount === n)) {
                const mainVal = values.length > 0 ? values[0] : 0;
                const sameCount = (valueCounts[mainVal] || 0) + wildCount;
                if (sameCount === n && n >= 4) {
                    const bombType = {
                        4: PLAY_TYPE.BOMB_4,
                        5: PLAY_TYPE.BOMB_5,
                        6: PLAY_TYPE.BOMB_6,
                        7: PLAY_TYPE.BOMB_7,
                        8: PLAY_TYPE.BOMB_8,
                    }[n];
                    if (bombType) return { type: bombType, mainValue: mainVal, length: n };
                }
            }
            // 多种点数但加上万能牌后某种点数达到n张
            if (wildCount > 0) {
                for (const v of values) {
                    if (valueCounts[v] + wildCount >= n && values.length === 1) {
                        const bombType = { 4: PLAY_TYPE.BOMB_4, 5: PLAY_TYPE.BOMB_5, 6: PLAY_TYPE.BOMB_6, 7: PLAY_TYPE.BOMB_7, 8: PLAY_TYPE.BOMB_8 }[n];
                        if (bombType) return { type: bombType, mainValue: v, length: n };
                    }
                }
            }
        }

        // 同花顺(5张及以上同花色连续)
        if (n >= 5) {
            const nonJokerNonWild = normalCards.filter(c => c.rank !== 'JOKER_S' && c.rank !== 'JOKER_B');
            if (nonJokerNonWild.length > 0) {
                const suits = [...new Set(nonJokerNonWild.map(c => c.suit))];
                if (suits.length === 1) {
                    const vals = nonJokerNonWild.map(c => c.value).sort((a, b) => a - b);
                    const minV = vals[0];
                    const maxV = vals[vals.length - 1];
                    const range = maxV - minV + 1;
                    if (range === n && new Set(vals).size === vals.length && maxV <= 14 && wildCount + nonJokerNonWild.length === n) {
                        return { type: PLAY_TYPE.STRAIGHT_FLUSH, mainValue: maxV, length: n, suit: suits[0] };
                    }
                    // 含万能牌补齐
                    if (range <= n && new Set(vals).size === vals.length && wildCount >= n - nonJokerNonWild.length && maxV <= 14) {
                        return { type: PLAY_TYPE.STRAIGHT_FLUSH, mainValue: maxV, length: n, suit: suits[0] };
                    }
                }
            }
        }

        // 以下不考虑万能牌做复杂替换，简化处理
        // 单张
        if (n === 1) return { type: PLAY_TYPE.SINGLE, mainValue: cards[0].value, length: 1 };

        // 对子
        if (n === 2) {
            if (normalCards.length + wildCount === 2) {
                const v = normalCards.length > 0 ? normalCards[0].value : 0;
                if (normalCards.every(c => c.value === v) || wildCount > 0) {
                    return { type: PLAY_TYPE.PAIR, mainValue: v, length: 2 };
                }
            }
        }

        // 三同张
        if (n === 3) {
            const v = normalCards.length > 0 ? normalCards[0].value : 0;
            const same = normalCards.filter(c => c.value === v).length;
            if (same + wildCount >= 3) {
                return { type: PLAY_TYPE.TRIPLE, mainValue: v, length: 3 };
            }
        }

        // 三带二
        if (n === 5) {
            // 找三张相同的
            for (const v of values) {
                if (valueCounts[v] >= 3 || (valueCounts[v] >= 2 && wildCount >= 1) || (valueCounts[v] >= 1 && wildCount >= 2)) {
                    const tripleUsedWild = Math.max(0, 3 - valueCounts[v]);
                    const remainWild = wildCount - tripleUsedWild;
                    const remainNormal = normalCards.filter(c => c.value !== v);
                    const remainTotal = remainNormal.length + remainWild;
                    if (remainTotal === 2) {
                        // 剩余2张必须组成对子
                        if (remainNormal.length === 2 && remainNormal[0].value === remainNormal[1].value) {
                            return { type: PLAY_TYPE.TRIPLE_PAIR, mainValue: v, length: 5 };
                        }
                        if (remainWild > 0 && remainNormal.length <= 2) {
                            return { type: PLAY_TYPE.TRIPLE_PAIR, mainValue: v, length: 5 };
                        }
                    }
                }
            }
        }

        // 顺子(5+连续不同)
        if (n >= 5 && wildCount === 0) {
            const vals = cards.map(c => c.value).sort((a, b) => a - b);
            if (new Set(vals).size === n) {
                const isConsec = vals[n - 1] - vals[0] === n - 1;
                if (isConsec && vals[n - 1] <= 14) { // A以内
                    return { type: PLAY_TYPE.STRAIGHT, mainValue: vals[n - 1], length: n };
                }
            }
        }

        // 连对(3+对连续)
        if (n >= 6 && n % 2 === 0 && wildCount === 0) {
            const pairValues = values.filter(v => valueCounts[v] >= 2).sort((a, b) => a - b);
            const pairsNeeded = n / 2;
            if (pairValues.length >= pairsNeeded) {
                // 检查连续
                for (let i = 0; i <= pairValues.length - pairsNeeded; i++) {
                    const subset = pairValues.slice(i, i + pairsNeeded);
                    if (subset[subset.length - 1] - subset[0] === pairsNeeded - 1) {
                        return { type: PLAY_TYPE.DOUBLE_STRAIGHT, mainValue: subset[subset.length - 1], length: n };
                    }
                }
            }
        }

        // 钢板(2+三同连续)
        if (n >= 6 && n % 3 === 0 && wildCount === 0) {
            const tripleValues = values.filter(v => valueCounts[v] >= 3).sort((a, b) => a - b);
            const triplesNeeded = n / 3;
            if (tripleValues.length >= triplesNeeded) {
                for (let i = 0; i <= tripleValues.length - triplesNeeded; i++) {
                    const subset = tripleValues.slice(i, i + triplesNeeded);
                    if (subset[subset.length - 1] - subset[0] === triplesNeeded - 1) {
                        return { type: PLAY_TYPE.TRIPLE_STRAIGHT, mainValue: subset[subset.length - 1], length: n };
                    }
                }
            }
        }

        return null; // 无效牌型
    }

    // 比较出牌大小: 返回true表示play2能打过play1
    function canBeat(play1, play2) {
        if (!play1 || !play2) return false;
        // 天王炸最大
        if (play2.type === PLAY_TYPE.ROCKET) return true;
        if (play1.type === PLAY_TYPE.ROCKET) return false;

        // 炸弹比较
        const isBomb1 = BOMB_RANK[play1.type] !== undefined;
        const isBomb2 = BOMB_RANK[play2.type] !== undefined;

        if (isBomb2 && !isBomb1) return true; // 炸弹打非炸弹
        if (isBomb1 && isBomb2) {
            if (BOMB_RANK[play2.type] > BOMB_RANK[play1.type]) return true;
            if (BOMB_RANK[play2.type] < BOMB_RANK[play1.type]) return false;
            return play2.mainValue > play1.mainValue;
        }
        if (isBomb1 && !isBomb2) return false;

        // 同类型同长度比较
        if (play1.type === play2.type && play1.length === play2.length) {
            return play2.mainValue > play1.mainValue;
        }

        return false;
    }


    // ========== 技能卡系统 ==========
    const SKILL_CARDS = [
        {
            id: 'xray',
            name: ' 透视',
            desc: '查看左右两家各2张手牌',
            hint: '发动后可以短暂看到对手的部分手牌',
            timing: 'active',
        },
        {
            id: 'shuffle_hand',
            name: ' 洗牌',
            desc: '随机交换自己2张牌与牌堆中的牌',
            hint: '可能换到更好的牌，也可能更差',
            timing: 'active',
        },
        {
            id: 'double_score',
            name: ' 双倍',
            desc: '如果本局获胜，奖励翻倍',
            hint: '高风险高回报，输了不额外扣',
            timing: 'passive',
        },
        {
            id: 'hint_plus',
            name: ' 智囊',
            desc: '提示功能升级，可看到最优出牌建议',
            hint: '每次提示会给出更详细的出牌策略分析',
            timing: 'passive',
        },
        {
            id: 'bomb_boost',
            name: ' 引爆',
            desc: '开局随机将你的一组3张同点牌变为4炸',
            hint: '如果手中有3张相同的牌，随机一组变成炸弹',
            timing: 'start',
        },
    ];

    function generateSkillOptions(count) {
        return shuffle([...SKILL_CARDS]).slice(0, count);
    }

    // ========== AI 出牌策略 ==========
    function findAllPlays(hand, currentLevel) {
        const plays = [];
        const n = hand.length;
        if (n === 0) return plays;

        // 统计
        const valueCounts = {};
        hand.forEach(c => {
            const v = c.value;
            if (!valueCounts[v]) valueCounts[v] = [];
            valueCounts[v].push(c);
        });
        const valueKeys = Object.keys(valueCounts).map(Number).sort((a, b) => a - b);

        // 单张
        const seen = new Set();
        hand.forEach(c => {
            if (!seen.has(c.value)) {
                seen.add(c.value);
                plays.push({ cards: [c], play: { type: PLAY_TYPE.SINGLE, mainValue: c.value, length: 1 } });
            }
        });

        // 对子
        valueKeys.forEach(v => {
            if (valueCounts[v].length >= 2) {
                plays.push({ cards: valueCounts[v].slice(0, 2), play: { type: PLAY_TYPE.PAIR, mainValue: v, length: 2 } });
            }
        });

        // 三同
        valueKeys.forEach(v => {
            if (valueCounts[v].length >= 3) {
                plays.push({ cards: valueCounts[v].slice(0, 3), play: { type: PLAY_TYPE.TRIPLE, mainValue: v, length: 3 } });
            }
        });

        // 三带二
        valueKeys.forEach(v => {
            if (valueCounts[v].length >= 3) {
                const triCards = valueCounts[v].slice(0, 3);
                // 找对子做副牌
                valueKeys.forEach(v2 => {
                    if (v2 !== v && valueCounts[v2].length >= 2) {
                        plays.push({
                            cards: [...triCards, ...valueCounts[v2].slice(0, 2)],
                            play: { type: PLAY_TYPE.TRIPLE_PAIR, mainValue: v, length: 5 }
                        });
                    }
                });
            }
        });

        // 顺子(5+)
        for (let len = 5; len <= Math.min(12, valueKeys.length); len++) {
            for (let i = 0; i <= valueKeys.length - len; i++) {
                const subset = valueKeys.slice(i, i + len);
                if (subset[len - 1] - subset[0] === len - 1 && subset[len - 1] <= 14) {
                    const cards = subset.map(v => valueCounts[v][0]);
                    plays.push({ cards, play: { type: PLAY_TYPE.STRAIGHT, mainValue: subset[len - 1], length: len } });
                }
            }
        }

        // 连对(3+对)
        const pairValues = valueKeys.filter(v => valueCounts[v].length >= 2);
        for (let len = 3; len <= pairValues.length; len++) {
            for (let i = 0; i <= pairValues.length - len; i++) {
                const subset = pairValues.slice(i, i + len);
                if (subset[len - 1] - subset[0] === len - 1 && subset[len - 1] <= 14) {
                    const cards = [];
                    subset.forEach(v => cards.push(...valueCounts[v].slice(0, 2)));
                    plays.push({ cards, play: { type: PLAY_TYPE.DOUBLE_STRAIGHT, mainValue: subset[len - 1], length: len * 2 } });
                }
            }
        }

        // 炸弹(4-8)
        valueKeys.forEach(v => {
            const cnt = valueCounts[v].length;
            if (cnt >= 4) {
                for (let bLen = 4; bLen <= cnt; bLen++) {
                    const bombType = { 4: PLAY_TYPE.BOMB_4, 5: PLAY_TYPE.BOMB_5, 6: PLAY_TYPE.BOMB_6, 7: PLAY_TYPE.BOMB_7, 8: PLAY_TYPE.BOMB_8 }[bLen];
                    if (bombType) {
                        plays.push({ cards: valueCounts[v].slice(0, bLen), play: { type: bombType, mainValue: v, length: bLen } });
                    }
                }
            }
        });

        // 天王炸
        const jokers = hand.filter(c => c.rank === 'JOKER_S' || c.rank === 'JOKER_B');
        if (jokers.length >= 2) {
            plays.push({ cards: jokers.slice(0, 2), play: { type: PLAY_TYPE.ROCKET, mainValue: 9999, length: 2 } });
        }

        return plays;
    }

    function findValidPlays(hand, lastPlay, currentLevel) {
        if (!lastPlay) {
            // 自由出牌
            return findAllPlays(hand, currentLevel);
        }
        // 要打过上家
        const allPlays = findAllPlays(hand, currentLevel);
        return allPlays.filter(p => canBeat(lastPlay, p.play));
    }

    function aiChoosePlay(hand, lastPlay, currentLevel, isTeammateLeading) {
        const validPlays = findValidPlays(hand, lastPlay, currentLevel);
        if (validPlays.length === 0) return null; // pass

        if (!lastPlay) {
            // 自由出牌：优先出小牌
            const nonBombs = validPlays.filter(p => !BOMB_RANK[p.play.type]);
            const candidates = nonBombs.length > 0 ? nonBombs : validPlays;
            // 按mainValue排序，出最小的
            candidates.sort((a, b) => a.play.mainValue - b.play.mainValue);
            // 优先出单张、对子等小组合
            const singles = candidates.filter(p => p.play.type === PLAY_TYPE.SINGLE);
            if (singles.length > 0) return singles[0];
            const pairs = candidates.filter(p => p.play.type === PLAY_TYPE.PAIR);
            if (pairs.length > 0) return pairs[0];
            return candidates[0];
        }

        // 队友出的牌：50%概率不压
        if (isTeammateLeading && Math.random() < 0.5) {
            return null;
        }

        // 非炸弹优先
        const nonBombs = validPlays.filter(p => !BOMB_RANK[p.play.type]);
        if (nonBombs.length > 0) {
            nonBombs.sort((a, b) => a.play.mainValue - b.play.mainValue);
            return nonBombs[0]; // 最小能打的
        }

        // 只剩炸弹：手牌少于6张或对手手牌少于3张才出炸
        if (hand.length <= 6 || Math.random() < 0.3) {
            validPlays.sort((a, b) => a.play.mainValue - b.play.mainValue);
            return validPlays[0];
        }

        return null; // 不出
    }

    // ========== 游戏状态 ==========
    let state = {
        betAmount: 20,
        skill: null,
        skillUsed: false,
        doubleActive: false,     // 双倍技能
        hintPlus: false,         // 智囊技能

        currentLevel: '2',      // 当前打的等级
        ourLevel: '2',          // 我方等级
        theirLevel: '2',        // 对方等级
        levelIndex: 0,          // 等级索引

        players: [              // 0=我, 1=右(敌A), 2=上(队友B/敌B), 3=左(队友)
            { name: '', hand: [], isHuman: true, team: 'us', seat: 'bottom', finished: false, finishOrder: 0 },
            { name: '对手A', hand: [], isHuman: false, team: 'them', seat: 'right', finished: false, finishOrder: 0 },
            { name: '对手B', hand: [], isHuman: false, team: 'them', seat: 'top', finished: false, finishOrder: 0 },
            { name: '队友', hand: [], isHuman: false, team: 'us', seat: 'left', finished: false, finishOrder: 0 },
        ],
        currentPlayer: 0,       // 当前出牌玩家索引
        lastPlay: null,          // 上一手牌 {play, playerIdx}
        lastPlayCards: null,     // 上一手牌的牌面
        lastPlayerIdx: -1,       // 上一个出牌的玩家
        consecutivePasses: 0,    // 连续pass次数
        finishOrder: [],         // 出完牌的顺序
        isPlaying: false,
        gameStarted: false,

        selectedCards: new Set(), // 玩家选中的牌id
    };

    // 座位到DOM id的映射
    const SEAT_MAP = {
        bottom: { played: 'playedBottom', count: null, name: null, seat: 'seatBottom' },
        right: { played: 'playedRight', count: 'countRight', name: 'nameRight', seat: 'seatRight' },
        top: { played: 'playedTop', count: 'countTop', name: 'nameTop', seat: 'seatTop' },
        left: { played: 'playedLeft', count: 'countLeft', name: 'nameLeft', seat: 'seatLeft' },
    };


    // ========== 界面切换 ==========
    function switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        $(screenId).classList.add('active');
    }

    // ========== 开始界面 ==========
    $('btnStart').addEventListener('click', () => showBetScreen());

    // 显示用户信息
    (function updateStartInfo() {
        const data = loadUserData();
        const startContent = document.querySelector('.start-content');
        if (startContent && !document.querySelector('.start-user-info')) {
            const info = document.createElement('div');
            info.className = 'start-user-info';
            info.innerHTML = '<div style="margin-top:24px; padding:12px 24px; background:rgba(255,255,255,0.05); border-radius:12px; display:inline-flex; align-items:center; gap:16px;">' +
                '<span style="font-size:20px;"></span>' +
                '<span style="font-weight:600;">' + data.name + '</span>' +
                '<span style="color:var(--gold); font-weight:800;"> ' + data.coins + ' 小爱豆</span></div>';
            startContent.appendChild(info);
        }
    })();

    // ========== 下注界面 ==========
    function showBetScreen() {
        switchScreen('betScreen');
        const coins = getCoins();
        $('betCoinAmount').textContent = coins;
        let defaultBet = 20;
        if (coins < 20) defaultBet = 10;
        if (coins < 10) defaultBet = 0;
        state.betAmount = defaultBet;
        updateBetUI();
    }

    function updateBetUI() {
        const coins = getCoins();
        const bet = state.betAmount;
        document.querySelectorAll('.bet-option').forEach(el => {
            const v = parseInt(el.dataset.bet);
            el.classList.toggle('selected', v === bet);
            el.classList.toggle('disabled', v > coins);
        });
        $('betSelectedAmount').textContent = bet;

        // 根据排名计算收益
        const rewards = calcRewards(bet);
        $('betReward1st').textContent = '+' + rewards[0];
        $('betReward2nd').textContent = '+' + rewards[1];
        $('betReward3rd').textContent = rewards[2] >= 0 ? '+' + rewards[2] : '' + rewards[2];
        $('betReward4th').textContent = '' + rewards[3];

        const insuffMsg = $('betInsufficientMsg');
        if (bet > coins || coins <= 0) {
            insuffMsg.style.display = 'block';
            $('btnConfirmBet').style.opacity = '0.5';
            $('btnConfirmBet').style.pointerEvents = 'none';
        } else {
            insuffMsg.style.display = 'none';
            $('btnConfirmBet').style.opacity = '1';
            $('btnConfirmBet').style.pointerEvents = 'auto';
        }
    }

    function calcRewards(bet) {
        // 头游: +2x, 二游: +1x, 三游: -0.5x, 末游: -1x
        return [bet * 2, bet, Math.round(-bet * 0.5), -bet];
    }

    window._selectBet = function(amount) {
        if (amount > getCoins()) return;
        state.betAmount = amount;
        updateBetUI();
    };

    $('btnConfirmBet').addEventListener('click', function() {
        if (state.betAmount > getCoins()) return;
        if (state.betAmount >= 20) {
            showSkillSelection();
        } else {
            state.skill = null;
            state.skillUsed = false;
            startNewGame();
        }
    });

    // ========== 技能选择 ==========
    function showSkillSelection() {
        switchScreen('skillScreen');
        const options = generateSkillOptions(3);
        const container = $('skillOptions');
        container.innerHTML = options.map((sk, i) => {
            return '<div class="skill-option" data-skill-index="' + i + '">' +
                '<div class="skill-icon">' + sk.name.split(' ')[0] + '</div>' +
                '<div class="skill-name">' + (sk.name.split(' ')[1] || sk.name) + '</div>' +
                '<div class="skill-desc">' + sk.desc + '</div>' +
                '<div class="skill-hint">' + sk.hint + '</div>' +
                '<button class="skill-select-btn" data-skill-index="' + i + '">选择</button></div>';
        }).join('');

        container.querySelectorAll('.skill-option').forEach(el => {
            el.addEventListener('click', function() {
                container.querySelectorAll('.skill-option').forEach(e => e.classList.remove('selected'));
                this.classList.add('selected');
            });
        });

        container.querySelectorAll('.skill-select-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.skillIndex);
                state.skill = options[idx];
                state.skillUsed = false;
                state.doubleActive = state.skill.id === 'double_score';
                state.hintPlus = state.skill.id === 'hint_plus';
                startNewGame();
            });
        });
    }

    // ========== 开始新游戏 ==========
    function startNewGame() {
        switchScreen('gameScreen');

        // 重置状态
        state.currentLevel = '2';
        state.ourLevel = '2';
        state.theirLevel = '2';
        state.levelIndex = 0;
        state.finishOrder = [];
        state.isPlaying = false;
        state.gameStarted = true;

        // 设置玩家名
        state.players[0].name = getUserName();
        state.players[3].name = randomPick(['小花', '阿杰', '大壮', '小美', '老王']);
        state.players[1].name = randomPick(['铁柱', '黑哥', '石头', '阿彪']);
        state.players[2].name = randomPick(['狐狸', '老鹰', '毒蛇', '猛虎']);

        // 更新显示
        if (SEAT_MAP.right.name) $(SEAT_MAP.right.name).textContent = state.players[1].name;
        if (SEAT_MAP.top.name) $(SEAT_MAP.top.name).textContent = state.players[2].name;
        if (SEAT_MAP.left.name) $(SEAT_MAP.left.name).textContent = state.players[3].name;

        $('ourLevel').textContent = state.ourLevel;
        $('theirLevel').textContent = state.theirLevel;
        $('currentLevel').textContent = state.currentLevel;
        $('gameCoinAmount').textContent = getCoins();

        dealCards();
    }

    // ========== 发牌 ==========
    function dealCards() {
        const deck = shuffle(createDeck()); // 108张
        // 每人27张
        state.players[0].hand = sortCards(deck.slice(0, 27), state.currentLevel);
        state.players[1].hand = sortCards(deck.slice(27, 54), state.currentLevel);
        state.players[2].hand = sortCards(deck.slice(54, 81), state.currentLevel);
        state.players[3].hand = sortCards(deck.slice(81, 108), state.currentLevel);

        // 重置完成状态
        state.players.forEach(p => { p.finished = false; p.finishOrder = 0; });
        state.finishOrder = [];
        state.lastPlay = null;
        state.lastPlayCards = null;
        state.lastPlayerIdx = -1;
        state.consecutivePasses = 0;
        state.selectedCards = new Set();

        // 技能：引爆 - 开局将3张同点变为4炸
        if (state.skill && state.skill.id === 'bomb_boost' && !state.skillUsed) {
            applyBombBoost();
            state.skillUsed = true;
        }

        // 随机确定先手(持有红心当前等级牌的玩家)
        let firstPlayer = 0;
        for (let i = 0; i < 4; i++) {
            if (state.players[i].hand.some(c => c.suit === 'heart' && c.rank === state.currentLevel)) {
                firstPlayer = i;
                break;
            }
        }
        state.currentPlayer = firstPlayer;

        renderAll();
        showMessage(state.players[firstPlayer].name + ' 先出牌');

        setTimeout(() => {
            hideMessage();
            if (state.currentPlayer !== 0) {
                aiTurn();
            } else {
                enablePlayerActions();
            }
        }, 1500);
    }

    function applyBombBoost() {
        // 找玩家手中有3张同点的牌
        const hand = state.players[0].hand;
        const valueCounts = {};
        hand.forEach(c => {
            if (!valueCounts[c.value]) valueCounts[c.value] = [];
            valueCounts[c.value].push(c);
        });
        const candidates = Object.entries(valueCounts).filter(([v, cards]) => cards.length === 3);
        if (candidates.length === 0) return;
        const [value, cards] = randomPick(candidates);
        // 从牌堆外"变"一张同点牌
        const suit = randomPick(SUITS);
        const newCard = { suit, rank: cards[0].rank, value: cards[0].value, id: `boost_${suit}_${cards[0].rank}` };
        hand.push(newCard);
        state.players[0].hand = sortCards(hand, state.currentLevel);
        showSkillEffect(' 引爆！你的 ' + cards[0].rank + ' 变成了4炸！');
    }


    // ========== 渲染函数 ==========
    function renderAll() {
        renderMyHand();
        renderOtherPlayers();
        updateActivePlayer();
        renderSkillBtn();
    }

    function renderMyHand() {
        const container = $('myCards');
        const hand = state.players[0].hand;
        container.innerHTML = hand.map(card => {
            const display = getCardDisplay(card);
            const wild = isWild(card, state.currentLevel) ? 'is-wild' : '';
            const selected = state.selectedCards.has(card.id) ? 'selected' : '';
            return '<div class="poker-card ' + display.cls + ' ' + wild + ' ' + selected + '" data-id="' + card.id + '" onclick="window._toggleCard(\'' + card.id + '\')">' +
                '<div class="card-rank">' + display.text + '</div>' +
                '<div class="card-suit">' + display.suit + '</div></div>';
        }).join('');
    }

    function renderOtherPlayers() {
        for (let i = 1; i <= 3; i++) {
            const p = state.players[i];
            const seatInfo = SEAT_MAP[p.seat];
            if (seatInfo.count) $(seatInfo.count).textContent = p.hand.length;
        }
    }

    function updateActivePlayer() {
        // 清除所有高亮
        document.querySelectorAll('.player-seat').forEach(el => el.classList.remove('seat-active'));
        // 高亮当前玩家
        const currentSeat = state.players[state.currentPlayer].seat;
        const seatEl = $(SEAT_MAP[currentSeat].seat);
        if (seatEl) seatEl.classList.add('seat-active');
    }

    function renderPlayedCards(playerIdx, cards) {
        const seat = state.players[playerIdx].seat;
        const containerId = SEAT_MAP[seat].played;
        const container = $(containerId);
        if (!cards || cards.length === 0) {
            container.innerHTML = '<div class="pass-text">不出</div>';
            return;
        }
        const sorted = sortCards(cards, state.currentLevel);
        if (playerIdx === 0) {
            // 玩家自己的出牌用正常大小
            container.innerHTML = sorted.map(card => {
                const display = getCardDisplay(card);
                return '<div class="mini-card ' + display.cls + '">' +
                    '<div>' + display.text + '</div>' +
                    '<div>' + display.suit + '</div></div>';
            }).join('');
        } else {
            container.innerHTML = sorted.map(card => {
                const display = getCardDisplay(card);
                return '<div class="mini-card ' + display.cls + '">' +
                    '<div>' + display.text + '</div>' +
                    '<div>' + display.suit + '</div></div>';
            }).join('');
        }
    }

    function clearAllPlayed() {
        ['playedTop', 'playedRight', 'playedLeft', 'playedBottom'].forEach(id => {
            $(id).innerHTML = '';
        });
    }

    function showMessage(text) {
        const el = $('gameMessage');
        el.textContent = text;
        el.classList.add('show');
    }

    function hideMessage() {
        $('gameMessage').classList.remove('show');
    }

    function showSkillEffect(text) {
        const toast = document.createElement('div');
        toast.className = 'skill-toast';
        toast.textContent = text;
        $('gameScreen').appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 400);
        }, 2000);
    }

    function renderSkillBtn() {
        const area = $('skillBtnArea');
        area.innerHTML = '';
        if (!state.skill || state.skill.timing === 'passive' || state.skill.timing === 'start') return;
        if (state.skillUsed) {
            area.innerHTML = '<div class="skill-btn used" title="已使用"><span class="skill-btn-icon">' + state.skill.name.split(' ')[0] + '</span><span class="skill-btn-label">已用</span></div>';
        } else {
            area.innerHTML = '<div class="skill-btn available" onclick="window._useSkill()" title="' + state.skill.desc + '"><span class="skill-btn-icon">' + state.skill.name.split(' ')[0] + '</span><span class="skill-btn-label">' + (state.skill.name.split(' ')[1] || '技能') + '</span></div>';
        }
    }

    // ========== 玩家操作 ==========
    window._toggleCard = function(cardId) {
        if (state.isPlaying || state.currentPlayer !== 0) return;
        if (state.selectedCards.has(cardId)) {
            state.selectedCards.delete(cardId);
        } else {
            state.selectedCards.add(cardId);
        }
        renderMyHand();
        updateActionButtons();
    };

    function enablePlayerActions() {
        state.isPlaying = false;
        state.selectedCards = new Set();
        renderMyHand();
        updateActionButtons();
        updateActivePlayer();
    }

    function updateActionButtons() {
        const hasLast = state.lastPlay && state.lastPlayerIdx !== 0;
        $('btnPass').disabled = !hasLast; // 自由出牌不能pass
        const selectedArr = getSelectedCards();
        if (selectedArr.length === 0) {
            $('btnPlay').disabled = true;
            return;
        }
        const play = identifyPlay(selectedArr, state.currentLevel);
        if (!play) {
            $('btnPlay').disabled = true;
            return;
        }
        if (hasLast && !canBeat(state.lastPlay, play)) {
            $('btnPlay').disabled = true;
            return;
        }
        $('btnPlay').disabled = false;
    }

    function getSelectedCards() {
        const hand = state.players[0].hand;
        return hand.filter(c => state.selectedCards.has(c.id));
    }

    window._play = function() {
        if (state.isPlaying || state.currentPlayer !== 0) return;
        const selectedArr = getSelectedCards();
        if (selectedArr.length === 0) return;
        const play = identifyPlay(selectedArr, state.currentLevel);
        if (!play) return;
        if (state.lastPlay && state.lastPlayerIdx !== 0 && !canBeat(state.lastPlay, play)) return;
        executePlay(0, selectedArr, play);
    };

    window._pass = function() {
        if (state.isPlaying || state.currentPlayer !== 0) return;
        if (!state.lastPlay || state.lastPlayerIdx === 0) return;
        executePass(0);
    };

    window._hint = function() {
        if (state.isPlaying || state.currentPlayer !== 0) return;
        const hand = state.players[0].hand;
        const lastPlay = (state.lastPlay && state.lastPlayerIdx !== 0) ? state.lastPlay : null;
        const validPlays = findValidPlays(hand, lastPlay, state.currentLevel);
        if (validPlays.length === 0) {
            showMessage('没有能出的牌，请选择不出');
            setTimeout(hideMessage, 1500);
            return;
        }
        // 选择推荐的一手牌
        let recommended;
        if (state.hintPlus) {
            // 智囊技能：更智能的推荐
            const nonBombs = validPlays.filter(p => !BOMB_RANK[p.play.type]);
            recommended = nonBombs.length > 0 ? nonBombs[0] : validPlays[0];
            showSkillEffect(' 智囊建议：出 ' + getPlayTypeName(recommended.play.type));
        } else {
            recommended = validPlays[0];
        }
        // 自动选中推荐的牌
        state.selectedCards = new Set(recommended.cards.map(c => c.id));
        renderMyHand();
        updateActionButtons();
    };

    function getPlayTypeName(type) {
        const names = {
            [PLAY_TYPE.SINGLE]: '单张',
            [PLAY_TYPE.PAIR]: '对子',
            [PLAY_TYPE.TRIPLE]: '三同张',
            [PLAY_TYPE.TRIPLE_PAIR]: '三带二',
            [PLAY_TYPE.STRAIGHT]: '顺子',
            [PLAY_TYPE.DOUBLE_STRAIGHT]: '连对',
            [PLAY_TYPE.TRIPLE_STRAIGHT]: '钢板',
            [PLAY_TYPE.BOMB_4]: '炸弹',
            [PLAY_TYPE.BOMB_5]: '5炸',
            [PLAY_TYPE.BOMB_6]: '6炸',
            [PLAY_TYPE.BOMB_7]: '7炸',
            [PLAY_TYPE.BOMB_8]: '8炸',
            [PLAY_TYPE.STRAIGHT_FLUSH]: '同花顺',
            [PLAY_TYPE.ROCKET]: '天王炸',
        };
        return names[type] || type;
    }

    // ========== 技能使用 ==========
    window._useSkill = function() {
        if (state.isPlaying || state.skillUsed || !state.skill) return;
        if (state.skill.timing !== 'active') return;

        state.skillUsed = true;

        switch (state.skill.id) {
            case 'xray': {
                // 透视：显示对手部分手牌
                let peekInfo = ' 透视！\n';
                [1, 2].forEach(i => { // 右家和上家(对手)
                    const p = state.players[i];
                    const shown = p.hand.slice(0, 2);
                    peekInfo += p.name + ': ' + shown.map(c => {
                        const d = getCardDisplay(c);
                        return d.suit + d.text;
                    }).join(' ') + '\n';
                });
                showSkillEffect(peekInfo.trim());
                break;
            }
            case 'shuffle_hand': {
                // 洗牌：随机换2张牌
                const hand = state.players[0].hand;
                if (hand.length < 2) break;
                const indices = [];
                while (indices.length < 2) {
                    const idx = Math.floor(Math.random() * hand.length);
                    if (!indices.includes(idx)) indices.push(idx);
                }
                indices.forEach(idx => {
                    const newSuit = randomPick(SUITS);
                    const newRank = randomPick(RANKS);
                    hand[idx] = { suit: newSuit, rank: newRank, value: RANK_VALUE[newRank], id: 'shuffle_' + newSuit + '_' + newRank + '_' + Math.random() };
                });
                state.players[0].hand = sortCards(hand, state.currentLevel);
                renderMyHand();
                showSkillEffect(' 洗牌！你的2张手牌已被替换');
                break;
            }
        }
        renderSkillBtn();
    };


    // ========== 出牌/过牌逻辑 ==========
    async function executePlay(playerIdx, cards, play) {
        state.isPlaying = true;
        const player = state.players[playerIdx];

        // 从手牌移除
        const cardIds = new Set(cards.map(c => c.id));
        player.hand = player.hand.filter(c => !cardIds.has(c.id));

        // 更新状态
        state.lastPlay = play;
        state.lastPlayCards = cards;
        state.lastPlayerIdx = playerIdx;
        state.consecutivePasses = 0;
        state.selectedCards = new Set();

        // 显示出牌
        renderPlayedCards(playerIdx, cards);
        renderMyHand();
        renderOtherPlayers();

        // 炸弹特效
        if (BOMB_RANK[play.type]) {
            showMessage(' ' + getPlayTypeName(play.type) + '！');
            await sleep(800);
            hideMessage();
        }

        await sleep(600);

        // 检查是否出完
        if (player.hand.length === 0 && !player.finished) {
            player.finished = true;
            state.finishOrder.push(playerIdx);
            player.finishOrder = state.finishOrder.length;
            showMessage(player.name + ' 第' + state.finishOrder.length + '个出完！');
            await sleep(1000);
            hideMessage();
        }

        // 检查游戏是否结束 (3人出完)
        if (state.finishOrder.length >= 3) {
            // 最后一个自动成为末游
            for (let i = 0; i < 4; i++) {
                if (!state.players[i].finished) {
                    state.players[i].finished = true;
                    state.finishOrder.push(i);
                    state.players[i].finishOrder = state.finishOrder.length;
                }
            }
            await sleep(500);
            endGame();
            return;
        }

        nextTurn();
    }

    async function executePass(playerIdx) {
        state.isPlaying = true;
        state.consecutivePasses++;

        // 显示不出
        renderPlayedCards(playerIdx, null);

        await sleep(500);

        // 如果连续3人pass，轮到最后一个出牌的人自由出
        if (state.consecutivePasses >= 3) {
            state.lastPlay = null;
            state.lastPlayCards = null;
            state.consecutivePasses = 0;
            clearAllPlayed();
        }

        nextTurn();
    }

    function nextTurn() {
        // 找下一个未完成的玩家
        let next = (state.currentPlayer + 1) % 4;
        let attempts = 0;
        while (state.players[next].finished && attempts < 4) {
            next = (next + 1) % 4;
            attempts++;
        }

        if (attempts >= 4) {
            endGame();
            return;
        }

        // 如果下一个就是上一个出牌的人(其他都pass或完成了)，自由出
        if (next === state.lastPlayerIdx) {
            state.lastPlay = null;
            state.lastPlayCards = null;
            state.consecutivePasses = 0;
            clearAllPlayed();
        }

        state.currentPlayer = next;
        state.isPlaying = false;
        updateActivePlayer();

        if (next === 0) {
            enablePlayerActions();
        } else {
            setTimeout(() => aiTurn(), 600 + Math.random() * 600);
        }
    }

    // ========== AI回合 ==========
    async function aiTurn() {
        if (state.currentPlayer === 0) return;
        const playerIdx = state.currentPlayer;
        const player = state.players[playerIdx];
        if (player.finished) { nextTurn(); return; }

        state.isPlaying = true;

        const lastPlay = (state.lastPlay && state.lastPlayerIdx !== playerIdx) ? state.lastPlay : null;
        const isTeammateLeading = state.lastPlayerIdx >= 0 && state.players[state.lastPlayerIdx].team === player.team && lastPlay !== null;

        const choice = aiChoosePlay(player.hand, lastPlay, state.currentLevel, isTeammateLeading);

        if (choice) {
            await executePlay(playerIdx, choice.cards, choice.play);
        } else {
            await executePass(playerIdx);
        }
    }

    // ========== 游戏结束 ==========
    function endGame() {
        state.gameStarted = false;

        // 计算排名奖励
        const rewards = calcRewards(state.betAmount);
        const playerRank = state.players[0].finishOrder; // 1-4
        let coinDelta = rewards[playerRank - 1] || 0;

        // 双倍技能
        if (state.doubleActive && coinDelta > 0) {
            coinDelta *= 2;
        }

        const newCoins = addCoins(coinDelta);

        // 切换到结算
        switchScreen('resultScreen');

        // 标题
        const medals = ['', '', '', ''];
        const rankNames = ['头游', '二游', '三游', '末游'];
        if (playerRank <= 2) {
            $('resultTitle').innerHTML = medals[playerRank - 1] + ' ' + rankNames[playerRank - 1] + '！' +
                ' <span style="color:#2ecc71;">+' + Math.abs(coinDelta) + ' </span>';
            $('resultTitle').style.color = '#27ae60';
        } else {
            $('resultTitle').innerHTML = medals[playerRank - 1] + ' ' + rankNames[playerRank - 1] +
                ' <span style="color:#e74c3c;">' + coinDelta + ' </span>';
            $('resultTitle').style.color = '#c0392b';
        }

        // 排名列表
        renderRankList(rewards, coinDelta, newCoins);
        // 得分详情
        renderScoreDetail(coinDelta, newCoins);
    }

    function renderRankList(rewards, myDelta, newCoins) {
        const container = $('rankList');
        const medals = ['', '', '', ''];
        let html = '';
        state.finishOrder.forEach((pIdx, i) => {
            const p = state.players[pIdx];
            const isMe = pIdx === 0;
            const reward = rewards[i] || 0;
            html += '<div class="rank-item rank-' + (i + 1) + (isMe ? ' is-me' : '') + '">' +
                '<span class="rank-medal">' + medals[i] + '</span>' +
                '<span class="rank-name">' + p.name + (isMe ? ' (你)' : '') + '</span>' +
                '<span class="rank-reward ' + (reward > 0 ? 'positive' : reward < 0 ? 'negative' : 'zero') + '">' +
                (reward > 0 ? '+' : '') + reward + '</span></div>';
        });
        container.innerHTML = html;
    }

    function renderScoreDetail(coinDelta, newCoins) {
        const container = $('scoreDetail');
        let html = '';
        html += '<div class="score-row"><span>下注金额</span><strong>' + state.betAmount + ' </strong></div>';
        html += '<div class="score-row"><span>你的排名</span><strong>' + ['头游', '二游', '三游', '末游'][state.players[0].finishOrder - 1] + '</strong></div>';
        if (state.doubleActive && coinDelta > 0) {
            html += '<div class="score-row"><span> 双倍技能</span><strong class="highlight">奖励 x2</strong></div>';
        }
        html += '<div class="score-row"><span>本局收益</span><strong class="' + (coinDelta >= 0 ? 'highlight' : '') + '">' + (coinDelta >= 0 ? '+' : '') + coinDelta + ' </strong></div>';
        html += '<div class="score-row"><span>当前余额</span><strong class="highlight">' + newCoins + ' </strong></div>';
        container.innerHTML = html;
    }

    // ========== 重玩 / 返回大厅 ==========
    $('btnRestart').addEventListener('click', function() {
        showBetScreen();
    });

    $('btnBackToLobby').addEventListener('click', function() {
        window.location.href = '../../index.html';
    });

})();
