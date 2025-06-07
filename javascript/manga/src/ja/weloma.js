const mangayomiSources = [
  {
    "name": "WeLoMa",
    "id": 1890238687,
    "baseUrl": "https://weloma.art",
    "lang": "ja",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://weloma.art",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.1",
    "isManga": true,
    "itemType": 0,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "manga/src/ja/weloma.js",
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
    var url = `${this.source.baseUrl}${slug}`;
    var body = (await this.client.get(url)).body;
    return new Document(body);
  }

  async searchPage({
    name = "",
    sort = "name",
    sort_type = "DESC",
    genres = [],
    status = "",
    page = 1,
  } = {}) {
    function addSlug(para, value) {
      return `&${para}=${value}`;
    }
    var slug = "/manga-list.html?";
    slug += `name=${name}`;
    slug += addSlug("sort", sort);
    slug += addSlug("genre", genres.join(","));
    slug += addSlug("sort_type", sort_type);
    slug += addSlug("m_status", status);
    slug += addSlug("page", `${page}`);

    var doc = await this.request(slug);

    var list = [];
    doc.select(".thumb-item-flow").forEach((item) => {
      var linkSection = item.selectFirst(".series-title").selectFirst("a");
      var link = linkSection.getHref;
      var name = linkSection.text.trim();

      var imgStyle = item
        .selectFirst(".img-in-ratio")
        .attr("style")
        .trim()
        .substring(23, 150);
      var imageUrl = imgStyle.substring(0, imgStyle.indexOf("')"));
      list.push({ name, link, imageUrl });
    });

    lastPage = doc
      .selectFirst("ul.pagination.pagination-v4")
      .select("a")
      .slice(-1)[0];
    var hasNextPage = !lastPage.className.includes("disabled");

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchPage({ sort: "views", page: page });
  }

  async getLatestUpdates(page) {
    return await this.searchPage({ sort: "last_update", page: page });
  }

  async search(query, page, filters) {
    throw new Error("search not implemented");
  }

  async getDetail(url) {
    throw new Error("getDetail not implemented");
  }

  async getPageList(url) {
    throw new Error("getPageList not implemented");
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

  getSourcePreferences() {
    throw new Error("getSourcePreferences not implemented");
  }
}
