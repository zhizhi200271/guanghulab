// ===== script.js =====
// 知秋：主逻辑·动态渲染+loading+错误处理

(function() {
    // 状态变量
    let allBulletins = [];          // 所有公告（从API拿）
    let currentChannel = '全部';     // 当前频道（默认全部）
    let loading = false;            // 是否正在加载
    let error = null;               // 错误信息

    // DOM元素
    const container = document.querySelector('.bulletin-container');
    const channelTabs = document.querySelectorAll('.channel-tab');

    // 初始化
    async function init() {
        console.log("【知秋】M22公告栏·环节5启动");
        await loadBulletins();       // 加载数据
        render();                    // 初次渲染
        setupEventListeners();       // 事件监听
    }

    // 加载公告（核心！）
    async function loadBulletins() {
        loading = true;
        error = null;
        render();  // 显示loading

        try {
            // 知秋：调用API.fetchBulletins拿数据
            const data = await API.fetchBulletins();
            allBulletins = data;
            loading = false;
            render();
        } catch (err) {
            console.error("加载失败：", err);
            loading = false;
            error = "网络开小差了，稍后重试～";
            render();
        }
    }

    // 渲染公告列表（使用环节4的createCard组件）
    function render() {
        if (!container) return;

        // 加载状态
        if (loading) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>知秋正在飞向服务器……</p>
                </div>
            `;
            return;
        }

                // 错误状态
        if (error) {
            // 检查是否离线（断网）
            const isOffline = !navigator.onLine;
            const offlineHint = isOffline ? '📴 离线模式 · ' : '';
            
            container.innerHTML = `
                <div class="error-state">
                    <p>😢 ${offlineHint}${error}</p>
                    <button class="retry-btn" id="retryBtn">重试</button>
                </div>
            `;
            // 重试按钮事件（用事件委托，但这里直接绑一下）
            const retryBtn = document.getElementById('retryBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    loadBulletins();
                });
            }
            return;
        }

        // 空数据状态
        if (allBulletins.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>✨ 暂无公告，稍后再来看看～</p>
                </div>
            `;
            return;
        }

        // 正常渲染：根据频道筛选
        const filtered = currentChannel === '全部'
            ? allBulletins
            : allBulletins.filter(item => item.channel === currentChannel);

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>📭 这个频道暂时没有公告</p>
                </div>
            `;
            return;
        }

        // 使用环节4的createCard（如果不存在就降级）
        let html = '';
        filtered.forEach(item => {
            if (typeof createCard === 'function') {
                html += createCard(item);
            } else {
                // 降级方案（保证显示）
                html += `
                    <div class="bulletin-card">
                        <h3>${item.title}</h3>
                        <p>${item.content}</p>
                        <div class="meta">
                            <span class="channel">${item.channel}</span>
                            <span class="date">${item.date}</span>
                        </div>
                    </div>
                `;
            }
        });
        container.innerHTML = html;
    }

    // 事件监听（频道切换）
    function setupEventListeners() {
        channelTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // 移除所有active
                channelTabs.forEach(t => t.classList.remove('active'));
                // 当前加active
                e.target.classList.add('active');
                // 更新频道
                currentChannel = e.target.dataset.channel || '全部';
                // 重新渲染（不用再加载数据，用已有的allBulletins）
                render();
            });
        });
    }

    // 启动一切
    init();
})();