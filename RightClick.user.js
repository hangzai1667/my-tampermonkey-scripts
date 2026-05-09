// ==UserScript==
// @name         右键链接增强器
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  右键链接快速复制文字、地址及多种格式，智能识别选中文本和图片，支持从链接另存文件，支持复制图片到剪贴板，可自定义分组排序
// @author       MRBANK
// @match        *://*/*
// @connect      *
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojM2I4MmY2Ii8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMjU2M2ViIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIHJ4PSIyNSIgZmlsbD0idXJsKCNiZykiLz48cGF0aCBkPSJNNTAgNzAgTDM1IDg1IEMyNSA5NSAxMCA4MCAyMCA3MCBMNDAgNTAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMTAiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik03MCA1MCBMODUgMzUgQzk1IDI1IDExMCA0MCAxMDAgNTAgTDgwIDcwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEwIiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI5NSIgY3k9Ijk1IiByPSIyMiIgZmlsbD0iIzEwYjk4MSIvPjxwYXRoIGQ9Ik04MyA5NSBMOTEgMTAzIEwxMDcgODciIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+
// @run-at       document-end
// @downloadURL  https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/RightClick.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/RightClick.user.js

// ==/UserScript==

(function() {
    'use strict';

    // ==================== 1. 配置与定义 ====================

    // 样式设计配置
    const DESIGN = {
        menuWidth: 240,
        borderRadius: 8,
        animationSpeed: 100,
        colors: {
            primary: '#3b82f6',
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            background: '#ffffff',
            hover: '#f3f4f6',
            border: '#e5e7eb',
            text: '#111827',
            subtitle: '#6b7280'
        },
        shadows: {
            menu: '0 6px 16px rgba(0, 0, 0, 0.12)',
            notification: '0 4px 12px rgba(0, 0, 0, 0.1)',
            modal: '0 10px 25px rgba(0, 0, 0, 0.15)'
        },
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    };

    // 默认功能配置 (V2.8)
    const DEFAULT_CONFIG = {
        version: 2.8,
        groups: {
            'link-actions': {
                id: 'link-actions',
                title: '链接操作',
                enabled: true,
                expanded: true,
                order: 1,
                items: [
                    { id: 'copy-link-text', enabled: true, order: 1 },
                    { id: 'copy-link-url', enabled: true, order: 2 },
                    { id: 'copy-text-url', enabled: true, order: 3 },
                    { id: 'save-link-file', enabled: true, order: 4 }
                ]
            },
            'image-actions': {
                id: 'image-actions',
                title: '图片操作',
                enabled: true,
                expanded: true,
                order: 2,
                items: [
                    { id: 'copy-image-clipboard', enabled: true, order: 1 },
                    { id: 'copy-image-url', enabled: true, order: 2 },
                    { id: 'open-image-new-tab', enabled: true, order: 3 },
                    { id: 'download-image', enabled: true, order: 4 }
                ]
            },
            'format-actions': {
                id: 'format-actions',
                title: '格式化复制',
                enabled: true,
                expanded: true,
                order: 3,
                items: [
                    { id: 'copy-markdown', enabled: true, order: 1 },
                    { id: 'copy-html', enabled: true, order: 2 },
                    { id: 'copy-bbcode', enabled: true, order: 3 },
                    { id: 'copy-markdown-image', enabled: true, order: 4 },
                    { id: 'copy-html-image', enabled: true, order: 5 }
                ]
            },
            'text-actions': {
                id: 'text-actions',
                title: '文本操作',
                enabled: true,
                expanded: true,
                order: 4,
                items: [
                    { id: 'copy-selected-text', enabled: true, order: 1 }
                ]
            },
            'web-actions': {
                id: 'web-actions',
                title: '网页操作',
                enabled: true,
                expanded: true,
                order: 5,
                items: [
                    { id: 'open-new-tab', enabled: true, order: 1 },
                    { id: 'copy-page-url', enabled: true, order: 2 },
                    { id: 'view-source', enabled: true, order: 3 }
                ]
            }
        }
    };

    // 菜单项元数据定义
    const MENU_ITEMS = {
        'copy-link-text': { icon: '📝', label: '复制链接文字', group: 'link-actions' },
        'copy-link-url': { icon: '🔗', label: '复制链接地址', group: 'link-actions' },
        'copy-text-url': { icon: '📄', label: '文字 + 链接', group: 'link-actions' },
        'save-link-file': { icon: '💾', label: '从链接另存文件为...', group: 'link-actions' },
        'copy-image-clipboard': { icon: '✂️', label: '复制图片到剪贴板', group: 'image-actions' },
        'copy-image-url': { icon: '🖼️', label: '复制图片地址', group: 'image-actions' },
        'open-image-new-tab': { icon: '➕', label: '新标签页打开图片', group: 'image-actions' },
        'download-image': { icon: '⬇️', label: '另存图片为...', group: 'image-actions' },
        'copy-markdown': { icon: '📋', label: 'Markdown链接', hint: '[文字](链接)', group: 'format-actions' },
        'copy-html': { icon: '🌐', label: 'HTML链接', hint: '&lt;a&gt;标签', group: 'format-actions' },
        'copy-bbcode': { icon: '📋', label: 'BBCode格式', hint: '[url]标签', group: 'format-actions' },
        'copy-markdown-image': { icon: '🖼️', label: 'Markdown图片', hint: '![文字](链接)', group: 'format-actions' },
        'copy-html-image': { icon: '🖼️', label: 'HTML图片', hint: '&lt;img&gt;标签', group: 'format-actions' },
        'copy-selected-text': { icon: '📋', label: '复制选中文字', group: 'text-actions' },
        'open-new-tab': { icon: '➕', label: '新标签页打开', group: 'web-actions' },
        'copy-page-url': { icon: '📄', label: '复制页面地址', group: 'web-actions' },
        'view-source': { icon: '📄', label: '查看源代码', hint: 'Ctrl+U', group: 'web-actions' }
    };

    // 状态变量
    let currentLink = null;
    let currentImage = null;
    let selectedText = '';
    let menuElement = null;
    let isMenuVisible = false;
    let config = null;

    // ==================== 2. 初始化流程 ====================

    function init() {
        loadConfig();
        injectStyles();
        createMenu();
        attachEventListeners();
        console.log('右键链接复制器 v2.8 已加载');
    }

    function loadConfig() {
        const savedConfig = GM_getValue('userConfig');
        if (savedConfig) {
            if (savedConfig.version < DEFAULT_CONFIG.version || !hasNewFeature(savedConfig)) {
                config = mergeConfig(savedConfig, DEFAULT_CONFIG);
                saveConfig();
            } else {
                config = savedConfig;
            }
        } else {
            config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            GM_setValue('userConfig', config);
        }
    }

    function hasNewFeature(conf) {
        const grp = conf.groups['image-actions'];
        return grp && grp.items && grp.items.some(i => i.id === 'copy-image-clipboard');
    }

    function mergeConfig(oldConf, newConf) {
        const merged = JSON.parse(JSON.stringify(oldConf));
        merged.version = newConf.version;
        Object.keys(newConf.groups).forEach(groupId => {
            if (!merged.groups[groupId]) {
                merged.groups[groupId] = JSON.parse(JSON.stringify(newConf.groups[groupId]));
            } else {
                const oldGroup = merged.groups[groupId];
                const newGroup = newConf.groups[groupId];
                newGroup.items.forEach(newItem => {
                    const exists = oldGroup.items.find(oldItem => oldItem.id === newItem.id);
                    if (!exists) {
                        oldGroup.items.unshift(newItem);
                        oldGroup.items.forEach((item, idx) => item.order = idx + 1);
                    }
                });
            }
        });
        return merged;
    }

    function saveConfig() {
        GM_setValue('userConfig', config);
    }

    // ==================== 3. 样式注入 (已修复CSS作用域问题) ====================

    function injectStyles() {
        const style = document.createElement('style');
        // 修复：给所有菜单相关样式添加 #link-menu 前缀，防止污染网页原生元素
        style.textContent = `
            #link-menu {
                position: fixed; z-index: 999999; background: ${DESIGN.colors.background};
                border-radius: ${DESIGN.borderRadius}px; box-shadow: ${DESIGN.shadows.menu};
                font-family: ${DESIGN.fontFamily}; width: ${DESIGN.menuWidth}px;
                opacity: 0; transform: scale(0.95); transition: all ${DESIGN.animationSpeed}ms ease-out;
                border: 1px solid ${DESIGN.colors.border}; overflow: hidden; display: none; padding: 4px 0;
            }
            #link-menu.visible { opacity: 1; transform: scale(1); }

            #link-menu .menu-group { padding: 2px 0; border-bottom: 1px solid ${DESIGN.colors.border}; }
            #link-menu .menu-group:last-child { border-bottom: none; }

            #link-menu .group-title {
                font-size: 10px; color: ${DESIGN.colors.subtitle}; padding: 4px 10px 2px;
                font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;
                display: flex; align-items: center; justify-content: space-between;
                user-select: none; height: 24px;
            }
            #link-menu .group-toggle {
                font-size: 9px; color: ${DESIGN.colors.primary}; cursor: pointer;
                padding: 1px 4px; border-radius: 2px; background: rgba(59, 130, 246, 0.1); line-height: 1.2;
            }

            #link-menu .menu-item {
                display: flex; align-items: center; gap: 8px; padding: 4px 10px; cursor: pointer;
                transition: background-color 0.15s ease; font-size: 12px; color: ${DESIGN.colors.text};
                background-color: ${DESIGN.colors.background}; min-height: 28px; height: 28px; line-height: 1.3;
            }
            #link-menu .menu-item:hover { background-color: ${DESIGN.colors.hover}; }
            #link-menu .menu-item.disabled { opacity: 0.5; pointer-events: none; }

            #link-menu .item-icon { width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: ${DESIGN.colors.primary}; }
            #link-menu .item-label { flex: 1; font-size: 12px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            #link-menu .item-hint {
                font-size: 10px; color: ${DESIGN.colors.subtitle}; margin-left: 6px; background: ${DESIGN.colors.hover};
                padding: 1px 4px; border-radius: 2px; flex-shrink: 0; line-height: 1.2;
            }
            #link-menu .menu-settings { margin-top: 2px; border-top: 1px solid ${DESIGN.colors.border}; padding-top: 2px; }

            /* 设置面板样式 */
            .link-menu-settings.settings-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5);
                z-index: 1000000; display: flex; align-items: center; justify-content: center;
                opacity: 0; transition: opacity 0.2s ease;
            }
            .link-menu-settings.settings-overlay.visible { opacity: 1; }
            .link-menu-settings .settings-panel {
                background: ${DESIGN.colors.background}; border-radius: ${DESIGN.borderRadius}px;
                box-shadow: ${DESIGN.shadows.modal}; width: 600px; max-width: 90vw; max-height: 80vh;
                overflow: hidden; display: flex; flex-direction: column; transform: translateY(-20px); transition: transform 0.2s ease;
            }
            .link-menu-settings.settings-overlay.visible .settings-panel { transform: translateY(0); }
            .link-menu-settings .settings-header { padding: 12px 16px; border-bottom: 1px solid ${DESIGN.colors.border}; display: flex; align-items: center; justify-content: space-between; }
            .link-menu-settings .settings-title { font-size: 14px; font-weight: 600; color: ${DESIGN.colors.text}; }
            .link-menu-settings .settings-close { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${DESIGN.colors.subtitle}; border-radius: 3px; font-size: 16px; }
            .link-menu-settings .settings-close:hover { background: ${DESIGN.colors.hover}; }
            .link-menu-settings .settings-content { padding: 12px; overflow-y: auto; flex: 1; }
            .link-menu-settings .settings-section { margin-bottom: 12px; }
            .link-menu-settings .section-title { font-size: 12px; font-weight: 600; color: ${DESIGN.colors.text}; margin-bottom: 6px; line-height: 1.2; }
            .link-menu-settings .settings-group { background: ${DESIGN.colors.hover}; border-radius: 4px; padding: 8px; margin-bottom: 8px; }
            .link-menu-settings .group-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); }
            .link-menu-settings .group-title-settings { font-size: 12px; font-weight: 600; color: ${DESIGN.colors.text}; line-height: 1.2; }
            .link-menu-settings .settings-items { display: flex; flex-direction: column; gap: 4px; }
            .link-menu-settings .settings-item-row {
                display: flex; align-items: center; padding: 6px 8px; background: ${DESIGN.colors.background};
                border-radius: 3px; border: 1px solid ${DESIGN.colors.border}; transition: all 0.2s ease;
                min-height: 32px; max-height: 32px; overflow: hidden;
            }
            .link-menu-settings .settings-item-row:hover { border-color: ${DESIGN.colors.primary}; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05); }
            .link-menu-settings .item-icon-settings { width: 16px; display: flex; align-items: center; justify-content: center; margin-right: 6px; font-size: 12px; flex-shrink: 0; }
            .link-menu-settings .item-label-settings { flex: 1; font-size: 11px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 4px; }
            .link-menu-settings .item-hint-settings {
                font-size: 9px; color: ${DESIGN.colors.subtitle}; background: rgba(0, 0, 0, 0.05); padding: 1px 3px;
                border-radius: 2px; line-height: 1.1; flex-shrink: 0; max-width: 100px; white-space: nowrap;
                overflow: hidden; text-overflow: ellipsis; margin-right: 12px;
            }
            .link-menu-settings .item-controls { display: flex; align-items: center; gap: 8px; min-width: 100px; justify-content: flex-end; }
            .link-menu-settings .order-controls { display: flex; flex-direction: row; gap: 2px; align-items: center; margin-right: 8px; }
            .link-menu-settings .order-btn {
                width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
                border: 1px solid ${DESIGN.colors.border}; background: ${DESIGN.colors.background}; color: ${DESIGN.colors.subtitle};
                cursor: pointer; border-radius: 2px; font-size: 8px; transition: all 0.2s ease; line-height: 1; flex-shrink: 0;
            }
            .link-menu-settings .order-btn:hover { background: ${DESIGN.colors.hover}; color: ${DESIGN.colors.primary}; border-color: ${DESIGN.colors.primary}; }
            .link-menu-settings .order-btn:disabled { opacity: 0.3; cursor: not-allowed; }
            .link-menu-settings .toggle-switch { position: relative; display: inline-block; width: 36px; height: 18px; flex-shrink: 0; }
            .link-menu-settings .toggle-switch input { opacity: 0; width: 0; height: 0; }
            .link-menu-settings .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 20px; }
            .link-menu-settings .toggle-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; }
            .link-menu-settings input:checked + .toggle-slider { background-color: ${DESIGN.colors.success}; }
            .link-menu-settings input:checked + .toggle-slider:before { transform: translateX(18px); }
            .link-menu-settings .group-controls { display: flex; gap: 4px; }
            .link-menu-settings .control-btn {
                padding: 6px 10px; border: 1px solid ${DESIGN.colors.border}; border-radius: 4px; background: ${DESIGN.colors.background};
                color: ${DESIGN.colors.text}; font-size: 12px; cursor: pointer; line-height: 1.2; font-weight: 500; transition: all 0.2s ease; min-height: 28px;
            }
            .link-menu-settings .control-btn:hover { background: ${DESIGN.colors.hover}; border-color: ${DESIGN.colors.primary}; color: ${DESIGN.colors.primary}; transform: translateY(-1px); }
            .link-menu-settings .control-btn:disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
            .link-menu-settings .settings-footer { padding: 12px 16px; border-top: 1px solid ${DESIGN.colors.border}; display: flex; justify-content: flex-end; gap: 10px; }
            .link-menu-settings .btn {
                padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
                border: 1px solid transparent; transition: all 0.2s ease; line-height: 1.2; min-height: 36px; min-width: 80px;
                display: flex; align-items: center; justify-content: center;
            }
            .link-menu-settings .btn-primary { background: ${DESIGN.colors.primary}; color: white; border-color: ${DESIGN.colors.primary}; }
            .link-menu-settings .btn-primary:hover { background: #2563eb; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transform: translateY(-1px); }
            .link-menu-settings .btn-secondary { background: ${DESIGN.colors.background}; color: ${DESIGN.colors.text}; border-color: ${DESIGN.colors.border}; }
            .link-menu-settings .btn-secondary:hover { background: ${DESIGN.colors.hover}; border-color: ${DESIGN.colors.primary}; color: ${DESIGN.colors.primary}; transform: translateY(-1px); }
            .link-menu-settings .btn-danger { background: ${DESIGN.colors.error}; color: white; border-color: ${DESIGN.colors.error}; }
            .link-menu-settings .btn-danger:hover { background: #dc2626; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transform: translateY(-1px); }

            /* 通知样式 */
            .link-menu-notification.menu-notification {
                position: fixed; top: 16px; right: 16px; background: ${DESIGN.colors.background};
                border-radius: 6px; box-shadow: ${DESIGN.shadows.notification}; padding: 8px 10px; z-index: 1000000;
                transform: translateX(120%); transition: transform 0.25s ease; border-left: 3px solid ${DESIGN.colors.primary};
                max-width: 240px; display: flex; align-items: flex-start; gap: 6px;
            }
            .link-menu-notification.menu-notification.show { transform: translateX(0); }
            .link-menu-notification.menu-notification.notification-success { border-left-color: ${DESIGN.colors.success}; }
            .link-menu-notification.menu-notification.notification-error { border-left-color: ${DESIGN.colors.error}; }
            .link-menu-notification.menu-notification.notification-warning { border-left-color: ${DESIGN.colors.warning}; }
            .link-menu-notification .notification-icon { width: 12px; height: 12px; flex-shrink: 0; font-weight: bold; font-size: 11px; margin-top: 1px; }
            .link-menu-notification .notification-content { flex: 1; }
            .link-menu-notification .notification-title { font-weight: 600; font-size: 11px; color: ${DESIGN.colors.text}; margin-bottom: 1px; }
            .link-menu-notification .notification-message { font-size: 10px; color: ${DESIGN.colors.subtitle}; line-height: 1.3; }

            @keyframes itemFadeIn { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }
            #link-menu .animate-in { animation: itemFadeIn 0.15s ease forwards; opacity: 0; }

            @media (max-width: 768px) {
                .link-menu-settings .settings-item-row { flex-wrap: wrap; gap: 4px; min-height: auto; max-height: none; padding: 4px 6px; }
                .link-menu-settings .item-hint-settings { margin-right: 0; order: 3; width: 100%; max-width: none; margin-top: 2px; }
                .link-menu-settings .item-controls { min-width: auto; margin-left: auto; order: 2; }
            }
        `;
        document.head.appendChild(style);
    }

    // ==================== 4. 菜单逻辑 ====================

    function createMenu() {
        const existingMenu = document.getElementById('link-menu');
        if (existingMenu) existingMenu.remove();
        menuElement = document.createElement('div');
        menuElement.id = 'link-menu';
        updateMenuContent();
        document.body.appendChild(menuElement);
    }

    function updateMenuContent() {
        if (!menuElement) return;
        const sortedGroups = Object.values(config.groups).filter(group => group.enabled).sort((a, b) => a.order - b.order);
        let menuHTML = '';

        sortedGroups.forEach(group => {
            const sortedItems = group.items.filter(item => item.enabled).sort((a, b) => a.order - b.order);
            if (sortedItems.length === 0) return;

            const shouldShowGroup = (groupId) => {
                if (groupId === 'text-actions') return !!(selectedText && selectedText.length > 0);
                if (groupId === 'image-actions') return !!(currentImage);
                if (groupId === 'format-actions') return true;
                return true;
            };
            if (!shouldShowGroup(group.id)) return;

            menuHTML += `
                <div class="menu-group" data-group="${group.id}">
                    <div class="group-title">
                        ${group.title}
                        <span class="group-toggle" data-action="toggle-group" data-group="${group.id}">
                            ${group.expanded ? '收起' : '展开'}
                        </span>
                    </div>
                    <div class="group-items" style="${group.expanded ? '' : 'display: none;'}">
            `;

            sortedItems.forEach(item => {
                const itemDef = MENU_ITEMS[item.id];
                if (!itemDef) return;

                if (currentImage && group.id === 'link-actions') {
                    const linkText = getLinkText(currentLink);
                    if ((item.id === 'copy-link-text' || item.id === 'copy-text-url') && !linkText) return;
                }

                if (group.id === 'format-actions') {
                    if (currentImage) {
                        if (!['copy-markdown-image', 'copy-html-image'].includes(item.id)) return;
                    } else {
                        if (['copy-markdown-image', 'copy-html-image'].includes(item.id)) return;
                    }
                }

                menuHTML += `
                    <div class="menu-item ${!item.enabled ? 'disabled' : ''}" data-action="${item.id}">
                        <div class="item-icon">${itemDef.icon}</div>
                        <div class="item-label">${itemDef.label}</div>
                        ${itemDef.hint ? `<div class="item-hint">${itemDef.hint}</div>` : ''}
                    </div>
                `;
            });
            menuHTML += `</div></div>`;
        });

        menuHTML += `<div class="menu-group menu-settings"><div class="menu-item" data-action="open-settings"><div class="item-icon">⚙️</div><div class="item-label">设置</div></div></div>`;
        menuElement.innerHTML = menuHTML;

        menuElement.querySelectorAll('.menu-item').forEach(item => item.addEventListener('click', handleMenuClick));
        menuElement.querySelectorAll('.group-toggle').forEach(btn => {
            btn.addEventListener('click', function(e) { e.stopPropagation(); toggleGroupExpanded(this.getAttribute('data-group')); });
        });
    }

    function toggleGroupExpanded(groupId) {
        if (!config.groups[groupId]) return;
        config.groups[groupId].expanded = !config.groups[groupId].expanded;
        saveConfig();
        updateMenuContent();
    }

    function attachEventListeners() {
        document.addEventListener('contextmenu', function(e) {
            const target = e.target;
            let link = target.closest('a');
            let image = null;

            if (target.tagName === 'IMG') {
                image = target;
                const parentLink = target.closest('a');
                if (parentLink) link = parentLink;
            } else {
                link = target.closest('a');
            }

            if (link || image) {
                e.preventDefault();
                e.stopPropagation();
                selectedText = window.getSelection().toString().trim();
                currentLink = link;
                currentImage = image;
                updateMenuContent();
                showMenu(e.clientX, e.clientY);
                return false;
            }
        }, true);

        document.addEventListener('click', function(e) { if (menuElement && !menuElement.contains(e.target) && isMenuVisible) hideMenu(); }, true);
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && isMenuVisible) { hideMenu(); e.preventDefault(); } });
        window.addEventListener('resize', function() { if (isMenuVisible) repositionMenu(); });
    }

    function showMenu(x, y) {
        if (!menuElement) return;
        menuElement.style.display = 'block';
        menuElement.style.left = x + 'px';
        menuElement.style.top = y + 'px';
        repositionMenu();
        setTimeout(() => {
            menuElement.classList.add('visible');
            isMenuVisible = true;
            setTimeout(() => {
                const items = menuElement.querySelectorAll('.menu-item:not([style*="display: none"])');
                items.forEach((item, index) => {
                    item.style.animationDelay = `${index * 0.012}s`;
                    item.classList.add('animate-in');
                });
            }, 10);
        }, 10);
    }

    function repositionMenu() {
        if (!menuElement) return;
        const rect = menuElement.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        let left = parseInt(menuElement.style.left) || 0;
        let top = parseInt(menuElement.style.top) || 0;
        if (left + rect.width > windowWidth) left = Math.max(10, windowWidth - rect.width - 10);
        if (top + rect.height > windowHeight) top = Math.max(10, windowHeight - rect.height - 10);
        menuElement.style.left = left + 'px';
        menuElement.style.top = top + 'px';
    }

    function hideMenu() {
        if (menuElement) {
            menuElement.classList.remove('visible');
            isMenuVisible = false;
            menuElement.querySelectorAll('.menu-item').forEach(item => { item.classList.remove('animate-in'); item.style.animationDelay = ''; });
            setTimeout(() => {
                if (!isMenuVisible) {
                    menuElement.style.display = 'none';
                    currentLink = null;
                    currentImage = null;
                    selectedText = '';
                }
            }, 100);
        }
    }

    function handleMenuClick(e) {
        const action = this.getAttribute('data-action');
        if (action === 'open-settings') { openSettings(); hideMenu(); return; }
        if (action === 'toggle-group') return;

        const itemConfig = findItemConfig(action);
        if (itemConfig && !itemConfig.enabled) {
            showNotification('功能已禁用', '该功能已在设置中禁用', 'warning');
            return;
        }

        if ((action.startsWith('copy-image-') || action === 'open-image-new-tab' || action === 'download-image') && !currentImage) {
            showNotification('错误', '没有找到图片', 'error');
            hideMenu();
            return;
        }

        switch(action) {
            case 'copy-link-text': copyLinkText(); break;
            case 'copy-link-url': copyLinkUrl(); break;
            case 'copy-text-url': copyTextAndUrl(); break;
            case 'save-link-file': saveLinkFile(); break;
            case 'copy-image-clipboard': copyImageToClipboard(); break;
            case 'copy-image-url': copyImageUrl(); break;
            case 'open-image-new-tab': openImageNewTab(); break;
            case 'download-image': downloadImage(); break;
            case 'copy-markdown': copyAsMarkdown(); break;
            case 'copy-html': copyAsHtml(); break;
            case 'copy-bbcode': copyAsBBCode(); break;
            case 'copy-markdown-image': copyAsMarkdownImage(); break;
            case 'copy-html-image': copyAsHtmlImage(); break;
            case 'copy-selected-text': copySelectedText(); break;
            case 'open-new-tab': openNewTab(); break;
            case 'copy-page-url': copyPageUrl(); break;
            case 'view-source': viewSource(); break;
        }
        hideMenu();
    }

    // ==================== 5. 辅助与核心功能 ====================

    function findItemConfig(itemId) {
        for (const group of Object.values(config.groups)) {
            const item = group.items.find(i => i.id === itemId);
            if (item) return item;
        }
        return null;
    }

    function getLinkText(link) {
        if (!link) return '';
        let text = link.innerText || link.textContent || '';
        text = text.replace(/\s+/g, ' ').trim();
        if (!text) {
            text = link.getAttribute('title') || link.getAttribute('aria-label') || link.querySelector('img[alt]')?.getAttribute('alt') || '';
        }
        return text;
    }

    function getImageInfo(img) {
        if (!img) return null;
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('srcset')?.split(',')[0]?.split(' ')[0];
        const alt = img.alt || img.title || img.getAttribute('aria-label') || '';
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        return { src, alt, width, height };
    }

    function extractFilename(url) {
        if(!url) return 'file';
        const parts = url.split('/');
        let name = parts[parts.length-1].split('?')[0].split('#')[0];
        if(!name) name = 'file_' + Date.now();
        return name;
    }

    function downloadFileWithSaveDialog(url, filename) {
        try {
            GM_download({
                url: url,
                name: filename,
                saveAs: true,
                onload: () => showNotification('下载完成', `已保存: ${filename}`, 'success'),
                onerror: (err) => {
                    console.error(err);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                }
            });
        } catch (e) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
        }
        showNotification('下载开始', `正在下载: ${filename}`);
    }

    // ==================== 图片复制核心功能 ====================

    function copyImageToClipboard() {
        if (!currentImage) {
            showNotification('错误', '未找到图片', 'error');
            return;
        }
        const imgInfo = getImageInfo(currentImage);
        if (!imgInfo || !imgInfo.src) {
            showNotification('错误', '无法获取图片地址', 'error');
            return;
        }
        showNotification('处理中', '正在获取图片数据...', 'warning');

        GM_xmlhttpRequest({
            method: "GET",
            url: imgInfo.src,
            responseType: "blob",
            onload: function(response) {
                if (response.status !== 200) {
                    showNotification('错误', '图片下载失败: ' + response.status, 'error');
                    return;
                }
                const blob = response.response;
                if (blob.type === 'image/png') {
                    writeBlobToClipboard(blob);
                } else {
                    convertBlobToPng(blob, function(pngBlob) {
                        if (pngBlob) {
                            writeBlobToClipboard(pngBlob);
                        } else {
                            showNotification('错误', '图片格式转换失败', 'error');
                        }
                    });
                }
            },
            onerror: function(err) {
                console.error(err);
                showNotification('错误', '网络请求失败，可能是跨域问题', 'error');
            }
        });
    }

    function convertBlobToPng(blob, callback) {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(function(pngBlob) {
                    URL.revokeObjectURL(url);
                    callback(pngBlob);
                }, 'image/png');
            } catch (e) {
                console.error('Canvas conversion failed', e);
                URL.revokeObjectURL(url);
                callback(null);
            }
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            callback(null);
        };
        img.src = url;
    }

    function writeBlobToClipboard(blob) {
        try {
            const item = new ClipboardItem({ [blob.type]: blob });
            navigator.clipboard.write([item]).then(() => {
                showNotification('成功', '图片已复制到剪贴板', 'success');
            }).catch(err => {
                console.error('Clipboard write failed:', err);
                showNotification('错误', '写入剪贴板失败 (浏览器限制)', 'error');
            });
        } catch (err) {
            console.error('ClipboardItem error:', err);
            showNotification('错误', '当前浏览器不支持此操作', 'error');
        }
    }

    // ==================== 功能实现 ====================
    function getRealFilename(url, cb) { cb(extractFilename(url), null); }

    function copyLinkText() { if(currentLink) GM_setClipboard(getLinkText(currentLink)); showNotification('复制成功', '已复制链接文字'); }
    function copyLinkUrl() { if(currentLink) GM_setClipboard(currentLink.href); showNotification('复制成功', '已复制链接地址'); }
    function copyTextAndUrl() { if(currentLink) GM_setClipboard(getLinkText(currentLink) + '\n' + currentLink.href); showNotification('复制成功', '已复制文字+链接'); }
    function saveLinkFile() {
        if(!currentLink) return;
        getRealFilename(currentLink.href, (name) => downloadFileWithSaveDialog(currentLink.href, name));
    }

    function copyImageUrl() {
        const info = getImageInfo(currentImage);
        if(info) { GM_setClipboard(info.src); showNotification('复制成功', '已复制图片地址'); }
    }
    function openImageNewTab() { const info = getImageInfo(currentImage); if(info) GM_openInTab(info.src, {active:true}); }
    function downloadImage() {
        const info = getImageInfo(currentImage);
        if(info) downloadFileWithSaveDialog(info.src, extractFilename(info.src));
    }

    function copyAsMarkdown() { if(currentLink) GM_setClipboard(`[${getLinkText(currentLink)}](${currentLink.href})`); showNotification('复制成功', 'Markdown'); }
    function copyAsHtml() { if(currentLink) GM_setClipboard(`<a href="${currentLink.href}">${getLinkText(currentLink)}</a>`); showNotification('复制成功', 'HTML'); }
    function copyAsBBCode() { if(currentLink) GM_setClipboard(`[url=${currentLink.href}]${getLinkText(currentLink)}[/url]`); showNotification('复制成功', 'BBCode'); }
    function copyAsMarkdownImage() { const info = getImageInfo(currentImage); if(info) GM_setClipboard(`![${info.alt}](${info.src})`); showNotification('复制成功', 'Markdown Image'); }
    function copyAsHtmlImage() { const info = getImageInfo(currentImage); if(info) GM_setClipboard(`<img src="${info.src}" alt="${info.alt}">`); showNotification('复制成功', 'HTML Image'); }

    function copySelectedText() { if(selectedText) GM_setClipboard(selectedText); showNotification('复制成功', '已复制选中文本'); }
    function openNewTab() { if(currentLink) GM_openInTab(currentLink.href, {active:true}); }
    function copyPageUrl() { GM_setClipboard(window.location.href); showNotification('复制成功', '已复制页面地址'); }
    function viewSource() { GM_openInTab(`view-source:${window.location.href}`, {active:true}); }

    function showNotification(title, message, type = 'success') {
        const oldNotification = document.querySelector('.link-menu-notification.menu-notification');
        if (oldNotification) oldNotification.remove();
        const notification = document.createElement('div');
        notification.className = `menu-notification notification-${type} link-menu-notification`;
        const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '⚠';
        notification.innerHTML = `<div class="notification-icon">${icon}</div><div class="notification-content"><div class="notification-title">${title}</div><div class="notification-message">${message}</div></div>`;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => { notification.classList.remove('show'); setTimeout(() => notification.remove(), 200); }, 1500);
    }

    // ==================== 6. 设置面板 (完整逻辑 - 修复分组排序) ====================

    function openSettings() {
        const overlay = document.createElement('div');
        overlay.className = 'settings-overlay link-menu-settings';

        overlay.innerHTML = `
            <div class="settings-panel">
                <div class="settings-header">
                    <div class="settings-title">右键链接复制器 - 设置</div>
                    <div class="settings-close">×</div>
                </div>
                <div class="settings-content">
                    <div class="settings-section">
                        <div class="section-title">
                            功能分组设置
                            <span style="font-size: 11px; color: ${DESIGN.colors.subtitle}; font-weight: normal;">
                                （点击上下箭头调整顺序，点击开关启用/禁用）
                            </span>
                        </div>
                        <div id="settings-groups"></div>
                    </div>
                </div>
                <div class="settings-footer">
                    <button class="btn btn-secondary" id="reset-settings">重置设置</button>
                    <button class="btn btn-primary" id="save-settings">保存设置</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        renderSettingsContent();

        setTimeout(() => { overlay.classList.add('visible'); }, 10);

        overlay.querySelector('.settings-close').onclick = closeSettings;
        overlay.querySelector('#save-settings').onclick = () => {
            saveSettingsFromUI();
            closeSettings();
            showNotification('设置已保存', '设置已成功保存并应用', 'success');
        };
        overlay.querySelector('#reset-settings').onclick = () => {
            if (confirm('确定要重置所有设置吗？这将恢复默认配置。')) {
                config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                saveConfig();
                renderSettingsContent();
                showNotification('设置已重置', '已恢复默认设置', 'success');
            }
        };
        overlay.onclick = (e) => { if (e.target === overlay) closeSettings(); };
    }

    function closeSettings() {
        const overlay = document.querySelector('.link-menu-settings.settings-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 200);
        }
    }

    function renderSettingsContent() {
        const groupsContainer = document.getElementById('settings-groups');
        if (!groupsContainer) return;

        const sortedGroups = Object.values(config.groups).sort((a, b) => a.order - b.order);
        groupsContainer.innerHTML = '';

        sortedGroups.forEach((group, index) => {
            const groupElement = document.createElement('div');
            groupElement.className = 'settings-group';

            // 修复：添加分组排序按钮
            const isFirst = index === 0;
            const isLast = index === sortedGroups.length - 1;

            groupElement.innerHTML = `
                <div class="group-header">
                    <div class="group-title-settings">${group.title}</div>
                    <div class="group-controls">
                        <button class="control-btn" data-action="move-group-up" data-group="${group.id}" ${isFirst ? 'disabled' : ''}>上移</button>
                        <button class="control-btn" data-action="move-group-down" data-group="${group.id}" ${isLast ? 'disabled' : ''}>下移</button>
                        <button class="control-btn" data-action="toggle-group-enabled" data-group="${group.id}">
                            ${group.enabled ? '禁用分组' : '启用分组'}
                        </button>
                    </div>
                </div>
                <div class="settings-items" id="items-${group.id}"></div>
            `;
            groupsContainer.appendChild(groupElement);

            // 分组项渲染
            const itemsContainer = groupElement.querySelector(`#items-${group.id}`);
            const sortedItems = group.items.sort((a, b) => a.order - b.order);

            sortedItems.forEach((item, itemIndex) => {
                const itemDef = MENU_ITEMS[item.id];
                if (!itemDef) return;

                const row = document.createElement('div');
                row.className = 'settings-item-row';
                const isItemFirst = itemIndex === 0;
                const isItemLast = itemIndex === sortedItems.length - 1;

                row.innerHTML = `
                    <div class="item-icon-settings">${itemDef.icon}</div>
                    <div class="item-label-settings">${itemDef.label}</div>
                    <div class="item-controls">
                        <div class="order-controls">
                            <button class="order-btn" data-action="move-item-up" data-group="${group.id}" data-item="${item.id}" title="上移" ${isItemFirst ? 'disabled' : ''}>↑</button>
                            <button class="order-btn" data-action="move-item-down" data-group="${group.id}" data-item="${item.id}" title="下移" ${isItemLast ? 'disabled' : ''}>↓</button>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" ${item.enabled ? 'checked' : ''} data-item="${item.id}" ${!group.enabled ? 'disabled' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `;
                itemsContainer.appendChild(row);
            });

            // 绑定事件
            groupElement.querySelector('[data-action="toggle-group-enabled"]').onclick = () => toggleGroupEnabled(group.id);
            groupElement.querySelector('[data-action="move-group-up"]').onclick = () => moveGroup(group.id, -1);
            groupElement.querySelector('[data-action="move-group-down"]').onclick = () => moveGroup(group.id, 1);
            groupElement.querySelectorAll('[data-action="move-item-up"]').forEach(btn => btn.onclick = function() { moveItem(this.dataset.group, this.dataset.item, -1); });
            groupElement.querySelectorAll('[data-action="move-item-down"]').forEach(btn => btn.onclick = function() { moveItem(this.dataset.group, this.dataset.item, 1); });
        });
    }

    function toggleGroupEnabled(groupId) {
        if (!config.groups[groupId]) return;
        config.groups[groupId].enabled = !config.groups[groupId].enabled;
        config.groups[groupId].items.forEach(item => { item.enabled = config.groups[groupId].enabled; });
        renderSettingsContent();
    }

    // 新增：移动分组逻辑
    function moveGroup(groupId, direction) {
        const groupsArr = Object.values(config.groups).sort((a, b) => a.order - b.order);
        const idx = groupsArr.findIndex(g => g.id === groupId);

        if ((direction === -1 && idx > 0) || (direction === 1 && idx < groupsArr.length - 1)) {
            const tempOrder = groupsArr[idx].order;
            groupsArr[idx].order = groupsArr[idx + direction].order;
            groupsArr[idx + direction].order = tempOrder;
            saveConfig(); // 保存配置
            renderSettingsContent(); // 刷新设置面板
            updateMenuContent(); // 刷新实际菜单
        }
    }

    function moveItem(groupId, itemId, direction) {
        const group = config.groups[groupId];
        if (!group) return;
        const items = group.items.sort((a, b) => a.order - b.order);
        const idx = items.findIndex(item => item.id === itemId);

        if ((direction === -1 && idx > 0) || (direction === 1 && idx < items.length - 1)) {
            const tempOrder = items[idx].order;
            items[idx].order = items[idx + direction].order;
            items[idx + direction].order = tempOrder;
            renderSettingsContent();
        }
    }

    function saveSettingsFromUI() {
        document.querySelectorAll('.link-menu-settings .toggle-switch input').forEach(checkbox => {
            const itemId = checkbox.getAttribute('data-item');
            if (checkbox.disabled) return;
            for (const group of Object.values(config.groups)) {
                const item = group.items.find(item => item.id === itemId);
                if (item) item.enabled = checkbox.checked;
            }
        });
        saveConfig();
        updateMenuContent();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
