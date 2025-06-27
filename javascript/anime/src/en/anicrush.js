const mangayomiSources = [
  {
    "name": "Anicrush",
    "id": 1497004903,
    "baseUrl": "https://anicrush.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://anicrush.to/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": true,
    "sourceCodeUrl": "",
    "apiUrl": "https://api.anicrush.to",
    "version": "0.0.5",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/en/anicrush.js",
  },
];
class DefaultExtension extends MProvider {
  constructor() {
    super();
  }

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  getHeaders(url) {
    return {
      "x-site": "anicrush",
      "Referer": url,
      "Origin": url,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.48 Safari/537.36",
    };
  }

  async request(url) {
    var res = await new Client().get(url, this.getHeaders(url));
    if (res.statusCode != 200) return false;
    return JSON.parse(res.body);
  }

  async aniRequest(slug) {
    var url = `${this.source.apiUrl}/shared/v2/${slug}`;
    return await this.request(url);
  }

  getPosterUrl(slug) {
    var s = slug.split("/").pop().split(".");
    var filename = ""
      .concat(s[0].split("").reverse().join(""), ".")
      .concat(s[1]);
    return `https://static.gniyonna.com/media/poster/480x720/100/${filename}`;
  }

  async searchPage({
    query = "",
    type = "0",
    status = "0",
    country = "",
    language = "0",
    rating = "0",
    season = "0",
    score = "",
    sort = "recently_updated",
    years = [],
    genre = [],
    page = 1,
  }) {
    function statusCode(status) {
      return (
        {
          "2": 0,
          "1": 1,
          "3": 4,
        }[status] ?? 5
      );
    }

    function bundleSlug(category, item) {
      var rd = item.length > 0 && item != "0" ? `&${category}=${item}` : "";
      return rd;
    }

    var slug = `movie/list?page=${page}`;
    slug += bundleSlug("limit", 25);

    if (query.length > 0) {
      slug += bundleSlug("keyword", query);
    } else {
      slug += bundleSlug("type", type);
      slug += bundleSlug("status", status);
      slug += bundleSlug("country", country);
      slug += bundleSlug("language", language);
      slug += bundleSlug("ratingType", rating);
      slug += bundleSlug("season", season);
      slug += bundleSlug("score", score);
      slug += bundleSlug("sortBy", sort);
      slug += bundleSlug("years", years.join("%2C"));
      slug += bundleSlug("genres", genre.join("%2C"));
    }

    var body = await this.aniRequest(slug);
    var result = body.result;
    var list = [];
    var hasNextPage = result.totalPages > page;

    var animeTitlePref = parseInt(
      this.getPreference("anicrush_anime_title_lang")
    );

    result.movies.forEach((item) => {
      var name = item.name;
      name =
        animeTitlePref == 0 && item.hasOwnProperty("name_english")
          ? item.name_english
          : name;
      var imageUrl = this.getPosterUrl(item.poster_path);
      var link = item.id;
      var status = statusCode(item.airing_status);
      var genre = [];
      item.genres.forEach((genreItem) => genre.push(genreItem.name));

      list.push({
        name,
        imageUrl,
        link,
        status,
        genre,
      });
    });

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchPage({ page: page, sort: "most_watched" });
  }

  async getLatestUpdates(page) {
    return await this.searchPage({ page: page, sort: "recently_updated" });
  }

  async search(query, page, filters) {
    function getCheckBox(state) {
      var rd = [];
      state.forEach((item) => {
        if (item.state) {
          rd.push(item.value);
        }
      });
      return rd;
    }
    function getSelectFilter(filter) {
      var selectValue = filter.state;
      var values = filter.values;
      var selectValue = values[selectValue]["value"];
      return selectValue;
    }

    var isFiltersAvailable = !filters || filters.length != 0;
    var defVal = "0";
    var types = isFiltersAvailable ? getSelectFilter(filters[0]) : defVal;
    var status = isFiltersAvailable ? getSelectFilter(filters[1]) : defVal;
    var country = isFiltersAvailable ? getSelectFilter(filters[2]) : "";
    var language = isFiltersAvailable ? getSelectFilter(filters[3]) : defVal;
    var ratings = isFiltersAvailable ? getSelectFilter(filters[4]) : defVal;
    var season = isFiltersAvailable ? getSelectFilter(filters[5]) : defVal;
    var score = isFiltersAvailable ? getSelectFilter(filters[6]) : "";
    var sort = isFiltersAvailable
      ? getSelectFilter(filters[7])
      : "recently_updated";
    var years = isFiltersAvailable ? getCheckBox(filters[8].state) : [];
    var genre = isFiltersAvailable ? getCheckBox(filters[9].state) : [];

    return await this.searchPage({
      query,
      types,
      status,
      country,
      language,
      ratings,
      season,
      score,
      sort,
      years,
      genre,
      page,
    });
  }

  async getDetail(url) {
    var baseUrl = this.source.baseUrl;
    if (url.includes(baseUrl)) url = url.split(".")[2];
    var animeId = url;
    var slug = `movie/getById/${animeId}`;
    var body = await this.aniRequest(slug);
    var result = body.result;
    var link = `${baseUrl}/detail/${result.slug}.${animeId}`;
    var description = result.overview;
    var type = result.type;
    var airing_status = result.airing_status;
    var imageUrl = this.getPosterUrl(result.poster_path);
    var chapters = [];

    // 1 ==  Completed and 2 == Airing
    if (airing_status < 3) {
      var latest_episode_sub = result.latest_episode_sub;
      var latest_episode_dub = result.latest_episode_dub;

      if (type == "Movie") {
        var scanlator = "";
        var epNum = 1;
        var hasDub = epNum <= latest_episode_dub;
        if (epNum <= latest_episode_sub) scanlator += "SUB";
        if (hasDub) scanlator += ", DUB";
        var epData = `${animeId}||${epNum}||${hasDub}`;
        chapters.push({
          name: `Movie`,
          url: epData,
          scanlator,
        });
      } else {
        var animeEpTitlePref = parseInt(
          this.getPreference("anicrush_episode_title_lang")
        );
        var epSlug = `episode/list?_movieId=${animeId}`;
        body = await this.aniRequest(epSlug);
        result = body.result;
        Object.keys(result).forEach((range) => {
          result[range].forEach((chapterData) => {
            var title = chapterData.name;
            title =
              animeEpTitlePref == 0 &&
              chapterData.hasOwnProperty("name_english")
                ? chapterData.name_english
                : title;
            var epNum = chapterData.number;
            var scanlator = "";
            var hasDub = epNum <= latest_episode_dub;
            if (chapterData.is_filler) scanlator += "FILLER,";
            if (epNum <= latest_episode_sub) scanlator += "SUB";
            if (hasDub) scanlator += ", DUB";
            var epData = `${animeId}||${epNum}||${hasDub}`;
            chapters.push({
              name: `E${epNum}: ${title}`,
              url: epData,
              scanlator,
            });
          });
        });
      }
      chapters.reverse();
    }
    return { link, imageUrl, description, chapters };
  }

  async getVideoList(url) {
    var sp = url.split("||");
    var animeId = sp[0];
    var epNum = sp[1];
    var hasDub = sp[2].toLowerCase() === "true";

    var prefServers = this.getPreference("anicrush_pref_stream_server");
    // If no server is chosen, use the default server 1
    if (prefServers.length < 1) prefServers.push("1");

    var prefAudio = this.getPreference("anicrush_pref_stream_subdub_type");
    // If no dubtype is chosen, use the default dubtype sub
    if (prefAudio.length < 1) prefAudio.push("sub");
    var streams = [];
    for (var server of prefServers) {
      for (var audio of prefAudio) {
        var slug = `episode/sources?_movieId=${animeId}&ep=${epNum}&sv=${server}&sc=${audio}`;
        var body = await this.aniRequest(slug);
        if (!body) continue;
        var embedUrl = body.result.link;
        var stream = await this.megaDecrypt(embedUrl, server, audio);
        streams = [...stream, ...streams];
      }
    }
    return streams.reverse();
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
    var items = [];
    var values = [];

    // Types
    items = ["All", "Movie", "TV Series", "OVA", "ONA", "Special"];
    values = ["0", "1", "2", "3", "4", "5"];
    filters.push({
      type_name: "SelectFilter",
      name: "Types",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Status
    items = ["All", "Finished airing", "Currently airing", "Not yet aired"];
    values = ["0", "1", "2", "3"];
    filters.push({
      type_name: "SelectFilter",
      name: "Status",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Country
    items = ["All", "Japan", "China"];
    values = ["", "jp", "cn"];
    filters.push({
      type_name: "SelectFilter",
      name: "Country",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Language
    items = ["All", "SUB", "DUB", "SUB & DUB"];
    values = ["0", "1", "2", "3"];
    filters.push({
      type_name: "SelectFilter",
      name: "Language",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Ratings
    items = ["All", "G", "PG", "PG-13", "R", "R+", "Rx"];
    values = ["0", "1", "2", "3", "4", "5", "6"];
    filters.push({
      type_name: "SelectFilter",
      name: "Ratings",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Season
    items = ["All", "Spring", "Summer", "Fall", "Winter"];
    values = ["0", "1", "2", "3", "4"];
    filters.push({
      type_name: "SelectFilter",
      name: "Season",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Score
    items = [
      "All",
      "(1) Appalling",
      "(2) Horrible",
      "(3) Very Bad",
      "(4) Bad",
      "(5) Average",
      "(6) Fine",
      "(7) Good",
      "(8) Very Good",
      "(9) Great",
      "(10) Masterpiece",
    ];
    values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    filters.push({
      type_name: "SelectFilter",
      name: "Score",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Sort
    items = [
      "Recently Updated",
      "Recently Added",
      "MAL Score",
      "Name A-Z",
      "Released Date",
      "Most Viewed",
    ];
    values = [
      "recently_updated",
      "recently_added",
      "score",
      "name_az",
      "released_date",
      "most_watched",
    ];
    filters.push({
      type_name: "SelectFilter",
      name: "Sort",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Years
    const currentYear = new Date().getFullYear();
    var years = Array.from({ length: currentYear - 2002 }, (_, i) =>
      (2003 + i).toString()
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

    // Genre
    items = [
      "Action",
      "Adventure",
      "Cars",
      "Comedy",
      "Dementia",
      "Demons",
      "Drama",
      "Ecchi",
      "Fantasy",
      "Game",
      "Harem",
      "Historical",
      "Horror",
      "Isekai",
      "Josei",
      "Kids",
      "Magic",
      "Martial Arts",
      "Mecha",
      "Military",
      "Music",
      "Mystery",
      "Parody",
      "Police",
      "Psychological",
      "Romance",
      "Samurai",
      "School",
      "Sci-Fi",
      "Seinen",
      "Shoujo",
      "Shoujo Ai",
      "Shounen",
      "Shounen Ai",
      "Slice of Life",
      "Space",
      "Sports",
      "Super Power",
      "Supernatural",
      "Thriller",
      "Vampire",
    ];
    values = [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "8",
      "9",
      "10",
      "11",
      "35",
      "13",
      "14",
      "44",
      "43",
      "15",
      "16",
      "17",
      "18",
      "38",
      "19",
      "7",
      "20",
      "39",
      "40",
      "22",
      "21",
      "23",
      "24",
      "42",
      "25",
      "26",
      "27",
      "28",
      "36",
      "29",
      "30",
      "31",
      "37",
      "41",
      "32",
    ];
    filters.push({
      type_name: "GroupFilter",
      name: "Genre",
      state: formateState("CheckBox", items, values),
    });

    return filters;
  }

  getSourcePreferences() {
    return [
      {
        key: "anicrush_anime_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 1,
          entries: ["English", "Romaji"],
          entryValues: ["0", "1"],
        },
      },
      {
        key: "anicrush_episode_title_lang",
        listPreference: {
          title: "Preferred episode title language",
          summary: "Choose in which language episode title should be shown",
          valueIndex: 0,
          entries: ["English", "Romaji"],
          entryValues: ["0", "1"],
        },
      },
      {
        key: "anicrush_pref_stream_server",
        multiSelectListPreference: {
          title: "Preferred server",
          summary: "Choose the server/s you want to extract streams from",
          values: ["4"],
          entries: ["Southcloud-1", "Southcloud-2", "Southcloud-3"],
          entryValues: ["4", "1", "6"],
        },
      },
      {
        key: "anicrush_pref_stream_subdub_type",
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

  //----------------Megacloud Decoders----------------
  // Credits :- https://github.com/itzzzme/megacloud-keys/

  async getKey() {
    const preferences = new SharedPreferences();
    let KEY = preferences.getString("megacloud_key", "");
    var KEYS_TS = parseInt(preferences.getString("megacloud_key_ts", "0"));
    var now_ts = parseInt(new Date().getTime() / 1000);

    // Checks for keys every 20 minutes
    if (now_ts - KEYS_TS < 20 * 60 && KEY != "") {
      return KEY;
    }
    KEY = (
      await new Client().get(
        "https://raw.githubusercontent.com/itzzzme/megacloud-keys/refs/heads/main/key.txt"
      )
    ).body;
    preferences.setString("megacloud_key", KEY);
    preferences.setString("megacloud_key_ts", ""+now_ts);
    return KEY;
  }

  async megaDecrypt(url, serverId, audio) {
    function serverName(code) {
      return {
        "4": "Southcloud-1",
        "1": "Southcloud-2",
        "6": "Southcloud-3",
      }[code];
    }
    var host = "https://megacloud.blog/"
    const key = await this.getKey();
    var code = url.split("/")[6].split("?")[0];
    var api = `${host}embed-2/v2/e-1/getSources?id=${code}`;
    var result = await this.request(api);
    var subs = result.tracks;
    var encryptedUrl = result.sources;
    var streamData = JSON.parse(decryptAESCryptoJS(encryptedUrl, key));
    var streamUrl = streamData[0].file
    var hdr = this.getHeaders(host)
    delete hdr['x-site']
    return [
      {
        url: streamUrl,
        originalUrl: streamUrl,
        quality: `Auto - ${serverName(serverId)} : ${audio.toUpperCase()}`,
        headers: hdr,
        subtitles: subs,
      },
    ];
  }
}
