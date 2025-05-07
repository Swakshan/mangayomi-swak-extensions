const mangayomiSources = [
  {
    "name": "Aniwave",
    "id": 3928195277,
    "baseUrl": "https://aniwave.se",
    "lang": "en",
    "typeSource": "multi",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://aniwave.se/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.1",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "pkgPath": "anime/src/en/aniwave.js",
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
      Referer: url,
    };
  }

  getBaseUrl() {
    return this.getPreference("aniwave_base_url");
  }

  async request(slug) {
    var url = this.getBaseUrl() + slug;
    var res = await this.client.get(url, this.getHeaders(url));
    return res.body;
  }

  async getAnimeList(slug) {
    var list = [];
    var hasNextPage = false;
    var namePref = this.getPreference("aniwave_title_lang");

    var doc = new Document(await this.request(slug));
    var items = doc.select("#list-items > div.item");

    for (var item of items) {
      var nameSection = item.selectFirst("a.d-title");
      var name =
        namePref == "ro" ? nameSection.text : nameSection.attr("data-jp");
      var link = item.selectFirst("a").getHref;
      var imageUrl = item.selectFirst("img").getSrc;
      list.push({ name, link, imageUrl });
    }
    var nav = doc.selectFirst("nav.navigation");
    if (nav != null) {
      var page_links = doc.select("a.page-link");
      hasNextPage = !slug.includes(page_links[page_links.length - 1].getHref);
    }
    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.getAnimeList(`/trending-anime/?page=${page}`);
  }

  async getLatestUpdates(page) {
    return await this.getAnimeList(`/anime-list/?page=${page}`);
  }

  async search(query, page, filters) {
    throw new Error("search not implemented");
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
        key: "aniwave_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://aniwave.se",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "aniwave_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 1,
          entries: ["English", "Romaji"],
          entryValues: ["en", "ro"],
        },
      },
    ];
  }
}
