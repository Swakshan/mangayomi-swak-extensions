const mangayomiSources = [
  {
    "name": "Senshi",
    "id": 4254616130,
    "baseUrl": "https://senshi.live",
    "lang": "all",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://senshi.live",
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
    "pkgPath": "anime/src/all/senshi.js",
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

  getBaseUrl() {
    return "https://senshi.live";
  }

  getHeaders(url) {
    return {
      Referer: this.getBaseUrl(),
      Origin: this.getBaseUrl(),
      "User-Agent": "MangaYomi",
    };
  }
  async request(slug, body = {}) {
    var baseUrl = this.getBaseUrl();
    var hdr = this.getHeaders();
    var url = baseUrl + slug;
    var res = null;
    if (slug.includes("/filter")) {
      res = await this.client.post(url, hdr, body);
    } else {
      res = await this.client.get(url, hdr);
    }
    return JSON.parse(res.body);
  }

  async formatList(slug, body, page, perPageLimit) {
    var doc = await this.request(slug, body);

    var baseUrl = this.getBaseUrl();
    var titlePref = this.getPreference("senshi_title_lang");

    var totalCount = doc.total;
    var hasNextPage = page <= totalCount / perPageLimit + 1;
    var list = [];

    doc.data.forEach((item) => {
      item = item.hasOwnProperty("anime") ? item.anime : item;
      var romajiTitle = item.title;
      var englishTitle = item.hasOwnProperty("title_english")
        ? item.title_english
        : romajiTitle;
      var name = titlePref == "e" ? englishTitle : romajiTitle;

      var anime_picture = item.anime_picture;
      var imageUrl = baseUrl + anime_picture;

      var link = item.public_id;

      list.push({
        name,
        link,
        imageUrl,
      });
    });
    return { list, hasNextPage };
  }

  async searchAnime({ query = "", sort = "score_desc", page = "1" }) {
    var slug = "/anime/filter";

    var perPageLimit = 30;
    page = parseInt(page);

    var body = {
      "searchTerm": query,
      "page": "" + page,
      "limit": "" + perPageLimit,
      "sortBy": sort,
    };

    return await this.formatList(slug, body, page, perPageLimit);
  }

  async getPopular(page) {
    return await this.searchAnime({ page: page });
  }

  async getLatestUpdates(page) {
    var perPageLimit = 30;
    var slug = `/episode-embeds/latest-paginated?page=${page}&limit=${perPageLimit}`;

    return await this.formatList(slug, {}, page, perPageLimit);
  }

  async search(query, page, filters) {
    return await this.searchAnime({ query: query, page: page });
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
        key: "senshi_title_lang",
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
