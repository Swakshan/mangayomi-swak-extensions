const mangayomiSources = [
  {
    "name": "WeLoMa",
    "id": 1890238687,
    "baseUrl": "https://weloma.art",
    "lang": "ja",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://weloma.art",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.7",
    "isManga": true,
    "itemType": 0,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "manga/src/ja/weloma.js",
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
    name = "",
    sort = "name",
    sort_type = "DESC",
    genres = [],
    status = "",
    page = 1,
  } = {}) {
    function addSlug(para, value) {
      return `&${para}=${value}`;
    }
    var slug = "/manga-list.html?";
    slug += `name=${name}`;
    slug += addSlug("sort", sort);
    slug += addSlug("genre", genres.join(","));
    slug += addSlug("sort_type", sort_type);
    slug += addSlug("m_status", status);
    slug += addSlug("page", `${page}`);

    var doc = await this.request(slug);

    var list = [];
    doc.select(".thumb-item-flow").forEach((item) => {
      var linkSection = item.selectFirst(".series-title").selectFirst("a");
      var link = linkSection.getHref;
      var name = linkSection.text.trim();

      var imgStyle = item
        .selectFirst(".img-in-ratio")
        .attr("style")
        .trim()
        .substring(23, 150);
      var imageUrl = imgStyle.substring(0, imgStyle.indexOf("')"));
      list.push({ name, link, imageUrl });
    });

    var lastPage = doc
      .selectFirst("ul.pagination.pagination-v4")
      .select("a")
      .slice(-1)[0];
    var hasNextPage = !lastPage.className.includes("disabled");

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchPage({ sort: "views", page: page });
  }

  async getLatestUpdates(page) {
    return await this.searchPage({ sort: "last_update", page: page });
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
    var sort = isFiltersAvailable ? selectFiler(filters[0]) : "name";
    var genres = isFiltersAvailable ? checkBox(filters[1].state) : [];
    var status = isFiltersAvailable ? selectFiler(filters[2]) : "";
    var sortOrder = isFiltersAvailable ? selectFiler(filters[3]) : "ASC";

    return await this.searchPage(query, sort, sortOrder, genres, status, page);
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          "On going": 0,
          "Completed": 1,
          "Dropped": 3,
        }[status] ?? 5
      );
    }
    function uploadTime(time) {
      var ts = 0;
      var timeSplit = time.split(" ");
      var unit = parseInt(timeSplit[0]);
      var unitName = timeSplit[1];
      switch (unitName) {
        case "seconds": {
          ts += unit;
          break;
        }
        case "minutes": {
          ts += unit * 60;
          break;
        }
        case "hours": {
          ts += unit * (60 * 60);
          break;
        }
        case "days": {
          ts += unit * (24 * 60 * 60);
          break;
        }
        case "weeks": {
          ts += unit * (7 * 24 * 60 * 60);
          break;
        }
        case "months": {
          ts += unit * (30 * 24 * 60 * 60);
          break;
        }
        case "years": {
          ts += unit * (12 * 30 * 24 * 60 * 60);
          break;
        }
      }
      return parseInt(new Date().valueOf()) - ts * 1000;
    }
    var baseUrl = this.source.baseUrl;
    var slug = url.replace(baseUrl, "");
    var link = baseUrl + url;

    var doc = await this.request(slug);

    var mangaInfo = doc.selectFirst(".manga-info");
    var name = mangaInfo.selectFirst("h3").text;
    var imageUrl = doc.selectFirst("img.thumbnail").getSrc;
    var description = doc.selectFirst(".summary-content").text.trim();
    var infoList = mangaInfo.select("li");
    var genre = [];
    infoList[2].select("a").forEach((a) => genre.push(a.text.trim()));
    var statusText = infoList[3].selectFirst("a").text;
    var status = statusCode(statusText);
    var chapters = [];
    doc
      .selectFirst(".list-chapters")
      .select("a")
      .forEach((item) => {
        var chapName = item.selectFirst(".chapter-name").text;
        var chapLink = item.getHref;
        var dateUpload = item.selectFirst(".chapter-time").text;

        chapters.push({
          name: chapName,
          url: chapLink,
          dateUpload: ""+uploadTime(dateUpload),
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

  decodeBase64(b64Text) {
    var g = {},
      b = 65,
      d = 0,
      a,
      c = 0,
      h,
      e = "",
      k = String.fromCharCode,
      l = b64Text.length;
    for (a = ""; 91 > b; ) a += k(b++);
    a += a.toLowerCase() + "0123456789+/";
    for (b = 0; 64 > b; b++) g[a.charAt(b)] = b;
    for (a = 0; a < l; a++)
      for (b = g[b64Text.charAt(a)], d = (d << 6) + b, c += 6; 8 <= c; )
        ((h = (d >>> (c -= 8)) & 255) || a < l - 2) && (e += k(h));
    return e;
  }

  async getPageList(url) {
    var urls = [];
    var body = await this.request(url);
    body.select(".chapter-img").forEach((item) => {
      var imgB64 = item.attr("data-img");
      urls.push(this.decodeBase64(imgB64));
    });
    return urls;
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

    // Sort
    items = ["Alphabetical order", "Most views", "Last updated"];
    values = ["name", "views", "last_update"];
    filters.push({
      type_name: "SelectFilter",
      name: "Sort",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Genres
    items = [
      "Action",
      "Adult",
      "Adventure",
      "Comedy",
      "Drama",
      "Ecchi",
      "Fantasy",
      "Gender Bender",
      "Harem",
      "Historical",
      "Horror",
      "Martial Art",
      "Mature",
      "Mecha",
      "Mystery",
      "Psychological",
      "Romance",
      "School Life",
      "Sci-fi",
      "Seinen",
      "Shoujo",
      "Shojou Ai",
      "Shounen",
      "Shounen Ai",
      "Slice of Life",
      "Sports",
      "Supernatural",
      "Tragedy",
      "Yuri",
      "Josei",
      "Smut",
      "One Shot",
      "Shotacon",
    ];
    values = [
      "action",
      "adult",
      "adventure",
      "comedy",
      "drama",
      "ecchi",
      "fantasy",
      "gender-bender",
      "harem",
      "historical",
      "horror",
      "martial-art",
      "mature",
      "mecha",
      "mystery",
      "psychological",
      "romance",
      "school-life",
      "sci-fi",
      "seinen",
      "shoujo",
      "shojou-ai",
      "shounen",
      "shounen-ai",
      "slice-of-life",
      "sports",
      "supernatural",
      "tragedy",
      "yuri",
      "josei",
      "smut",
      "one-shot",
      "shotacon",
    ];
    filters.push({
      type_name: "GroupFilter",
      name: "Genres",
      state: formateState("CheckBox", items, values),
    });

    // Status
    items = ["Any", "Completed", "Ongoing", "dropped"];
    values = ["", "2", "1", "3"];
    filters.push({
      type_name: "SelectFilter",
      name: "Status",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Sort order
    items = ["Ascending", "Descending"];
    values = ["ASC", "DESC"];
    filters.push({
      type_name: "SelectFilter",
      name: "Sort order",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    return filters;
  }

  getSourcePreferences() {
    throw new Error("getSourcePreferences not implemented");
  }
}
