const mangayomiSources = [
  {
    "name": "yFlix",
    "id": 974098372,
    "baseUrl": "https://yflix.to",
    "lang": "all",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://yflix.to/",
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
    "pkgPath": "anime/src/all/yflix.js",
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
      "user-agent": "Mangayomi",
    };
  }

  getBaseUrl() {
    return this.getPreference("yflix_base_url");
  }

  async request(slug) {
    var url = slug;
    var baseUrl = this.getBaseUrl();
    if (!slug.includes(baseUrl)) url = baseUrl + slug;
    var res = await this.client.get(url);
    return res.body;
  }

  async getPage(slug) {
    var res = await this.request(slug);
    return new Document(res);
  }

  async searchPage({
    query = "",
    type = [],
    quality = [],
    year = [],
    genre = [],
    country = [],
    sort = "",
    page = 1,
  } = {}) {
    function bundleSlug(category, items) {
      var rd = "";
      for (var item of items) {
        rd += `&${category}[]=${item.toLowerCase()}`;
      }
      return rd;
    }

    if (sort == "") sort = "most_relevance";

    var slug = "/browser?";

    slug += "keyword=" + query;
    slug += bundleSlug("type", type);
    slug += bundleSlug("quality", quality);
    slug += bundleSlug("year", year);
    slug += bundleSlug("genre", genre);
    slug += bundleSlug("country", country);
    slug += "&sort=" + sort;
    slug += `&page=${page}`;

    var list = [];

    var body = await this.getPage(slug);

    var paginations = body.select(".pagination > li");
    var hasNextPage =
      paginations.length > 0
        ? !paginations[paginations.length - 1].className.includes("active")
        : false;

    body.select(".inner").forEach((item) => {
      var titleClass = item.selectFirst("a.title");
      var link = titleClass.getHref;
      var name = titleClass.text;
      var imageUrl = item.selectFirst("img").attr("data-src");
      list.push({ name, link, imageUrl });
    });

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchPage({ sort: "trending", page: page });
  }

  async getLatestUpdates(page) {
    return await this.searchPage({ sort: "trending", page: page });
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
    var type = isFiltersAvailable ? getFilter(filters[0].state) : [];
    var quality = isFiltersAvailable ? getFilter(filters[1].state) : [];
    var year = isFiltersAvailable ? getFilter(filters[2].state) : [];
    var genre = isFiltersAvailable ? getFilter(filters[3].state) : [];
    var country = isFiltersAvailable ? getFilter(filters[4].state) : [];
    var sort = isFiltersAvailable
      ? filters[5].values[filters[5].state].value
      : "";
    return await this.searchPage({
      query,
      type,
      quality,
      year,
      genre,
      country,
      sort,
      page,
    });
  }

  async getDetail(url) {
    var baseUrl = this.getBaseUrl();
    var slug = "/watch/" + url.split("/watch/")[1];
    var link = `${baseUrl}${slug}`;

    var body = await this.getPage(slug);
    var description = body.selectFirst("div.description.text-expand").text;
    var quality = body.selectFirst(".quality").text;
    var genre = [];
    body
      .selectFirst("ul.mics")
      .select("li")[1]
      .select("a")
      .forEach((item) => genre.push(item.text));

    var chapters = [];
    var ratingField = body.selectFirst("#movie-rating");
    var mediaId = ratingField.attr("data-id");
    var token = await this.encryptId(mediaId);
    var res = await this.request(
      `/ajax/episodes/list?id=${mediaId}&_=${token}`
    );
    body = JSON.parse(res);
    if (body.status == 200) {
      var doc = new Document(body["result"]);
      doc.select("ul").forEach((item) => {
        var seasonNum = item.attr("data-season");
        item.select("a").forEach((epItem) => {
          var token = epItem.attr("eid");
          var epText = epItem.text;
          var epTitle = epText.startsWith(" Movie")
            ? epText
            : `S${seasonNum}${epText}`;
          epTitle = epTitle.trim().replace(" EP ", "E");
          var dateUpload = new Date(epItem.attr("title"));
          var epData = {
            name: epTitle,
            url: token,
            scanlator: quality,
            dateUpload: dateUpload.valueOf().toString(),
          };
          chapters.push(epData);
        });
      });

      chapters.reverse();
    }
    return { link, description, genre, chapters };
  }

  async getVideoList(url) {
    var streams = [];
    var prefServer = this.getPreference("yflix_pref_stream_server");
    // If no server is chosen, use the default server 1
    if (prefServer.length < 1) prefServer.push("3");

    var token = await this.encryptId(url);
    var res = await this.request(`/ajax/links/list?eid=${url}&_=${token}`);
    var body = JSON.parse(res);
    if (body.status != 200) return streams;

    var serverDoc = new Document(body.result);

    for (var item of serverDoc.select("li")) {
      var serverId = item.attr("data-sid");
      if (!prefServer.includes(serverId)) continue;
      var serverCode = item.attr("data-lid");
      var serverName = item.selectFirst("span").text;
      var megaUrl = await this.getMegaUrl(serverCode);

      var serverStreams = await this.decryptMegaEmbed(megaUrl, serverName);
      streams = [...streams, ...serverStreams];
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

    // Types
    var items = ["Movie", "TV"];
    var values = ["movie", "tv"];
    filters.push({
      type_name: "GroupFilter",
      name: "Types",
      state: formateState("CheckBox", items, values),
    });

    // Quality
    items = ["HD", "HDRip", "SD", "TS", "CAM"];
    values = ["HD", "HDRip", "SD", "TS", "CAM"];
    filters.push({
      type_name: "GroupFilter",
      name: "Quality",
      state: formateState("CheckBox", items, values),
    });

    // Released
    items = [
      "2025",
      "2024",
      "2023",
      "2022",
      "2021",
      "2020",
      "2019",
      "2018",
      "2017",
      "2016",
      "2015",
      "Older",
    ];
    values = [
      "2025",
      "2024",
      "2023",
      "2022",
      "2021",
      "2020",
      "2019",
      "2018",
      "2017",
      "2016",
      "2015",
      "older",
    ];
    filters.push({
      type_name: "GroupFilter",
      name: "Released",
      state: formateState("CheckBox", items, values),
    });

    // Genre
    items = [
      "Action",
      "Adult",
      "Adventure",
      "Animation",
      "Biography",
      "Comedy",
      "Costume",
      "Crime",
      "Documentary",
      "Drama",
      "Family",
      "Fantasy",
      "Film-Noir",
      "Game-Show",
      "History",
      "Horror",
      "Kungfu",
      "Music",
      "Musical",
      "Mystery",
      "News",
      "Reality",
      "Reality-TV",
      "Romance",
      "Sci-Fi",
      "Short",
      "Sport",
      "Talk",
      "Talk-Show",
      "Thriller",
      "TV Movie",
      "TV Show",
      "War",
      "War & Politics",
      "Western",
    ];
    values = [
      "14",
      "15265",
      "109",
      "404",
      "312",
      "1",
      "50202",
      "126",
      "92",
      "12",
      "78",
      "53",
      "1779",
      "966",
      "239",
      "2",
      "67893",
      "99",
      "1809",
      "154",
      "1515",
      "6774",
      "726",
      "44",
      "162",
      "405",
      "79",
      "92400",
      "7024",
      "13",
      "18067",
      "11185",
      "436",
      "218204",
      "1443",
    ];

    filters.push({
      type_name: "GroupFilter",
      name: "Genre",
      state: formateState("CheckBox", items, values),
    });

    // Country
    items = [
      "Argentina",
      "Australia",
      "Austria",
      "Belgium",
      "Brazil",
      "Canada",
      "China",
      "Colombia",
      "Czech Republic",
      "Denmark",
      "Finland",
      "France",
      "Germany",
      "Hong Kong",
      "Hungary",
      "India",
      "Ireland",
      "Israel",
      "Italy",
      "Japan",
      "Luxembourg",
      "Mexico",
      "Netherlands",
      "New Zealand",
      "Nigeria",
      "Norway",
      "Philippines",
      "Poland",
      "Romania",
      "Russia",
      "South Africa",
      "South Korea",
      "Spain",
      "Sweden",
      "Switzerland",
      "Taiwan",
      "Thailand",
      "Turkey",
      "United Kingdom",
      "United States",
    ];
    values = [
      "3388",
      "30",
      "1791",
      "111",
      "616",
      "64",
      "350",
      "11332",
      "5187",
      "375",
      "3356",
      "16",
      "127",
      "351",
      "5042",
      "110",
      "225",
      "1617",
      "163",
      "291",
      "8087",
      "1727",
      "867",
      "1616",
      "1618",
      "3357",
      "4141",
      "5600",
      "5730",
      "6646",
      "1541",
      "360",
      "240",
      "1728",
      "2521",
      "3564",
      "9360",
      "881",
      "15",
      "3",
    ];

    filters.push({
      type_name: "GroupFilter",
      name: "Country",
      state: formateState("CheckBox", items, values),
    });

    // Sort
    items = [
      "Updated date",
      "Added date",
      "Release date",
      "Trending",
      "Name A-Z",
      "Average score",
      "IMDb",
      "Total views",
      "Total bookmarks",
    ];

    values = [
      "updated_date",
      "added_date",
      "release_date",
      "trending",
      "title_az",
      "score",
      "imdb",
      "total_views",
      "total_bookmarks",
    ];

    filters.push({
      type_name: "SelectFilter",
      name: "Sort by",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    return filters;
  }

  getSourcePreferences() {
    return [
      {
        key: "yflix_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://yflix.to",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "yflix_pref_stream_server",
        multiSelectListPreference: {
          title: "Preferred server",
          summary: "Choose the server/s you want to extract streams from",
          values: ["3"],
          entries: ["Server 1", "Server 2"],
          entryValues: ["3", "2"],
        },
      },

      {
        key: "yflix_pref_extract_streams",
        switchPreferenceCompat: {
          title: "Split stream into different quality streams",
          summary: "Split stream Auto into 360p/720p/1080p",
          value: true,
        },
      },
    ];
  }

  async formatStreams(sUrl, serverName) {
    function streamNamer(res) {
      return `${res} : ${serverName}`;
    }

    var streams = [
      {
        url: sUrl,
        originalUrl: sUrl,
        quality: streamNamer("Auto"),
      },
    ];

    var pref = this.getPreference("yflix_pref_extract_streams");
    if (!pref) return streams;

    var baseUrl = sUrl.split("/list.m3u8")[0].split("/list,")[0];

    const response = await new Client().get(sUrl);
    const body = response.body;
    const lines = body.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
        var resolution = lines[i].match(/RESOLUTION=(\d+x\d+)/)[1];
        var qUrl = lines[i + 1].trim();
        var m3u8Url = `${baseUrl}/${qUrl}`;
        streams.push({
          url: m3u8Url,
          originalUrl: m3u8Url,
          quality: streamNamer(resolution),
        });
      }
    }
    return streams;
  }

  async getMegaUrl(vidId) {
    var token = await this.encryptId(vidId);
    var res = await this.request(`/ajax/links/view?id=${vidId}&_=${token}`);
    var body = JSON.parse(res);
    if (body.status != 200) return;
    var outEnc = body.result;
    var out = await this.decryptId(outEnc);
    return out.url;
  }

  async decryptMegaEmbed(megaUrl, serverName) {
    var hdr = this.getHeaders();
    var streams = [];
    megaUrl = megaUrl.replace("/e/", "/media/");
    var res = await this.client.get(megaUrl, hdr);
    var body = JSON.parse(res.body);
    if (body.status != 200) return;
    var outEnc = body.result;
    var streamData = await this.megaDecrypt(outEnc);
    var url = streamData.sources[0].file;

    var streams = await this.formatStreams(url, serverName);
    var subtitles = streamData.tracks;
    if (megaUrl.includes("sub.list")) {
      var encSubUrl = megaUrl.split("?sub.list=")[1];
      const subUrl = decodeURIComponent(encSubUrl);
      var subRes = await this.request(subUrl);
      subtitles = JSON.parse(subRes);
    }

    streams[0].subtitles = this.formatSubtitles(subtitles);
    return streams;
  }

  formatSubtitles(subtitles) {
    var subs = [];
    subtitles.forEach((sub) => {
      if (!sub.kind.includes("thumbnail")) {
        subs.push({
          file: sub.file,
          label: `${sub.label}`,
        });
      }
    });

    return subs;
  }

  //----------------Decoders----------------
  // Credits :- https://github.com/AzartX47/EncDecEndpoints

  async patternExecutor(key, type, data) {
    var hdr = {};
    var api = "https://enc-dec.app/api";
    var url = `${api}/${type}`;
    var result = null;
    if (key == "yf") {
      var url = `${url}?text=${data}`;
      var res = await this.client.get(url, hdr);
      result = res.body;
    } else {
      hdr["Content-Type"] = "application/json";
      var res = await this.client.post(url, hdr, data);
      result = res.body;
    }
    return result != null ? JSON.parse(result)["result"] : null;
  }

  async encryptId(id) {
    return await this.patternExecutor("yf", "enc-movies-flix", id);
  }

  async decryptId(id) {
    return await this.patternExecutor("yf", "dec-movies-flix", id);
  }

  async megaDecrypt(data) {
    var hdr = this.getHeaders();
    var body = { "text": data, "agent": hdr["user-agent"] };
    var streamData = await this.patternExecutor("megaup", "dec-mega", body);
    return streamData;
  }
}
