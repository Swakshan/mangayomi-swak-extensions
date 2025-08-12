const mangayomiSources = [
  {
    "name": "Moviesda",
    "id": 3570935492,
    "baseUrl": "https://moviesda12.com",
    "lang": "ta",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://moviesda12.com/",
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
    "pkgPath": "anime/src/ta/moviesda.js",
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
    return "https://moviesda12.com";
  }

  async request(slug) {
    var baseUrl = this.getBaseUrl();
    var req = await this.client.get(baseUrl + slug);
    return new Document(req.body);
  }

  generateImageUrl(slug) {
    var baseUrl = this.getBaseUrl();
    var imageSlug = slug.replace("-movie-download/", ".webp");
    return baseUrl + "/uploads/posters" + imageSlug;
  }

  async getPageData(slug, page) {
    slug += `?page=${page}`;
    var doc = await this.request(slug);
    var list = [];

    for (var item of doc.select("div.f")) {
      var a = item.selectFirst("a");
      var name = a.text;
      if (name.includes("திரைப்படங்களுக்கு") || name.includes("Movies Page")) {
        continue;
      }

      var link = a.getHref;
      var imageUrl = this.generateImageUrl(link);
      list.push({ name, imageUrl, link });
    }

    var hasNextPage = !!(doc.selectFirst("a.pagination_next").getHref );

    return { list, hasNextPage };
  }

  async getPopular(page) {
    var currentYear = new Date().getFullYear();
    var slug = `/tamil-${currentYear}-movies/`;
    return await this.getPageData(slug, page);
  }

  async getLatestUpdates(page) {
    var currentYear = new Date().getFullYear();
    var slug = `/tamil-${currentYear}-movies/`;
    return await this.getPageData(slug, page);
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
    throw new Error("getSourcePreferences not implemented");
  }
}
