const mangayomiSources = [
  {
    "name": "Animetsu",
    "id": 2115224012,
    "baseUrl": "https://animetsu.bz",
    "lang": "all",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://animetsu.bz/",
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
    "pkgPath": "anime/src/all/animetsu.js",
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
    return this.getPreference("animetsu_base_url");
  }

  getHeaders(url) {
    url = url != null && url.length > 0 ? url : this.getBaseUrl();
    return {
      "Referer": url,
    };
  }

  getProxyMediaUrl(url) {
    return "https://mega-cloud.top/proxy" + url;
  }

  async request(slug) {
    var baseUrl = this.getBaseUrl();
    var hdr = this.getHeaders(baseUrl);
    var url = baseUrl + "/v2/api/anime" + slug;
    var res = await this.client.get(url, hdr);
    return JSON.parse(res.body);
  }

  async searchAnime({
    query = "",
    sort = "popularity",
    status = "",
    page = "1",
  }) {
    var titlePref = this.getPreference("animetsu_title_lang");

    var slug = "/search/?";
    if (query.length > 0) slug += "query=" + query + "&";
    slug += "sort=" + sort;
    if (status.length > 0) slug += "&status=" + status;
    slug += "&page=" + page;
    slug += "&per_page=20";

    var doc = await this.request(slug);

    var hasNextPage = page != doc.last_page;
    var list = [];
    doc.results.forEach((item) => {
      var romajiTitle = item.title.romaji;
      var prefTitle = item.title[titlePref];

      var name = prefTitle != null ? prefTitle : romajiTitle;
      var link = item.id;
      var imageUrl = item.cover_image.medium;
      list.push({
        name,
        link,
        imageUrl,
      });
    });
    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchAnime({ page: page });
  }

  async getLatestUpdates(page) {
    return await this.searchAnime({
      sort: "date_desc",
      status: "RELEASING",
      page: page,
    });
  }

  async search(query, page, filters) {
    return await this.searchAnime({ query: query, page: page });
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          RELEASING: 0,
          FINISHED: 1,
          NOT_YET_RELEASED: 4,
        }[status] ?? 5
      );
    }

    if (url.includes("/anime/")) url = url.split("/anime/")[1];
    var id = url;

    var baseUrl = this.getBaseUrl();
    var link = baseUrl + "/anime/" + id;

    var infoSlug = "/info/" + id;
    var body = await this.request(infoSlug);

    var titlePref = this.getPreference("animetsu_title_lang");
    var romajiTitle = body.title.romaji;
    var prefTitle = body.title[titlePref];

    var name = prefTitle != null ? prefTitle : romajiTitle;
    var imageUrl = body.cover_image.medium;
    var description = body.description;
    var status = statusCode(body.status);
    var genre = body.genres;
    var format = body.format;

    var chapters = [];
    var epSlug = "/eps/" + id;
    var epData = await this.request(epSlug);

    var epThumbPref = this.getPreference("animetsu_pref_ep_thumbnail");
    var epDescPref = this.getPreference("animetsu_pref_ep_description");
    epData.forEach((item) => {
      var ep_num = item.ep_num;
      var ep_title = item.name;
      var epName = format == "MOVIE" ? ep_title : `E${ep_num} : ${ep_title}`;
      var isFiller = item.is_filler;
      var token = `${id}/${ep_num}`;

      var thumbnailUrl = epThumbPref ? this.getProxyMediaUrl(item.img) : null;
      var epDescription = epDescPref ? item.desc : null;
      var dateUpload = item.hasOwnProperty("aired_at")
        ? new Date(item.aired_at).valueOf().toString()
        : null;

      chapters.push({
        name: epName,
        url: token,
        isFiller,
        thumbnailUrl,
        description: epDescription,
        dateUpload: dateUpload,
      });
    });

    chapters.reverse();
    return { name, imageUrl, link, description, genre, status, chapters };
  }

  async getVideoList(url) {
    var serverPref = this.getPreference("animetsu_pref_stream_server");
    if (serverPref.length < 1) serverPref.push("pahe");

    var audioPref = this.getPreference("animetsu_pref_stream_subdub_type");
    if (audioPref.length < 1) audioPref.push("sub");

    var streams = [];

    for (var serverName of serverPref) {
      for (var audioType of audioPref) {
        var epSlug = `/oppai/${url}?server=${serverName}&source_type=${audioType}`;
        var epData = await this.request(epSlug);

        var serverStreams = [];
        if (epData.hasOwnProperty("sources")) {
          if (serverName == "pahe" || serverName == "meg") {
            serverStreams = this.getPaheMegStreams(
              epData.sources,
              audioType,
              serverName,
            );
          } else if (serverName == "kite") {
            serverStreams = this.getKiteStreams(epData, audioType);
          }
        }

        streams = [...streams, ...serverStreams];
      }
    }

    return streams;
  }

  streamNamer(res, dubType, serverName) {
    return `${res.toUpperCase()} - ${dubType.toUpperCase()} : ${serverName.toUpperCase()}`;
  }

  getPaheMegStreams(epData, audioType, serverName) {
    var hdr = this.getHeaders();
    var streams = [];
    epData.forEach((item) => {
      var quality = item.quality;
      var link = this.getProxyMediaUrl(item.url);
      streams.push({
        url: link,
        originalUrl: link,
        quality: this.streamNamer(quality, audioType, serverName),
        headers: hdr,
      });
    });

    return streams;
  }

  getKiteStreams(epData, audioType) {
    var hdr = this.getHeaders();
    var streams = [];

    epData.sources.forEach((item) => {
      var quality = "Auto";
      var link = this.getProxyMediaUrl(item.url);
      streams.push({
        url: link,
        originalUrl: link,
        quality: this.streamNamer(quality, "soft" + audioType, "kite"),
        headers: hdr,
      });
    });

    var subtitles = [];
    if (epData.hasOwnProperty("subs")) {
      epData.subs.forEach((item) => {
        subtitles.push({
          file: item.url,
          label: item.lang,
          headers: hdr,
        });
      });
    }
    if (streams.length > 0) streams[0]["subtitles"] = subtitles;
    return streams;
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

  getSourcePreferences() {
    return [
      {
        key: "animetsu_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://animetsu.bz",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "animetsu_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 0,
          entries: ["English", "Romaji", "Native"],
          entryValues: ["english", "romaji", "native"],
        },
      },
      {
        key: "animetsu_pref_ep_thumbnail",
        switchPreferenceCompat: {
          title: "Episode thumbail",
          summary: "",
          value: true,
        },
      },
      {
        key: "animetsu_pref_ep_description",
        switchPreferenceCompat: {
          title: "Episode description",
          summary: "",
          value: true,
        },
      },
      {
        key: "animetsu_pref_stream_server",
        multiSelectListPreference: {
          title: "Preferred server",
          summary: "Choose the server/s you want to extract streams from",
          values: ["pahe", "kite", "meg"],
          entries: ["Pahe", "Kite", "Meg"],
          entryValues: ["pahe", "kite", "meg"],
        },
      },
      {
        key: "animetsu_pref_stream_subdub_type",
        multiSelectListPreference: {
          title: "Preferred stream sub/dub type",
          summary: "",
          values: ["sub", "dub"],
          entries: ["Sub", "Dub"],
          entryValues: ["sub", "dub"],
        },
      },
    ];
  }
}
