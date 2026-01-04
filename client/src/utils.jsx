import React from 'react';

// Simple Markdown Formatter
export const formatMessage = (text, linkColor) => {
    if (!text) return text;
    // Bold
    let formatted = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    // Italic
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    // Strikethrough
    formatted = formatted.replace(/~(.*?)~/g, '<del>$1</del>');
    // Monospace
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
    // Links (http/https)
    const linkAttr = linkColor ? `class="msg-link" style="color:${linkColor}"` : `class="msg-link"`;
    formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, `<a ${linkAttr} href="$1" target="_blank" rel="noopener noreferrer">$1</a>`);
    // Links (www. without protocol)
    formatted = formatted.replace(/(^|\s)(www\.[\w.-]+\.[a-zA-Z]{2,}(?:[\/\w#?&=%+.-]*)?)/g, (m, pre, url) => {
        const safeUrl = `https://${url}`;
        return `${pre}<a ${linkAttr} href="${safeUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Bare domains (no protocol, no www)
    formatted = formatted.replace(/(^|\s)((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:[\/\w#?&=%+.-]*)?)/g, (m, pre, domain) => {
        // Avoid converting emails handled later
        if (/^[\w.+-]+@/.test(domain)) return m;
        const safeUrl = `https://${domain}`;
        return `${pre}<a ${linkAttr} href="${safeUrl}" target="_blank" rel="noopener noreferrer">${domain}</a>`;
    });
    // Emails
    formatted = formatted.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, `<a ${linkAttr} href="mailto:$1" rel="noopener noreferrer">$1</a>`);

    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
};

// Extract links from plain text (http/https, www.*, and bare domains)
export const extractLinks = (text) => {
    if (!text) return [];
    const urls = new Set();
    // http/https
    (text.match(/https?:\/\/[^\s]+/g) || []).forEach(u => urls.add(u));
    // www.
    (text.match(/(?:^|\s)(www\.[\w.-]+\.[a-zA-Z]{2,}(?:[\/\w#?&=%+.-]*)?)/g) || [])
        .forEach(m => {
            const u = m.trim();
            if (u) urls.add(`https://${u}`);
        });
    // bare domains
    (text.match(/(?:^|\s)((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:[\/\w#?&=%+.-]*)?)/g) || [])
        .forEach(m => {
            const u = m.trim();
            if (u && !/^[\w.+-]+@/.test(u)) urls.add(`https://${u}`);
        });
    return Array.from(urls);
};

// Deterministic pseudo-random color for name bubbles based on author
export const getNameBubbleColor = (author) => {
    if (!author) return 'var(--accent-primary)';
    let hash = 0;
    for (let i = 0; i < author.length; i++) {
        hash = author.charCodeAt(i) + ((hash << 5) - hash);
        hash |= 0; // keep 32-bit
    }
    const hue = Math.abs(hash) % 360; // 0-359
    const saturation = 70;
    const lightness = 45;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const getDateLabel = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

export const shouldShowDateSeparator = (currentMsg, previousMsg) => {
    if (!currentMsg) return false;
    if (!previousMsg) return true;
    const currentDate = new Date(currentMsg.timestamp || Date.now()).toDateString();
    const prevDate = new Date(previousMsg.timestamp || Date.now()).toDateString();
    return currentDate !== prevDate;
};

// Helper to highlight text in search results
export const highlightText = (text, query) => {
    if (!text) return '';
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map(part =>
        part.toLowerCase() === query.toLowerCase()
            ? `<span style="background-color: yellow; color: black;">${part}</span>`
            : part
    ).join('');
};

// Helper to split graphemes for typing animation
export const splitGraphemes = (str) => {
    if (!str) return [];
    return Array.from(str);
};
