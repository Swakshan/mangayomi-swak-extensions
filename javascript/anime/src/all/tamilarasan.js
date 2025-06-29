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
    "version": "0.0.5",
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
    return (await this.client.get(url)).body;
  }

  async requestDoc(slug) {
    var res = await this.request(slug);
    return new Document(res);
  }

  sanitizeTitle(title) {
    return title
      .replace(" Full Movie Watch Online Free", "")
      .replace(" Web Series Watch Online", "")
      .replace(" Web Series Online", "")
      .replace(" Movie Watch Online", "")
      .trim();
  }
  async getHomePage(page) {
    var pref = this.getPreference("tamilarasan_home_section");
    var slug = pref != "tvshows" ? `genre/${pref}` : pref;
    var doc = await this.requestDoc(
      `${this.getBaseUrl()}/${slug}/page/${page}/`
    );

    var list = [];
    var hasNextPage = false;
    doc
      .selectFirst(".items.normal")
      .select("article")
      .forEach((item) => {
        var imageUrl = item.selectFirst("img").getSrc;
        var link = item.selectFirst("a").getHref;
        var name = this.sanitizeTitle(item.selectFirst(".title").text);
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
    var url = `${this.getBaseUrl()}/page/${page}/?s=${query}`;
    var doc = await this.requestDoc(url);

    var list = [];
    var hasNextPage = false;
    doc.select(".result-item").forEach((item) => {
      var link = item.selectFirst("a").getHref;
      var imageUrl = item.selectFirst("img").getSrc;
      var name = this.sanitizeTitle(item.selectFirst(".title").text);
      list.push({ name, imageUrl, link });
    });
    var lastPage = doc
      .selectFirst("div.pagination > span")
      .text.split(" of ")[1];
    hasNextPage = page != parseInt(lastPage);
    return { list, hasNextPage };
  }

  async getDetail(url) {
    var link = url;
    var doc = await this.requestDoc(url);
    var chapters = [];
    var count = 0;
    doc
      .selectFirst(".wp-content")
      .select("iframe")
      .forEach((item) => {
        var name = `Player ${++count}`;
        var url = item.getSrc;

        chapters.push({ name, url });
      });
    return { link, chapters };
  }
  getUnPackJs(doc) {
    var skey = "eval(function(p,a,c,k,e,d)";
    var eKey = "</script>";
    var start = doc.indexOf(skey);
    var end = doc.indexOf(eKey, start);
    var js = doc.substring(start, end);
    return unpackJs(js);
  }

  async getVideoList(url) {
    if (url.includes("youtube.com"))
      throw new Error("Youtube embed are yet to be handled");
    else if (url.includes("tapepops"))
      throw new Error("Tapepops embed are yet to be handled");

    var res = await this.request(url);

    var unpack = this.getUnPackJs(res);

    var skey = '"hls2":"';
    var eKey = '"}';
    var start = unpack.indexOf(skey) + skey.length;
    var end = unpack.indexOf(eKey, start);
    var stream = unpack.substring(start, end);
    if (stream.length == 0)
      throw new Error("Stream not found. Try different player");

    var doc = new Document(res);
    var title = doc.selectFirst("meta").attr("content");
    if (title.length == 0) {
      title = "Auto";
    }

    return [
      {
        url: stream,
        originalUrl: stream,
        quality: title,
        headers: { "Referer": url },
      },
    ];
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
