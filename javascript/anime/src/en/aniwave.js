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
    "version": "0.0.3",
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
    throw new Error("getDetail not implemented");
  }

  async getVideoList(url) {
    throw new Error("getVideoList not implemented");
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
    ];
  }
}
