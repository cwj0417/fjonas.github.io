const { readdirSync, statSync, renameSync } = require('fs-extra')
const { join } = require('path')

const traverse = (path) => {
    const dirs = readdirSync(path)
    dirs.forEach(dir => {
        if (statSync(join(path, dir)).isDirectory()) {
            traverse(join(path, dir))
        } else {
            if (join(path, dir).endsWith('jade')) {
                renameSync(join(path, dir), join(path, dir).replace(/jade$/g, 'pug'))
            }
        }
    })
}

traverse(__dirname + '/themes')