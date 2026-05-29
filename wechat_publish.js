const axios = require('axios');
const fs = require('fs');
const path = require('path');
const markedPath = require.resolve('marked', { paths: [path.dirname(require.resolve('hexo-renderer-marked'))] });
const { marked } = require(markedPath);

const appid = process.argv[2];
const appsecret = process.argv[3];
const filename = process.argv[4];
const shouldPublish = process.argv.includes('--publish');

if (!appid || !appsecret || !filename) {
    console.log('usage: node notify.js <appid> <appsecret> <post_path> [--publish]');
    process.exit(1);
}

const picmid = 'rM9vKgwYh7rfR-t1xSaBSMo1eWr6-MHBnkhBIxBBliLv3vP4Oq0jnYec0Hp4n1a7';

const wechatStyles = {
    h1: 'font-size:22px;font-weight:bold;margin:24px 0 16px;color:#333;',
    h2: 'font-size:19px;font-weight:bold;margin:22px 0 14px;color:#333;',
    h3: 'font-size:17px;font-weight:bold;margin:20px 0 12px;color:#333;',
    h4: 'font-size:16px;font-weight:bold;margin:18px 0 10px;color:#333;',
    p: 'font-size:15px;line-height:1.8;margin:10px 0;color:#333;',
    ul: 'font-size:15px;line-height:1.8;margin:10px 0;padding-left:20px;color:#333;',
    ol: 'font-size:15px;line-height:1.8;margin:10px 0;padding-left:20px;color:#333;',
    li: 'font-size:15px;line-height:1.8;margin:4px 0;color:#333;',
    blockquote: 'border-left:3px solid #ddd;padding:10px 15px;margin:15px 0;color:#666;background:#f9f9f9;',
    code: 'font-size:14px;background:#f0f0f0;padding:2px 4px;border-radius:3px;color:#c7254e;',
    pre: 'font-size:14px;background:#f5f5f5;padding:12px;border-radius:4px;overflow-x:auto;line-height:1.5;',
    a: 'color:#576b95;text-decoration:none;',
    strong: 'font-weight:bold;color:#333;',
    em: 'font-style:italic;',
    hr: 'border:none;border-top:1px solid #ddd;margin:20px 0;',
    img: 'max-width:100%;height:auto;',
    table: 'border-collapse:collapse;margin:15px 0;width:100%;',
    th: 'border:1px solid #ddd;padding:8px 12px;background:#f5f5f5;font-weight:bold;',
    td: 'border:1px solid #ddd;padding:8px 12px;',
};

const renderer = new marked.Renderer();

Object.keys(wechatStyles).forEach(tag => {
    const style = wechatStyles[tag];
    switch (tag) {
        case 'h1': renderer.heading = (text, level) => {
            if (level === 1) return `<h1 style="${style}">${text}</h1>`;
            if (level === 2) return `<h2 style="${wechatStyles.h2}">${text}</h2>`;
            if (level === 3) return `<h3 style="${wechatStyles.h3}">${text}</h3>`;
            return `<h4 style="${wechatStyles.h4}">${text}</h4>`;
        }; break;
        case 'p': renderer.paragraph = text => `<p style="${style}">${text}</p>`; break;
        case 'ul': renderer.list = (body, ordered) => {
            const tag = ordered ? 'ol' : 'ul';
            return `<${tag} style="${ordered ? wechatStyles.ol : style}">${body}</${tag}>`;
        }; break;
        case 'li': renderer.listitem = text => `<li style="${style}">${text}</li>`; break;
        case 'blockquote': renderer.blockquote = body => `<blockquote style="${style}">${body}</blockquote>`; break;
        case 'code': renderer.codespan = text => `<code style="${style}">${text}</code>`; break;
        case 'pre': renderer.code = (code, lang) => `<pre style="${style}"><code>${code}</code></pre>`; break;
        case 'a': renderer.link = (href, title, text) => `<a style="${style}" href="${href}">${text}</a>`; break;
        case 'strong': renderer.strong = text => `<strong style="${style}">${text}</strong>`; break;
        case 'em': renderer.em = text => `<em style="${style}">${text}</em>`; break;
        case 'hr': renderer.hr = () => `<hr style="${style}">`; break;
        case 'img': renderer.image = (href, title, text) => `<img style="${style}" src="${href}" alt="${text || ''}">`; break;
        case 'table': renderer.table = (header, body) => `<table style="${style}"><thead>${header}</thead><tbody>${body}</tbody></table>`; break;
        case 'th': renderer.tablercell = (content, flags) => `<th style="${style}">${content}</th>`; break;
        case 'td': renderer.tablecell = (content, flags) => `<td style="${style}">${content}</td>`; break;
    }
});

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
    return marked.parse(cleaned, { renderer });
}

async function getPublicIP() {
    const res = await axios.get('https://api.ipify.org?format=json');
    return res.data.ip;
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
        <p style="font-size:14px;color:#999;text-align:center;">点击"阅读原文", 以获得更好的观看体验</p>`;

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
