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
    "version": "1.0.2",
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
    var baseUrl = this.getBaseUrl();
    if (slug.includes(baseUrl)) {
      url = slug;
    } else {
      var url = baseUrl + slug;
    }
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

    var spans = paginationSection.select("span");
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
    return await this.searchAnime({ sort: "order_updated", page: page });
  }

  async search(query, page, filters) {
    return await this.searchAnime({ query: query, page: page });
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

    function formChapter(item, epName) {
      var token = `${item.id}`;
      var isFiller = item.filler;

      return {
        name: epName,
        url: token,
        isFiller,
      };
    }

    var doc = await this.requestDoc(url);

    var description = doc.selectFirst(
      ".text-sm.text-faint.leading-relaxed",
    ).text;
    var statusText = doc.selectFirst(".badge.badge-gray").text;
    var status = statusCode(statusText);
    var genre = [];
    doc
      .selectFirst(".flex-1.pt-2")
      .selectFirst(".flex.flex-wrap.gap-1.5.mb-4")
      .select("a")
      .forEach((item) => {
        genre.push(item.text);
      });
    var animeType = doc.selectFirst(".badge.badge-orange").text.toUpperCase();
    var isMovie = animeType == "MOVIE";
    var animeId = url.split("-").reverse()[0];

    var chapters = [];
    var chaptersSlug = `/api/frontend/anime/${animeId}/episodes`;
    doc = await this.requestJson(chaptersSlug);
    var episodeList = doc.episodes;
    if (isMovie) {
      var item = doc.episodes[0];
      chapters.push(formChapter(item, "Movie"));
    } else {
      for (var index = 0; index < episodeList.length; index++) {
        var item = episodeList[index];
        var epName = `Episode ${index + 1}`;
        chapters.push(formChapter(item, epName));
      }
    }

    chapters.reverse();
    return { link: url, description, genre, status, chapters };
  }

  async getVideoList(url) {
    var streams = [];
    var includeDub = this.getPreference("anidb_include_other_audio");

    var episodeSlug = `/api/frontend/episode/${url}/languages`;
    var doc = await this.requestJson(episodeSlug);

    for (var item of doc.languages) {
      var code = item.code;
      if (code != "jpn" && !code) continue;
      var language = item.name;
      var embed_url = item.embed_url;
      var streamUrl = await this.extractFromEmbed(embed_url);
      streams.push({
        url: streamUrl,
        originalUrl: streamUrl,
        quality: language,
      });
    }

    return streams.reverse();
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

  getSourcePreferences() {
    return [
      {
        key: "anidb_include_other_audio",
        "switchPreferenceCompat": {
          "title": "Include other audio streams",
          "summary": "Include streams ther than Japanese audio",
          "value": true,
        },
      },
    ];
  }

  async extractFromEmbed(url) {
    var doc = await this.requestDoc(url);
    var startKey = "file: '";
    var endKey = "', type: ";
    var body = doc.html;

    var start = body.indexOf(startKey) + startKey.length;
    var end = body.indexOf(endKey, start);

    return body.substring(start, end);
  }
}
