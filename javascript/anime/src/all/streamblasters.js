const mangayomiSources = [
  {
    "name": "Streamblasters",
    "id": 1069142360,
    "baseUrl": "https://www.streamblasters.party",
    "lang": "all",
    "typeSource": "multi",
    "iconUrl":
      "https://www.streamblasters.party/wp-content/uploads/2022/05/cropped-SBL-Favi-3-192x192.png",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.6",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/all/streamblasters.js",
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

  getBaseUrl() {
    return this.getPreference("sb_override_base_url");
  }

  async request(url) {
    var res = (await this.client.get(url)).body;
    return new Document(res);
  }

  async pageListing(slug) {
    var url = this.getBaseUrl() + slug;
    var doc = await this.request(url);

    var list = [];
    var items = doc.select(".blog-items.blog-items-control > article");
    items.forEach((item) => {
      var imgSet = item.selectFirst("img").attr("srcset").split(", ");
      var imageUrl = imgSet[imgSet.length - 1].split(" ")[0];
      var linkSection = item.selectFirst("h3").selectFirst("a");
      var link = linkSection.getHref;
      var name = linkSection.text.replace(" Watch Online", "");
      list.push({
        name,
        imageUrl,
        link,
      });
    });

    var hasNextPage = doc.selectFirst(".prev-content").text.length > 0;
    return { list, hasNextPage };
  }

  async homePage(page) {
    var slug = page > 1 ? `/page/${page}/` : ``;
    return await this.pageListing(slug);
  }

  async getPopular(page) {
    return await this.homePage(page);
  }

  async getLatestUpdates(page) {
    return await this.homePage(page);
  }

  async search(query, page, filters) {
    var query = `/?s=${query}`;
    var slug = page > 1 ? `/page/${page}${query}` : query;
    return await this.pageListing(slug);
  }

  async getDetail(url) {
    var link = url.replace("www.", "");
    var doc = await this.request(link);
    var name = doc
      .selectFirst("span.current")
      .text.replace(" Watch Online", "");
    var imageUrl = doc.selectFirst("img.blog-picture.tmdb-picture").getSrc;

    var description = doc
      .selectFirst("div.tmdb-section-overview")
      .selectFirst("p")
      .text.trim();

    var status = 1;
    var chapters = [];
    doc
      .selectFirst("div.series-listing")
      .select("a")
      .forEach((item) => {
        var epLink = item.getHref;
        var epName = item.selectFirst("span").text;
        chapters.push({
          name: epName,
          url: epLink,
        });
      });

    return { name, imageUrl, description, link, status, chapters };
  }

  async getVideoList(url) {
    var link = url.replace("www.", "");
    var doc = await this.request(link);
    var iframe = doc.selectFirst("iframe").getSrc;
    var streamUrl = "";

    var doc = await this.request(iframe);
    var title = doc.selectFirst("title").text.trim();
    var body = doc.html;

    if (iframe.includes("lulu")) {
      var sKey = 'file:"';
      var eKey = '"';
      var s = body.indexOf(sKey);
      var e = body.indexOf(eKey, s + sKey.length);
      var streamUrl = body.substring(s + sKey.length, e);
    } else {
      var sKey = "eval(function(";
      var eKey = "</script>";
      var s = body.indexOf(sKey);
      if (s < 1)
        throw new Error("Video key not found. Try different player/source");

      var e = body.indexOf(eKey, s + sKey.length);N
      var obfJs = body.substring(s, e);
      var strmData = unpackJs(obfJs);

      sKey = '"hls2":"';
      eKey = '"';
      var s = strmData.indexOf(sKey);
      if (s < 1)
        throw new Error("Video key not found. Try different player/source");
      var e = strmData.indexOf(eKey, s + sKey.length);
      var streamUrl = strmData.substring(s, e);
    }

    return [
      {
        url: streamUrl,
        originalUrl: streamUrl,
        quality: title,
      },
    ];
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

  getSourcePreferences() {
    return [
      {
        key: "sb_override_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "Default: https://www.streamblasters.party",
          value: "https://www.streamblasters.party",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
    ];
  }
}
