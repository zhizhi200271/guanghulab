// ===== script.js =====
// 知秋：主逻辑·动态渲染+loading+错误处理+i18n+无障碍

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
        console.log("【知秋】M22公告栏·环节6启动");
        
        // 监听语言切换事件
        window.addEventListener('languagechange', () => {
            render();  // 语言变了，重新渲染
        });

        await loadBulletins();       // 加载数据
        render();                    // 初次渲染
        setupEventListeners();       // 频道切换事件
        setupLangSwitcher();         // 语言切换器事件
        setupKeyboardNavigation();   // 键盘导航
    }

    // 语言切换器
    function setupLangSwitcher() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                window.i18n.switchLang(lang);
                // 更新按钮激活状态
                document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        // 设置当前语言按钮激活状态
        const currentLang = window.i18n.currentLang;
        document.querySelectorAll('.lang-btn').forEach(btn => {
            if (btn.dataset.lang === currentLang) {
                btn.classList.add('active');
            }
        });
    }

        // 键盘导航
    function setupKeyboardNavigation() {
        // 给每个频道标签加上键盘事件
        const tabs = document.querySelectorAll('.channel-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('keydown', (e) => {
                const currentIndex = Array.from(tabs).findIndex(t => t === e.target);
                
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const nextIndex = (currentIndex + 1) % tabs.length;
                    tabs[nextIndex].focus();
                    // 自动激活聚焦的标签
                    tabs[nextIndex].click();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    tabs[prevIndex].focus();
                    // 自动激活聚焦的标签
                    tabs[prevIndex].click();
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.target.click();
                }
            });
        });

        // 也可以保留原来的 channel-bar 监听作为备用
        const channelBar = document.querySelector('.channel-bar');
        if (channelBar) {
            channelBar.addEventListener('keydown', (e) => {
                // 防止重复处理
                if (e.target.classList.contains('channel-tab')) return;
                
                const tabs = Array.from(document.querySelectorAll('.channel-tab'));
                const currentIndex = tabs.findIndex(tab => tab === document.activeElement);
                
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const nextIndex = (currentIndex + 1) % tabs.length;
                    tabs[nextIndex].focus();
                    tabs[nextIndex].click();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    tabs[prevIndex].focus();
                    tabs[prevIndex].click();
                }
            });
        }
    }
    // 加载公告（核心！）
    async function loadBulletins() {
        loading = true;
        error = null;
        render();  // 显示loading

        try {
            const data = await API.fetchBulletins();
            allBulletins = data;
            loading = false;
            render();
        } catch (err) {
            console.error("加载失败：", err);
            loading = false;
            error = "error";
            render();
        }
    }

    // 渲染公告列表
    function render() {
        if (!container) return;

        // 加载状态
        if (loading) {
            container.innerHTML = `
                <div class="loading-state" role="status" aria-live="polite">
                    <div class="spinner"></div>
                    <p>${window.i18n.t('loading')}</p>
                </div>
            `;
            return;
        }

        // 错误状态
        if (error) {
            const isOffline = !navigator.onLine;
            const offlineHint = isOffline ? window.i18n.t('offline') : '';
            
            container.innerHTML = `
                <div class="error-state" role="alert">
                    <p>😢 ${offlineHint}${window.i18n.t('error')}</p>
                    <button class="retry-btn" id="retryBtn">${window.i18n.t('retry')}</button>
                </div>
            `;
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
                <div class="empty-state" role="status">
                    <p>${window.i18n.t('empty')}</p>
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
                <div class="empty-state" role="status">
                    <p>${window.i18n.t('emptyChannel')}</p>
                </div>
            `;
            return;
        }

        // 使用环节4的createCard（如果不存在就降级）
        let html = '';
        filtered.forEach((item, index) => {
            if (typeof createCard === 'function') {
                html += createCard(item);
            } else {
                // 降级方案（保证显示）
                html += `
                    <div class="bulletin-card" role="listitem" tabindex="0" aria-label="${item.title}">
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
                channelTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                currentChannel = e.target.dataset.channel || '全部';
                render();
            });
        });
    }

    // 启动一切
    init();
})();
