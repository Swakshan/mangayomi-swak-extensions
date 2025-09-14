const mangayomiSources = [
  {
    "name": "Moviesda",
    "id": 3570935492,
    "baseUrl": "https://moviesda12.net",
    "lang": "ta",
    "typeSource": "single",
    "iconUrl":
      "https://raw.github.com/Swakshan/mangayomi-swak-extensions/main/javascript/icon/ta.moviesda.jpg",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "1.2.0",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/ta/moviesda.js",
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

  getBaseUrl() {
    return this.getPreference("moviesda_base_url");
  }

  removeProxy(url) {
    var slug = url;
    var proxyStart = url.indexOf("translate.goog");
    if (proxyStart > 0) {
      var slug = slug.substring(url.indexOf("translate.goog") + 14);
      var ind = slug.indexOf("?_x_tr_sl");
      if (ind > 0) {
        return slug.substring(0, ind);
      }
    }
    return slug;
  }

  async request(slug) {
    var proxy =
      "https://translate.google.com/translate?sl=ta&tl=en&hl=en&client=webapp&u=";
    var baseUrl = slug.includes("https://") ? "" : this.getBaseUrl();
    var req = await this.client.get(baseUrl + slug);
    return new Document(req.body);
  }

  generateImageUrl(slug) {
    var baseUrl = this.getBaseUrl();
    var imageSlug = slug
      .replace("-movie/", ".webp");
    return baseUrl + "/uploads/posters" + imageSlug;
  }

  async getPageData(slug, page) {
    slug += `?page=${page}`;
    var doc = await this.request(slug);
    var list = [];

    for (var item of doc.select("div.f")) {
      var a = item.selectFirst("a");
      var name = a.text;
      if (name.includes("திரைப்படங்களுக்கு") || name.includes("Movies Page")) {
        continue;
      }

      var link = this.removeProxy(a.getHref);
      var imageUrl = this.generateImageUrl(link);
      list.push({ name, imageUrl, link });
    }

    var hasNextPage = !!doc.selectFirst("a.pagination_next").getHref;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    var currentYear = new Date().getFullYear();
    var slug = `/tamil-${currentYear}-movies/`;
    return await this.getPageData(slug, page);
  }

  async getLatestUpdates(page) {
    var currentYear = new Date().getFullYear();
    var slug = `/tamil-${currentYear}-movies/`;
    return await this.getPageData(slug, page);
  }

  async search(query, page, filters) {
    function getSelectFilter(filter) {
      if (filter.type_name != "SelectFilter") return "";
      var selectValue = filter.state;
      var values = filter.values;
      var selectValue = values[selectValue]["value"];
      return selectValue;
    }

    var isFiltersAvailable = !filters || filters.length != 0;

    if ((!!query && query.length > 0) || !isFiltersAvailable)
      throw new Error(
        "This website doesnt has search feature :(\nUse Filters instead"
      );

    for (var filter of filters) {
      var slug = getSelectFilter(filter);
      if (slug.length) return await this.getPageData(slug, page);
    }
    throw new Error("Please select an filter category");
  }

  async formatChapters(doc, movieName, quality, releaseDate) {
    // If series .mv-content is present
    var isSeries = !!doc.selectFirst(".mv-content").text;
    var items = doc.select(".f");
    var chapters = [];

    for (var item of items) {
      var a = item.selectFirst("a");
      var contentLink = this.removeProxy(a.getHref);
      var contentName = "";
      if (!isSeries) {
        var innerDoc = await this.request(contentLink);
        a = innerDoc.selectFirst(".f").selectFirst("a");
        contentLink = this.removeProxy(a.getHref);
        contentName = innerDoc.selectFirst("main .line").text.trim();
        item = innerDoc.selectFirst(".f");
      }

      var contentData = {};
      contentData["title"] = movieName;
      contentData["link"] = contentLink;

      var listItems = item.select("li");
      if (isSeries) {
        contentName = listItems[0].text;
        const regex = /-\s*(.*?)\s+Season\s+(\d+)\s+\(Epi\s+(\d+)\)/i;
        var match = contentName.match(regex);

        if (match) {
          var season = parseInt(match[2], 10).toString().padStart(2, "0");
          var episode = parseInt(match[3], 10).toString().padStart(2, "0");

          contentName = `S${season}E${episode}`;
          contentData["season"] = season;
          contentData["episode"] = episode;
        }
      } else {
        contentName = contentName
          .substring(contentName.indexOf(" (") + 2, contentName.length - 1)
          .replace(" HD", ` ${quality}`);
      }

      var fileSize = listItems[1].text.replace("File Size: ", "");

      chapters.push({
        name: contentName,
        url: JSON.stringify(contentData),
        dateUpload: releaseDate.toString(),
        scanlator: `${quality}, ${fileSize}`,
      });
    }

    // Some series has multiple pages
    if (isSeries) {
      var nextPage = doc.selectFirst(".pagination_next");
      if (!!nextPage) {
        var pageUrl = this.removeProxy(nextPage.getHref);

        if (pageUrl.length > 0) {
          doc = await this.request(pageUrl);
          var moreChapters = await this.formatChapters(doc, releaseDate);
          chapters.push(...moreChapters);
        }
      }
    }

    return chapters;
  }

  async getDetail(url) {
    var baseUrl = this.getBaseUrl();
    var slug = url.replace(baseUrl, "");
    var link = baseUrl + slug;

    var doc = await this.request(slug);
    var movieName = "";
    var author = "";
    var artist = "";
    var releaseDate = "";
    var status = 1;
    var genre = [];
    var quality = "";

    doc
      .selectFirst(".movie-info")
      .select("li")
      .forEach((li) => {
        var title = li.selectFirst("strong").text;
        var span = li.selectFirst("span").text;
        if (title.includes("Starring:")) {
          artist = span;
        } else if (title.includes("Director:")) {
          author = span;
        } else if (title.includes("Genres:")) {
          genre = span.split(", ");
        } else if (title.includes("Last Updated:")) {
          releaseDate = new Date(span).valueOf();
        } else if (title.includes("Quality:")) {
          quality = span;
        } else if (title.includes("Movie:")) {
          movieName = span;
        }
      });
    var description =
      doc
        .selectFirst(".movie-synopsis")
        .text.trim()
        .replace("Synopsis: ", "") || "";

    var chapters = [];
    var vidLink = doc.selectFirst(".f").selectFirst("a").getHref;
    vidLink = this.removeProxy(vidLink);
    doc = await this.request(vidLink);

    chapters = await this.formatChapters(doc, movieName, quality, releaseDate);

    return { link, author, description, artist, genre, status, chapters };
  }

  async getVideoList(url) {
    var jsonData = JSON.parse(url);

    url = jsonData["link"];
    var streams = [];
    var doc = await this.request(url);
    var dlink = doc.selectFirst(".dlink").selectFirst("a").getHref;
    var fileId = dlink.substring(dlink.indexOf("/download/file/") + 15);

    var finalPage = `https://download.moviespage.site/download/page/${fileId}`;
    var req = await this.client.get(finalPage);
    doc = new Document(req.body);
    var streamUrl = doc.selectFirst(".dlink").selectFirst("a").getHref;

    var details = doc.select(".details");
    var fileSize = details[1].text.trim().replace("File Size: ", "");
    var resolution = details[2].text.trim().replace("Video Size: ", "");
    streams.push({
      url: streamUrl,
      originalUrl: streamUrl,
      quality: `Download Server: ${resolution} - ${fileSize}`,
    });

    var embedUrl = `https://play.onestream.watch/stream/page/${fileId}`;
    var req = await this.client.get(embedUrl);
    doc = new Document(req.body);
    streamUrl = doc.selectFirst("source").attr("src");
    streams.push({
      url: streamUrl,
      originalUrl: streamUrl,
      quality: `Watch Online Server: Media`,
    });

    if (this.getPreference("moviesda_fetch_subtitle")) {
      var imdbId = await this.getImdbID(jsonData);
      if (imdbId != "0") {
        var s = "0";
        var e = s;
        if (jsonData.hasOwnProperty("season")) {
          s = jsonData["season"];
          e = jsonData["episode"];
        }
        var subs = await this.getSubtitleList(imdbId, s, e);
        streams[0].subtitles = subs;
      }
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

    function formFilters(name, items, values) {
      items.unshift("None");
      values.unshift("");

      return {
        type_name: "SelectFilter",
        name: `${name} collection`,
        state: 0,
        values: formateState("SelectOption", items, values),
      };
    }

    var filters = [
      {
        type_name: "HeaderFilter",
        name: "Choose any ONE type of collction. Multicollection filter is NOT SUPPORTED !!",
      },
    ];

    // Years
    const currentYear = new Date().getFullYear();
    var years = Array.from({ length: currentYear - 2014 }, (_, i) =>
      (2015 + i).toString()
    ).reverse();
    var items = [...years, "2012"];
    var values = items.map((year) => `/tamil-${year}-movies/`);
    filters.push(formFilters("Year", items, values));

    // Alphabet
    items = Array.from({ length: 26 }, (_, i) => String.fromCharCode(i + 97));
    values = items.map((abc) => `/tamil-movies/${abc}/`);
    filters.push(formFilters("Alphabet", items, values));

    // Collections
    items = [
      "Thala Ajith",
      "MGR",
      "Madhavan",
      "Arjun",
      "Jiiva",
      "Jayam Ravi",
      "Vishal",
      "Silambarasan",
      "Vijay Sethupathi",
      "Dhanush",
      "Suriya",
      "Vijayakanth Movie Collections",
      "Rajinikanth Movie Collections",
      "Chiyaan Vikram Movie Collections",
      "Kamal Haasan Movie Collections",
      "Sasikumar",
      "Nakul",
      "Siddharth",
      "Cheran",
      "Vimal",
      "Vijay",
      "Ramarajan",
      "Simbu",
      "Sathiyaraj",
      "Appukutty",
      "Surya",
      "Murali",
      "Mohan",
      "Sarathkumar",
      "Bhagyaraj",
      "MGR",
      "Vishal",
      "Vijayakanth",
      "Sivakarthikeyan",
      "Prashanth",
      "Prabhu",
      "Prabhu Deva",
      "Parthiepan",
      "Kamal Hassan",
      "Arjun",
      "Rajinikanth",
      "Madhavan",
      "Vikram Movie Collections",
      "Jeeva",
      "Dhaunsh",
      "Dinesh",
      "Vijay Sethupathi",
      "Arya",
      "Jayam Ravi",
      "Ajith",
      "Karthik",
      "Rajkiran",
      "Karthi",
      "Sivaji Ganesan",
      "Kunal",
    ];

    var values = [
      "/thala-ajith-movies-collection-download/",
      "/mgr-movies-collection-download/",
      "/madhavan-movies-collection-download/",
      "/arjun-movies-collection-download/",
      "/jiiva-movies-collection-download/",
      "/jayam-ravi-movies-collection-download/",
      "/vishal-movies-collection-download/",
      "/silambarasan-movies-collection-download/",
      "/vijay-sethupathi-movies-collection-download/",
      "/dhanush-movies-collection-download/",
      "/suriya-movies-collections-download/",
      "/vijayakanth-movie-collections-download/",
      "/rajinikanth-movie-collections-download/",
      "/chiyaan-vikram-movie-collections-download/",
      "/kamal-haasan-movie-collections-download/",
      "/actor-sasikumar-movies-collections/",
      "/actor-nakul-movies-collections/",
      "/actor-siddharth-movies-collection/",
      "/actor-cheran-movies-collection/",
      "/actor-vimal-movies-collection/",
      "/actor-vijay-movies-collection/",
      "/actor-ramarajan-movies-collection/",
      "/actor-simbu-movies-collection/",
      "/actor-sathiyaraj-movies-collection/",
      "/actor-appukutty-movies-collection/",
      "/actor-surya-movies-collection/",
      "/actor-murali-movies-collection/",
      "/actor-mohan-movies-collection/",
      "/actor-sarathkumar-movies-collection/",
      "/actor-bhagyaraj-movies-collection/",
      "/actor-mgr-movies-collection/",
      "/actor-vishal-movies-collection/",
      "/actor-vijayakanth-movies-collection/",
      "/actor-sivakarthikeyan-movies-collection/",
      "/actor-prashanth-movies-collection/",
      "/actor-prabhu-movies-collection/",
      "/actor-prabhu-deva-movies-collection/",
      "/actor-parthiepan-movies-collection/",
      "/actor-kamal-hassan-movies-collection/",
      "/actor-arjun-movies-collection/",
      "/actor-rajinikanth-movies-collection/",
      "/actor-madhavan-movies-collection/",
      "/actor-vikram-movie-collections/",
      "/actor-jeeva-movies-collection/",
      "/actor-dhaunsh-movies-collection/",
      "/actor-dinesh-movies-collection/",
      "/actor-vijay-sethupathi-movies-collection/",
      "/actor-arya-movies-collection/",
      "/actor-jayam-ravi-movies-collection/",
      "/actor-ajith-movies-collection/",
      "/actor-karthik-movies-collection/",
      "/actor-rajkiran-movies-collection/",
      "/actor-karthi-movies-collection/",
      "/actor-sivaji-ganesan-movies-collection/",
      "/actor-kunal-movies-collection/",
    ];

    filters.push(formFilters("Actor", items, values));

    //Other collections
    items = ["Tamil Dubbed", "HD Movies"];
    values = ["/tamil-dubbed-movies/", "/tamil-hd-movies-download/"];
    filters.push(formFilters("Other", items, values));

    return filters;
  }

  getSourcePreferences() {
    return [
      {
        key: "moviesda_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://1moviesda.io",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "moviesda_fetch_subtitle",
        switchPreferenceCompat: {
          title: "Fetch subtitles",
          summary:
            "Turning this on affects downloading. Use it only for streaming",
          value: false,
        },
      },
    ];
  }

  //---------Additional functions------------
  async getImdbID(data) {
    var imdbId = "0";
    var category = data.hasOwnProperty("season") ? "tvSeries" : "movie";
    var title = data["title"];
    // Sometimes there wont be any title provided
    if (title.length < 1) return imdbId;
    var api = `https://v3.sg.media-imdb.com/suggestion/x/${title}.json?includeVideos=0`;
    var res = await this.client.get(api);
    if (res.statusCode != 200) {
      return imdbId;
    }
    var jsonD = JSON.parse(res.body);
    var imdbData = jsonD["d"];

    for (var info of imdbData) {
      // if qid is not present continue
      if (!info.hasOwnProperty("qid")) continue;
      var qid = info["qid"];
      // if qid is not the category we want then continue
      if (qid != category) continue;
      imdbId = info["id"];
    }
    return imdbId;
  }

  async getSubtitleList(id, s, e) {
    var api = `https://sub.wyzie.ru/search?id=${id}`;
    var hdr = {};

    if (s != "0") api = `${api}&season=${s}&episode=${e}`;

    var response = await new Client().get(api, hdr);
    if (response.statusCode != 200) return [];

    var body = JSON.parse(response.body);

    var subs = [];
    body.forEach((sub) => {
      subs.push({
        file: sub.url,
        label: sub.display,
      });
    });

    return subs;
  }

  // End
}
