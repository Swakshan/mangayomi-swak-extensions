from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from enum import IntEnum
from common import generateHash


class ItemType(IntEnum):
    manga = 0
    anime = 1
    novel = 2


@dataclass
class Source:
    id: Optional[int] = None
    name: str = ""
    baseUrl: str = ""
    lang: str = ""
    isNsfw: bool = False
    sourceCodeUrl: str = ""
    typeSource: str = ""
    iconUrl: str = ""
    hasCloudflare: bool = False
    dateFormat: str = ""
    dateFormatLocale: str = ""
    apiUrl: str = ""
    version: str = ""
    isManga: Optional[bool] = None
    itemType: ItemType = ItemType.manga
    isFullData: bool = False
    appMinVerReq: str = "0.5.0"
    additionalParams: str = ""
    sourceCodeLanguage: int = 0

    def __post_init__(self):
        # Set isManga based on itemType if it's None
        if self.isManga is None:
            self.isManga = self.itemType == ItemType.manga

    @classmethod
    def fromJSON(self, json: Dict[str, Any]) -> "Source":
        source_code_lang = json.get("sourceCodeLanguage", 0)

        # Calculate id using hash if not provided
        if "id" not in json or json["id"] is None:

            id_value = generateHash(json.get("lang", ""), json.get("name", ""))
        else:
            id_value = json["id"]

        return self(
            id=id_value,
            name=json.get("name", ""),
            baseUrl=json.get("baseUrl", ""),
            lang=json.get("lang", ""),
            isNsfw=json.get("isNsfw", False),
            sourceCodeUrl=json.get("sourceCodeUrl", ""),
            typeSource=json.get("typeSource", ""),
            iconUrl=json.get("iconUrl", ""),
            hasCloudflare=json.get("hasCloudflare", False),
            dateFormat=json.get("dateFormat", ""),
            dateFormatLocale=json.get("dateFormatLocale", ""),
            apiUrl=json.get("apiUrl", ""),
            version=json.get("version", ""),
            isManga=json.get("isManga", json.get("itemType", 0) == 0),
            itemType=ItemType(json.get("itemType", 0)),
            isFullData=json.get("isFullData", False),
            appMinVerReq=json.get("appMinVerReq", "0.5.0"),
            additionalParams=json.get("additionalParams", ""),
            sourceCodeLanguage=source_code_lang,
        )

    def toJSON(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": (
                self.id if self.id is not None else generateHash(self.lang, self.name)
            ),
            "baseUrl": self.baseUrl,
            "lang": self.lang,
            "typeSource": self.typeSource,
            "iconUrl": self.iconUrl,
            "dateFormat": self.dateFormat,
            "dateFormatLocale": self.dateFormatLocale,
            "isNsfw": self.isNsfw,
            "hasCloudflare": self.hasCloudflare,
            "sourceCodeUrl": self.sourceCodeUrl,
            "apiUrl": self.apiUrl,
            "version": self.version,
            "isManga": self.isManga,
            "itemType": self.itemType.value,
            "isFullData": self.isFullData,
            "appMinVerReq": self.appMinVerReq,
            "additionalParams": self.additionalParams,
            "sourceCodeLanguage": self.sourceCodeLanguage,
        }


@dataclass
class UpdateInfo:
    name: str = ""
    version: str = "0.0.0"
    langs: List[str] = field(default_factory=list)
    lastUpd: str = "9999/12/31 00:00 IST"

    def setLang(self, lang):
        self.langs.append(lang)

    @classmethod
    def fromJSON(self, json: Dict[str, Any]) -> "Source":
        return self(
            name=json["name"],
            version=json["version"],
            langs=json["langs"].split(", "),
            lastUpd=json["lastUpd"],
        )

    def toJSON(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "langs": ", ".join(self.langs),
            "lastUpd": self.lastUpd,
        }
