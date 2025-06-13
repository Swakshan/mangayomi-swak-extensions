const mangayomiSources = [
  {
    "name": "AnimeKai",
    "lang": "en",
    "id": 274675053,
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.3.1",
    "pkgPath": "anime/src/en/animekai.js",
  },
];

// Authors: - Swakshan

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  getBaseUrl() {
    return this.getPreference("animekai_base_url");
  }

  async request(slug) {
    var url = slug;
    var baseUrl = this.getBaseUrl();
    if (!slug.includes(baseUrl)) url = baseUrl + slug;
    var res = await this.client.get(url);
    return res.body;
  }

  async getPage(slug) {
    var res = await this.request(slug);
    return new Document(res);
  }

  async searchPage({
    query = "",
    type = [],
    genre = [],
    status = [],
    sort = "",
    season = [],
    year = [],
    rating = [],
    country = [],
    language = [],
    page = 1,
  } = {}) {
    function bundleSlug(category, items) {
      var rd = "";
      for (var item of items) {
        rd += `&${category}[]=${item.toLowerCase()}`;
      }
      return rd;
    }

    var slug = "/browser?";

    slug += "keyword=" + query;
    slug += bundleSlug("type", type);
    slug += bundleSlug("genre", genre);
    slug += bundleSlug("status", status);
    slug += bundleSlug("status", status);
    slug += bundleSlug("season", season);
    slug += bundleSlug("year", year);
    slug += bundleSlug("rating", rating);
    slug += bundleSlug("country", country);
    slug += bundleSlug("language", language);
    sort = sort.length < 1 ? "updated_date" : sort; // default sort is updated date
    slug += "&sort=" + sort;
    slug += `&page=${page}`;

    var list = [];

    var body = await this.getPage(slug);

    var paginations = body.select(".pagination > li");
    var hasNextPage =
      paginations.length > 0
        ? !paginations[paginations.length - 1].className.includes("active")
        : false;

    var titlePref = this.getPreference("animekai_title_lang");
    var animes = body.selectFirst(".aitem-wrapper").select(".aitem");
    animes.forEach((anime) => {
      var link = anime.selectFirst("a").getHref;
      var imageUrl = anime.selectFirst("img").attr("data-src");
      var name = anime.selectFirst("a.title").attr(titlePref);
      list.push({ name, link, imageUrl });
    });

    return { list, hasNextPage };
  }

  async getPopular(page) {
    var types = this.getPreference("animekai_popular_latest_type");
    return await this.searchPage({ sort: "trending", type: types, page: page });
  }

  async getLatestUpdates(page) {
    var types = this.getPreference("animekai_popular_latest_type");
    return await this.searchPage({
      sort: "updated_date",
      type: types,
      page: page,
    });
  }

  async search(query, page, filters) {
    function getFilter(state) {
      var rd = [];
      state.forEach((item) => {
        if (item.state) {
          rd.push(item.value);
        }
      });
      return rd;
    }
    var isFiltersAvailable = !filters || filters.length != 0;
    var type = isFiltersAvailable ? getFilter(filters[0].state) : [];
    var genre = isFiltersAvailable ? getFilter(filters[1].state) : [];
    var status = isFiltersAvailable ? getFilter(filters[2].state) : [];
    var sort = isFiltersAvailable
      ? filters[3].values[filters[3].state].value
      : "";
    var season = isFiltersAvailable ? getFilter(filters[4].state) : [];
    var year = isFiltersAvailable ? getFilter(filters[5].state) : [];
    var rating = isFiltersAvailable ? getFilter(filters[6].state) : [];
    var country = isFiltersAvailable ? getFilter(filters[7].state) : [];
    var language = isFiltersAvailable ? getFilter(filters[8].state) : [];
    return await this.searchPage({
      query,
      type,
      genre,
      status,
      sort,
      season,
      year,
      rating,
      country,
      language,
      page,
    });
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          Releasing: 0,
          Completed: 1,
          "Not Yet Aired": 4,
        }[status] ?? 5
      );
    }
    var baseUrl = this.getBaseUrl();

    var slug = url.replace(baseUrl, "");
    var link = baseUrl + slug;
    var body = await this.getPage(slug);

    var mainSection = body.selectFirst(".watch-section");

    var imageUrl = mainSection
      .selectFirst("div.poster")
      .selectFirst("img").getSrc;

    var namePref = this.getPreference("animekai_title_lang");
    var nameSection = mainSection.selectFirst("div.title");
    var name = namePref.includes("jp")
      ? nameSection.attr(namePref)
      : nameSection.text;

    var description = mainSection.selectFirst("div.desc").text;

    var detailSection = mainSection.select("div.detail > div");

    var genre = [];
    var status = 5;
    detailSection.forEach((item) => {
      var itemText = item.text.trim();

      if (itemText.includes("Genres")) {
        genre = itemText.replace("Genres:  ", "").split(", ");
      }
      if (itemText.includes("Status")) {
        var statusText = item.selectFirst("span").text;
        status = statusCode(statusText);
      }
    });

    var chapters = [];
    var animeId = body.selectFirst("#anime-rating").attr("data-id");

    var token = await this.kaiEncrypt(animeId);
    var res = await this.request(
      `/ajax/episodes/list?ani_id=${animeId}&_=${token}`
    );
    body = JSON.parse(res);
    if (body.status == 200) {
      var doc = new Document(body["result"]);
      var episodes = doc.selectFirst("div.eplist.titles").select("li");
      var showUncenEp = this.getPreference("animekai_show_uncen_epsiodes");

      for (var item of episodes) {
        var aTag = item.selectFirst("a");

        var num = parseInt(aTag.attr("num"));
        var title = aTag.selectFirst("span").text;
        title = title.includes("Episode") ? "" : `: ${title}`;
        var epName = `Episode ${num}${title}`;

        var langs = aTag.attr("langs");
        var scanlator = langs === "1" ? "SUB" : "SUB, DUB";

        var token = aTag.attr("token");

        var epData = {
          name: epName,
          url: token,
          scanlator,
        };

        // Check if the episode is uncensored
        var slug = aTag.attr("slug");
        if (slug.includes("uncen")) {
          // if dont show uncensored episodes, skip this episode
          if (!showUncenEp) continue;

          scanlator += ", UNCENSORED";
          epName = `Episode ${num}: (Uncensored)`;
          // Build for uncensored episode
          epData = {
            name: epName,
            url: token,
            scanlator,
          };

          // Check if the episode already exists as censored if so, add to existing data
          var exData = chapters[num - 1];
          if (exData) {
            exData.url += "||" + epData.url;
            exData.scanlator += ", " + epData.scanlator;
            chapters[num - 1] = exData;
            continue;
          }
        }
        chapters.push(epData);
      }
    }
    chapters.reverse();
    return { name, imageUrl, link, description, genre, status, chapters };
  }

  // For anime episode video list
  async getVideoList(url) {
    var streams = [];
    var prefServer = this.getPreference("animekai_pref_stream_server");
    // If no server is chosen, use the default server 1
    if (prefServer.length < 1) prefServer.push("1");

    var prefDubType = this.getPreference("animekai_pref_stream_subdub_type");
    // If no dubtype is chosen, use the default dubtype sub
    if (prefDubType.length < 1) prefDubType.push("sub");

    var epSlug = url.split("||");

    // The 1st time the loop runs its for censored version
    var isUncensoredVersion = false;
    for (var epId of epSlug) {
      var token = await this.kaiEncrypt(epId);
      var res = await this.request(`/ajax/links/list?token=${epId}&_=${token}`);
      var body = JSON.parse(res);
      if (body.status != 200) continue;

      var serverResult = new Document(body.result);

      // [{"serverName":"Server 1","dataId":"","dubType":"sub"},{"serverName":"Server 2","dataId":"","dubType":"softsub"}]
      var SERVERDATA = [];
      // Gives 2 server for each Sub, softsub, dub
      var server_items = serverResult.select("div.server-items");

      for (var dubSection of server_items) {
        var dubType = dubSection.attr("data-id");
        // If dubtype is not in preference dont include it
        if (!prefDubType.includes(dubType)) continue;

        for (var ser of dubSection.select("span.server")) {
          var serverName = ser.text;
          // If servername is not in preference dont include it
          if (!prefServer.includes(serverName.replace("Server ", ""))) continue;

          var dataId = ser.attr("data-lid");
          SERVERDATA.push({
            serverName,
            dataId,
            dubType,
          });
        }
      }

      for (var serverData of SERVERDATA) {
        var serverName = serverData.serverName;
        var dataId = serverData.dataId;
        var dubType = serverData.dubType.toUpperCase();
        dubType = dubType == "SUB" ? "HARDSUB" : dubType;
        dubType = isUncensoredVersion ? `${dubType} [Uncensored]` : dubType;

        var megaUrl = await this.getMegaUrl(dataId);
        var serverStreams = await this.decryptMegaEmbed(
          megaUrl,
          serverName,
          dubType
        );
        streams = [...streams, ...serverStreams];

        // Dubs have subtitles separately, so we need to fetch them too
        if (dubType.includes("DUB")) {
          if (!megaUrl.includes("sub.list=")) continue;
          var subList = megaUrl.split("sub.list=")[1];

          var subres = await this.client.get(subList);
          var subtitles = JSON.parse(subres.body);
          var subs = this.formatSubtitles(subtitles, dubType);
          streams[streams.length - 1].subtitles = subs;
        }
      }
      // The 2nd time the loop runs its for uncensored version
      isUncensoredVersion = true;
      // Main for ends
    }

    return streams;
  }

  getFilterList() {
    function formateState(type_name, items, values) {
      var state = [];
      for (var i = 0; i < items.length; i++) {
        state.push({ type_name: type_name, name: items[i], value: values[i] });
      }
      return state;
    }

    var filters = [];

    // Types
    var items = ["TV", "Special", "OVA", "ONA", "Music", "Movie"];
    var values = ["tv", "special", "ova", "ona", "music", "movie"];
    filters.push({
      type_name: "GroupFilter",
      name: "Types",
      state: formateState("CheckBox", items, values),
    });

    // Genre
    items = [
      "Action",
      "Adventure",
      "Avant Garde",
      "Boys Love",
      "Comedy",
      "Demons",
      "Drama",
      "Ecchi",
      "Fantasy",
      "Girls Love",
      "Gourmet",
      "Harem",
      "Horror",
      "Isekai",
      "Iyashikei",
      "Josei",
      "Kids",
      "Magic",
      "Mahou Shoujo",
      "Martial Arts",
      "Mecha",
      "Military",
      "Music",
      "Mystery",
      "Parody",
      "Psychological",
      "Reverse Harem",
      "Romance",
      "School",
      "Sci-Fi",
      "Seinen",
      "Shoujo",
      "Shounen",
      "Slice of Life",
      "Space",
      "Sports",
      "Super Power",
      "Supernatural",
      "Suspense",
      "Thriller",
      "Vampire",
    ];

    values = [
      "47",
      "1",
      "235",
      "184",
      "7",
      "127",
      "66",
      "8",
      "34",
      "926",
      "436",
      "196",
      "421",
      "77",
      "225",
      "555",
      "35",
      "78",
      "857",
      "92",
      "219",
      "134",
      "27",
      "48",
      "356",
      "240",
      "798",
      "145",
      "9",
      "36",
      "189",
      "183",
      "37",
      "125",
      "220",
      "10",
      "350",
      "49",
      "322",
      "241",
      "126",
    ];

    filters.push({
      type_name: "GroupFilter",
      name: "Genres",
      state: formateState("CheckBox", items, values),
    });

    // Status
    items = ["Not Yet Aired", "Releasing", "Completed"];
    values = ["info", "releasing", "completed"];
    filters.push({
      type_name: "GroupFilter",
      name: "Status",
      state: formateState("CheckBox", items, values),
    });

    // Sort
    items = [
      "All",
      "Updated date",
      "Released date",
      "End date",
      "Added date",
      "Trending",
      "Name A-Z",
      "Average score",
      "MAL score",
      "Total views",
      "Total bookmarks",
      "Total episodes",
    ];

    values = [
      "",
      "updated_date",
      "released_date",
      "end_date",
      "added_date",
      "trending",
      "title_az",
      "avg_score",
      "mal_score",
      "total_views",
      "total_bookmarks",
      "total_episodes",
    ];
    filters.push({
      type_name: "SelectFilter",
      name: "Sort by",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Season
    items = ["Fall", "Summer", "Spring", "Winter", "Unknown"];
    values = ["fall", "summer", "spring", "winter", "unknown"];
    filters.push({
      type_name: "GroupFilter",
      name: "Season",
      state: formateState("CheckBox", items, values),
    });

    // Years
    const currentYear = new Date().getFullYear();
    var years = Array.from({ length: currentYear - 1999 }, (_, i) =>
      (2000 + i).toString()
    ).reverse();
    items = [
      ...years,
      "1990s",
      "1980s",
      "1970s",
      "1960s",
      "1950s",
      "1940s",
      "1930s",
      "1920s",
      "1910s",
      "1900s",
    ];
    filters.push({
      type_name: "GroupFilter",
      name: "Years",
      state: formateState("CheckBox", items, items),
    });

    // Ratings
    items = [
      "G - All Ages",
      "PG - Children",
      "PG 13 - Teens 13 and Older",
      "R - 17+, Violence & Profanity",
      "R+ - Profanity & Mild Nudity",
      "Rx - Hentai",
    ];

    values = ["g", "pg", "pg_13", "r", "r+", "rx"];
    filters.push({
      type_name: "GroupFilter",
      name: "Ratings",
      state: formateState("CheckBox", items, items),
    });

    // Country
    items = ["Japan", "China"];
    values = ["11", "2"];
    filters.push({
      type_name: "GroupFilter",
      name: "Country",
      state: formateState("CheckBox", items, items),
    });

    // Language
    items = ["Hard Sub", "Soft Sub", "Dub", "Sub & Dub"];
    values = ["sub", "softsub", "dub", "subdub"];
    filters.push({
      type_name: "GroupFilter",
      name: "Language",
      state: formateState("CheckBox", items, items),
    });

    return filters;
  }

  getSourcePreferences() {
    return [
      {
        key: "animekai_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://animekai.to",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "animekai_popular_latest_type",
        multiSelectListPreference: {
          title:
            "Preferred type of anime to be shown in popular & latest section",
          summary:
            "Choose which type of anime you want to see in the popular &latest section",
          values: ["tv", "special", "ova", "ona"],
          entries: ["TV", "Special", "OVA", "ONA", "Music", "Movie"],
          entryValues: ["tv", "special", "ova", "ona", "music", "movie"],
        },
      },
      {
        key: "animekai_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 1,
          entries: ["English", "Romaji"],
          entryValues: ["title", "data-jp"],
        },
      },
      {
        key: "animekai_show_uncen_epsiodes",
        switchPreferenceCompat: {
          title: "Show uncensored episodes",
          summary: "",
          value: true,
        },
      },
      {
        key: "animekai_pref_stream_server",
        multiSelectListPreference: {
          title: "Preferred server",
          summary: "Choose the server/s you want to extract streams from",
          values: ["1"],
          entries: ["Server 1", "Server 2"],
          entryValues: ["1", "2"],
        },
      },
      {
        key: "animekai_pref_stream_subdub_type",
        multiSelectListPreference: {
          title: "Preferred stream sub/dub type",
          summary: "",
          values: ["sub", "softsub", "dub"],
          entries: ["Hard Sub", "Soft Sub", "Dub"],
          entryValues: ["sub", "softsub", "dub"],
        },
      },
      {
        key: "animekai_pref_extract_streams",
        switchPreferenceCompat: {
          title: "Split stream into different quality streams",
          summary: "Split stream Auto into 360p/720p/1080p",
          value: true,
        },
      },
    ];
  }

  // -------------------------------
  formatSubtitles(subtitles, dubType) {
    var subs = [];
    subtitles.forEach((sub) => {
      if (!sub.kind.includes("thumbnail")) {
        subs.push({
          file: sub.file,
          label: `${sub.label} - ${dubType}`,
        });
      }
    });

    return subs;
  }

  async formatStreams(sUrl, serverName, dubType) {
    function streamNamer(res) {
      return `${res} - ${dubType} : ${serverName}`;
    }

    var streams = [
      {
        url: sUrl,
        originalUrl: sUrl,
        quality: streamNamer("Auto"),
      },
    ];

    var pref = this.getPreference("animekai_pref_extract_streams");
    if (!pref) return streams;

    var baseUrl = sUrl.split("/list.m3u8")[0].split("/list,")[0];

    const response = await new Client().get(sUrl);
    const body = response.body;
    const lines = body.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
        var resolution = lines[i].match(/RESOLUTION=(\d+x\d+)/)[1];
        var qUrl = lines[i + 1].trim();
        var m3u8Url = `${baseUrl}/${qUrl}`;
        streams.push({
          url: m3u8Url,
          originalUrl: m3u8Url,
          quality: streamNamer(resolution),
        });
      }
    }
    return streams;
  }

  async getMegaUrl(vidId) {
    var token = await this.kaiEncrypt(vidId);
    var res = await this.request(`/ajax/links/view?id=${vidId}&_=${token}`);
    var body = JSON.parse(res);
    if (body.status != 200) return;
    var outEnc = body.result;
    var out = await this.kaiDecrypt(outEnc);
    var o = JSON.parse(out);
    return decodeURIComponent(o.url);
  }

  async decryptMegaEmbed(megaUrl, serverName, dubType) {
    var streams = [];
    megaUrl = megaUrl.replace("/e/", "/media/");
    var res = await this.client.get(megaUrl);
    var body = JSON.parse(res.body);
    if (body.status != 200) return;
    var outEnc = body.result;
    var streamData = await this.megaDecrypt(outEnc);
    var url = streamData.sources[0].file;

    var streams = await this.formatStreams(url, serverName, dubType);

    var subtitles = streamData.tracks;
    streams[0].subtitles = this.formatSubtitles(subtitles, dubType);
    return streams;
  }

  //----------------AnimeKai Decoders----------------
  // Credits :- https://github.com/phisher98/cloudstream-extensions-phisher/

  async patternExecutor(key, type, data) {
    var api = "https://gvm-kai001.amarullz.com/";
    var url = `${api}?f=${type}`;
    if (key == "kai") {
      var url = `${url}&d=${data}`;
      var res = await this.client.get(url);
      return res.body;
    } else {
      var res = await this.client.post(url, {}, data);
      return res.body;
    }
  }

  async kaiEncrypt(id) {
    var token = await this.patternExecutor("kai", "e", id);
    return token;
  }

  async kaiDecrypt(id) {
    var token = await this.patternExecutor("kai", "d", id);
    return token;
  }

  async megaDecrypt(data) {
    var streamData = await this.patternExecutor("megaup", "m", data);
    return JSON.parse(streamData);
  }
}
