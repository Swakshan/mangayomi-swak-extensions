const mangayomiSources = [
  {
    "name": "Anixl",
    "id": 2448777672,
    "baseUrl": "https://anixl.to",
    "lang": "en",
    "typeSource": "multi",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://anixl.to/",
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
    "pkgPath": "anime/src/en/anixl.js",
  },
];
class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getBaseUrl() {
    return this.source.baseUrl;
  }

  baseUrl = this.getBaseUrl();

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  getHeaders() {
    return { "content-type": "application/json" };
  }

  async request(query, variables) {
    var body = { query, variables: variables };
    var req = await this.client.post(
      this.baseUrl + "/apo/",
      this.getHeaders(),
      body
    );
    return JSON.parse(req.body);
  }

  listing(res, page) {
    var result = res["data"]["result"];
    var items = result["items"];
    var maxPage = result["paging"]["pages"];
    var list = [];

    items.forEach((item) => {
      var data = item["data"];
      list.push({
        "link": data.ani_id,
        "name": data.info_title,
        "imageUrl": `${this.baseUrl}${data.urlCover300}`,
      });
    });
    var hasNextPage = page < maxPage;
    return { list, hasNextPage };
  }

  async searchList({
    keyword = "",
    incGenres = null,
    excGenres = null,
    sortBy = "field_score",
    page = 1,
  } = {}) {
    var query = `query ($page: Int = 1,$sortby:String,$query:String,$incGenres:[String],$excGenres:[String]) {
                result: get_searchAnime(
                  select:  {
                    word: $query
                    page: $page
                    size: 20
                    sortby: $sortby
                    incGenres:$incGenres
                    excGenres:$excGenres
                  }
                ) {
                  items {
                    data {
                      ani_id
                      info_title
                      urlCover300
                    }
                  }paging {
                    pages
                  }
                }
              }`;
    var variables = {
      "query": keyword,
      "page": parseInt(page),
      "sortby": sortBy,
      "incGenres": incGenres,
      "excGenres": excGenres,
    };
    var res = await this.request(query, variables);
    return this.listing(res, page);
  }

  async getPopular(page) {
    return await this.searchList({page:page});
  }

  async getLatestUpdates(page) {
    var query = `query ($page: Int!) {
                result: get_latest_animes(select:  {
                  page: $page
                }) {
                  items {
                    data {
                      ani_id
                      info_title
                      urlCover300
                    }
                  } paging {
                    pages
                  }
                }
              }`;
    var variables = {
      "page": parseInt(page),
    };
    var res = await this.request(query, variables);
    return this.listing(res, page);
  }

  async search(query, page, filters) {
    return await this.searchList({ keyword:query,page:page});
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
