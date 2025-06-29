const mangayomiSources = [
  {
    "name": "Aniwatch",
    "id": 1514967419,
    "baseUrl": "https://aniwatchtv.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://aniwatchtv.to/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.1",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/en/aniwatch.js",
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

  async request(slug) {
    var url = `${this.source.baseUrl}/${slug}`;
    return await this.client.get(url);
  }

  async searchPage({
    query = "",
    type = "",
    status = "",
    rated = "",
    score = "",
    season = "",
    language = "",
    sort = "default",
    genre = [],
    sYear = "",
    sMonth = "",
    sDay = "",
    eYear = "",
    eMonth = "",
    eDay = "",
    page = 1,
  }) {
    function bundleSlug(category, item) {
      var rd = item.length > 0 && item != "" ? `&${category}=${item}` : "";
      return rd;
    }
    var slug = query.length > 0 ? "search?" : "filter?";
    slug += `page=${page}`;
    slug += bundleSlug("keyword", query);
    slug += bundleSlug("type", type);
    slug += bundleSlug("status", status);
    slug += bundleSlug("rated", rated);
    slug += bundleSlug("score", score);
    slug += bundleSlug("season", season);
    slug += bundleSlug("language", language);
    slug += bundleSlug("sort", sort);
    slug += bundleSlug("", type);
    slug += bundleSlug("genres", genre.join("%2C"));
    slug += bundleSlug("sy", sYear);
    slug += bundleSlug("sm", sMonth);
    slug += bundleSlug("sd", sDay);
    slug += bundleSlug("ey", eYear);
    slug += bundleSlug("em", eMonth);
    slug += bundleSlug("ed", eDay);

    var body = await this.request(slug);
    var doc = new Document(body.body);

    var list = [];
    var hasNextPage = false;
    var titlePref = this.getPreference("aniwatch_pref_title");
    doc.select(".flw-item").forEach((item) => {
      var linkSection = item.selectFirst("h3.film-name").selectFirst("a");
      var name = linkSection.attr(titlePref);
      var link = linkSection.getHref;
      var imageUrl = item.selectFirst("img.film-poster-img").attr("data-src");
      list.push({
        name,
        link,
        imageUrl,
      });
    });

    var pagination = doc.selectFirst("ul.pagination").select("li").pop();
    if (pagination) hasNextPage = !pagination.className.includes("active");
    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchPage({ sort: "most_watched", page: page });
  }

  async getLatestUpdates(page) {
    return await this.searchPage({ sort: "recently_updated", page: page });
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
    var type = isFiltersAvailable ? getSelectFilter(filters[0]) : "";
    var status = isFiltersAvailable ? getSelectFilter(filters[1]) : "";
    var rated = isFiltersAvailable ? getSelectFilter(filters[2]) : "";
    var score = isFiltersAvailable ? getSelectFilter(filters[3]) : "";
    var season = isFiltersAvailable ? getSelectFilter(filters[4]) : "";
    var language = isFiltersAvailable ? getSelectFilter(filters[5]) : "";
    var sort = isFiltersAvailable ? getSelectFilter(filters[6]) : "default";
    var genre = isFiltersAvailable ? getCheckBox(filters[7].state) : [];

    var sYear = isFiltersAvailable ? getSelectFilter(filters[9]) : "";
    var sMonth = isFiltersAvailable ? getSelectFilter(filters[10]) : "";
    var sDay = isFiltersAvailable ? getSelectFilter(filters[11]) : "";

    var eYear = isFiltersAvailable ? getSelectFilter(filters[13]) : "";
    var eMonth = isFiltersAvailable ? getSelectFilter(filters[14]) : "";
    var eDay = isFiltersAvailable ? getSelectFilter(filters[15]) : "";

    return await this.searchPage({
      query,
      type,
      status,
      rated,
      score,
      season,
      language,
      sort,
      genre,
      sYear,
      sMonth,
      sDay,
      eYear,
      eMonth,
      eDay,
      page,
    });
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
    var items = [];
    var values = [];

    // Types
    items = ["All", "Movie", "TV", "OVA", "ONA", "Special", "Music"];
    values = ["", "1", "2", "3", "4", "5", "6"];
    filters.push({
      type_name: "SelectFilter",
      name: "Type",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Status
    items = ["All", "Finished Airing", "Currently Airing", "Not yet aired"];
    values = ["", "1", "2", "3"];
    filters.push({
      type_name: "SelectFilter",
      name: "Status",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Rated
    items = ["All", "G", "PG", "PG-13", "R", "R+", "Rx"];
    values = ["", "1", "2", "3", "4", "5", "6"];
    filters.push({
      type_name: "SelectFilter",
      name: "Rated",
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

    values = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

    filters.push({
      type_name: "SelectFilter",
      name: "Score",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Season
    items = ["All", "Spring", "Summer", "Fall", "Winter"];
    values = ["", "1", "2", "3", "4"];

    filters.push({
      type_name: "SelectFilter",
      name: "Season",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Language
    items = ["All", "SUB", "DUB", "SUB & DUB"];
    values = ["", "1", "2", "3"];

    filters.push({
      type_name: "SelectFilter",
      name: "Language",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Sort
    items = [
      "Default",
      "Recently Added",
      "Recently Updated",
      "Score",
      "Name A-Z",
      "Released Date",
      "Most Watched",
    ];

    values = [
      "default",
      "recently_added",
      "recently_updated",
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

    const date = new Date();
    const currentYear = date.getFullYear();
    var limit = 1917;
    var years = Array.from({ length: currentYear - limit + 1 }, (_, i) =>
      (limit + i).toString()
    ).reverse();
    years = ["", ...years];

    var limit = 12;
    var months = Array.from({ length: limit }, (_, i) => (i + 1).toString());
    months = ["", ...months];

    var limit = 31;
    var days = Array.from({ length: limit }, (_, i) => (i + 1).toString());
    days = ["", ...days];

    filters.push({
      type_name: "HeaderFilter",
      name: "Start Date",
    });
    filters.push({
      type_name: "SelectFilter",
      name: "Year",
      state: 0,
      values: formateState("SelectOption", years, years),
    });
    filters.push({
      type_name: "SelectFilter",
      name: "Month",
      state: 0,
      values: formateState("SelectOption", months, months),
    });
    filters.push({
      type_name: "SelectFilter",
      name: "Day",
      state: 0,
      values: formateState("SelectOption", days, days),
    });

    filters.push({
      type_name: "HeaderFilter",
      name: "End Date",
    });
    filters.push({
      type_name: "SelectFilter",
      name: "Year",
      state: 0,
      values: formateState("SelectOption", years, years),
    });
    filters.push({
      type_name: "SelectFilter",
      name: "Month",
      state: 0,
      values: formateState("SelectOption", months, months),
    });
    filters.push({
      type_name: "SelectFilter",
      name: "Day",
      state: 0,
      values: formateState("SelectOption", days, days),
    });
    return filters;
  }

  getSourcePreferences() {
    return [
      {
        key: "aniwatch_pref_title",
        listPreference: {
          title: "Preferred Title",
          summary: "",
          valueIndex: 0,
          entries: ["Romaji", "English"],
          entryValues: ["data-jname", "title"],
        },
      },
    ];
  }
}
