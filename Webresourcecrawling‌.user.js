// ==UserScript==
// @name         网页资源提取器
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  按Alt+S或通过菜单激活，扫描网页中的SVG文件、图片和视频，支持预览、选择和批量下载，修复图片地址获取问题。
// @author       MRBANK
// @match        *://*/*
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMxYTFhMWEiLz48cGF0aCBkPSJNOCA0NSBMMjIgMjUgTDMyIDM1IEw1NiAxMiIgc3Ryb2tlPSIjMDBkNGFhIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZmlsbD0ibm9uZSIgb3BhY2l0eT0iMC44Ii8+PHBhdGggZD0iTTMyIDE4IEwzMiA0MiBNMjQgMzQgTDMyIDQyIEw0MCAzNCBNMjAgNTAgTDQ0IDUwIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMy41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGZpbGw9Im5vbmUiLz48L3N2Zz4=
// @downloadURL  https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/Webresourcecrawling‌.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/hangzai1667/my-tampermonkey-scripts@main/Webresourcecrawling‌.user.js

// ==/UserScript==

(function() {
    'use strict';

    // ============ 配置与状态 ============
    const CONFIG = {
        prefix: 'media-extractor',
        colors: {
            bg: '#0d0d0d',
            card: '#1a1a1a',
            border: '#2a2a2a',
            accent: '#00d4aa',
            accentHover: '#00ffcc',
            secondary: '#ff9500',
            tertiary: '#ff6b9d',
            danger: '#ff6b6b',
            text: '#e0e0e0',
            textMuted: '#808080'
        },
        imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tiff', 'svg'],
        videoFormats: ['mp4', 'webm', 'ogg', 'avi', 'mov', 'flv', 'mkv', 'wmv', '3gp', 'm4v', 'mpg', 'mpeg'],
        audioFormats: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'],
        // 图片地址可能存在的属性
        imageAttributes: ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-actual', 'data-lazy', 'data-defer-src', 'data-load-src']
    };

    let state = {
        resources: [],
        selectedIds: new Set(),
        isScanning: false,
        isPanelOpen: false,
        filterType: 'all' // all, svg, image, video
    };

    // ============ 工具函数 ============
    function generateId() {
        return 'res-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    function sanitizeFilename(name) {
        return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100) || 'unnamed';
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return 'unknown';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function getExtensionFromUrl(url) {
        try {
            const pathname = new URL(url, location.href).pathname;
            const ext = pathname.split('.').pop().toLowerCase();
            // 移除查询参数
            return ext.split('?')[0] || null;
        } catch {
            return null;
        }
    }

    function getResourceType(url, mimeType) {
        const ext = getExtensionFromUrl(url);

        if (ext === 'svg' || (mimeType && mimeType.includes('svg'))) return 'svg';
        if (CONFIG.imageFormats.includes(ext) || (mimeType && mimeType.startsWith('image'))) return 'image';
        if (CONFIG.videoFormats.includes(ext) || (mimeType && mimeType.startsWith('video'))) return 'video';
        if (CONFIG.audioFormats.includes(ext) || (mimeType && mimeType.startsWith('audio'))) return 'video'; // 音频也归类为视频

        return 'unknown';
    }

    // 获取图片元素的所有可能的地址
    function getImageUrls(imgElement) {
        const urls = [];

        // 获取所有可能包含图片地址的属性
        CONFIG.imageAttributes.forEach(attr => {
            const value = imgElement.getAttribute(attr);
            if (value && value.trim() && !value.startsWith('#') && value !== 'data:,') {
                urls.push(value.trim());
            }
        });

        // 检查srcset属性
        const srcset = imgElement.getAttribute('srcset');
        if (srcset) {
            const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]).filter(url => url);
            urls.push(...srcsetUrls);
        }

        // 检查computed style的background-image
        try {
            const computedStyle = getComputedStyle(imgElement);
            const bgImage = computedStyle.backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const matches = bgImage.matchAll(/url\(['"]?(.+?)['"]?\)/gi);
                for (const match of matches) {
                    urls.push(match[1]);
                }
            }
        } catch (e) {
            // ignore
        }

        // 去重并过滤无效URL
        const uniqueUrls = [...new Set(urls)].filter(url => {
            try {
                new URL(url, location.href);
                return true;
            } catch {
                return false;
            }
        });

        return uniqueUrls;
    }

    // 尝试获取图片的真实地址
    async function getRealImageUrl(imgElement, urls) {
        for (const url of urls) {
            try {
                // 检查URL是否看起来像图片
                const resourceType = getResourceType(url, '');
                if (resourceType === 'image' || resourceType === 'svg' || url.startsWith('data:image')) {
                    // 尝试加载图片来验证地址是否有效
                    const isValid = await testImageUrl(url);
                    if (isValid) {
                        return url;
                    }
                }
            } catch (e) {
                continue;
            }
        }

        // 如果所有URL都无效，返回第一个
        return urls[0] || null;
    }

    // 测试图片URL是否有效
    function testImageUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                resolve(false);
            }, 3000); // 3秒超时

            img.onload = () => {
                clearTimeout(timeout);
                resolve(true);
            };

            img.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
            };

            // 设置crossOrigin属性以避免CORS问题
            img.crossOrigin = 'anonymous';
            img.src = url;
        });
    }

    // 尝试获取重定向后的真实地址
    async function getFinalImageUrl(url) {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'cors',
                credentials: 'omit',
                redirect: 'follow'
            });
            return response.url || url;
        } catch (e) {
            try {
                // 尝试GET请求
                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'no-cors',
                    credentials: 'include'
                });
                return url; // no-cors模式无法获取最终URL，返回原URL
            } catch (e2) {
                return url;
            }
        }
    }

    function createImageWithFallback(src, alt, fallbackText = '无法加载') {
        const container = document.createElement('div');
        container.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;';

        const img = document.createElement('img');
        img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
        img.alt = alt;
        img.loading = 'lazy';
        img.crossOrigin = 'anonymous';

        const fallback = document.createElement('div');
        fallback.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: ${CONFIG.colors.textMuted};
            font-size: 12px;
            text-align: center;
            display: none;
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 4px;
        `;
        fallback.innerHTML = `
            <div>${fallbackText}</div>
            <div style="font-size: 10px; margin-top: 4px; word-break: break-all;">
                ${src.length > 50 ? src.substring(0, 50) + '...' : src}
            </div>
        `;

        img.onload = () => {
            fallback.style.display = 'none';
            img.style.display = 'block';
        };

        img.onerror = () => {
            img.style.display = 'none';
            fallback.style.display = 'block';
        };

        img.src = src;
        container.appendChild(img);
        container.appendChild(fallback);

        return container;
    }

    // ============ 资源扫描器 ============
    class ResourceScanner {
        constructor() {
            this.results = [];
            this.processedUrls = new Set();
        }

        async scan() {
            this.results = [];
            this.processedUrls.clear();

            // 扫描内联 SVG
            this.scanInlineSVGs();

            // 扫描图片
            await this.scanImages();

            // 扫描视频
            await this.scanVideos();

            // 扫描音频
            await this.scanAudios();

            // 扫描 object/embed 标签
            await this.scanObjectEmbeds();

            // 扫描 CSS background-image
            await this.scanCSSBackgrounds();

            // 扫描 picture 标签中的 source
            await this.scanPictureSources();

            return this.results;
        }

        scanInlineSVGs() {
            const svgs = document.querySelectorAll('svg');
            svgs.forEach((svg, index) => {
                try {
                    const serializer = new XMLSerializer();
                    let svgString = serializer.serializeToString(svg);

                    // 添加 xmlns 如果缺失
                    if (!svgString.includes('xmlns')) {
                        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                    }

                    const bbox = svg.getBoundingClientRect();
                    const parent = svg.closest('a, button, [role="button"]');

                    this.results.push({
                        id: generateId(),
                        type: 'svg',
                        category: 'inline',
                        name: svg.id || svg.getAttribute('aria-label') || `inline-svg-${index + 1}`,
                        content: svgString,
                        size: new Blob([svgString]).size,
                        dimensions: {
                            width: Math.round(bbox.width) || svg.getAttribute('width') || 'auto',
                            height: Math.round(bbox.height) || svg.getAttribute('height') || 'auto'
                        },
                        element: svg,
                        parentInfo: parent ? parent.tagName.toLowerCase() : null
                    });
                } catch (e) {
                    console.warn('Resource Extractor: 跳过无法序列化的 SVG', e);
                }
            });
        }

        async scanImages() {
            const imgs = document.querySelectorAll('img');

            for (const img of imgs) {
                try {
                    // 获取所有可能的图片地址
                    const urls = getImageUrls(img);
                    if (urls.length === 0) continue;

                    // 获取真实的图片地址
                    const realUrl = await getRealImageUrl(img, urls);
                    if (!realUrl || this.processedUrls.has(realUrl)) continue;

                    this.processedUrls.add(realUrl);

                    const resourceType = getResourceType(realUrl, img.type);
                    const bbox = img.getBoundingClientRect();

                    if (resourceType === 'svg') {
                        // SVG 图片
                        let content = '';
                        if (realUrl.startsWith('data:image/svg')) {
                            try {
                                const base64 = realUrl.split(',')[1];
                                content = decodeURIComponent(atob(base64));
                            } catch (e) {
                                content = await this.fetchResource(realUrl);
                            }
                        } else {
                            content = await this.fetchResource(realUrl);
                        }

                        if (content) {
                            this.results.push({
                                id: generateId(),
                                type: 'svg',
                                category: 'external',
                                name: this.extractFilename(realUrl) || img.alt || `svg-img-${this.results.length + 1}`,
                                content: content,
                                url: realUrl,
                                originalUrls: urls, // 保存所有找到的URL
                                size: new Blob([content]).size,
                                dimensions: {
                                    width: Math.round(bbox.width) || img.naturalWidth || 'auto',
                                    height: Math.round(bbox.height) || img.naturalHeight || 'auto'
                                }
                            });
                        }
                    } else if (resourceType === 'image' || realUrl.startsWith('data:image')) {
                        // 普通图片
                        this.results.push({
                            id: generateId(),
                            type: 'image',
                            category: 'img',
                            name: this.extractFilename(realUrl) || img.alt || `image-${this.results.length + 1}`,
                            url: realUrl,
                            originalUrls: urls, // 保存所有找到的URL
                            format: getExtensionFromUrl(realUrl) || 'unknown',
                            size: this.estimateImageSize(img),
                            dimensions: {
                                width: img.naturalWidth || Math.round(bbox.width) || 'auto',
                                height: img.naturalHeight || Math.round(bbox.height) || 'auto'
                            },
                            element: img
                        });
                    }
                } catch (e) {
                    console.warn('Resource Extractor: 无法处理图片', e);
                }
            }
        }

        async scanVideos() {
            const videos = document.querySelectorAll('video');
            for (const video of videos) {
                try {
                    // 获取视频源
                    const sources = [];

                    // 主src属性
                    if (video.src) {
                        sources.push({
                            url: video.src,
                            type: video.type || '',
                            quality: 'default'
                        });
                    }

                    // source子元素
                    const sourceElements = video.querySelectorAll('source');
                    sourceElements.forEach(source => {
                        if (source.src) {
                            sources.push({
                                url: source.src,
                                type: source.type || '',
                                quality: source.getAttribute('label') || source.getAttribute('data-quality') || 'unknown'
                            });
                        }
                    });

                    if (sources.length === 0) continue;

                    const bbox = video.getBoundingClientRect();
                    const mainSource = sources[0]; // 使用第一个源作为主要源

                    if (this.processedUrls.has(mainSource.url)) continue;
                    this.processedUrls.add(mainSource.url);

                    this.results.push({
                        id: generateId(),
                        type: 'video',
                        category: 'video',
                        name: video.title || this.extractFilename(mainSource.url) || `video-${this.results.length + 1}`,
                        url: mainSource.url,
                        format: getExtensionFromUrl(mainSource.url) || 'mp4',
                        size: 0, // 视频大小通常需要额外请求
                        duration: video.duration || 0,
                        dimensions: {
                            width: video.videoWidth || Math.round(bbox.width) || 'auto',
                            height: video.videoHeight || Math.round(bbox.height) || 'auto'
                        },
                        sources: sources,
                        element: video,
                        poster: video.poster || null
                    });
                } catch (e) {
                    console.warn('Resource Extractor: 无法处理视频', e);
                }
            }
        }

        async scanAudios() {
            const audios = document.querySelectorAll('audio');
            for (const audio of audios) {
                try {
                    // 获取音频源
                    const sources = [];

                    // 主src属性
                    if (audio.src) {
                        sources.push({
                            url: audio.src,
                            type: audio.type || '',
                            quality: 'default'
                        });
                    }

                    // source子元素
                    const sourceElements = audio.querySelectorAll('source');
                    sourceElements.forEach(source => {
                        if (source.src) {
                            sources.push({
                                url: source.src,
                                type: source.type || '',
                                quality: source.getAttribute('label') || 'unknown'
                            });
                        }
                    });

                    if (sources.length === 0) continue;

                    const mainSource = sources[0];

                    if (this.processedUrls.has(mainSource.url)) continue;
                    this.processedUrls.add(mainSource.url);

                    this.results.push({
                        id: generateId(),
                        type: 'video', // 音频也归类为video类型
                        category: 'audio',
                        name: audio.title || this.extractFilename(mainSource.url) || `audio-${this.results.length + 1}`,
                        url: mainSource.url,
                        format: getExtensionFromUrl(mainSource.url) || 'mp3',
                        size: 0,
                        duration: audio.duration || 0,
                        dimensions: {
                            width: 'N/A',
                            height: 'N/A'
                        },
                        sources: sources,
                        element: audio
                    });
                } catch (e) {
                    console.warn('Resource Extractor: 无法处理音频', e);
                }
            }
        }

        async scanObjectEmbeds() {
            const objects = document.querySelectorAll('object, embed');
            for (const obj of objects) {
                try {
                    const url = obj.data || obj.src;
                    if (!url || this.processedUrls.has(url)) continue;

                    this.processedUrls.add(url);
                    const resourceType = getResourceType(url, obj.type);

                    if (resourceType === 'svg') {
                        const content = await this.fetchResource(url);
                        if (content) {
                            const bbox = obj.getBoundingClientRect();
                            this.results.push({
                                id: generateId(),
                                type: 'svg',
                                category: 'external',
                                name: this.extractFilename(url) || `object-svg-${this.results.length + 1}`,
                                content: content,
                                url: url,
                                size: new Blob([content]).size,
                                dimensions: {
                                    width: Math.round(bbox.width),
                                    height: Math.round(bbox.height)
                                }
                            });
                        }
                    } else if (resourceType === 'video') {
                        const bbox = obj.getBoundingClientRect();
                        this.results.push({
                            id: generateId(),
                            type: 'video',
                            category: 'embed',
                            name: this.extractFilename(url) || `embed-video-${this.results.length + 1}`,
                            url: url,
                            format: getExtensionFromUrl(url) || 'unknown',
                            size: 0,
                            duration: 0,
                            dimensions: {
                                width: Math.round(bbox.width),
                                height: Math.round(bbox.height)
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Resource Extractor: 无法获取 object/embed 资源', e);
                }
            }
        }

        async scanCSSBackgrounds() {
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                try {
                    const style = getComputedStyle(el);
                    const bgImage = style.backgroundImage;

                    if (bgImage && bgImage !== 'none') {
                        const urlMatches = bgImage.matchAll(/url\(['"]?(.+?)['"]?\)/gi);

                        for (const match of urlMatches) {
                            const url = match[1];
                            if (this.processedUrls.has(url)) continue;

                            this.processedUrls.add(url);
                            const resourceType = getResourceType(url, '');

                            if (resourceType === 'svg' || resourceType === 'image' || url.startsWith('data:image')) {
                                let content = '';
                                let actualType = resourceType;

                                if (url.startsWith('data:image')) {
                                    const mimeMatch = url.match(/data:image\/([^;]+)/);
                                    if (mimeMatch) {
                                        actualType = mimeMatch[1].includes('svg') ? 'svg' : 'image';
                                    }

                                    if (actualType === 'svg' && url.includes('base64')) {
                                        try {
                                            const base64 = url.split(',')[1];
                                            content = decodeURIComponent(atob(base64));
                                        } catch (e) {
                                            console.warn('Resource Extractor: 无法解码base64 SVG', e);
                                        }
                                    }
                                } else if (resourceType === 'svg') {
                                    content = await this.fetchResource(url);
                                }

                                if (actualType === 'svg' && content) {
                                    this.results.push({
                                        id: generateId(),
                                        type: 'svg',
                                        category: 'css',
                                        name: this.extractFilename(url) || `css-svg-${this.results.length + 1}`,
                                        content: content,
                                        url: url,
                                        size: new Blob([content]).size,
                                        dimensions: {
                                            width: 'unknown',
                                            height: 'unknown'
                                        }
                                    });
                                } else if (actualType === 'image' || (resourceType === 'image' && !content)) {
                                    this.results.push({
                                        id: generateId(),
                                        type: 'image',
                                        category: 'css',
                                        name: this.extractFilename(url) || `css-image-${this.results.length + 1}`,
                                        url: url,
                                        format: getExtensionFromUrl(url) || 'unknown',
                                        size: 0,
                                        dimensions: {
                                            width: 'unknown',
                                            height: 'unknown'
                                        }
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    // 忽略无法访问的元素
                }
            }
        }

        async scanPictureSources() {
            const sources = document.querySelectorAll('picture source');
            for (const source of sources) {
                try {
                    const srcset = source.srcset;
                    if (!srcset) continue;

                    // 解析 srcset
                    const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);

                    for (const url of urls) {
                        if (this.processedUrls.has(url)) continue;

                        this.processedUrls.add(url);
                        const resourceType = getResourceType(url, source.type);

                        if (resourceType === 'image') {
                            this.results.push({
                                id: generateId(),
                                type: 'image',
                                category: 'picture',
                                name: this.extractFilename(url) || `picture-${this.results.length + 1}`,
                                url: url,
                                format: getExtensionFromUrl(url) || 'unknown',
                                size: 0,
                                dimensions: {
                                    width: 'unknown',
                                    height: 'unknown'
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.warn('Resource Extractor: 无法处理 picture source', e);
                }
            }
        }

        async fetchResource(url) {
            try {
                const response = await fetch(url, {
                    mode: 'cors',
                    credentials: 'omit',
                    cache: 'no-cache'
                });
                if (response.ok) {
                    return await response.text();
                }
            } catch (e) {
                // 尝试不使用 CORS
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        return await response.text();
                    }
                } catch (e2) {
                    console.warn('Resource Extractor: 无法跨域获取', url);
                }
            }
            return '';
        }

        extractFilename(url) {
            if (!url || url.startsWith('data:')) return null;
            try {
                const pathname = new URL(url, location.href).pathname;
                const filename = pathname.split('/').pop().split('?')[0]; // 移除查询参数
                return filename.split('.')[0] || null;
            } catch {
                return null;
            }
        }

        estimateImageSize(img) {
            // 粗略估算图片大小
            const pixels = (img.naturalWidth || 0) * (img.naturalHeight || 0);
            return pixels * 3; // 假设每像素3字节（RGB）
        }
    }

    // ============ UI 管理 ============
    class UIManager {
        constructor() {
            this.panel = null;
            this.overlay = null;
            this.scanner = new ResourceScanner();
        }

        init() {
            this.injectStyles();
            this.registerMenu();
            this.bindKeyboardShortcut();
        }

        injectStyles() {
            const style = document.createElement('style');
            style.id = `${CONFIG.prefix}-styles`;
            style.textContent = `
                /* 遮罩层 */
                .${CONFIG.prefix}-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(8px);
                    z-index: 2147483646;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }

                .${CONFIG.prefix}-overlay.visible {
                    opacity: 1;
                    visibility: visible;
                }

                /* 主面板 */
                .${CONFIG.prefix}-panel {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) scale(0.9);
                    width: min(95vw, 1000px);
                    max-height: 85vh;
                    background: ${CONFIG.colors.bg};
                    border-radius: 20px;
                    border: 1px solid ${CONFIG.colors.border};
                    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
                    z-index: 2147483647;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .${CONFIG.prefix}-panel.visible {
                    opacity: 1;
                    visibility: visible;
                    transform: translate(-50%, -50%) scale(1);
                }

                /* 面板头部 */
                .${CONFIG.prefix}-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid ${CONFIG.colors.border};
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: linear-gradient(180deg, rgba(0, 212, 170, 0.05), transparent);
                }

                .${CONFIG.prefix}-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: ${CONFIG.colors.text};
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .${CONFIG.prefix}-title svg {
                    width: 24px;
                    height: 24px;
                    fill: ${CONFIG.colors.accent};
                }

                .${CONFIG.prefix}-count {
                    background: ${CONFIG.colors.accent};
                    color: ${CONFIG.colors.bg};
                    padding: 2px 10px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: 600;
                }

                .${CONFIG.prefix}-close {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: none;
                    background: ${CONFIG.colors.card};
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .${CONFIG.prefix}-close:hover {
                    background: ${CONFIG.colors.danger};
                }

                .${CONFIG.prefix}-close svg {
                    width: 18px;
                    height: 18px;
                    fill: ${CONFIG.colors.textMuted};
                    transition: fill 0.2s ease;
                }

                .${CONFIG.prefix}-close:hover svg {
                    fill: white;
                }

                /* 工具栏 */
                .${CONFIG.prefix}-toolbar {
                    padding: 16px 24px;
                    border-bottom: 1px solid ${CONFIG.colors.border};
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                    align-items: center;
                }

                .${CONFIG.prefix}-filter-group {
                    display: flex;
                    gap: 8px;
                    margin-right: auto;
                }

                .${CONFIG.prefix}-filter-btn {
                    padding: 8px 16px;
                    border-radius: 20px;
                    border: 1px solid ${CONFIG.colors.border};
                    background: transparent;
                    color: ${CONFIG.colors.textMuted};
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .${CONFIG.prefix}-filter-btn:hover {
                    border-color: ${CONFIG.colors.accent};
                    color: ${CONFIG.colors.accent};
                }

                .${CONFIG.prefix}-filter-btn.active {
                    background: ${CONFIG.colors.accent};
                    color: ${CONFIG.colors.bg};
                    border-color: ${CONFIG.colors.accent};
                }

                .${CONFIG.prefix}-btn {
                    padding: 10px 20px;
                    border-radius: 10px;
                    border: none;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .${CONFIG.prefix}-btn svg {
                    width: 16px;
                    height: 16px;
                    fill: currentColor;
                }

                .${CONFIG.prefix}-btn-primary {
                    background: ${CONFIG.colors.accent};
                    color: ${CONFIG.colors.bg};
                }

                .${CONFIG.prefix}-btn-primary:hover {
                    background: ${CONFIG.colors.accentHover};
                    transform: translateY(-2px);
                }

                .${CONFIG.prefix}-btn-secondary {
                    background: ${CONFIG.colors.card};
                    color: ${CONFIG.colors.text};
                    border: 1px solid ${CONFIG.colors.border};
                }

                .${CONFIG.prefix}-btn-secondary:hover {
                    border-color: ${CONFIG.colors.accent};
                    color: ${CONFIG.colors.accent};
                }

                .${CONFIG.prefix}-btn-danger {
                    background: transparent;
                    color: ${CONFIG.colors.danger};
                    border: 1px solid ${CONFIG.colors.danger};
                }

                .${CONFIG.prefix}-btn-danger:hover {
                    background: ${CONFIG.colors.danger};
                    color: white;
                }

                .${CONFIG.prefix}-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                /* 资源列表 */
                .${CONFIG.prefix}-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                }

                .${CONFIG.prefix}-content::-webkit-scrollbar {
                    width: 8px;
                }

                .${CONFIG.prefix}-content::-webkit-scrollbar-track {
                    background: ${CONFIG.colors.card};
                }

                .${CONFIG.prefix}-content::-webkit-scrollbar-thumb {
                    background: ${CONFIG.colors.border};
                    border-radius: 4px;
                }

                .${CONFIG.prefix}-content::-webkit-scrollbar-thumb:hover {
                    background: ${CONFIG.colors.accent};
                }

                /* 资源卡片 */
                .${CONFIG.prefix}-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 16px;
                }

                .${CONFIG.prefix}-card {
                    background: ${CONFIG.colors.card};
                    border-radius: 14px;
                    border: 2px solid ${CONFIG.colors.border};
                    overflow: hidden;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    opacity: 0;
                    transform: translateY(20px);
                    animation: cardIn 0.4s ease forwards;
                }

                .${CONFIG.prefix}-card:nth-child(1) { animation-delay: 0.05s; }
                .${CONFIG.prefix}-card:nth-child(2) { animation-delay: 0.1s; }
                .${CONFIG.prefix}-card:nth-child(3) { animation-delay: 0.15s; }
                .${CONFIG.prefix}-card:nth-child(4) { animation-delay: 0.2s; }
                .${CONFIG.prefix}-card:nth-child(5) { animation-delay: 0.25s; }
                .${CONFIG.prefix}-card:nth-child(6) { animation-delay: 0.3s; }
                .${CONFIG.prefix}-card:nth-child(7) { animation-delay: 0.35s; }
                .${CONFIG.prefix}-card:nth-child(8) { animation-delay: 0.4s; }

                @keyframes cardIn {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .${CONFIG.prefix}-card:hover {
                    border-color: ${CONFIG.colors.accent};
                    transform: translateY(-4px);
                    box-shadow: 0 10px 30px rgba(0, 212, 170, 0.15);
                }

                .${CONFIG.prefix}-card.selected {
                    border-color: ${CONFIG.colors.accent};
                    background: rgba(0, 212, 170, 0.1);
                }

                .${CONFIG.prefix}-card-preview {
                    height: 160px;
                    background: repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%) 50% / 16px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }

                .${CONFIG.prefix}-card-preview svg {
                    max-width: 80%;
                    max-height: 80%;
                }

                .${CONFIG.prefix}-card-preview img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }

                .${CONFIG.prefix}-card-preview video {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: cover;
                }

                .${CONFIG.prefix}-card-video-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 60px;
                    height: 60px;
                    background: rgba(0, 0, 0, 0.7);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                }

                .${CONFIG.prefix}-card-audio-icon {
                    font-size: 48px;
                    color: ${CONFIG.colors.tertiary};
                }

                .${CONFIG.prefix}-card-checkbox {
                    position: absolute;
                    top: 8px;
                    left: 8px;
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    border: 2px solid rgba(255, 255, 255, 0.5);
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .${CONFIG.prefix}-card.selected .${CONFIG.prefix}-card-checkbox {
                    border-color: ${CONFIG.colors.accent};
                    background: ${CONFIG.colors.accent};
                }

                .${CONFIG.prefix}-card-checkbox svg {
                    width: 14px;
                    height: 14px;
                    fill: transparent;
                    transition: fill 0.2s ease;
                }

                .${CONFIG.prefix}-card.selected .${CONFIG.prefix}-card-checkbox svg {
                    fill: ${CONFIG.colors.bg};
                }

                .${CONFIG.prefix}-card-type {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    background: rgba(0, 0, 0, 0.7);
                    color: ${CONFIG.colors.accent};
                }

                .${CONFIG.prefix}-card-type.image {
                    color: ${CONFIG.colors.secondary};
                }

                .${CONFIG.prefix}-card-type.video {
                    color: ${CONFIG.colors.tertiary};
                }

                .${CONFIG.prefix}-card-info {
                    padding: 12px;
                }

                .${CONFIG.prefix}-card-name {
                    font-size: 13px;
                    font-weight: 600;
                    color: ${CONFIG.colors.text};
                    margin-bottom: 6px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .${CONFIG.prefix}-card-meta {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: ${CONFIG.colors.textMuted};
                    margin-bottom: 4px;
                }

                .${CONFIG.prefix}-card-duration {
                    font-size: 11px;
                    color: ${CONFIG.colors.tertiary};
                    font-weight: 600;
                }

                .${CONFIG.prefix}-card-format {
                    text-transform: uppercase;
                    font-weight: 600;
                    color: ${CONFIG.colors.secondary};
                }

                .${CONFIG.prefix}-card-actions {
                    display: flex;
                    gap: 6px;
                    padding: 0 12px 12px;
                }

                .${CONFIG.prefix}-card-actions .${CONFIG.prefix}-btn {
                    flex: 1;
                    padding: 8px;
                    font-size: 12px;
                    justify-content: center;
                }

                .${CONFIG.prefix}-card-urls {
                    padding: 0 12px 6px;
                    font-size: 10px;
                    color: ${CONFIG.colors.textMuted};
                    max-height: 40px;
                    overflow-y: auto;
                }

                .${CONFIG.prefix}-card-url {
                    word-break: break-all;
                    margin-bottom: 2px;
                    padding: 2px 4px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 2px;
                }

                /* 空状态 */
                .${CONFIG.prefix}-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: ${CONFIG.colors.textMuted};
                }

                .${CONFIG.prefix}-empty svg {
                    width: 80px;
                    height: 80px;
                    fill: ${CONFIG.colors.border};
                    margin-bottom: 20px;
                }

                .${CONFIG.prefix}-empty h3 {
                    font-size: 18px;
                    color: ${CONFIG.colors.text};
                    margin-bottom: 8px;
                }

                .${CONFIG.prefix}-empty p {
                    font-size: 14px;
                }

                /* 加载状态 */
                .${CONFIG.prefix}-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 20px;
                    color: ${CONFIG.colors.textMuted};
                }

                .${CONFIG.prefix}-spinner {
                    width: 50px;
                    height: 50px;
                    border: 3px solid ${CONFIG.colors.border};
                    border-top-color: ${CONFIG.colors.accent};
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 20px;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Toast 通知 */
                .${CONFIG.prefix}-toast {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    background: ${CONFIG.colors.card};
                    border: 1px solid ${CONFIG.colors.accent};
                    padding: 12px 20px;
                    border-radius: 10px;
                    color: ${CONFIG.colors.text};
                    font-size: 14px;
                    z-index: 2147483647;
                    opacity: 0;
                    transform: translateY(20px);
                    transition: all 0.3s ease;
                    font-family: inherit;
                    max-width: 400px;
                }

                .${CONFIG.prefix}-toast.visible {
                    opacity: 1;
                    transform: translateY(0);
                }

                /* 统计信息 */
                .${CONFIG.prefix}-stats {
                    display: flex;
                    gap: 16px;
                    margin-left: auto;
                    font-size: 12px;
                    color: ${CONFIG.colors.textMuted};
                }

                .${CONFIG.prefix}-stat {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .${CONFIG.prefix}-stat-value {
                    font-weight: 600;
                    color: ${CONFIG.colors.text};
                }
            `;
            document.head.appendChild(style);
        }

        bindKeyboardShortcut() {
            // 绑定 Alt + S 快捷键
            document.addEventListener('keydown', (e) => {
                if (e.altKey && (e.key === 's' || e.key === 'S')) {
                    e.preventDefault();
                    this.togglePanel();
                }

                // ESC 关闭面板
                if (e.key === 'Escape' && state.isPanelOpen) {
                    this.closePanel();
                }
            });
        }

        createPanel() {
            // 遮罩层
            this.overlay = document.createElement('div');
            this.overlay.className = `${CONFIG.prefix}-overlay`;
            this.overlay.addEventListener('click', () => this.closePanel());

            // 主面板
            this.panel = document.createElement('div');
            this.panel.className = `${CONFIG.prefix}-panel`;
            this.panel.innerHTML = `
                <div class="${CONFIG.prefix}-header">
                    <div class="${CONFIG.prefix}-title">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        <span>媒体资源提取器</span>
                        <span class="${CONFIG.prefix}-count">0</span>
                    </div>
                    <button class="${CONFIG.prefix}-close" title="关闭 (ESC)">
                        <svg viewBox="0 0 24 24">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                <div class="${CONFIG.prefix}-toolbar">
                    <div class="${CONFIG.prefix}-filter-group">
                        <button class="${CONFIG.prefix}-filter-btn active" data-filter="all">全部</button>
                        <button class="${CONFIG.prefix}-filter-btn" data-filter="svg">SVG</button>
                        <button class="${CONFIG.prefix}-filter-btn" data-filter="image">图片</button>
                        <button class="${CONFIG.prefix}-filter-btn" data-filter="video">视频</button>
                    </div>
                    <button class="${CONFIG.prefix}-btn ${CONFIG.prefix}-btn-primary" data-action="scan">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                        </svg>
                        扫描页面
                    </button>
                    <button class="${CONFIG.prefix}-btn ${CONFIG.prefix}-btn-secondary" data-action="select-all">
                        <svg viewBox="0 0 24 24">
                            <path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2zM7 17h10V7H7v10zm2-8h6v6H9V9z"/>
                        </svg>
                        全选
                    </button>
                    <button class="${CONFIG.prefix}-btn ${CONFIG.prefix}-btn-danger" data-action="download-selected" disabled>
                        <svg viewBox="0 0 24 24">
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                        </svg>
                        下载选中
                    </button>
                    <div class="${CONFIG.prefix}-stats">
                        <div class="${CONFIG.prefix}-stat">
                            <span>已选择</span>
                            <span class="${CONFIG.prefix}-stat-value" data-stat="selected">0</span>
                        </div>
                        <div class="${CONFIG.prefix}-stat">
                            <span>SVG</span>
                            <span class="${CONFIG.prefix}-stat-value" data-stat="svg">0</span>
                        </div>
                        <div class="${CONFIG.prefix}-stat">
                            <span>图片</span>
                            <span class="${CONFIG.prefix}-stat-value" data-stat="image">0</span>
                        </div>
                        <div class="${CONFIG.prefix}-stat">
                            <span>视频</span>
                            <span class="${CONFIG.prefix}-stat-value" data-stat="video">0</span>
                        </div>
                    </div>
                </div>
                <div class="${CONFIG.prefix}-content">
                    <div class="${CONFIG.prefix}-empty">
                        <svg viewBox="0 0 24 24">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z"/>
                        </svg>
                        <h3>准备就绪</h3>
                        <p>点击「扫描页面」按钮开始检测媒体资源</p>
                    </div>
                </div>
            `;

            // 绑定事件
            this.panel.querySelector(`.${CONFIG.prefix}-close`).addEventListener('click', () => this.closePanel());
            this.panel.querySelector('[data-action="scan"]').addEventListener('click', () => this.scanPage());
            this.panel.querySelector('[data-action="select-all"]').addEventListener('click', () => this.toggleSelectAll());
            this.panel.querySelector('[data-action="download-selected"]').addEventListener('click', () => this.downloadSelected());

            // 过滤器按钮事件
            this.panel.querySelectorAll(`.${CONFIG.prefix}-filter-btn`).forEach(btn => {
                btn.addEventListener('click', () => this.setFilter(btn.dataset.filter));
            });

            document.body.appendChild(this.overlay);
            document.body.appendChild(this.panel);
        }

        setFilter(filter) {
            state.filterType = filter;

            // 更新按钮状态
            this.panel.querySelectorAll(`.${CONFIG.prefix}-filter-btn`).forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === filter);
            });

            // 重新渲染结果
            this.renderResults();
        }

        togglePanel() {
            if (!state.isPanelOpen) {
                this.openPanel();
            } else {
                this.closePanel();
            }
        }

        openPanel() {
            if (!this.panel) {
                this.createPanel();
            }
            state.isPanelOpen = true;
            this.overlay.classList.add('visible');
            this.panel.classList.add('visible');
        }

        closePanel() {
            state.isPanelOpen = false;
            if (this.overlay) this.overlay.classList.remove('visible');
            if (this.panel) this.panel.classList.remove('visible');
        }

        async scanPage() {
            if (state.isScanning) return;

            state.isScanning = true;
            state.selectedIds.clear();
            this.updateUI();

            // 显示加载状态
            const content = this.panel.querySelector(`.${CONFIG.prefix}-content`);
            content.innerHTML = `
                <div class="${CONFIG.prefix}-loading">
                    <div class="${CONFIG.prefix}-spinner"></div>
                    <p>正在扫描页面中的媒体资源...</p>
                </div>
            `;

            // 执行扫描
            state.resources = await this.scanner.scan();
            state.isScanning = false;

            // 更新统计
            this.updateStats();

            // 渲染结果
            this.renderResults();
        }

        renderResults() {
            const content = this.panel.querySelector(`.${CONFIG.prefix}-content`);

            // 过滤资源
            let filtered = state.resources;
            if (state.filterType !== 'all') {
                filtered = state.resources.filter(r => r.type === state.filterType);
            }

            if (filtered.length === 0) {
                const typeNames = {
                    svg: 'SVG',
                    image: '图片',
                    video: '视频'
                };
                const emptyMsg = state.resources.length === 0
                    ? '当前页面没有检测到媒体资源'
                    : `没有找到${typeNames[state.filterType] || ''}资源`;

                content.innerHTML = `
                    <div class="${CONFIG.prefix}-empty">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        <h3>未找到资源</h3>
                        <p>${emptyMsg}</p>
                    </div>
                `;
                return;
            }

            const grid = document.createElement('div');
            grid.className = `${CONFIG.prefix}-grid`;

            filtered.forEach((resource) => {
                const card = this.createResourceCard(resource);
                grid.appendChild(card);
            });

            content.innerHTML = '';
            content.appendChild(grid);
        }

        createResourceCard(resource) {
            const card = document.createElement('div');
            card.className = `${CONFIG.prefix}-card`;
            card.dataset.id = resource.id;

            // 创建预览
            const preview = document.createElement('div');
            preview.className = `${CONFIG.prefix}-card-preview`;

            // 复选框
            const checkbox = document.createElement('div');
            checkbox.className = `${CONFIG.prefix}-card-checkbox`;
            checkbox.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
            preview.appendChild(checkbox);

            // 类型标签
            const typeLabel = document.createElement('span');
            typeLabel.className = `${CONFIG.prefix}-card-type ${resource.type}`;
            typeLabel.textContent = resource.type === 'video' && resource.category === 'audio' ? 'audio' : resource.type;
            preview.appendChild(typeLabel);

            // 预览内容
            if (resource.type === 'svg') {
                if (resource.category === 'inline') {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = resource.content;
                    const svgEl = tempDiv.querySelector('svg');
                    if (svgEl) {
                        svgEl.removeAttribute('width');
                        svgEl.removeAttribute('height');
                        svgEl.style.maxWidth = '100%';
                        svgEl.style.maxHeight = '100%';
                        preview.appendChild(svgEl.cloneNode(true));
                    }
                } else {
                    const imgContainer = createImageWithFallback(
                        resource.url || `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(resource.content)))}`,
                        resource.name,
                        'SVG'
                    );
                    preview.appendChild(imgContainer);
                }
            } else if (resource.type === 'image') {
                const imgContainer = createImageWithFallback(resource.url, resource.name, '图片加载失败');
                preview.appendChild(imgContainer);
            } else if (resource.type === 'video') {
                if (resource.category === 'audio') {
                    // 音频文件显示音符图标
                    const audioIcon = document.createElement('div');
                    audioIcon.className = `${CONFIG.prefix}-card-audio-icon`;
                    audioIcon.innerHTML = '♪';
                    preview.appendChild(audioIcon);
                } else {
                    // 视频文件
                    if (resource.poster) {
                        const imgContainer = createImageWithFallback(resource.poster, resource.name, '视频海报');
                        preview.appendChild(imgContainer);
                    } else if (resource.element && resource.element.videoWidth > 0) {
                        // 尝试显示视频第一帧
                        const video = document.createElement('video');
                        video.src = resource.url;
                        video.muted = true;
                        video.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: cover;';
                        preview.appendChild(video);
                    } else {
                        // 显示视频播放图标
                        const videoIcon = document.createElement('div');
                        videoIcon.className = `${CONFIG.prefix}-card-video-overlay`;
                        videoIcon.innerHTML = '▶';
                        preview.appendChild(videoIcon);
                    }
                }
            }

            card.appendChild(preview);

            // 信息区域
            const info = document.createElement('div');
            info.className = `${CONFIG.prefix}-card-info`;

            let metaHTML = '';
            if (resource.type === 'svg') {
                metaHTML = `
                    <div class="${CONFIG.prefix}-card-meta">
                        <span>${resource.dimensions.width} × ${resource.dimensions.height}</span>
                        <span>${formatFileSize(resource.size)}</span>
                    </div>
                `;
            } else if (resource.type === 'image') {
                metaHTML = `
                    <div class="${CONFIG.prefix}-card-meta">
                        <span class="${CONFIG.prefix}-card-format">${resource.format}</span>
                        <span>${resource.dimensions.width} × ${resource.dimensions.height}</span>
                    </div>
                `;
            } else if (resource.type === 'video') {
                metaHTML = `
                    <div class="${CONFIG.prefix}-card-meta">
                        <span class="${CONFIG.prefix}-card-format">${resource.format}</span>
                        <span>${resource.dimensions.width} × ${resource.dimensions.height}</span>
                    </div>
                    ${resource.duration ? `<div class="${CONFIG.prefix}-card-duration">时长: ${formatDuration(resource.duration)}</div>` : ''}
                `;
            }

            info.innerHTML = `
                <div class="${CONFIG.prefix}-card-name" title="${resource.name}">${resource.name}</div>
                ${metaHTML}
            `;
            card.appendChild(info);

            // 显示所有找到的URL（调试用）
            if (resource.originalUrls && resource.originalUrls.length > 1) {
                const urlsDiv = document.createElement('div');
                urlsDiv.className = `${CONFIG.prefix}-card-urls`;
                urlsDiv.innerHTML = `找到 ${resource.originalUrls.length} 个地址:<br>` +
                    resource.originalUrls.map(url => `<div class="${CONFIG.prefix}-card-url">${url}</div>`).join('');
                card.appendChild(urlsDiv);
            }

            // 操作按钮
            const actions = document.createElement('div');
            actions.className = `${CONFIG.prefix}-card-actions`;
            actions.innerHTML = `
                <button class="${CONFIG.prefix}-btn ${CONFIG.prefix}-btn-secondary" data-action="preview">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    预览
                </button>
                <button class="${CONFIG.prefix}-btn ${CONFIG.prefix}-btn-primary" data-action="download">
                    <svg viewBox="0 0 24 24">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                    下载
                </button>
            `;
            card.appendChild(actions);

            // 绑定事件
            card.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]')) return;
                this.toggleSelect(resource.id);
            });

            card.querySelector('[data-action="preview"]').addEventListener('click', () => this.previewResource(resource));
            card.querySelector('[data-action="download"]').addEventListener('click', () => this.downloadResource(resource));

            return card;
        }

        toggleSelect(id) {
            if (state.selectedIds.has(id)) {
                state.selectedIds.delete(id);
            } else {
                state.selectedIds.add(id);
            }
            this.updateCardSelection(id);
            this.updateUI();
        }

        updateCardSelection(id) {
            const card = this.panel.querySelector(`[data-id="${id}"]`);
            if (card) {
                card.classList.toggle('selected', state.selectedIds.has(id));
            }
        }

        toggleSelectAll() {
            // 获取当前过滤的资源
            let filtered = state.resources;
            if (state.filterType !== 'all') {
                filtered = state.resources.filter(r => r.type === state.filterType);
            }

            const filteredIds = filtered.map(r => r.id);
            const allSelected = filteredIds.every(id => state.selectedIds.has(id));

            if (allSelected) {
                // 取消选择当前过滤的资源
                filteredIds.forEach(id => state.selectedIds.delete(id));
            } else {
                // 选择当前过滤的资源
                filteredIds.forEach(id => state.selectedIds.add(id));
            }

            // 更新所有卡片
            filtered.forEach(resource => this.updateCardSelection(resource.id));
            this.updateUI();
        }

        updateUI() {
            const btn = this.panel.querySelector('[data-action="download-selected"]');
            const selectedCount = state.selectedIds.size;
            btn.disabled = selectedCount === 0;

            this.updateStats();
        }

        updateStats() {
            const svgCount = state.resources.filter(r => r.type === 'svg').length;
            const imageCount = state.resources.filter(r => r.type === 'image').length;
            const videoCount = state.resources.filter(r => r.type === 'video').length;

            this.panel.querySelector('[data-stat="selected"]').textContent = state.selectedIds.size;
            this.panel.querySelector('[data-stat="svg"]').textContent = svgCount;
            this.panel.querySelector('[data-stat="image"]').textContent = imageCount;
            this.panel.querySelector('[data-stat="video"]').textContent = videoCount;
            this.panel.querySelector(`.${CONFIG.prefix}-count`).textContent = state.resources.length;
        }

        previewResource(resource) {
            const win = window.open('', '_blank', 'width=900,height=700');

            if (resource.type === 'svg') {
                win.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${resource.name} - SVG 预览</title>
                        <style>
                            body {
                                margin: 0;
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                background: repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 50% / 20px 20px;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            }
                            svg {
                                max-width: 90%;
                                max-height: 90vh;
                            }
                        </style>
                    </head>
                    <body>${resource.content}</body>
                    </html>
                `);
            } else if (resource.type === 'image') {
                win.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${resource.name} - 图片预览</title>
                        <style>
                            body {
                                margin: 0;
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                background: #1a1a1a;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            }
                            img {
                                max-width: 90%;
                                max-height: 90vh;
                                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                            }
                        </style>
                    </head>
                    <body><img src="${resource.url}" alt="${resource.name}"></body>
                    </html>
                `);
            } else if (resource.type === 'video') {
                const isAudio = resource.category === 'audio';
                win.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${resource.name} - ${isAudio ? '音频' : '视频'}预览</title>
                        <style>
                            body {
                                margin: 0;
                                min-height: 100vh;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                background: #1a1a1a;
                                color: white;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            }
                            ${isAudio ? 'audio' : 'video'} {
                                max-width: 90%;
                                max-height: 80vh;
                                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                            }
                            .info {
                                margin-top: 20px;
                                text-align: center;
                                color: #ccc;
                            }
                        </style>
                    </head>
                    <body>
                        <${isAudio ? 'audio' : 'video'} src="${resource.url}" controls ${resource.poster && !isAudio ? `poster="${resource.poster}"` : ''}></${isAudio ? 'audio' : 'video'}>
                        <div class="info">
                            <h3>${resource.name}</h3>
                            <p>格式: ${resource.format.toUpperCase()}</p>
                            ${resource.duration ? `<p>时长: ${formatDuration(resource.duration)}</p>` : ''}
                        </div>
                    </body>
                    </html>
                `);
            }
            win.document.close();
        }

        async downloadResource(resource) {
            if (resource.type === 'svg') {
                const blob = new Blob([resource.content], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const filename = `${sanitizeFilename(resource.name)}.svg`;

                this.downloadFile(url, filename);
                URL.revokeObjectURL(url);

                this.showToast(`已下载: ${filename}`);
            } else {
                // 下载图片或视频
                const ext = resource.format || (resource.type === 'video' ? 'mp4' : 'jpg');
                const filename = `${sanitizeFilename(resource.name)}.${ext}`;

                if (resource.url.startsWith('data:')) {
                    // 处理 data URL
                    this.downloadFile(resource.url, filename);
                } else {
                    // 尝试获取最终的重定向地址
                    try {
                        const finalUrl = await getFinalImageUrl(resource.url);

                        // 尝试使用 fetch 下载
                        const response = await fetch(finalUrl, {
                            mode: 'cors',
                            credentials: 'include' // 包含cookies
                        });
                        if (response.ok) {
                            const blob = await response.blob();
                            const url = URL.createObjectURL(blob);
                            this.downloadFile(url, filename);
                            URL.revokeObjectURL(url);
                            this.showToast(`已下载: ${filename} (最终地址: ${finalUrl.substring(0, 50)}...)`);
                        } else {
                            // 如果 fetch 失败，使用简单的链接下载
                            this.downloadFile(resource.url, filename);
                            this.showToast(`已下载: ${filename} (使用原始地址)`);
                        }
                    } catch (e) {
                        // 如果 fetch 失败，使用简单的链接下载
                        this.downloadFile(resource.url, filename);
                        this.showToast(`已下载: ${filename} (Fallback模式)`);
                    }
                }
            }
        }

        downloadFile(url, filename) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        downloadSelected() {
            if (state.selectedIds.size === 0) return;

            const selectedResources = state.resources.filter(r => state.selectedIds.has(r.id));

            // 如果只有一个，直接下载
            if (selectedResources.length === 1) {
                this.downloadResource(selectedResources[0]);
                return;
            }

            // 多个文件批量下载
            let downloaded = 0;
            selectedResources.forEach((resource, index) => {
                setTimeout(() => {
                    this.downloadResource(resource);
                    downloaded++;
                    if (downloaded === selectedResources.length) {
                        this.showToast(`已完成 ${downloaded} 个文件下载`);
                    }
                }, index * 500); // 增加间隔时间避免浏览器阻止
            });
        }

        showToast(message) {
            let toast = document.querySelector(`.${CONFIG.prefix}-toast`);
            if (!toast) {
                toast = document.createElement('div');
                toast.className = `${CONFIG.prefix}-toast`;
                document.body.appendChild(toast);
            }

            toast.textContent = message;
            toast.classList.add('visible');

            setTimeout(() => {
                toast.classList.remove('visible');
            }, 4000);
        }

        registerMenu() {
            if (typeof GM_registerMenuCommand !== 'undefined') {
                GM_registerMenuCommand('🔍 扫描并下载媒体资源', () => {
                    this.openPanel();
                    this.scanPage();
                });
            }
        }
    }

    // ============ 初始化 ============
    const ui = new UIManager();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ui.init());
    } else {
        ui.init();
    }
})();
