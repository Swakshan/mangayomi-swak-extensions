const mangayomiSources = [
  {
    "name": "Kaido",
    "id": 2457624982,
    "baseUrl": "https://kaido.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://kaido.to/",
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
    "pkgPath": "anime/src/en/kaido.js",
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
    throw new Error("getHeaders not implemented");
  }

  async request(slug) {
    var url = this.source.baseUrl + slug;
    var res = await this.client.get(url);
    return new Document(res.body);
  }

  async filter({ keyword = "", sort = "default", page = "1" }) {
    var slug = keyword == "" ? "/filter?" : `/search?keyword=${keyword}&`;
    slug += `sort=${sort}&page=${page}`;

    var doc = await this.request(slug);
    var list = [];
    //var hasNextPage = false;

    doc.select(".flw-item").forEach((item) => {
      var name = item.selectFirst("h3").selectFirst("a").attr("title");
      var link = item.selectFirst("a").attr("href");
      var imageUrl = item.selectFirst("img").attr("data-src");
      list.push({
        name,
        link,
        imageUrl,
      });
    });

    var page_item = doc.select(".page-item");
    var hasNextPage =
            page_item.length>0 && page_item.at(-1).text != `${page}` ? true : false;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.filter({ "sort": "score", "page": page });
  }

  async getLatestUpdates(page) {
    return await this.filter({ "sort": "recently_updated", "page": page });
  }

  async search(query, page, filters) {
    return await this.filter({ "keyword": query, "page": page });
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
