// ==UserScript==
// @name         百度搜索深度净化器
// @namespace    http://tampermonkey.net/
// @version      3.8
// @description  智能移除百度搜索结果中的各类广告、相关搜索、热榜、百家号、品牌广告等，支持自定义URL屏蔽
// @author       MRBANK
// @match        *://www.baidu.com/*
// @icon         https://www.baidu.com/favicon.ico
// @grant        GM_registerMenuCommand
// @run-at        document-idle
// @downloadURL  https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/baidu.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/baidu.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置管理 =================
    const CONFIG_KEY = 'baidu_purifier_config';
    const defaultConfig = {
        ad: true,               // 1. 各类广告
        brandAd: true,          // 2. 品牌广告(通栏背景)
        rightSidebarAd: true,   // 3. 右侧栏广告
        homepageWenxinAd: true, // 4. 首页文心广告 ← 新增
        rightRelated: true,     // 5. 右侧相关搜索
        rightHot: true,         // 6. 右侧百度热榜
        rightHint: true,        // 7. 右侧百度保障提示
        rightBottomAd: true,    // 8. 右侧底部推广
        searchAlso: true,       // 9. 大家还在搜/都在搜
        bottomRelated: true,    // 10. 底部相关搜索
        baijiahao: true,        // 11. 屏蔽百家号(快捷开关)
        customBlockedUrls: ['baijiahao.baidu.com'] // 12. 自定义屏蔽URL列表
    };

    const configStructure = [
        {
            groupName: "广告与推广",
            items: [
                { key: 'ad', label: '搜索结果广告' },
                { key: 'brandAd', label: '品牌广告(通栏背景)' },
                { key: 'rightSidebarAd', label: '右侧栏广告' },
                { key: 'homepageWenxinAd', label: '首页文心广告' },  // ← 新增
                { key: 'rightBottomAd', label: '右侧底部推广' }
            ]
        },
        {
            groupName: "右侧栏模块",
            items: [
                { key: 'rightRelated', label: '右侧相关搜索' },
                { key: 'rightHot', label: '右侧百度热榜' },
                { key: 'rightHint', label: '右侧保障提示' }
            ]
        },
        {
            groupName: "内容过滤",
            items: [
                { key: 'baijiahao', label: '屏蔽百家号来源(快捷)' },
                { key: 'customBlockedUrls', label: '自定义屏蔽URL(换行分隔,模糊匹配)', type: 'textarea', placeholder: '例如:\nbaijiahao.baidu.com\nmi.com' }
            ]
        },
        {
            groupName: "底部与推荐",
            items: [
                { key: 'searchAlso', label: '大家还在搜/都在搜' },
                { key: 'bottomRelated', label: '底部相关搜索' }
            ]
        }
    ];

    let cachedConfig = null;

    function getConfig() {
        if (cachedConfig) return cachedConfig;
        let saved = localStorage.getItem(CONFIG_KEY);
        if (saved) {
            try { cachedConfig = {...defaultConfig, ...JSON.parse(saved)}; }
            catch(e) { cachedConfig = {...defaultConfig}; }
        } else {
            cachedConfig = {...defaultConfig};
        }
        if (!Array.isArray(cachedConfig.customBlockedUrls)) {
            cachedConfig.customBlockedUrls = defaultConfig.customBlockedUrls;
        }
        // 兼容旧配置
        if (cachedConfig.rightSidebarAd === undefined) {
            cachedConfig.rightSidebarAd = true;
        }
        if (cachedConfig.homepageWenxinAd === undefined) {
            cachedConfig.homepageWenxinAd = true;
        }
        return cachedConfig;
    }

    function saveConfig(cfg) {
        cachedConfig = cfg;
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
            #bp-modal { background: #fff; width: 400px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); overflow: hidden; display: flex; flex-direction: column; }
            #bp-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #e8e8e8; }
            #bp-header h3 { margin: 0; font-size: 16px; color: #333; }
            #bp-close-btn { background: none; border: none; font-size: 20px; color: #999; cursor: pointer; line-height: 1; padding: 0; }
            #bp-close-btn:hover { color: #333; }
            #bp-body { padding: 10px 0; max-height: 70vh; overflow-y: auto; }
            .bp-group-title { padding: 10px 20px 5px; margin: 0; font-size: 13px; color: #888; font-weight: 500; }
            .bp-switch-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; font-size: 14px; color: #333; transition: background 0.2s; }
            .bp-switch-row:hover { background: #f5f7fa; }
            .bp-textarea-row { flex-direction: column; align-items: flex-start; }
            .bp-textarea-label { margin-bottom: 8px; font-size: 13px; color: #555; }
            .bp-textarea { width: 100%; height: 80px; border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-size: 12px; resize: vertical; box-sizing: border-box; font-family: inherit; line-height: 1.5; }
            .bp-textarea:focus { outline: none; border-color: #4e6ef2; }
            .bp-switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
            .bp-switch input { opacity: 0; width: 0; height: 0; }
            .bp-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 22px; }
            .bp-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .bp-switch input:checked + .bp-slider { background-color: #4e6ef2; }
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
        title.textContent = '百度净化器 - 设置';
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
                row.className = 'bp-switch-row' + (item.type === 'textarea' ? ' bp-textarea-row' : '');

                if (item.type === 'textarea') {
                    const label = document.createElement('div');
                    label.className = 'bp-textarea-label';
                    label.textContent = item.label;
                    const textarea = document.createElement('textarea');
                    textarea.className = 'bp-textarea';
                    textarea.dataset.key = item.key;
                    textarea.placeholder = item.placeholder || '';
                    textarea.value = (cfg[item.key] || []).join('\n');
                    row.appendChild(label);
                    row.appendChild(textarea);
                    body.appendChild(row);
                    textarea.addEventListener('change', (e) => {
                        const currentCfg = getConfig();
                        const val = e.target.value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                        currentCfg[item.key] = val;
                        saveConfig(currentCfg);
                        needReload = true;
                    });
                } else {
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
                }
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
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
    }

    GM_registerMenuCommand('🧹 净化器设置', openSettingsPanel);

    // 寻找包含特征的卡片最外层容器
    function findCardContainer(el) {
        return el.closest('.c-container, .result, .result-op, div[id^="norm"], #top-ad, .tenon_pc_material, [tpl], [card-show-log], div[class*="aladdin"], [posid], .EC_result');
    }


    // ================= 核心清理逻辑 =================
    function clearBaiduCrap() {
        const cfg = getConfig();

        // 1. 移除带有"广告"标签的推广内容
        if (cfg.ad) {
            const adLabels = document.querySelectorAll('.ec-tuiguang, .ecfc-tuiguang, span[data-tuiguang], a.m');
            adLabels.forEach(label => {
                const isAd = label.classList.contains('ec-tuiguang') ||
                             label.classList.contains('ecfc-tuiguang') ||
                             label.hasAttribute('data-tuiguang') ||
                             (label.tagName === 'A' && label.classList.contains('m') && label.textContent.trim() === '广告');
                if (isAd) {
                    const container = findCardContainer(label);
                    if (container) container.remove();
                }
            });
        }

        // 2. 移除品牌广告
        if (cfg.brandAd) {
            const topAd = document.getElementById('top-ad');
            if (topAd) topAd.remove();
            document.querySelectorAll('.tenon_pc_comp_columbus_banner_brand_tip').forEach(el => {
                const container = findCardContainer(el) || el.closest('.tenon_pc_comp_columbus_banner_container');
                if (container) container.remove();
            });
            document.querySelectorAll('.tenon_pc_comp_columbus_banner_container').forEach(el => {
                const wrapper = el.closest('.c-container') || el.closest('.result') || el.parentElement;
                if (wrapper && wrapper.offsetHeight > 200) wrapper.remove();
            });
        }

        // 3. 移除右侧栏广告
        if (cfg.rightSidebarAd) {
            const rightSidebar = document.getElementById('content_right');
            if (rightSidebar) {
                rightSidebar.querySelectorAll('.ec-tuiguang, .ecfc-tuiguang, span[data-tuiguang]').forEach(label => {
                    const container = label.closest('[posid]') ||
                                     label.closest('.EC_result') ||
                                     label.closest('.cr-content');
                    if (container) container.remove();
                });

                rightSidebar.querySelectorAll('.cr-content[data-placeid]').forEach(crContent => {
                    const children = crContent.querySelectorAll(':scope > div');
                    const allAd = Array.from(children).every(child => child.hasAttribute('posid') || child.hasAttribute('sid'));
                    if (allAd && children.length > 0) {
                        crContent.remove();
                    }
                });

                rightSidebar.querySelectorAll('.EC_result').forEach(el => {
                    if (el.isConnected) el.remove();
                });

                rightSidebar.querySelectorAll('.cr-content').forEach(el => {
                    if (!el.children.length || el.textContent.trim() === '') {
                        el.remove();
                    }
                });
            }
        }

        // 4. 移除首页文心广告 ← 新增
        if (cfg.homepageWenxinAd) {
            // 方法1：通过链接目标 chat.baidu.com 定位
            document.querySelectorAll('a[href*="chat.baidu.com"]').forEach(link => {
                // 逐级向上查找最合适的移除容器
                // guide-bub面板 → panel-sample面板 → panel-list列表
                const container = link.closest('[class*="guide-bub"]') ||
                                 link.closest('[class*="panel-sample"]') ||
                                 link.closest('[class*="panel_"]') ||
                                 link.closest('[class*="panel-list"]');
                if (container) {
                    // 如果容器是 panel-list，检查移除后是否还有其他子项
                    const panelList = container.closest('[class*="panel-list"]');
                    if (panelList && panelList !== container) {
                        // container 是子项，直接移除
                        container.remove();
                        // 清理变空的 panel-list
                        if (!panelList.children.length) panelList.remove();
                    } else {
                        container.remove();
                    }
                } else {
                    // 没有匹配到面板容器，移除链接本身的最外层包装
                    const parent = link.parentElement;
                    if (parent && parent.children.length === 1) {
                        parent.remove();
                    } else {
                        link.remove();
                    }
                }
            });

            // 方法2：通过文心logo图片定位（兜底）
            document.querySelectorAll('img[src*="wenxinlogo"]').forEach(img => {
                const link = img.closest('a[href*="chat.baidu.com"]');
                if (link) {
                    const container = link.closest('[class*="guide-bub"]') ||
                                     link.closest('[class*="panel-sample"]') ||
                                     link.closest('[class*="panel_"]') ||
                                     link.closest('[class*="panel-list"]');
                    if (container && container.isConnected) container.remove();
                } else {
                    // 图片不在链接内，向上找面板容器
                    const container = img.closest('[class*="guide-bub"]') ||
                                     img.closest('[class*="panel-sample"]') ||
                                     img.closest('[class*="panel-list"]');
                    if (container && container.isConnected) container.remove();
                }
            });

            // 方法3：通过文本内容"文心"定位（最后兜底）
            const wenxinNodes = document.evaluate(
                "//*[contains(text(),'文心助手') or contains(text(),'文心一言')]",
                document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null
            );
            for (let i = 0; i < wenxinNodes.snapshotLength; i++) {
                const node = wenxinNodes.snapshotItem(i);
                // 确认是百度首页文心推广，而非搜索结果中的正常提及
                const container = node.closest('[class*="guide-bub"]') ||
                                 node.closest('[class*="panel-sample"]') ||
                                 node.closest('[class*="panel_"]') ||
                                 node.closest('[class*="panel-list"]');
                if (container && container.isConnected) {
                    container.remove();
                }
            }

            // 清理因广告被删而变空的 panel-list 容器
            document.querySelectorAll('[class*="panel-list"]').forEach(el => {
                if (el.isConnected && !el.children.length) {
                    el.remove();
                }
            });
        }

        // 5-10 模块移除
        if (cfg.rightRelated) { document.querySelectorAll('[tpl="recommend_list_san"]').forEach(el => el.remove()); document.querySelectorAll('.recommend-single-list_5TJKn').forEach(el => { let c = el.closest('.result-op') || el.closest('.cr-content'); if(c) c.remove(); }); }
        if (cfg.rightHot) { document.querySelectorAll('[tpl="right_toplist1"]').forEach(el => el.remove()); document.querySelectorAll('.FYB_RD').forEach(el => { let c = el.closest('.result-op') || el.closest('.cr-content'); if(c) c.remove(); }); }
        if (cfg.rightHint) { document.querySelectorAll('.hint_right_middle, [tpl="app/hint-head-top"]').forEach(el => { const c = el.closest('.hint_right_middle') || el; if(c) c.remove(); }); }
        if (cfg.rightBottomAd) { const rba = document.querySelector('#con-right-bottom') || document.querySelector('.ad-widget-header'); if (rba) { const c = rba.closest('#con-right-bottom') || rba.closest('div[id^="m"]') || rba; if(c) c.remove(); } }
        if (cfg.searchAlso) { const sn = document.evaluate("//div[contains(text(), '大家还在搜') or contains(text(), '大家都在搜')]", document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null); for (let i = 0; i < sn.snapshotLength; i++) { const c = sn.snapshotItem(i).closest('.c-container') || sn.snapshotItem(i).closest('.result-op') || sn.snapshotItem(i).closest('[class*="rg-upgrade"]'); if(c) c.remove(); } }
        if (cfg.bottomRelated) { document.querySelectorAll('table[class*="rs-table"]').forEach(el => { const c = el.closest('.c-container') || el.closest('.result-op') || el.parentElement; if(c) c.remove(); }); const rn = document.evaluate("//div[contains(text(), '相关搜索') or contains(text(), '相关推荐')]", document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null); for (let i = 0; i < rn.snapshotLength; i++) { const node = rn.snapshotItem(i); if (node.closest('table[class*="rs-table"]') || node.querySelector('table[class*="rs-table"]')) { const c = node.closest('.c-container') || node.closest('.result-op') || node.parentElement; if(c) c.remove(); } } }

        // 11. 屏蔽百家号来源
        if (cfg.baijiahao) {
            document.querySelectorAll('.cosc-source-text, .c-showurl').forEach(el => {
                if (el.textContent.includes('百家号') || el.textContent.includes('baijiahao.baidu.com')) {
                    const container = findCardContainer(el);
                    if (container) container.remove();
                }
            });

            document.querySelectorAll('[data-feedback]').forEach(el => {
                try {
                    const fbStr = el.getAttribute('data-feedback').replace(/&quot;/g, '"');
                    const fbData = JSON.parse(fbStr);
                    if (fbData.url && (fbData.url.includes('baijiahao.baidu.com') || fbData.url.includes('quanmin.baidu.com'))) {
                        const container = findCardContainer(el);
                        if (container) container.remove();
                    }
                } catch(e) {}
            });

            document.querySelectorAll('a[data-landurl*="baijiahao.baidu.com"], [mu*="baijiahao.baidu.com"]').forEach(el => {
                const container = findCardContainer(el);
                if (container) container.remove();
            });
        }

        // 12. 自定义URL屏蔽
        const customUrls = cfg.customBlockedUrls || [];
        if (customUrls.length > 0) {
            const containers = document.querySelectorAll('.c-container, .result, .result-op, div[id^="norm"], #top-ad, .tenon_pc_material, [tpl], [card-show-log], div[class*="aladdin"]');

            containers.forEach(el => {
                if (!el.isConnected) return;

                let urlTexts = [];

                if (el.getAttribute('mu')) urlTexts.push(el.getAttribute('mu'));
                el.querySelectorAll('[mu]').forEach(sub => urlTexts.push(sub.getAttribute('mu')));
                el.querySelectorAll('[data-landurl]').forEach(a => urlTexts.push(a.getAttribute('data-landurl')));
                el.querySelectorAll('.c-showurl, .c-color-gray, .cosc-source-text').forEach(span => urlTexts.push(span.textContent));
                el.querySelectorAll('a[href*="url="]').forEach(a => {
                    const href = a.getAttribute('href');
                    const match = href.match(/[?&]url=([^&]+)/);
                    if (match && match[1]) {
                        try { urlTexts.push(decodeURIComponent(match[1])); } catch(e) {}
                    }
                });
                el.querySelectorAll('[data-feedback]').forEach(fbEl => {
                    try {
                        const fbStr = fbEl.getAttribute('data-feedback').replace(/&quot;/g, '"');
                        const fbData = JSON.parse(fbStr);
                        if (fbData.url) urlTexts.push(fbData.url);
                    } catch(e) {}
                });

                let combinedText = urlTexts.join(' ').toLowerCase();
                combinedText = combinedText.replace(/https?:\/\//g, '').replace(/www\./g, '').replace(/\s+/g, '');

                for (const blockedStr of customUrls) {
                    let cleanBlockedStr = blockedStr.toLowerCase().trim();
                    if (!cleanBlockedStr) continue;
                    cleanBlockedStr = cleanBlockedStr.replace(/https?:\/\//g, '').replace(/www\./g, '');

                    if (combinedText.includes(cleanBlockedStr)) {
                        el.remove();
                        break;
                    }
                }
            });
        }
    }

    // ================= 启动逻辑 =================
    clearBaiduCrap();

    let timer = null;
    const observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(clearBaiduCrap, 150);
    });

    const wrapper = document.getElementById('wrapper') || document.body;
    observer.observe(wrapper, { childList: true, subtree: true });

})();
