const mangayomiSources = [
  {
    "name": "XPrime",
    "id": 113063025,
    "baseUrl": "https://xprime.tv",
    "lang": "all",
    "typeSource": "multi",
    "iconUrl":
      "https://raw.github.com/Swakshan/mangayomi-swak-extensions/main/javascript/icon/all.xprime.jpg",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "https://backend.xprime.tv",
    "version": "2.1.2",
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
    var nfsw = this.getPreference("xprime_pref_nfsw_content");
    var api = `https://tmdb.hexa.watch/api/tmdb/${slug}&include_adult=${nfsw}&include_video=false&language=en-us&api_key=84259f99204eeb7d45c7e3d8e36c6123`;
    var response = await new Client().get(api);
    var body = JSON.parse(response.body);
    return body;
  }

  async getSearchItems(body, media_type) {
    var items = [];
    var results = body.results;
    for (let result of results) {
      var id = result.id;
      media_type = media_type || result.media_type;
      items.push({
        name: result.name || result.title,
        imageUrl: "https://image.tmdb.org/t/p/w1280/" + result.poster_path,
        link: `${media_type}||${id}`,
        description: result.description,
        genre: result.genre,
      });
    }
    return items;
  }
  async getHomeInfo(category, page = 1) {
    var media_type = ["movie"];
    var priority = this.getPreference("xprime_pref_content_priority");
    if (priority === "series") {
      media_type.unshift("tv");
    } else {
      media_type.push("tv");
    }
    var list = [];
    var hasNextPage = false;

    for (let mt of media_type) {
      // For latest TV  its "airing today" & for Movies its "now playing".
      if (mt == "tv" && category == "now_playing") category = "airing_today";
      else if (mt == "movie" && category == "airing_today")
        category = "now_playing";
      var body = await this.tmdbRequest(`${mt}/${category}?page=${page}`);
      var mediaList = await this.getSearchItems(body, mt);
      list = [...list, ...mediaList];
      hasNextPage = hasNextPage || body.total_pages > page;
    }

    return {
      list,
      hasNextPage,
    };
  }

  async getPopular(page) {
    return await this.getHomeInfo("popular", page);
  }

  async getLatestUpdates(page) {
    return await this.getHomeInfo("now_playing", page);
  }
  async search(query, page, filters) {
    var body = await this.tmdbRequest(
      `search/multi?query=${query}&page=${page}`
    );
    var list = await this.getSearchItems(body, null);
    var hasNextPage = body.total_pages > page;
    return {
      list,
      hasNextPage,
    };
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

    function chunkArray(array) {
      const result = [];
      var size = 20;
      for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
      }
      return result;
    }

    var baseUrl = this.source.baseUrl;
    var linkSlug = `${baseUrl}/title/`;

    if (url.includes(linkSlug)) {
      url = url.replace(linkSlug, "");
      var id = url.replace("t", "");
      if (url.includes("t")) {
        url = `tv||${id}`;
      } else {
        url = `movie||${id}`;
      }
    }

    var parts = url.split("||");
    var media_type = parts[0];
    var id = parts[1];
    var apiSlug = `${media_type}/${id}`;
    var result = await this.tmdbRequest(
      `${apiSlug}?append_to_response=external_ids`
    );

    var name = result.name || result.title;
    var tmdb_id = result.id;
    var imdb_id = result.external_ids.imdb_id;
    var linkCode = tmdb_id;

    var dateNow = Date.now().valueOf();
    var release_date = result.release_date || result.first_air_date;
    var release = release_date ? new Date(release_date).valueOf() : dateNow;
    var status = 5;
    var description = result.overview;
    var genre = result.genres.map((g) => g.name);

    var year = release_date.split("-")[0];
    var chapters = [];

    if (media_type == "tv") {
      status = statusCode(result.status);
      linkCode = `t${tmdb_id}`;
      var seasonListBatch = chunkArray(
        result.seasons.map((s) => `season/${s.season_number}`)
      );

      for (let batch of seasonListBatch) {
        var seasonList = batch.join(",");
        var apiEpSlug = `${apiSlug}?append_to_response=${seasonList}`;
        result = await this.tmdbRequest(apiEpSlug);
        batch.forEach((season) => {
          var seasonData = result[season];
          seasonData.episodes.forEach((episode) => {
            release = episode.air_date
              ? new Date(episode.air_date).valueOf()
              : dateNow;
            var seasonNum = episode.season_number;
            var epNum = episode.episode_number;

            var epName = `S${seasonNum}:E${epNum} ${episode.name}`;
            var eplink = {
              name: name,
              season: seasonNum,
              episode: epNum,
              year: year,
              tmdb: tmdb_id,
              imdb: imdb_id,
            };
            chapters.push({
              name: epName,
              url: JSON.stringify(eplink),
              dateUpload: release.toString(),
            });
          });
        });
      }
    } else {
      if (release < dateNow) {
        var vidDetails = await this.serverRequest(
          `release?name=${name}&year=${year}`
        );
        var scanlator = vidDetails ? vidDetails.label : null;

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
          scanlator,
        });
      } else {
        status = 4;
      }
    }

    chapters.reverse();

    var link = `${linkSlug}${linkCode}`;

    return { name, status, description, genre, link, chapters };
  }

  async getVideoList(url) {
    var prefServer = this.getPreference("xprime_pref_stream_server_4");
    if (prefServer.length < 1) prefServer = ["primebox"];

    var streams = [];
    var subtitles = [];

    var data = JSON.parse(url);
    data.hdr = this.getHeaders();

    for (var server of prefServer) {
      var serverData = {};
     if (server == "primenet") {
        serverData = await this.primenet(data);
      } else if (server == "phoenix") {
        serverData = await this.phoenix(data);
      } else if (server == "kraken") {
        serverData = await this.kraken(data);
      } else if (server == "harbour") {
        serverData = await this.harbour(data);
      } else if (server == "volkswagen") {
        serverData = await this.volkswagen(data);
      } else if (server == "fendi") {
        serverData = await this.fendi(data);
      } else {
        continue;
      }

      streams = [...streams, ...serverData.streamUrls];
      subtitles = [...subtitles, ...serverData.subtitles];
    }

    if (this.getPreference("xprime_pref_download_server")) {
      var streamUrls = await this.downloadServer(data);
      streams = [...streams, ...streamUrls];
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
        key: "xprime_pref_nfsw_content",
        switchPreferenceCompat: {
          title: "Show NFSW contents",
          summary: "",
          value: true,
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
        key: "xprime_pref_stream_server_4",
        multiSelectListPreference: {
          title: "Preferred server",
          summary: "Choose the server/s you want to extract streams from",
          values: ["primenet", "Phoenix", "Kraken", "Harbour"],
          entries: [
            "Primenet",
            "Phoenix",
            "Kraken",
            "Harbour",
            "Volkswagen - GER",
            "Fendi - FRA",
          ],
          entryValues: [
            "primenet",
            "phoenix",
            "kraken",
            "harbour",
            "volkswagen",
            "fendi",
          ],
        },
      },
      {
        key: "xprime_pref_download_server",
        switchPreferenceCompat: {
          title: "Include download server",
          summary: "",
          value: true,
        },
      },
    ];
  }

  // -------- Servers --------

  async serverRequest(slug) {
    var api = this.source.apiUrl + "/" + slug;
    var req = await this.client.get(api);
    if (req.statusCode == 200) {
      return JSON.parse(req.body);
    } else {
      return null;
    }
  }

  async downloadServer(data) {
    var slug = "servers/downloader";
    slug += "?name=" + data.name;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    } else {
      slug += ` ${data.year}`;
    }
    var streamUrls = [];
    var body = await this.serverRequest(slug);
    if (body) {
      body.results.forEach((item) => {
        var stream = item.download_url;
        var title = item.title;
        var size = item.size;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `${title} (${size})`,
        });
      });
    }
    return streamUrls;
  }

  /*async primebox(data) {
    var serverName = "primebox";
    var hdr = data.hdr;

    var slug = serverName;
    slug += "?name=" + data.name;
    slug += "&fallback_year=" + data.year;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var subtitles = [];
    var body = await this.serverRequest(slug);
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
      if (body.hasOwnProperty("subtitles")) {
        subtitles = body.subtitles ?? subtitles;
      }
    }
    return { streamUrls, subtitles };
  }*/

  async primenet(data) {
    var serverName = "primenet";

    var slug = serverName;
    slug += "?id=" + data.tmdb;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var body = await this.serverRequest(slug);
    if (body) {
      if (body.hasOwnProperty("url")) {
        var stream = body.url;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `Auto : ${serverName}`,
          headers: data.hdr,
        });
      }
    }
    return { streamUrls, subtitles: [] };
  }

  async phoenix(data) {
    var serverName = "phoenix";

    var slug = serverName;
    slug += "?name=" + data.name;
    slug += "&id=" + data.tmdb;
    slug += "&imdb=" + data.imdb;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var subtitles = [];
    var body = await this.serverRequest(slug);
    if (body) {
      if (body.hasOwnProperty("url")) {
        var stream = body.url;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `Auto : ${serverName}`,
          headers: data.hdr,
        });
      }
      if (body.hasOwnProperty("subtitles")) {
        subtitles = body.subtitles ?? subtitles;
      }
    }
    return { streamUrls, subtitles: subtitles };
  }

  async harbour(data) {
    var serverName = "harbour";

    var slug = serverName;
    slug += "?name=" + data.name;
    slug += "&id=" + data.imdb;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var body = await this.serverRequest(slug);
    if (body) {
      if (body.hasOwnProperty("url")) {
        var stream = body.url;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `Auto : ${serverName}`,
          headers: data.hdr,
        });
      }
    }
    return { streamUrls, subtitles: [] };
  }

  async kraken(data) {
    var serverName = "kraken";

    var slug = serverName;
    slug += "?name=" + data.name;
    slug += "&id=" + data.tmdb;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var body = await this.serverRequest(slug);
    if (body) {
      if (body.hasOwnProperty("url")) {
        var stream = body.url;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `Auto : ${serverName}`,
          headers: data.hdr,
        });
      }
    }
    return { streamUrls, subtitles: [] };
  }

  async volkswagen(data) {
    var serverName = "volkswagen";

    var slug = serverName;
    slug += "?name=" + data.name;
    slug += "&id=" + data.imdb;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var body = await this.serverRequest(slug);
    if (body) {
      if (body.status == "ok" && body.hasOwnProperty("streams")) {
        var stream = body.streams.german.url;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `Auto : ${serverName}`,
          headers: data.hdr,
        });
      }
    }
    return { streamUrls, subtitles: [] };
  }

  async fendi(data) {
    var serverName = "fendi";

    var slug = serverName;
    slug += "?name=" + data.name;
    slug += "&id=" + data.tmdb;
    if (data.hasOwnProperty("season")) {
      slug += "&season=" + data.season;
      slug += "&episode=" + data.episode;
    }

    var streamUrls = [];
    var subtitles = [];
    var body = await this.serverRequest(slug);
    if (body) {
      if (body.hasOwnProperty("url")) {
        var stream = body.url;
        streamUrls.push({
          url: stream,
          originalUrl: stream,
          quality: `Auto : ${serverName}`,
          headers: data.hdr,
        });
      }
      if (body.hasOwnProperty("subtitles")) {
        subtitles.forEach((sub) => {
          subtitles.push({
            file: sub.name,
            label: sub.url,
          });
        });
      }
    }
    return { streamUrls, subtitles };
  }

  // Gets subtitles based on TMDB id.
  async getSubtitleList(id, s, e) {
    var api = `https://sub.wyzie.ru/search?id=${id}`;
    var hdr = {};

    if (s != "0") api = `${api}&season=${s}&episode=${e}`;

    var response = await new Client().get(api, hdr);
    if (response.statusCode != 200) return [];

    var body = JSON.parse(response.body);

    var subs = [];
    body.forEach((sub) => {
      subs.push({
        file: sub.url,
        label: sub.display,
      });
    });

    return subs;
  }

  // End.
}
