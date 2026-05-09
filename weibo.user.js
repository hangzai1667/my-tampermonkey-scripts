// ==UserScript==
// @name         微博净化器·内容屏蔽助手
// @namespace    http://tampermonkey.net/
// @version      7.1
// @description  信息流屏蔽+正文屏蔽+导航屏蔽+侧边栏屏蔽+评论用户屏蔽（完整线程）+自定义分组屏蔽+广告图片屏蔽+搜索页横幅广告屏蔽
// @author       MRBANK
// @match        https://weibo.com/*
// @match        https://*.weibo.com/*
// @icon         https://weibo.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license      MIT
// @downloadURL  https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/weibo.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/weibo.user.js

// ==/UserScript==

(function() {
    'use strict';

    // ================== 配置管理 ==================
    const CONFIG = {
        // 功能开关
        blockAds: GM_getValue('blockAds', true),
        blockImages: GM_getValue('blockImages', true),
        blockTopNav: GM_getValue('blockTopNav', true),
        blockAdImages: GM_getValue('blockAdImages', true),
        blockSearchBannerAds: GM_getValue('blockSearchBannerAds', false), // 搜索页横幅图片广告独立开关，默认关闭
        debugMode: GM_getValue('debugMode', false),

        // 信息流标签关键词（可增删）
        blockKeywords: GM_getValue('blockKeywords', [
            { text: '荐读', enabled: true },
            { text: '推荐', enabled: true },
            { text: '公益', enabled: true },
            { text: '广告', enabled: true }
        ]),

        // 正文关键词（可增删，默认空数组）
        contentKeywords: GM_getValue('contentKeywords', []),

        // 顶部导航屏蔽关键词（固定预设，不可增删）
        topNavKeywords: GM_getValue('topNavKeywords', [
            { text: '首页', enabled: false },
            { text: '消息', enabled: false },
            { text: '推荐', enabled: true },
            { text: '视频', enabled: true },
            { text: '游戏', enabled: true },
            { text: '无障碍', enabled: true }
        ]),

        // 侧边栏模块固定预设（用户不可增删，仅可开关）
        sidebarModules: GM_getValue('sidebarModules', [
            { text: '你可能感兴趣的人', enabled: false },
            { text: '创作者中心', enabled: false },
            { text: '微博热搜', enabled: false },
            { text: '自定义分组', enabled: false },
            { text: '底部信息', enabled: false }
        ]),

        // 评论用户屏蔽（可增删）
        blockCommentUsers: GM_getValue('blockCommentUsers', []),

        // 广告图片域名屏蔽（可增删，基于图片src域名匹配整个广告容器）
        adImageDomains: GM_getValue('adImageDomains', [
            { text: 'kadmimage.biz.weibo.com', enabled: true }
        ]),

        // 性能配置
        observerDelay: 50,
        scrollThrottle: 500,
        batchSize: 10,

        // 选择器配置（已适配新版微博 + 搜索页，移除 wrap-continuous 避免连带隐藏）
        selectors: {
            feedItem: 'article.Feed_wrap_3v9LH.Feed_normal_12A98, article:has(.wbpro-feed-content), article[class*="woo-panel"], div.card-wrap[action-type="feed_list_item"]',
            tagContainer: '.wbpro-tag div, .wbpro-tag, p.from > span',
            feedContent: '[class*="_wbtext_"], [class*="Feed_content"] [class*="txt"], [class*="content"] [class*="txt"], p.txt',
            sidebarModule: '.wbpro-side',
            sidebarTitle: '.wbpro-side-tit .f16.fm.cla'
        }
    };

    // ================== 临时配置（用于弹窗编辑）==================
    let TEMP_CONFIG = JSON.parse(JSON.stringify(CONFIG));

    // ================== 工具函数 ==================
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function log(message, type = 'info', data = null) {
        if (!CONFIG.debugMode && type !== 'error') return;
        const prefix = '【微博屏蔽 v6.9】';
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'error': console.error(`${prefix}[${timestamp}]`, message, data || ''); break;
            case 'warn': console.warn(`${prefix}[${timestamp}]`, message, data || ''); break;
            case 'success': console.log(`%c${prefix}[${timestamp}] ${message}`, 'color: green', data || ''); break;
            default: console.log(`${prefix}[${timestamp}]`, message, data || '');
        }
    }

    const performanceMonitor = {
        stats: {
            blockedItems: 0,
            blockedImages: 0,
            blockedSidebars: 0,
            blockedTopNav: 0,
            blockedComments: 0,
            blockedAdImages: 0,
            executionTime: 0
        },
        start() { return performance.now(); },
        end(startTime, operation) {
            const duration = performance.now() - startTime;
            this.stats.executionTime += duration;
            if (CONFIG.debugMode) log(`${operation} 耗时: ${duration.toFixed(2)}ms`, 'info');
        },
        report() { log('性能统计', 'success', this.stats); }
    };

    // ================== 核心屏蔽功能 ==================
    function injectStyles() {
        let adImageCSS = '';
        if (CONFIG.blockAdImages) {
            const domains = CONFIG.adImageDomains.filter(d => d.enabled).map(d => d.text);
            domains.forEach(domain => {
                adImageCSS += `img[src*="${domain}"] { display: none !important; visibility: hidden !important; opacity: 0 !important; }\n`;
            });
        }

        const styles = `
            ${CONFIG.blockImages ? `
                img[src*="shuakong"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    width: 0 !important;
                    height: 0 !important;
                }
            ` : ''}
            ${adImageCSS}
            .weibo-ad-blocked, .weibo-topnav-blocked, .weibo-sidebar-blocked, .weibo-comment-blocked, .weibo-ad-image-blocked { display: none !important; }
            .weibo-content-blocked {
                overflow: hidden !important;
            }
            .weibo-content-blocked header,
            .weibo-content-blocked footer,
            .weibo-content-blocked [class*="_head_"],
            .weibo-content-blocked [class*="_header_"],
            .weibo-content-blocked [class*="_info_"],
            .weibo-content-blocked [class*="_suffixbox_"],
            .weibo-content-blocked [class*="_content_wrap_"],
            .weibo-content-blocked [class*="_followbtn_"],
            .weibo-content-blocked [class*="_more_"],
            .weibo-content-blocked .woo-avatar-main,
            .weibo-content-blocked .woo-avatar-hover,
            .weibo-content-blocked .woo-avatar-img,
            .weibo-content-blocked .woo-button-main,
            .weibo-content-blocked [class*="_left_"],
            .weibo-content-blocked [class*="_main_"][class*="198pe"],
            .weibo-content-blocked [class*="_item_"],
            .weibo-content-blocked [class*="_wrap_"][class*="198pe"],
            .weibo-content-blocked [class*="_iconWrap_"],
            .weibo-content-blocked .woo-like-main,
            .weibo-content-blocked .woo-like-count,
            .weibo-content-blocked .woo-font--retweet,
            .weibo-content-blocked .woo-font--comment {
                display: none !important;
            }
            .weibo-content-blocked .wbpro-feed-content,
            .weibo-content-blocked [class*="_placebox_"],
            .weibo-content-blocked .picture,
            .weibo-content-blocked video,
            .weibo-content-blocked [class*="_row_"],
            .weibo-content-blocked [class*="_ogText_"],
            .weibo-content-blocked .retweet,
            .weibo-content-blocked [class*="_retweet_"],
            .weibo-content-blocked [class*="_reText_"],
            .weibo-content-blocked [class*="_retweetBar_"],
            .weibo-content-blocked [class*="_retweetHeadInfo_"] {
                display: none !important;
            }
            .weibo-content-blocked [class*="_body_"] {
                padding-bottom: 0 !important;
            }
            .weibo-content-blocked footer {
                margin-top: 0 !important;
            }
            ${CONFIG.debugMode ? `
                .weibo-ad-blocked { display: block !important; opacity: 0.3 !important; border: 2px dashed red !important; background: rgba(255,0,0,0.1) !important; }
                .weibo-topnav-blocked { display: inline-block !important; opacity: 0.3 !important; border: 2px dashed blue !important; background: rgba(0,0,255,0.1) !important; }
                .weibo-sidebar-blocked { display: block !important; opacity: 0.3 !important; border: 2px dashed green !important; background: rgba(0,255,0,0.1) !important; }
                .weibo-comment-blocked { display: block !important; opacity: 0.3 !important; border: 2px dashed purple !important; background: rgba(128,0,128,0.1) !important; }
                .weibo-ad-image-blocked { display: block !important; opacity: 0.3 !important; border: 2px dashed orange !important; background: rgba(255,165,0,0.1) !important; }
            ` : ''}
        `;
        GM_addStyle(styles);
        log('样式注入成功', 'success');
    }

    // 获取微博正文文本
    function getContentText(container) {
        try {
            let contentEl = container.querySelector('[class*="_wbtext_"]');
            if (contentEl) return contentEl.textContent.trim();
            contentEl = container.querySelector(CONFIG.selectors.feedContent);
            if (contentEl) return contentEl.textContent.trim();
            return container.textContent.trim();
        } catch (e) {
            log('获取正文文本失败', 'error', e);
            return '';
        }
    }

    function markBlockedContent(container) {
        const article = container.closest('article') || container;
        article.classList.add('weibo-content-blocked');
        return true;
    }

    // 信息流屏蔽（精准定位 action-type，避免误杀同级横幅广告）
    function processFeedItems() {
        if (!CONFIG.blockAds) return;
        const startTime = performanceMonitor.start();
        const feedItems = document.querySelectorAll(`${CONFIG.selectors.feedItem}:not([data-processed="true"])`);
        let blockedCount = 0;

        const enabledContentKeywords = CONFIG.contentKeywords.filter(kw => kw.enabled);
        const enabledTagKeywords = CONFIG.blockKeywords.filter(kw => kw.enabled);

        Array.from(feedItems).slice(0, CONFIG.batchSize).forEach(container => {
            try {
                container.setAttribute('data-processed', 'true');
                let shouldBlock = false;
                let blockReason = '';

                const isSearchCard = container.matches('div.card-wrap[action-type="feed_list_item"]');

                const tagElements = container.querySelectorAll(CONFIG.selectors.tagContainer);
                if (tagElements.length > 0) {
                    for (let i = 0; i < tagElements.length; i++) {
                        const tagText = tagElements[i].textContent.trim();
                        if (tagText) {
                            const matchedTag = enabledTagKeywords.find(kw => tagText.includes(kw.text));
                            if (matchedTag) {
                                shouldBlock = true;
                                blockReason = `标签:${matchedTag.text}`;
                                break;
                            }
                        }
                    }
                }

                if (!shouldBlock && enabledContentKeywords.length > 0) {
                    const contentText = getContentText(container);
                    if (contentText) {
                        const matchedContent = enabledContentKeywords.find(kw => contentText.includes(kw.text));
                        if (matchedContent) {
                            shouldBlock = true;
                            blockReason = `正文:${matchedContent.text}`;
                        }
                    }
                }

                if (shouldBlock) {
                    if (isSearchCard) {
                        if (!container.classList.contains('weibo-ad-blocked')) {
                            container.classList.add('weibo-ad-blocked');
                            blockedCount++;
                            performanceMonitor.stats.blockedItems++;
                            log(`屏蔽搜索页信息流: ${blockReason}`, 'success');
                        }
                    } else {
                        if (markBlockedContent(container)) {
                            blockedCount++;
                            performanceMonitor.stats.blockedItems++;
                            log(`屏蔽首页信息流: ${blockReason}`, 'success');
                        }
                    }
                }
            } catch (e) { log('处理信息流出错', 'error', e); }
        });
        if (blockedCount) log(`本次屏蔽 ${blockedCount} 条内容`, 'info');
        performanceMonitor.end(startTime, '处理信息流');
        if (feedItems.length > CONFIG.batchSize) setTimeout(processFeedItems, 50);
    }

    // 侧边栏模块屏蔽
    function processSidebarModules() {
        const startTime = performanceMonitor.start();
        let blockedCount = 0;
        try {
            const modules = document.querySelectorAll(`${CONFIG.selectors.sidebarModule}:not([data-sidebar-processed="true"])`);
            modules.forEach(module => {
                module.setAttribute('data-sidebar-processed', 'true');
                const titleEl = module.querySelector(CONFIG.selectors.sidebarTitle);
                if (!titleEl) return;
                const titleText = titleEl.textContent.trim();
                const matchedModule = CONFIG.sidebarModules.filter(m => m.enabled).find(m => titleText.includes(m.text));
                if (matchedModule && !module.classList.contains('weibo-sidebar-blocked')) {
                    module.classList.add('weibo-sidebar-blocked');
                    blockedCount++;
                    performanceMonitor.stats.blockedSidebars++;
                    log(`屏蔽侧边栏模块(标准): "${titleText}"`, 'success');
                }
            });

            const enabledModules = CONFIG.sidebarModules.filter(m => m.enabled).map(m => m.text);
            if (enabledModules.length > 0) {
                const h3Titles = document.querySelectorAll('main h3, [class*="side"] h3, [class*="Side"] h3');
                h3Titles.forEach(h3 => {
                    if (h3.hasAttribute('data-flat-processed')) return;
                    h3.setAttribute('data-flat-processed', 'true');
                    const titleText = h3.textContent.trim();
                    const matchedModule = enabledModules.find(text => titleText.includes(text));
                    if (matchedModule) {
                        const headerContainer = h3.parentElement;
                        if (headerContainer && !headerContainer.classList.contains('weibo-sidebar-blocked')) {
                            headerContainer.classList.add('weibo-sidebar-blocked');
                            blockedCount++;
                            log(`屏蔽侧边栏模块(扁平标题): "${titleText}"`, 'success');
                        }
                        let nextElement = headerContainer ? headerContainer.nextElementSibling : null;
                        while (nextElement && nextElement.tagName === 'A') {
                            if (!nextElement.classList.contains('weibo-sidebar-blocked')) nextElement.classList.add('weibo-sidebar-blocked');
                            nextElement = nextElement.nextElementSibling;
                        }
                    }
                });
            }

            const bottomInfoKeyword = CONFIG.sidebarModules.find(m => m.text === '底部信息');
            if (bottomInfoKeyword && bottomInfoKeyword.enabled) {
                document.querySelectorAll('.wbpro-side-copy:not([data-sidebar-processed="true"])').forEach(el => {
                    el.setAttribute('data-sidebar-processed', 'true');
                    if (!el.classList.contains('weibo-sidebar-blocked')) {
                        el.classList.add('weibo-sidebar-blocked');
                        blockedCount++;
                        performanceMonitor.stats.blockedSidebars++;
                        log('屏蔽侧边栏模块(底部信息)', 'success');
                    }
                });
            }
        } catch (e) { log('处理侧边栏模块出错', 'error', e); }
        if (blockedCount) log(`本次屏蔽侧边栏模块 ${blockedCount} 个`, 'info');
        performanceMonitor.end(startTime, '处理侧边栏模块');
    }

    // 顶部导航屏蔽
    function processTopNav() {
        if (!CONFIG.blockTopNav) return;
        const startTime = performanceMonitor.start();
        let blockedCount = 0;
        try {
            const gameKeyword = CONFIG.topNavKeywords.find(kw => kw.text === '游戏');
            if (gameKeyword && gameKeyword.enabled) {
                const gameLink = document.querySelector('a[title="游戏"]');
                if (gameLink) {
                    const gameBox = gameLink.closest('div[class*="_box_"]');
                    if (gameBox && !gameBox.classList.contains('weibo-topnav-blocked')) {
                        gameBox.classList.add('weibo-topnav-blocked');
                        blockedCount++;
                        performanceMonitor.stats.blockedTopNav++;
                        log('屏蔽顶部导航: 游戏（含分隔线）', 'success');
                    }
                }
            }

            const accessKeyword = CONFIG.topNavKeywords.find(kw => kw.text === '无障碍');
            if (accessKeyword && accessKeyword.enabled) {
                const accessibilityBtn = document.querySelector('button#cniil_wza');
                if (accessibilityBtn) {
                    const accessBox = accessibilityBtn.closest('div[class*="_box_"]');
                    if (accessBox && !accessBox.classList.contains('weibo-topnav-blocked')) {
                        accessBox.classList.add('weibo-topnav-blocked');
                        blockedCount++;
                        performanceMonitor.stats.blockedTopNav++;
                        log('屏蔽顶部导航: 无障碍（含分隔线）', 'success');
                    }
                }
            }

            let navRoot = document.querySelector('a[href="/hot"]')?.closest('header, nav, div[class*="woo-tab"], div[class*="header"]') || document.querySelector('.woo-tab-main, [class*="woo-tab-other"], div[class*="woo-tab"]') || document.querySelector('header');

            if (navRoot) {
                const candidates = navRoot.querySelectorAll('a[title], button[title], button:not([title]), a[aria-label], div[aria-label], a[href*="/"], #cniil_wza');
                const matchedTargets = new Set();
                candidates.forEach(el => {
                    if (el.closest('.weibo-topnav-blocked')) return;
                    let matchText = '';
                    if (el.hasAttribute('aria-label')) matchText = el.getAttribute('aria-label');
                    else if (el.hasAttribute('title') && el.getAttribute('title').trim() !== '') matchText = el.getAttribute('title');
                    else {
                        const span = el.querySelector('span:not(.woo-badge-box)');
                        matchText = span ? span.textContent.trim() : el.textContent.trim();
                    }
                    if (!matchText) return;
                    const shouldBlock = CONFIG.topNavKeywords.filter(kw => kw.enabled).some(kw => matchText.includes(kw.text));
                    if (shouldBlock) {
                        let target = el.closest('div[class*="_box_"]') || (el.tagName === 'SPAN' || el.tagName === 'SVG' || el.tagName === 'PATH' ? el.closest('a, button, div[role="button"]') || el : el);
                        if (!matchedTargets.has(target)) {
                            target.classList.add('weibo-topnav-blocked');
                            matchedTargets.add(target);
                            blockedCount++;
                            performanceMonitor.stats.blockedTopNav++;
                            log(`屏蔽顶部导航: "${matchText}"`, 'success');
                        }
                    }
                });
            }
        } catch (error) { log('处理顶部导航按钮时出错', 'error', error); }
        if (blockedCount > 0) log(`本次屏蔽顶部导航按钮 ${blockedCount} 个`, 'info');
        performanceMonitor.end(startTime, '处理顶部导航');
    }

    // 评论用户屏蔽
    function processComments() {
        const enabledUsers = CONFIG.blockCommentUsers.filter(u => u.enabled).map(u => u.text);
        if (enabledUsers.length === 0) return;
        const startTime = performanceMonitor.start();
        let blockedCount = 0;
        try {
            document.querySelectorAll('.item1 .text > a[href*="/u/"]').forEach(link => {
                const commentUnit = link.closest('.item1');
                if (!commentUnit || commentUnit.closest('.weibo-comment-blocked') || commentUnit.hasAttribute('data-comment-unit-processed')) return;
                const authorName = link.textContent.trim();
                if (enabledUsers.includes(authorName)) {
                    commentUnit.classList.add('weibo-comment-blocked');
                    commentUnit.setAttribute('data-comment-unit-processed', 'true');
                    let next = commentUnit.nextElementSibling;
                    while (next && !next.classList.contains('item1')) {
                        next.classList.add('weibo-comment-blocked');
                        next.setAttribute('data-comment-unit-processed', 'true');
                        next = next.nextElementSibling;
                    }
                    blockedCount++;
                    performanceMonitor.stats.blockedComments++;
                    log(`屏蔽评论线程: 用户 "${authorName}"`, 'success');
                } else commentUnit.setAttribute('data-comment-unit-processed', 'true');
            });
        } catch (e) { log('处理评论出错', 'error', e); }
        if (blockedCount) log(`本次屏蔽评论线程 ${blockedCount} 个`, 'info');
        performanceMonitor.end(startTime, '处理评论');
    }

    // 广告图片屏蔽
    function blockAdContainer(imgElement) {
        let adContainer = imgElement.closest('div[class*="_wrap"]') || imgElement.closest('div[class*="_bottomGap"]') || imgElement.closest('div.woo-box-flex.woo-box-alignCenter.woo-box-justifyCenter');
        if (adContainer && adContainer !== document.body && adContainer !== document.documentElement) {
            if (!adContainer.classList.contains('weibo-ad-image-blocked')) {
                adContainer.classList.add('weibo-ad-image-blocked');
                log('屏蔽广告容器 (图片域名匹配)', 'success');
                return true;
            }
            return false;
        }
        if (!imgElement.classList.contains('weibo-ad-image-blocked')) {
            imgElement.classList.add('weibo-ad-image-blocked');
            log('屏蔽广告图片 (无合适父级容器)', 'success');
            return true;
        }
        return false;
    }

    function processAdImages() {
        if (!CONFIG.blockAdImages) return;
        const startTime = performanceMonitor.start();
        let blockedCount = 0;
        const enabledDomains = CONFIG.adImageDomains.filter(d => d.enabled).map(d => d.text);
        if (enabledDomains.length === 0) { performanceMonitor.end(startTime, '处理广告图片'); return; }
        document.querySelectorAll('img:not([data-ad-img-processed])').forEach(img => {
            img.setAttribute('data-ad-img-processed', 'true');
            if (img.src && enabledDomains.some(domain => img.src.includes(domain))) {
                if (blockAdContainer(img)) { blockedCount++; performanceMonitor.stats.blockedAdImages++; }
            }
        });
        if (blockedCount) log(`本次屏蔽广告图片容器 ${blockedCount} 个`, 'info');
        performanceMonitor.end(startTime, '处理广告图片');
    }

    function setupAdImageObserver() {
        if (!CONFIG.blockAdImages) return;
        const observer = new MutationObserver(mutations => {
            const enabledDomains = CONFIG.adImageDomains.filter(d => d.enabled).map(d => d.text);
            if (enabledDomains.length === 0) return;
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                    const target = mutation.target;
                    if (target.tagName === 'IMG' && target.src) {
                        target.removeAttribute('data-ad-img-processed');
                        if (enabledDomains.some(domain => target.src.includes(domain))) {
                            target.setAttribute('data-ad-img-processed', 'true');
                            if (blockAdContainer(target)) performanceMonitor.stats.blockedAdImages++;
                        }
                    }
                }
            }
        });
        if (document.body) observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['src'] });
        else window.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['src'] }));
        log('广告图片属性监听器启动', 'success');
    }

    // ========== 搜索页横幅图片广告屏蔽（精准命中自身，不牵连父级） ==========
    function processSearchBannerAds() {
        if (!CONFIG.blockSearchBannerAds) return;
        const startTime = performanceMonitor.start();
        let blockedCount = 0;
        try {
            document.querySelectorAll('div.card-pic-a:not([data-search-ad-processed])').forEach(iconContainer => {
                iconContainer.setAttribute('data-search-ad-processed', 'true');
                const icon = iconContainer.querySelector('i[style*="simg.s.weibo.com/imgtool"]');
                if (icon) {
                    // 修复：直接隐藏 card-pic-a 容器，不向上寻找 wrap-continuous，避免连带隐藏微博
                    if (!iconContainer.classList.contains('weibo-ad-blocked')) {
                        iconContainer.classList.add('weibo-ad-blocked');
                        blockedCount++;
                        performanceMonitor.stats.blockedItems++;
                        log('屏蔽搜索页横幅广告', 'success');
                    }
                }
            });
        } catch (e) { log('处理搜索页横幅广告出错', 'error', e); }
        if (blockedCount) log(`本次屏蔽搜索页横幅广告 ${blockedCount} 个`, 'info');
        performanceMonitor.end(startTime, '处理搜索页横幅广告');
    }

    const processContent = debounce(() => {
        processFeedItems();
        processSidebarModules();
        processTopNav();
        processComments();
        processAdImages();
        processSearchBannerAds();
    }, CONFIG.observerDelay);

    // ================== 可视化配置弹窗 ==================
    let uiPanel = null;

    function createUI() {
        if (uiPanel) return uiPanel;
        uiPanel = document.createElement('div');
        uiPanel.id = 'weibo-adblocker-panel';
        uiPanel.innerHTML = `
            <div class="wb-adblocker-header">
                <h3>微博屏蔽配置</h3>
                <button class="wb-adblocker-close">&times;</button>
            </div>
            <div class="wb-adblocker-tabs">
                <button class="tab-btn active" data-tab="feed">信息流标签</button>
                <button class="tab-btn" data-tab="content">正文关键词</button>
                <button class="tab-btn" data-tab="topnav">顶部导航</button>
                <button class="tab-btn" data-tab="sidebar">侧边栏</button>
                <button class="tab-btn" data-tab="comment">评论用户</button>
                <button class="tab-btn" data-tab="adimage">广告屏蔽</button>
            </div>
            <div class="wb-adblocker-content">
                <div class="tab-pane active" id="tab-feed">
                    <div class="keyword-list" data-type="blockKeywords"></div>
                    <div class="add-keyword">
                        <input type="text" placeholder="添加新关键词 (搜索页同样生效)" data-type="blockKeywords">
                        <button class="add-btn" data-type="blockKeywords">添加</button>
                    </div>
                </div>
                <div class="tab-pane" id="tab-content">
                    <div class="keyword-list" data-type="contentKeywords"></div>
                    <div class="add-keyword">
                        <input type="text" placeholder="添加新关键词" data-type="contentKeywords">
                        <button class="add-btn" data-type="contentKeywords">添加</button>
                    </div>
                </div>
                <div class="tab-pane" id="tab-topnav">
                    <div class="keyword-list" data-type="topNavKeywords"></div>
                </div>
                <div class="tab-pane" id="tab-sidebar">
                    <div class="keyword-list" data-type="sidebarModules"></div>
                </div>
                <div class="tab-pane" id="tab-comment">
                    <div class="keyword-list" data-type="blockCommentUsers"></div>
                    <div class="add-keyword">
                        <input type="text" placeholder="添加用户名" data-type="blockCommentUsers">
                        <button class="add-btn" data-type="blockCommentUsers">添加</button>
                    </div>
                </div>
                <div class="tab-pane" id="tab-adimage">
                    <div class="master-toggle">
                        <label>
                            <input type="checkbox" class="keyword-enable" data-config-key="blockAdImages" ${TEMP_CONFIG.blockAdImages ? 'checked' : ''}>
                            <span class="keyword-text">启用广告图片屏蔽</span>
                        </label>
                        <div class="master-toggle-desc">自动识别包含指定域名图片的广告模块并隐藏整个容器</div>
                    </div>
                    <div class="master-toggle" style="margin-top: 12px;">
                        <label>
                            <input type="checkbox" class="keyword-enable" data-config-key="blockSearchBannerAds" ${TEMP_CONFIG.blockSearchBannerAds ? 'checked' : ''}>
                            <span class="keyword-text">启用搜索页横幅广告屏蔽</span>
                        </label>
                        <div class="master-toggle-desc">自动识别微博搜索页顶部的横幅图片广告并隐藏（独立开关，不影响信息流关键词屏蔽）</div>
                    </div>
                    <div class="keyword-list" data-type="adImageDomains"></div>
                    <div class="add-keyword">
                        <input type="text" placeholder="添加广告图片域名 (如 ad.example.com)" data-type="adImageDomains">
                        <button class="add-btn" data-type="adImageDomains">添加</button>
                    </div>
                </div>
            </div>
            <div class="wb-adblocker-footer">
                <div class="footer-buttons">
                    <button class="close-btn">取消</button>
                    <button class="save-btn">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(uiPanel);
        bindUIEvents();
        renderAllKeywordLists();
        makeDraggable(uiPanel);
        return uiPanel;
    }

    function bindUIEvents() {
        uiPanel.querySelector('.wb-adblocker-close').addEventListener('click', closeConfigUI);
        uiPanel.querySelector('.close-btn').addEventListener('click', closeConfigUI);

        uiPanel.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                uiPanel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                uiPanel.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                const tabMap = { 'feed': 'tab-feed', 'content': 'tab-content', 'topnav': 'tab-topnav', 'sidebar': 'tab-sidebar', 'comment': 'tab-comment', 'adimage': 'tab-adimage' };
                const tabId = tabMap[btn.dataset.tab] || '';
                if (tabId) uiPanel.querySelector(`#${tabId}`).classList.add('active');
            });
        });

        uiPanel.addEventListener('change', e => {
            if (e.target.hasAttribute('data-config-key')) {
                const key = e.target.getAttribute('data-config-key');
                TEMP_CONFIG[key] = e.target.checked;
                log(`临时修改: ${key} = ${e.target.checked}`, 'info');
                return;
            }
            if (e.target.classList.contains('keyword-enable')) {
                const li = e.target.closest('li');
                if (li) {
                    const type = li.closest('.keyword-list').dataset.type;
                    const index = parseInt(li.dataset.index, 10);
                    if (TEMP_CONFIG[type] && TEMP_CONFIG[type][index]) {
                        TEMP_CONFIG[type][index].enabled = e.target.checked;
                        log(`临时修改: ${type}[${index}] enabled = ${e.target.checked}`, 'info');
                    }
                }
            }
        });

        uiPanel.addEventListener('click', e => {
            if (e.target.classList.contains('delete-btn')) {
                const li = e.target.closest('li');
                const type = li.closest('.keyword-list').dataset.type;
                if (type === 'blockKeywords' || type === 'contentKeywords' || type === 'blockCommentUsers' || type === 'adImageDomains') {
                    const index = parseInt(li.dataset.index, 10);
                    if (TEMP_CONFIG[type] && TEMP_CONFIG[type][index]) {
                        TEMP_CONFIG[type].splice(index, 1);
                        log(`临时删除: ${type}[${index}]`, 'info');
                        renderKeywordList(type);
                    }
                }
            }
        });

        uiPanel.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const type = btn.dataset.type;
                if (type === 'blockKeywords' || type === 'contentKeywords' || type === 'blockCommentUsers' || type === 'adImageDomains') {
                    const input = uiPanel.querySelector(`input[data-type="${type}"]`);
                    const text = input.value.trim();
                    if (text) {
                        if (!TEMP_CONFIG[type]) TEMP_CONFIG[type] = [];
                        TEMP_CONFIG[type].push({ text, enabled: true });
                        log(`临时添加: ${type} 关键词 "${text}"`, 'info');
                        renderKeywordList(type);
                        input.value = '';
                    }
                }
            });
        });

        uiPanel.querySelector('.save-btn').addEventListener('click', () => {
            Object.keys(TEMP_CONFIG).forEach(key => {
                if (Array.isArray(TEMP_CONFIG[key])) {
                    CONFIG[key] = JSON.parse(JSON.stringify(TEMP_CONFIG[key]));
                    GM_setValue(key, CONFIG[key]);
                } else {
                    if (key in CONFIG && typeof TEMP_CONFIG[key] !== 'object') {
                        CONFIG[key] = TEMP_CONFIG[key];
                        GM_setValue(key, CONFIG[key]);
                    }
                }
            });
            log('配置已保存并应用', 'success');
            document.querySelectorAll('.weibo-ad-blocked, .weibo-topnav-blocked, .weibo-sidebar-blocked, .weibo-comment-blocked, .weibo-content-blocked, .weibo-ad-image-blocked, [data-processed="true"], [data-sidebar-processed="true"], [data-comment-processed="true"], [data-comment-unit-processed="true"], [data-flat-processed="true"], [data-ad-img-processed="true"], [data-search-ad-processed="true"]').forEach(el => {
                el.classList.remove('weibo-ad-blocked', 'weibo-topnav-blocked', 'weibo-sidebar-blocked', 'weibo-comment-blocked', 'weibo-content-blocked', 'weibo-ad-image-blocked');
                el.removeAttribute('data-processed');
                el.removeAttribute('data-sidebar-processed');
                el.removeAttribute('data-comment-processed');
                el.removeAttribute('data-comment-unit-processed');
                el.removeAttribute('data-flat-processed');
                el.removeAttribute('data-ad-img-processed');
                el.removeAttribute('data-search-ad-processed');
            });
            performanceMonitor.stats.blockedItems = 0;
            performanceMonitor.stats.blockedTopNav = 0;
            performanceMonitor.stats.blockedSidebars = 0;
            performanceMonitor.stats.blockedComments = 0;
            performanceMonitor.stats.blockedAdImages = 0;
            processContent();
            closeConfigUI();
        });
    }

    function renderAllKeywordLists() {
        ['blockKeywords', 'contentKeywords', 'topNavKeywords', 'sidebarModules', 'blockCommentUsers', 'adImageDomains'].forEach(type => renderKeywordList(type));
    }

    function renderKeywordList(type) {
        const listContainer = uiPanel.querySelector(`.keyword-list[data-type="${type}"]`);
        if (!listContainer) return;
        const keywords = TEMP_CONFIG[type] || [];
        let html = '<ul>';
        keywords.forEach((kw, index) => {
            if (type === 'sidebarModules' || type === 'topNavKeywords') {
                html += `<li data-index="${index}"><label><input type="checkbox" class="keyword-enable" ${kw.enabled ? 'checked' : ''}><span class="keyword-text">${escapeHTML(kw.text)}</span></label></li>`;
            } else {
                html += `<li data-index="${index}"><label><input type="checkbox" class="keyword-enable" ${kw.enabled ? 'checked' : ''}><span class="keyword-text">${escapeHTML(kw.text)}</span></label><button class="delete-btn" title="移除">移除</button></li>`;
            }
        });
        html += '</ul>';
        listContainer.innerHTML = html;
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>"]/g, function(c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; });
    }

    function makeDraggable(el) {
        let offsetX, offsetY, mouseX, mouseY;
        const header = el.querySelector('.wb-adblocker-header');
        header.style.cursor = 'move';
        header.addEventListener('mousedown', e => {
            e.preventDefault(); mouseX = e.clientX; mouseY = e.clientY; offsetX = el.offsetLeft; offsetY = el.offsetTop;
            document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
        });
        function onMouseMove(e) { e.preventDefault(); el.style.left = offsetX + e.clientX - mouseX + 'px'; el.style.top = offsetY + e.clientY - mouseY + 'px'; }
        function onMouseUp() { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
    }

    function openConfigUI() {
        TEMP_CONFIG = JSON.parse(JSON.stringify(CONFIG));
        const panel = createUI(); renderAllKeywordLists(); panel.style.display = 'flex';
        panel.style.left = (window.innerWidth / 2 - panel.offsetWidth / 2) + 'px'; panel.style.top = (window.innerHeight / 2 - panel.offsetHeight / 2) + 'px';
    }

    function closeConfigUI() { if (uiPanel) uiPanel.style.display = 'none'; }

    // ================== 初始化与配置迁移 ==================
    function setupObserver() {
        let pending = false, rafId = null;
        const observer = new MutationObserver(() => {
            if (!pending) { rafId = requestAnimationFrame(() => { processContent(); pending = false; }); pending = true; }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: false, characterData: false });
        log('DOM监听器启动', 'success');
    }

    function setupScrollListener() { window.addEventListener('scroll', throttle(processContent, CONFIG.scrollThrottle), { passive: true }); }

    function setupMenuCommands() {
        GM_registerMenuCommand('打开配置面板', openConfigUI);
        GM_registerMenuCommand('切换调试模式', () => { CONFIG.debugMode = !CONFIG.debugMode; GM_setValue('debugMode', CONFIG.debugMode); alert(`调试模式已${CONFIG.debugMode ? '开启' : '关闭'}`); location.reload(); });
        GM_registerMenuCommand('查看统计信息', () => { performanceMonitor.report(); alert(`已屏蔽内容统计：\n- 信息流: ${performanceMonitor.stats.blockedItems}\n- 侧边栏模块: ${performanceMonitor.stats.blockedSidebars}\n- 顶部导航: ${performanceMonitor.stats.blockedTopNav}\n- 评论: ${performanceMonitor.stats.blockedComments}\n- 广告图片: ${performanceMonitor.stats.blockedAdImages}\n- 执行时间: ${performanceMonitor.stats.executionTime.toFixed(2)}ms`); });
    }

    function injectUIStyles() {
        GM_addStyle(`
            #weibo-adblocker-panel { display: none; position: fixed; width: 600px; max-width: 90vw; background: white; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); font-family: system-ui, -apple-system, sans-serif; z-index: 99999; flex-direction: column; border: 1px solid #e6e6e6; color: #1f1f1f; }
            #weibo-adblocker-panel * { box-sizing: border-box; }
            .wb-adblocker-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; background: #fafafa; border-radius: 12px 12px 0 0; }
            .wb-adblocker-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
            .wb-adblocker-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; line-height: 1; padding: 0 4px; }
            .wb-adblocker-close:hover { color: #000; }
            .wb-adblocker-tabs { display: flex; flex-wrap: wrap; padding: 10px 20px 0; border-bottom: 1px solid #eee; }
            .tab-btn { padding: 8px 12px; margin-right: 6px; margin-bottom: 4px; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 500; color: #666; font-size: 13px; }
            .tab-btn.active { border-bottom-color: #ff8200; color: #ff8200; }
            .wb-adblocker-content { padding: 20px; min-height: 300px; max-height: 400px; overflow-y: auto; }
            .tab-pane { display: none; } .tab-pane.active { display: block; }
            .keyword-list ul { list-style: none; padding: 0; margin: 0 0 16px; }
            .keyword-list li { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: #f9f9f9; border-radius: 6px; border: 1px solid #f0f0f0; }
            .keyword-list li label { display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; }
            .keyword-enable { width: 18px; height: 18px; cursor: pointer; }
            .keyword-text { font-size: 14px; padding: 2px 6px; border-radius: 4px; }
            .delete-btn { background: #e9e9e9; border: none; border-radius: 30px; padding: 6px 16px; font-size: 13px; color: #555; cursor: pointer; font-weight: 400; transition: background 0.2s, color 0.2s; line-height: 1; letter-spacing: 0.5px; }
            .delete-btn:hover { background: #d0d0d0; color: #2c2c2c; }
            .add-keyword { display: flex; margin-top: 12px; gap: 8px; }
            .add-keyword input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 20px; font-size: 14px; }
            .add-keyword button { background: #ff8200; color: white; border: none; border-radius: 20px; padding: 8px 20px; font-weight: 500; cursor: pointer; }
            .add-keyword button:hover { background: #e67300; }
            .master-toggle { margin-bottom: 16px; padding: 12px; background: #fff8f0; border-radius: 8px; border: 1px solid #ffe0b2; }
            .master-toggle label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
            .master-toggle .keyword-text { font-size: 14px; font-weight: 500; }
            .master-toggle-desc { margin-top: 6px; margin-left: 26px; font-size: 12px; color: #999; line-height: 1.4; }
            .wb-adblocker-footer { padding: 16px 20px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; align-items: center; background: #fafafa; border-radius: 0 0 12px 12px; }
            .footer-buttons { display: flex; gap: 12px; }
            .save-btn { background: #ff8200; color: white; border: none; border-radius: 20px; padding: 8px 20px; font-weight: 500; cursor: pointer; }
            .save-btn:hover { background: #e67300; }
            .close-btn { background: #fff; border: 1px solid #ddd; border-radius: 20px; padding: 8px 20px; cursor: pointer; }
            .close-btn:hover { background: #f5f5f5; }
        `);
    }

    function migrateAndEnhanceConfig() {
        let blockVal = GM_getValue('blockKeywords', null);
        if (blockVal && Array.isArray(blockVal) && blockVal.length > 0 && typeof blockVal[0] === 'string') { CONFIG.blockKeywords = blockVal.map(text => ({ text, enabled: true })); GM_setValue('blockKeywords', CONFIG.blockKeywords); }

        let contentVal = GM_getValue('contentKeywords', null);
        if (contentVal === null) { CONFIG.contentKeywords = []; GM_setValue('contentKeywords', CONFIG.contentKeywords); }
        else if (Array.isArray(contentVal) && contentVal.length > 0 && typeof contentVal[0] === 'string') { CONFIG.contentKeywords = contentVal.map(text => ({ text, enabled: true })); GM_setValue('contentKeywords', CONFIG.contentKeywords); }

        let commentVal = GM_getValue('blockCommentUsers', null);
        if (commentVal === null) { CONFIG.blockCommentUsers = []; GM_setValue('blockCommentUsers', CONFIG.blockCommentUsers); }
        else if (Array.isArray(commentVal) && commentVal.length > 0 && typeof commentVal[0] === 'string') { CONFIG.blockCommentUsers = commentVal.map(text => ({ text, enabled: true })); GM_setValue('blockCommentUsers', CONFIG.blockCommentUsers); }

        let adImgVal = GM_getValue('adImageDomains', null);
        if (adImgVal === null) { CONFIG.adImageDomains = [{ text: 'kadmimage.biz.weibo.com', enabled: true }]; GM_setValue('adImageDomains', CONFIG.adImageDomains); }
        else if (Array.isArray(adImgVal) && adImgVal.length > 0 && typeof adImgVal[0] === 'string') { CONFIG.adImageDomains = adImgVal.map(text => ({ text, enabled: true })); GM_setValue('adImageDomains', CONFIG.adImageDomains); }

        if (GM_getValue('blockAdImages', null) === null) { GM_setValue('blockAdImages', true); }

        if (GM_getValue('blockSearchAds', null) !== null) { GM_deleteValue('blockSearchAds'); }
        if (GM_getValue('blockSearchBannerAds', null) === null) { GM_setValue('blockSearchBannerAds', false); log('初始化搜索页横幅广告屏蔽开关: false', 'info'); }

        const PRESET_TOPNAV = [ { text: '首页', enabled: false }, { text: '消息', enabled: false }, { text: '推荐', enabled: true }, { text: '视频', enabled: true }, { text: '游戏', enabled: true }, { text: '无障碍', enabled: true } ];
        let oldTopNav = GM_getValue('topNavKeywords', []);
        let newTopNav = [];
        PRESET_TOPNAV.forEach(preset => { let enabled = preset.enabled; let oldItem = oldTopNav.find(item => (typeof item === 'object' && item.text === preset.text) || (typeof item === 'string' && item === preset.text)); if (oldItem && typeof oldItem === 'object' && oldItem.enabled !== undefined) enabled = oldItem.enabled; newTopNav.push({ text: preset.text, enabled }); });
        CONFIG.topNavKeywords = newTopNav; GM_setValue('topNavKeywords', newTopNav);

        let sidebarVal = GM_getValue('sidebarModules', null);
        if (sidebarVal && Array.isArray(sidebarVal) && sidebarVal.length > 0 && typeof sidebarVal[0] === 'string') { CONFIG.sidebarModules = sidebarVal.map(text => ({ text, enabled: true })); GM_setValue('sidebarModules', CONFIG.sidebarModules); }
        const sidebar = CONFIG.sidebarModules;
        const defaultSidebar = [ { text: '你可能感兴趣的人', enabled: false }, { text: '创作者中心', enabled: false }, { text: '微博热搜', enabled: false }, { text: '自定义分组', enabled: false }, { text: '底部信息', enabled: false } ];
        let sidebarChanged = false;
        defaultSidebar.forEach(item => { if (!sidebar.some(m => m.text === item.text)) { sidebar.push(item); sidebarChanged = true; } });
        if (sidebarChanged) GM_setValue('sidebarModules', sidebar);
    }

    function init() {
        try {
            migrateAndEnhanceConfig();
            injectStyles();
            injectUIStyles();
            setTimeout(processContent, 500);
            setupObserver();
            setupAdImageObserver();
            setupScrollListener();
            setupMenuCommands();
            document.addEventListener('visibilitychange', () => { if (!document.hidden) processContent(); });
            log('初始化完成', 'success');
            if (CONFIG.debugMode) setInterval(() => performanceMonitor.report(), 30000);
        } catch (e) { log('初始化失败', 'error', e); }
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
