const mangayomiSources = [
  {
    "name": "Senshi",
    "id": 4254616130,
    "baseUrl": "https://senshi.live",
    "lang": "all",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://senshi.live",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "1.0.1",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/all/senshi.js",
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
    return "https://senshi.live";
  }

  getHeaders() {
    return {
      Referer: this.getBaseUrl(),
      Origin: this.getBaseUrl(),
      "User-Agent": "MangaYomi",
    };
  }
  async request(slug, body = {}) {
    var baseUrl = this.getBaseUrl();
    var hdr = this.getHeaders();
    var url = baseUrl + slug;
    var res = null;
    if (slug.includes("/filter")) {
      res = await this.client.post(url, hdr, body);
    } else {
      res = await this.client.get(url, hdr);
    }
    return JSON.parse(res.body);
  }

  animeDetailFormat(item, titlePref) {
    var baseUrl = this.getBaseUrl();

    item = item.hasOwnProperty("anime") ? item.anime : item;
    var romajiTitle = item.title;
    var englishTitle = item.hasOwnProperty("title_english")
      ? item.title_english
      : romajiTitle;
    var name = titlePref == "e" ? englishTitle : romajiTitle;

    var anime_picture = item.anime_picture;
    var imageUrl = baseUrl + anime_picture;

    var link = item.public_id;
    return { name, imageUrl, link };
  }

  async formatList(slug, body, page, perPageLimit) {
    var doc = await this.request(slug, body);

    var titlePref = this.getPreference("senshi_title_lang");

    var totalCount = doc.total;
    var hasNextPage = page <= totalCount / perPageLimit + 1;
    var list = [];

    doc.data.forEach((item) => {
      list.push(this.animeDetailFormat(item, titlePref));
    });
    return { list, hasNextPage };
  }

  async searchAnime({ query = "", sort = "score_desc", page = "1" }) {
    var slug = "/anime/filter";

    var perPageLimit = 30;
    page = parseInt(page);

    var body = {
      "searchTerm": query,
      "page": "" + page,
      "limit": "" + perPageLimit,
      "sortBy": sort,
    };

    return await this.formatList(slug, body, page, perPageLimit);
  }

  async getPopular(page) {
    return await this.searchAnime({ page: page });
  }

  async getLatestUpdates(page) {
    var perPageLimit = 30;
    var slug = `/episode-embeds/latest-paginated?page=${page}&limit=${perPageLimit}`;

    return await this.formatList(slug, {}, page, perPageLimit);
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
          "Not yet aired": 4,
        }[status] ?? 5
      );
    }

    if (url.includes("/watch/")) url = url.split("/watch/")[1].split("/")[0];
    var id = url;

    var baseUrl = this.getBaseUrl();
    var titlePref = this.getPreference("senshi_title_lang");

    var slug = "/anime/" + id;

    var doc = await this.request(slug);
    var animeId = doc.id;
    var returnData = this.animeDetailFormat(doc, titlePref);
    var description = doc.ani_description;
    var status = doc.ani_status;
    var genres = doc.genres.split(", ");
    var type = doc.type;

    var chapters = [];
    if (type == "Movie") {
      var epName = type;
      var epUrl = `${animeId}/1`;
      var isFiller = false;
      var dateUpload = doc.hasOwnProperty("created_at")
        ? new Date(doc.created_at).valueOf().toString()
        : null;

      chapters.push({
        name: epName,
        url: epUrl,
        isFiller,
        dateUpload,
      });
    } else {
      var epslug = `/episodes/${animeId}`;
      doc = await this.request(epslug);
      doc.forEach((item) => {
        var ep_id = item.ep_id;
        var epTitle = item.hasOwnProperty("ep_title") ? item.ep_title : null;
        var epName = epTitle ? `E${ep_id}: ${epTitle}` : `E${ep_id}`;

        var isFiller = item.ep_filler || item.ep_recap;
        var dateUpload = item.hasOwnProperty("created_at")
          ? new Date(item.created_at).valueOf().toString()
          : null;

        var epUrl = `${animeId}/${ep_id}`;

        chapters.push({
          name: epName,
          url: epUrl,
          isFiller,
          dateUpload,
        });
      });
    }
    var link = `${baseUrl}/watch/${id}/1`
    returnData["genre"] = genres;
    returnData["status"] = statusCode(status);
    returnData["description"] = description;
    returnData["link"] = link
    returnData["chapters"] = chapters.reverse();
    return returnData;
  }

  async getVideoList(url) {
    var hdr = this.getHeaders();
    var streams = [];
    var slug = `/episode-embeds/${url}`;
    var doc = await this.request(slug);
    doc.forEach((item) => {
      var link = item.url;
      streams.push({
        url: link,
        originalUrl: link,
        quality: item.status,
        headers: hdr,
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
        key: "senshi_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 0,
          entries: ["English", "Romaji"],
          entryValues: ["e", "r"],
        },
      },
    ];
  }
}
