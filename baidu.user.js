// ==UserScript==
// @name         百度搜索深度净化器
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  智能移除百度搜索结果中的各类广告、相关搜索、热榜、百家号、品牌广告等，支持自定义URL屏蔽
// @author       MRBANK
// @match        *://www.baidu.com/*
// @icon         https://www.baidu.com/favicon.ico
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  
// @updateURL    
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置管理 =================
    const CONFIG_KEY = 'baidu_purifier_config';
    const defaultConfig = {
        ad: true,               // 1. 各类广告
        brandAd: true,          // 2. 品牌广告(通栏背景)
        rightRelated: true,     // 3. 右侧相关搜索
        rightHot: true,         // 4. 右侧百度热榜
        rightHint: true,        // 5. 右侧百度保障提示
        rightBottomAd: true,    // 6. 右侧底部推广
        searchAlso: true,       // 7. 大家还在搜/都在搜
        bottomRelated: true,    // 8. 底部相关搜索
        baijiahao: true,        // 9. 屏蔽百家号(快捷开关)
        customBlockedUrls: ['baijiahao.baidu.com'] // 10. 自定义屏蔽URL列表
    };

    const configStructure = [
        {
            groupName: "广告与推广",
            items: [
                { key: 'ad', label: '搜索结果广告' },
                { key: 'brandAd', label: '品牌广告(通栏背景)' },
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
        return el.closest('.c-container, .result, .result-op, div[id^="norm"], #top-ad, .tenon_pc_material, [tpl], [card-show-log], div[class*="aladdin"]');
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

        // 3-8 模块移除
        if (cfg.rightRelated) { document.querySelectorAll('[tpl="recommend_list_san"]').forEach(el => el.remove()); document.querySelectorAll('.recommend-single-list_5TJKn').forEach(el => { let c = el.closest('.result-op') || el.closest('.cr-content'); if(c) c.remove(); }); }
        if (cfg.rightHot) { document.querySelectorAll('[tpl="right_toplist1"]').forEach(el => el.remove()); document.querySelectorAll('.FYB_RD').forEach(el => { let c = el.closest('.result-op') || el.closest('.cr-content'); if(c) c.remove(); }); }
        if (cfg.rightHint) { document.querySelectorAll('.hint_right_middle, [tpl="app/hint-head-top"]').forEach(el => { const c = el.closest('.hint_right_middle') || el; if(c) c.remove(); }); }
        if (cfg.rightBottomAd) { const rba = document.querySelector('#con-right-bottom') || document.querySelector('.ad-widget-header'); if (rba) { const c = rba.closest('#con-right-bottom') || rba.closest('div[id^="m"]') || rba; if(c) c.remove(); } }
        if (cfg.searchAlso) { const sn = document.evaluate("//div[contains(text(), '大家还在搜') or contains(text(), '大家都在搜')]", document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null); for (let i = 0; i < sn.snapshotLength; i++) { const c = sn.snapshotItem(i).closest('.c-container') || sn.snapshotItem(i).closest('.result-op') || sn.snapshotItem(i).closest('[class*="rg-upgrade"]'); if(c) c.remove(); } }
        if (cfg.bottomRelated) { document.querySelectorAll('table[class*="rs-table"]').forEach(el => { const c = el.closest('.c-container') || el.closest('.result-op') || el.parentElement; if(c) c.remove(); }); const rn = document.evaluate("//div[contains(text(), '相关搜索') or contains(text(), '相关推荐')]", document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null); for (let i = 0; i < rn.snapshotLength; i++) { const node = rn.snapshotItem(i); if (node.closest('table[class*="rs-table"]') || node.querySelector('table[class*="rs-table"]')) { const c = node.closest('.c-container') || node.closest('.result-op') || node.parentElement; if(c) c.remove(); } } }

        // 9. 屏蔽百家号来源 (重点重构：逆向寻祖查找)
        if (cfg.baijiahao) {
            // 方案A：匹配来源文本标识 (新老结构均适用)
            document.querySelectorAll('.cosc-source-text, .c-showurl').forEach(el => {
                if (el.textContent.includes('百家号') || el.textContent.includes('baijiahao.baidu.com')) {
                    const container = findCardContainer(el);
                    if (container) container.remove();
                }
            });

            // 方案B：解析隐藏在 data-feedback 中的真实落地页链接
            document.querySelectorAll('[data-feedback]').forEach(el => {
                try {
                    const fbStr = el.getAttribute('data-feedback').replace(/&quot;/g, '"');
                    const fbData = JSON.parse(fbStr);
                    // 全民小视频(quanmin)也属于百家号体系
                    if (fbData.url && (fbData.url.includes('baijiahao.baidu.com') || fbData.url.includes('quanmin.baidu.com'))) {
                        const container = findCardContainer(el);
                        if (container) container.remove();
                    }
                } catch(e) {}
            });

            // 方案C：原有属性兜底
            document.querySelectorAll('a[data-landurl*="baijiahao.baidu.com"], [mu*="baijiahao.baidu.com"]').forEach(el => {
                const container = findCardContainer(el);
                if (container) container.remove();
            });
        }

        // 10. 自定义URL屏蔽
        const customUrls = cfg.customBlockedUrls || [];
        if (customUrls.length > 0) {
            const containers = document.querySelectorAll('.c-container, .result, .result-op, div[id^="norm"], #top-ad, .tenon_pc_material, [tpl], [card-show-log], div[class*="aladdin"]');

            containers.forEach(el => {
                if (!el.isConnected) return; // 跳过已被上面逻辑移除的元素

                let urlTexts = [];

                // 提取 mu 属性
                if (el.getAttribute('mu')) urlTexts.push(el.getAttribute('mu'));
                el.querySelectorAll('[mu]').forEach(sub => urlTexts.push(sub.getAttribute('mu')));

                // 提取 data-landurl 属性
                el.querySelectorAll('[data-landurl]').forEach(a => urlTexts.push(a.getAttribute('data-landurl')));

                // 提取显示的URL文本 (兼容新旧结构)
                el.querySelectorAll('.c-showurl, .c-color-gray, .cosc-source-text').forEach(span => urlTexts.push(span.textContent));

                // 提取百度跳转链接中的真实 URL
                el.querySelectorAll('a[href*="url="]').forEach(a => {
                    const href = a.getAttribute('href');
                    const match = href.match(/[?&]url=([^&]+)/);
                    if (match && match[1]) {
                        try { urlTexts.push(decodeURIComponent(match[1])); } catch(e) {}
                    }
                });

                // 提取 data-feedback 中隐藏的真实 URL
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
