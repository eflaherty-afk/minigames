/**
 * 🎮 小游戏大厅 - 主逻辑
 */
(function () {
    'use strict';

    // ========== 用户数据管理（localStorage持久化） ==========
    const STORAGE_KEY = 'minigame_lobby_user';

    function loadUserData() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (data && data.name && typeof data.coins === 'number') {
                return data;
            }
        } catch (e) {}
        return null;
    }

    function saveUserData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getUserData() {
        let data = loadUserData();
        if (!data) {
            data = { name: '玩家', coins: 100 };
            saveUserData(data);
        }
        return data;
    }

    function addCoins(amount) {
        const data = getUserData();
        data.coins += amount;
        if (data.coins < 0) data.coins = 0;
        saveUserData(data);
        updateCoinDisplay(data.coins, amount);
        return data.coins;
    }

    function updateCoinDisplay(coins, delta) {
        const amountEl = document.getElementById('coinAmount');
        if (amountEl) {
            amountEl.textContent = coins;
        }
        // 弹跳动画
        const coinsEl = document.getElementById('userCoins');
        if (coinsEl) {
            coinsEl.classList.remove('coin-bounce');
            void coinsEl.offsetWidth; // 重置动画
            coinsEl.classList.add('coin-bounce');
        }
        // 飘字效果
        if (delta && delta !== 0) {
            showCoinFloat(delta);
        }
    }

    function showCoinFloat(delta) {
        const coinsEl = document.getElementById('userCoins');
        if (!coinsEl) return;
        const rect = coinsEl.getBoundingClientRect();
        const float = document.createElement('div');
        float.className = 'coin-float';
        float.textContent = (delta > 0 ? '+' : '') + delta + ' 💰';
        float.style.left = rect.left + rect.width / 2 - 30 + 'px';
        float.style.top = rect.top - 10 + 'px';
        if (delta > 0) {
            float.style.color = '#2ecc71';
        } else {
            float.style.color = '#e74c3c';
        }
        document.body.appendChild(float);
        setTimeout(() => float.remove(), 1300);
    }

    // 暴露给子游戏使用的全局API
    window.LobbyAPI = {
        getUserData: getUserData,
        addCoins: addCoins,
        saveUserData: saveUserData,
    };

    // ========== DOM 元素 ==========
    const gamesGrid = document.getElementById('gamesGrid');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const filterTags = document.getElementById('filterTags');
    const nameModal = document.getElementById('nameModal');
    const nameInput = document.getElementById('nameInput');
    const nameConfirmBtn = document.getElementById('nameConfirmBtn');

    // ========== 状态 ==========
    let currentCategory = 'all';
    let searchKeyword = '';

    // ========== 分类名映射 ==========
    const categoryLabels = {
        action: '⚔️ 动作',
        puzzle: '🧩 益智',
        casual: '🎯 休闲',
        strategy: '♟️ 策略',
        adventure: '🗺️ 冒险',
        sport: '⚽ 体育',
    };

    // ========== 初始化用户 ==========
    function initUser() {
        const data = loadUserData();
        if (!data) {
            // 首次进入，显示取名弹窗
            nameModal.style.display = 'flex';
            nameInput.focus();

            nameConfirmBtn.addEventListener('click', confirmName);
            nameInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') confirmName();
            });
        } else {
            // 已有用户，直接显示
            applyUserData(data);
        }
    }

    function confirmName() {
        const name = nameInput.value.trim() || '玩家';
        const data = { name: name, coins: 100 };
        saveUserData(data);
        nameModal.style.display = 'none';
        applyUserData(data);
    }

    function applyUserData(data) {
        document.getElementById('userName').textContent = data.name;
        document.getElementById('coinAmount').textContent = data.coins;
    }

    // ========== 后门：连续点击"小游戏大厅"3次加100小爱豆 ==========
    let backdoorClicks = 0;
    let backdoorTimer = null;

    const logoArea = document.getElementById('logoArea');
    if (logoArea) {
        logoArea.addEventListener('click', function() {
            backdoorClicks++;
            if (backdoorTimer) clearTimeout(backdoorTimer);

            if (backdoorClicks >= 3) {
                backdoorClicks = 0;
                addCoins(100);
                // 彩蛋提示
                showBackdoorToast();
            } else {
                backdoorTimer = setTimeout(() => {
                    backdoorClicks = 0;
                }, 800); // 800ms内完成3次点击
            }
        });
    }

    function showBackdoorToast() {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #f39c12, #e67e22);
            color: #fff; font-size: 16px; font-weight: 700;
            padding: 12px 28px; border-radius: 50px; z-index: 10000;
            box-shadow: 0 4px 20px rgba(243,156,18,0.5);
            animation: fadeInUp 0.4s ease;
        `;
        toast.textContent = '🎉 发现隐藏彩蛋！+100 小爱豆';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.4s ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 2000);
    }

    // ========== 渲染游戏卡片 ==========
    function renderGames() {
        const filtered = GAMES.filter((game) => {
            const matchCategory = currentCategory === 'all' || game.category === currentCategory;
            const matchSearch =
                !searchKeyword ||
                game.name.toLowerCase().includes(searchKeyword) ||
                game.desc.toLowerCase().includes(searchKeyword);
            return matchCategory && matchSearch;
        });

        // 空状态处理
        if (filtered.length === 0) {
            gamesGrid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        gamesGrid.style.display = 'grid';
        emptyState.style.display = 'none';

        gamesGrid.innerHTML = filtered
            .map(
                (game, index) => `
            <div class="game-card" style="animation-delay: ${index * 0.06}s" onclick="window.open('${game.url}', '_self')">
                <div class="game-card-thumb" style="background: ${game.color || 'linear-gradient(135deg, #6c5ce7, #a29bfe)'}">
                    ${
                        game.thumb
                            ? `<img src="${game.thumb}" alt="${game.name}" loading="lazy">`
                            : `<span>${game.icon || '🎮'}</span>`
                    }
                </div>
                <div class="game-card-body">
                    <div class="game-card-title">${game.icon || '🎮'} ${game.name}</div>
                    <div class="game-card-desc">${game.desc}</div>
                    <div class="game-card-meta">
                        <span class="game-card-category">${categoryLabels[game.category] || game.category}</span>
                        ${game.cost ? `<span class="game-card-cost">💰 ${game.cost}</span>` : ''}
                        <button class="game-card-play" onclick="event.stopPropagation(); window.open('${game.url}', '_self')">
                            ▶ 开始游戏
                        </button>
                    </div>
                </div>
            </div>
        `
            )
            .join('');
    }

    // ========== 搜索事件 ==========
    searchInput.addEventListener('input', function (e) {
        searchKeyword = e.target.value.trim().toLowerCase();
        renderGames();
    });

    // ========== 分类过滤事件 ==========
    filterTags.addEventListener('click', function (e) {
        const tag = e.target.closest('.filter-tag');
        if (!tag) return;

        filterTags.querySelectorAll('.filter-tag').forEach((t) => t.classList.remove('active'));
        tag.classList.add('active');

        currentCategory = tag.dataset.category;
        renderGames();
    });

    // ========== 监听子游戏回传的余额更新 ==========
    window.addEventListener('storage', function(e) {
        if (e.key === STORAGE_KEY) {
            const data = getUserData();
            applyUserData(data);
        }
    });

    // ========== 背景粒子动画 ==========
    function initParticles() {
        const canvas = document.getElementById('particles-canvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        const PARTICLE_COUNT = 50;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        function createParticle() {
            return {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1,
                opacity: Math.random() * 0.3 + 0.1,
            };
        }

        function init() {
            resize();
            particles = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particles.push(createParticle());
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach((p) => {
                // 移动
                p.x += p.vx;
                p.y += p.vy;

                // 边界回弹
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                // 绘制
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(108, 92, 231, ${p.opacity})`;
                ctx.fill();
            });

            // 绘制连线
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(108, 92, 231, ${0.06 * (1 - dist / 150)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', resize);
        init();
        draw();
    }

    // ========== 初始化 ==========
    initUser();
    renderGames();
    initParticles();
})();
