// ==UserScript==
// @name         Markdown文件阅读器
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  纯离线处理Markdown，内置解析器，完美支持本地文件，右上角一键切换预览与源码，支持导出doc文档。智能识别纯文本页面，避免误渲染GitHub等网页。
// @author       MRBANK
// @match        file:///*
// @match        *://*/*.md
// @match        *://*/*.markdown
// @match        *://*/*.txt
// @grant        GM_addStyle
// @run-at       document-start
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSI1IiBmaWxsPSIjMjgyYTM2IiBzdHJva2U9IiM1MGZhN2IiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iMTIiIHk9IjE2LjUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM1MGZhN2IiPk08L3RleHQ+PC9zdmc+
// @downloadURL  https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/Markdown.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/Markdown.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ========== 配置 ==========
    const CONFIG = {
        autoRender: true
    };

    // ========== 内置 Markdown 解析引擎 ==========
    const MarkdownParser = {
        parse(md) {
            let html = md;
            html = this.parseCodeBlocks(html);
            html = this.escapeHtml(html);

            // Headers
            html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
            html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
            html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
            html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
            html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
            html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

            // HR
            html = html.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '<hr>');

            // Images & Links
            html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
            html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

            // Styles
            html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
            html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
            html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
            html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

            // Blockquotes, Lists, Tables
            html = this.parseBlockquotes(html);
            html = this.parseLists(html);
            html = this.parseTables(html);

            html = this.restoreCodeBlocks(html);
            html = this.cleanupHtmlArtifacts(html);

            // Paragraphs
            html = this.wrapParagraphs(html);

            return html;
        },

        escapeHtml(text) {
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },

        codeBlocks: [],

        parseCodeBlocks(text) {
            this.codeBlocks = [];
            return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
                const index = this.codeBlocks.push({ lang, code: code.trim() }) - 1;
                return `CODEBLOCKPLACEHOLDER${index}BLOCK`;
            });
        },

        restoreCodeBlocks(text) {
            return text.replace(/CODEBLOCKPLACEHOLDER(\d+)BLOCK/g, (match, index) => {
                const block = this.codeBlocks[index];
                const escapedCode = block.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<pre><code class="language-${block.lang}">${this.highlight(escapedCode, block.lang)}</code></pre>`;
            });
        },

        highlight(code, lang) {
            const keywords = {
                js: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'import', 'export'],
                python: ['def', 'class', 'return', 'if', 'else', 'import', 'from', 'as', 'True', 'False'],
                default: []
            };
            const kwList = keywords[lang] || keywords.default;

            const placeholderStore = [];
            const stash = (text) => `HIGHLIGHTPLACEHOLDER${placeholderStore.push(text) - 1}TOKEN`;

            let res = code;
            res = res.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g, match => stash(`<span class="md-hl-str">${match}</span>`));
            res = res.replace(/(\/\/.*$|#.*$)/gm, match => stash(`<span class="md-hl-cmt">${match}</span>`));
            res = res.replace(/\b(\d+\.?\d*)\b/g, '<span class="md-hl-num">$1</span>');
            kwList.forEach(k => {
                res = res.replace(new RegExp(`\\b(${k})\\b`, 'g'), '<span class="md-hl-kw">$1</span>');
            });
            res = res.replace(/HIGHLIGHTPLACEHOLDER(\d+)TOKEN/g, (match, index) => placeholderStore[Number(index)] || '');

            return res;
        },

        parseBlockquotes(text) {
            const lines = text.split('\n');
            let html = [];
            let inQuote = false;

            lines.forEach(line => {
                if (line.startsWith('&gt; ') || line.startsWith('> ')) {
                    if (!inQuote) { html.push('<blockquote>'); inQuote = true; }
                    html.push(line.replace(/^(?:&gt;|>)\s*/, ''));
                } else {
                    if (inQuote) { html.push('</blockquote>'); inQuote = false; }
                    html.push(line);
                }
            });
            if (inQuote) html.push('</blockquote>');
            return html.join('\n');
        },

        parseLists(text) {
            const lines = text.split('\n');
            let html = [];
            let listType = null;

            lines.forEach(line => {
                const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)/);
                const olMatch = line.match(/^[\s]*\d+\.\s+(.+)/);

                if (ulMatch) {
                    if (listType !== 'ul') { if (listType) html.push(`</${listType}>`); html.push('<ul>'); listType = 'ul'; }
                    html.push(`<li>${ulMatch[1]}</li>`);
                } else if (olMatch) {
                    if (listType !== 'ol') { if (listType) html.push(`</${listType}>`); html.push('<ol>'); listType = 'ol'; }
                    html.push(`<li>${olMatch[1]}</li>`);
                } else {
                    if (listType) { html.push(`</${listType}>`); listType = null; }
                    html.push(line);
                }
            });
            if (listType) html.push(`</${listType}>`);
            return html.join('\n');
        },

        parseTables(text) {
            return text.replace(/^(\|.+\|)\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm, (m, h, b) => {
                const headerCells = h.split('|').slice(1, -1).map(s => `<th>${s.trim()}</th>`).join('');
                const bodyRows = b.trim().split('\n').map(r => {
                    const rowCells = r.split('|').slice(1, -1).map(c => `<td>${c.trim()}</td>`).join('');
                    return `<tr>${rowCells}</tr>`;
                }).join('');
                return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
            });
        },

        wrapParagraphs(text) {
            const blocks = text.split(/\n\n+/);
            return blocks.map(block => {
                block = block.trim();
                if (!block) return '';
                if (/^<(h[1-6]|ul|ol|pre|blockquote|table|hr|div)\b/i.test(block)) {
                    return block;
                }
                return `<p>${block.replace(/\n/g, '<br>')}</p>`;
            }).join('\n');
        },

        cleanupHtmlArtifacts(html) {
            return html
                .replace(/&lt;(\/)?span class=&quot;(md-hl-(?:num|str|kw|cmt))&quot;&gt;/g, '<$1span class="$2">')
                .replace(/&lt;(\/)?(strong|em|del|code|blockquote|pre|h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|p|a|img|hr|div)([^&]*)&gt;/g, '<$1$2$3>')
                .replace(/&lt;br&gt;/g, '<br>')
                .replace(/&lt;\/span&gt;/g, '</span>')
                .replace(/&lt;\/a&gt;/g, '</a>')
                .replace(/&lt;\/code&gt;/g, '</code>')
                .replace(/&lt;\/strong&gt;/g, '</strong>')
                .replace(/&lt;\/em&gt;/g, '</em>')
                .replace(/&lt;\/del&gt;/g, '</del>')
                .replace(/&quot;/g, '"');
        }
    };

    // ========== 内容特征嗅探 ==========
    // 检查文本内容是否包含典型的 Markdown 标记，避免将普通纯文本文件（如 txt 小说）错误渲染
    function looksLikeMarkdown(text) {
        if (!text || text.trim().length === 0) return false;
        // 取前 30 行进行分析，兼顾性能与准确率
        const lines = text.split('\n').slice(0, 30);
        let score = 0;
        lines.forEach(line => {
            if (/^#{1,6}\s/.test(line)) score += 2;    // ATX 标题 (# ## ###)
            if (/^[-*+]\s/.test(line)) score += 1;     // 无序列表 (- * +)
            if (/^\d+\.\s/.test(line)) score += 1;     // 有序列表 (1. 2.)
            if (/^>\s/.test(line)) score += 1;          // 引用 (>)
            if (/\*\*[^*]+\*\*/.test(line)) score += 1;// 粗体
            if (/__[^_]+__/.test(line)) score += 1;    // 粗体
            if (/!\[[^\]]*\]\([^)]+\)/.test(line)) score += 2; // 图片
            if (/\[[^\]]+\]\([^)]+\)/.test(line)) score += 1;  // 链接
            if (/^[-]{3,}$/.test(line.trim())) score += 1;     // 分割线
            if (/^[*]{3,}$/.test(line.trim())) score += 1;     // 分割线
        });
        // 得分阈值设定为 2，只要有一点结构化特征就认为是 Markdown
        return score >= 2;
    }

    // ========== 样式 ==========
    GM_addStyle(`
        /* 控制面板容器 - 深色背景 */
        #md-control-panel {
            position: fixed;
            top: 12px;
            right: 12px;
            z-index: 2147483647;
            display: flex;
            background: #2b2b2b; /* 深色背景 */
            padding: 4px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            border: 1px solid #444;
        }

        /* 按钮通用样式 */
        .md-btn-control {
            background: transparent;
            color: #999;
            border: none;
            padding: 6px 16px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s ease-in-out;
            line-height: 1.5;
        }

        /* 按钮悬浮效果 */
        .md-btn-control:hover {
            color: #fff;
        }

        /* 激活状态 - 浅灰色背景白色文字 */
        .md-btn-control.active {
            background: #555; /* 浅灰色背景 */
            color: #fff;     /* 白色文字 */
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        /* Markdown 渲染页面样式 */
        .md-rendered-body {
            background: #282a36;
            color: #f8f8f2;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.6;
            padding: 40px 20px;
            max-width: 900px;
            margin: 0 auto;
        }

        .md-rendered-body h1, .md-rendered-body h2, .md-rendered-body h3,
        .md-rendered-body h4, .md-rendered-body h5, .md-rendered-body h6 {
            color: #bd93f9;
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        .md-rendered-body h1 { font-size: 2em; border-bottom: 1px solid #444; padding-bottom: .3em; }
        .md-rendered-body h2 { font-size: 1.5em; border-bottom: 1px solid #444; padding-bottom: .3em; }

        .md-rendered-body p { margin-bottom: 16px; }

        .md-rendered-body a { color: #8be9fd; text-decoration: none; }
        .md-rendered-body a:hover { text-decoration: underline; }

        .md-rendered-body code {
            background: #44475a;
            padding: 0.2em 0.4em;
            margin: 0;
            font-size: 85%;
            border-radius: 3px;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            color: #50fa7b;
        }

        .md-rendered-body pre {
            background: #1e1f29;
            border-radius: 6px;
            padding: 16px;
            overflow: auto;
            line-height: 1.45;
            font-size: 14px;
        }
        .md-rendered-body pre code {
            background: transparent;
            padding: 0;
            color: #f8f8f2;
        }

        /* 语法高亮 */
        .md-hl-kw { color: #ff79c6; }
        .md-hl-str { color: #f1fa8c; }
        .md-hl-num { color: #bd93f9; }
        .md-hl-cmt { color: #6272a4; font-style: italic; }

        .md-rendered-body blockquote {
            border-left: 4px solid #bd93f9;
            padding-left: 16px;
            margin: 0 0 16px 0;
            color: #b0b0b0;
        }

        .md-rendered-body table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 16px;
        }
        .md-rendered-body table th, .md-rendered-body table td {
            border: 1px solid #444;
            padding: 8px 12px;
        }
        .md-rendered-body table th { background: #44475a; font-weight: 600; }
        .md-rendered-body table tr:nth-child(even) { background: rgba(40, 42, 54, 0.5); }

        .md-rendered-body img {
            max-width: 100%;
            border-radius: 4px;
            margin: 10px 0;
        }

        .md-rendered-body hr {
            border: 0;
            height: 1px;
            background-image: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0));
            margin: 2em 0;
        }
    `);

    // ========== 逻辑控制 ==========
    let isRendered = false;
    let originalContent = '';

    // 创建控制面板
    const panel = document.createElement('div');
    panel.id = 'md-control-panel';

    // 创建按钮
    const btnPreview = document.createElement('button');
    btnPreview.className = 'md-btn-control active'; // 默认激活预览
    btnPreview.textContent = 'Preview';

    const btnSource = document.createElement('button');
    btnSource.className = 'md-btn-control';
    btnSource.textContent = 'Markdown';

    const btnExportWord = document.createElement('button');
    btnExportWord.className = 'md-btn-control';
    btnExportWord.textContent = 'Export .doc';

    panel.appendChild(btnPreview);
    panel.appendChild(btnSource);
    panel.appendChild(btnExportWord);

    const url = window.location.href;
    const isLocalFile = window.location.protocol === 'file:';
    const isMarkdownUrl = url.endsWith('.md') || url.endsWith('.markdown');
    const isTxtUrl = url.endsWith('.txt');

    function init() {
        const body = document.body;
        if (!body) return;

        let shouldTakeOver = false;
        let textContent = '';

        // 情况 1：本地文件，充分信任后缀名，无需内容嗅探
        if (isLocalFile) {
            // 如果是本地 .md / .markdown / .txt 文件，直接接管渲染
            if (isMarkdownUrl || isTxtUrl) {
                textContent = body.innerText || body.textContent;
                shouldTakeOver = true;
            }
        }
        // 情况 2：网络文件，需要严格校验 DOM 和 内容，防止误杀已渲染网页
        else {
            // 步骤 A：判断 DOM 结构是否表现为浏览器原生的纯文本展示
            let isPlainTextDom = false;

            // 如果存在典型的网页结构标签，绝对不是原生纯文本展示
            const hasComplexHtml = body.querySelector('div, article, section, table, main, nav, header, footer, form');

            if (!hasComplexHtml) {
                const preElements = body.querySelectorAll('pre');
                // 浏览器用 <pre> 标签包裹纯文本展示
                if (preElements.length === 1 && body.textContent.trim() === preElements[0].textContent.trim()) {
                    isPlainTextDom = true;
                }
                // 文本直接在 body 下，没有被 <pre> 包裹
                else if (body.childElementCount === 0 && body.textContent.trim().length > 0) {
                    isPlainTextDom = true;
                }
            }

            // 步骤 B：如果是纯文本 DOM，再进行内容嗅探
            if (isPlainTextDom) {
                textContent = body.innerText || body.textContent;
                // 只要内容看起来像 Markdown，不管是 .md 还是 .txt 结尾，都接管
                if (looksLikeMarkdown(textContent)) {
                    shouldTakeOver = true;
                }
            }
        }

        // 如果不符合接管条件，什么都不做，保持网页原样
        if (!shouldTakeOver) return;

        // --- 符合条件，开始接管渲染 ---
        document.body.appendChild(panel);
        originalContent = textContent;

        renderMarkdown();
    }

    function getMarkdownSource() {
        return document.body.dataset.mdSource || originalContent || document.body.innerText || '';
    }

    function getDocumentTitle() {
        const pathname = decodeURIComponent(window.location.pathname || 'document');
        const filename = pathname.split('/').pop() || 'document';
        return filename.replace(/\.(md|markdown|txt)$/i, '') || 'document';
    }

    function getExportTimestamp() {
        const now = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    function escapeHtmlForWord(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function buildWordHtml(title, html) {
        const exportTime = getExportTimestamp();
        return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="utf-8">
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Markdown文件阅读器 2.0">
    <title>${escapeHtmlForWord(title)}</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: 21cm 29.7cm;
            margin: 2.2cm 1.8cm 2.2cm 1.8cm;
        }
        body {
            font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
            color: #222;
            line-height: 1.75;
            margin: 0;
            font-size: 12pt;
            background: #fff;
        }
        .doc-header {
            margin-bottom: 24px;
            padding-bottom: 14px;
            border-bottom: 1px solid #d9d9d9;
        }
        .doc-title {
            font-size: 24pt;
            font-weight: 700;
            line-height: 1.3;
            color: #111;
            margin: 0 0 8px;
        }
        .doc-meta {
            font-size: 10.5pt;
            color: #666;
            margin: 0;
        }
        .doc-content {
            margin: 0;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #1f1f1f;
            margin-top: 22px;
            margin-bottom: 10px;
            font-weight: 700;
            line-height: 1.4;
            page-break-after: avoid;
        }
        h1 { font-size: 20pt; border-bottom: 1px solid #d9d9d9; padding-bottom: 6px; }
        h2 { font-size: 16pt; border-bottom: 1px solid #ebebeb; padding-bottom: 4px; }
        h3 { font-size: 14pt; }
        h4 { font-size: 13pt; }
        h5, h6 { font-size: 12pt; }
        p {
            margin: 0 0 12px;
            text-align: justify;
            word-break: break-word;
        }
        a { color: #0563c1; text-decoration: underline; }
        blockquote {
            margin: 14px 0;
            padding: 8px 12px;
            border-left: 4px solid #c9c9c9;
            color: #555;
            background: #fafafa;
        }
        pre {
            white-space: pre-wrap;
            word-break: break-word;
            background: #f7f7f7;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 12px;
            margin: 12px 0 16px;
            font-family: Consolas, "Courier New", monospace;
            font-size: 10.5pt;
            line-height: 1.55;
            color: #222;
        }
        code {
            font-family: Consolas, "Courier New", monospace;
            background: #f3f3f3;
            padding: 1px 4px;
            border-radius: 3px;
            color: #222;
        }
        pre code {
            background: transparent;
            padding: 0;
            color: inherit;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 12px 0 18px;
            table-layout: fixed;
        }
        th, td {
            border: 1px solid #bfbfbf;
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
        }
        th {
            background: #f0f0f0;
            font-weight: 700;
        }
        tr:nth-child(even) td {
            background: #fcfcfc;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 10px 0;
        }
        hr {
            border: none;
            border-top: 1px solid #d9d9d9;
            margin: 20px 0;
        }
        ul, ol {
            margin: 0 0 14px 26px;
            padding: 0;
        }
        li {
            margin: 0 0 6px;
        }
        li > p {
            margin-bottom: 6px;
        }
        .md-image-fallback {
            margin: 12px 0;
            padding: 8px 10px;
            border: 1px dashed #c8c8c8;
            color: #666;
            font-size: 10.5pt;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div class="doc-header">
        <div class="doc-title">${escapeHtmlForWord(title)}</div>
        <p class="doc-meta">导出时间：${escapeHtmlForWord(exportTime)}</p>
    </div>
    <div class="doc-content">
 ${html}
    </div>
</body>
</html>`;
    }

    function normalizeMixedText(text) {
        return text
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/([\u4e00-\u9fff])\s+([A-Za-z0-9@#&])/g, '$1 $2')
            .replace(/([A-Za-z0-9@#&])\s+([\u4e00-\u9fff])/g, '$1 $2')
            .replace(/([\u4e00-\u9fff])\s+([，。！？；：、])/g, '$1$2')
            .replace(/([（《“‘])\s+/g, '$1')
            .replace(/\s+([）》）。！？；：，、”’])/g, '$1')
            .replace(/\s+([,.!?;:])/g, '$1')
            .replace(/([,.!?;:])(?!\s|$|[)\]}>"'])/g, '$1 ')
            .replace(/\(\s+/g, '(')
            .replace(/\s+\)/g, ')')
            .replace(/\[\s+/g, '[')
            .replace(/\s+\]/g, ']')
            .replace(/\{\s+/g, '{')
            .replace(/\s+\}/g, '}')
            .trim();
    }

    function normalizeBlockHtml(html) {
        return html
            .replace(/&nbsp;/g, ' ')
            .replace(/\s*<br\s*\/?>\s*/gi, '<br>')
            .replace(/(<br>){3,}/gi, '<br><br>')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/(?:<br>\s*)+$/gi, '')
            .replace(/^(?:\s*<br>)+/gi, '')
            .trim();
    }

    function simplifyWordHtml(html) {
        const container = document.createElement('div');
        container.innerHTML = html;

        container.querySelectorAll('pre code').forEach(codeEl => {
            const plainCode = codeEl.textContent || '';
            const newCode = document.createElement('code');
            newCode.textContent = plainCode
                .replace(/\r\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trimEnd();
            codeEl.replaceWith(newCode);
        });

        container.querySelectorAll('code:not(pre code)').forEach(codeEl => {
            codeEl.textContent = (codeEl.textContent || '').replace(/\s+/g, ' ').trim();
        });

        container.querySelectorAll('br + br').forEach(br => br.remove());

        container.querySelectorAll('p, li, blockquote, td, th').forEach(el => {
            el.innerHTML = normalizeBlockHtml(el.innerHTML);
        });

        container.querySelectorAll('p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6').forEach(el => {
            if (el.children.length === 0) {
                el.textContent = normalizeMixedText(el.textContent || '');
            }
        });

        container.querySelectorAll('li').forEach(li => {
            li.innerHTML = normalizeBlockHtml(li.innerHTML);
            if (!li.innerHTML) {
                li.remove();
            }
        });

        container.querySelectorAll('ul, ol').forEach(list => {
            const items = list.querySelectorAll(':scope > li');
            if (items.length === 0) {
                list.remove();
            }
        });

        container.querySelectorAll('blockquote').forEach(quote => {
            quote.innerHTML = normalizeBlockHtml(quote.innerHTML);
        });

        container.querySelectorAll('td, th').forEach(cell => {
            cell.innerHTML = normalizeBlockHtml(cell.innerHTML);
        });

        container.querySelectorAll('p').forEach(p => {
            if (!p.textContent.trim() && !p.querySelector('img, br, code')) {
                p.remove();
            }
        });

        container.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || '';
            const alt = normalizeMixedText(img.getAttribute('alt') || '图片');
            const fallback = document.createElement('div');
            fallback.className = 'md-image-fallback';
            fallback.innerHTML = src
                ? `图片：${escapeHtmlForWord(alt)}<br>路径：${escapeHtmlForWord(src)}`
                : `图片：${escapeHtmlForWord(alt)}`;
            img.replaceWith(fallback);
        });

        container.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name === 'class' || attr.name === 'style') {
                    el.removeAttribute(attr.name);
                }
            });
        });

        let cleanedHtml = container.innerHTML;
        cleanedHtml = cleanedHtml
            .replace(/&amp;nbsp;/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/>\s+</g, '><')
            .replace(/<(p|li|blockquote|td|th)><br><\/(p|li|blockquote|td|th)>/gi, '')
            .replace(/<(ul|ol)>\s*<\/(ul|ol)>/gi, '')
            .trim();

        cleanedHtml = cleanedHtml
            .replace(/<p>\s*<\/p>/gi, '')
            .replace(/<li>\s*<\/li>/gi, '')
            .replace(/<blockquote>\s*<\/blockquote>/gi, '')
            .replace(/<td>\s*<\/td>/gi, '<td></td>')
            .replace(/<th>\s*<\/th>/gi, '<th></th>')
            .replace(/<br>\s*<\/li>/gi, '</li>')
            .replace(/<br>\s*<\/p>/gi, '</p>')
            .replace(/<br>\s*<\/blockquote>/gi, '</blockquote>')
            .replace(/<\/li>\s*<li>/gi, '</li><li>')
            .replace(/<\/p>\s*<p>/gi, '</p><p>')
            .replace(/<\/blockquote>\s*<blockquote>/gi, '</blockquote><blockquote>');

        return cleanedHtml;
    }

    function downloadBlob(filename, content, mimeType, addBom = true) {
        const blob = content instanceof Blob
            ? content
            : new Blob(addBom ? ['\ufeff', content] : [content], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    }

    function exportWord() {
        const source = getMarkdownSource();
        const html = MarkdownParser.parse(source);
        const simplifiedHtml = simplifyWordHtml(html);
        const title = getDocumentTitle();
        const wordHtml = buildWordHtml(title, simplifiedHtml);
        downloadBlob(`${title}.doc`, wordHtml, 'application/msword;charset=utf-8');
    }


    function renderMarkdown() {
        if (isRendered) return;

        if (!document.body.dataset.mdSource) {
            document.body.dataset.mdSource = originalContent;
        }

        const html = MarkdownParser.parse(document.body.dataset.mdSource);

        document.body.innerHTML = '';
        document.body.className = 'md-rendered-body';
        document.body.innerHTML = html;

        document.body.appendChild(panel);

        // 更新按钮状态
        btnPreview.classList.add('active');
        btnSource.classList.remove('active');

        isRendered = true;
    }

    function showSource() {
        if (!isRendered) return;

        document.body.className = '';
        document.body.innerHTML = '';

        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.wordWrap = 'break-word';
        pre.style.fontFamily = 'monospace';
        pre.textContent = document.body.dataset.mdSource || originalContent;
        document.body.appendChild(pre);

        document.body.appendChild(panel);

        // 更新按钮状态
        btnSource.classList.add('active');
        btnPreview.classList.remove('active');

        isRendered = false;
    }

    // 绑定事件
    btnPreview.addEventListener('click', () => {
        if (!isRendered) renderMarkdown();
    });

    btnSource.addEventListener('click', () => {
        if (isRendered) showSource();
    });

    btnExportWord.addEventListener('click', () => {
        try {
            exportWord();
        } catch (error) {
            console.error('导出 Word 失败:', error);
            alert('导出 Word 失败，请打开控制台查看错误信息。');
        }
    });

    // 等待DOM加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
