const mangayomiSources = [
  {
    "name": "Atsumaru",
    "id": 2829806388,
    "baseUrl": "https://atsu.moe",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://atsu.moe",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.1",
    "isManga": true,
    "itemType": 0,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "manga/src/en/atsumaru.js",
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
    return {
      Accept: "*/*",
      Referer: this.source.baseUrl,
      "Content-Type": "application/json",
      "User-Agent": "MangaYomi",
    };
  }

  getImageHeaders() {
    return {
      Accept: "image/avif,image/webp,*/*",
      Referer: this.source.baseUrl,
    };
  }

  get supportsLatest() {
    return true;
  }

  getBaseUrl() {
    return this.source.baseUrl;
  }

  getAdultParam() {
    var value = this.getPreference("atsumaru_show_adult");
    return value === true || value == "true" ? "&adult=1" : "";
  }

  isAdultEnabled(filters) {
    var pref = this.getPreference("atsumaru_show_adult");
    if (pref === true || pref == "true") return true;

    var filter = filters && filters[7];
    if (!filter || !filter.values) return false;
    return filter.values[filter.state].value == "true";
  }

  async requestJson(slug) {
    var baseUrl = this.getBaseUrl();
    var url = slug.includes("http") ? slug : baseUrl + slug;
    var res = await this.client.get(url, this.getHeaders());
    if (res.statusCode != 200) {
      throw new Error(`${url} returned status code ${res.statusCode}`);
    }
    return JSON.parse(res.body);
  }

  toImageUrl(path) {
    if (path == null || path == "") return "";

    if (typeof path == "object") {
      path = path.image || path.url || path.mediumImage || path.smallImage || "";
    }

    if (path.startsWith("http")) return path.replace(/^https?:?\/\//, "https://");
    if (path.startsWith("//")) return `https:${path}`;

    path = path.replace(/^\//, "").replace(/^static\//, "");
    return `${this.getBaseUrl()}/static/${path}`.replace(
      /^https?:?\/\//,
      "https://"
    );
  }

  toManga(item) {
    return {
      name: item.title || item.englishTitle || "",
      link: item.id,
      imageUrl: this.toImageUrl(
        item.posterMedium ||
          item.mediumImage ||
          item.posterSmall ||
          item.smallImage ||
          item.poster ||
          item.image
      ),
    };
  }

  async browse(slug) {
    var body = await this.requestJson(slug);
    var items = body.items || [];
    return {
      list: items.map((item) => this.toManga(item)),
      hasNextPage: items.length > 0,
    };
  }

  async getPopular(page) {
    var apiPage = Math.max(parseInt(page) - 1, 0);
    var slug = `/api/infinite/trending?page=${apiPage}&types=Manga,Manwha,Manhua,OEL${this.getAdultParam()}`;
    return await this.browse(slug);
  }

  async getLatestUpdates(page) {
    var apiPage = Math.max(parseInt(page) - 1, 0);
    var slug = `/api/infinite/recentlyUpdated?page=${apiPage}&types=Manga,Manwha,Manhua,OEL${this.getAdultParam()}`;
    return await this.browse(slug);
  }

  addQueryParam(params, key, value) {
    if (value != null && value !== "") {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  selectedGroupValues(filter) {
    var values = [];
    if (!filter || !filter.state) return values;
    filter.state.forEach((item) => {
      if (item.state == true) values.push(item.value);
    });
    return values;
  }

  selectedValue(filter, fallback) {
    if (!filter || !filter.values) return fallback;
    var selected = filter.values[filter.state];
    return selected ? selected.value : fallback;
  }

  addExactFilter(filterBy, field, values) {
    if (values.length == 0) return;
    filterBy.push(values.map((value) => `${field}:=\`${value}\``).join(" && "));
  }

  addListFilter(filterBy, field, values) {
    if (values.length == 0) return;
    filterBy.push(`${field}:=[${values.map((value) => `\`${value}\``).join(",")}]`);
  }

  async search(query, page, filters) {
    filters = filters && filters.length > 0 ? filters : this.getFilterList();

    var filterBy = ["hidden:!=true"];
    var sortBy = this.selectedValue(filters[0], "views:desc");

    this.addExactFilter(filterBy, "genreIds", this.selectedGroupValues(filters[1]));
    this.addExactFilter(filterBy, "tagIds", this.selectedGroupValues(filters[2]));
    this.addListFilter(filterBy, "type", this.selectedGroupValues(filters[3]));
    this.addListFilter(filterBy, "status", this.selectedGroupValues(filters[4]));

    var year = this.selectedValue(filters[5], "");
    if (year != "") filterBy.push(`releaseYear:=[${year}]`);

    var minChapters = this.selectedValue(filters[6], "");
    if (minChapters != "") filterBy.push(`chapterCount:>=${minChapters}`);

    if (!this.isAdultEnabled(filters)) {
      filterBy.push("isAdult:=false");
    }

    var officialTranslation = this.selectedValue(filters[8], "false");
    if (officialTranslation == "true") {
      filterBy.push("officialTranslation:=true");
    }

    filterBy.push("(mbContentRating:=[`Safe`,`Suggestive`,`Erotica`] || mbContentRating:!=*)");
    filterBy.push("views:>0");

    var params = [];
    var hasQuery = query != null && query.trim() != "";
    this.addQueryParam(params, "q", hasQuery ? query : "*");
    this.addQueryParam(params, "filter_by", filterBy.join(" && "));
    this.addQueryParam(params, "sort_by", sortBy);

    if (hasQuery) {
      this.addQueryParam(params, "query_by", "title,englishTitle,otherNames,authors");
      this.addQueryParam(params, "query_by_weights", "4,3,2,1");
      this.addQueryParam(params, "num_typos", "4,3,2,1");
    }

    this.addQueryParam(params, "page", `${page}`);
    this.addQueryParam(params, "per_page", "40");

    var body = await this.requestJson(
      `/collections/manga/documents/search?${params.join("&")}`
    );

    if (body.hits) {
      var perPage = body.request_params ? body.request_params.per_page : 40;
      return {
        list: body.hits.map((hit) => this.toManga(hit.document)),
        hasNextPage: body.page * perPage < body.found,
      };
    }

    var items = body.items || [];
    return {
      list: items.map((item) => this.toManga(item)),
      hasNextPage: items.length > 0,
    };
  }

  parseNames(value) {
    if (!value || !Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item == "string" ? item : item.name))
      .filter((item) => item != null && item != "");
  }

  parseAuthors(value, type) {
    if (!value || !Array.isArray(value)) return "";
    var names = [];
    value.forEach((item) => {
      if (typeof item == "string") {
        if (type == null) names.push(item);
      } else if (item.name && (item.type == type || (type == null && !item.type))) {
        names.push(item.name);
      }
    });
    return names.join(", ");
  }

  statusCode(status) {
    return (
      {
        ongoing: 0,
        completed: 1,
        hiatus: 2,
        canceled: 3,
      }[(status || "").toLowerCase().trim()] ?? 5
    );
  }

  buildDescription(item) {
    var parts = [];
    if (item.avgRating && item.avgRating > 0) {
      parts.push(`Rating: ${item.avgRating.toFixed(2)}/10`);
    }

    var released = item.released || item.releaseDate;
    if (released && released > 0) {
      parts.push(`Year: ${new Date(released).getFullYear()}`);
    } else if (item.releaseYear || item.year) {
      parts.push(`Year: ${item.releaseYear || item.year}`);
    }

    if (item.views != null) parts.push(`Views: ${item.views}`);
    if (item.synopsis && item.synopsis.trim() != "") {
      parts.push(`Synopsis: ${item.synopsis.trim()}`);
    }

    var otherNames = (item.otherNames || []).filter((name) => name != item.title);
    if (otherNames.length > 0) {
      parts.push(`Alternative Names:\n${otherNames.map((name) => `- ${name}`).join("\n")}`);
    }

    return parts.join("\n\n");
  }

  parseMangaId(url) {
    if (!url) return "";
    url = url.replace(this.getBaseUrl(), "");
    var parts = url.split("/").filter((part) => part != "");
    return parts.length == 0 ? url : parts[parts.length - 1];
  }

  async getDetail(url) {
    var mangaId = this.parseMangaId(url);
    var detailBody = await this.requestJson(
      `/api/manga/page?id=${encodeURIComponent(mangaId)}`
    );
    var item = detailBody.mangaPage || detailBody;
    var chaptersBody = await this.requestJson(
      `/api/manga/allChapters?mangaId=${encodeURIComponent(mangaId)}`
    );

    var scanlators = {};
    (item.scanlators || []).forEach((scanlator) => {
      scanlators[scanlator.id] = scanlator.name;
    });

    var chapters = (chaptersBody.chapters || [])
      .sort((a, b) => {
        if (a.number != b.number) return b.number - a.number;
        var scanlatorA = scanlators[a.scanlationMangaId] || "";
        var scanlatorB = scanlators[b.scanlationMangaId] || "";
        if (scanlatorA != scanlatorB) return scanlatorA.localeCompare(scanlatorB);
        return this.parseDate(b.createdAt) - this.parseDate(a.createdAt);
      })
      .map((chapter) => ({
        name: chapter.title || `Chapter ${chapter.number}`,
        url: `${mangaId}/${chapter.id}`,
        scanlator: scanlators[chapter.scanlationMangaId] || "",
        dateUpload: this.parseDate(chapter.createdAt),
      }));

    var genre = [];
    if (item.type) genre.push(item.type);
    genre = genre.concat(this.parseNames(item.genres || item.tags));

    return {
      name: item.title || item.englishTitle || "",
      link: `${this.getBaseUrl()}/manga/${mangaId}`,
      imageUrl: this.toImageUrl(item.poster || item.posterMedium || item.image),
      description: this.buildDescription(item),
      author: this.parseAuthors(item.authors, "Author") || this.parseAuthors(item.authors, null),
      artist: this.parseAuthors(item.authors, "Artist"),
      genre,
      status: this.statusCode(item.status),
      chapters,
    };
  }

  parseDate(value) {
    if (value == null) return "";
    if (typeof value == "number") return value.toString();
    var parsed = parseInt(value);
    if (!isNaN(parsed) && `${parsed}` == `${value}`) return `${parsed}`;
    var date = new Date(value.replace("T ", "T"));
    return isNaN(date.getTime()) ? "" : date.getTime().toString();
  }

  parseChapterUrl(url) {
    url = url.replace(this.getBaseUrl(), "");
    var parts = url.split("/").filter((part) => part != "");
    return {
      mangaId: parts[parts.length - 2],
      chapterId: parts[parts.length - 1],
    };
  }

  async getPageList(url) {
    var ids = this.parseChapterUrl(url);
    var body = await this.requestJson(
      `/api/read/chapter?mangaId=${encodeURIComponent(ids.mangaId)}&chapterId=${encodeURIComponent(ids.chapterId)}`
    );
    var pages = (body.readChapter && body.readChapter.pages) || [];
    var headers = this.getImageHeaders();

    return pages.map((page) => ({
      url: this.toImageUrl(page.image),
      headers,
    }));
  }

  option(name, value) {
    return { type_name: "SelectOption", name, value };
  }

  checkbox(name, value) {
    return { type_name: "CheckBox", name, value };
  }

  getYearOptions() {
    var values = [this.option("Any", "")];
    var currentYear = new Date().getFullYear();
    for (var year = currentYear; year >= 1940; year--) {
      values.push(this.option(`${year}`, `${year}`));
    }
    return values;
  }

  getFilterList() {
    return [
      {
        type_name: "SelectFilter",
        name: "Sort By",
        state: 0,
        values: [
          this.option("Popularity", "views:desc"),
          this.option("Trending", "trending:desc"),
          this.option("Date Added", "dateAdded:desc"),
          this.option("Release Date", "released:desc"),
          this.option("Top Rated", "avgRating:desc"),
          this.option("Title A-Z", "title:asc"),
          this.option("Title Z-A", "title:desc"),
        ],
      },
      {
        type_name: "GroupFilter",
        name: "Genres",
        state: ATSUMARU_GENRES.map((item) => this.checkbox(item[0], item[1])),
      },
      {
        type_name: "GroupFilter",
        name: "Tags",
        state: ATSUMARU_TAGS.map((item) => this.checkbox(item[0], item[1])),
      },
      {
        type_name: "GroupFilter",
        name: "Manga Type",
        state: [
          ["Manga", "Manga"],
          ["Manhwa", "Manwha"],
          ["Manhua", "Manhua"],
          ["OEL", "OEL"],
        ].map((item) => this.checkbox(item[0], item[1])),
      },
      {
        type_name: "GroupFilter",
        name: "Publishing Status",
        state: [
          ["Ongoing", "Ongoing"],
          ["Completed", "Completed"],
          ["Hiatus", "Hiatus"],
          ["Canceled", "Canceled"],
        ].map((item) => this.checkbox(item[0], item[1])),
      },
      {
        type_name: "SelectFilter",
        name: "Release Year",
        state: 0,
        values: this.getYearOptions(),
      },
      {
        type_name: "SelectFilter",
        name: "Minimum Chapters",
        state: 0,
        values: [
          this.option("Any", ""),
          this.option("1+", "1"),
          this.option("5+", "5"),
          this.option("10+", "10"),
          this.option("20+", "20"),
          this.option("50+", "50"),
          this.option("100+", "100"),
          this.option("200+", "200"),
          this.option("500+", "500"),
        ],
      },
      {
        type_name: "SelectFilter",
        name: "Adult Content",
        state: 0,
        values: [this.option("Hide", "false"), this.option("Show", "true")],
      },
      {
        type_name: "SelectFilter",
        name: "Official Translation",
        state: 0,
        values: [this.option("Any", "false"), this.option("Only Official", "true")],
      },
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "atsumaru_show_adult",
        switchPreferenceCompat: {
          title: "Show adult content",
          summary: "Include adult entries in browse and search results",
          value: false,
        },
      },
    ];
  }
}

const ATSUMARU_GENRES = [
  ["Action", "39"],
  ["Adult", "46"],
  ["Adventure", "37"],
  ["Boys Love", "180"],
  ["Comedy", "6"],
  ["Drama", "31"],
  ["Fantasy", "36"],
  ["Girls Love", "4"],
  ["Hentai", "10"],
  ["Historical", "45"],
  ["Horror", "44"],
  ["Martial Arts", "29"],
  ["Mystery", "32"],
  ["Psychological", "18"],
  ["Romance", "9"],
  ["Sci-Fi", "1"],
  ["Slice of Life", "7"],
  ["Smut", "41"],
  ["Supernatural", "22"],
  ["Thriller", "19"],
  ["Tragedy", "5"],
];

const ATSUMARU_TAGS = [
  ["Blackmail", "285"],
  ["Cooking", "669"],
  ["Crimes", "288"],
  ["Crossdressing", "167"],
  ["Murder", "250"],
  ["Prostitution", "366"],
  ["Swordplay", "337"],
  ["Working", "248"],
  ["Josei", "43"],
  ["Seinen", "8"],
  ["Shoujo", "40"],
  ["Shounen", "38"],
  ["Otaku", "264"],
  ["Tsundere", "313"],
  ["Yandere", "315"],
  ["Animal Characteristics", "274"],
  ["Beautiful Female Lead", "72"],
  ["Big Breasts", "123"],
  ["Flat Chest", "320"],
  ["Glasses-Wearing Male Lead", "71"],
  ["Handsome Male Lead", "68"],
  ["Kemonomimi", "279"],
  ["MILF", "339"],
  ["Small Breasts", "124"],
  ["Young Male Lead", "787"],
  ["Adult Cast", "159"],
  ["Bisexual", "382"],
  ["Ensemble Cast", "362"],
  ["Female Lead", "59"],
  ["Male Lead", "58"],
  ["Non-Human Protagonist", "247"],
  ["Primarily Adult Cast", "158"],
  ["Primarily Female Cast", "333"],
  ["Primarily Male Cast", "335"],
  ["Primarily Teen Cast", "334"],
  ["Strong Female Lead", "69"],
  ["Strong Male Lead", "67"],
  ["Adapted to Anime", "166"],
  ["Based on a Light Novel", "76"],
  ["Based on a Novel", "75"],
  ["Based on a Video Game", "77"],
  ["Based on a Web Novel", "74"],
  ["College", "257"],
  ["Company", "1205"],
  ["Countryside", "415"],
  ["Europe", "405"],
  ["Foreign", "336"],
  ["High School", "162"],
  ["Hospital", "760"],
  ["Japan", "225"],
  ["School", "107"],
  ["School Clubs", "356"],
  ["Amnesia", "283"],
  ["Appearance Different from Personality", "651"],
  ["Caught in the Act", "874"],
  ["Dead Family Member", "831"],
  ["Family Drama", "848"],
  ["Flashbacks", "449"],
  ["Gender Bender", "12"],
  ["Love Triangle", "125"],
  ["Male Lead Falls in Love First", "653"],
  ["Misunderstandings", "647"],
  ["Past Plays a Big Role", "648"],
  ["Reincarnation", "126"],
  ["Secret Identity", "260"],
  ["Time Manipulation", "311"],
  ["Time Skip", "172"],
  ["Time Travel", "249"],
  ["Tragic Past", "898"],
  ["Weak to Strong", "1064"],
  ["Delinquents", "239"],
  ["Detectives", "240"],
  ["Idols", "281"],
  ["Maids", "116"],
  ["Office Lady", "312"],
  ["Office Worker", "429"],
  ["School Girl", "788"],
  ["Teachers", "175"],
  ["Age Gap", "106"],
  ["Childhood Friends", "97"],
  ["Coworkers", "286"],
  ["Female Harem", "163"],
  ["Friends to Lovers", "243"],
  ["Friendship", "242"],
  ["Harem", "20"],
  ["Heterosexual", "108"],
  ["Incest", "174"],
  ["Infidelity", "231"],
  ["Interspecies Relationship", "308"],
  ["Love-Hate Relationship", "889"],
  ["Master-Servant Relationship", "406"],
  ["Older Female Younger Male", "114"],
  ["Older Male Younger Female", "649"],
  ["Older Uke Younger Seme", "880"],
  ["Siblings", "254"],
  ["Student-Student Relationship", "573"],
  ["Student-Teacher Relationship", "177"],
  ["Twins", "253"],
  ["Chinese Ambience", "588"],
  ["European Ambience", "450"],
  ["Fantasy World", "642"],
  ["Feudal Japan", "606"],
  ["Game Elements", "399"],
  ["Game World", "641"],
  ["Isekai", "94"],
  ["Isekaied Into a Novel", "258"],
  ["Mecha", "11"],
  ["Mythology", "259"],
  ["Urban", "338"],
  ["Urban Fantasy", "261"],
  ["Anal Intercourse", "100"],
  ["Bondage", "280"],
  ["Boobjob", "381"],
  ["Borderline H", "448"],
  ["Cunnilingus", "171"],
  ["Defloration", "306"],
  ["Dubious Consent", "985"],
  ["Ecchi", "21"],
  ["Erotica", "14"],
  ["Exhibitionism", "287"],
  ["Group Intercourse", "373"],
  ["Handjob", "303"],
  ["Lolicon", "28"],
  ["Masturbation", "161"],
  ["Mature", "15"],
  ["Nakadashi", "169"],
  ["Netorare", "232"],
  ["Nudity", "109"],
  ["Oral Intercourse", "99"],
  ["Outdoor Intercourse", "307"],
  ["Public Intercourse", "103"],
  ["Rape", "95"],
  ["Sex Addict", "650"],
  ["Sex Toys", "289"],
  ["Shotacon", "35"],
  ["Teens Love", "374"],
  ["Threesome", "173"],
  ["Virginity", "369"],
  ["Animals", "278"],
  ["Cats", "284"],
  ["Demons", "160"],
  ["Ghosts", "229"],
  ["Gods", "176"],
  ["Monsters", "395"],
  ["Non-human", "547"],
  ["Vampires", "252"],
  ["21st century", "132"],
  ["Betrayal", "403"],
  ["Bullying", "235"],
  ["Cohabitation", "228"],
  ["Coming of Age", "117"],
  ["Danmei", "305"],
  ["Depression", "1090"],
  ["Family Life", "282"],
  ["Female Empowerment", "1816"],
  ["Forbidden Love", "699"],
  ["Gore", "262"],
  ["Gourmet", "2"],
  ["Harlequin", "304"],
  ["Jealousy", "881"],
  ["LGBTQ+", "326"],
  ["Love Confession", "882"],
  ["Marriage", "360"],
  ["Mature Romance", "241"],
  ["Medical", "350"],
  ["Military", "230"],
  ["Music", "27"],
  ["Nobility", "127"],
  ["Obsessive Love", "893"],
  ["Orphans", "237"],
  ["Religion", "498"],
  ["Reunion", "984"],
  ["Revenge", "227"],
  ["Royalty", "128"],
  ["School Life", "42"],
  ["Shoujo Ai", "47"],
  ["Shounen Ai", "23"],
  ["Special Ability", "883"],
  ["Sports", "30"],
  ["Suicide", "309"],
  ["Super Powers", "236"],
  ["Unrequited Love", "226"],
  ["Violence", "830"],
  ["War", "238"],
  ["Yaoi", "16"],
  ["Yuri", "33"],
  ["4-Koma", "105"],
  ["Anthology", "113"],
  ["Chinese Novels", "1112"],
  ["Collection of Stories", "111"],
  ["Doujinshi", "24"],
  ["Episodic", "115"],
  ["Full color", "57"],
  ["Korean Novels", "1111"],
  ["Light Novel", "466"],
  ["Longstrip", "93"],
  ["One Shot", "110"],
  ["Web Comic", "428"],
  ["Web Novel", "427"],
  ["Magic", "121"],
];
