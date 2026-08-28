// ==UserScript==
// @name         网页表格提取助手
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  表格提取/附件下载/数据聚合 - 支持嵌套iframe和动态表格，新增长数字文本化选项与表格快捷导出按钮
// @author       MRBANK (modified)
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getResourceText
// @grant        GM_addElement
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @icon         data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgMTBIMjhWMjhINFYxMFoiIGZpbGw9IiMzNjZGRkEiLz4KPHBhdGggZD0iTTQgMTBIMjhWMjBINFYxMFoiIGZpbGw9IiMxRTg0RkIiLz4KPHBhdGggZD0iTTEwIDEwVjI4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTE2IDEwVjI4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTIyIDEwVjI4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTQgMTRIMjhWMThINFYxNFoiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjUiLz4KPHBhdGggZD0iTTQgMTBIMjhWMTRINFYxMFoiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjUiLz4KPHBhdGggZD0iTTQgMjJIMjhWMjZINFYyMloiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjUiLz4KPHBhdGggZD0iTTQgMThIMjhWMjJINFYxOFoiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjUiLz4KPHBhdGggZD0iTTYgOEgyNlYxMEg2VjhaIiBmaWxsPSIjMUU4NEZCIi8+CjxwYXRoIGQ9Ik02IDZIMjZWOFYxMEg2VjZaIiBmaWxsPSIjMkE5MkZGIi8+Cjwvc3ZnPg==
// @license      MIT
// @run-at       document-end
// @downloadURL  https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/web-table-extraction.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/web-table-extraction.user.js
// ==/UserScript==

(function() {
    'use strict';

    // 全局配置
    const CONFIG = {
        version: '2.3',
        lastScannedTables: [],
        selectedFileTypes: new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.mp3', '.mp4', '.avi', '.wmv', '.mov', '.flv', '.wav']),
        customFileTypes: new Set(),
        currentModal: null,
        modalHistory: [],
        lastHighlightedTables: new Set(),
        lastPreviewTable: null,
        lastExportTable: null,
        scanInProgress: false,
        // 新增配置
        iframeScanDepth: 3, // iframe嵌套深度限制
        dynamicDataTimeout: 3000, // 动态数据等待超时
        observerEnabled: false, // 是否启用MutationObserver
        maxIframesToScan: 20, // 最大iframe扫描数量
        // 超链接导出配置
        exportLinks: true, // 是否导出超链接
        linkFormat: 'excel', // 链接格式：excel, markdown, html
        // ========== 新增：长数字文本化选项 ==========
        exportLongNumbersAsText: true, // 是否将超过11位的数字作为文本导出（防止Excel精度丢失）
        // =========================================
    };

    // 默认文件类型
    const DEFAULT_FILE_TYPES = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf',
        '.mp3', '.mp4', '.avi', '.wmv', '.mov', '.flv', '.wav'
    ];

    // 注册菜单命令（取消监控动态表格和聚合数据）
    GM_registerMenuCommand('📊 扫描表格', () => {
        showScanModal();
    }, 's');

    GM_registerMenuCommand('📥 批量下载附件', () => {
        showBatchDownloadModal();
    }, 'd');

    GM_registerMenuCommand('⚙️ 设置', () => {
        showEnhancedSettingsModal();
    }, 'o');

    GM_registerMenuCommand('ℹ️ 帮助', () => {
        showHelpModal();
    }, 'h');

    // 初始化
    function init() {
        console.log('网页表格提取助手 v' + CONFIG.version + ' 正在初始化...');

        try {
            // 加载配置
            loadConfig();

            // 添加样式
            addStyles();

            // 创建必要的UI组件
            createModalContainer();

            // 绑定全局事件
            bindGlobalEvents();

            // 初始化动态表格监控
            initTableObserver();

            console.log('网页表格提取助手 初始化成功！');
            console.log('提示：按 Alt+S 扫描表格，Alt+D 批量下载');

            // 延迟扫描表格
            setTimeout(() => {
                try {
                    const tables = scanTablesInDocument(document, false);
                    if (tables.length > 0) {
                        console.log(`发现 ${tables.length} 个表格`);
                    }
                } catch (e) {
                    console.log('静默扫描失败:', e);
                }
            }, 2000);

        } catch (error) {
            console.error('网页表格提取助手 初始化失败:', error);
        }
    }

    // 在DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // 如果DOM已经加载完成，直接初始化
        setTimeout(init, 100);
    }

    // ========== 表格扫描功能 ==========

    // 增强的表格扫描 - 支持iframe嵌套和动态表格
    function enhancedScanTables(options = {}) {
        const {
            scanIframes = true,
            maxDepth = CONFIG.iframeScanDepth,
            includeHidden = false,
            waitForDynamic = false
        } = options;

        const allTables = [];
        const visitedFrames = new Set();
        let iframeCount = 0;

        // 扫描主文档
        const mainTables = scanTablesInDocument(document, includeHidden);
        mainTables.forEach(table => {
            allTables.push({
                element: table,
                document: document,
                depth: 0,
                source: '主文档'
            });
        });

        // 如果需要扫描iframe
        if (scanIframes) {
            const scanFrame = (doc, depth, path) => {
                if (depth > maxDepth || iframeCount >= CONFIG.maxIframesToScan) {
                    return;
                }

                try {
                    const frames = doc.querySelectorAll('iframe, frame');

                    frames.forEach(frame => {
                        if (iframeCount >= CONFIG.maxIframesToScan) return;

                        try {
                            // 跳过已访问的iframe
                            if (visitedFrames.has(frame)) return;
                            visitedFrames.add(frame);

                            // 检查iframe是否可见
                            const frameStyle = window.getComputedStyle(frame);
                            if (frameStyle.display === 'none' || frameStyle.visibility === 'hidden') {
                                return;
                            }

                            // 尝试获取iframe的内容文档
                            let frameDoc = null;
                            try {
                                frameDoc = frame.contentDocument || frame.contentWindow.document;
                            } catch (e) {
                                // 跨域iframe，尝试其他方法
                                console.log('无法访问跨域iframe:', frame.src);
                                return;
                            }

                            if (!frameDoc || !frameDoc.body) {
                                // iframe可能未加载完成
                                if (waitForDynamic) {
                                    setTimeout(() => {
                                        try {
                                            const loadedDoc = frame.contentDocument || frame.contentWindow.document;
                                            if (loadedDoc && loadedDoc.body) {
                                                scanLoadedIframe(frame, loadedDoc, depth + 1, path);
                                            }
                                        } catch (e) {
                                            // 忽略错误
                                        }
                                    }, 500);
                                }
                                return;
                            }

                            scanLoadedIframe(frame, frameDoc, depth + 1, path);

                        } catch (e) {
                            console.log('扫描iframe时出错:', e);
                        }
                    });

                } catch (e) {
                    console.log('扫描文档中的iframe时出错:', e);
                }
            };

            const scanLoadedIframe = (frame, frameDoc, depth, path) => {
                iframeCount++;

                const frameInfo = {
                    src: frame.src || '无src',
                    name: frame.name || '未命名',
                    id: frame.id || '无id'
                };

                const currentPath = path ? `${path} → ${frameInfo.name}` : frameInfo.name;

                // 扫描iframe内的表格
                const frameTables = scanTablesInDocument(frameDoc, includeHidden);
                frameTables.forEach(table => {
                    allTables.push({
                        element: table,
                        document: frameDoc,
                        depth: depth,
                        source: currentPath,
                        frameInfo: frameInfo
                    });
                });

                // 递归扫描嵌套的iframe
                scanFrame(frameDoc, depth + 1, currentPath);
            };

            // 开始扫描iframe
            scanFrame(document, 1, '');

            // 如果启用了动态等待，尝试等待iframe加载
            if (waitForDynamic) {
                setTimeout(() => {
                    scanFrame(document, 1, '');
                }, 1000);
            }
        }

        CONFIG.lastScannedTables = allTables;
        return allTables;
    }

    // 在文档中扫描表格
    function scanTablesInDocument(doc, includeHidden = false) {
        try {
            const tables = Array.from(doc.querySelectorAll('table')).filter(table => {
                try {
                    const style = window.getComputedStyle(table);
                    const isVisible = includeHidden || (
                        style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        table.offsetWidth > 50 &&
                        table.offsetHeight > 30
                    );

                    // 检查是否为数据表格（排除布局表格）
                    const isDataTable = isDataTableHeuristic(table);

                    return isVisible && isDataTable;
                } catch (e) {
                    return false;
                }
            });

            return tables;
        } catch (e) {
            console.log('扫描文档表格时出错:', e);
            return [];
        }
    }

    // 检查表格是否在编辑器内部（contenteditable、textarea、富文本编辑器等）
    function isInsideEditor(table) {
        try {
            let el = table.parentElement;
            while (el && el !== document.body) {
                const tag = el.tagName;
                // 排除 contenteditable 元素
                if (el.contentEditable === 'true' || el.getAttribute('contenteditable') === 'true') return true;
                // 排除 textarea
                if (tag === 'TEXTAREA') return true;
                // 排除常见的编辑器容器类名/ID
                const cls = (el.className || '').toLowerCase();
                const id = (el.id || '').toLowerCase();
                if (/editor|eeditor|wysiwyg|tinymce|ckeditor|ueditor|kindeditor|simditor|quill|prosemirror|draftjs|contenteditable|compose|write|reply|postform|fastpost|postbox/.test(cls) ||
                    /editor|eeditor|wysiwyg|tinymce|ckeditor|ueditor|kindeditor|compose|write|reply|postform|fastpost|postbox/.test(id)) {
                    return true;
                }
                // 排除 role="textbox"
                if (el.getAttribute('role') === 'textbox') return true;
                // 排除 Discuz 特有的编辑区域
                if (el.getAttribute('id') === 'postform' || el.classList.contains('p_pst')) return true;
                el = el.parentElement;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    // 启发式判断是否为数据表格
    function isDataTableHeuristic(table) {
        try {
            // 排除编辑器内部的表格
            if (isInsideEditor(table)) return false;

            // 检查是否有足够的行和列
            const rows = table.rows.length;
            if (rows < 1) return false;

            // 检查是否有真正的 th 表头（而不是仅检查是否有 cells）
            const hasRealHeader = table.querySelector('th') !== null;
            const hasCells = table.rows[0] && table.rows[0].cells.length > 0;

            // 检查是否有数据单元格
            let dataCellCount = 0;
            for (let i = 0; i < Math.min(rows, 10); i++) {
                if (table.rows[i]) {
                    dataCellCount += table.rows[i].cells.length;
                }
            }

            // 检查表格结构
            const structureScore = calculateTableStructureScore(table);

            // 提高判断门槛：需要真正的 th 表头 + 足够单元格，或更高的结构评分
            return (hasRealHeader && dataCellCount > 3) || structureScore > 0.5;
        } catch (e) {
            return false; // 出错时默认排除，避免误判
        }
    }

    // 计算表格结构评分
    function calculateTableStructureScore(table) {
        let score = 0;

        try {
            // 检查是否有thead、tbody、tfoot
            if (table.tHead) score += 0.2;
            if (table.tBodies.length > 0) score += 0.2;
            if (table.tFoot) score += 0.1;

            // 检查是否有colgroup
            if (table.querySelector('colgroup')) score += 0.1;

            // 检查是否有caption
            if (table.caption) score += 0.1;

            // 检查行和列的一致性
            const rows = table.rows;
            if (rows.length > 0) {
                const colCounts = [];
                for (let i = 0; i < Math.min(rows.length, 5); i++) {
                    if (rows[i]) {
                        colCounts.push(rows[i].cells.length);
                    }
                }

                // 计算列数的一致性
                const avgCols = colCounts.reduce((a, b) => a + b, 0) / colCounts.length;
                const variance = colCounts.reduce((sum, count) => sum + Math.pow(count - avgCols, 2), 0) / colCounts.length;
                const consistency = Math.max(0, 1 - (variance / avgCols));

                score += consistency * 0.4;
            }
        } catch (e) {
            // 忽略错误
        }

        return Math.min(score, 1);
    }

    // ========== 配置管理 ==========
    function loadConfig() {
        try {
            // 加载自定义文件类型
            const savedCustomTypes = GM_getValue('customFileTypes');
            if (savedCustomTypes && Array.isArray(savedCustomTypes)) {
                CONFIG.customFileTypes = new Set(savedCustomTypes);
                savedCustomTypes.forEach(type => {
                    CONFIG.selectedFileTypes.add(type);
                });
            }

            // 加载增强设置
            const enhancedSettings = GM_getValue('enhancedSettings');
            if (enhancedSettings) {
                CONFIG.iframeScanDepth = enhancedSettings.iframeScanDepth || 3;
                CONFIG.maxIframesToScan = enhancedSettings.maxIframesToScan || 20;
                CONFIG.dynamicDataTimeout = enhancedSettings.dynamicDataTimeout || 3000;
                CONFIG.observerEnabled = enhancedSettings.observerEnabled === true;
                CONFIG.exportLinks = enhancedSettings.exportLinks !== false;
                CONFIG.linkFormat = enhancedSettings.linkFormat || 'excel';
                // ========== 新增：加载长数字文本化选项 ==========
                CONFIG.exportLongNumbersAsText = enhancedSettings.exportLongNumbersAsText !== false;
                // =============================================
            }
        } catch (e) {
            console.error('加载配置失败:', e);
        }
    }

    function saveConfig() {
        try {
            GM_setValue('customFileTypes', Array.from(CONFIG.customFileTypes));
        } catch (e) {
            console.error('保存配置失败:', e);
        }
    }

    // ========== 样式管理 ==========
    function addStyles() {
        const styles = `
            /* 模态框容器 */
            #data-liberator-modal-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000000;
                pointer-events: none;
                background: rgba(0, 0, 0, 0.5);
            }

            /* 模态框 */
            #data-liberator-modal-container .dl-modal {
                background: white;
                border-radius: 10px;
                max-width: 800px;
                width: 90%;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: dl-modal-in 0.3s ease;
                pointer-events: auto;
                position: relative;
                z-index: 1000001;
            }

            @keyframes dl-modal-in {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }

            /* 优化后的模态框头部布局 */
            #data-liberator-modal-container .dl-modal-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            #data-liberator-modal-container .dl-modal-title {
                font-size: 18px;
                font-weight: bold;
                flex: 1;
                text-align: center;
            }

            /* 优化后的关闭按钮 */
            #data-liberator-modal-container .dl-modal-close {
                background: rgba(255,255,255,0.2);
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: white;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                padding: 0;
                transition: all 0.3s ease;
                font-weight: bold;
                margin-left: 10px;
            }

            #data-liberator-modal-container .dl-modal-close:hover {
                background: rgba(255,255,255,0.3);
                transform: scale(1.1);
            }

            /* 优化后的返回按钮 */
            #data-liberator-modal-container .dl-modal-back {
                background: rgba(255,255,255,0.2);
                border: none;
                font-size: 14px;
                cursor: pointer;
                color: white;
                padding: 8px 16px;
                margin-right: 10px;
                display: flex;
                align-items: center;
                border-radius: 6px;
                transition: all 0.3s ease;
                font-weight: 600;
            }

            #data-liberator-modal-container .dl-modal-back:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-2px);
            }

            #data-liberator-modal-container .dl-modal-back::before {
                content: '←';
                margin-right: 8px;
                font-weight: bold;
                font-size: 16px;
            }

            #data-liberator-modal-container .dl-modal-body {
                padding: 20px;
                max-height: 60vh;
                overflow-y: auto;
            }

            #data-liberator-modal-container .dl-modal-footer {
                padding: 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }

            /* 按钮 */
            #data-liberator-modal-container .dl-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
                transition: all 0.2s;
                min-width: 100px;
            }

            #data-liberator-modal-container .dl-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            #data-liberator-modal-container .dl-btn-secondary {
                background: #6c757d;
                color: white;
            }

            #data-liberator-modal-container .dl-btn-success {
                background: #28a745;
                color: white;
            }

            #data-liberator-modal-container .dl-btn-warning {
                background: #ffc107;
                color: #212529;
            }

            #data-liberator-modal-container .dl-btn-danger {
                background: #dc3545;
                color: white;
            }

            #data-liberator-modal-container .dl-btn:hover:not(:disabled) {
                opacity: 0.9;
                transform: translateY(-1px);
            }

            #data-liberator-modal-container .dl-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            /* 表格高亮 */
            .dl-table-highlight {
                outline: 3px solid #4CAF50 !important;
                outline-offset: 2px !important;
                position: relative !important;
                z-index: 9999 !important;
                transition: outline 0.3s ease !important;
            }

            .dl-table-highlight::after {
                content: '📊';
                position: absolute;
                top: -15px;
                right: -15px;
                background: #4CAF50;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                z-index: 10000;
            }

            /* 持久化高亮状态 */
            .dl-table-highlight-persist {
                outline: 3px solid #4CAF50 !important;
                outline-offset: 2px !important;
                position: relative !important;
                z-index: 9999 !important;
                transition: outline 0.3s ease !important;
            }

            .dl-table-highlight-persist::after {
                content: '📊';
                position: absolute;
                top: -15px;
                right: -15px;
                background: #4CAF50;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                z-index: 10000;
            }

            /* 进度条 */
            #data-liberator-modal-container .dl-progress {
                width: 100%;
                height: 20px;
                background: #f0f0f0;
                border-radius: 10px;
                overflow: hidden;
                margin: 10px 0;
            }

            #data-liberator-modal-container .dl-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #8BC34A);
                transition: width 0.3s ease;
                width: 0%;
            }

            /* 文件格式选择器 */
            #data-liberator-modal-container .dl-file-types {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin: 15px 0;
            }

            #data-liberator-modal-container .dl-file-type-item {
                padding: 8px 15px;
                border: 1px solid #ddd;
                border-radius: 20px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                position: relative;
            }

            #data-liberator-modal-container .dl-file-type-item:hover {
                background: #f0f7ff;
                border-color: #667eea;
            }

            #data-liberator-modal-container .dl-file-type-item.selected {
                background: #667eea;
                color: white;
                border-color: #667eea;
            }

            #data-liberator-modal-container .dl-file-type-item.custom {
                border-style: dashed;
                border-color: #ff9800;
            }

            #data-liberator-modal-container .dl-file-type-item.custom.selected {
                background: #ff9800;
                color: white;
                border-color: #ff9800;
            }

            #data-liberator-modal-container .remove-custom-format {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ff4757;
                color: white;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.2s;
            }

            #data-liberator-modal-container .dl-file-type-item.custom:hover .remove-custom-format {
                opacity: 1;
            }

            /* 文件列表 */
            #data-liberator-modal-container .dl-file-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid #eee;
                border-radius: 5px;
                margin: 15px 0;
            }

            #data-liberator-modal-container .dl-file-item {
                padding: 12px;
                border-bottom: 1px solid #eee;
                display: flex;
                align-items: center;
                transition: background 0.2s;
            }

            #data-liberator-modal-container .dl-file-item:hover {
                background: #f9f9f9;
            }

            #data-liberator-modal-container .dl-file-item:last-child {
                border-bottom: none;
            }

            #data-liberator-modal-container .dl-file-checkbox {
                margin-right: 10px;
            }

            #data-liberator-modal-container .dl-file-icon {
                font-size: 20px;
                margin-right: 10px;
                width: 24px;
                text-align: center;
            }

            #data-liberator-modal-container .dl-file-info {
                flex: 1;
                overflow: hidden;
            }

            #data-liberator-modal-container .dl-file-name {
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            #data-liberator-modal-container .dl-file-url {
                font-size: 12px;
                color: #666;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* 表格预览 */
            #data-liberator-modal-container .dl-table-preview {
                max-height: 300px;
                overflow: auto;
                border: 1px solid #ddd;
                border-radius: 5px;
                margin: 15px 0;
            }

            #data-liberator-modal-container .dl-table-preview table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            }

            #data-liberator-modal-container .dl-table-preview th {
                background: #f8f9fa;
                font-weight: bold;
                padding: 8px;
                border: 1px solid #ddd;
                text-align: left;
            }

            #data-liberator-modal-container .dl-table-preview td {
                padding: 8px;
                border: 1px solid #ddd;
            }

            /* 配置组 */
            #data-liberator-modal-container .dl-config-group {
                margin-bottom: 20px;
            }

            #data-liberator-modal-container .dl-config-label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #333;
            }

            #data-liberator-modal-container .dl-config-input {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 14px;
            }

            #data-liberator-modal-container .dl-config-select {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 14px;
                background: white;
            }

            /* 状态消息 */
            #data-liberator-modal-container .dl-status {
                padding: 12px;
                border-radius: 5px;
                margin: 10px 0;
                display: none;
            }

            #data-liberator-modal-container .dl-status.show {
                display: block;
            }

            #data-liberator-modal-container .dl-status-success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }

            #data-liberator-modal-container .dl-status-error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }

            #data-liberator-modal-container .dl-status-info {
                background: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5eb;
            }

            /* 选项卡 */
            #data-liberator-modal-container .dl-tabs {
                display: flex;
                border-bottom: 1px solid #ddd;
                margin-bottom: 20px;
            }

            #data-liberator-modal-container .dl-tab {
                padding: 10px 20px;
                cursor: pointer;
                border: 1px solid transparent;
                border-bottom: none;
                border-radius: 5px 5px 0 0;
                margin-right: 5px;
                transition: all 0.2s;
            }

            #data-liberator-modal-container .dl-tab:hover {
                background: #f5f5f5;
            }

            #data-liberator-modal-container .dl-tab.active {
                background: white;
                border-color: #ddd #ddd white #ddd;
                font-weight: bold;
                color: #667eea;
            }

            #data-liberator-modal-container .dl-tab-content {
                display: none;
            }

            #data-liberator-modal-container .dl-tab-content.active {
                display: block;
            }

            /* 表格列表 */
            #data-liberator-modal-container .dl-table-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid #eee;
                border-radius: 5px;
            }

            #data-liberator-modal-container .dl-table-item {
                padding: 15px;
                border-bottom: 1px solid #eee;
                transition: all 0.2s;
                cursor: pointer;
            }

            #data-liberator-modal-container .dl-table-item:hover {
                background: #f8f9fa;
            }

            #data-liberator-modal-container .dl-table-item.selected {
                background: #e8f5e9;
                border-left: 4px solid #4CAF50;
            }

            #data-liberator-modal-container .dl-table-item:last-child {
                border-bottom: none;
            }

            #data-liberator-modal-container .dl-table-title {
                font-weight: 600;
                margin-bottom: 5px;
            }

            #data-liberator-modal-container .dl-table-info {
                font-size: 12px;
                color: #666;
                display: flex;
                gap: 15px;
                margin-bottom: 10px;
            }

            /* 表格操作按钮 */
            #data-liberator-modal-container .dl-table-actions {
                display: flex;
                gap: 10px;
                margin-top: 10px;
            }

            #data-liberator-modal-container .dl-table-action-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s;
            }

            #data-liberator-modal-container .dl-table-action-highlight {
                background: #4CAF50;
                color: white;
            }

            #data-liberator-modal-container .dl-table-action-preview {
                background: #2196F3;
                color: white;
            }

            #data-liberator-modal-container .dl-table-action-export {
                background: #FF9800;
                color: white;
            }

            #data-liberator-modal-container .dl-table-action-btn:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }

            /* 批量下载设置 */
            #data-liberator-modal-container .dl-batch-settings {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin: 15px 0;
            }

            #data-liberator-modal-container .dl-setting-row {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
            }

            #data-liberator-modal-container .dl-setting-label {
                width: 120px;
                font-weight: 600;
            }

            #data-liberator-modal-container .dl-setting-value {
                flex: 1;
            }

            /* 扫描指示器 */
            .dl-scanning-indicator {
                position: fixed;
                top: 10px;
                right: 10px;
                background: #667eea;
                color: white;
                padding: 8px 15px;
                border-radius: 20px;
                font-size: 12px;
                z-index: 1000003;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            }

            .dl-scanning-indicator .spinner {
                width: 12px;
                height: 12px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: dl-spin 1s linear infinite;
            }

            @keyframes dl-spin {
                to { transform: rotate(360deg); }
            }

            /* 帮助内容 */
            #data-liberator-modal-container .dl-help-content {
                line-height: 1.6;
            }

            #data-liberator-modal-container .dl-help-section {
                margin-bottom: 20px;
            }

            #data-liberator-modal-container .dl-help-title {
                font-weight: bold;
                color: #667eea;
                margin-bottom: 10px;
                font-size: 16px;
            }

            #data-liberator-modal-container .dl-help-list {
                padding-left: 20px;
                margin: 10px 0;
            }

            #data-liberator-modal-container .dl-help-list li {
                margin-bottom: 5px;
            }

            /* 响应式调整 */
            @media (max-width: 768px) {
                #data-liberator-modal-container .dl-modal {
                    width: 95%;
                    max-height: 95vh;
                }

                #data-liberator-modal-container .dl-btn {
                    min-width: auto;
                    padding: 8px 15px;
                }

                #data-liberator-modal-container .dl-table-actions {
                    flex-direction: column;
                }

                #data-liberator-modal-container .dl-modal-header {
                    flex-wrap: wrap;
                }

                #data-liberator-modal-container .dl-modal-title {
                    order: 2;
                    width: 100%;
                    margin-top: 10px;
                    margin-bottom: 10px;
                }

                #data-liberator-modal-container .dl-modal-back {
                    order: 1;
                }

                #data-liberator-modal-container .dl-modal-close {
                    order: 3;
                }
            }

            /* 动态表格相关样式 */
            .dl-dynamic-table {
                position: relative;
            }

            .dl-dynamic-table::before {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border: 2px dashed #ff9800;
                border-radius: 5px;
                pointer-events: none;
                opacity: 0.5;
                z-index: 9998;
            }

            .dl-table-updated {
                animation: dl-table-update 1s ease;
            }

            @keyframes dl-table-update {
                0% { background-color: transparent; }
                25% { background-color: rgba(255, 235, 59, 0.3); }
                100% { background-color: transparent; }
            }

            .dl-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 5px;
                color: white;
                font-weight: bold;
                z-index: 1000003;
                animation: dl-notification-in 0.3s ease;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            }

            @keyframes dl-notification-in {
                from { opacity: 0; transform: translateX(100px); }
                to { opacity: 1; transform: translateX(0); }
            }

            @keyframes dl-notification-out {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100px); }
            }

            .dl-notification-success {
                background: #4CAF50;
            }

            .dl-notification-error {
                background: #f44336;
            }

            .dl-notification-warning {
                background: #ff9800;
            }

            .dl-notification-info {
                background: #2196F3;
            }

            /* 增强表格项样式 */
            #data-liberator-modal-container .dl-table-item .table-source {
                font-size: 12px;
                color: #666;
                margin-left: 10px;
                font-style: italic;
            }

            /* 深度指示器 */
            #data-liberator-modal-container .depth-indicator {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 5px;
                background: #ddd;
            }

            #data-liberator-modal-container .depth-1 { background: #4CAF50; }
            #data-liberator-modal-container .depth-2 { background: #2196F3; }
            #data-liberator-modal-container .depth-3 { background: #ff9800; }
            #data-liberator-modal-container .depth-4 { background: #f44336; }
            #data-liberator-modal-container .depth-5 { background: #9C27B0; }

            /* iframe相关样式 */
            #data-liberator-modal-container .iframe-info {
                font-size: 11px;
                color: #666;
                padding: 2px 6px;
                background: #f0f0f0;
                border-radius: 3px;
                margin-left: 10px;
            }

            /* 隐藏表格标识 */
            #data-liberator-modal-container .hidden-table-marker {
                color: #ff9800;
                font-size: 12px;
                margin-left: 10px;
            }

            /* ========== 新增：表格右上角导出按钮样式 ========== */
            .dl-table-export-btn {
                position: absolute !important;
                top: 0 !important;
                right: 0 !important;
                z-index: 10001 !important;
                background: #4CAF50 !important;
                color: white !important;
                border: none !important;
                border-radius: 4px !important;
                padding: 4px 8px !important;
                font-size: 12px !important;
                font-weight: bold !important;
                cursor: pointer !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
                transition: all 0.2s !important;
                margin: 5px !important;
                line-height: 1 !important;
                opacity: 0.9 !important;
            }
            .dl-table-export-btn:hover {
                background: #45a049 !important;
                transform: scale(1.05) !important;
                opacity: 1 !important;
            }
            /* 确保表格相对定位以便按钮绝对定位 */
            .dl-table-with-export-btn {
                position: relative !important;
            }
            /* =============================================== */
        `;

        try {
            GM_addStyle(styles);
        } catch (e) {
            // 如果GM_addStyle失败，尝试直接注入样式
            const styleElement = document.createElement('style');
            styleElement.textContent = styles;
            document.head.appendChild(styleElement);
        }
    }

    // ========== UI 组件创建 ==========
    function createModalContainer() {
        // 如果容器已存在，先移除
        const existingContainer = document.getElementById('data-liberator-modal-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        const modalContainer = document.createElement('div');
        modalContainer.id = 'data-liberator-modal-container';
        modalContainer.style.display = 'none'; // 初始隐藏
        document.body.appendChild(modalContainer);
        return modalContainer;
    }

    // ========== 事件绑定 ==========
    function bindGlobalEvents() {
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Alt+S 扫描表格
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                showScanModal();
            }

            // Alt+D 批量下载
            if (e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                showBatchDownloadModal();
            }

            // ESC 关闭所有
            if (e.key === 'Escape') {
                hideModal();
            }
        });
    }

    // ========== 动态表格监控 ==========

    let tableObserver = null;
    let observedTables = new Set();
    let tableChangeHistory = new Map();

    function initTableObserver() {
        if (!CONFIG.observerEnabled) return;

        try {
            // 创建MutationObserver来监控表格变化
            tableObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        // 检查新增的节点中是否有表格
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) { // 元素节点
                                if (node.tagName === 'TABLE') {
                                    handleNewTable(node);
                                } else if (node.querySelectorAll) {
                                    // 检查子元素中的表格
                                    const tables = node.querySelectorAll('table');
                                    tables.forEach(table => handleNewTable(table));
                                }
                            }
                        });

                        // 检查被移除的表格
                        mutation.removedNodes.forEach((node) => {
                            if (node.nodeType === 1 && node.tagName === 'TABLE') {
                                handleRemovedTable(node);
                            }
                        });
                    } else if (mutation.type === 'characterData') {
                        // 检查表格内容变化
                        checkTableContentChanges();
                    }
                });
            });

            console.log('动态表格监控已初始化');
        } catch (e) {
            console.error('初始化表格监控失败:', e);
        }
    }

    function handleNewTable(table) {
        if (!observedTables.has(table)) {
            // 跳过编辑器内部的表格
            if (isInsideEditor(table)) return;

            observedTables.add(table);

            // 记录表格的初始状态
            tableChangeHistory.set(table, {
                firstSeen: new Date(),
                changes: [],
                snapshot: extractTableData(table)
            });

            // 添加监控样式
            table.classList.add('dl-dynamic-table');

            // 通知用户（可选）
            if (CONFIG.observerEnabled) {
                console.log('发现新表格:', table);
                showTableNotification('发现新的动态表格', table);
            }
        }
    }

    function handleRemovedTable(table) {
        if (observedTables.has(table)) {
            observedTables.delete(table);
            tableChangeHistory.delete(table);

            console.log('表格已被移除:', table);
        }
    }

    function checkTableContentChanges() {
        observedTables.forEach(table => {
            try {
                const history = tableChangeHistory.get(table);
                if (history) {
                    const currentData = extractTableData(table);
                    const lastSnapshot = history.snapshot;

                    // 比较表格数据是否变化
                    if (JSON.stringify(currentData) !== JSON.stringify(lastSnapshot)) {
                        history.changes.push({
                            time: new Date(),
                            oldData: lastSnapshot,
                            newData: currentData
                        });

                        history.snapshot = currentData;

                        console.log('表格内容已更新:', table);

                        // 添加更新标识
                        table.classList.add('dl-table-updated');
                        setTimeout(() => {
                            table.classList.remove('dl-table-updated');
                        }, 2000);
                    }
                }
            } catch (e) {
                // 忽略错误
            }
        });
    }

    function startTableObserver() {
        if (!tableObserver) return;

        try {
            // 开始监控整个文档
            tableObserver.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: false
            });

            // 初始扫描现有表格
            const existingTables = document.querySelectorAll('table');
            existingTables.forEach(table => handleNewTable(table));

            console.log('动态表格监控已启动');
        } catch (e) {
            console.error('启动表格监控失败:', e);
        }
    }

    function showTableNotification(message, table) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'dl-table-notification';
        notification.innerHTML = `
            <div style="padding: 10px; background: #4CAF50; color: white; border-radius: 5px; margin: 5px;">
                ${message}
                <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: white; cursor: pointer;">×</button>
            </div>
        `;

        notification.style.position = 'fixed';
        notification.style.top = '10px';
        notification.style.right = '10px';
        notification.style.zIndex = '1000002';

        document.body.appendChild(notification);

        // 自动移除通知
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);

        // 高亮表格
        highlightTable(table, true);
    }

    // ========== 模态框管理 ==========
    function showModal(title, content, footer = '', onShow = null, showBackButton = false) {
        // 获取或创建模态框容器
        let modalContainer = document.getElementById('data-liberator-modal-container');
        if (!modalContainer) {
            modalContainer = createModalContainer();
        }

        // 显示容器
        modalContainer.style.display = 'flex';

        // 如果已经有模态框显示，先隐藏它但不重置历史记录
        if (CONFIG.currentModal) {
            modalContainer.innerHTML = '';
        }

        const modal = document.createElement('div');
        modal.className = 'dl-modal';

        let headerHTML = '';
        if (showBackButton) {
            headerHTML = `
                <div class="dl-modal-header">
                    <button class="dl-modal-back" id="modal-back-btn">返回</button>
                    <div class="dl-modal-title">${title}</div>
                    <button class="dl-modal-close" id="modal-close-btn">×</button>
                </div>
            `;
        } else {
            headerHTML = `
                <div class="dl-modal-header">
                    <div class="dl-modal-title">${title}</div>
                    <button class="dl-modal-close" id="modal-close-btn">×</button>
                </div>
            `;
        }

        modal.innerHTML = `
            ${headerHTML}
            <div class="dl-modal-body">${content}</div>
            ${footer ? `<div class="dl-modal-footer">${footer}</div>` : ''}
        `;

        modalContainer.appendChild(modal);

        // 绑定关闭按钮
        modal.querySelector('#modal-close-btn').addEventListener('click', hideModal);

        // 绑定返回按钮
        if (showBackButton) {
            modal.querySelector('#modal-back-btn').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                goBackModal();
            });
        }

        // 保存当前模态框信息到历史记录
        CONFIG.modalHistory.push({
            title,
            content,
            footer,
            onShow,
            showBackButton
        });

        // 保存当前模态框引用
        CONFIG.currentModal = modal;

        // 执行回调
        if (onShow && typeof onShow === 'function') {
            setTimeout(() => onShow(modal), 10);
        }

        return modal;
    }

    function goBackModal() {
        // 如果历史记录中只有一个模态框，则关闭整个模态框
        if (CONFIG.modalHistory.length <= 1) {
            hideModal();
            return;
        }

        // 移除当前模态框
        if (CONFIG.currentModal) {
            CONFIG.currentModal.remove();
            CONFIG.currentModal = null;
        }

        // 移除当前模态框的历史记录
        CONFIG.modalHistory.pop();

        // 获取上一个模态框
        const prevModalInfo = CONFIG.modalHistory[CONFIG.modalHistory.length - 1];

        // 重新创建上一个模态框
        const modal = document.createElement('div');
        modal.className = 'dl-modal';

        let headerHTML = '';
        if (prevModalInfo.showBackButton) {
            headerHTML = `
                <div class="dl-modal-header">
                    <button class="dl-modal-back" id="modal-back-btn">返回</button>
                    <div class="dl-modal-title">${prevModalInfo.title}</div>
                    <button class="dl-modal-close" id="modal-close-btn">×</button>
                </div>
            `;
        } else {
            headerHTML = `
                <div class="dl-modal-header">
                    <div class="dl-modal-title">${prevModalInfo.title}</div>
                    <button class="dl-modal-close" id="modal-close-btn">×</button>
                </div>
            `;
        }

        modal.innerHTML = `
            ${headerHTML}
            <div class="dl-modal-body">${prevModalInfo.content}</div>
            ${prevModalInfo.footer ? `<div class="dl-modal-footer">${prevModalInfo.footer}</div>` : ''}
        `;

        const modalContainer = document.getElementById('data-liberator-modal-container');
        modalContainer.appendChild(modal);

        // 绑定关闭按钮
        modal.querySelector('#modal-close-btn').addEventListener('click', hideModal);

        // 绑定返回按钮
        if (prevModalInfo.showBackButton) {
            modal.querySelector('#modal-back-btn').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                goBackModal();
            });
        }

        CONFIG.currentModal = modal;

        // 执行回调
        if (prevModalInfo.onShow && typeof prevModalInfo.onShow === 'function') {
            setTimeout(() => prevModalInfo.onShow(modal), 10);
        }
    }

    function hideModal() {
        const modalContainer = document.getElementById('data-liberator-modal-container');
        if (modalContainer) {
            modalContainer.style.display = 'none';
            modalContainer.innerHTML = '';
        }

        CONFIG.currentModal = null;
        CONFIG.modalHistory = [];

        // 清除临时高亮
        document.querySelectorAll('.dl-table-highlight:not(.dl-table-highlight-persist)').forEach(table => {
            table.classList.remove('dl-table-highlight');
        });
    }

    // ========== 扫描表格模态框 ==========
    function showScanningIndicator() {
        removeScanningIndicator();

        const indicator = document.createElement('div');
        indicator.className = 'dl-scanning-indicator';
        indicator.innerHTML = '<div class="spinner"></div>扫描表格中...';
        indicator.id = 'dl-scanning-indicator';

        document.body.appendChild(indicator);
    }

    function removeScanningIndicator() {
        const existing = document.getElementById('dl-scanning-indicator');
        if (existing) {
            existing.remove();
        }
    }

    // 显示扫描模态框（默认普通扫描）
    function showScanModal() {
        showScanningIndicator();

        setTimeout(() => {
            // 默认普通扫描，不扫描iframe
            const tables = scanTablesInDocument(document, false);

            removeScanningIndicator();

            if (tables.length === 0) {
                const content = `
                    <div class="dl-config-group">
                        <div class="dl-status dl-status-info">未在当前页面找到任何表格</div>
                        <div style="margin-top: 10px;">
                            <button class="dl-btn dl-btn-secondary" id="deep-scan-btn">深度扫描（包含iframe）</button>
                        </div>
                    </div>
                `;

                const footer = `
                    <button class="dl-btn dl-btn-secondary" id="close-empty-btn">关闭</button>
                `;

                showModal('表格扫描结果', content, footer, (modal) => {
                    modal.querySelector('#close-empty-btn').addEventListener('click', hideModal);
                    modal.querySelector('#deep-scan-btn').addEventListener('click', () => {
                        hideModal();
                        setTimeout(() => showDeepScanModal(), 300);
                    });
                }, false);
                return;
            }

            let tableListHTML = '';
            tables.forEach((table, index) => {
                const rowCount = table.rows.length;
                const colCount = table.rows[0] ? table.rows[0].cells.length : 0;

                tableListHTML += `
                    <div class="dl-table-item" data-index="${index}">
                        <div class="dl-table-title">表格 ${index + 1}</div>
                        <div class="dl-table-info">
                            <span>${rowCount}行 × ${colCount}列</span>
                            <span>${table.offsetWidth}×${table.offsetHeight}px</span>
                            <span>主文档</span>
                        </div>
                        <div class="dl-table-actions">
                            <button class="dl-table-action-btn dl-table-action-highlight" data-action="highlight" data-index="${index}">高亮</button>
                            <button class="dl-table-action-btn dl-table-action-preview" data-action="preview" data-index="${index}">预览</button>
                            <button class="dl-table-action-btn dl-table-action-export" data-action="export" data-index="${index}">导出</button>
                        </div>
                    </div>
                `;
            });

            const content = `
                <div class="dl-config-group">
                    <div class="dl-config-label">找到 ${tables.length} 个表格：</div>
                    <div class="dl-table-list">${tableListHTML}</div>
                </div>

                <div class="dl-config-group">
                    <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                        <button class="dl-btn dl-btn-success" id="highlight-all-btn">高亮所有表格</button>
                        <button class="dl-btn dl-btn-warning" id="clear-highlight-btn">清除高亮</button>
                        <button class="dl-btn dl-btn-primary" id="export-all-btn">导出所有表格</button>
                        <button class="dl-btn dl-btn-secondary" id="deep-scan-btn">深度扫描（包含iframe）</button>
                        <!-- ========== 新增：显示/隐藏表格导出按钮 ========== -->
                        <button class="dl-btn dl-btn-info" id="show-export-btns">显示导出按钮</button>
                        <button class="dl-btn dl-btn-secondary" id="hide-export-btns">移除导出按钮</button>
                        <!-- ============================================= -->
                    </div>
                </div>
            `;

            const footer = `
                <button class="dl-btn dl-btn-secondary" id="cancel-scan-btn">关闭</button>
            `;

            showModal('表格扫描结果', content, footer, (modal) => {
                modal.querySelectorAll('.dl-table-action-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const action = btn.dataset.action;
                        const index = parseInt(btn.dataset.index);
                        const table = tables[index];

                        switch (action) {
                            case 'highlight':
                                highlightTable(table, true);
                                break;
                            case 'preview':
                                showTablePreview(table, index);
                                break;
                            case 'export':
                                showExportModal(table, true);
                                break;
                        }
                    });
                });

                modal.querySelectorAll('.dl-table-item').forEach(item => {
                    item.addEventListener('click', () => {
                        modal.querySelectorAll('.dl-table-item').forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                    });
                });

                modal.querySelector('#highlight-all-btn').addEventListener('click', () => {
                    tables.forEach(table => {
                        highlightTable(table, true);
                    });
                });

                modal.querySelector('#clear-highlight-btn').addEventListener('click', () => {
                    clearTableHighlight(true);
                });

                modal.querySelector('#export-all-btn').addEventListener('click', () => {
                    exportAllTables(tables);
                });

                modal.querySelector('#deep-scan-btn').addEventListener('click', () => {
                    hideModal();
                    setTimeout(() => showDeepScanModal(), 300);
                });

                // ========== 新增：显示导出按钮 ==========
                modal.querySelector('#show-export-btns').addEventListener('click', () => {
                    addExportButtonsToTables(tables);
                });
                modal.querySelector('#hide-export-btns').addEventListener('click', () => {
                    removeAllExportButtons();
                });
                // =====================================

                modal.querySelector('#cancel-scan-btn').addEventListener('click', hideModal);
            }, false);
        }, 500);
    }

    // ========== 表格高亮功能 ==========
    function highlightTable(table, persistent = false) {
        if (!table) return;

        // 跳过编辑器内部的表格
        if (isInsideEditor(table)) return;

        // 清除临时高亮
        document.querySelectorAll('.dl-table-highlight:not(.dl-table-highlight-persist)').forEach(t => {
            t.classList.remove('dl-table-highlight');
        });

        if (persistent) {
            table.classList.add('dl-table-highlight-persist');
            CONFIG.lastHighlightedTables.add(table);
        } else {
            table.classList.add('dl-table-highlight');
        }

        // 尝试滚动到表格位置
        try {
            table.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
            // 忽略滚动错误
        }
    }

    function highlightAllTables(tables) {
        tables.forEach(table => {
            if (table && table.classList) {
                // 跳过编辑器内部的表格
                if (isInsideEditor(table)) return;
                table.classList.add('dl-table-highlight-persist');
                CONFIG.lastHighlightedTables.add(table);
            }
        });
    }

    function clearTableHighlight(clearPersistent = false) {
        if (clearPersistent) {
            document.querySelectorAll('.dl-table-highlight, .dl-table-highlight-persist').forEach(table => {
                table.classList.remove('dl-table-highlight', 'dl-table-highlight-persist');
            });
            CONFIG.lastHighlightedTables.clear();
        } else {
            document.querySelectorAll('.dl-table-highlight:not(.dl-table-highlight-persist)').forEach(table => {
                table.classList.remove('dl-table-highlight');
            });
        }
    }

    // ========== 表格数据提取（增强版，支持超链接） ==========
    function extractTableData(table) {
        const data = [];
        const rows = table.querySelectorAll('tr');

        rows.forEach(row => {
            const rowData = [];
            const cells = row.querySelectorAll('th, td');

            cells.forEach(cell => {
                // 提取单元格文本
                let text = cell.textContent.trim();
                text = text.replace(/\s+/g, ' ')
                          .replace(/[\r\n]+/g, ' ')
                          .trim();

                // 检查是否有超链接
                const links = cell.querySelectorAll('a[href]');
                let cellData = {
                    text: text,
                    links: []
                };

                if (links.length > 0) {
                    links.forEach(link => {
                        const linkText = link.textContent.trim();
                        const linkHref = link.href;

                        if (linkText && linkHref) {
                            cellData.links.push({
                                text: linkText,
                                href: linkHref
                            });
                        }
                    });
                }

                // 检查是否有复选框
                const checkbox = cell.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    cellData.checkbox = checkbox.checked ? '✓' : '✗';
                }

                // 检查是否有单选按钮
                const radio = cell.querySelector('input[type="radio"]');
                if (radio) {
                    cellData.radio = radio.checked ? '●' : '○';
                }

                rowData.push(cellData);
            });

            if (rowData.length > 0 && rowData.some(cell => cell.text.trim() !== '' || cell.links.length > 0)) {
                data.push(rowData);
            }
        });

        return data;
    }

    // 将表格数据转换为纯文本（用于预览）
    function convertTableDataToText(tableData) {
        return tableData.map(row =>
            row.map(cell => {
                let result = cell.text;

                // 如果有链接，在预览中显示链接
                if (cell.links && cell.links.length > 0) {
                    cell.links.forEach(link => {
                        result = result.replace(link.text, `${link.text}(${link.href})`);
                    });
                }

                // 如果有复选框或单选按钮
                if (cell.checkbox) result += ` [${cell.checkbox}]`;
                if (cell.radio) result += ` [${cell.radio}]`;

                return result;
            })
        );
    }

    // 将表格数据转换为适合导出的格式
    // ========== 修改：支持长数字文本化 ==========
    function convertTableDataForExport(tableData, format = 'excel') {
        switch (format) {
            case 'excel':
                // 对于Excel，返回包含超链接的对象数组，并处理长数字
                return tableData.map(row =>
                    row.map(cell => {
                        // 检查是否需要将长数字作为文本处理
                        let text = cell.text;
                        if (CONFIG.exportLongNumbersAsText && /^\d{12,}$/.test(text.replace(/\D/g, ''))) {
                            // 如果文本中只包含数字且长度大于11，强制作为字符串
                            return {
                                v: text,
                                t: 's'  // 字符串类型
                            };
                        }

                        // 如果有链接且导出链接功能开启
                        if (CONFIG.exportLinks && cell.links && cell.links.length > 0) {
                            // 如果有多个链接，取第一个主要链接
                            const mainLink = cell.links[0];
                            // 返回Excel超链接对象
                            return {
                                v: mainLink.text || cell.text,
                                l: { Target: mainLink.href },
                                t: 's'
                            };
                        }

                        // 普通文本或复选框/单选按钮
                        let value = cell.text;
                        if (cell.checkbox) value += ` [${cell.checkbox}]`;
                        if (cell.radio) value += ` [${cell.radio}]`;

                        return value;
                    })
                );

            case 'csv':
                // 对于CSV，使用Markdown格式的超链接
                return tableData.map(row =>
                    row.map(cell => {
                        let text = cell.text;

                        // 如果有链接且导出链接功能开启
                        if (CONFIG.exportLinks && cell.links && cell.links.length > 0) {
                            const mainLink = cell.links[0];
                            text = `[${mainLink.text || cell.text}](${mainLink.href})`;

                            // 如果有多个链接，添加注释
                            if (cell.links.length > 1) {
                                text += ` (还有${cell.links.length - 1}个链接)`;
                            }
                        }

                        // 添加复选框/单选按钮
                        if (cell.checkbox) text += ` [${cell.checkbox}]`;
                        if (cell.radio) text += ` [${cell.radio}]`;

                        return text;
                    })
                );

            case 'json':
                // 对于JSON，返回结构化数据
                return tableData.map(row =>
                    row.map(cell => {
                        const cellObj = {
                            text: cell.text
                        };

                        if (CONFIG.exportLinks && cell.links && cell.links.length > 0) {
                            cellObj.links = cell.links;
                        }

                        if (cell.checkbox) cellObj.checkbox = cell.checkbox;
                        if (cell.radio) cellObj.radio = cell.radio;

                        return cellObj;
                    })
                );

            default:
                return convertTableDataToText(tableData);
        }
    }
    // =====================================================

    // 修复：普通表格预览
    function showTablePreview(table, index) {
        CONFIG.lastPreviewTable = table;

        const tableData = extractTableData(table);

        if (tableData.length === 0) {
            const content = `
                <div class="dl-config-group">
                    <div class="dl-status dl-status-error">表格为空或无法提取数据</div>
                </div>
            `;

            const footer = `
                <button class="dl-btn dl-btn-secondary" id="close-error-btn">关闭</button>
            `;

            showModal('表格预览', content, footer, (modal) => {
                modal.querySelector('#close-error-btn').addEventListener('click', hideModal);
            }, true);
            return;
        }

        // 将数据转换为纯文本用于预览
        const textData = convertTableDataToText(tableData);

        let previewHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';

        const previewRows = Math.min(textData.length, 20);
        for (let i = 0; i < previewRows; i++) {
            previewHTML += '<tr>';
            textData[i].forEach((cell, cellIndex) => {
                const tag = i === 0 ? 'th' : 'td';
                const style = i === 0 ? 'background:#f8f9fa;font-weight:bold;' : '';
                previewHTML += `<${tag} style="border:1px solid #ddd;padding:8px;${style}">${escapeHTML(cell)}</${tag}>`;
            });
            previewHTML += '</tr>';
        }

        previewHTML += '</table>';

        if (textData.length > 20) {
            previewHTML += `<div style="padding: 10px; text-align: center; color: #666;">... 还有 ${textData.length - 20} 行数据</div>`;
        }

        const content = `
            <div class="dl-config-group">
                <div class="dl-config-label">表格 ${index + 1} 预览 (${textData.length}行${textData[0] ? ` × ${textData[0].length}列` : ''})：</div>
                <div class="dl-table-preview">${previewHTML}</div>
                ${tableData.some(row => row.some(cell => cell.links && cell.links.length > 0)) ?
                    '<div style="margin-top: 10px; color: #666; font-size: 12px;">💡 检测到表格中包含超链接，导出时会保留链接</div>' : ''}
            </div>
        `;

        const footer = `
            <button class="dl-btn dl-btn-secondary" id="close-preview-btn">关闭</button>
            <button class="dl-btn dl-btn-primary" id="export-this-btn">导出此表格</button>
        `;

        showModal('表格预览', content, footer, (modal) => {
            highlightTable(table, true);

            modal.querySelector('#close-preview-btn').addEventListener('click', () => {
                clearTableHighlight(false);
                hideModal();
            });

            modal.querySelector('#export-this-btn').addEventListener('click', () => {
                CONFIG.lastExportTable = table;
                hideModal();
                setTimeout(() => showExportModal(table, true), 300);
            });
        }, true);
    }

    // ========== 导出表格功能 ==========
    function showExportModal(table, showBack = false) {
        const tableData = extractTableData(table);

        if (tableData.length === 0) {
            const content = `
                <div class="dl-config-group">
                    <div class="dl-status dl-status-error">表格为空或无法提取数据</div>
                </div>
            `;

            const footer = `
                <button class="dl-btn dl-btn-secondary" id="close-error-btn">关闭</button>
            `;

            showModal('导出表格数据', content, footer, (modal) => {
                modal.querySelector('#close-error-btn').addEventListener('click', hideModal);
            }, showBack);
            return;
        }

        // 将数据转换为纯文本用于预览
        const textData = convertTableDataToText(tableData);
        const hasLinks = tableData.some(row => row.some(cell => cell.links && cell.links.length > 0));

        let previewHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
        const previewRows = Math.min(textData.length, 10);

        for (let i = 0; i < previewRows; i++) {
            previewHTML += '<tr>';
            textData[i].forEach((cell, cellIndex) => {
                const tag = i === 0 ? 'th' : 'td';
                const style = i === 0 ? 'background:#f8f9fa;font-weight:bold;' : '';
                previewHTML += `<${tag} style="border:1px solid #ddd;padding:8px;${style}">${escapeHTML(cell)}</${tag}>`;
            });
            previewHTML += '</tr>';
        }

        if (textData.length > 10) {
            previewHTML += `<tr><td colspan="${textData[0].length}" style="text-align: center; color: #666;">... 还有 ${textData.length - 10} 行数据</td></tr>`;
        }

        previewHTML += '</table>';

        const content = `
            <div class="dl-config-group">
                <div class="dl-config-label">表格预览 (${textData.length}行${textData[0] ? ` × ${textData[0].length}列` : ''})：</div>
                <div class="dl-table-preview">${previewHTML}</div>
                ${hasLinks ?
                    '<div style="margin-top: 10px; color: #666; font-size: 12px;">💡 检测到表格中包含超链接，导出时会保留链接</div>' : ''}
            </div>

            <div class="dl-config-group">
                <label class="dl-config-label">导出文件名：</label>
                <input type="text" class="dl-config-input" id="export-filename" value="表格数据_${getTimestamp()}" />
            </div>

            <div class="dl-config-group">
                <label class="dl-config-label">导出格式：</label>
                <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                    <button class="dl-btn dl-btn-primary" data-format="excel">Excel (.xlsx)</button>
                    <button class="dl-btn dl-btn-primary" data-format="csv">CSV (.csv)</button>
                    <button class="dl-btn dl-btn-primary" data-format="json">JSON (.json)</button>
                </div>
            </div>

            ${hasLinks ? `
            <div class="dl-config-group">
                <label class="dl-config-label">超链接导出选项：</label>
                <div style="margin-top: 10px;">
                    <div>
                        <input type="checkbox" id="export-links" ${CONFIG.exportLinks ? 'checked' : ''} />
                        <label for="export-links">导出超链接</label>
                    </div>
                    <div style="margin-top: 10px;">
                        <label style="font-size: 12px; color: #666;">链接格式：</label>
                        <div style="display: flex; gap: 10px; margin-top: 5px;">
                            <label style="font-size: 12px;">
                                <input type="radio" name="link-format" value="excel" ${CONFIG.linkFormat === 'excel' ? 'checked' : ''} />
                                Excel超链接
                            </label>
                            <label style="font-size: 12px;">
                                <input type="radio" name="link-format" value="markdown" ${CONFIG.linkFormat === 'markdown' ? 'checked' : ''} />
                                Markdown格式
                            </label>
                            <label style="font-size: 12px;">
                                <input type="radio" name="link-format" value="html" ${CONFIG.linkFormat === 'html' ? 'checked' : ''} />
                                HTML格式
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
        `;

        const footer = `
            <button class="dl-btn dl-btn-secondary" id="cancel-export-btn">取消</button>
        `;

        showModal('导出表格数据', content, footer, (modal) => {
            // 保存超链接设置
            if (hasLinks) {
                modal.querySelector('#export-links').addEventListener('change', (e) => {
                    CONFIG.exportLinks = e.target.checked;
                });

                modal.querySelectorAll('input[name="link-format"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        CONFIG.linkFormat = e.target.value;
                    });
                });
            }

            modal.querySelectorAll('[data-format]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const format = btn.dataset.format;
                    const filename = modal.querySelector('#export-filename').value;

                    switch (format) {
                        case 'excel':
                            exportToExcel([{ name: '表格数据', data: tableData }], filename);
                            break;
                        case 'csv':
                            exportToCSV(tableData, filename);
                            break;
                        case 'json':
                            exportToJSON(tableData, filename);
                            break;
                    }

                    hideModal();
                });
            });

            modal.querySelector('#cancel-export-btn').addEventListener('click', hideModal);
        }, showBack);
    }

    // 修复：导出到Excel（支持超链接和长数字文本化）
    function exportToExcel(dataSheets, filename) {
        try {
            const wb = XLSX.utils.book_new();

            dataSheets.forEach((sheet, index) => {
                if (sheet.data && sheet.data.length > 0) {
                    // 转换数据为Excel格式
                    const excelData = convertTableDataForExport(sheet.data, 'excel');

                    // 使用aoa_to_sheet以便支持超链接和自定义类型
                    const ws = XLSX.utils.aoa_to_sheet(excelData);

                    // 如果启用了超链接导出，添加超链接（但已经在convert中处理了链接对象，aoa_to_sheet会保留对象）
                    // 注意：aoa_to_sheet处理数组中的对象时会保留其属性，包括l（超链接）

                    // 但需要确保单元格对象被正确解析，我们可以在创建后遍历调整格式
                    // 对于已经是对象的单元格，XLSX会自动处理，无需额外操作

                    XLSX.utils.book_append_sheet(wb, ws, sheet.name || `Sheet${index + 1}`);
                }
            });

            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });

            downloadFile(blob, `${filename}.xlsx`);

        } catch (error) {
            console.error('Excel导出失败:', error);
            // 如果超链接导出失败，尝试普通导出
            try {
                exportToExcelFallback(dataSheets, filename);
            } catch (fallbackError) {
                console.error('Excel备用导出也失败:', fallbackError);
                alert('Excel导出失败，请尝试其他格式');
            }
        }
    }

    // Excel导出备用方案（不支持超链接）
    function exportToExcelFallback(dataSheets, filename) {
        try {
            const wb = XLSX.utils.book_new();

            dataSheets.forEach((sheet, index) => {
                if (sheet.data && sheet.data.length > 0) {
                    // 转换为纯文本数据
                    const textData = convertTableDataToText(sheet.data);
                    const ws = XLSX.utils.aoa_to_sheet(textData);
                    XLSX.utils.book_append_sheet(wb, ws, sheet.name || `Sheet${index + 1}`);
                }
            });

            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });

            downloadFile(blob, `${filename}.xlsx`);
        } catch (error) {
            throw error;
        }
    }

    // 修复：导出到CSV（支持超链接）
    function exportToCSV(data, filename) {
        try {
            // 根据设置选择链接格式
            let csvData;

            if (CONFIG.exportLinks) {
                if (CONFIG.linkFormat === 'markdown') {
                    // Markdown格式
                    csvData = data.map(row =>
                        row.map(cell => {
                            let text = cell.text;

                            if (cell.links && cell.links.length > 0) {
                                const mainLink = cell.links[0];
                                text = `[${mainLink.text || cell.text}](${mainLink.href})`;

                                if (cell.links.length > 1) {
                                    text += ` (还有${cell.links.length - 1}个链接)`;
                                }
                            }

                            if (cell.checkbox) text += ` [${cell.checkbox}]`;
                            if (cell.radio) text += ` [${cell.radio}]`;

                            return text;
                        })
                    );
                } else if (CONFIG.linkFormat === 'html') {
                    // HTML格式
                    csvData = data.map(row =>
                        row.map(cell => {
                            let text = cell.text;

                            if (cell.links && cell.links.length > 0) {
                                const mainLink = cell.links[0];
                                text = `<a href="${mainLink.href}">${mainLink.text || cell.text}</a>`;

                                if (cell.links.length > 1) {
                                    text += ` (还有${cell.links.length - 1}个链接)`;
                                }
                            }

                            if (cell.checkbox) text += ` [${cell.checkbox}]`;
                            if (cell.radio) text += ` [${cell.radio}]`;

                            return text;
                        })
                    );
                } else {
                    // 默认：纯文本+URL
                    csvData = data.map(row =>
                        row.map(cell => {
                            let text = cell.text;

                            if (cell.links && cell.links.length > 0) {
                                const mainLink = cell.links[0];
                                text = `${mainLink.text || cell.text} (${mainLink.href})`;
                            }

                            if (cell.checkbox) text += ` [${cell.checkbox}]`;
                            if (cell.radio) text += ` [${cell.radio}]`;

                            return text;
                        })
                    );
                }
            } else {
                // 不导出链接，使用纯文本
                csvData = convertTableDataToText(data);
            }

            const csvContent = csvData.map(row =>
                row.map(cell => {
                    let cellStr = String(cell || '');
                    cellStr = cellStr.replace(/[\r\n]/g, ' ');
                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                        cellStr = '"' + cellStr.replace(/"/g, '""') + '"';
                    }
                    return cellStr;
                }).join(',')
            ).join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            downloadFile(blob, `${filename}.csv`);

        } catch (error) {
            console.error('CSV导出失败:', error);
        }
    }

    // 修复：导出到JSON（支持超链接）
    function exportToJSON(data, filename) {
        try {
            // 使用结构化数据
            const jsonData = convertTableDataForExport(data, 'json');
            const jsonContent = JSON.stringify(jsonData, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            downloadFile(blob, `${filename}.json`);

        } catch (error) {
            console.error('JSON导出失败:', error);
        }
    }

    // 修复：导出所有表格
    function exportAllTables(tables = null) {
        const tablesToExport = tables || scanTablesInDocument(document, false);

        if (tablesToExport.length === 0) {
            return;
        }

        const allTablesData = [];

        tablesToExport.forEach((table, index) => {
            const tableData = extractTableData(table);
            if (tableData.length > 0) {
                allTablesData.push({
                    name: `表格${index + 1}`,
                    data: tableData
                });
            }
        });

        if (allTablesData.length === 0) {
            return;
        }

        showExportAllModal(allTablesData);
    }

    function showExportAllModal(tablesData) {
        const content = `
            <div class="dl-config-group">
                <div class="dl-config-label">导出 ${tablesData.length} 个表格：</div>
                <div style="max-height: 200px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                    ${tablesData.map((table, index) => `
                        <div style="margin-bottom: 5px; padding: 5px; border-bottom: 1px solid #eee;">
                            ${table.name}: ${table.data.length}行 × ${table.data[0] ? table.data[0].length : 0}列
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="dl-config-group">
                <label class="dl-config-label">导出格式：</label>
                <select class="dl-config-select" id="export-format-select">
                    <option value="excel">Excel (多个工作表)</option>
                    <option value="csv">CSV (合并为一个文件)</option>
                    <option value="zip">ZIP (每个表格单独文件)</option>
                </select>
            </div>

            <div class="dl-config-group">
                <label class="dl-config-label">超链接导出选项：</label>
                <div style="margin-top: 10px;">
                    <div>
                        <input type="checkbox" id="export-all-links" ${CONFIG.exportLinks ? 'checked' : ''} />
                        <label for="export-all-links">导出超链接</label>
                    </div>
                    <div style="margin-top: 10px;">
                        <label style="font-size: 12px; color: #666;">链接格式：</label>
                        <div style="display: flex; gap: 10px; margin-top: 5px;">
                            <label style="font-size: 12px;">
                                <input type="radio" name="all-link-format" value="excel" ${CONFIG.linkFormat === 'excel' ? 'checked' : ''} />
                                Excel超链接
                            </label>
                            <label style="font-size: 12px;">
                                <input type="radio" name="all-link-format" value="markdown" ${CONFIG.linkFormat === 'markdown' ? 'checked' : ''} />
                                Markdown格式
                            </label>
                            <label style="font-size: 12px;">
                                <input type="radio" name="all-link-format" value="html" ${CONFIG.linkFormat === 'html' ? 'checked' : ''} />
                                HTML格式
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dl-config-group">
                <label class="dl-config-label">导出文件名：</label>
                <input type="text" class="dl-config-input" id="export-all-filename" value="所有表格_${getTimestamp()}" />
            </div>
        `;

        const footer = `
            <button class="dl-btn dl-btn-secondary" id="cancel-export-all-btn">取消</button>
            <button class="dl-btn dl-btn-primary" id="confirm-export-all-btn">开始导出</button>
        `;

        showModal('导出所有表格', content, footer, (modal) => {
            // 保存超链接设置
            modal.querySelector('#export-all-links').addEventListener('change', (e) => {
                CONFIG.exportLinks = e.target.checked;
            });

            modal.querySelectorAll('input[name="all-link-format"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    CONFIG.linkFormat = e.target.value;
                });
            });

            modal.querySelector('#confirm-export-all-btn').addEventListener('click', () => {
                const format = modal.querySelector('#export-format-select').value;
                const filename = modal.querySelector('#export-all-filename').value;

                switch (format) {
                    case 'excel':
                        exportToExcel(tablesData, filename);
                        break;
                    case 'csv':
                        exportAllToCSV(tablesData, filename);
                        break;
                    case 'zip':
                        exportToZip(tablesData, filename);
                        break;
                }

                hideModal();
            });

            modal.querySelector('#cancel-export-all-btn').addEventListener('click', hideModal);
        }, true);
    }

    // 修复：导出所有表格到CSV
    function exportAllToCSV(tablesData, filename) {
        try {
            let csvContent = '';

            tablesData.forEach((table, index) => {
                if (index > 0) csvContent += '\n\n';
                csvContent += `=== ${table.name} ===\n`;

                // 根据设置转换数据
                let tableCsvData;
                if (CONFIG.exportLinks) {
                    if (CONFIG.linkFormat === 'markdown') {
                        tableCsvData = table.data.map(row =>
                            row.map(cell => {
                                let text = cell.text;

                                if (cell.links && cell.links.length > 0) {
                                    const mainLink = cell.links[0];
                                    text = `[${mainLink.text || cell.text}](${mainLink.href})`;

                                    if (cell.links.length > 1) {
                                        text += ` (还有${cell.links.length - 1}个链接)`;
                                    }
                                }

                                if (cell.checkbox) text += ` [${cell.checkbox}]`;
                                if (cell.radio) text += ` [${cell.radio}]`;

                                return text;
                            })
                        );
                    } else if (CONFIG.linkFormat === 'html') {
                        tableCsvData = table.data.map(row =>
                            row.map(cell => {
                                let text = cell.text;

                                if (cell.links && cell.links.length > 0) {
                                    const mainLink = cell.links[0];
                                    text = `<a href="${mainLink.href}">${mainLink.text || cell.text}</a>`;

                                    if (cell.links.length > 1) {
                                        text += ` (还有${cell.links.length - 1}个链接)`;
                                    }
                                }

                                if (cell.checkbox) text += ` [${cell.checkbox}]`;
                                if (cell.radio) text += ` [${cell.radio}]`;

                                return text;
                            })
                        );
                    } else {
                        tableCsvData = table.data.map(row =>
                            row.map(cell => {
                                let text = cell.text;

                                if (cell.links && cell.links.length > 0) {
                                    const mainLink = cell.links[0];
                                    text = `${mainLink.text || cell.text} (${mainLink.href})`;
                                }

                                if (cell.checkbox) text += ` [${cell.checkbox}]`;
                                if (cell.radio) text += ` [${cell.radio}]`;

                                return text;
                            })
                        );
                    }
                } else {
                    tableCsvData = convertTableDataToText(table.data);
                }

                csvContent += tableCsvData.map(row =>
                    row.map(cell => {
                        let cellStr = String(cell || '');
                        cellStr = cellStr.replace(/[\r\n]/g, ' ');
                        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                            cellStr = '"' + cellStr.replace(/"/g, '""') + '"';
                        }
                        return cellStr;
                    }).join(',')
                ).join('\n');
            });

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            downloadFile(blob, `${filename}.csv`);

        } catch (error) {
            console.error('CSV合并导出失败:', error);
        }
    }

    // 修复：导出到ZIP
    async function exportToZip(tablesData, filename) {
        try {
            const zip = new JSZip();

            for (const table of tablesData) {
                if (table.data && table.data.length > 0) {
                    let csvContent;

                    if (CONFIG.exportLinks) {
                        if (CONFIG.linkFormat === 'markdown') {
                            csvContent = table.data.map(row =>
                                row.map(cell => {
                                    let text = cell.text;

                                    if (cell.links && cell.links.length > 0) {
                                        const mainLink = cell.links[0];
                                        text = `[${mainLink.text || cell.text}](${mainLink.href})`;

                                        if (cell.links.length > 1) {
                                            text += ` (还有${cell.links.length - 1}个链接)`;
                                        }
                                    }

                                    if (cell.checkbox) text += ` [${cell.checkbox}]`;
                                    if (cell.radio) text += ` [${cell.radio}]`;

                                    return text;
                                })
                            );
                        } else if (CONFIG.linkFormat === 'html') {
                            csvContent = table.data.map(row =>
                                row.map(cell => {
                                    let text = cell.text;

                                    if (cell.links && cell.links.length > 0) {
                                        const mainLink = cell.links[0];
                                        text = `<a href="${mainLink.href}">${mainLink.text || cell.text}</a>`;

                                        if (cell.links.length > 1) {
                                            text += ` (还有${cell.links.length - 1}个链接)`;
                                        }
                                    }

                                    if (cell.checkbox) text += ` [${cell.checkbox}]`;
                                    if (cell.radio) text += ` [${cell.radio}]`;

                                    return text;
                                })
                            );
                        } else {
                            csvContent = table.data.map(row =>
                                row.map(cell => {
                                    let text = cell.text;

                                    if (cell.links && cell.links.length > 0) {
                                        const mainLink = cell.links[0];
                                        text = `${mainLink.text || cell.text} (${mainLink.href})`;
                                    }

                                    if (cell.checkbox) text += ` [${cell.checkbox}]`;
                                    if (cell.radio) text += ` [${cell.radio}]`;

                                    return text;
                                })
                            );
                        }
                    } else {
                        csvContent = convertTableDataToText(table.data);
                    }

                    const csvRows = csvContent.map(row =>
                        row.map(cell => {
                            let cellStr = String(cell || '');
                            cellStr = cellStr.replace(/[\r\n]/g, ' ');
                            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                                cellStr = '"' + cellStr.replace(/"/g, '""') + '"';
                            }
                            return cellStr;
                        }).join(',')
                    ).join('\n');

                    zip.file(`${table.name}.csv`, '\ufeff' + csvRows);
                }
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            downloadFile(zipBlob, `${filename}.zip`);

        } catch (error) {
            console.error('ZIP导出失败:', error);
        }
    }

    // ========== 深度扫描模态框 ==========

    function showDeepScanModal(includeHidden = false) {
        showScanningIndicator();

        setTimeout(() => {
            const tables = enhancedScanTables({
                scanIframes: true,
                maxDepth: CONFIG.iframeScanDepth,
                includeHidden: includeHidden,
                waitForDynamic: true
            });

            removeScanningIndicator();

            const hiddenCount = tables.filter(t => {
                try {
                    const style = window.getComputedStyle(t.element);
                    return style.display === 'none' || style.visibility === 'hidden';
                } catch (e) {
                    return false;
                }
            }).length;

            let tableListHTML = '';
            tables.forEach((tableInfo, index) => {
                const table = tableInfo.element;
                const rowCount = table.rows.length;
                const colCount = table.rows[0] ? table.rows[0].cells.length : 0;
                const source = tableInfo.source || '主文档';
                const depth = tableInfo.depth || 0;

                let isHidden = false;
                try {
                    const style = window.getComputedStyle(table);
                    isHidden = style.display === 'none' || style.visibility === 'hidden';
                } catch (e) {
                    isHidden = false;
                }

                tableListHTML += `
                    <div class="dl-table-item" data-index="${index}" style="${isHidden ? 'opacity: 0.7;' : ''}">
                        <div class="dl-table-title">
                            表格 ${index + 1}
                            ${isHidden ? '<span style="color: #ff9800; font-size: 12px;">[隐藏]</span>' : ''}
                            ${depth > 0 ? `<span style="font-size: 12px; color: #666; margin-left: 10px;">(${source}, 深度: ${depth})</span>` : ''}
                        </div>
                        <div class="dl-table-info">
                            <span>${rowCount}行 × ${colCount}列</span>
                            <span>${table.offsetWidth}×${table.offsetHeight}px</span>
                            <span>${source}</span>
                        </div>
                        <div class="dl-table-actions">
                            <button class="dl-table-action-btn dl-table-action-highlight" data-action="highlight" data-index="${index}">高亮</button>
                            <button class="dl-table-action-btn dl-table-action-preview" data-action="preview" data-index="${index}">预览</button>
                            <button class="dl-table-action-btn dl-table-action-export" data-action="export" data-index="${index}">导出</button>
                        </div>
                    </div>
                `;
            });

            const content = `
                <div class="dl-config-group">
                    <div class="dl-config-label">
                        深度扫描结果：
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            共找到 ${tables.length} 个表格，其中 ${hiddenCount} 个隐藏表格
                            ${includeHidden ? '(已包含隐藏表格)' : ''}
                        </div>
                    </div>
                    <div class="dl-table-list">${tableListHTML}</div>
                </div>

                <div class="dl-config-group">
                    <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                        <button class="dl-btn dl-btn-success" id="highlight-all-btn">高亮所有表格</button>
                        <button class="dl-btn dl-btn-warning" id="clear-highlight-btn">清除高亮</button>
                        <button class="dl-btn dl-btn-primary" id="export-all-btn">导出所有表格</button>
                        ${!includeHidden ? '<button class="dl-btn dl-btn-secondary" id="include-hidden-btn">包含隐藏表格</button>' : ''}
                        <button class="dl-btn dl-btn-secondary" id="normal-scan-btn">返回普通扫描</button>
                        <!-- ========== 新增：显示/隐藏表格导出按钮 ========== -->
                        <button class="dl-btn dl-btn-info" id="show-export-btns">显示导出按钮</button>
                        <button class="dl-btn dl-btn-secondary" id="hide-export-btns">移除导出按钮</button>
                        <!-- ============================================= -->
                    </div>
                </div>
            `;

            const footer = `
                <button class="dl-btn dl-btn-secondary" id="cancel-scan-btn">关闭</button>
            `;

            showModal('深度表格扫描', content, footer, (modal) => {
                modal.querySelectorAll('.dl-table-action-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const action = btn.dataset.action;
                        const index = parseInt(btn.dataset.index);
                        const tableInfo = tables[index];
                        const table = tableInfo.element;

                        switch (action) {
                            case 'highlight':
                                highlightTable(table, true);
                                break;
                            case 'preview':
                                showEnhancedTablePreview(table, index, tableInfo);
                                break;
                            case 'export':
                                showExportModal(table, true);
                                break;
                        }
                    });
                });

                modal.querySelector('#highlight-all-btn').addEventListener('click', () => {
                    tables.forEach(tableInfo => {
                        highlightTable(tableInfo.element, true);
                    });
                });

                modal.querySelector('#clear-highlight-btn').addEventListener('click', () => {
                    clearTableHighlight(true);
                });

                modal.querySelector('#export-all-btn').addEventListener('click', () => {
                    exportAllTables(tables.map(t => t.element));
                });

                if (!includeHidden) {
                    modal.querySelector('#include-hidden-btn').addEventListener('click', () => {
                        hideModal();
                        setTimeout(() => showDeepScanModal(true), 300);
                    });
                }

                modal.querySelector('#normal-scan-btn').addEventListener('click', () => {
                    hideModal();
                    setTimeout(() => showScanModal(), 300);
                });

                // ========== 新增：显示导出按钮 ==========
                modal.querySelector('#show-export-btns').addEventListener('click', () => {
                    addExportButtonsToTables(tables.map(t => t.element));
                });
                modal.querySelector('#hide-export-btns').addEventListener('click', () => {
                    removeAllExportButtons();
                });
                // =====================================

                modal.querySelector('#cancel-scan-btn').addEventListener('click', hideModal);
            }, false);
        }, 1500);
    }

    // 增强的表格预览（用于深度扫描）
    function showEnhancedTablePreview(table, index, tableInfo) {
        CONFIG.lastPreviewTable = table;

        const tableData = extractTableData(table);

        if (tableData.length === 0) {
            const content = `
                <div class="dl-config-group">
                    <div class="dl-status dl-status-error">表格为空或无法提取数据</div>
                </div>
            `;

            const footer = `
                <button class="dl-btn dl-btn-secondary" id="close-error-btn">关闭</button>
            `;

            showModal('表格预览', content, footer, (modal) => {
                modal.querySelector('#close-error-btn').addEventListener('click', hideModal);
            }, true);
            return;
        }

        // 将数据转换为纯文本用于预览
        const textData = convertTableDataToText(tableData);

        let previewHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';

        const previewRows = Math.min(textData.length, 20);
        for (let i = 0; i < previewRows; i++) {
            previewHTML += '<tr>';
            textData[i].forEach((cell, cellIndex) => {
                const tag = i === 0 ? 'th' : 'td';
                const style = i === 0 ? 'background:#f8f9fa;font-weight:bold;' : '';
                previewHTML += `<${tag} style="border:1px solid #ddd;padding:8px;${style}">${escapeHTML(cell)}</${tag}>`;
            });
            previewHTML += '</tr>';
        }

        previewHTML += '</table>';

        if (textData.length > 20) {
            previewHTML += `<div style="padding: 10px; text-align: center; color: #666;">... 还有 ${textData.length - 20} 行数据</div>`;
        }

        // 添加表格信息
        const sourceInfo = tableInfo ? `
            <div style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                <div style="font-weight: bold; margin-bottom: 5px;">表格信息</div>
                <div style="font-size: 12px; color: #666;">
                    来源: ${tableInfo.source || '主文档'}<br>
                    深度: ${tableInfo.depth || 0}<br>
                    ${tableInfo.frameInfo ? `iframe: ${tableInfo.frameInfo.name || tableInfo.frameInfo.id || '未命名'}` : ''}
                </div>
            </div>
        ` : '';

        const content = `
            <div class="dl-config-group">
                ${sourceInfo}
                <div class="dl-config-label">表格 ${index + 1} 预览 (${textData.length}行${textData[0] ? ` × ${textData[0].length}列` : ''})：</div>
                <div class="dl-table-preview">${previewHTML}</div>
                ${tableData.some(row => row.some(cell => cell.links && cell.links.length > 0)) ?
                    '<div style="margin-top: 10px; color: #666; font-size: 12px;">💡 检测到表格中包含超链接，导出时会保留链接</div>' : ''}
            </div>
        `;

        const footer = `
            <button class="dl-btn dl-btn-secondary" id="close-preview-btn">关闭</button>
            <button class="dl-btn dl-btn-primary" id="export-this-btn">导出此表格</button>
        `;

        showModal('表格预览', content, footer, (modal) => {
            highlightTable(table, true);

            modal.querySelector('#close-preview-btn').addEventListener('click', () => {
                clearTableHighlight(false);
                hideModal();
            });

            modal.querySelector('#export-this-btn').addEventListener('click', () => {
                CONFIG.lastExportTable = table;
                hideModal();
                setTimeout(() => showExportModal(table, true), 300);
            });
        }, true);
    }

    // ========== 新增：为每个表格添加导出按钮 ==========
    function addExportButtonsToTables(tables) {
        // 先移除所有已有的按钮，避免重复
        removeAllExportButtons();

        let addedCount = 0;
        tables.forEach(table => {
            if (!table) return;

            // 跳过编辑器内部的表格
            if (isInsideEditor(table)) return;

            // 为表格添加相对定位类，以便按钮绝对定位
            table.classList.add('dl-table-with-export-btn');

            // 创建按钮
            const btn = document.createElement('button');
            btn.className = 'dl-table-export-btn';
            btn.textContent = '导出Excel';
            btn.title = '点击导出此表格';

            // 绑定点击事件
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                showExportModal(table, true);
            });

            // 将按钮添加到表格中（作为第一个子元素，便于定位）
            table.insertBefore(btn, table.firstChild);
            addedCount++;
        });

        if (addedCount > 0) {
            showNotification(`已为 ${addedCount} 个表格添加导出按钮`, 'success');
        } else {
            showNotification('没有可添加导出按钮的表格', 'info');
        }
    }

    function removeAllExportButtons() {
        document.querySelectorAll('.dl-table-export-btn').forEach(btn => btn.remove());
        document.querySelectorAll('.dl-table-with-export-btn').forEach(table => {
            table.classList.remove('dl-table-with-export-btn');
        });
    }
    // =================================================

    // ========== 增强的设置模态框 ==========

    function showEnhancedSettingsModal() {
        const content = `
            <div class="dl-tabs">
                <div class="dl-tab active" data-tab="general">常规设置</div>
                <div class="dl-tab" data-tab="iframe">iframe设置</div>
                <div class="dl-tab" data-tab="export">导出设置</div>
            </div>

            <div class="dl-tab-content active" id="general-tab">
                <div class="dl-config-group">
                    <label class="dl-config-label">自动扫描表格：</label>
                    <div>
                        <input type="checkbox" id="auto-scan" checked />
                        <label for="auto-scan">页面加载后自动扫描表格</label>
                    </div>
                </div>

                <div class="dl-config-group">
                    <label class="dl-config-label">高亮持续时间：</label>
                    <select class="dl-config-select" id="highlight-duration">
                        <option value="temporary">临时高亮（关闭模态框后消失）</option>
                        <option value="persistent">持久高亮（手动清除）</option>
                    </select>
                </div>
            </div>

            <div class="dl-tab-content" id="iframe-tab">
                <div class="dl-config-group">
                    <label class="dl-config-label">iframe扫描深度：</label>
                    <input type="number" class="dl-config-input" id="iframe-depth" value="${CONFIG.iframeScanDepth}" min="0" max="10" />
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">0表示不扫描iframe，最大深度10</div>
                </div>

                <div class="dl-config-group">
                    <label class="dl-config-label">最大iframe扫描数量：</label>
                    <input type="number" class="dl-config-input" id="max-iframes" value="${CONFIG.maxIframesToScan}" min="1" max="100" />
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">限制扫描的iframe数量，防止性能问题</div>
                </div>

                <div class="dl-config-group">
                    <label class="dl-config-label">跨域iframe处理：</label>
                    <div>
                        <input type="checkbox" id="cross-origin" checked />
                        <label for="cross-origin">尝试访问跨域iframe（可能受限）</label>
                    </div>
                </div>
            </div>

            <div class="dl-tab-content" id="export-tab">
                <div class="dl-config-group">
                    <label class="dl-config-label">超链接导出：</label>
                    <div>
                        <input type="checkbox" id="export-links-setting" ${CONFIG.exportLinks ? 'checked' : ''} />
                        <label for="export-links-setting">导出表格中的超链接</label>
                    </div>
                </div>

                <div class="dl-config-group">
                    <label class="dl-config-label">链接格式：</label>
                    <select class="dl-config-select" id="link-format-setting">
                        <option value="excel" ${CONFIG.linkFormat === 'excel' ? 'selected' : ''}>Excel超链接（仅限Excel格式）</option>
                        <option value="markdown" ${CONFIG.linkFormat === 'markdown' ? 'selected' : ''}>Markdown格式 [文字](链接)</option>
                        <option value="html" ${CONFIG.linkFormat === 'html' ? 'selected' : ''}>HTML格式 &lt;a href="链接"&gt;文字&lt;/a&gt;</option>
                    </select>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">
                        Excel格式：仅Excel文件支持真实超链接<br>
                        CSV格式：使用Markdown或HTML格式<br>
                        JSON格式：保留完整的链接数据结构
                    </div>
                </div>

                <!-- ========== 新增：长数字文本化选项 ========== -->
                <div class="dl-config-group">
                    <label class="dl-config-label">长数字处理：</label>
                    <div>
                        <input type="checkbox" id="long-numbers-as-text" ${CONFIG.exportLongNumbersAsText ? 'checked' : ''} />
                        <label for="long-numbers-as-text">将超过11位的纯数字作为文本导出（防止Excel科学记数法）</label>
                    </div>
                </div>
                <!-- =========================================== -->
            </div>

            <div class="dl-config-group">
                <label class="dl-config-label">重置设置：</label>
                <div>
                    <button class="dl-btn dl-btn-danger" id="reset-settings-btn">重置所有设置</button>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">这将清除所有自定义设置并恢复默认值</div>
                </div>
            </div>
        `;

        const footer = `
            <button class="dl-btn dl-btn-secondary" id="close-settings-btn">关闭</button>
            <button class="dl-btn dl-btn-primary" id="save-settings-btn">保存设置</button>
        `;

        showModal('增强设置', content, footer, (modal) => {
            // 选项卡切换
            modal.querySelectorAll('.dl-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    modal.querySelectorAll('.dl-tab').forEach(t => t.classList.remove('active'));
                    modal.querySelectorAll('.dl-tab-content').forEach(c => c.classList.remove('active'));

                    tab.classList.add('active');
                    const tabId = tab.dataset.tab;
                    modal.querySelector(`#${tabId}-tab`).classList.add('active');
                });
            });

            modal.querySelector('#close-settings-btn').addEventListener('click', hideModal);
            modal.querySelector('#save-settings-btn').addEventListener('click', () => {
                saveEnhancedSettings(modal);
                hideModal();
            });

            modal.querySelector('#reset-settings-btn').addEventListener('click', () => {
                if (confirm('确定要重置所有设置吗？这将清除所有自定义文件类型和配置。')) {
                    resetSettings();
                    hideModal();
                }
            });
        }, false);
    }

    function saveEnhancedSettings(modal) {
        try {
            // 保存iframe设置
            CONFIG.iframeScanDepth = parseInt(modal.querySelector('#iframe-depth').value) || 3;
            CONFIG.maxIframesToScan = parseInt(modal.querySelector('#max-iframes').value) || 20;

            // 保存导出设置
            CONFIG.exportLinks = modal.querySelector('#export-links-setting').checked;
            CONFIG.linkFormat = modal.querySelector('#link-format-setting').value;
            // ========== 新增：保存长数字文本化选项 ==========
            CONFIG.exportLongNumbersAsText = modal.querySelector('#long-numbers-as-text').checked;
            // =============================================

            // 保存到存储
            GM_setValue('enhancedSettings', {
                iframeScanDepth: CONFIG.iframeScanDepth,
                maxIframesToScan: CONFIG.maxIframesToScan,
                dynamicDataTimeout: CONFIG.dynamicDataTimeout,
                observerEnabled: CONFIG.observerEnabled,
                exportLinks: CONFIG.exportLinks,
                linkFormat: CONFIG.linkFormat,
                exportLongNumbersAsText: CONFIG.exportLongNumbersAsText  // 新增
            });

            showNotification('设置已保存', 'success');
        } catch (e) {
            console.error('保存设置失败:', e);
            showNotification('保存设置失败', 'error');
        }
    }

    // ========== 批量下载功能 ==========
    function showBatchDownloadModal() {
        const content = `
            <div class="dl-tabs">
                <div class="dl-tab active" data-tab="file-types">文件类型</div>
                <div class="dl-tab" data-tab="settings">下载设置</div>
            </div>

            <div class="dl-tab-content active" id="file-types-tab">
                <div class="dl-config-group">
                    <div class="dl-config-label">选择文件类型：</div>

                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                            <button class="dl-btn dl-btn-secondary" id="select-all-types">全选</button>
                            <button class="dl-btn dl-btn-secondary" id="clear-all-types">清空</button>
                            <button class="dl-btn dl-btn-secondary" id="restore-default-types">恢复默认</button>
                        </div>
                    </div>

                    <div class="dl-file-types" id="file-types-list"></div>

                    <div style="margin-top: 15px;">
                        <label class="dl-config-label">新增文件格式：</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" class="dl-config-input" id="custom-format-input" placeholder="如: .exe, .apk" />
                            <button class="dl-btn dl-btn-secondary" id="add-custom-format">添加</button>
                        </div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">输入文件扩展名，如: .exe 或 .apk</div>
                    </div>
                </div>
            </div>

            <div class="dl-tab-content" id="settings-tab">
                <div class="dl-config-group">
                    <label class="dl-config-label">文件名规则：</label>
                    <select class="dl-config-select" id="filename-rule">
                        <option value="original">保持原始文件名</option>
                        <option value="numbered">编号+原始文件名</option>
                        <option value="timestamp">时间戳+原始文件名</option>
                    </select>
                </div>

                <div class="dl-config-group">
                    <label class="dl-config-label">下载延迟：</label>
                    <input type="number" class="dl-config-input" id="download-delay" value="1000" min="0" max="10000" />
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">毫秒，0表示无延迟</div>
                </div>

                <div class="dl-config-group">
                    <label class="dl-config-label">并发下载数：</label>
                    <input type="number" class="dl-config-input" id="concurrent-downloads" value="3" min="1" max="10" />
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">同时下载的文件数</div>
                </div>
            </div>

            <div class="dl-config-group">
                <button class="dl-btn dl-btn-primary" id="scan-files-btn" style="width: 100%;">扫描文件链接</button>
            </div>

            <div id="file-list-container" style="display: none;">
                <div class="dl-config-group">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="dl-config-label" id="file-count">找到 0 个文件</div>
                        <div>
                            <input type="checkbox" id="select-all-files" checked />
                            <label for="select-all-files">全选</label>
                        </div>
                    </div>
                    <div class="dl-file-list" id="file-list"></div>
                </div>
            </div>

            <div id="download-progress" style="display: none;">
                <div class="dl-progress">
                    <div class="dl-progress-bar" id="progress-bar"></div>
                </div>
                <div class="dl-status dl-status-info" id="download-status">准备下载...</div>
            </div>
        `;

        const footer = `
            <button class="dl-btn dl-btn-secondary" id="cancel-download-btn">取消</button>
            <button class="dl-btn dl-btn-primary" id="start-download-btn" style="display: none;">开始下载</button>
        `;

        showModal('批量下载附件', content, footer, (modal) => {
            initBatchDownloadModal(modal);
        }, false);
    }

    function initBatchDownloadModal(modal) {
        updateFileTypeSelection(modal);

        modal.querySelectorAll('.dl-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                modal.querySelectorAll('.dl-tab').forEach(t => t.classList.remove('active'));
                modal.querySelectorAll('.dl-tab-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                const tabId = tab.dataset.tab;
                modal.querySelector(`#${tabId}-tab`).classList.add('active');
            });
        });

        modal.querySelector('#select-all-types').addEventListener('click', () => {
            selectAllFileTypes(modal);
        });

        modal.querySelector('#clear-all-types').addEventListener('click', () => {
            clearAllFileTypes(modal);
        });

        modal.querySelector('#restore-default-types').addEventListener('click', () => {
            restoreDefaultFileTypes(modal);
        });

        modal.querySelector('#add-custom-format').addEventListener('click', () => {
            addCustomFormat(modal);
        });

        modal.querySelector('#scan-files-btn').addEventListener('click', () => {
            scanAndDisplayFiles(modal);
        });

        modal.querySelector('#start-download-btn').addEventListener('click', () => {
            startBatchDownload(modal);
        });

        modal.querySelector('#cancel-download-btn').addEventListener('click', hideModal);

        setTimeout(() => {
            scanAndDisplayFiles(modal);
        }, 100);
    }

    // ========== 帮助功能 ==========
    function showHelpModal() {
        const content = `
            <div class="dl-help-content">
                <div class="dl-help-section">
                    <div class="dl-help-title">📊 表格提取功能</div>
                    <ul class="dl-help-list">
                        <li>自动扫描页面中的所有表格</li>
                        <li>高亮显示表格位置</li>
                        <li>预览表格内容</li>
                        <li>导出为 Excel、CSV、JSON 格式</li>
                        <li>批量导出所有表格</li>
                        <li>深度扫描：包含iframe和动态表格</li>
                        <li><strong>新增：支持导出表格中的超链接</strong></li>
                        <li><strong>新增：长数字文本化选项，防止精度丢失</strong></li>
                        <li><strong>新增：表格右上角快捷导出按钮</strong></li>
                    </ul>
                </div>

                <div class="dl-help-section">
                    <div class="dl-help-title">📥 批量下载功能</div>
                    <ul class="dl-help-list">
                        <li>扫描页面中的文件链接</li>
                        <li>支持自定义文件类型</li>
                        <li>批量下载选中的文件</li>
                        <li>支持重命名规则</li>
                        <li>可设置下载延迟和并发数</li>
                    </ul>
                </div>

                <div class="dl-help-section">
                    <div class="dl-help-title">🔗 超链接导出</div>
                    <ul class="dl-help-list">
                        <li><strong>Excel格式</strong>：导出真实的可点击超链接</li>
                        <li><strong>CSV格式</strong>：支持Markdown或HTML格式的链接</li>
                        <li><strong>JSON格式</strong>：保留完整的链接数据结构</li>
                        <li>可在设置中配置链接导出选项</li>
                        <li>自动检测表格中的超链接</li>
                    </ul>
                </div>

                <div class="dl-help-section">
                    <div class="dl-help-title">🔢 长数字处理</div>
                    <ul class="dl-help-list">
                        <li>当单元格内容为纯数字且长度超过11位时，可选择强制作为文本导出</li>
                        <li>防止Excel自动转换为科学记数法，避免数据精度丢失</li>
                        <li>可在设置中开启/关闭此功能</li>
                    </ul>
                </div>

                <div class="dl-help-section">
                    <div class="dl-help-title">⌨️ 快捷键</div>
                    <ul class="dl-help-list">
                        <li>Alt + S: 扫描表格</li>
                        <li>Alt + D: 批量下载</li>
                        <li>ESC: 关闭当前窗口</li>
                    </ul>
                </div>

                <div class="dl-help-section">
                    <div class="dl-help-title">📝 使用提示</div>
                    <ul class="dl-help-list">
                        <li>通过浏览器工具栏的油猴图标访问功能菜单</li>
                        <li>表格高亮可帮助您快速定位数据位置</li>
                        <li>批量下载时建议设置合理的延迟，避免被封IP</li>
                        <li>深度扫描功能可以检测iframe中的表格和动态加载的表格</li>
                        <li>超链接导出功能会自动检测表格中的链接</li>
                        <li>在扫描结果中点击“显示导出按钮”可为每个表格添加快捷导出按钮</li>
                    </ul>
                </div>
            </div>
        `;

        const footer = `
            <button class="dl-btn dl-btn-secondary" id="close-help-btn">关闭</button>
        `;

        showModal('帮助', content, footer, (modal) => {
            modal.querySelector('#close-help-btn').addEventListener('click', hideModal);
        }, false);
    }

    // ========== 文件类型管理函数 ==========
    function updateFileTypeSelection(modal) {
        const fileTypesList = modal.querySelector('#file-types-list');
        fileTypesList.innerHTML = '';

        DEFAULT_FILE_TYPES.forEach(ext => {
            const isSelected = CONFIG.selectedFileTypes.has(ext);
            const item = document.createElement('div');
            item.className = `dl-file-type-item ${isSelected ? 'selected' : ''}`;
            item.dataset.ext = ext;
            item.textContent = ext.toUpperCase();
            item.title = `点击${isSelected ? '取消' : '选择'} ${ext} 格式`;
            fileTypesList.appendChild(item);
        });

        CONFIG.customFileTypes.forEach(ext => {
            const isSelected = CONFIG.selectedFileTypes.has(ext);
            const item = document.createElement('div');
            item.className = `dl-file-type-item custom ${isSelected ? 'selected' : ''}`;
            item.dataset.ext = ext;
            item.textContent = ext.toUpperCase();
            item.title = `自定义格式，点击${isSelected ? '取消' : '选择'} ${ext} 格式`;

            const removeBtn = document.createElement('div');
            removeBtn.className = 'remove-custom-format';
            removeBtn.textContent = '×';
            removeBtn.title = '删除此自定义格式';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeCustomFormat(ext, modal);
            });

            item.appendChild(removeBtn);
            fileTypesList.appendChild(item);
        });

        fileTypesList.querySelectorAll('.dl-file-type-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-custom-format')) return;

                const ext = item.dataset.ext;
                const isSelected = item.classList.contains('selected');

                if (isSelected) {
                    item.classList.remove('selected');
                    CONFIG.selectedFileTypes.delete(ext);
                } else {
                    item.classList.add('selected');
                    CONFIG.selectedFileTypes.add(ext);
                }
            });
        });
    }

    function selectAllFileTypes(modal) {
        modal.querySelectorAll('.dl-file-type-item').forEach(item => {
            item.classList.add('selected');
            const ext = item.dataset.ext;
            CONFIG.selectedFileTypes.add(ext);
        });
    }

    function clearAllFileTypes(modal) {
        modal.querySelectorAll('.dl-file-type-item').forEach(item => {
            item.classList.remove('selected');
            const ext = item.dataset.ext;
            CONFIG.selectedFileTypes.delete(ext);
        });
    }

    function restoreDefaultFileTypes(modal) {
        CONFIG.selectedFileTypes.clear();

        DEFAULT_FILE_TYPES.forEach(type => {
            CONFIG.selectedFileTypes.add(type);
        });

        updateFileTypeSelection(modal);
    }

    function addCustomFormat(modal) {
        const input = modal.querySelector('#custom-format-input');
        const value = input.value.trim();

        if (!value) {
            return;
        }

        let format = value.toLowerCase();
        if (!format.startsWith('.')) {
            format = '.' + format;
        }

        if (DEFAULT_FILE_TYPES.includes(format) || CONFIG.customFileTypes.has(format)) {
            return;
        }

        CONFIG.customFileTypes.add(format);
        CONFIG.selectedFileTypes.add(format);

        saveConfig();
        updateFileTypeSelection(modal);
        input.value = '';
    }

    function removeCustomFormat(format, modal) {
        CONFIG.customFileTypes.delete(format);
        CONFIG.selectedFileTypes.delete(format);

        saveConfig();
        updateFileTypeSelection(modal);
    }

    function resetSettings() {
        CONFIG.customFileTypes.clear();
        CONFIG.selectedFileTypes.clear();

        DEFAULT_FILE_TYPES.forEach(type => {
            CONFIG.selectedFileTypes.add(type);
        });

        // 重置所有设置
        CONFIG.iframeScanDepth = 3;
        CONFIG.maxIframesToScan = 20;
        CONFIG.exportLinks = true;
        CONFIG.linkFormat = 'excel';
        CONFIG.exportLongNumbersAsText = true;  // 新增

        saveConfig();
    }

    // ========== 文件下载功能 ==========
    function downloadFile(blob, filename) {
        try {
            filename = cleanFileName(filename);

            if (typeof saveAs === 'function') {
                saveAs(blob, filename);
                return;
            }

            if (typeof GM_download === 'function') {
                try {
                    const url = URL.createObjectURL(blob);
                    GM_download({
                        url: url,
                        name: filename,
                        saveAs: true,
                        onload: function() {
                            URL.revokeObjectURL(url);
                        },
                        onerror: function(e) {
                            console.error('GM_download failed:', e);
                            fallbackDownload(blob, filename);
                            URL.revokeObjectURL(url);
                        }
                    });
                    return;
                } catch (e) {
                    console.log('GM_download failed, using fallback:', e);
                }
            }

            fallbackDownload(blob, filename);

        } catch (error) {
            console.error('文件下载失败:', error);
        }
    }

    function cleanFileName(filename) {
        const illegalChars = /[<>:"/\\|?*]/g;
        const cleaned = filename.replace(illegalChars, '_');

        if (cleaned.length > 200) {
            const extension = cleaned.substring(cleaned.lastIndexOf('.'));
            const nameWithoutExt = cleaned.substring(0, cleaned.lastIndexOf('.'));
            const truncated = nameWithoutExt.substring(0, 195) + '...';
            return truncated + extension;
        }

        return cleaned;
    }

    function fallbackDownload(blob, filename) {
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');

            a.download = filename;
            a.href = url;
            a.style.display = 'none';

            document.body.appendChild(a);

            if (typeof a.click === 'function') {
                a.click();
            } else {
                const event = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                a.dispatchEvent(event);
            }

            setTimeout(() => {
                if (a.parentNode) {
                    a.parentNode.removeChild(a);
                }
                URL.revokeObjectURL(url);
            }, 100);

        } catch (error) {
            console.error('备用下载方法失败:', error);
        }
    }

    // ========== 工具函数 ==========
    function getTimestamp() {
        const now = new Date();
        return now.getFullYear() +
               ('0' + (now.getMonth() + 1)).slice(-2) +
               ('0' + now.getDate()).slice(-2) + '_' +
               ('0' + now.getHours()).slice(-2) +
               ('0' + now.getMinutes()).slice(-2) +
               ('0' + now.getSeconds()).slice(-2);
    }

    function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function showNotification(message, type = 'info') {
        // 移除现有的通知
        document.querySelectorAll('.dl-notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `dl-notification dl-notification-${type}`;
        notification.textContent = message;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000003;
            animation: dl-notification-in 0.3s ease;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;

        if (type === 'success') {
            notification.style.background = '#4CAF50';
        } else if (type === 'error') {
            notification.style.background = '#f44336';
        } else if (type === 'warning') {
            notification.style.background = '#ff9800';
        } else {
            notification.style.background = '#2196F3';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'dl-notification-out 0.3s ease';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    // ========== 文件扫描和下载函数 ==========
    function extractRealFileNameFromUrl(url) {
        try {
            let decodedUrl = decodeURIComponent(url);
            const urlObj = new URL(decodedUrl);
            const pathname = urlObj.pathname;

            const pathParts = pathname.split('/').filter(part => part.length > 0);
            if (pathParts.length === 0) return null;

            let fileName = pathParts[pathParts.length - 1];

            if (fileName.includes('.')) {
                fileName = fileName.split('?')[0].split('#')[0];

                if (fileName.length < 20 && !fileName.match(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/)) {
                    const queryParams = urlObj.searchParams;
                    const possibleFileParams = [
                        'filename', 'file', 'name', 'download',
                        'fileName', 'file_name', 'attachment'
                    ];

                    for (const param of possibleFileParams) {
                        const value = queryParams.get(param);
                        if (value && value.includes('.')) {
                            const decodedValue = decodeURIComponent(value);
                            if (decodedValue.length > fileName.length) {
                                fileName = decodedValue.split('?')[0].split('#')[0];
                                break;
                            }
                        }
                    }
                }

                return fileName;
            } else {
                const queryParams = urlObj.searchParams;
                const possibleFileParams = [
                    'filename', 'file', 'name', 'download',
                    'fileName', 'file_name', 'attachment'
                ];

                for (const param of possibleFileParams) {
                    const value = queryParams.get(param);
                    if (value) {
                        const decodedValue = decodeURIComponent(value);
                        if (decodedValue.includes('.')) {
                            return decodedValue.split('?')[0].split('#')[0];
                        }
                    }
                }

                return fileName;
            }
        } catch (e) {
            try {
                const lastSlashIndex = url.lastIndexOf('/');
                if (lastSlashIndex !== -1) {
                    let fileName = url.substring(lastSlashIndex + 1);
                    fileName = fileName.split('?')[0].split('#')[0];
                    fileName = decodeURIComponent(fileName);
                    return fileName;
                }
            } catch (e2) {
                console.error('文件名提取失败:', e2);
            }
        }

        return null;
    }

    function extractFileNameFromLink(link) {
        if (link.download) {
            const downloadName = link.download.trim();
            if (downloadName && downloadName.length > 0) {
                return downloadName.replace(/[<>:"/\\|?*]/g, '_');
            }
        }

        const text = (link.textContent || link.innerText || '').trim();
        if (text) {
            const cleanedText = text.replace(/\s+/g, ' ').replace(/[\r\n]+/g, ' ').trim();

            if (cleanedText.includes('.') && cleanedText.length < 50) {
                return cleanedText.replace(/[<>:"/\\|?*]/g, '_');
            }
        }

        if (link.title) {
            const title = link.title.trim();
            if (title.includes('.') && title.length < 100) {
                return title.replace(/[<>:"/\\|?*]/g, '_');
            }
        }

        const href = link.getAttribute('href') || link.href || '';
        const fileName = extractRealFileNameFromUrl(href);
        if (fileName) {
            return fileName.replace(/[<>:"/\\|?*]/g, '_');
        }

        return '未命名文件';
    }

    function scanAndDisplayFiles(modal) {
        const allLinks = Array.from(document.querySelectorAll('a[href]')).filter(link => {
            const href = link.href;
            return href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('#');
        });

        const fileLinks = [];
        const selectedTypes = Array.from(CONFIG.selectedFileTypes);

        allLinks.forEach(link => {
            const url = link.href.toLowerCase();

            if (selectedTypes.length === 0) {
                fileLinks.push(link);
                return;
            }

            for (const type of selectedTypes) {
                if (url.includes(type.toLowerCase())) {
                    fileLinks.push(link);
                    return;
                }
            }

            if (link.hasAttribute('download')) {
                fileLinks.push(link);
            }
        });

        displayFileList(modal, fileLinks);
    }

    function displayFileList(modal, links) {
        const container = modal.querySelector('#file-list-container');
        const fileList = modal.querySelector('#file-list');
        const fileCount = modal.querySelector('#file-count');
        const startBtn = modal.querySelector('#start-download-btn');

        if (links.length === 0) {
            fileList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">未找到符合条件的文件</div>';
            fileCount.textContent = '找到 0 个文件';
            container.style.display = 'block';
            startBtn.style.display = 'none';
            return;
        }

        let fileListHTML = '';
        links.forEach((link, index) => {
            const url = link.href;
            const fileName = extractFileNameFromLink(link);
            const fileIcon = getFileIconByUrl(url);

            fileListHTML += `
                <div class="dl-file-item">
                    <input type="checkbox" class="dl-file-checkbox" id="file-${index}" checked data-url="${url}" data-filename="${fileName}" />
                    <div class="dl-file-icon">${fileIcon}</div>
                    <div class="dl-file-info">
                        <div class="dl-file-name" title="${fileName}">${fileName}</div>
                        <div class="dl-file-url" title="${url}">${url}</div>
                    </div>
                </div>
            `;
        });

        fileList.innerHTML = fileListHTML;
        fileCount.textContent = `找到 ${links.length} 个文件`;
        container.style.display = 'block';
        startBtn.style.display = 'inline-block';

        modal.querySelector('#select-all-files').addEventListener('change', (e) => {
            const checkboxes = modal.querySelectorAll('.dl-file-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
    }

    function getFileIconByUrl(url) {
        const lowerUrl = url.toLowerCase();

        if (lowerUrl.includes('.pdf')) return '📄';
        if (lowerUrl.includes('.doc')) return '📝';
        if (lowerUrl.includes('.xls')) return '📊';
        if (lowerUrl.includes('.ppt')) return '📽️';
        if (lowerUrl.includes('.txt') || lowerUrl.includes('.rtf')) return '📃';
        if (lowerUrl.includes('.mp3') || lowerUrl.includes('.wav')) return '🎵';
        if (lowerUrl.includes('.mp4') || lowerUrl.includes('.avi') || lowerUrl.includes('.mov') || lowerUrl.includes('.wmv') || lowerUrl.includes('.flv')) return '🎬';

        return '📎';
    }

    async function startBatchDownload(modal) {
        const selectedFiles = [];
        const checkboxes = modal.querySelectorAll('.dl-file-checkbox:checked');

        if (checkboxes.length === 0) {
            return;
        }

        checkboxes.forEach(cb => {
            selectedFiles.push({
                url: cb.dataset.url,
                originalName: cb.dataset.filename
            });
        });

        const filenameRule = modal.querySelector('#filename-rule').value;
        const delay = parseInt(modal.querySelector('#download-delay').value) || 0;
        const concurrent = parseInt(modal.querySelector('#concurrent-downloads').value) || 3;

        const progressContainer = modal.querySelector('#download-progress');
        const progressBar = modal.querySelector('#progress-bar');
        const status = modal.querySelector('#download-status');

        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        status.textContent = '准备下载...';
        status.className = 'dl-status dl-status-info';

        modal.querySelector('#start-download-btn').disabled = true;
        modal.querySelector('#scan-files-btn').disabled = true;

        try {
            await batchDownloadFiles(selectedFiles, filenameRule, delay, concurrent, progressBar, status);

        } catch (error) {
            console.error('批量下载失败:', error);
            status.textContent = `下载失败: ${error.message}`;
            status.className = 'dl-status dl-status-error';
        } finally {
            setTimeout(() => {
                modal.querySelector('#start-download-btn').disabled = false;
                modal.querySelector('#scan-files-btn').disabled = false;
            }, 3000);
        }
    }

    async function batchDownloadFiles(files, filenameRule, delay, concurrent, progressBar, status) {
        const total = files.length;
        let completed = 0;
        let failed = 0;

        for (let i = 0; i < files.length; i += concurrent) {
            const batch = files.slice(i, i + concurrent);
            const promises = batch.map((file, index) => {
                return new Promise(async (resolve) => {
                    try {
                        const originalName = file.originalName || '未命名文件';
                        const filename = generateFileName(originalName, i + index, filenameRule);

                        status.textContent = `正在下载: ${filename} (${i + index + 1}/${total})`;

                        await downloadFileFromUrl(file.url, filename);

                        completed++;

                    } catch (error) {
                        console.error('下载失败:', error);
                        failed++;
                    } finally {
                        const progress = Math.round(((i + index + 1) / total) * 100);
                        progressBar.style.width = `${progress}%`;

                        if (delay > 0) {
                            await sleep(delay);
                        }

                        resolve();
                    }
                });
            });

            await Promise.all(promises);
        }

        if (failed === 0) {
            status.textContent = `下载完成！成功下载 ${completed} 个文件`;
            status.className = 'dl-status dl-status-success';
        } else {
            status.textContent = `下载完成！成功 ${completed} 个，失败 ${failed} 个`;
            status.className = 'dl-status dl-status-warning';
        }

        return { completed, failed };
    }

    function generateFileName(originalName, index, rule) {
        if (!originalName || originalName === '未命名文件') {
            originalName = 'file';
        }

        let extension = '';
        let nameWithoutExt = originalName;

        if (originalName.includes('.')) {
            const lastDotIndex = originalName.lastIndexOf('.');
            extension = originalName.substring(lastDotIndex);
            nameWithoutExt = originalName.substring(0, lastDotIndex);
        }

        nameWithoutExt = nameWithoutExt.replace(/[<>:"/\\|?*]/g, '_').trim();

        switch (rule) {
            case 'numbered':
                return `${nameWithoutExt}_${index + 1}${extension}`;
            case 'timestamp':
                return `${nameWithoutExt}_${getTimestamp()}${extension}`;
            case 'original':
            default:
                return originalName;
        }
    }

    function downloadFileFromUrl(url, filename) {
        return new Promise((resolve, reject) => {
            try {
                filename = cleanFileName(filename);

                if (typeof GM_download === 'function') {
                    GM_download({
                        url: url,
                        name: filename,
                        saveAs: true,
                        onload: function() {
                            resolve();
                        },
                        onerror: function(error) {
                            console.error('GM_download failed:', error);
                            fallbackUrlDownload(url, filename).then(resolve).catch(reject);
                        }
                    });
                } else {
                    fallbackUrlDownload(url, filename).then(resolve).catch(reject);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    function fallbackUrlDownload(url, filename) {
        return new Promise((resolve, reject) => {
            try {
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.target = '_blank';
                a.style.display = 'none';

                document.body.appendChild(a);

                if (typeof a.click === 'function') {
                    a.click();
                } else {
                    const event = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    a.dispatchEvent(event);
                }

                setTimeout(() => {
                    if (a.parentNode) {
                        a.parentNode.removeChild(a);
                    }
                    resolve();
                }, 100);

            } catch (error) {
                console.error('URL下载失败:', error);
                reject(error);
            }
        });
    }

    // ========== 全局暴露 ==========
    window.DataLiberator = {
        version: CONFIG.version,
        scanTables: () => {
            return scanTablesInDocument(document, false);
        },
        enhancedScanTables: enhancedScanTables,
        exportTable: (table) => showExportModal(table),
        exportAllTables: exportAllTables,
        highlightTable: highlightTable,
        clearHighlight: () => clearTableHighlight(true),
        batchDownload: showBatchDownloadModal,
        showSettings: showEnhancedSettingsModal,
        showHelp: showHelpModal,
        // 新增：表格按钮相关
        addExportButtons: (tables) => addExportButtonsToTables(tables || scanTablesInDocument(document, false)),
        removeExportButtons: removeAllExportButtons
    };

    console.log('网页表格提取助手 v' + CONFIG.version + ' 加载完成！');
    console.log('快捷键：Alt+S 扫描表格，Alt+D 批量下载');
    console.log('深度扫描功能已集成到扫描结果中，点击"深度扫描"按钮即可');
    console.log('新增功能：表格超链接导出支持、长数字文本化选项、表格右上角快捷导出按钮');
})();
