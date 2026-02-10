/**
 * 🎮 连连猜 - 石头剪刀布卡牌对战
 * 规则：石头>剪刀>布>石头，三局两胜，每轮各出5张牌
 */
(function () {
    'use strict';

    // ========== 常量 ==========
    const ROCK = 'rock';
    const SCISSORS = 'scissors';
    const PAPER = 'paper';

    const CARD_EMOJI = {
        [ROCK]: '✊',
        [SCISSORS]: '✌️',
        [PAPER]: '🖐',
    };

    const CARD_NAME = {
        [ROCK]: '石头',
        [SCISSORS]: '剪刀',
        [PAPER]: '布',
    };

    const TOTAL_ROUNDS = 3;       // 总共3轮
    const CARDS_PER_ROUND = 5;    // 每轮出5张牌

    // ========== 用户数据（从localStorage读取，与大厅共享） ==========
    const STORAGE_KEY = 'minigame_lobby_user';

    function loadUserData() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (data && data.name && typeof data.coins === 'number') return data;
        } catch (e) {}
        return { name: '玩家', coins: 100 };
    }

    function saveUserData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function addCoins(amount) {
        const data = loadUserData();
        data.coins += amount;
        if (data.coins < 0) data.coins = 0;
        saveUserData(data);
        return data.coins;
    }

    function getCoins() {
        return loadUserData().coins;
    }

    function getUserName() {
        return loadUserData().name;
    }

    // NPC 对话库
    const NPC_DIALOGS = {
        deckSelect: [
            '胜率是百分之……算了，交给命运吧。',
            '有意思，让我看看你的选择。',
            '这局我可不会手下留情。',
            '随便选吧，结果都一样。',
            '嘿嘿，我已经看穿了一切。',
        ],
        battleStart: [
            '尽在掌握。',
            '来吧，让我看看你的实力。',
            '这局我有预感会赢。',
            '别紧张，放轻松~',
        ],
        npcWin: [
            '哈哈，果然如此！',
            '你太嫩了！',
            '我早就料到了。',
            '这就是实力的差距。',
        ],
        playerWin: [
            '什……怎么可能！',
            '运气不错嘛……',
            '下次我不会再输了。',
            '你赢了这次，但还有下次！',
        ],
        draw: [
            '英雄所见略同啊。',
            '居然一样？真巧！',
            '心有灵犀？',
        ],
    };

    const NPC_NAMES = ['卢克猎人', '暗影刺客', '铁拳武僧', '星辰法师', '风暴骑士'];

    // ========== 技能卡系统 ==========
    const SKILL_CARDS = [
        {
            id: 'peek',
            name: '🔮 透视',
            desc: '查看对手下一张将要出的牌',
            hint: '点击使用后，对手本回合出的牌将提前揭示',
            // 使用时机：出牌前
            timing: 'before',
        },
        {
            id: 'swap',
            name: '🔄 换牌',
            desc: '随机替换自己一张手牌为其他类型',
            hint: '你的一张手牌将被随机替换为其他类型',
            timing: 'before',
        },
        {
            id: 'mimic',
            name: '🎭 模仿',
            desc: '本次出牌自动变为克制对手的牌',
            hint: '选择使用后，下一次出牌自动变为克制对手的类型',
            timing: 'before',
        },
        {
            id: 'shield',
            name: '🛡️ 铁壁',
            desc: '本次出牌若输则变为平局',
            hint: '选择使用后，下一次出牌即使输了也不会失分',
            timing: 'before',
        },
        {
            id: 'chaos',
            name: '🎲 混沌',
            desc: '随机替换对手一张未出的手牌',
            hint: '对手一张手牌将被随机替换，可能打乱其牌组策略',
            timing: 'before',
        },
    ];

    /**
     * 随机生成N个不重复的技能卡供选择
     */
    function generateSkillOptions(count) {
        return shuffle([...SKILL_CARDS]).slice(0, count);
    }

    // ========== 牌组动态生成系统 ==========
    // 牌组风格模板：定义各风格的名称池、描述池和生成规则
    const DECK_STYLES = [
        {
            // 偏重型：某一类牌占多数(3~4张)
            namePool: ['猛攻型', '铁壁型', '剪影型', '重锤型', '坚盾型', '锋刃型', '碎石型', '裹铁型', '绞杀型'],
            descPool: ['以{main}为核心的强攻牌组', '{main}压制型牌组', '大量{main}的极端牌组', '偏向{main}的激进牌组'],
            generate() {
                const types = [ROCK, SCISSORS, PAPER];
                const main = randomPick(types);
                const others = types.filter(t => t !== main);
                // 3或4张主牌
                const mainCount = 3 + Math.floor(Math.random() * 2); // 3~4
                const cards = [];
                for (let i = 0; i < mainCount; i++) cards.push(main);
                // 剩余牌随机填充其他类型
                for (let i = mainCount; i < 5; i++) cards.push(randomPick(others));
                return { cards: shuffle(cards), mainType: main };
            }
        },
        {
            // 均衡型：比较平均
            namePool: ['均衡型', '平衡型', '中庸型', '稳健型', '老练型', '圆滑型', '全能型'],
            descPool: ['攻守兼备的均衡牌组', '各类型均匀分布的牌组', '没有明显弱点的牌组', '稳扎稳打型牌组'],
            generate() {
                const types = [ROCK, SCISSORS, PAPER];
                // 确保每种至少1张，剩余2张随机
                const cards = [ROCK, SCISSORS, PAPER];
                cards.push(randomPick(types));
                cards.push(randomPick(types));
                return { cards: shuffle(cards), mainType: null };
            }
        },
        {
            // 双重型：两种牌为主
            namePool: ['赌徒型', '双刃型', '诡变型', '乱斗型', '奇袭型', '双面型', '变幻型', '迷踪型'],
            descPool: ['出其不意的赌徒牌组', '双类型交织的牌组', '令人捉摸不透的牌组', '以{main}和{sub}混搭的牌组'],
            generate() {
                const types = [ROCK, SCISSORS, PAPER];
                const picked = shuffle(types).slice(0, 2);
                const main = picked[0];
                const sub = picked[1];
                // 主2~3，副2~3，总共5张
                const mainCount = 2 + Math.floor(Math.random() * 2); // 2~3
                const subCount = 5 - mainCount;
                const cards = [];
                for (let i = 0; i < mainCount; i++) cards.push(main);
                for (let i = 0; i < subCount; i++) cards.push(sub);
                return { cards: shuffle(cards), mainType: main, subType: sub };
            }
        },
        {
            // 极端型：全是同一种牌或只缺一种
            namePool: ['极端型', '纯粹型', '孤注型', '疯狂型', '破釜型', '背水型', '一搏型'],
            descPool: ['孤注一掷的极端牌组', '全力押注{main}的牌组', '不留退路的疯狂牌组', '高风险高回报的牌组'],
            generate() {
                const types = [ROCK, SCISSORS, PAPER];
                const main = randomPick(types);
                // 4~5张主牌
                const mainCount = 4 + Math.floor(Math.random() * 2); // 4~5
                const cards = [];
                for (let i = 0; i < mainCount; i++) cards.push(main);
                const others = types.filter(t => t !== main);
                for (let i = mainCount; i < 5; i++) cards.push(randomPick(others));
                return { cards: shuffle(cards), mainType: main };
            }
        },
    ];

    /**
     * 动态生成一个牌组
     */
    function generateDeck() {
        const style = randomPick(DECK_STYLES);
        const result = style.generate();
        const name = randomPick(style.namePool);
        let desc = randomPick(style.descPool);
        // 替换描述中的占位符
        if (result.mainType) {
            desc = desc.replace('{main}', CARD_NAME[result.mainType]);
        }
        if (result.subType) {
            desc = desc.replace('{sub}', CARD_NAME[result.subType]);
        }
        return { name, cards: result.cards, desc };
    }

    /**
     * 生成N个不重复（牌面组合尽量不同）的牌组供选择
     */
    function generateDeckOptions(count) {
        const options = [];
        const usedNames = new Set();
        let attempts = 0;
        while (options.length < count && attempts < 50) {
            attempts++;
            const deck = generateDeck();
            // 避免名字重复
            if (usedNames.has(deck.name)) continue;
            // 避免牌面完全一致
            const signature = [...deck.cards].sort().join(',');
            const isDuplicate = options.some(d => [...d.cards].sort().join(',') === signature);
            if (isDuplicate) continue;
            usedNames.add(deck.name);
            options.push(deck);
        }
        // 如果因为去重不够数，补充随机的
        while (options.length < count) {
            options.push(generateDeck());
        }
        return options;
    }

    // ========== 游戏状态 ==========
    let state = {
        npcName: '',
        currentRound: 0,          // 当前轮次 0-2
        playerRoundsWon: 0,
        npcRoundsWon: 0,
        betAmount: 20,             // 当前下注金额

        // 每轮数据
        playerDeck: [],            // 玩家本轮牌组
        npcDeck: [],               // NPC本轮牌组
        playerHand: [],            // 玩家当前手牌
        npcHand: [],               // NPC当前手牌
        playerPlayed: [],          // 玩家本轮已出的牌
        npcPlayed: [],             // NPC本轮已出的牌
        roundPlayerWins: 0,        // 本轮玩家赢的次数
        roundNpcWins: 0,           // 本轮NPC赢的次数
        selectedCardIndex: -1,     // 选中的手牌索引
        isPlaying: false,          // 是否在出牌动画中

        // 技能卡相关
        skill: null,               // 当前持有的技能卡 {id, name, desc, ...}
        skillUsed: false,          // 本轮是否已使用技能
        skillActive: null,         // 激活中的技能效果 (如 'mimic', 'shield', 'peek')
        peekResult: null,          // 透视结果 - NPC将要出的牌

        // 历史记录（用于结算展示）
        history: [],               // [{round, playerCards:[], npcCards:[], results:[], playerScore, npcScore}]
    };

    // ========== DOM 引用 ==========
    const $ = (id) => document.getElementById(id);

    // ========== 工具函数 ==========
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function randomPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * 判定胜负: 1=a赢, -1=b赢, 0=平
     */
    function judge(a, b) {
        if (a === b) return 0;
        if (
            (a === ROCK && b === SCISSORS) ||
            (a === SCISSORS && b === PAPER) ||
            (a === PAPER && b === ROCK)
        ) return 1;
        return -1;
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // ========== 画面切换 ==========
    function switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
        $(screenId).classList.add('active');
    }

    // ========== 开始界面 ==========
    $('btnStart').addEventListener('click', startGame);

    // 开始界面上显示当前余额
    function updateStartScreenInfo() {
        const nameEl = document.querySelector('#startScreen .player-name-display');
        // 在开始界面动态显示用户名和余额已经交由betScreen处理
    }

    function startGame() {
        // 初始化状态
        state.npcName = randomPick(NPC_NAMES);
        state.currentRound = 0;
        state.playerRoundsWon = 0;
        state.npcRoundsWon = 0;
        state.history = [];

        // 更新NPC名称
        $('npcNameDeck').textContent = state.npcName;
        $('npcNameBattle').textContent = state.npcName;

        // 显示加注界面
        showBetScreen();
    }

    // ========== 加注阶段 ==========
    function showBetScreen() {
        switchScreen('betScreen');
        const coins = getCoins();
        $('betCoinAmount').textContent = coins;

        // 默认选20，但如果余额不足则选最小的
        let defaultBet = 20;
        if (coins < 20) defaultBet = coins >= 10 ? 10 : (coins >= 5 ? 5 : 0);
        state.betAmount = defaultBet;

        updateBetUI();
    }

    function updateBetUI() {
        const coins = getCoins();
        const bet = state.betAmount;

        // 高亮选中
        document.querySelectorAll('.bet-option').forEach(el => {
            const v = parseInt(el.dataset.bet);
            el.classList.toggle('selected', v === bet);
            el.classList.toggle('disabled', v > coins);
        });

        $('betSelectedAmount').textContent = bet;
        $('betRewardWin').textContent = '+' + bet;
        $('betRewardLose').textContent = '-' + bet;

        // 余额不足提示
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

    // 全局：选择下注额
    window._selectBet = function(amount) {
        const coins = getCoins();
        if (amount > coins) return;
        state.betAmount = amount;
        updateBetUI();
    };

    $('btnConfirmBet').addEventListener('click', function() {
        if (state.betAmount > getCoins()) return;
        // 进入技能选择
        showSkillSelection();
    });

    // ========== 技能选择阶段 ==========
    function showSkillSelection() {
        switchScreen('skillScreen');
        const options = generateSkillOptions(3);
        const container = $('skillOptions');
        container.innerHTML = options.map((sk, i) => `
            <div class="skill-option" data-skill-index="${i}">
                <div class="skill-icon">${sk.name.split(' ')[0]}</div>
                <div class="skill-name">${sk.name.split(' ')[1] || sk.name}</div>
                <div class="skill-desc">${sk.desc}</div>
                <div class="skill-hint">${sk.hint}</div>
                <button class="btn-primary skill-select-btn" data-skill-index="${i}">选择</button>
            </div>
        `).join('');

        // 绑定选择事件
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
                state.skillActive = null;
                state.peekResult = null;
                showDeckSelection();
            });
        });
    }

    // ========== 牌组选择阶段 ==========
    function showDeckSelection() {
        switchScreen('deckScreen');

        // 更新分数和轮次
        $('deckPlayerScore').textContent = state.playerRoundsWon;
        $('deckNpcScore').textContent = state.npcRoundsWon;
        $('deckRoundIndicator').innerHTML = `回合 <strong>${state.currentRound + 1}</strong>/3`;

        // NPC对话
        $('npcDialogDeckText').textContent = randomPick(NPC_DIALOGS.deckSelect);

        // 生成牌组选项
        const decksContainer = $('deckOptions');
        // 动态随机生成3个牌组供玩家选择
        const availableDecks = generateDeckOptions(3);

        decksContainer.innerHTML = availableDecks
            .map(
                (deck, i) => `
            <div class="deck-option" data-deck-index="${i}">
                <div class="deck-option-cards">
                    ${deck.cards.map((c) => `<div class="deck-mini-card">${CARD_EMOJI[c]}</div>`).join('')}
                </div>
                <div class="deck-option-name">${deck.name}</div>
                <p style="font-size:12px; color:var(--text-dim); margin-top:4px;">${deck.desc}</p>
                <button class="btn-primary deck-select-btn" data-deck-index="${i}">选择</button>
            </div>
        `
            )
            .join('');

        // 绑定选择事件
        decksContainer.querySelectorAll('.deck-option').forEach((el) => {
            el.addEventListener('click', function () {
                // 高亮选中
                decksContainer.querySelectorAll('.deck-option').forEach((e) => e.classList.remove('selected'));
                this.classList.add('selected');
            });
        });

        decksContainer.querySelectorAll('.deck-select-btn').forEach((btn) => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.deckIndex);
                selectDeck(availableDecks[idx]);
            });
        });
    }

    function selectDeck(deck) {
        // 玩家牌组
        state.playerDeck = shuffle([...deck.cards]);
        state.playerHand = [...state.playerDeck];

        // NPC 随机生成一个牌组
        const npcDeck = generateDeck();
        state.npcDeck = shuffle([...npcDeck.cards]);
        state.npcHand = [...state.npcDeck];

        // 重置本轮数据
        state.playerPlayed = [];
        state.npcPlayed = [];
        state.roundPlayerWins = 0;
        state.roundNpcWins = 0;
        state.selectedCardIndex = -1;
        state.isPlaying = false;
        state.skillActive = null;
        state.peekResult = null;

        showBattle();
    }

    // ========== 出牌对战阶段 ==========
    function showBattle() {
        switchScreen('battleScreen');

        // 更新状态栏
        $('battlePlayerScore').textContent = state.playerRoundsWon;
        $('battleNpcScore').textContent = state.npcRoundsWon;
        $('battleRoundLabel').textContent = `回合 ${state.currentRound + 1}/${TOTAL_ROUNDS}`;
        $('roundScoreText').textContent = `本轮比分: ${state.roundPlayerWins} - ${state.roundNpcWins}`;

        // NPC对话
        $('npcDialogBattleText').textContent = randomPick(NPC_DIALOGS.battleStart);
        $('battleHint').textContent = '选中卡牌后点击打出';

        // 重置对战台
        $('npcPlayedSlot').innerHTML = '<div class="card-placeholder">?</div>';
        $('npcPlayedSlot').classList.remove('has-card');
        $('playerPlayedSlot').innerHTML = '<div class="card-placeholder">?</div>';
        $('playerPlayedSlot').classList.remove('has-card');

        renderNpcCards();
        renderPlayerCards();
        renderNpcDeckPreview();
        renderSkillButton();
    }

    function renderNpcCards() {
        const container = $('npcCards');
        container.innerHTML = state.npcHand
            .map(
                (card, i) => `
            <div class="card card-back ${state.npcHand[i] === null ? 'npc-used' : ''}" data-index="${i}">
            </div>
        `
            )
            .join('');
    }

    function renderPlayerCards() {
        const container = $('playerCards');
        container.innerHTML = state.playerHand
            .map(
                (card, i) => `
            <div class="card card-front ${card === null ? 'used' : ''} ${state.selectedCardIndex === i ? 'selected' : ''}"
                 data-index="${i}" ${card !== null ? 'onclick="window._selectCard(' + i + ')"' : ''}>
                ${card !== null ? CARD_EMOJI[card] : ''}
            </div>
        `
            )
            .join('');
    }

    // 全局函数：选中/出牌
    window._selectCard = function (index) {
        if (state.isPlaying) return;
        if (state.playerHand[index] === null) return;

        if (state.selectedCardIndex === index) {
            // 双击同一张牌 -> 出牌
            playCard(index);
        } else {
            // 选中
            state.selectedCardIndex = index;
            renderPlayerCards();
            $('battleHint').textContent = '再次点击选中的牌打出，或点击其他牌切换';
        }
    };

    // ========== 技能卡：使用逻辑 ==========
    window._useSkill = function() {
        if (state.isPlaying || state.skillUsed) return;
        const skill = state.skill;
        if (!skill) return;

        state.skillUsed = true;

        switch (skill.id) {
            case 'peek': {
                // 透视：预先决定NPC下一张出的牌并显示给玩家
                const npcAvailable = state.npcHand
                    .map((c, i) => ({ card: c, index: i }))
                    .filter(x => x.card !== null);
                if (npcAvailable.length === 0) break;
                const npcChoice = randomPick(npcAvailable);
                state.peekResult = { card: npcChoice.card, index: npcChoice.index };
                state.skillActive = 'peek';
                showSkillEffect(`🔮 透视发动！对手下一张将出 ${CARD_EMOJI[npcChoice.card]} ${CARD_NAME[npcChoice.card]}`);
                break;
            }
            case 'swap': {
                // 换牌：随机替换自己一张可用手牌
                const available = state.playerHand
                    .map((c, i) => ({ card: c, index: i }))
                    .filter(x => x.card !== null);
                if (available.length === 0) break;
                const target = randomPick(available);
                const types = [ROCK, SCISSORS, PAPER].filter(t => t !== target.card);
                const newCard = randomPick(types);
                const oldEmoji = CARD_EMOJI[target.card];
                state.playerHand[target.index] = newCard;
                renderPlayerCards();
                showSkillEffect(`🔄 换牌发动！${oldEmoji} → ${CARD_EMOJI[newCard]} ${CARD_NAME[newCard]}`);
                break;
            }
            case 'mimic': {
                // 模仿：标记下一次出牌自动克制
                state.skillActive = 'mimic';
                showSkillEffect('🎭 模仿发动！下一次出牌将自动克制对手');
                break;
            }
            case 'shield': {
                // 铁壁：标记下一次出牌输了变平局
                state.skillActive = 'shield';
                showSkillEffect('🛡️ 铁壁发动！下一次出牌即使输了也不会失分');
                break;
            }
            case 'chaos': {
                // 混沌：随机替换对手一张未出的手牌
                const npcAvail = state.npcHand
                    .map((c, i) => ({ card: c, index: i }))
                    .filter(x => x.card !== null);
                if (npcAvail.length === 0) break;
                const npcTarget = randomPick(npcAvail);
                const npcTypes = [ROCK, SCISSORS, PAPER].filter(t => t !== npcTarget.card);
                state.npcHand[npcTarget.index] = randomPick(npcTypes);
                // 更新NPC牌组信息（预览中不暴露具体变化）
                state.npcDeck[npcTarget.index] = state.npcHand[npcTarget.index];
                renderNpcDeckPreview();
                showSkillEffect('🎲 混沌发动！对手的一张手牌已被悄悄替换');
                break;
            }
        }
        renderSkillButton();
    };

    /**
     * 显示技能发动特效提示
     */
    function showSkillEffect(text) {
        // 创建浮动提示
        const toast = document.createElement('div');
        toast.className = 'skill-toast';
        toast.textContent = text;
        $('battleScreen').appendChild(toast);
        // 动画结束后移除
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 400);
        }, 2000);
    }

    /**
     * 渲染技能按钮
     */
    function renderSkillButton() {
        // 移除旧的
        const old = document.querySelector('.skill-btn-area');
        if (old) old.remove();

        if (!state.skill) return;

        const area = document.createElement('div');
        area.className = 'skill-btn-area';

        if (state.skillUsed) {
            area.innerHTML = `
                <div class="skill-btn used" title="技能已使用">
                    <span class="skill-btn-icon">${state.skill.name.split(' ')[0]}</span>
                    <span class="skill-btn-label">已使用</span>
                </div>
            `;
        } else {
            area.innerHTML = `
                <div class="skill-btn available" onclick="window._useSkill()" title="${state.skill.desc}">
                    <span class="skill-btn-icon">${state.skill.name.split(' ')[0]}</span>
                    <span class="skill-btn-label">${state.skill.name.split(' ')[1] || '技能'}</span>
                </div>
            `;
        }

        // 如果有 peek 激活态，加个提示
        if (state.skillActive === 'peek' && state.peekResult) {
            const peekHint = document.createElement('div');
            peekHint.className = 'peek-hint';
            peekHint.innerHTML = `对手下一张: <strong>${CARD_EMOJI[state.peekResult.card]} ${CARD_NAME[state.peekResult.card]}</strong>`;
            area.appendChild(peekHint);
        }
        if (state.skillActive === 'mimic') {
            const mimicHint = document.createElement('div');
            mimicHint.className = 'peek-hint';
            mimicHint.textContent = '🎭 下次出牌自动克制对手';
            area.appendChild(mimicHint);
        }
        if (state.skillActive === 'shield') {
            const shieldHint = document.createElement('div');
            shieldHint.className = 'peek-hint';
            shieldHint.textContent = '🛡️ 下次出牌输了不失分';
            area.appendChild(shieldHint);
        }

        $('battleScreen').appendChild(area);
    }

    async function playCard(index) {
        if (state.isPlaying) return;
        state.isPlaying = true;
        state.selectedCardIndex = -1;

        let playerCard = state.playerHand[index];
        state.playerHand[index] = null;

        // NPC 选牌
        let npcCard, npcChoiceIndex;
        if (state.skillActive === 'peek' && state.peekResult) {
            // 透视：NPC 出之前预定好的牌
            npcCard = state.peekResult.card;
            npcChoiceIndex = state.peekResult.index;
            state.npcHand[npcChoiceIndex] = null;
            state.peekResult = null;
            state.skillActive = null;
        } else {
            const npcAvailable = state.npcHand
                .map((c, i) => ({ card: c, index: i }))
                .filter((x) => x.card !== null);
            const npcChoice = randomPick(npcAvailable);
            npcCard = npcChoice.card;
            npcChoiceIndex = npcChoice.index;
            state.npcHand[npcChoiceIndex] = null;
        }

        // 模仿技能：玩家的牌自动变为克制对手的牌
        let mimicUsed = false;
        if (state.skillActive === 'mimic') {
            const winningCard = { [ROCK]: PAPER, [SCISSORS]: ROCK, [PAPER]: SCISSORS };
            const originalCard = playerCard;
            playerCard = winningCard[npcCard];
            mimicUsed = true;
            state.skillActive = null;
        }

        // 铁壁技能：标记本次是否使用
        let shieldActive = false;
        if (state.skillActive === 'shield') {
            shieldActive = true;
            state.skillActive = null;
        }

        // 记录（记录实际出的牌）
        state.playerPlayed.push(playerCard);
        state.npcPlayed.push(npcCard);

        // 显示出牌动画
        const playerCardHtml = mimicUsed
            ? `<div class="played-card mimic-glow">${CARD_EMOJI[playerCard]}</div>`
            : `<div class="played-card">${CARD_EMOJI[playerCard]}</div>`;
        $('playerPlayedSlot').innerHTML = playerCardHtml;
        $('playerPlayedSlot').classList.add('has-card');

        renderPlayerCards();
        renderNpcCards();
        renderNpcDeckPreview();
        renderSkillButton();

        await sleep(500);

        // 翻开NPC的牌
        $('npcPlayedSlot').innerHTML = `<div class="played-card">${CARD_EMOJI[npcCard]}</div>`;
        $('npcPlayedSlot').classList.add('has-card');

        await sleep(400);

        // 判定胜负
        let result = judge(playerCard, npcCard);

        // 铁壁效果：输了变平局
        if (shieldActive && result === -1) {
            result = 0;
            showSkillEffect('🛡️ 铁壁生效！本次免除失败');
        }

        if (mimicUsed) {
            showSkillEffect('🎭 模仿生效！');
        }

        if (result === 1) {
            state.roundPlayerWins++;
            addResultMark('playerPlayedSlot', 'win', '胜');
            addResultMark('npcPlayedSlot', 'lose', '负');
            $('npcDialogBattleText').textContent = randomPick(NPC_DIALOGS.playerWin);
        } else if (result === -1) {
            state.roundNpcWins++;
            addResultMark('npcPlayedSlot', 'win', '胜');
            addResultMark('playerPlayedSlot', 'lose', '负');
            $('npcDialogBattleText').textContent = randomPick(NPC_DIALOGS.npcWin);
        } else {
            addResultMark('playerPlayedSlot', 'draw', '平');
            addResultMark('npcPlayedSlot', 'draw', '平');
            $('npcDialogBattleText').textContent = randomPick(NPC_DIALOGS.draw);
        }

        $('roundScoreText').textContent = `本轮比分: ${state.roundPlayerWins} - ${state.roundNpcWins}`;

        await sleep(1200);

        // 判断本轮是否结束（所有牌出完）
        const remainingCards = state.playerHand.filter((c) => c !== null).length;
        if (remainingCards === 0) {
            // 本轮结束
            endRound();
        } else {
            // 继续出牌，重置对战台
            $('npcPlayedSlot').innerHTML = '<div class="card-placeholder">?</div>';
            $('npcPlayedSlot').classList.remove('has-card');
            $('playerPlayedSlot').innerHTML = '<div class="card-placeholder">?</div>';
            $('playerPlayedSlot').classList.remove('has-card');
            $('battleHint').textContent = '选中卡牌后点击打出';
            state.isPlaying = false;
        }
    }

    function addResultMark(slotId, type, text) {
        const slot = $(slotId);
        // 移除旧标记
        const old = slot.querySelector('.result-mark');
        if (old) old.remove();
        const mark = document.createElement('div');
        mark.className = `result-mark ${type}`;
        mark.textContent = text;
        slot.appendChild(mark);
    }

    function renderNpcDeckPreview() {
        // 移除旧的
        const old = document.querySelector('.npc-deck-preview');
        if (old) old.remove();

        // 统计NPC已出过哪些牌（按类型计数）
        const usedCount = {};
        state.npcDeck.forEach((c, i) => {
            if (state.npcHand[i] === null) {
                usedCount[c] = (usedCount[c] || 0) + 1;
            }
        });
        // 为每张牌生成标记，已出过的加 used class
        const usedTracker = {};
        const cardsHtml = state.npcDeck.map((c) => {
            usedTracker[c] = (usedTracker[c] || 0);
            const totalOfType = state.npcDeck.filter(x => x === c).length;
            const remainOfType = state.npcHand.filter(x => x === c).length;
            const usedOfType = totalOfType - remainOfType;
            let isUsed = false;
            if (usedTracker[c] < usedOfType) {
                isUsed = true;
            }
            usedTracker[c]++;
            return `<div class="npc-deck-mini ${isUsed ? 'used' : ''}">${CARD_EMOJI[c]}</div>`;
        }).join('');

        const preview = document.createElement('div');
        preview.className = 'npc-deck-preview';
        preview.innerHTML = `
            <div class="npc-deck-toggle" onclick="this.parentElement.classList.toggle('collapsed')">
                🔍 查看对手牌型
            </div>
            <div class="npc-deck-cards">
                ${cardsHtml}
            </div>
        `;
        $('battleScreen').appendChild(preview);
    }

    // ========== 轮次结算 ==========
    function endRound() {
        // 计算本轮结果
        const results = state.playerPlayed.map((pc, i) => judge(pc, state.npcPlayed[i]));

        // 保存历史
        state.history.push({
            round: state.currentRound + 1,
            playerCards: [...state.playerPlayed],
            npcCards: [...state.npcPlayed],
            results: results,
            playerScore: state.roundPlayerWins,
            npcScore: state.roundNpcWins,
        });

        // 判定本轮胜负
        let roundWinner = 'draw';
        let roundText = '';
        let roundIcon = '';

        if (state.roundPlayerWins > state.roundNpcWins) {
            state.playerRoundsWon++;
            roundWinner = 'win';
            roundText = '你赢了本轮！';
            roundIcon = '🏆';
        } else if (state.roundNpcWins > state.roundPlayerWins) {
            state.npcRoundsWon++;
            roundWinner = 'lose';
            roundText = `${state.npcName} 赢了本轮！`;
            roundIcon = '💀';
        } else {
            // 平局算双方都不加分
            roundText = '本轮平局！';
            roundIcon = '🤝';
        }

        // 显示轮次结果弹窗
        const overlay = $('roundResultOverlay');
        $('roundResultIcon').textContent = roundIcon;
        $('roundResultText').textContent = roundText;
        $('roundResultText').className = `round-result-text ${roundWinner}`;
        $('roundResultScore').textContent = `${state.roundPlayerWins} - ${state.roundNpcWins}`;

        // 检查是否大局结束
        const gameOver = state.currentRound >= TOTAL_ROUNDS - 1 ||
            state.playerRoundsWon >= 2 || state.npcRoundsWon >= 2;

        if (gameOver) {
            $('btnNextRound').textContent = '📊 查看结算';
        } else {
            $('btnNextRound').textContent = '▶ 下一轮';
        }

        overlay.classList.add('active');
        state.isPlaying = false;
    }

    $('btnNextRound').addEventListener('click', function () {
        $('roundResultOverlay').classList.remove('active');

        const gameOver = state.currentRound >= TOTAL_ROUNDS - 1 ||
            state.playerRoundsWon >= 2 || state.npcRoundsWon >= 2;

        if (gameOver) {
            showResult();
        } else {
            state.currentRound++;
            showDeckSelection();
        }
    });

    // ========== 结算界面 ==========
    function showResult() {
        switchScreen('resultScreen');

        const playerTotalWins = state.playerRoundsWon;
        const npcTotalWins = state.npcRoundsWon;
        const isFinalWin = playerTotalWins > npcTotalWins;
        const isFinalDraw = playerTotalWins === npcTotalWins;

        // 计算赌金变化
        let coinDelta = 0;
        if (isFinalWin) {
            coinDelta = state.betAmount;
        } else if (!isFinalDraw) {
            coinDelta = -state.betAmount;
        }

        // 更新用户余额
        const newCoins = addCoins(coinDelta);

        // 标题
        if (isFinalWin) {
            $('resultTitle').innerHTML = '🏆 胜利 <span style="font-size:18px; color:#2ecc71;">+' + state.betAmount + ' 💰</span>';
            $('resultTitle').style.color = '#27ae60';
        } else if (isFinalDraw) {
            $('resultTitle').innerHTML = '🤝 平局 <span style="font-size:18px; color:#c9a84c;">±0 💰</span>';
            $('resultTitle').style.color = '#c9a84c';
        } else {
            $('resultTitle').innerHTML = '💀 失败 <span style="font-size:18px; color:#e74c3c;">-' + state.betAmount + ' 💰</span>';
            $('resultTitle').style.color = '#c0392b';
        }

        // 时间线
        renderTimeline();
        // 得分表
        renderScoreTable();
        // 赌金结算信息
        renderBetResult(coinDelta, newCoins);
    }

    function renderBetResult(delta, newCoins) {
        // 在得分表后面添加赌金结算信息
        const container = $('scoreTable');
        let html = container.innerHTML;
        html += `<div class="bet-result-section">`;
        html += `<div class="bet-result-row">`;
        html += `  <span>下注金额</span>`;
        html += `  <strong>${state.betAmount} 💰</strong>`;
        html += `</div>`;
        html += `<div class="bet-result-row ${delta > 0 ? 'bet-win' : delta < 0 ? 'bet-lose' : 'bet-draw'}">`;
        html += `  <span>本局收益</span>`;
        html += `  <strong>${delta > 0 ? '+' : ''}${delta} 💰</strong>`;
        html += `</div>`;
        html += `<div class="bet-result-row">`;
        html += `  <span>当前余额</span>`;
        html += `  <strong class="bet-balance">${newCoins} 💰</strong>`;
        html += `</div>`;
        html += `</div>`;
        container.innerHTML = html;
    }

    function renderTimeline() {
        const section = $('timelineSection');
        section.innerHTML = '';

        let html = '';

        state.history.forEach((round, ri) => {
            // 轮次胜负判定
            let roundResultClass = '';
            let roundResultText = '';
            if (round.playerScore > round.npcScore) {
                roundResultClass = 'round-win';
                roundResultText = '✔ 玩家胜';
            } else if (round.npcScore > round.playerScore) {
                roundResultClass = 'round-lose';
                roundResultText = '✘ 对手胜';
            } else {
                roundResultClass = 'round-draw';
                roundResultText = '— 平局';
            }

            html += `<div class="tl-round">`;
            html += `<div class="tl-round-header">`;
            html += `<span class="tl-round-title">第 ${round.round} 轮</span>`;
            html += `<span class="tl-round-result ${roundResultClass}">${roundResultText}</span>`;
            html += `<span class="tl-round-score">${round.playerScore} : ${round.npcScore}</span>`;
            html += `</div>`;

            // 每对出牌
            html += `<div class="tl-pairs">`;
            round.playerCards.forEach((pc, ci) => {
                const nc = round.npcCards[ci];
                const res = round.results[ci];
                const pairClass = res === 1 ? 'pair-win' : res === -1 ? 'pair-lose' : 'pair-draw';
                const pairIcon = res === 1 ? '胜' : res === -1 ? '负' : '平';
                html += `<div class="tl-pair ${pairClass}">`;
                html += `  <div class="tl-pair-player"><span class="tl-emoji">${CARD_EMOJI[pc]}</span></div>`;
                html += `  <div class="tl-pair-vs">${pairIcon}</div>`;
                html += `  <div class="tl-pair-npc"><span class="tl-emoji">${CARD_EMOJI[nc]}</span></div>`;
                html += `</div>`;
            });
            html += `</div>`;
            html += `</div>`;
        });

        section.innerHTML = html;
    }

    function renderScoreTable() {
        const table = $('scoreTable');

        // 统计总数据
        let totalPlayerWins = 0, totalNpcWins = 0, totalDraws = 0;
        state.history.forEach(r => {
            r.results.forEach(res => {
                if (res === 1) totalPlayerWins++;
                else if (res === -1) totalNpcWins++;
                else totalDraws++;
            });
        });
        const totalCards = totalPlayerWins + totalNpcWins + totalDraws;

        let html = `<div class="st-summary">`;
        html += `<div class="st-summary-row">`;
        html += `  <div class="st-summary-item">`;
        html += `    <div class="st-summary-avatar player-border">🧑</div>`;
        html += `    <div class="st-summary-label">玩家</div>`;
        html += `    <div class="st-summary-big">${state.playerRoundsWon}</div>`;
        html += `    <div class="st-summary-sub">轮胜</div>`;
        html += `  </div>`;
        html += `  <div class="st-summary-vs">`;
        html += `    <div class="st-vs-text">VS</div>`;
        html += `    <div class="st-vs-rounds">${state.playerRoundsWon} : ${state.npcRoundsWon}</div>`;
        html += `  </div>`;
        html += `  <div class="st-summary-item">`;
        html += `    <div class="st-summary-avatar npc-border">🤖</div>`;
        html += `    <div class="st-summary-label">${state.npcName}</div>`;
        html += `    <div class="st-summary-big">${state.npcRoundsWon}</div>`;
        html += `    <div class="st-summary-sub">轮胜</div>`;
        html += `  </div>`;
        html += `</div>`;

        // 单牌胜率条
        const pRate = totalCards > 0 ? Math.round(totalPlayerWins / totalCards * 100) : 0;
        const nRate = totalCards > 0 ? Math.round(totalNpcWins / totalCards * 100) : 0;
        const dRate = 100 - pRate - nRate;
        html += `<div class="st-bar-section">`;
        html += `  <div class="st-bar-labels"><span>胜 ${totalPlayerWins}</span><span>平 ${totalDraws}</span><span>负 ${totalNpcWins}</span></div>`;
        html += `  <div class="st-bar">`;
        html += `    <div class="st-bar-seg st-bar-win" style="width:${pRate}%"></div>`;
        html += `    <div class="st-bar-seg st-bar-draw" style="width:${dRate}%"></div>`;
        html += `    <div class="st-bar-seg st-bar-lose" style="width:${nRate}%"></div>`;
        html += `  </div>`;
        html += `  <div class="st-bar-labels"><span>${pRate}%</span><span>${dRate}%</span><span>${nRate}%</span></div>`;
        html += `</div>`;

        html += `</div>`;

        table.innerHTML = html;
    }

    // ========== 重玩 / 返回大厅 ==========
    $('btnRestart').addEventListener('click', function () {
        startGame();
    });

    $('btnBackToLobby').addEventListener('click', function () {
        window.location.href = '../../index.html';
    });

    // ========== 更新开始界面上的用户信息 ==========
    (function updateStartInfo() {
        const data = loadUserData();
        // 在开始按钮下面显示用户信息
        const startContent = document.querySelector('.start-content');
        if (startContent && !document.querySelector('.start-user-info')) {
            const info = document.createElement('div');
            info.className = 'start-user-info';
            info.innerHTML = `
                <div style="margin-top:24px; padding:12px 24px; background:rgba(255,255,255,0.05); border-radius:12px; display:inline-flex; align-items:center; gap:16px;">
                    <span style="font-size:20px;">😊</span>
                    <span style="font-weight:600;">${data.name}</span>
                    <span style="color:var(--gold); font-weight:800;">💰 ${data.coins} 小爱豆</span>
                </div>
            `;
            startContent.appendChild(info);
        }
    })();
})();
