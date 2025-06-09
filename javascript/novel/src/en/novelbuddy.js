const mangayomiSources = [
  {
    "name": "Novelbuddy",
    "id": 2507947282,
    "baseUrl": "https://novelbuddy.com",
    "lang": "en",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://novelbuddy.com/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.8",
    "isManga": false,
    "itemType": 2,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "novel/src/en/novelbuddy.js",
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
    var url = `${this.source.baseUrl}${slug}`;
    var body = (await this.client.get(url)).body;
    return new Document(body);
  }

  async searchPage({
    query = "",
    genres = [],
    status = "all",
    sort = "views",
    page = 1,
  } = {}) {
    function addSlug(para, value) {
      return `&${para}=${value}`;
    }
    function bundleSlug(category, items) {
      var rd = "";
      for (var item of items) {
        rd += `&${category}[]=${item.toLowerCase()}`;
      }
      return rd;
    }

    var slug = "/search?";
    slug += `q=${query}`;
    slug += bundleSlug("genre", genres);
    slug += addSlug("status", status);
    slug += addSlug("sort", sort);
    slug += addSlug("page", `${page}`);

    var doc = await this.request(slug);

    var list = [];
    var hasNextPage = false;
    doc.select(".book-item").forEach((item) => {
      var linkSection = item.selectFirst("a");
      var link = linkSection.getHref;
      var name = linkSection.attr("title");

      var imageUrl = "https:" + linkSection.selectFirst("img").attr("data-src");
      list.push({ name, link, imageUrl });
    });

    var lastPage = doc.selectFirst(".paginator");
    if (lastPage != null) {
      lastPage = lastPage.select("a").slice(-1)[0];
      hasNextPage = !lastPage.className.includes("active");
    }

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchPage({ sort: "views", page: page });
  }

  async getLatestUpdates(page) {
    return await this.searchPage({ sort: "updated_at", page: page });
  }

  async search(query, page, filters) {
    function checkBox(state) {
      var rd = [];
      state.forEach((item) => {
        if (item.state) {
          rd.push(item.value);
        }
      });
      return rd;
    }
    function selectFiler(filter) {
      return filter.values[filter.state].value;
    }

    var isFiltersAvailable = !filters || filters.length != 0;
    var genres = isFiltersAvailable ? checkBox(filters[0].state) : [];
    var status = isFiltersAvailable ? selectFiler(filters[1]) : "all";
    var sort = isFiltersAvailable ? selectFiler(filters[2]) : "views";

    return await this.searchPage({ query, genres, status, sort, page });
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          "OnGoing": 0,
          "Completed": 1,
        }[status] ?? 5
      );
    }
    var baseUrl = this.source.baseUrl;
    var slug = url.replace(baseUrl, "");
    var link = baseUrl + url;

    var doc = await this.request(slug);

    var detail = doc.selectFirst(".detail");
    var name = detail.selectFirst("h1").text;
    var imageUrl =
      "https:" +
      doc.selectFirst(".img-cover").selectFirst("img").attr("data-src");
    var meta = detail.selectFirst(".meta");
    var genre = [];
    var status = 5;
    meta.select("p").forEach((item) => {
      var title = item.selectFirst("strong").text;
      if (title.includes("Genres")) {
        item
          .select("a")
          .forEach((a) => genre.push(a.text.replace(",", "").trim()));
      } else if (title.includes("Status")) {
        var statusText = item.selectFirst("a").text.trim();
        status = statusCode(statusText);
      }
    });
    var description = doc
      .selectFirst(".section-body.summary")
      .selectFirst("p")
      .text.trim();

    var chapters = [];
    var html = doc.html
    var sKey = "bookId = "
    var start = html.indexOf(sKey) + sKey.length
    var end = html.indexOf(";", start)
    var bookId = html.substring(start, end).trim()
    var chapDoc = await this.request(
      `/api/manga/${bookId}/chapters?source=detail`
    );
    chapDoc
      .selectFirst("#chapter-list")
      .select("li")
      .forEach((item) => {
        var chapLink = item.selectFirst("a").getHref;
        var chapName = item.selectFirst("strong").text.trim();
        var dateString = item.selectFirst("time").text.trim();
        var dateUpload = new Date(dateString).valueOf().toString();
        chapters.push({
          name: chapName,
          url: chapLink,
          dateUpload,
        });
      });

    return {
      name,
      imageUrl,
      description,
      link,
      status,
      genre,
      chapters,
    };
  }

  async getHtmlContent(name,url) {
    var doc = await this.request(url);
    return this.cleanHtmlContent(doc);
  }

  async cleanHtmlContent(html) {
    var para = html.selectFirst(".content-inner").select("p")
    var title = para[0].text.trim();
    var content = ""
    para.slice(1,).forEach((item) => {
      content+= item.text.trim() + " <br>";
    })
    return `<h2>${title}</h2><hr><br>${content}`;
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

    // Genres
    items = [
      "Action",
      "Action Adventure",
      "ActionAdventure",
      "Adult",
      "Adventcure",
      "Adventure",
      "Adventurer",
      "Anime u0026 Comics",
      "Bender",
      "Booku0026Literature",
      "Chinese",
      "Comed",
      "Comedy",
      "Cultivation",
      "Drama",
      "dventure",
      "Eastern",
      "Ecchi",
      "Ecchi Fantasy",
      "Fan-Fiction",
      "Fanfiction",
      "Fantas",
      "Fantasy",
      "FantasyAction",
      "Game",
      "Games",
      "Gender",
      "Gender Bender",
      "Harem",
      "HaremAction",
      "Haremv",
      "Historica",
      "Historical",
      "History",
      "Horror",
      "Isekai",
      "Josei",
      "Light Novel",
      "Litrpg",
      "Lolicon",
      "Magic",
      "Martial",
      "Martial Arts",
      "Mature",
      "Mecha",
      "Military",
      "Modern Life",
      "Movies",
      "Myster",
      "Mystery",
      "Mystery.Adventure",
      "Psychologic",
      "Psychological",
      "Reincarnatio",
      "Reincarnation",
      "Romanc",
      "Romance",
      "Romance.Adventure",
      "Romance.Harem",
      "Romance.Smut",
      "RomanceAction",
      "Romancem",
      "School Life",
      "Sci-fi",
      "Seinen",
      "Seinen Wuxia",
      "Shoujo",
      "Shoujo Ai",
      "Shounen",
      "Shounen Ai",
      "Slice of Lif",
      "Slice Of Life",
      "Slice of Lifel",
      "Smut",
      "Sports",
      "Superna",
      "Supernatural",
      "System",
      "Thriller",
      "Tragedy",
      "Urban",
      "Urban Life",
      "Wuxia",
      "Xianxia",
      "Xuanhuan",
      "Yaoi",
      "Yuri",
    ];

    values = [
      "action",
      "action-adventure",
      "actionadventure",
      "adult",
      "adventcure",
      "adventure",
      "adventurer",
      "anime-u0026-comics",
      "bender",
      "booku0026literature",
      "chinese",
      "comed",
      "comedy",
      "cultivation",
      "drama",
      "dventure",
      "eastern",
      "ecchi",
      "ecchi-fantasy",
      "fan-fiction",
      "fanfiction",
      "fantas",
      "fantasy",
      "fantasyaction",
      "game",
      "games",
      "gender",
      "gender-bender",
      "harem",
      "haremaction",
      "haremv",
      "historica",
      "historical",
      "history",
      "horror",
      "isekai",
      "josei",
      "light-novel",
      "litrpg",
      "lolicon",
      "magic",
      "martial",
      "martial-arts",
      "mature",
      "mecha",
      "military",
      "modern-life",
      "movies",
      "myster",
      "mystery",
      "mystery-adventure",
      "psychologic",
      "psychological",
      "reincarnatio",
      "reincarnation",
      "romanc",
      "romance",
      "romance-adventure",
      "romance-harem",
      "romance-smut",
      "romanceaction",
      "romancem",
      "school-life",
      "sci-fi",
      "seinen",
      "seinen-wuxia",
      "shoujo",
      "shoujo-ai",
      "shounen",
      "shounen-ai",
      "slice-of-lif",
      "slice-of-life",
      "slice-of-lifel",
      "smut",
      "sports",
      "superna",
      "supernatural",
      "system",
      "thriller",
      "tragedy",
      "urban",
      "urban-life",
      "wuxia",
      "xianxia",
      "xuanhuan",
      "yaoi",
      "yuri",
    ];
    filters.push({
      type_name: "GroupFilter",
      name: "Genres",
      state: formateState("CheckBox", items, values),
    });

    // Status
    items = ["All", "Ongoing", "Completed"];
    values = ["all", "ongoing", "completed"];
    filters.push({
      type_name: "SelectFilter",
      name: "Status",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Sort order
    items = ["Views", "Updated", "Created", "Name A-Z", "Rating"];
    values = ["views", "updated_at", "created_at", "name", "rating"];
    filters.push({
      type_name: "SelectFilter",
      name: "Order by",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    return filters;
  }

  getSourcePreferences() {
    throw new Error("getSourcePreferences not implemented");
  }
}
