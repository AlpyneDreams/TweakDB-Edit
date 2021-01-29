import fs from 'fs/promises'
import oldfs from 'fs'
import v8 from 'v8'
import repl from 'repl'

// structured/deep clone. we just use the v8 thing
let deepCopy = (object) => v8.deserialize(v8.serialize(object))

// get the line number of a character in a stirng by index
let lineNumber = (text, index) => text.substring(0, index).split('\n').length


let sortObjOrArray = (obj) => {
    // HACK: EulerAngles
    if (typeof obj === 'object' && obj._type !== 'EulerAngles') {
        if (!Array.isArray(obj))
            return sortObj(obj)
        else
            return obj.map(sortObjOrArray)
    }
    return obj

}
let sortObj = (unordered) => Object.keys(unordered).sort().reduce(
    (obj, key) => {
        obj[key] = sortObjOrArray(unordered[key])
        return obj
    },
    {}
)

console.log('Parsing JSON...')

let data, keyCounts
{
    console.log('Reading file...')
    let text = await fs.readFile('out/twk_flats.json', {encoding: 'utf8'})

    // Replace '\' with '\\`
    text = text.replace(/\\/g, '\\\\')

    // Convert number keys to strings
    text = text.replace(/^(\s*)(\d+)\s*:/gm, '$1"$2":')

    // Convert 64-bit integers to strings
    text = text.replace(/\d{10,}/g, function(match) {
        if (parseInt(match) > Number.MAX_SAFE_INTEGER) {
            return `"${match}"`
        } else {
            return match
        }
    })

    keyCounts = {}
    text = text.replace(/"((?:[^"\\]|\\.)*)"\s*:\s*([{[])/g, function(match, key, bracket) {
        if (key in keyCounts) {
            return `"${key}${keyCounts[key]++}": ${bracket}`
        } else {
            keyCounts[key] = 1
            return match
        }
    })

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
}

const TYPES = [
    'CResource',
    'Color',
    'EulerAngles',
    'Quaternion',
    'Vector2',
    'Vector3',
    'Vector4',       
    'Bool',
    'Double',
    'Float',
    'Int8',
    'Int16',
    'Int32',
    'Int64',
    'Uint8',
    'Uint16',
    'Uint32',
    'Uint64',
    'CName',
    'raRef:CResource',
    'LocalizationString',
    'String',
    'TweakDBID',
    'gamedataLocKeyWrapper',
]

const TYPES_CLASSES = [
    'Color',
    'EulerAngles',
    'Quaternion',
    'Vector2',
    'Vector3',
    'Vector4'
]

function convertValue(val) {
    if (val == undefined) return val
    let [type, value] = val

    if (type.startsWith('array:')) {
        let itemType = type.slice('array:'.length)
        return value.map(e => convertValue([itemType, e]))
    }

    // parity with CSV parser (temporary TODO FIXME)
    if (type === 'TweakDBID' && typeof value === 'number')
        value = value.toString(16).padStart(16, '0')

    else if (TYPES_CLASSES.includes(type)) {
        value = Object.assign({_type: type}, value)
        
        if (type.startsWith('Vector')) {
            value.x = Number(value.X) || 0
            value.y = Number(value.Y) || 0
            delete value.X
            delete value.Y 
            if (type === 'Vector3') {
                value.z = Number(value.Z) || 0
                delete value.Z    
            }
        } else if (type === 'EulerAngles') {
            /*value.r = value.Roll
            value.p = value.Pitch
            value.y = value.Yaw*/
            // TODO HACK: awful god terrible
            value.r = value.Pitch
            value.p = value.Yaw
            value.y = value.Roll

            delete value.Pitch
            delete value.Yaw
            delete value.Roll
        }

    } else if (type === 'raRef:CResource') {
        value = value.toString()
    } else if (!TYPES.includes(type))
        console.log(`Deserializing unknown type: ${type}`)
    
    // TODO HACK FIXME ??? this bug
    if (value === 4294967295) value = -1

    return value
}

// Count values of each type
{
    let values = []
    let types = {}
    for (let i = 0; i < keyCounts['values']; i++) {
        let j = i || ''
        let valuesN = data.flat['values' + j]
        let type = valuesN[0][0]
        let count = valuesN.length
        types[type] = count
    }
    console.table(types)
}


// keystr is recursive, e.g. "root.key1.key2" => obj[root][key1][key2]
function setValue(obj, keystr, value) {
    let o = obj
    let keys = keystr.split('.')
    let last = keys[keys.length - 1]
    for (let key of keys.slice(0, -1)) {
        o[key] = (o[key] == undefined) ? {} : o[key]
        o = o[key]
    }
    o[last] = value
}

function getValue(obj, keystr) {
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

// Build structure
let g_obj
{
    let obj = {}
    for (let i = 0; i < keyCounts['keys']; i++) {
        let keys = data.flat['keys' + (i||'')]
        let values = data.flat['values' + (i||'')]

        for (let k in keys) {
            let val = values[keys[k]]
            if (val == undefined)
                console.error(`'${values + (i||'')}' - Cannot get value for key '${k}' (values index ${keys[k]})`)
            if (k.match(/^\d+$/g)) continue
            setValue(obj, k, convertValue(val))
        }
    }
    //await fs.writeFile('out.json', JSON.stringify(obj, null, '\t'))
    g_obj = obj
}


// expand TweakDBID's of the format xxx_inline# to their actual data entry
function expandInlines(obj, root, realRoot) {
    root = root || deepCopy(obj)
    realRoot = realRoot || obj
    for (let key in obj) {
        let val = obj[key]
        switch (typeof(val)) {
            case 'string':
                // HACK? see usage of @ above
                if (val.startsWith('@'))
                    continue
                if (val.match(/_inline\d+$/)) {
                    obj[key] = getValue(root, val)
                    setValue(realRoot, val, undefined)
                    if (typeof obj[key] === 'object') {
                        obj[key] = expandInlines(obj[key], root, realRoot)
                    }
                }
                break
            case 'object':
                obj[key] = expandInlines(val, root, realRoot)
            default:
                break
        }
    }
    return obj
}

console.log('Expanding inline data...')

g_obj = expandInlines(g_obj)

/*
global.keys = keyCounts
global.obj = g_obj
repl.start({useGlobal: true, preview: false})
*/
console.log('Writing JSON...')

if (!oldfs.existsSync('data'))
    await fs.mkdir('data')

let files = []
let filesOriginalCase = []

function fixCaseConflicts(key, quiet = false) {
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
console.dir(g_obj.MedicActions.Resurrect.activationCondition.spatialAND[0].spatialHintMults)

for (let key in g_obj) {
    let fname = fixCaseConflicts(key)
    let ob = {}
    ob[key] = g_obj[key]
    console.log(`Writing data/${fname}.json...`)
    fs.writeFile(`data/${fname}.json`, JSON.stringify(sortObj(ob), null, '\t'))
}