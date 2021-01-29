let files = []
let filesOriginalCase = []

// For Windows.
// ex: change 'debug' to 'debug1' if 'Debug' is already used
export function fixCaseConflicts(key, quiet = false) {
    let i = files.indexOf(key.toLowerCase())
    let res = key
    if (i !== -1) {
        res = key + '1'
        if (files.includes(res)) {
            console.error('ERROR: 3-way case conflict. good lord')
            process.exit(1)
        }
        console.error(`WARNING: Case conflict for root key '${key}' with '${filesOriginalCase[i]}'. JSON file will be saved as '${res}'`)
    }
    files.push(key.toLowerCase())
    filesOriginalCase.push(key)
    return res
}

export function getValue(obj, keystr) {
    let o = obj
    // TODO: use array reduce or something
    let keys = keystr.split('.')
    for (let key of keys) {
        o = o[key]
        if (o === undefined) {
            console.error(`getValue: cannot find '${keystr}'`)
            // use @ to signify unresolved TweakDBID
            return '@' + keystr
        }
    }
    return o
}
