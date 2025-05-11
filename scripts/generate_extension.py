from common import readFile, writeFile, generateHash, getParentPath
from model import ItemType, Source
import json


def createFunction(isAsync: bool, funcName: str, args: list, code=""):
    arg = ""
    if len(args) > 0:
        arg = ", ".join(args)

    return f"""
    {"async" if isAsync else ""} {funcName}({arg}) {{
        {f'throw new Error("{funcName} not implemented");' if code == "" else code}
    }}
    """


def builder(source: dict, itemType: ItemType):
    lines = []

    code = "const mangayomiSources = [<>];".replace("<>", str(jsonExt))
    lines.append("class DefaultExtension extends MProvider {")
    lines.append(
        createFunction(
            False, "constructor", [], "super();\n\t\tthis.client = new Client();"
        )
    )
    lines.append(
        createFunction(
            False, "getPreference", ["key"], "return new SharedPreferences().get(key);"
        )
    )
    lines.append(createFunction(False, "getHeaders", ["url"]))
    lines.append(createFunction(True, "getPopular", ["page"]))
    lines.append(createFunction(True, "getLatestUpdates", ["page"]))
    lines.append(createFunction(True, "search", ["query", "page", "filters"]))
    lines.append(createFunction(True, "getDetail", ["url"]))

    if itemType == ItemType.anime:
        lines.append(createFunction(True, "getVideoList", ["url"]))
    elif itemType == ItemType.manga:
        lines.append(createFunction(True, "getPageList", ["url"]))
    elif itemType == ItemType.novel:
        lines.append(createFunction(True, "getHtmlContent", ["url"]))
        lines.append(createFunction(True, "cleanHtmlContent", ["html"]))

    lines.append(createFunction(False, "getFilterList", []))
    lines.append(createFunction(False, "getSourcePreferences", []))
    lines.append("}")
    return code + "".join(lines)


print("---------------------------------")
print("--------Extension Builder--------")
print("---------------------------------")

name = input("Extension name: ")
lang = input("Langauges (, seperated): ")
baseUrl = input("Base url: ")
apiUrl = input("API url: ")
typeSource = input("Source type (s/m/t): ")
iconUrl = "https://www.google.com/s2/favicons?sz=256&domain=" + baseUrl
isManga = input("Is manga (0/1): ")
itemType = input("Type (0/1/2): ")

name = name.title()
langs = lang.split(",")
baseUrl = baseUrl[:-1] if baseUrl[-1] == "/" else baseUrl
apiUrl = apiUrl[:-1] if apiUrl != "" and apiUrl[-1] == "/" else apiUrl
typeSource = (
    "single" if typeSource == "s" else "multi" if typeSource == "m" else "torrent"
)
isManga = True if int(isManga) else False
itemType = ItemType(int(itemType))

ext = Source(
    name=name,
    lang=langs[0],
    baseUrl=baseUrl,
    apiUrl=apiUrl,
    typeSource=typeSource,
    iconUrl=iconUrl,
    version="0.0.1",
    isManga=isManga,
    itemType=itemType,
)

jsonExt = ext.toJSON()
if len(langs) > 1:
    jsonExt.pop("id")
    jsonExt.pop("lang")

    ids = {}
    for lang in langs:
        ids[lang] = generateHash(lang, name)

    jsonExt["ids"] = ids
    jsonExt["langs"] = langs

pkgPath = f"{itemType.name}/src/{langs[0]}/{name.lower()}.js"
jsonExt["pkgPath"] = pkgPath

jsonExt = json.dumps(jsonExt)
code = builder(jsonExt, itemType)

filePath = getParentPath() / "javascript" / pkgPath
writeFile(filePath, code)
print(f"DONE: {filePath}")
