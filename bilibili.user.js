// ==UserScript==
// @name         哔哩哔哩广告全面屏蔽 & 导航精简
// @version      3.2
// @description  屏蔽视频底部广告/活动横幅、侧边栏广告及底部推广、推荐流广告视频、小型广告卡片、视频底部标签、首页轮播、花生平台广告、直播页广告等，完全避开评论区，带UI开关控制，并支持导航栏精简
// @author       MRBANK
// @match        *://*.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置管理 =================
    const CONFIG_KEY = 'bilibili_purifier_config';
    const defaultConfig = {
        bottomBanner: true,    // 1. 视频底部广告横幅
        sideAd: true,          // 2. 侧边栏广告（右侧浮动）
        rightBottomAd: true,   // 3. 侧边栏底部推广
        smallAdCard: true,     // 4. 小型广告卡片
        feedAdVideo: true,     // 5. 推荐流广告视频
        videoTag: true,        // 6. 视频底部标签
        activityBanner: true,  // 7. 视频底部活动横幅
        homeCarouselAd: false, // 8. 首页轮播广告（默认关闭）
        huashengBanner: true,  // 9. 投稿菜单花生横幅
        btnAd: true,           // 10. 创作页按钮广告
        liveBannerAd: true,    // 11. 直播间轮播广告

        // --- 导航栏精简 ---
        hideAnime: false,      // 番剧
        hideLive: false,       // 直播
        hideGameCenter: false, // 游戏中心
        hideMall: false,       // 会员购
        hideManga: false,      // 漫画
        hideMatch: false,      // 赛事
        hideDownload: false,   // 下载客户端
        hideVip: false         // 大会员
    };

    const configStructure = [
        {
            groupName: "广告与推广",
            items: [
                { key: 'bottomBanner', label: '视频底部广告横幅' },
                { key: 'sideAd', label: '侧边栏广告（浮动）' },
                { key: 'rightBottomAd', label: '侧边栏底部推广' },
                { key: 'smallAdCard', label: '小型广告卡片' },
                { key: 'feedAdVideo', label: '推荐流广告视频' },
                { key: 'homeCarouselAd', label: '首页轮播广告' },
                { key: 'huashengBanner', label: '投稿菜单花生横幅' },
                { key: 'btnAd', label: '创作页按钮广告' },
                { key: 'liveBannerAd', label: '直播间轮播广告' }
            ]
        },
        {
            groupName: "页面元素精简",
            items: [
                { key: 'videoTag', label: '视频底部标签' },
                { key: 'activityBanner', label: '视频底部活动横幅' }
            ]
        },
        {
            groupName: "导航栏精简 (左侧+右侧)",
            items: [
                { key: 'hideAnime', label: '隐藏 番剧' },
                { key: 'hideLive', label: '隐藏 直播' },
                { key: 'hideGameCenter', label: '隐藏 游戏中心' },
                { key: 'hideMall', label: '隐藏 会员购' },
                { key: 'hideManga', label: '隐藏 漫画' },
                { key: 'hideMatch', label: '隐藏 赛事' },
                { key: 'hideDownload', label: '隐藏 下载客户端' },
                { key: 'hideVip', label: '隐藏 大会员' }
            ]
        }
    ];

    function getConfig() {
        let saved = localStorage.getItem(CONFIG_KEY);
        if (saved) {
            try {
                let oldCfg = JSON.parse(saved);
                if (oldCfg.leftBanner !== undefined && oldCfg.bottomBanner === undefined) {
                    oldCfg.bottomBanner = oldCfg.leftBanner;
                    delete oldCfg.leftBanner;
                    localStorage.setItem(CONFIG_KEY, JSON.stringify(oldCfg));
                }
                return {...defaultConfig, ...oldCfg};
            }
            catch(e) { return {...defaultConfig}; }
        }
        return {...defaultConfig};
    }

    function saveConfig(cfg) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    }

    // ================= 油猴菜单与设置 UI =================
    let isPanelOpen = false;
    let needReload = false;

    function openSettingsPanel() {
        if (isPanelOpen) return;
        isPanelOpen = true;
        needReload = false;

        const style = document.createElement('style');
        style.id = 'bp-settings-style';
        style.textContent = `
            #bp-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 999998; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
            #bp-modal { background: #fff; width: 380px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); overflow: hidden; display: flex; flex-direction: column; }
            #bp-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #e8e8e8; }
            #bp-header h3 { margin: 0; font-size: 16px; color: #333; }
            #bp-close-btn { background: none; border: none; font-size: 20px; color: #999; cursor: pointer; line-height: 1; padding: 0; }
            #bp-close-btn:hover { color: #333; }
            #bp-body { padding: 10px 0; max-height: 70vh; overflow-y: auto; }
            .bp-group-title { padding: 10px 20px 5px; margin: 0; font-size: 13px; color: #888; font-weight: 500; }
            .bp-switch-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; font-size: 14px; color: #333; transition: background 0.2s; }
            .bp-switch-row:hover { background: #fff1f5; }
            .bp-switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
            .bp-switch input { opacity: 0; width: 0; height: 0; }
            .bp-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 22px; }
            .bp-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .bp-switch input:checked + .bp-slider { background-color: #FB7299; }
            .bp-switch input:checked + .bp-slider:before { transform: translateX(18px); }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'bp-overlay';
        const modal = document.createElement('div');
        modal.id = 'bp-modal';
        const header = document.createElement('div');
        header.id = 'bp-header';
        const title = document.createElement('h3');
        title.textContent = 'B站净化器 - 设置';
        const closeBtn = document.createElement('button');
        closeBtn.id = 'bp-close-btn';
        closeBtn.textContent = '✕';
        header.appendChild(title);
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.id = 'bp-body';
        const cfg = getConfig();

        configStructure.forEach(group => {
            const groupTitle = document.createElement('div');
            groupTitle.className = 'bp-group-title';
            groupTitle.textContent = group.groupName;
            body.appendChild(groupTitle);

            group.items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'bp-switch-row';
                const label = document.createElement('span');
                label.textContent = item.label;
                const switchContainer = document.createElement('label');
                switchContainer.className = 'bp-switch';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = cfg[item.key];
                input.dataset.key = item.key;
                const slider = document.createElement('span');
                slider.className = 'bp-slider';
                switchContainer.appendChild(input);
                switchContainer.appendChild(slider);
                row.appendChild(label);
                row.appendChild(switchContainer);
                body.appendChild(row);

                input.addEventListener('change', (e) => {
                    const currentCfg = getConfig();
                    currentCfg[e.target.dataset.key] = e.target.checked;
                    saveConfig(currentCfg);
                    needReload = true;
                });
            });
        });

        modal.appendChild(header);
        modal.appendChild(body);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closePanel = () => {
            document.body.removeChild(overlay);
            document.head.removeChild(style);
            isPanelOpen = false;
            if (needReload) location.reload();
        };

        closeBtn.addEventListener('click', closePanel);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePanel();
        });
    }

    GM_registerMenuCommand('🧹 B站净化器设置', openSettingsPanel);


    // ================= 核心屏蔽逻辑 =================

    // 广告选择器
    const BOTTOM_BANNER_AD_SELECTOR = 'a.ad-report-inner[href*="cm.bilibili.com"], a.strip-ad[href*="cm.bilibili.com"], div.ad-report.strip-ad a[href*="cm.bilibili.com"]';
    const SIDE_AD_SELECTOR = '#slide_ad, .slide-ad-exp';
    const RIGHT_BOTTOM_AD_SELECTOR = 'div.ad-report.ad-floor-exp, div.right-bottom-banner';
    const SMALL_AD_CARD_SELECTOR = '.video-card-ad-small';
    const FEED_CONTAINER_SELECTOR = '.bili-feed4, .feed-list, .bili-video-card-list, .recommend-container, .video-page-special';
    const VIDEO_TAG_SELECTOR = '.video-tag-container';
    const ACTIVITY_BANNER_SELECTOR = '.inside-wrp';
    const HOME_CAROUSEL_AD_SELECTOR = 'div.recommended-swipe';
    const HUASHENG_BANNER_SELECTOR = 'a.upload-huasheng-banner';
    const BTN_AD_SELECTOR = 'div.btn-ad';
    // 直播间轮播广告：精确匹配包含特定数据类型的翻转容器，避免误伤
    const LIVE_BANNER_AD_SELECTOR = 'div.flip-view:has(div[data-type="liveroom_banner_show"])';

    // --- 导航栏选择器 ---
    const NAV_ANIME_SELECTOR = 'li.v-popover-wrap:has(a.default-entry[href*="anime"])';
    const NAV_LIVE_SELECTOR = 'li.v-popover-wrap:has(a.default-entry[href*="live.bilibili"])';
    const NAV_GAME_SELECTOR = 'li.v-popover-wrap:has(a.default-entry[href*="game.bilibili"])';
    const NAV_MALL_SELECTOR = 'li.v-popover-wrap:has(a.default-entry[href*="show.bilibili"])';
    const NAV_MANGA_SELECTOR = 'li.v-popover-wrap:has(a.default-entry[href*="manga.bilibili"])';
    const NAV_MATCH_SELECTOR = 'li.v-popover-wrap:has(a.default-entry[href*="match"])';
    const NAV_DOWNLOAD_SELECTOR = 'li.v-popover-wrap:has(a.download-client-trigger)';
    const NAV_VIP_SELECTOR = 'div.vip-wrap';

    // 评论区根容器（绝不处理）
    const COMMENT_ROOT_SELECTOR = '#comment-area, .comment-list-holder, .reply-list, .comment-container, .comment-list, .bili-comment';

    const HIDE_MARKER = 'data-ad-hidden';

    function isInsideCommentArea(element) {
        if (!element) return false;
        let node = element;
        while (node && node !== document.body) {
            if (node.nodeType === Node.ELEMENT_NODE && node.matches && node.matches(COMMENT_ROOT_SELECTOR)) {
                return true;
            }
            node = node.parentElement;
        }
        return false;
    }

    // 验证是否为活动横幅
    function isActivityBanner(el) {
        return el.querySelector('.hinter-msg') && el.querySelector('.inside-bg');
    }

    // 通用隐藏逻辑
    function checkAndHide(selector, configKey) {
        const cfg = getConfig();
        if (!cfg[configKey]) return;
        document.querySelectorAll(selector).forEach(el => {
            if (!isInsideCommentArea(el) && el.getAttribute(HIDE_MARKER) !== 'true') {
                el.style.display = 'none';
                el.setAttribute(HIDE_MARKER, 'true');
            }
        });
    }

    // ================= 强化：推荐流广告视频识别 =================
    function isAdVideoCard(card) {
        const adLink = card.querySelector('a[href*="cm.bilibili.com"]');
        if (adLink) return true;

        if (card.dataset && card.dataset.isAd !== undefined) return true;
        if (card.classList.contains('is-ad')) return true;

        const statsContainer = card.querySelector('.bili-video-card__stats') ||
                               card.querySelector('.bili-video-card__image .bili-video-card__mask') ||
                               card.querySelector('.feed-card-statistics');
        if (statsContainer) {
            const spans = statsContainer.querySelectorAll('span');
            for (let span of spans) {
                if (/广告|推广|AD|赞助/i.test(span.textContent.trim())) {
                    return true;
                }
            }
        }

        const imageWrap = card.querySelector('.bili-video-card__image') || card.querySelector('.feed-card-image');
        if (imageWrap) {
            const cornerTags = imageWrap.querySelectorAll('span[class*="ad"], span[class*="sponsor"], span[class*="promote"]');
            for (let tag of cornerTags) {
                if (/广告|推广|AD/i.test(tag.textContent.trim())) {
                    return true;
                }
            }
        }

        return false;
    }

    function hideVideoAdsInRecommended() {
        if (!getConfig().feedAdVideo) return;
        const containers = document.querySelectorAll(FEED_CONTAINER_SELECTOR);
        containers.forEach(container => {
            if (isInsideCommentArea(container)) return;
            const cards = container.querySelectorAll('.bili-video-card, .feed-card, .video-card');
            cards.forEach(card => {
                if (!isInsideCommentArea(card) && isAdVideoCard(card)) {
                    if (card.getAttribute(HIDE_MARKER) === 'true') return;
                    card.style.display = 'none';
                    card.setAttribute(HIDE_MARKER, 'true');
                }
            });
        });
    }

    // 统一清理入口
    function fullClean() {
        checkAndHide(BOTTOM_BANNER_AD_SELECTOR, 'bottomBanner');
        checkAndHide(SIDE_AD_SELECTOR, 'sideAd');
        checkAndHide(RIGHT_BOTTOM_AD_SELECTOR, 'rightBottomAd');
        checkAndHide(SMALL_AD_CARD_SELECTOR, 'smallAdCard');
        checkAndHide(VIDEO_TAG_SELECTOR, 'videoTag');
        checkAndHide(HOME_CAROUSEL_AD_SELECTOR, 'homeCarouselAd');
        checkAndHide(HUASHENG_BANNER_SELECTOR, 'huashengBanner');
        checkAndHide(BTN_AD_SELECTOR, 'btnAd');
        checkAndHide(LIVE_BANNER_AD_SELECTOR, 'liveBannerAd');

        // 活动横幅需特征双重验证
        if (getConfig().activityBanner) {
            document.querySelectorAll(ACTIVITY_BANNER_SELECTOR).forEach(wrp => {
                if (isActivityBanner(wrp) && !isInsideCommentArea(wrp) && wrp.getAttribute(HIDE_MARKER) !== 'true') {
                    wrp.style.display = 'none';
                    wrp.setAttribute(HIDE_MARKER, 'true');
                }
            });
        }

        hideVideoAdsInRecommended();

        // --- 清理导航栏元素 ---
        checkAndHide(NAV_ANIME_SELECTOR, 'hideAnime');
        checkAndHide(NAV_LIVE_SELECTOR, 'hideLive');
        checkAndHide(NAV_GAME_SELECTOR, 'hideGameCenter');
        checkAndHide(NAV_MALL_SELECTOR, 'hideMall');
        checkAndHide(NAV_MANGA_SELECTOR, 'hideManga');
        checkAndHide(NAV_MATCH_SELECTOR, 'hideMatch');
        checkAndHide(NAV_DOWNLOAD_SELECTOR, 'hideDownload');
        checkAndHide(NAV_VIP_SELECTOR, 'hideVip');
    }

    // 处理动态新增节点
    function processNewNode(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (isInsideCommentArea(node)) return;

        checkAndHide(BOTTOM_BANNER_AD_SELECTOR, 'bottomBanner');
        checkAndHide(SIDE_AD_SELECTOR, 'sideAd');
        checkAndHide(RIGHT_BOTTOM_AD_SELECTOR, 'rightBottomAd');
        checkAndHide(SMALL_AD_CARD_SELECTOR, 'smallAdCard');
        checkAndHide(VIDEO_TAG_SELECTOR, 'videoTag');
        checkAndHide(HOME_CAROUSEL_AD_SELECTOR, 'homeCarouselAd');
        checkAndHide(HUASHENG_BANNER_SELECTOR, 'huashengBanner');
        checkAndHide(BTN_AD_SELECTOR, 'btnAd');
        checkAndHide(LIVE_BANNER_AD_SELECTOR, 'liveBannerAd');

        if (getConfig().activityBanner) {
            const checkActivity = (el) => {
                if (isActivityBanner(el) && !isInsideCommentArea(el) && el.getAttribute(HIDE_MARKER) !== 'true') {
                    el.style.display = 'none';
                    el.setAttribute(HIDE_MARKER, 'true');
                }
            };
            checkActivity(node);
            if (node.querySelectorAll) {
                node.querySelectorAll(ACTIVITY_BANNER_SELECTOR).forEach(wrp => checkActivity(wrp));
            }
        }

        // 广告视频卡片检查优化
        const cfg = getConfig();
        if (cfg.feedAdVideo) {
            let needScanVideo = false;
            if (node.matches && (node.matches('.bili-video-card') || node.matches('.feed-card') || node.matches(FEED_CONTAINER_SELECTOR))) {
                needScanVideo = true;
            } else if (node.querySelector && (node.querySelector('.bili-video-card') || node.querySelector('.feed-card') || node.querySelector(FEED_CONTAINER_SELECTOR))) {
                needScanVideo = true;
            }
            if (needScanVideo) {
                setTimeout(() => hideVideoAdsInRecommended(), 80);
            }
        }

        // --- 动态节点导航栏检查 ---
        checkAndHide(NAV_ANIME_SELECTOR, 'hideAnime');
        checkAndHide(NAV_LIVE_SELECTOR, 'hideLive');
        checkAndHide(NAV_GAME_SELECTOR, 'hideGameCenter');
        checkAndHide(NAV_MALL_SELECTOR, 'hideMall');
        checkAndHide(NAV_MANGA_SELECTOR, 'hideManga');
        checkAndHide(NAV_MATCH_SELECTOR, 'hideMatch');
        checkAndHide(NAV_DOWNLOAD_SELECTOR, 'hideDownload');
        checkAndHide(NAV_VIP_SELECTOR, 'hideVip');
    }

    // MutationObserver 监听页面变化
    const observer = new MutationObserver(mutations => {
        let hasAddedNodes = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => processNewNode(node));
                hasAddedNodes = true;
            }
        }
        if (hasAddedNodes) {
            setTimeout(() => {
                fullClean();
            }, 150);
        }
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    // SPA 路由变化辅助
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(fullClean, 300);
        }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    // 启动清理
    fullClean();

})();