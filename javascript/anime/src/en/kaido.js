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
    "version": "0.0.5",
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
    var titlePref = this.getPreference("kaido_title_lang")

    var slug = keyword == "" ? "/filter?" : `/search?keyword=${keyword}&`;
    slug += `sort=${sort}&page=${page}`;

    var doc = await this.request(slug);
    var list = [];

    doc.select(".flw-item").forEach((item) => {
      var name = item.selectFirst("h3").selectFirst("a").attr(titlePref);
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
      page_item.length > 0 && page_item.at(-1).text != `${page}` ? true : false;

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

  async ajaxRequest(slug) {
    var url = this.source.baseUrl + "/ajax/episode" + slug;
    var res = await this.client.get(url);
    var json = JSON.parse(res.body);
    return json["html"] || json["link"];
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          "Currently Airing": 0,
          "Finished Airing": 1,
        }[status] ?? 5
      );
    }

    var epTitlePref = this.getPreference("kaido_ep_title_lang")
    var baseUrl = this.source.baseUrl;
    var slug = url.replace(baseUrl, "");
    var link = baseUrl + "/watch" + slug;

    var doc = await this.request(slug);
    var anisc_info = doc.selectFirst(".anisc-info");
    var description = anisc_info.selectFirst(".text").text.trim();
    var genre = [];
    anisc_info
      .selectFirst(".item-list")
      .select("a")
      .forEach((item) => genre.push(item.text));

      var status = 5
      for(var item of anisc_info.select(".item-title")){
        var head = item.selectFirst(".item-head").text
        if(head.includes("Status") ){
            status = statusCode(item.selectFirst(".name").text)
            break;
        }
      }

    var totalSub = parseInt(doc.selectFirst(".tick-sub").text);
    var totalDub = parseInt(doc.selectFirst(".tick-dub").text);

    var data_id = doc.selectFirst("#wrapper").attr("data-id");
    var epiRes = await this.ajaxRequest(`/list/${data_id}`);
    var epiDoc = new Document(epiRes);

    var chapters = [];
    epiDoc.select("a.ep-item").forEach((item) => {
      var isFiller = item.className.includes("ssl-item-filler")
      var episodeNum = item.attr("data-number");
      var episodeTitle = item.selectFirst(".ep-name").attr(epTitlePref);
      var episodeId = item.attr("data-id");
      var scanlator = "";
      if (parseInt(episodeId) <= totalSub) scanlator += "SUB";
      if (parseInt(episodeId) <= totalDub) scanlator += ", DUB";
      chapters.push({
        name: `E${episodeNum}: ${episodeTitle}`,
        url: episodeId,
        scanlator,
        isFiller,
      });
    });
    chapters.reverse();
    return { link, status,description, genre, chapters };
  }

  async getVideoList(url) {
    throw new Error("getVideoList not implemented");
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

  getSourcePreferences() {
    return[
      {
        key: "kaido_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 0,
          entries: ["English", "Romaji"],
          entryValues: ["title", "data-jname"],
        },
      },{
        key: "kaido_ep_title_lang",
        listPreference: {
          title: "Preferred episode title language",
          summary: "Choose in which language episode title should be shown",
          valueIndex: 0,
          entries: ["English", "Romaji"],
          entryValues: ["title", "data-jname"],
        },
      },
    ]
  }
}
