from pathlib import Path
import os, shutil, json
from glob import glob
from pprint import pp
from common import readFile, readJsonFile, writeJsonFile, getParentPath
from model import Source, ItemType


def extensionInfo(filepath):
    data = readFile(filepath)
    s = "const mangayomiSources = "
    e = ";"

    start = data.find(s) + len(s)
    end = data.find(e)
    cont = data[start:end]
    return json.loads(data[start:end])[0]


def formatExtenstionInfo(info):
    exids = info["ids"] if "ids" in info else info["id"] if "id" in info else None
    exlangs = (
        info["langs"]
        if "langs" in info
        else [info["lang"]] if "lang" in info else ["all"]
    )

    bkInfo = info
    bkInfo.pop("ids", None)
    bkInfo.pop("langs", None)
    rd = []

    for lang in exlangs:
        id = exids
        if type(exids) is dict:
            id = exids[lang] if exids is not None and lang in exids else None
        bkInfo["id"] = id
        bkInfo["lang"] = lang
        pkgPath = bkInfo["pkgPath"]
        bkInfo["ItemType"] = (
            ItemType.manga
            if "manga/" in pkgPath
            else ItemType.anime if "anime/" in pkgPath else ItemType.novel
        )
        bkInfo["sourceCodeUrl"] = (
            "https://raw.githubusercontent.com/Swakshan/mangayomi-swak-extensions/refs/heads/main/javascript/"
            + pkgPath
        )
        rd.append(Source.fromJSON(bkInfo).toJSON())
    print("DONE: Ext-" + info["name"])
    return rd


main_dir = getParentPath()

root_folder = main_dir / "javascript/"
js_files = glob(os.path.join(root_folder, "**", "*.js"), recursive=True)

animeList = []
mangaList = []
novelList = []


try:
    for filePath in js_files:
        paths = Path(filePath).resolve().parts

        info = extensionInfo(filePath)
        formattedInfo: list = formatExtenstionInfo(info)

        if "anime" in paths:
            animeList.extend(formattedInfo)
        elif "manga" in paths:
            mangaList.extend(formattedInfo)
        else:
            novelList.extend(formattedInfo)

    writeJsonFile(main_dir / "anime_index.json", animeList)
    writeJsonFile(main_dir / "index.json", mangaList)
    writeJsonFile(main_dir / "novel_index.json", novelList)
except Exception as e:
    print("ERR: " + paths[len(paths) - 1])
    print(e)
