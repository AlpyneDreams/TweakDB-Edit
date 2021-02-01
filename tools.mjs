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

export function getValue(obj, keystr, quiet=false) {
    let o = obj
    // TODO: use array reduce or something
    let keys = keystr.split('.')
    for (let key of keys) {
        o = o[key]
        if (o === undefined) {
            if (!quiet) console.error(`getValue: cannot find '${keystr}'`)
            // use @ to signify unresolved TweakDBID
            return '@' + keystr
        }
    }
    return o
}

// Fix malformed JSON, handle duplicate keys, etc.
// These are all quirks specific to the JSON output by TweakDump
export function parseJSON(text) {
    let data, keyCounts

    // Replace '\' with '\\`
    text = text.replace(/\\/g, '\\\\')

    // Convert number keys to strings
    text = text.replace(/^(\s*)(\d+)\s*:/gm, '$1"$2":')

    // Convert 64-bit integers to strings to preserve precision
    text = text.replace(/\d{10,}/g, function(match) {
        if (parseInt(match) > Number.MAX_SAFE_INTEGER) {
            return `"${match}"`
        } else {
            return match
        }
    })

    // count duplicate keys and number them appropriately
    keyCounts = {}
    text = text.replace(/"((?:[^"\\]|\\.)*)"\s*:\s*([{[])/g, function(match, key, bracket) {
        if (key in keyCounts) {
            return `"${key}${keyCounts[key]++}": ${bracket}`
        } else {
            keyCounts[key] = 1
            return match
        }
    })

    // parse the actual JSON
    try {
        data = JSON.parse(text)
    } catch (err) {
        if (err instanceof SyntaxError) {
            console.log(err)
            // get index of syntax error
            let index = parseInt(err.message.match(/\d+/)[0])
            // convert index to line number
            let line = text.substring(0, index).split('\n').length
            console.log(`Line: ${line}`)
        }
    }

    //console.dir(data, {depth: 1})
    //console.dir(keyCounts)

    return {data, keyCounts}
}
