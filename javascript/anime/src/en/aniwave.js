const mangayomiSources = [
  {
    "name": "Aniwave",
    "id": 3928195277,
    "baseUrl": "https://aniwave.se",
    "lang": "en",
    "typeSource": "multi",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://aniwave.se/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.7",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "pkgPath": "anime/src/en/aniwave.js",
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
    };
  }

  getBaseUrl() {
    return this.getPreference("aniwave_base_url");
  }

  async request(slug) {
    var url = this.getBaseUrl() + slug;
    var res = await this.client.get(url, this.getHeaders(url));
    return res.body;
  }

  async getAnimeList(slug, page) {
    var list = [];
    var hasNextPage = false;
    var namePref = this.getPreference("aniwave_title_lang");

    var doc = new Document(await this.request(slug + "page=" + page));
    var items = doc.select("#list-items > div.item");

    for (var item of items) {
      var nameSection = item.selectFirst("a.d-title");
      var name =
        namePref == "ro" ? nameSection.text : nameSection.attr("data-jp");
      var link = item.selectFirst("a").getHref;
      var imageUrl = item.selectFirst("img").getSrc;
      list.push({ name, link, imageUrl });
    }

    var page_links = doc.selectFirst("nav.navigation").select("a.page-link");
    if (page_links.length) {
      hasNextPage = !page_links[page_links.length - 1].getHref.includes(
        "page=" + page
      );
    }
    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.getAnimeList(`/trending-anime/?`, page);
  }

  async getLatestUpdates(page) {
    return await this.getAnimeList(`/anime-list/?`, page);
  }

  async search(query, page, filters) {
    function getFilter(category, state) {
      var rd = [];
      state.forEach((item) => {
        if (item.state) {
          // rd.push(item.value);
          rd += `&${category}[]=${item.value}`;
        }
      });
      return rd;
    }
    var isFiltersAvailable = !filters || filters.length != 0;
    var genre = isFiltersAvailable ? getFilter("genre", filters[0].state) : "";
    var status = isFiltersAvailable
      ? getFilter("status", filters[1].state)
      : "";
    var country = isFiltersAvailable
      ? getFilter("country", filters[2].state)
      : "";
    var season = isFiltersAvailable
      ? getFilter("season", filters[3].state)
      : "";
    var year = isFiltersAvailable ? getFilter("year", filters[4].state) : "";
    var type = isFiltersAvailable ? getFilter("type", filters[5].state) : "";
    var language = isFiltersAvailable
      ? getFilter("language", filters[6].state)
      : "";
    var rating = isFiltersAvailable
      ? getFilter("rating", filters[7].state)
      : "";

    var slug = "/filter?";
    slug += "keyword=" + query;
    slug +=
      genre + status + country + season + year + type + language + rating + "&";
    return await this.getAnimeList(slug, page);
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          "Airing": 0,
          "Finished Airing": 1,
          "Completed": 1,
          "Not Yet Aired": 4,
        }[status] ?? 5
      );
    }

    var baseUrl = this.getBaseUrl();
    if (url.includes(baseUrl)) url = url.replace(baseUrl, "");

    var doc = new Document(await this.request(url));

    var info = doc.selectFirst("#w-info .binfo");
    var imageUrl = info.selectFirst("img").getSrc;

    var namePref = this.getPreference("aniwave_title_lang");
    var nameSection = info.selectFirst("h1");
    var name =
      namePref == "ro" ? nameSection.text : nameSection.attr("data-jp");

    var link = baseUrl + url;
    var description = info.selectFirst(".synopsis.mb-3 .content").text;

    var genre = [];
    var status = 5;
    info.select("div.bmeta .meta > div").forEach((item) => {
      var itemText = item.text.trim();

      if (itemText.includes("Genres")) {
        item.select("a").forEach((g) => genre.push(g.text));
      } else if (itemText.includes("Status")) {
        var statusText = item.selectFirst("span").text;
        status = statusCode(statusText);
      }
    });

    var chapters = [];
    var animeId = url.replace("/anime-watch/", "");
    var vrf = this.vrfEncrypt(animeId);
    var chapAAPISlug = `/ajax/episode/list/${animeId}?vrf=${vrf}`;
    var epinfo = JSON.parse(await this.request(chapAAPISlug));
    if (epinfo.status != 200) {
      throw new Error("Episodes not found");
    }
    var result = epinfo.result;
    doc = new Document(result);

    doc.select("li").forEach((item) => {
      var aTag = item.selectFirst("a");
      var epNumber = aTag.attr("data-num");
      var epId = aTag.attr("data-usr");
      var hasDub = parseInt(aTag.attr("data-dub"));

      var epUrl = `${epNumber}||${epId}||${hasDub}`;

      var scanlator = hasDub ? "SUB, DUB" : "SUB";
      scanlator = aTag.className.includes("filler")
        ? `FILLER, ${scanlator}`
        : scanlator;

      var titleSplits = item.attr("title").split(" - ");

      var epName = `Episode ${epNumber}`;
      var epTitle = titleSplits[3];
      epName = epTitle.length > 0 ? `${epName}: ${epTitle}` : epName;

      var updData = titleSplits[2].replace("Ep Release: ", "");
      var dateUpload = updData.length > 0 ? new Date(updData) : new Date();

      chapters.push({
        name: epName,
        url: epUrl,
        dateUpload: dateUpload.valueOf().toString(),
        scanlator,
      });
    });

    chapters.reverse();
    return { name, imageUrl, link, description, genre, status, chapters };
  }

  // Extracts the streams url for different resolutions from a hls stream.
  async extractStreams(url, isDub) {
    var audio = isDub ? "HARD-DUB" : "HARD-SUB";
    var hdr = this.getHeaders(this.getBaseUrl());

    var streams = [
      {
        url: url,
        originalUrl: url,
        quality: `Auto : ${audio}`,
        headers: hdr,
      },
    ];
    var doExtract = this.getPreference("aniwave_pref_extract_streams");

    if (!doExtract) {
      return streams;
    }

    const response = await this.client.get(url, hdr);
    const body = response.body;
    const lines = body.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
        var resolution = lines[i].match(/RESOLUTION=(\d+x\d+)/)[1];
        var m3u8Url = lines[i + 1].trim();
        m3u8Url = url.replace("master.m3u8", m3u8Url);
        streams.push({
          url: m3u8Url,
          originalUrl: m3u8Url,
          quality: `${resolution} : ${audio}`,
          headers: hdr,
        });
      }
    }
    return streams;
  }

  async getStream(epNum, epId, isDub) {
    var animeId = epId.split("-episode-")[0];
    var slug = `/ajax/player/?ep=${epId}&dub=${isDub}&sn=${animeId}&epn=${epNum}&g=true&autostart=true`;
    var body = await this.request(slug);

    var sKey = "sources:[{";
    var eKey = "}],";
    var s = body.indexOf(sKey) + sKey.length - 2;
    var e = body.indexOf(eKey) + 2;

    var info = body.substring(s, e);

    var streamUrl = JSON.parse(info)[0]["file"];
    return await this.extractStreams(streamUrl, isDub);
  }

  async getVideoList(url) {
    var splits = url.split("||");
    var epNum = splits[0];
    var epId = splits[1];
    var hasDub = parseInt(splits[2]) ? true : false;

    var prefDubType = this.getPreference("aniwave_pref_stream_subdub_type");

    var streams = [];
    if (prefDubType.includes("sub")) {
      streams = [...streams, ...(await this.getStream(epNum, epId, false))];
    }
    if (prefDubType.includes("dub") && hasDub) {
      streams = [...streams, ...(await this.getStream(epNum, epId, true))];
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

    // Genre
    var items = [
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

    var values = [
      "1",
      "2",
      "2262888",
      "2262603",
      "4",
      "4424081",
      "7",
      "8",
      "9",
      "2263743",
      "2263289",
      "11",
      "14",
      "3457284",
      "4398552",
      "15",
      "16",
      "4424082",
      "3457321",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "25",
      "4398403",
      "26",
      "28",
      "29",
      "30",
      "31",
      "33",
      "35",
      "36",
      "37",
      "38",
      "39",
      "2262590",
      "40",
      "41",
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

    // Country
    items = ["China", "Japan"];
    values = ["120823", "120822"];
    filters.push({
      type_name: "GroupFilter",
      name: "Country",
      state: formateState("CheckBox", items, values),
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
    var years = Array.from({ length: currentYear - 2002 }, (_, i) =>
      (2003 + i).toString()
    ).reverse();
    items = [
      ...years,
      "2000s",
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

    // Types
    values = ["movie", "tv", "ova", "ona", "special", "music"];
    items = ["Movie", "TV", "OVA", "ONA", "Special", "Music"];
    filters.push({
      type_name: "GroupFilter",
      name: "Types",
      state: formateState("CheckBox", items, values),
    });

    // Language
    items = ["Sub & Dub", "Sub", "S-Sub", "Dub"];
    values = ["subdub", "sub", "softsub", "dub"];
    filters.push({
      type_name: "GroupFilter",
      name: "Language",
      state: formateState("CheckBox", items, values),
    });

    // Ratings
    items = [
      "G - All Ages",
      "PG - Children",
      "PG-13 - Teens 13 or older",
      "R - 17+ (violence & profanity)",
      "R+ - Mild Nudity",
      "Rx - Hentai",
    ];

    values = ["g", "pg", "pg_13", "r", "r+", "rx"];
    filters.push({
      type_name: "GroupFilter",
      name: "Ratings",
      state: formateState("CheckBox", items, values),
    });

    return filters;
  }

  getSourcePreferences() {
    return [
      {
        key: "aniwave_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://aniwave.se",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "aniwave_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 1,
          entries: ["English", "Romaji"],
          entryValues: ["en", "ro"],
        },
      },
      {
        key: "aniwave_pref_stream_subdub_type",
        multiSelectListPreference: {
          title: "Preferred stream sub/dub type",
          summary: "",
          values: ["sub", "dub"],
          entries: ["Hard Sub", "Hard Dub"],
          entryValues: ["sub", "dub"],
        },
      },
      {
        key: "aniwave_pref_extract_streams",
        switchPreferenceCompat: {
          title: "Split stream into different quality streams",
          summary: "Split stream Auto into 360p/720p/1080p",
          value: true,
        },
      },
    ];
  }

  // ----------- Decoders -----------
  // Thanks:- https://github.com/4kyoune/anime-stream/blob/main/src/utils/encrypt.js
  // Source:- https://aniwave.se/assets/js/all.js?v=?v=0.29

  utf8Encode(str) {
    const utf8 = [];

    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);

      if (charCode < 0x80) {
        utf8.push(charCode);
      } else if (charCode < 0x800) {
        utf8.push(0xc0 | (charCode >> 6));
        utf8.push(0x80 | (charCode & 0x3f));
      } else if (charCode < 0xd800 || charCode >= 0xe000) {
        utf8.push(0xe0 | (charCode >> 12));
        utf8.push(0x80 | ((charCode >> 6) & 0x3f));
        utf8.push(0x80 | (charCode & 0x3f));
      } else {
        i++;
        if (i >= str.length) throw new Error("Malformed surrogate pair");
        const surrogate1 = charCode;
        const surrogate2 = str.charCodeAt(i);
        const codePoint =
          0x10000 + (((surrogate1 - 0xd800) << 10) | (surrogate2 - 0xdc00));

        utf8.push(0xf0 | (codePoint >> 18));
        utf8.push(0x80 | ((codePoint >> 12) & 0x3f));
        utf8.push(0x80 | ((codePoint >> 6) & 0x3f));
        utf8.push(0x80 | (codePoint & 0x3f));
      }
    }

    return utf8;
  }

  utf8Decode(bytes) {
    let str = "";
    let i = 0;

    while (i < bytes.length) {
      let byte1 = bytes[i++];

      if (byte1 < 0x80) {
        str += String.fromCharCode(byte1);
      } else if (byte1 < 0xe0) {
        let byte2 = bytes[i++];
        str += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
      } else if (byte1 < 0xf0) {
        let byte2 = bytes[i++];
        let byte3 = bytes[i++];
        str += String.fromCharCode(
          ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
        );
      } else {
        let byte2 = bytes[i++];
        let byte3 = bytes[i++];
        let byte4 = bytes[i++];
        let codePoint =
          ((byte1 & 0x07) << 18) |
          ((byte2 & 0x3f) << 12) |
          ((byte3 & 0x3f) << 6) |
          (byte4 & 0x3f);
        codePoint -= 0x10000;
        str += String.fromCharCode(
          0xd800 + (codePoint >> 10),
          0xdc00 + (codePoint & 0x3ff)
        );
      }
    }

    return str;
  }

  base64Encode(bytes) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    let i;

    for (i = 0; i < bytes.length; i += 3) {
      let b1 = bytes[i];
      let b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      let b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

      let triplet = (b1 << 16) | (b2 << 8) | b3;

      result += chars[(triplet >> 18) & 0x3f];
      result += chars[(triplet >> 12) & 0x3f];
      result += i + 1 < bytes.length ? chars[(triplet >> 6) & 0x3f] : "=";
      result += i + 2 < bytes.length ? chars[triplet & 0x3f] : "=";
    }

    return result;
  }

  base64urlEncode(bytes) {
    return this.base64Encode(bytes)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  rc4Encrypt(key, message) {
    let _key = this.utf8Encode(key);
    let _i = 0,
      _j = 0;
    let _box = Array.from({ length: 256 }, (_, i) => i);

    let x = 0;
    for (let i = 0; i < 256; i++) {
      x = (x + _box[i] + _key[i % _key.length]) % 256;
      [_box[i], _box[x]] = [_box[x], _box[i]];
    }

    let out = [];
    for (let byte of message) {
      _i = (_i + 1) % 256;
      _j = (_j + _box[_i]) % 256;
      [_box[_i], _box[_j]] = [_box[_j], _box[_i]];
      let c = byte ^ _box[(_box[_i] + _box[_j]) % 256];
      out.push(c);
    }

    return out;
  }

  vrfShift(vrf) {
    const shifts = [-2, -4, -5, 6, 2, -3, 3, 6];
    for (let i = 0; i < vrf.length; i++) {
      const shift = shifts[i % 8];
      vrf[i] = (vrf[i] + shift) & 0xff;
    }
    return vrf;
  }

  vrfEncrypt(input) {
    const key = "ysJhV6U27FVIjjuk";
    const inputBytes = this.utf8Encode(input);
    const rc4Bytes = this.rc4Encrypt(key, inputBytes);
    const vrfBase64url = this.base64urlEncode(rc4Bytes);

    const vrf1Bytes = this.utf8Encode(vrfBase64url);
    const vrf1Base64 = this.base64Encode(vrf1Bytes);
    const vrf2Bytes = this.utf8Encode(vrf1Base64);
    const shifted = this.vrfShift(vrf2Bytes);
    const reversed = shifted.slice().reverse();

    const finalBase64url = this.base64urlEncode(reversed);
    return this.utf8Decode(this.utf8Encode(finalBase64url));
  }
  // End.
}
