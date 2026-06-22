const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const markedPath = require.resolve('marked', { paths: [path.dirname(require.resolve('hexo-renderer-marked'))] });
const { marked } = require(markedPath);

const appid = process.argv[2];
const appsecret = process.argv[3];
const filename = process.argv[4];
const shouldPublish = process.argv.includes('--publish');

if (!appid || !appsecret || !filename) {
    console.log('usage: node wechat_publish.js <appid> <appsecret> <post_path> [--publish]');
    process.exit(1);
}

const picmid = 'rM9vKgwYh7rfR-t1xSaBSMo1eWr6-MHBnkhBIxBBliLv3vP4Oq0jnYec0Hp4n1a7';
const wechatTheme = {
    ink: '#2f3437',
    muted: '#6d7477',
    accent: '#5c817a',
    accentSoft: '#dde8e3',
    border: '#e6ddd1',
    paper: '#fffdf9',
    panel: '#f6f0e6',
    codeBg: '#f3eee6',
    quoteBg: '#f7f3ec',
    tableStripe: '#fbf7f2',
};

const wechatStyles = {
    h1: `margin:32px 0 18px;font-size:26px;line-height:1.35;font-weight:700;letter-spacing:0.01em;color:${wechatTheme.ink};`,
    h2: `margin:30px 0 16px;padding-left:12px;border-left:4px solid ${wechatTheme.accent};font-size:22px;line-height:1.4;font-weight:700;color:${wechatTheme.ink};`,
    h3: `margin:26px 0 14px;font-size:19px;line-height:1.45;font-weight:700;color:${wechatTheme.ink};`,
    h4: `margin:22px 0 12px;font-size:17px;line-height:1.5;font-weight:700;color:${wechatTheme.ink};`,
    p: `margin:0 0 16px;font-size:16px;line-height:1.9;letter-spacing:0.01em;color:${wechatTheme.ink};`,
    ul: `margin:0 0 18px;padding-left:1.35em;font-size:16px;line-height:1.9;color:${wechatTheme.ink};`,
    ol: `margin:0 0 18px;padding-left:1.45em;font-size:16px;line-height:1.9;color:${wechatTheme.ink};`,
    li: `margin:0 0 10px;color:${wechatTheme.ink};`,
    blockquote: `margin:22px 0;padding:14px 18px;border-left:4px solid ${wechatTheme.accent};border-radius:0 12px 12px 0;background:${wechatTheme.quoteBg};color:${wechatTheme.muted};`,
    code: `padding:2px 6px;border-radius:6px;background:${wechatTheme.codeBg};font-size:14px;font-family:Menlo,Consolas,monospace;color:${wechatTheme.accent};`,
    pre: `margin:22px 0;padding:16px 18px;border:1px solid ${wechatTheme.border};border-radius:14px;background:${wechatTheme.codeBg};overflow-x:auto;font-size:13px;line-height:1.75;color:${wechatTheme.ink};`,
    a: `color:${wechatTheme.accent};text-decoration:underline;text-decoration-color:${wechatTheme.accentSoft};text-underline-offset:3px;word-break:break-word;`,
    strong: `font-weight:700;color:${wechatTheme.ink};`,
    em: `font-style:italic;color:${wechatTheme.ink};`,
    hr: `margin:28px auto;border:none;height:1px;background:linear-gradient(90deg, rgba(92,129,122,0), rgba(92,129,122,0.45), rgba(92,129,122,0));`,
    img: `display:block;max-width:100%;height:auto;margin:24px auto;border-radius:14px;`,
    table: `width:100%;border-collapse:collapse;font-size:14px;line-height:1.7;color:${wechatTheme.ink};`,
    th: `padding:10px 12px;border:1px solid ${wechatTheme.border};background:${wechatTheme.accentSoft};font-weight:700;text-align:left;`,
    td: `padding:10px 12px;border:1px solid ${wechatTheme.border};background:${wechatTheme.paper};vertical-align:top;`,
};

const wechatDraftsUrl = 'https://mp.weixin.qq.com/cgi-bin/appmsg?begin=0&count=10&type=77&action=list_card&lang=zh_CN';

const renderer = new marked.Renderer();

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeAttr(str) {
    return str ? escapeHtml(str) : '';
}

function wrapWechatArticle(html) {
    return `
<section style="margin:0;padding:26px 18px;background-color:${wechatTheme.panel};background-image:linear-gradient(180deg, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0) 100%),radial-gradient(circle at 1px 1px, rgba(92,129,122,0.10) 1px, transparent 0);background-size:auto,18px 18px;border-radius:22px;">
  <section style="padding:26px 22px;background:${wechatTheme.paper};border:1px solid ${wechatTheme.border};border-radius:18px;box-shadow:0 10px 30px rgba(126,110,84,0.08);">
    ${html}
  </section>
</section>`.trim();
}

function openWechatDraftsPage() {
    const openers = {
        darwin: ['open', [wechatDraftsUrl]],
        win32: ['cmd', ['/c', 'start', '', wechatDraftsUrl]],
        linux: ['xdg-open', [wechatDraftsUrl]],
    };
    const [command, args] = openers[process.platform] || openers.darwin;

    try {
        const child = spawn(command, args, {
            detached: true,
            stdio: 'ignore',
        });
        child.unref();
        console.log('已尝试打开公众号草稿箱:', wechatDraftsUrl);
    } catch (error) {
        console.warn('自动打开草稿箱失败，请手动打开:', wechatDraftsUrl);
    }
}

renderer.heading = (text, level) => {
    if (level === 1) return `<h1 style="${wechatStyles.h1}">${text}</h1>`;
    if (level === 2) return `<h2 style="${wechatStyles.h2}">${text}</h2>`;
    if (level === 3) return `<h3 style="${wechatStyles.h3}">${text}</h3>`;
    return `<h4 style="${wechatStyles.h4}">${text}</h4>`;
};

renderer.paragraph = text => `<p style="${wechatStyles.p}">${text}</p>`;
renderer.list = (body, ordered) => `<${ordered ? 'ol' : 'ul'} style="${ordered ? wechatStyles.ol : wechatStyles.ul}">${body}</${ordered ? 'ol' : 'ul'}>`;
renderer.listitem = text => `<li style="${wechatStyles.li}">${text}</li>`;
renderer.blockquote = body => `<blockquote style="${wechatStyles.blockquote}">${body}</blockquote>`;
renderer.codespan = text => `<code style="${wechatStyles.code}">${escapeHtml(text)}</code>`;
renderer.code = code => `<pre style="${wechatStyles.pre}"><code style="display:block;white-space:pre;word-break:normal;font-family:Menlo,Consolas,monospace;">${escapeHtml(code)}</code></pre>`;
renderer.link = (href, title, text) => `<a style="${wechatStyles.a}" href="${safeAttr(href)}"${title ? ` title="${safeAttr(title)}"` : ''}>${text}</a>`;
renderer.strong = text => `<strong style="${wechatStyles.strong}">${text}</strong>`;
renderer.em = text => `<em style="${wechatStyles.em}">${text}</em>`;
renderer.hr = () => `<hr style="${wechatStyles.hr}">`;
renderer.image = (href, title, text) => `<img style="${wechatStyles.img}" src="${safeAttr(href)}" alt="${safeAttr(text || '')}"${title ? ` title="${safeAttr(title)}"` : ''}>`;
renderer.table = (header, body) => `<section style="margin:22px 0;padding:0;overflow-x:auto;border:1px solid ${wechatTheme.border};border-radius:14px;"><table style="${wechatStyles.table}"><thead>${header}</thead><tbody>${body}</tbody></table></section>`;
renderer.tablerow = content => `<tr style="background:${wechatTheme.paper};">${content}</tr>`;
renderer.tablecell = (content, flags) => {
    const tag = flags && flags.header ? 'th' : 'td';
    const style = tag === 'th' ? wechatStyles.th : wechatStyles.td;
    return `<${tag} style="${style}">${content}</${tag}>`;
};

function parseFrontMatter(content) {
    const cleaned = content.replace(/^\uFEFF/, '');
    const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(cleaned);
    if (!fmMatch) return null;

    const fm = fmMatch[1];
    const result = {};

    const titleMatch = /^title:\s+(.+)$/m.exec(fm);
    if (titleMatch) result.title = titleMatch[1].trim();

    const dateMatch = /^date:\s+(\d{4}-\d{2}-\d{2})/m.exec(fm);
    if (dateMatch) result.date = dateMatch[1];

    const categoryMatch = /^categories:\s+(.+)$/m.exec(fm);
    if (categoryMatch) result.category = categoryMatch[1].trim();

    const tagsMatch = /^tags:\s*\[(.+)\]$/m.exec(fm);
    if (tagsMatch) {
        result.tags = tagsMatch[1].split(',').map(t => t.trim());
    } else {
        const tagsLineMatch = /^tags:\s*$/m.exec(fm);
        if (tagsLineMatch) {
            const tagsBlock = fm.slice(fm.indexOf(tagsLineMatch[0]) + tagsLineMatch[0].length);
            const tagItems = [];
            const tagRegex = /^  -\s+(.+)$/gm;
            let m;
            while ((m = tagRegex.exec(tagsBlock)) !== null) {
                tagItems.push(m[1].trim());
            }
            result.tags = tagItems;
        } else {
            result.tags = [];
        }
    }

    const aiMatch = /^ai:\s+(.+)$/m.exec(fm);
    if (aiMatch) result.ai = aiMatch[1].trim().toLowerCase() === 'true';

    return result;
}

function extractBriefAndBody(content) {
    const cleaned = content.replace(/^\uFEFF/, '');
    const afterFm = cleaned.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    const moreIndex = afterFm.indexOf('<!--more-->');
    if (moreIndex === -1) {
        return { brief: '', body: afterFm };
    }
    const brief = afterFm.slice(0, moreIndex).trim();
    const body = afterFm.trim();
    return { brief, body };
}

function mdToWechatHtml(md) {
    const cleaned = md.replace(/<!--more-->\n?/g, '');
    const html = marked.parse(cleaned, { renderer, breaks: true });
    return wrapWechatArticle(html);
}

async function getPublicIP() {
    // 国内网络访问 api.ipify.org 常被拒，使用多个国内可达的服务做兜底
    const sources = [
        { url: 'https://www.taobao.com/helper/getip.php', parse: d => (d && d.ip) ? d.ip.trim() : '' },
        { url: 'http://ip.cip.cc', parse: d => typeof d === 'string' ? d.trim() : '' },
        { url: 'https://api.ip.sb/ip', parse: d => typeof d === 'string' ? d.trim() : '' },
        { url: 'https://myip.ipip.net', parse: d => {
            if (typeof d !== 'string') return '';
            const m = d.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
            return m ? m[1] : '';
        } },
    ];
    let lastError;
    for (const src of sources) {
        try {
            const res = await axios.get(src.url, { timeout: 5000 });
            const ip = src.parse(res.data);
            if (ip) return ip;
        } catch (e) {
            lastError = e;
        }
    }
    console.error('无法自动获取公网 IP，请手动查询本机公网 IP 后添加到白名单。');
    if (lastError) console.error('最后一次错误:', lastError.message || lastError);
    process.exit(1);
}

async function getAccessToken() {
    const res = await axios.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${appsecret}`);
    if (res.data.errcode) {
        if (res.data.errcode === 40164) {
            const ip = await getPublicIP();
            console.error(`IP 白名单错误！当前公网 IP: ${ip}`);
            console.error(`请到微信公众号后台 → 开发 → 基本配置 → IP 白名单中添加: ${ip}`);
            process.exit(1);
        }
        console.error('获取 access_token 失败:', res.data);
        process.exit(1);
    }
    return res.data.access_token;
}

async function createDraft(token, article) {
    const res = await axios.post(`https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`, {
        articles: [article]
    });
    if (res.data.errcode) {
        console.error('创建草稿失败:', res.data);
        process.exit(1);
    }
    return res.data.media_id;
}

async function publishDraft(token, mediaId) {
    const res = await axios.post(`https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${token}`, {
        media_id: mediaId
    });
    if (res.data.errcode) {
        console.error('发布失败:', res.data);
        process.exit(1);
    }
    return res.data.publish_id;
}

async function checkPublishStatus(token, publishId) {
    const res = await axios.post(`https://api.weixin.qq.com/cgi-bin/freepublish/get?access_token=${token}`, {
        publish_id: publishId
    });
    if (res.data.errcode) {
        console.error('查询发布状态失败:', res.data);
        return null;
    }
    return res.data.publish_status;
}

async function waitForPublish(token, publishId) {
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const status = await checkPublishStatus(token, publishId);
        if (status === 0) {
            console.log('发布成功!');
            return;
        } else if (status === 1) {
            console.log('发布中...');
        } else if (status === 2) {
            console.error('发布失败，请到公众号后台查看原因');
            process.exit(1);
        } else if (status === 3) {
            console.error('发布成功但超时，请到公众号后台确认');
            return;
        }
    }
    console.log('发布超时，请到公众号后台确认发布状态');
}

async function main() {
    const content = fs.readFileSync(filename).toString();
    const fm = parseFrontMatter(content);

    if (!fm || !fm.title || !fm.date) {
        console.error(fm,'文章格式解析失败，请检查 Front Matter（title, date 必填）');
        process.exit(1);
    }

    const { brief, body } = extractBriefAndBody(content);
    const slug = path.basename(filename, '.md');
    const url = `https://yo-cwj.com/${fm.date.replace(/-/g, '/')}/${slug}`;

    console.log('文章标题:', fm.title);
    console.log('文章分类:', fm.category || '无');
    console.log('文章标签:', fm.tags.length > 0 ? fm.tags.join(', ') : '无');
    console.log('AI 协助:', fm.ai ? '是' : '否');
    console.log('文章链接:', url);

    const htmlContent = mdToWechatHtml(body);

    const digestText = brief
        ? brief.replace(/[#*`\[\]()>-]/g, '').replace(/\n/g, ' ').substring(0, 120)
        : '';

    const finalContent = `${htmlContent}
        <br/>
        <p style="font-size:14px;line-height:1.8;color:${wechatTheme.muted};text-align:center;">点击"阅读原文"，可获得更完整、舒适的阅读体验</p>`;

    const token = await getAccessToken();
    console.log('access_token 获取成功');

    const mediaId = await createDraft(token, {
        title: fm.title,
        author: 'chenwj',
        digest: digestText,
        content: finalContent,
        content_source_url: url,
        thumb_media_id: picmid,
        need_open_comment: 1,
        only_fans_can_comment: 1
    });

    console.log('草稿创建成功, media_id:', mediaId);

    if (!shouldPublish) {
        openWechatDraftsPage();
    }

    if (shouldPublish) {
        console.log('正在发布草稿...');
        const publishId = await publishDraft(token, mediaId);
        console.log('发布任务已提交, publish_id:', publishId);
        await waitForPublish(token, publishId);
    }
}

main().catch(e => {
    console.error('执行出错:', e.message || e);
    process.exit(1);
});
