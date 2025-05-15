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
    "version": "0.0.3",
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

  getHeaders(url) {
    throw new Error("getHeaders not implemented");
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
    var chapters = [];

    var name = result.name;
    var imageUrl = result.poster;

    var description = result.description;
    var genre = result.genre;
    var year = result.year.split("-")[0];

    if (media_type == "series") {
      linkCode = `t${tmdb_id}`;
      var videos = result.videos;
      for (var i in videos) {
        var video = videos[i];
        var seasonNum = video.season;

        if (!seasonNum) continue;

        release = video.released ? new Date(video.released).valueOf() : dateNow;

        if (release < dateNow) {
          var episodeNum = video.episode;
          var name = `S${seasonNum}:E${episodeNum} - ${video.name}`;
          var eplink = {
            name: name,
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
      }
    }

    chapters.reverse();

    var link = `${linkSlug}${linkCode}`;

    return { name, imageUrl, description, genre, link, chapters };
  }

  async getVideoList(url) {
    throw new Error("getVideoList not implemented");
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
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
    ];
  }

  // End.
}
