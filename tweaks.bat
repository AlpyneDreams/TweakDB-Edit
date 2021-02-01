@echo off

if not exist "out" mkdir "out"

:: TweakDump ..\r6\cache\tweakdb.bin out\tweakdb.json -string=tweakdb.str
TweakDump ..\r6\cache\tweakdb.bin out\twk_flats.json -skip-records -skip-tags -skip-queries -string=tweakdb.str
TweakDump ..\r6\cache\tweakdb.bin out\twk_flats.csv -skip-records -skip-tags -skip-queries -string=tweakdb.str -format=database
TweakDump ..\r6\cache\tweakdb.bin out\twk_records.json -skip-flats -skip-tags -skip-queries -string=tweakdb.str
:: TweakDump ..\r6\cache\tweakdb.bin out\twk_tags.json -skip-records -skip-flats -skip-queries -string=tweakdb.str
:: TweakDump ..\r6\cache\tweakdb.bin out\twk_queries.json -skip-records -skip-tags -skip-flats -string=tweakdb.str
