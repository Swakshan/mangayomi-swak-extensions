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
    "version": "0.0.3",
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
    };
  }

  getBaseUrl() {
    return this.getPreference("kaa_base_url");
  }

  async apiCall(slug) {
    var baseUrl = this.getBaseUrl();
    var url = baseUrl + "/api/show" + slug;
    var res = await this.client.get(url, this.getHeaders(url));
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
      "filters":filterQuery
    };

    var baseUrl = this.getBaseUrl();
    var url = baseUrl + "/api/fsearch";
    var hdr = this.getHeaders(url);
    hdr["content-type"] = "application/json";

    var res = await this.client.post(url, hdr, body);
    var rd = JSON.parse(res.body);

    var list = this.formatList(rd.result);
    var hasNextPage = rd.maxPage > page;
    return { list, hasNextPage };
  }

  async getDetail(url) {
    throw new Error("getDetail not implemented");
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
    throw new Error("getVideoList not implemented");
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

  // End
}
