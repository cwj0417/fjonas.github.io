const request = require('axios');
const git = require('simple-git');
const fs = require('fs-extra');
''
const appid = process.argv[2];
const appsecret = process.argv[3];

if (!appid || !appsecret) {
    console.log('apak not found');
    return;
}

const picmid = 'rM9vKgwYh7rfR-t1xSaBSMo1eWr6-MHBnkhBIxBBliLv3vP4Oq0jnYec0Hp4n1a7';

git().log({ 'maxCount': 1, '--stat': true }).then(res => {
    try {
        const content = fs.readFileSync(res.all[0].diff.files[0].file).toString();
        const titleRegex = /---\ntitle:\s+(.*)\n/;
        const dateRegex = /date:\s+(\d{4}-\d{2}-\d{2})/;
        const breifRegex = /\n---\n((:?.|\n)*)<!--more-->\n/;
        const title = titleRegex.exec(content)[1];
        const breif = breifRegex.exec(content)[1];
        const date = dateRegex.exec(content)[1];
        const url = `https://yo-cwj.com/${date.replace(/-/g, '/')}/${res.all[0].diff.files[0].file.replace(/.*\/([^/]*)\.md/, '$1')}`
        request({
            url: `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${appsecret}`
        }).then(res => {
            console.log(res.data);
            const token = res.data.access_token;
            request({
                url: `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`,
                method: 'POST',
                data: {
                    "articles": [
                        {
                            "title": title,
                            "author": 'chenwj',
                            "digest": breif.substring(0, 120),
                            "content": `${breif.split(`\n`).map(i => `<p>${i}</p>`).join('')}
                            <br/>
                            <p>点击"阅读原文", 以获得更好的观看体验.</p>`,
                            "content_source_url": url,
                            "thumb_media_id": picmid,
                            "need_open_comment": 1,
                            "only_fans_can_comment": 1
                        }
                    ]
                }
            }).then(res => console.log(res.data.media_id))
        })
    } catch (e) { }
})
