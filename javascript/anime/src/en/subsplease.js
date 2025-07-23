const mangayomiSources = [
  {
    "name": "SubsPlease",
    "id": 2732508901,
    "baseUrl": "https://subsplease.org",
    "lang": "en",
    "typeSource": "single",
    "iconUrl":
      "https://raw.github.com/Swakshan/mangayomi-swak-extensions/main/javascript/icon/en.subsplease.jpg",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "https://subsplease.org/api",
    "version": "0.0.5",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/en/subsplease.js",
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
    return this.source.baseUrl;
  }

  async requestAPI(slug) {
    var apiUrl = this.source.apiUrl;
    var api = `${apiUrl}/?${slug}`;
    var res = await this.client.get(api);
    return JSON.parse(res.body) || {};
  }

  async animeList(slug) {
    var baseUrl = this.getBaseUrl();
    var body = await this.requestAPI(slug);
    var list = [];
    var hasNextPage = slug.includes("f=latest"); //Only latest has next page, Search doesnt.
    for (var ep in body) {
      var item = body[ep];
      var name = item.show;
      var imageUrl = baseUrl + item.image_url;
      var link = item.page;
      list.push({ name, imageUrl, link });
    }

    return { list, hasNextPage };
  }

  async getPopular(page) {
    var slug = `f=latest&tz=&p=${page - 1}`;
    return await this.animeList(slug);
  }

  async getLatestUpdates(page) {
    var slug = `f=latest&tz=&p=${page - 1}`;
    return await this.animeList(slug);
  }

  async search(query, page, filters) {
    var slug = `f=search&tz=&s=${query}`;
    return await this.animeList(slug);
  }

  async getDetail(url) {
    var baseUrl = this.getBaseUrl();
    var baseSlug = `${baseUrl}/shows/`;
    if (url.includes(baseUrl)) url = url.replace(baseSlug, "");
    var link = baseSlug + url;

    var doc = new Document((await this.client.get(link)).body);
    var sid = doc.selectFirst("#show-release-table").attr("sid");
    var description =
      doc.selectFirst("div.series-syn").selectFirst("p").text || "";

    var slug = `f=show&tz=&sid=${sid}`;
    var body = await this.requestAPI(slug);

    var episodes = body.episode || {};
    var chapters = [];
    for (var epItem in episodes) {
      var item = episodes[epItem];
      var dateUpload = new Date(item.release_date).valueOf().toString();
      var episodeNum = item.episode;
      var urls = {};
      item.downloads.forEach((download) => {
        delete download.torrent;
        delete download.xdcc;
        urls[download.res] = download.magnet;
      });
      chapters.push({
        name: `Episode ${episodeNum}`,
        url: JSON.stringify(urls),
        dateUpload,
      });
    }

    return { description, chapters };
  }

  sortQuality(qs) {
    var pref = this.getPreference("subsplease_pref_video_resolution");
    var sortedQ = qs.filter((q) => q != pref);
    if (qs.includes(pref)) sortedQ.unshift(pref);
    return sortedQ;
  }

  async getVideoList(url) {
    var data = JSON.parse(url);
    var sortedQ = this.sortQuality(Object.keys(data));
    var streams = [];
    sortedQ.forEach((item) => {
      var quality = `${item}p`;
      var magLink = data[item];
      streams.push({
        url: magLink,
        originalUrl: magLink,
        quality,
      });
    });

    return streams;
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

  getSourcePreferences() {
    return [
      {
        key: "subsplease_pref_video_resolution",
        listPreference: {
          title: "Preferred video resolution",
          summary: "",
          valueIndex: 0,
          entries: ["1080p", "720p", "480p"],
          entryValues: ["1080", "720", "480"],
        },
      },
    ];
  }
}
