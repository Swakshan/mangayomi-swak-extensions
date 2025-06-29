const mangayomiSources = [
  {
    "name": "Tamilarasan",
    "id": 1706754281,
    "baseUrl": "https://tamilarasan.us",
    "lang": "all",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://tamilarasan.us/",
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
    "notes": "",
    "pkgPath": "anime/src/all/tamilarasan.js",
  },
];
class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getHeaders(url) {
    throw new Error("getHeaders not implemented");
  }

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  getBaseUrl() {
    return this.getPreference("tamilarasan_base_url");
  }

  async request(url) {
    return await this.client.get(url);
  }

  async requestDoc(slug) {
    var res = await this.request(slug);
    return new Document(res.body);
  }

  async getHomePage(page) {
    var pref = this.getPreference("tamilarasan_home_section");
    var slug = pref != "tvshows" ? `genre/${pref}` : pref;
    var doc = await this.requestDoc(
      `${this.source.baseUrl}/${slug}/page/${page}/`
    );

    var list = [];
    var hasNextPage = false;
    doc
      .selectFirst(".items.normal")
      .select("article")
      .forEach((item) => {
        var imageUrl = item.selectFirst("img").getSrc;
        var link = item.selectFirst("a").getHref;
        var name = item
          .selectFirst(".title")
          .text.replace(" Full Movie Watch Online Free", "")
          .replace(" Web Series Watch Online", "")
          .replace(" Web Series Online", "")
          .trim();
        list.push({ name, imageUrl, link });
      });

    var lastPage = doc
      .selectFirst("div.pagination > span")
      .text.split(" of ")[1];
    hasNextPage = page != parseInt(lastPage);
    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.getHomePage(page);
  }

  async getLatestUpdates(page) {
    return await this.getHomePage(page);
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
        key: "tamilarasan_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "Default: https://tamilarasan.us/",
          value: "https://tamilarasan.us/",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "tamilarasan_home_section",
        listPreference: {
          title: "Content in popular/latest section",
          summary: "",
          valueIndex: 0,
          entries: [
            "Tamil",
            "Hindi",
            "Telugu",
            "Tamil dubbed",
            "TV Shows",
            "Tamil web series",
          ],
          entryValues: [
            "tamil-hd-movies",
            "hindi-movies",
            "telugu-hd-movies",
            "tamil-dubbed-movies",
            "tvshows",
            "tamil-web-series",
          ],
        },
      },
    ];
  }
}
