import fs from 'fs'
import v8 from 'v8'
import repl from 'repl'
import {fixCaseConflicts, getValue, parseJSON} from './tools.mjs'
import murmur3 from 'murmurhash-js'

const HASH_SEED = 0x5eedba5e

//let g_obj = JSON.parse(await fs.readFile('./out.json', {encoding: 'utf8'}))

export default function getRecords() {
    // Read file. 
    console.log('Reading records file...')
    let text = fs.readFileSync('out/twk_records.json', {encoding: 'utf8'})
    let {data, keyCounts} = parseJSON(text)


    let groups = JSON.parse(fs.readFileSync('schema/base_group_order.json'))
    let schemas = {}
    for (let groupName of groups) {
        schemas[murmur3(groupName, HASH_SEED)] = groupName
    }

    let records = {}

    for (const key in data.records) {
        records[key] = schemas[data.records[key]]
    }

    return records
}

console.dir(getRecords())

/*
let records = {}
let recordKeys = {}
*/
function nope() {

    for (const key in data.records) {
        /*if (!Number.isNaN(parseInt(key))) {
            continue
        }*/

        let schema = data.records[key]

        if (key.match(/_inline\d+$/)) continue

        let value = getValue(g_obj, key, true)
        
        if (typeof value === 'object') {
            /*let rcd = records[schema] = records[schema] || new Set()

            let numKeys = Object.keys(value).length
            if (rcd.size > 0 && !rcd.has(numKeys)) {
                let ourKeys = Object.keys(value)
                let theirKeys = recordKeys[schema]
                let newKeys = ourKeys.filter(k => !theirKeys.includes(k)).concat(theirKeys.filter(k => !ourKeys.includes(k)))
                console.log(newKeys.join(', '))
            }
            records[schema].add(Object.keys(value).length)
            recordKeys[schema] = Object.keys(value)*/

            if (key.includes('.')) {
                let namespace = key.split('.')[0]
                let schemaName = schemas[schema]
                records[schemaName] = records[schemaName] || new Set()
                records[schemaName].add(namespace)
            }
        }

    }

    // filter out mono-namespace schemas
    //records = Object.fromEntries(Object.entries(records).filter(e => e[1].size !== 1))

    console.dir(records)
}