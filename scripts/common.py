from pathlib import Path
import json, re

def extensionInfo(filepath):
    def fix_json(json_str):
        # Remove trailing commas before closing } or ]
        json_str = re.sub(r",\s*([}\]])", r"\1", json_str)
        return json.loads(json_str)

    data = readFile(filepath)
    s = "const mangayomiSources = "
    e = ";"

    start = data.find(s) + len(s)
    end = data.find(e)
    cont = data[start:end]
    return fix_json(data[start:end])[0]

def readFile(fileName):
    f = open(fileName, 'r')
    data = f.read()
    f.close()
    return data

def writeFile(fileName,data):
    f = open(fileName, 'w',encoding='utf-8')
    f.write(data)
    f.close()
    return True

def readJsonFile(fileName):
    data = readFile(fileName)
    return json.loads(data)

def writeJsonFile(fileName,data):
    f = open(fileName, "w",encoding="utf-8")
    json.dump(data,f,indent=4,ensure_ascii=False)
    f.close()
    print(f"DONE: {fileName}")
    
    
def generateHash(lang,name):
    idStr = f"mangayomi-js-{lang}.{name}"
    h = 0
    for c in idStr:
        h = (((h << 5) - h) + ord(c)) & 0xFFFFFFFF
    return h

def getParentPath():
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent
