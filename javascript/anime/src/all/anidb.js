const mangayomiSources = [
  {
    "name": "AniDB",
    "id": 952169136,
    "baseUrl": "https://anidb.app",
    "lang": "all",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://anidb.app/",
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
    "pkgPath": "anime/src/all/anidb.js",
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

  getHeaders() {
    var baseUrl = this.getBaseUrl();
    return {
      Referer: baseUrl,
      Origin: baseUrl,
      "User-Agent": "MangaYomi",
    };
  }

  getBaseUrl() {
    return this.source.baseUrl;
  }

  async request(slug) {
    var url = this.getBaseUrl() + slug;
    var res = await this.client.get(url, this.getHeaders());
    if (res.statusCode != 200) return null;
    return res.body;
  }

  async requestDoc(slug) {
    var res = await this.request(slug);
    return new Document(res);
  }

  async requestJson(slug) {
    var res = await this.request(slug);
    return JSON.parse(res);
  }

  async searchAnime({ query = "", sort = "order_popular", page = "1" }) {
    var slug = `/browse?q=${query}&sort=${sort}&page=${page}`;
    var doc = await this.requestDoc(slug);

    var list = [];
    doc
      .selectFirst(".anime-grid")
      .select("a")
      .forEach((item) => {
        var name = item.selectFirst("p").text;
        var link = item.getHref;
        var imageUrl = item.selectFirst("img").getSrc;
        list.push({
          name,
          link,
          imageUrl,
        });
      });

    var hasNextPage = false;
    var paginationSection = doc.selectFirst(".mt-10");
    
      var spans = paginationSection.select("span")
      if (spans != null && spans.length > 1) {
      var lastSpan = spans.reverse()[0];
      hasNextPage = !lastSpan.className.includes("cursor-not-allowed");
    }

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchAnime({ page: page });
  }

  async getLatestUpdates(page) {
    return await this.searchAnime({ status: "order_updated", page: page });
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
    throw new Error("getSourcePreferences not implemented");
  }
}
