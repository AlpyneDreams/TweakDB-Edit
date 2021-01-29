import fs from 'fs/promises'
import oldfs from 'fs'
import v8 from 'v8'

// structured/deep clone. we just use the v8 thing
let deepCopy = (object) => v8.deserialize(v8.serialize(object))

// split string at most 'max' times.
// unlike String.split, it will merge all stuff after the last separator into one 
let splitMax = (str, sep, max) => {
    let split = str.split(sep)
    if (split.length > max)
        return [...split.slice(0, max - 1), split.slice(max - 1).join(',')]
    else
        return split
}

console.log('Reading file...')
var g_text = await fs.readFile('out/twk_flats.csv', {encoding: 'utf8'})

console.log('Parsing CSV...')
var g_entries = g_text.replace(/\r\n/g, '\n').split('\n').map(line => splitMax(line, ',', 3))

console.log('Processing data...')

var g_obj = {}
//var typeCounts = {}

// strip start and end quotes only
function stripQuotes(str) {
    str = str.trim()
    if (str.startsWith('"')) str = str.slice(1)
    if (str.endsWith('"')) str = str.slice(0, -1)
    return str
}

function deserialize(type, value) {
    if (type.startsWith('array:')) {
        let items = value.trim().split(' ').slice(1, -1)    // remove '[' and ']'
        let itemType = type.slice('array:'.length)          // get type of array elements

        // vector arrays
        if (itemType.startsWith('Vector')) {
            if (value.trim() === '[  ]') return []
            items = value.trim().split('}{').map(e => '{ ' + e.substring(e.indexOf('x')).trim() + ' }')
            items[items.length - 1] = items[items.length - 1].slice(0, -4)

        // string arrays
        } else if (itemType === 'String' || itemType === 'CName') {
            items = JSON.parse(value.trim().replace(/" "/g, '","'))
        }
        return items.map(i => deserialize(itemType, i))     // deserialize each element
    }
    switch (type) {
        case 'Bool':
            return (value.trim() === 'true')
        
        // numeric types (that fit in double)
        case 'Int8':
        case 'Int16':
        case 'Int32':
        case 'Uint8':
        case 'Uint16':
        case 'Uint32':
        case 'Float':
        case 'Double':
            return parseFloat(value)

        // keep 64-bit ints as string due to precision
        case 'Int64':
        case 'Uint64':
        case 'raRef:CResource':
            return value.trim()

        case 'gamedataLocKeyWrapper':   // this is numeric
            if (parseInt(value) > Number.MAX_SAFE_INTEGER) {
                return value.trim()
            } else {
                return parseInt(value)
            }
        
        // structs, formatted like { x:1 y:2 }
        case 'Color':
        case 'EulerAngles':
        case 'Quaternion':
        case 'Vector2':
        case 'Vector3':
        case 'Vector4':
            let o = {_type: type}
            
            o = Object.assign(o, Object.fromEntries(
                value.trim()
                    .split(' ')                 // k:v pairs separated by space
                    .slice(1, -1)               // remove '{' and '}'
                    .map(kv => kv.split(':'))   // key:value
                    .map(kv => [kv[0], parseFloat(kv[1])])  // all these structs have numeric values
            ))
            
            return o
            
        

        case 'TweakDBID':   // references another TweakDB ID. can be numeric if string is missing
        case 'String':
        case 'CName':
            return stripQuotes(value)
        
        case 'CResource':
        case 'LocalizationString':
        default:
            console.log(`Deserializing unknown type: ${type}`)
            return value
    }
}

// keystr is recursive, e.g. "root.key1.key2" => obj[root][key1][key2]
function setValue(obj, keystr, type, value) {
    let o = obj
    let keys = keystr.split('.')
    let last = keys[keys.length - 1]
    for (let key of keys.slice(0, -1)) {
        o[key] = (o[key] == undefined) ? {} : o[key]
        o = o[key]
    }
    o[last] = type == null ? value : deserialize(type, value)
    if (type !== null && o[last] == null || Number.isNaN(o[last])) {
        console.log(`Got null or NaN from ${type} "${value}"`)
    }
}

function getValue(obj, keystr) {
    let o = obj
    // TODO: use array reduce or something
    let keys = keystr.split('.')
    for (let key of keys) {
        o = o[key]
        if (o === undefined) {
            console.error(`getValue: cannot find '${keystr}'`)
            return '@' + keystr
        }
    }
    return o
}

// expand TweakDBID's of the format xxx_inline# to their actual data entry
function expandInlines(obj, root, realRoot) {
    root = root || deepCopy(obj)
    realRoot = realRoot || obj
    for (let key in obj) {
        let val = obj[key]
        switch (typeof(val)) {
            case 'string':
                // HACK?
                if (val.startsWith('@'))
                    continue
                if (val.match(/_inline\d+$/)) {
                    obj[key] = getValue(root, val)
                    setValue(realRoot, val, null, undefined)
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

let skipped = 0

for (var e of g_entries) {
    if (e.length != 3) {
        //console.log(e.join(','))
        continue
    }

    let [key, type, value] = e
    //typeCounts[type] = typeCounts[type] == undefined ? 1 : (typeCounts[type] + 1)

    // skip hex keys (string missing)
    // TODO: potentially include these in their own file
    if (key.match(/^[0-9a-f]+$/i)) {
        skipped++
        continue
    }

    setValue(g_obj, key, type, value)
}

console.log('Expanding inline data...')

g_obj = expandInlines(g_obj)

console.log(`Skipped ${skipped} hex keys`)


console.log('Writing JSON...')

if (!oldfs.existsSync('data1'))
    await fs.mkdir('data1')

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

for (let key in g_obj) {
    let fname = fixCaseConflicts(key)
    let ob = {}
    ob[key] = g_obj[key]
    console.log(`Writing data1/${fname}.json...`)
    fs.writeFile(`data1/${fname}.json`, JSON.stringify(ob, null, '\t'))
}
