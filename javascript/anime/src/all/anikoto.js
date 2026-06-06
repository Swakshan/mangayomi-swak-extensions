const mangayomiSources = [
  {
    "name": "Anikoto",
    "id": 206730385,
    "baseUrl": "https://anikototv.to",
    "lang": "all",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://anikototv.to/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.3",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/all/anikoto.js",
  },
];
class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  getHeaders(url) {
    return {
      Referer: "https://anikototv.to",
      Origin: "https://anikototv.to",
      "User-Agent": "MangaYomi",
    };
  }

  getBaseUrl() {
    return this.getPreference("anikoto_base_url");
  }

  async request(slug) {
    var url = this.getBaseUrl() + slug;
    var res = await this.client.get(url);
    return new Document(res.body);
  }

  async filter({ keyword = "", sort = "default", page = "1" }) {
    var titlePref = this.getPreference("anikoto_title_lang");

    var slug = `/filter?keyword=${keyword}&type=&sort=${sort}&page=${page}`;

    var doc = await this.request(slug);

    var list = [];
    doc
      .selectFirst("#list-items")
      .select(".item")
      .forEach((item) => {
        var dataId = item.selectFirst(".tip").attr("data-tip")
        var nameSection = item.selectFirst(".d-title");
        var name =
          titlePref == "e" ? nameSection.text : nameSection.attr("data-jp");
        var imageUrl = item.selectFirst("img").attr("src");
        var link = item.selectFirst("a").attr("href") + "||" + dataId;
        list.push({
          name,
          link,
          imageUrl,
        });
      });

    var pagination = doc.selectFirst("ul.pagination").select("li");
    var hasNextPage = !pagination.reverse()[0].className.includes("active");
    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.filter({ "sort": "most-viewed", "page": page });
  }

  async getLatestUpdates(page) {
    return await this.filter({ "sort": "latest-updated", "page": page });
  }

  async search(query, page, filters) {
    return await this.filter({ "keyword":query,"sort": "default", "page": page });
  }

  async getDetail(url) {
    throw new Error("getDetail not implemented");
  }

  async getVideoList(url) {
    throw new Error("getVideoList not implemented");
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

  getSourcePreferences() {
    return [
      {
        key: "anikoto_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://anikototv.to",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "anikoto_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 0,
          entries: ["English", "Romaji"],
          entryValues: ["e", "r"],
        },
      },
    ];
  }
}
