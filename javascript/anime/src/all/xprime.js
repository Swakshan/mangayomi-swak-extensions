const mangayomiSources = [
  {
    "name": "XPrime",
    "id": 113063025,
    "baseUrl": "https://xprime.tv",
    "lang": "all",
    "typeSource": "multi",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://xprime.tv/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "https://backend.xprime.tv",
    "version": "0.0.7",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/all/xprime.js",
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
    var baseUrl = this.source.baseUrl;
    return {
      Reference: baseUrl,
      Origin: baseUrl,
    };
  }

  async tmdbRequest(slug) {
    var api = `https://94c8cb9f702d-tmdb-addon.baby-beamup.club/${slug}`;
    var response = await new Client().get(api);
    var body = JSON.parse(response.body);
    return body;
  }

  async getSearchItems(body) {
    var items = [];
    var results = body.metas;
    for (let i in results) {
      var result = results[i];
      var id = result.id;
      var media_type = result.type;
      items.push({
        name: result.name,
        imageUrl: result.poster,
        link: `${media_type}||${id}`,
        description: result.description,
        genre: result.genre,
      });
    }
    return items;
  }
  async getSearchInfo(slug) {
    var body = await this.tmdbRequest(`catalog/movie/${slug}`);
    var popMovie = await this.getSearchItems(body);

    body = await this.tmdbRequest(`catalog/series/${slug}`);
    var popSeries = await this.getSearchItems(body);

    var fullList = [];

    var priority = this.getPreference("xprime_pref_content_priority");
    if (priority === "series") {
      fullList = [...popSeries, ...popMovie];
    } else {
      fullList = [...popMovie, ...popSeries];
    }
    var hasNextPage = slug.indexOf("search=") > -1 ? false : true;
    return {
      list: fullList,
      hasNextPage,
    };
  }

  async getPopular(page) {
    var skip = (page - 1) * 20;
    return await this.getSearchInfo(`tmdb.popular/skip=${skip}.json`);
  }

  async getLatestUpdates(page) {
    var trend_window = this.getPreference("xprime_pref_latest_time_window");
    var skip = (page - 1) * 20;
    return await this.getSearchInfo(
      `tmdb.trending/genre=${trend_window}&skip=${skip}.json`
    );
  }
  async search(query, page, filters) {
    return await this.getSearchInfo(`tmdb.popular/search=${query}.json`);
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          "Returning Series": 0,
          "Ended": 1,
          "In Production": 4,
        }[status] ?? 5
      );
    }

    var baseUrl = this.source.baseUrl;
    var linkSlug = `${baseUrl}/title/`;

    if (url.includes(linkSlug)) {
      url = url.replace(linkSlug, "");
      var id = url.replace("t", "");
      if (url.includes("t")) {
        url = `series||tmdb:${id}`;
      } else {
        url = `movie||tmdb:${id}`;
      }
    }

    var parts = url.split("||");
    var media_type = parts[0];
    var id = parts[1];
    var body = await this.tmdbRequest(`meta/${media_type}/${id}.json`);
    var result = body.meta;

    var tmdb_id = id.substring(5);
    var imdb_id = result.imdb_id;
    var linkCode = tmdb_id;

    var dateNow = Date.now().valueOf();
    var release = result.released
      ? new Date(result.released).valueOf()
      : dateNow;
    var status = 5;

    var chapters = [];

    var name = result.name;
    var imageUrl = result.poster;

    var description = result.description;
    var genre = result.genre;
    var year = result.year.split("-")[0];

    if (media_type == "series") {
      status = statusCode(result.status);
      linkCode = `t${tmdb_id}`;
      var videos = result.videos;
      for (var i in videos) {
        var video = videos[i];
        var seasonNum = video.season;

        if (!seasonNum) continue;

        release = video.released ? new Date(video.released).valueOf() : dateNow;

        if (release < dateNow) {
          var episodeNum = video.episode;
          var epName = `S${seasonNum}:E${episodeNum} - ${video.name}`;
          var eplink = {
            name: epName,
            season: seasonNum,
            episode: episodeNum,
            year: year,
            tmdb: tmdb_id,
            imdb: imdb_id,
          };

          chapters.push({
            name: name,
            url: JSON.stringify(eplink),
            dateUpload: release.toString(),
          });
        }
      }
    } else {
      if (release < dateNow) {
        status = 1;
        var eplink = {
          name: name,
          year: year,
          tmdb: tmdb_id,
          imdb: imdb_id,
        };
        chapters.push({
          name: "Movie",
          url: JSON.stringify(eplink),
          dateUpload: release.toString(),
        });
      } else {
        status = 4;
      }
    }

    chapters.reverse();

    var link = `${linkSlug}${linkCode}`;

    return { name, imageUrl, status, description, genre, link, chapters };
  }

  async serverRequest(slug, hdr) {
    var api = this.source.apiUrl + "/" + slug;
    var req = await this.client.get(api, hdr);
    if (req.statusCode == 200) {
      return JSON.parse(req.body);
    } else {
      return null;
    }
  }

  async primebox(data) {
    var serverName = "primebox";
    var hdr = this.getHeaders();

    var slug = serverName;
    slug += "?name=" + data.name;
    slug += "&fallback_year=" + data.year;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var subtitles = [];
    var body = await this.serverRequest(slug, hdr);
    if (body) {
      if (body.hasOwnProperty("available_qualities")) {
        var streams = body.streams;
        var available_qualities = body.available_qualities;
        for (var quality of available_qualities) {
          var stream = streams[quality];
          streamUrls.push({
            url: stream,
            originalUrl: stream,
            quality: `${quality} : ${serverName}`,
            headers: hdr,
          });
        }
      }
      subtitles = body.subtitles;
    }
    return { streamUrls, subtitles };
  }

  async primenet(data) {
    var serverName = "primenet";
    var hdr = this.getHeaders();

    var slug = serverName;
    slug += "?id=" + data.tmdb;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var body = await this.serverRequest(slug, hdr);
    if (body) {
      if (body.hasOwnProperty("url")) {
        var stream = body.url;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `Auto : ${serverName}`,
          headers: hdr,
        });
      }
    }
    return { streamUrls, subtitles: [] };
  }

  async harbour(data) {
    var serverName = "harbour";
    var hdr = this.getHeaders();

    var slug = serverName;
    slug += "?name=" + data.name;
    slug += "&id=" + data.imdb;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var body = await this.serverRequest(slug, hdr);
    if (body) {
      if (body.hasOwnProperty("url")) {
        var stream = body.url;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `Auto : ${serverName}`,
          headers: hdr,
        });
      }
    }
    return { streamUrls, subtitles: [] };
  }

  async volkswagen(data) {
    var serverName = "volkswagen";
    var hdr = this.getHeaders();

    var slug = serverName;
    slug += "?name=" + data.name;
    slug += "&id=" + data.imdb;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var body = await this.serverRequest(slug, hdr);
    if (body) {
      if (body.hasOwnProperty("streams")) {
        var stream = body.streams.german.url;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `Auto : ${serverName}`,
          headers: hdr,
        });
      }
    }
    return { streamUrls, subtitles: [] };
  }

  // Gets subtitles based on TMDB id.
  async getSubtitleList(id, s, e) {
    var api = `https://sub.wyzie.ru/search?id=${id}`;
    var hdr = {};

    if (s != "0") api = `${api}&season=${s}&episode=${e}`;

    var response = await new Client().get(api, hdr);
    var body = JSON.parse(response.body);

    var subs = [];
    for (var sub of body) {
      subs.push({
        file: sub.url,
        label: sub.display,
      });
    }

    return subs;
  }

  async getVideoList(url) {
    var prefServer = this.getPreference("xprime_pref_stream_server");
    if (prefServer.length < 1) prefServer = ["primebox"];

    var streams = [];
    var subtitles = [];

    var data = JSON.parse(url);
    for (var server of prefServer) {
      var serverData = {};
      if (server == "primebox") {
        serverData = await this.primebox(data);
      } else if (server == "primenet") {
        serverData = await this.primenet(data);
      } else if (server == "harbour") {
        serverData = await this.harbour(data);
      } else if (server == "volkswagen") {
        serverData = await this.volkswagen(data);
      }

      streams = [...streams, ...serverData.streamUrls];
      subtitles = [...subtitles, ...serverData.subtitles];
    }

    if (streams.length < 1)
      throw new Error("No streams found from any selected servers");

    if (subtitles.length < 1) {
      var tmdb = data.tmdb;
      var s = 0;
      var e = 0;
      if (data.hasOwnProperty("season")) {
        s = data.season;
        e = data.episode;
      }
      subtitles = await this.getSubtitleList(tmdb, s, e);
    }

    streams[0].subtitles = subtitles;

    return streams;
  }

  getSourcePreferences() {
    return [
      {
        key: "xprime_pref_latest_time_window",
        listPreference: {
          title: "Preferred latest trend time window",
          summary: "",
          valueIndex: 0,
          entries: ["Day", "Week"],
          entryValues: ["day", "week"],
        },
      },
      {
        key: "xprime_pref_content_priority",
        listPreference: {
          title: "Preferred content priority",
          summary: "Choose which type of content to show first",
          valueIndex: 0,
          entries: ["Movies", "Series"],
          entryValues: ["movies", "series"],
        },
      },
      {
        key: "xprime_pref_stream_server",
        multiSelectListPreference: {
          title: "Preferred server",
          summary: "Choose the server/s you want to extract streams from",
          values: ["primebox", "primenet", "harbour"],
          entries: ["Primebox", "Primenet", "Harbour", "Volkswagen"],
          entryValues: ["primebox", "primenet", "harbour", "volkswagen"],
        },
      },
    ];
  }

  // End.
}
