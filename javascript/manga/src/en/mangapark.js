const mangayomiSources = [
  {
    "name": "Mangapark",
    "id": 2302366102,
    "baseUrl": "https://mangapark.io",
    "lang": "en",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://mangapark.io",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "1.0.1",
    "isManga": true,
    "itemType": 0,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "manga/src/en/mangapark.js",
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
    var cookies = "nsfw=" + this.getPreference("mangapark_browsing_mode");
    return {
      "Referer": url,
      "Origin": url,
      "Cookie": cookies,
    };
  }

  getBaseUrl() {
    return this.getPreference("mangapark_override_base_url");
  }

  async request(slug, cookies = null) {
    var baseUrl = this.getBaseUrl();
    var url = baseUrl + slug;
    var headers = this.getHeaders(url);
    if (cookies) {
      headers["Cookie"] += `;${cookies}`;
    }

    var res = await this.client.get(url, headers);
    if (res.statusCode == 200) {
      return new Document(res.body);
    }
    throw new Error(`${slug} returned status code ${res.statusCode}`);
  }

  async searchPage({
    query = "",
    sort = "field_create",
    genres = [],
    ogStatus = "",
    mpStatus = "",
    chapterCount = "",
    page = 1,
  } = {}) {
    function addSlug(para, value) {
      var q = "";
      if (value.length > 0) {
        q = `&${para}=${value}`;
      }
      return q;
    }
    var baseUrl = this.getBaseUrl();
    var slug = "/search?";
    slug += `sortby=${sort}`;
    slug += addSlug("word", query);
    slug += addSlug("genres", genres.join(","));
    slug += addSlug("status", ogStatus);
    slug += addSlug("upload", mpStatus);
    slug += addSlug("chapters", chapterCount);
    slug += `&page=${page}`;

    var doc = await this.request(slug);

    var list = [];
    var hasNextPage = false;

    doc.select(".shrink-0.basis-20").forEach((item) => {
      var link = item.selectFirst("a").getHref;
      var imgSection = item.selectFirst("img");
      var name = imgSection.attr("title");
      var imageUrl = baseUrl + imgSection.getSrc;
      list.push({ link, name, imageUrl });
    });

    var navPages = doc
      .selectFirst(
        ".flex.items-center.flex-wrap.space-x-1.my-10.justify-center"
      )
      .select("a");

    hasNextPage = !(navPages[navPages.length - 1]?.text == `${page}`);

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchPage({ sort: "views_h001", page: page });
  }

  async getLatestUpdates(page) {
    return await this.searchPage({ sort: "field_update", page: page });
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
    var sort = isFiltersAvailable
      ? filters[0].values[filters[0].state].value
      : "field_create";
    var genres = isFiltersAvailable ? getFilter(filters[1].state) : [];
    var ogStatus = isFiltersAvailable
      ? filters[2].values[filters[2].state].value
      : "";
    var mpStatus = isFiltersAvailable
      ? filters[3].values[filters[3].state].value
      : "";
    var chapterCount = isFiltersAvailable
      ? filters[4].values[filters[4].state].value
      : "";

    return await this.searchPage({
      query,
      sort,
      genres,
      ogStatus,
      mpStatus,
      chapterCount,
      page,
    });
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          Ongoing: 0,
          Complete: 1,
          Hiatus: 2,
          Canceled: 3,
        }[status] ?? 5
      );
    }
    var baseUrl = this.getBaseUrl();
    url = url.replace(baseUrl, "");
    var link = baseUrl + url;

    var doc = await this.request(url);
    var name = doc
      .selectFirst(".text-lg.font-bold")
      .selectFirst("a")
      .text.trim();
    var imageUrl =
      baseUrl + doc.selectFirst(".w-full.not-prose.shadow-md").getSrc;
    var description = doc.selectFirst(".limit-html-p").text.trim();
    var statusText = doc.selectFirst(".font-bold.uppercase.text-success").text;
    var status = statusCode(statusText);
    var genre = [];
    doc
      .selectFirst(".flex.items-center.flex-wrap")
      .select("span")
      .forEach((span) => genre.push(span.text.trim()));

    var chapters = [];
    doc.select(".px-2.py-2.flex.flex-wrap").forEach((item) => {
      var chapSection = item.selectFirst("div").selectFirst("a");
      var chapLink = chapSection.getHref;
      var chapTitle = chapSection.text.trim();
      var dateUpload = item.selectFirst("time").attr("data-time");

      chapters.push({ url: chapLink, name: chapTitle, dateUpload });
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

  async getPageList(url) {
    var imgServer = "imgser=" + this.getPreference("mangapark_image_server");
    var cookies = `wd=1521x748;${imgServer};`;
    var doc = await this.request(url, cookies);

    var images = [];
    doc
      .selectFirst(".grid.gap-0")
      .select("img")
      .forEach((img) => images.push(img.getSrc));

    return images;
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
    items = [
      "Rating Score",
      "Most Follows",
      "Most Reviews",
      "Most Comments",
      "Most Chapters",
      "New Chapters",
      "Recently Created",
      "Views in 60 minutes",
      "Views in 6 hours",
      "Views in 12 hours",
      "Views in 24 hours",
      "Views in 7 days",
      "Views in 30 days",
      "Views in 90 days",
      "Views in 180 days",
      "Views in 360 days",
      "Views in Total",
      "Emote - Awesome",
      "Emote - Funny",
      "Emote - Love",
      "Emote - Hot",
      "Emote - Sweet",
      "Emote - Cool",
      "Emote - Scared",
      "Emote - Angry",
      "Emote - Sad",
    ];

    values = [
      "field_score",
      "field_follow",
      "field_review",
      "field_comment",
      "field_chapter",
      "field_update",
      "field_create",
      "field_name",
      "views_h001",
      "views_h006",
      "views_h012",
      "views_h024",
      "views_d007",
      "views_d030",
      "views_d090",
      "views_d180",
      "views_d360",
      "views_d000",
      "emotion_e1",
      "emotion_e2",
      "emotion_e3",
      "emotion_e4",
      "emotion_e5",
      "emotion_e6",
      "emotion_e7",
      "emotion_e8",
      "emotion_e9",
    ];
    filters.push({
      type_name: "SelectFilter",
      name: "Sort by",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Genre
    items = [
      "Artbook",
      "Cartoon",
      "Comic",
      "Doujinshi",
      "Imageset",
      "Manga",
      "Manhua",
      "Manhwa",
      "Webtoon",
      "Western",
      "Oneshot",
      "4-Koma",
      "Art-by-AI",
      "Story-by-AI",
      "Shoujo(G)",
      "Shounen(B)",
      "Josei(W)",
      "Seinen(M)",
      "Yuri(GL)",
      "Yaoi(BL)",
      "Futa(⚤)",
      "Bara(ML)",
      "Kodomo(Kid)",
      "Silver & Golden",
      "Shoujo ai",
      "Shounen ai",
      "Non-human",
      "Gore",
      "Bloody",
      "Violence",
      "Ecchi",
      "Adult",
      "Mature",
      "Smut",
      "Action",
      "Adaptation",
      "Adventure",
      "Age Gap",
      "Aliens",
      "Animals",
      "Anthology",
      "Beasts",
      "Bodyswap",
      "Blackmail",
      "Brocon/Siscon",
      "Cars",
      "Cheating/Infidelity",
      "Childhood Friends",
      "College life",
      "Comedy",
      "Contest winning",
      "Cooking",
      "Crime",
      "Crossdressing",
      "Cultivation",
      "Death Game",
      "DegenerateMC",
      "Delinquents",
      "Dementia",
      "Demons",
      "Drama",
      "Fantasy",
      "Fan-Colored",
      "Fetish",
      "Full Color",
      "Loli",
      "Magic",
      "Magical Girls",
      "Martial Arts",
      "Master-Servant",
      "Mecha",
      "Medical",
      "Military",
      "Monster Girls",
      "Monsters",
      "Music",
      "Mystery",
      "Netori",
      "Netorare/NTR",
      "Ninja",
      "Office Workers",
      "Omegaverse",
      "Parody",
      "Showbiz",
      "Slice of Life",
      "SM/BDSM",
      "Space",
      "Sports",
      "Spy",
      "Step Family",
      "Super Power",
      "Superhero",
      "Supernatural",
      "Survival",
      "Teacher-Student",
      "Thriller",
      "Time Travel",
      "Traditional Games",
      "Tragedy",
      "Vampires",
      "Video Games",
    ];
    values = [
      "artbook",
      "cartoon",
      "comic",
      "doujinshi",
      "imageset",
      "manga",
      "manhua",
      "manhwa",
      "webtoon",
      "western",
      "oneshot",
      "_4_koma",
      "ai_art",
      "ai_story",
      "shoujo",
      "shounen",
      "josei",
      "seinen",
      "yuri",
      "yaoi",
      "futa",
      "bara",
      "kodomo",
      "old_people",
      "shoujo_ai",
      "shounen_ai",
      "non_human",
      "gore",
      "bloody",
      "violence",
      "ecchi",
      "adult",
      "mature",
      "smut",
      "action",
      "adaptation",
      "adventure",
      "age_gap",
      "aliens",
      "animals",
      "anthology",
      "beasts",
      "bodyswap",
      "blackmail",
      "brocon_siscon",
      "cars",
      "cheating_infidelity",
      "childhood_friends",
      "college_life",
      "comedy",
      "contest_winning",
      "cooking",
      "crime",
      "crossdressing",
      "cultivation",
      "death_game",
      "degeneratemc",
      "delinquents",
      "dementia",
      "demons",
      "drama",
      "fantasy",
      "fan_colored",
      "fetish",
      "full_color",
      "loli",
      "magic",
      "magical_girls",
      "martial_arts",
      "master_servant",
      "mecha",
      "medical",
      "military",
      "monster_girls",
      "monsters",
      "music",
      "mystery",
      "netori",
      "netorare",
      "ninja",
      "office_workers",
      "omegaverse",
      "parody",
      "showbiz",
      "slice_of_life",
      "sm_bdsm",
      "space",
      "sports",
      "spy",
      "step_family",
      "super_power",
      "superhero",
      "supernatural",
      "survival",
      "teacher_student",
      "thriller",
      "time_travel",
      "traditional_games",
      "tragedy",
      "vampires",
      "video_games",
    ];
    filters.push({
      type_name: "GroupFilter",
      name: "Genres",
      state: formateState("CheckBox", items, values),
    });

    // Original work Status
    items = ["Any", "Pending", "Ongoing", "Completed", "Hiatus", "Cancelled"];
    values = ["", "pending", "ongoing", "completed", "hiatus", "cancelled"];
    filters.push({
      type_name: "SelectFilter",
      name: "Original work status",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // MPark upload Status
    items = ["Any", "Pending", "Ongoing", "Completed", "Hiatus", "Cancelled"];
    values = ["", "pending", "ongoing", "completed", "hiatus", "cancelled"];
    filters.push({
      type_name: "SelectFilter",
      name: "MPark upload Status",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Number of chapters
    items = [
      "Any",
      "0",
      "1+",
      "10+",
      "20+",
      "30+",
      "40+",
      "50+",
      "60+",
      "70+",
      "80+",
      "90+",
      "100+",
      "200+",
      "300+",
      "299~200",
      "199~100",
      "99~90",
      "89~80",
      "79~70",
      "69~60",
      "59~50",
      "49~40",
      "39~30",
      "29~20",
      "19~10",
      "9~1",
    ];

    values = [
      "",
      "0",
      "1",
      "10",
      "20",
      "30",
      "40",
      "50",
      "60",
      "70",
      "80",
      "90",
      "100",
      "200",
      "300",
      "200-299",
      "100-199",
      "90-99",
      "80-89",
      "70-79",
      "60-69",
      "50-59",
      "40-49",
      "30-39",
      "20-29",
      "10-19",
      "1-9",
    ];

    filters.push({
      type_name: "SelectFilter",
      name: "Number of chapters",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    return filters;
  }

  getSourcePreferences() {
    return [
      {
        key: "mangapark_override_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "Default: https://mangapark.io",
          value: "https://mangapark.io/",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "mangapark_browsing_mode",
        listPreference: {
          title: "Browsing mode",
          summary: "",
          valueIndex: 0,
          entries: ["Don't show NFSW content", "Show NFSW content"],
          entryValues: ["0", "2"],
        },
      },
      {
        key: "mangapark_image_server",
        listPreference: {
          title: "Image server",
          summary: "",
          valueIndex: 0,
          entries: [
            "mpfip.org",
            "mpizz.org",
            "mpmok.org",
            "mpqom.org",
            "mpqsc.org",
            "mprnm.org",
            "mpubn.org",
            "mpujj.org",
            "mpvim.org",
            "mpypl.org",
          ],
          entryValues: [
            "mpfip.org",
            "mpizz.org",
            "mpmok.org",
            "mpqom.org",
            "mpqsc.org",
            "mprnm.org",
            "mpubn.org",
            "mpujj.org",
            "mpvim.org",
            "mpypl.org",
          ],
        },
      },
    ];
  }
}
