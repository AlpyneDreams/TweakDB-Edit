# TweakDB Editor

Cyberpunk 2077 TweakDB editor to be used in conjunction with [TweakDump](https://www.cyberpunk.net/en/modding-support).

[Download Link](https://github.com/AlpyneDreams/TweakDB-Edit/archive/main.zip).

## Instructions

You will need [Node.js](https://nodejs.org/). (Any recent version should work, I recommend `14.15` if you encounter issues). Make sure to enable "Add to PATH" in the installer.

1. Install this project to a folder in your root Cyberpunk 2077 game folder.
2. Put `TweakDump.exe`, `tweakdb.str`, and `types.csv` in that folder
3. Run `tweaks.bat` to generate CSV and JSON. This might spit out a bunch of warnings about missing strings, but you can generally ignore those.
4. In this folder, run `node flats_json.mjs` to generate a `data` folder.
    - You can also optionally run `node flats_csv.mjs` to generate a `data_csv` folder from the exported CSV data.
5. Browse the new data folder, you should see everything you'll want to see.
6. Compiling back to `tweakdb.bin` coming soon!

## Current Features

- Expands the full structured TweakDB into a set of JSON files
- Handles pretty much all weird quirks in TweakDump JSON
- Unpacks every `_inline#` object
- Adds type metadata to structs (key is `_type`), for integral types and types with a record ID from [TweakDB Schema](https://github.com/gibbed/Cyberpunk-TweakDB-Schema)

## Planned Features

- Ability to compile JSON back to TweakDB
    - Incremental loading of TweakDB patches to support multiple mods
- Streamlined process to set up and use
- More integration with [TweakDB Schema](https://github.com/gibbed/Cyberpunk-TweakDB-Schema)