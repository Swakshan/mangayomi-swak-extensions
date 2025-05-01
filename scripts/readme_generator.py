from common import readJsonFile, readFile, writeFile, getParentPath, writeJsonFile
from model import UpdateInfo, Source, ItemType
from datetime import datetime
from pytz import timezone
from pprint import pp

main_dir = getParentPath()
scripts_dir = main_dir / "scripts"


def generateVersionData():
    versionPath = scripts_dir / "versions.json"
    oldData = readJsonFile(versionPath)

    FILES = ["", "anime_", "novel_"]
    title = ["manga", "anime", "novel"]

    currentDT = datetime.now(timezone("Asia/Kolkata")).strftime("%Y/%m/%d %H:%M IST")

    newData = {}
    for file in FILES:
        ind = main_dir / f"{file}index.json"
        data = readJsonFile(ind)
        itemType = title[FILES.index(file)]
        oldDataCat = oldData[str(itemType)]
        collection = {}
        for item in data:
            item: Source = Source().fromJSON(item)
            name = item.name
            lang = item.lang
            version = item.version

            if name in oldDataCat:
                oldInfo = oldDataCat[name]
                oldVersion = oldInfo['version']
                if version == oldVersion:
                    collection[name] = oldInfo
                    continue
            
            info = None
            if name in collection:
                info: UpdateInfo = UpdateInfo().fromJSON(collection[name])
                info.setLang(lang)
            else:
                version = item.version
                updTime = currentDT

                info: UpdateInfo = UpdateInfo(
                    name=name, version=version, lastUpd=updTime
                )
                info.setLang(lang)

            if info is not None:
                collection[name] = info.toJSON()

        newData[str(itemType)] = collection

    writeJsonFile(newData, versionPath)


def generateExtensionList():
    lines = []
    lines.append("<details>")
    lines.append(
        '<summary><span style="font-size:1.7em; font-weight:bold;">Available Extension List</span></summary>\n'
    )

    data = readJsonFile(scripts_dir / "versions.json")
    for category, items in data.items():
        catData = data[category]
        if len(catData) < 1:
            continue
        lines.append(f"## {category.title()}\n")
        lines.append("| Name | Version | Language | Last Updated |")
        lines.append("|------|---------|----------|---------------|")
        for item in items:
            item = catData[item]
            lines.append(
                f"| {item['name']} | {item['version']} | {item['langs']} | {item['lastUpd']} |"
            )
        lines.append("")  # Add blank line between sections

    lines.append("</details>")
    print("DONE: Table")
    return "\n".join(lines)

generateVersionData()
extTable = generateExtensionList()
temp = readFile(scripts_dir / "README-temp.md")
tempData = temp.replace("{{Extension Table}}", extTable)

readMePath = main_dir / "README.md"
writeFile(readMePath, tempData)
print("DONE: README.md")
