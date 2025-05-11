const mangayomiSources = [
  {
    "name": "KickAssAnime",
    "id": 4096048097,
    "baseUrl": "https://kaa.mx",
    "lang": "en",
    "typeSource": "multi",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://kaa.mx/",
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
    "pkgPath": "anime/src/en/kickassanime.js",
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
    return this.getPreference("kaa_base_url");
  }

  async apiCall(slug) {
    var baseUrl = this.getBaseUrl();
    var url = baseUrl + "/api/show" + slug;
    var res = await this.client.get(url, this.getHeaders(url));
    return JSON.parse(res.body);
  }

  formatList(animeList) {
    var list = [];
    var baseUrl = this.getBaseUrl();
    var titlePref = this.getPreference("kaa_title_lang");

    animeList.forEach((anime) => {
      var slug = anime.slug;
      var posterSlug = anime.poster.hq;

      var name = anime.hasOwnProperty(titlePref)
        ? anime[titlePref]
        : anime.title;
      var link = `${baseUrl}/${slug}`;
      var imageUrl = `${baseUrl}/image/poster/${posterSlug}.webp`;

      list.push({ name, link, imageUrl });
    });

    return list;
  }

  async getAnimeList(slug, page = 1) {
    var body = await this.apiCall(`${slug}page=${page}`);

    var maxPage = body.hasOwnProperty("page_count") ? body.page_count : 1;
    var animeList = body.hasOwnProperty("result") ? body.result : [];
    var hasNextPage = maxPage > page;
    var list = await this.formatList(animeList);
    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.getAnimeList("/popular?", page);
  }

  async getLatestUpdates(page) {
    return await this.getAnimeList("/recent?type=all&", page);
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
        key: "kaa_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://kaa.mx",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "kaa_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 1,
          entries: ["English", "Romaji"],
          entryValues: ["title_en", "title"],
        },
      },
    ];
  }

  // End
}
