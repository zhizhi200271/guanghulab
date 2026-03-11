<<<<<<< HEAD
﻿// ========== 确保 HoloLake 命名空间存在 ==========
window.HoloLake = window.HoloLake || {};

// ========== 页面加载完成后执行 ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 script.js 初始化');
    
    // 恢复所有状态
    restoreState();
    
    // 绑定事件
    bindEvents();
    
    // 更新布局信息
    updateLayoutInfo();
    
    // 监听窗口大小变化
    window.addEventListener('resize', function() {
        updateLayoutInfo();
    });
});

// ========== 恢复状态 ==========
function restoreState() {
    console.log('🔍 restoreState 开始...');
    
    try {
        // 1. 恢复订阅状态
        const isSubscribed = HoloLake.UserState.isSubscribed();
        const subscribeBtn = document.querySelector('.subscribe-btn');
        if (subscribeBtn) {
            if (isSubscribed) {
                subscribeBtn.classList.add('active');
                subscribeBtn.textContent = '已订阅';
            } else {
                subscribeBtn.classList.remove('active');
                subscribeBtn.textContent = '订阅';
            }
        }
        
        // 2. 恢复已读公告
        const readList = HoloLake.UserState.getReadBulletins();
        const bulletinCards = document.querySelectorAll('.bulletin-card');
        bulletinCards.forEach((card, index) => {
            const bulletinId = `bulletin-${index}`;
            if (readList.includes(bulletinId)) {
                card.classList.add('read');
            }
        });
        
        // 3. 恢复选中频道
        const activeChannel = HoloLake.UserState.getActiveChannel();
        const channels = document.querySelectorAll('.channel');
        channels.forEach(channel => {
            const channelText = channel.textContent.trim();
            if (channelText === activeChannel || (activeChannel === '全部' && channelText === '全部')) {
                channel.classList.add('active');
            } else {
                channel.classList.remove('active');
            }
        });
        
        // 4. 更新最后访问时间
        HoloLake.UserState.updateLastVisit();
        
        console.log('✅ 恢复已完成');
    } catch (e) {
        console.error('❌ 恢复失败:', e);
    }
}

// ========== 绑定事件 ==========
function bindEvents() {
    console.log('🔗 绑定事件...');
    
    // 订阅按钮
    const subscribeBtn = document.querySelector('.subscribe-btn');
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', function() {
            const newState = HoloLake.UserState.toggleSubscribe();
            if (newState) {
                this.classList.add('active');
                this.textContent = '已订阅';
            } else {
                this.classList.remove('active');
                this.textContent = '订阅';
            }
            console.log('📌 订阅状态:', newState ? '已订阅' : '未订阅');
        });
    }
    
    // 频道点击
    const channels = document.querySelectorAll('.channel');
    channels.forEach(channel => {
        channel.addEventListener('click', function() {
            // 更新UI
            channels.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            // 保存状态
            const channelName = this.textContent.trim();
            HoloLake.UserState.setActiveChannel(channelName);
            
            // 筛选公告（可选功能，这里先做简单筛选）
            filterBulletinsByChannel(channelName);
            
            console.log('📺 切换到频道:', channelName);
        });
    });
    
    // 公告点击（标记已读）
    const bulletinCards = document.querySelectorAll('.bulletin-card');
    bulletinCards.forEach((card, index) => {
        card.addEventListener('click', function() {
            const bulletinId = `bulletin-${index}`;
            
            // 标记已读
            if (!this.classList.contains('read')) {
                this.classList.add('read');
                HoloLake.UserState.markAsRead(bulletinId);
                console.log('📖 已读公告:', bulletinId);
            }
        });
    });
}

// ========== 按频道筛选 ==========
function filterBulletinsByChannel(channelName) {
    const cards = document.querySelectorAll('.bulletin-card');
    
    if (channelName === '全部') {
        cards.forEach(card => {
            card.style.display = 'flex';
        });
        return;
    }
    
    cards.forEach(card => {
        const tag = card.querySelector('.bulletin-tag');
        if (tag && tag.textContent.trim() === channelName) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// ========== 更新布局信息 ==========
function updateLayoutInfo() {
    const width = window.innerWidth;
    let mode = '桌面';
    
    if (width <= 480) {
        mode = '手机';
    } else if (width <= 768) {
        mode = '平板';
    }
    
    console.log(`📱 当前布局: ${mode}模式 (${width}px)`);
}
=======
﻿// ===== script.js =====
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
>>>>>>> origin/main
