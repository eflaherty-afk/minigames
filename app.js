/**
 * 🎮 小游戏大厅 - 主逻辑
 */
(function () {
    'use strict';

    // ========== DOM 元素 ==========
    const gamesGrid = document.getElementById('gamesGrid');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const filterTags = document.getElementById('filterTags');
    const gameCountEl = document.getElementById('gameCount');

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

        // 更新计数
        gameCountEl.textContent = `${filtered.length} 款游戏`;

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
            <div class="game-card" style="animation-delay: ${index * 0.06}s" onclick="window.open('${game.url}', '_blank')">
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
                        <button class="game-card-play" onclick="event.stopPropagation(); window.open('${game.url}', '_blank')">
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
    renderGames();
    initParticles();
})();
