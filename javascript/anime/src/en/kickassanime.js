const mangayomiSources = [
  {
    "name": "KickAssAnime",
    "id": 4096048097,
    "baseUrl": "https://kaa.mx",
    "lang": "en",
    "typeSource": "multi",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://kaa.mx/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.6",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/en/kickassanime.js",
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
    return {
      Referer: url,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      "content-type": "application/json",
    };
  }

  getBaseUrl() {
    return this.getPreference("kaa_base_url");
  }

  async apiCall(slug) {
    var baseUrl = this.getBaseUrl();
    var url = baseUrl + "/api/show" + slug;
    var hdr = this.getHeaders(url);
    var res = await this.client.get(url, hdr);
    return JSON.parse(res.body);
  }

  formatList(animeList) {
    var list = [];
    var baseUrl = this.getBaseUrl();
    var titlePref = this.getPreference("kaa_title_lang");

    animeList.forEach((anime) => {
      var slug = anime.slug;
      var posterSlug = anime.hasOwnProperty("poster") ? anime.poster.hq : "";

      var name = anime.hasOwnProperty(titlePref)
        ? anime[titlePref]
        : anime.title;
      var link = `${baseUrl}/${slug}`;
      var imageUrl = `${baseUrl}/image/poster/${posterSlug}.webp`;

      list.push({ name, link, imageUrl });
    });

    return list;
  }

  async getAnimeList(slug, page = 1) {
    var body = await this.apiCall(`${slug}page=${page}`);

    var maxPage = body.hasOwnProperty("page_count") ? body.page_count : 1;
    var animeList = body.hasOwnProperty("result") ? body.result : [];
    var hasNextPage = maxPage > page;
    var list = await this.formatList(animeList);
    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.getAnimeList("/popular?", page);
  }

  async getLatestUpdates(page) {
    return await this.getAnimeList("/recent?type=all&", page);
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
    var genre = isFiltersAvailable ? getCheckBox(filters[0].state) : [];
    var year = isFiltersAvailable ? getSelectFilter(filters[1]) : "All";
    var status = isFiltersAvailable ? getSelectFilter(filters[2]) : "All";
    var type = isFiltersAvailable ? getSelectFilter(filters[3]) : "All";

    var filt = {};
    if (genre.length > 0) filt["genre"] = genre;
    if (year.toLowerCase() != "all") filt["year"] = parseInt(year);
    if (status.toLowerCase() != "all") filt["status"] = status;
    if (type.toLowerCase() != "all") filt["type"] = type;

    var filterQuery = this.base64Encode(JSON.stringify(filt));

    var body = {
      "page": page,
      "query": query,
      "filters": filterQuery,
    };

    var baseUrl = this.getBaseUrl();
    var url = baseUrl + "/api/fsearch";
    var hdr = this.getHeaders(url);

    var res = await this.client.post(url, hdr, body);
    var rd = JSON.parse(res.body);

    var list = this.formatList(rd.result);
    var hasNextPage = rd.maxPage > page;
    return { list, hasNextPage };
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          "currently_airing": 0,
          "finished_airing": 1,
        }[status] ?? 5
      );
    }

    var link = url;
    var baseUrl = this.getBaseUrl();
    var slug = url.replace(baseUrl, "");
    var anime = await this.apiCall(slug);

    var titlePref = this.getPreference("kaa_title_lang");
    var name = anime.hasOwnProperty(titlePref) ? anime[titlePref] : anime.title;
    var posterSlug = anime.hasOwnProperty("poster") ? anime.poster.hq : "";

    var name = anime.hasOwnProperty(titlePref) ? anime[titlePref] : anime.title;
    var imageUrl = `${baseUrl}/image/poster/${posterSlug}.webp`;
    var description = anime.synopsis;
    var genre = anime.genres;
    var status = statusCode(anime.status);
    var type = anime.type;
    genre.push(type);

    var audioPref = this.getPreference("kaa_stream_lang");
    var locales = anime.locales;
    if (!locales.includes(audioPref)) {
      if (audioPref === "others") {
        locales = locales.filter((l) => !["ja-JP", "en-US"].includes(l));
      }
      audioPref = locales[0];
    }
    var chapters = [];
    var hasNextPage = true;
    var current_page = 1;
    while (hasNextPage) {
      var api = `${slug}/episodes?lang=${audioPref}&page=${current_page}`;
      var response = await this.apiCall(api);
      var results = response.result;
      results.forEach((result) => {
        var epTitle = result.hasOwnProperty("title") ? result.title : "";
        var epNumber = result.episode_number;
        var epName = `Episode ${epNumber}`;
        epName = epTitle.length > 0 ? `${epName}: ${epTitle}` : epName;
        epName = type == "movie" ? "Movie" : epName;

        var epLink = `${slug}/episode/ep-${epNumber}-${result.slug}`;

        chapters.push({
          name: epName,
          url: epLink,
        });
      });

      hasNextPage = !(current_page == response.pages.length);
      current_page++;
    }

    chapters.reverse();

    return { name, imageUrl, status, description, genre, link, chapters };
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

    // Genres
    var items = [
      "Action",
      "Adult Cast",
      "Adventure",
      "Anthropomorphic",
      "Avant Garde",
      "Award Winning",
      "Boys Love",
      "CGDCT",
      "Childcare",
      "Combat Sports",
      "Comedy",
      "Crossdressing",
      "Delinquents",
      "Detective",
      "Drama",
      "Ecchi",
      "Educational",
      "Erotica",
      "Fantasy",
      "Gag Humor",
      "Girls Love",
      "Gore",
      "Gourmet",
      "Harem",
      "High Stakes Game",
      "Historical",
      "Horror",
      "Idols (Female)",
      "Idols (Male)",
      "Isekai",
      "Iyashikei",
      "Josei",
      "Kids",
      "Love Polygon",
      "Magical Sex Shift",
      "Mahou Shoujo",
      "Martial Arts",
      "Mecha",
      "Medical",
      "Military",
      "Music",
      "Mystery",
      "Mythology",
      "Organized Crime",
      "Otaku Culture",
      "Parody",
      "Performing Arts",
      "Pets",
      "Psychological",
      "Racing",
      "Reincarnation",
      "Reverse Harem",
      "Romance",
      "Romantic Subtext",
      "Samurai",
      "School",
      "Sci-Fi",
      "Seinen",
      "Shoujo",
      "Shounen",
      "Showbiz",
      "Slice of Life",
      "Space",
      "Sports",
      "Strategy Game",
      "Super Power",
      "Supernatural",
      "Survival",
      "Suspense",
      "Team Sports",
      "Time Travel",
      "Vampire",
      "Video Game",
      "Visual Arts",
      "Workplace",
    ];
    filters.push({
      type_name: "GroupFilter",
      name: "Genres",
      state: formateState("CheckBox", items, items),
    });

    // Years
    const currentYear = new Date().getFullYear();
    var years = Array.from({ length: currentYear - 1976 }, (_, i) =>
      (1977 + i).toString()
    ).reverse();
    items = ["All", ...years, "1974", "1972", "1971", "1967"];

    filters.push({
      type_name: "SelectFilter",
      name: "Years",
      state: 0,
      values: formateState("SelectOption", items, items),
    });

    // Status
    items = ["All", "Finished", "On going"];
    var values = ["all", "finished", "airing"];
    filters.push({
      type_name: "SelectFilter",
      name: "Status",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Type
    items = ["All", "TV", "Movie", "ONA", "OVA", "Special", "TV Special"];
    values = ["all", "tv", "movie", "ona", "ova", "special", "tv_special"];
    filters.push({
      type_name: "SelectFilter",
      name: "Type",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    return filters;
  }

  async getVideoList(url) {
    var streams = [];
    var doc = await this.apiCall(url);
    var servers = doc.servers;
    for (var server of servers) {
      var vidStreams = [];
      var shortName = server.shortName;
      var link = server.src;
      if (shortName == "Vid") {
        vidStreams = await this.decodeVidStreaming(link);
      } else if (shortName == "Cat") {
        vidStreams = await this.decodeCatStreaming(link);
      }

      streams = [...streams, ...vidStreams];
    }

    return streams;
  }

  getSourcePreferences() {
    return [
      {
        key: "kaa_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://kaa.mx",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "kaa_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 1,
          entries: ["English", "Romaji"],
          entryValues: ["title_en", "title"],
        },
      },
      {
        key: "kaa_stream_lang",
        listPreference: {
          title: "Preferred stream language",
          summary: "Choose in which language anime audio should be shown",
          valueIndex: 0,
          entries: ["Japanese", "English", "Others"],
          entryValues: ["ja-JP", "en-US", "others"],
        },
      },
    ];
  }

  base64Encode(input) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let binary = "";

    // Convert each character to 8-bit binary
    for (let i = 0; i < input.length; i++) {
      let bin = input.charCodeAt(i).toString(2);
      binary += bin.padStart(8, "0");
    }

    // Split into 6-bit chunks
    let output = "";
    for (let i = 0; i < binary.length; i += 6) {
      let chunk = binary.slice(i, i + 6).padEnd(6, "0");
      let index = parseInt(chunk, 2);
      output += chars[index];
    }

    // Add padding
    while (output.length % 4 !== 0) {
      output += "=";
    }

    return output;
  }

  // ---------Decorders----------
  hexToString(hex) {
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }

  sha1(msg) {
    function rotl(n, s) {
      return (n << s) | (n >>> (32 - s));
    }

    function toHexStr(n) {
      let s = "",
        v;
      for (let i = 7; i >= 0; i--) {
        v = (n >>> (i * 4)) & 0xf;
        s += v.toString(16);
      }
      return s;
    }

    // UTF-8 encode
    msg = unescape(encodeURIComponent(msg));
    let msgLen = msg.length;

    let wordArray = [];
    for (let i = 0; i < msgLen - 3; i += 4) {
      wordArray.push(
        (msg.charCodeAt(i) << 24) |
          (msg.charCodeAt(i + 1) << 16) |
          (msg.charCodeAt(i + 2) << 8) |
          msg.charCodeAt(i + 3)
      );
    }

    let i = msgLen % 4;
    let tail = 0;
    if (i === 0) {
      tail = 0x080000000;
    } else if (i === 1) {
      tail = (msg.charCodeAt(msgLen - 1) << 24) | 0x0800000;
    } else if (i === 2) {
      tail =
        (msg.charCodeAt(msgLen - 2) << 24) |
        (msg.charCodeAt(msgLen - 1) << 16) |
        0x08000;
    } else {
      tail =
        (msg.charCodeAt(msgLen - 3) << 24) |
        (msg.charCodeAt(msgLen - 2) << 16) |
        (msg.charCodeAt(msgLen - 1) << 8) |
        0x80;
    }
    wordArray.push(tail);

    while (wordArray.length % 16 !== 14) wordArray.push(0);
    wordArray.push(msgLen >>> 29);
    wordArray.push((msgLen << 3) & 0x0ffffffff);

    let H0 = 0x67452301;
    let H1 = 0xefcdab89;
    let H2 = 0x98badcfe;
    let H3 = 0x10325476;
    let H4 = 0xc3d2e1f0;

    for (let blockstart = 0; blockstart < wordArray.length; blockstart += 16) {
      let W = wordArray.slice(blockstart, blockstart + 16);
      for (let t = 16; t < 80; t++) {
        W[t] = rotl(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
      }

      let a = H0,
        b = H1,
        c = H2,
        d = H3,
        e = H4;
      for (let t = 0; t < 80; t++) {
        let temp;
        if (t < 20) {
          temp = (b & c) | (~b & d);
          temp =
            ((rotl(a, 5) + temp + e + W[t] + 0x5a827999) & 0xffffffff) >>> 0;
        } else if (t < 40) {
          temp = b ^ c ^ d;
          temp =
            ((rotl(a, 5) + temp + e + W[t] + 0x6ed9eba1) & 0xffffffff) >>> 0;
        } else if (t < 60) {
          temp = (b & c) | (b & d) | (c & d);
          temp =
            ((rotl(a, 5) + temp + e + W[t] + 0x8f1bbcdc) & 0xffffffff) >>> 0;
        } else {
          temp = b ^ c ^ d;
          temp =
            ((rotl(a, 5) + temp + e + W[t] + 0xca62c1d6) & 0xffffffff) >>> 0;
        }

        e = d;
        d = c;
        c = rotl(b, 30);
        b = a;
        a = temp;
      }

      H0 = (H0 + a) & 0xffffffff;
      H1 = (H1 + b) & 0xffffffff;
      H2 = (H2 + c) & 0xffffffff;
      H3 = (H3 + d) & 0xffffffff;
      H4 = (H4 + e) & 0xffffffff;
    }

    return (
      toHexStr(H0) + toHexStr(H1) + toHexStr(H2) + toHexStr(H3) + toHexStr(H4)
    );
  }

  async decodeVidStreaming(url) {
    var id = url.substring(url.indexOf("id=") + 3, url.indexOf("&ln="));
    var body = (await this.client.get(url)).body;

    var sKey = "cid: '";
    var eKey = "',";
    var s = body.indexOf(sKey) + sKey.length;
    var e = body.indexOf(eKey, s);
    var cid = body.substring(s, e);
    cid = this.hexToString(cid);

    var cidSp = cid.split("|");
    var ip = cidSp[0];
    var route = cidSp[1].replace("player.php", "source.php");
    var key = "e13d38099bf562e8b9851a652d2043d3";
    var hdr = this.getHeaders("https://krussdomi.com/");
    delete hdr["content-type"];
    var ua = hdr["User-Agent"];
    var timestamp = parseInt(Date.now() / 1000);
    var signature = "";
    var pattern = ["IP", "USERAGENT", "ROUTE", "ID", "TIMESTAMP", "KEY"];

    pattern.forEach((step) => {
      if (step == "IP") signature += ip;
      else if (step == "USERAGENT") signature += ua;
      else if (step == "ROUTE") signature += route;
      else if (step == "ID") signature += id;
      else if (step == "TIMESTAMP") signature += timestamp;
      else if (step == "KEY") signature += key;
    });

    var signHash = this.sha1(signature);
    var api = `https://krussdomi.com${route}?id=${id}&e=${timestamp}&s=${signHash}`;

    body = (await this.client.get(api, hdr)).body;
    var data = JSON.parse(body)["data"];
    var dataSp = data.replace("\\", "").split(":");
    var encText = dataSp[0];
    var iv = dataSp[1].substring(0, 16);
    var txt = cryptoHandler(encText, iv, key, false);
    txt = txt
      .substring(txt.indexOf("krussdomi.com"))
      .replace("krussdomi.com", '{"url":"https://hls.krussdomi.com');
    data = JSON.parse(txt);

    var streamUrl = data.url;
    var subtitles = [];

    data.subtitles.forEach((sub) => {
      subtitles.push({
        file: "https" + sub.src,
        label: sub.name,
      });
    });

    return [
      {
        url: streamUrl,
        originalUrl: streamUrl,
        quality: "Auto - VidStreaming",
        headers: hdr,
        subtitles: subtitles,
      },
    ];
  }

  async decodeCatStreaming(url) {
    var hdr = this.getHeaders("https://krussdomi.com");
    delete hdr["content-type"];
    var body = (await this.client.get(url,hdr)).body;

    var sKey = "props=";
    var eKey = "ssr client";
    var s = body.indexOf(sKey) + sKey.length + 1;
    var e = body.indexOf(eKey, s) - 2;
    var data = JSON.parse(body.substring(s, e).replaceAll("&quot;", '"'));

    var streamUrl = "https:" + data.manifest[1];
    var subtitles = [];

    data.subtitles[1].forEach((sub) => {
      sub = sub[1];
      subtitles.push({
        file: sub.src[1],
        label: sub.name[1],
      });
    });

    return [
      {
        url: streamUrl,
        originalUrl: streamUrl,
        quality: "Auto - CatStreaming",
        subtitles: subtitles,
        headers: hdr,
      },
    ];
  }

  // End
}
