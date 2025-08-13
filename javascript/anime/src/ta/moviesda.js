const mangayomiSources = [
  {
    "name": "Moviesda",
    "id": 3570935492,
    "baseUrl": "https://moviesda12.net",
    "lang": "ta",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://moviesda12.com/",
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
    return "https://moviesda12.net";
  }

  removeProxy(url) {
    var slug = url.substring(url.indexOf("translate.goog") + 14);
    var ind = slug.indexOf("?_x_tr_sl");
    if (ind > 0) {
      return slug.substring(0, ind);
    }
    return slug;
  }

  async request(slug) {
    var proxy =
      "https://translate.google.com/translate?sl=ta&tl=en&hl=en&client=webapp&u=";
    var baseUrl = this.getBaseUrl();
    var req = await this.client.get(proxy + baseUrl + slug);
    return new Document(req.body);
  }

  generateImageUrl(slug) {
    var baseUrl = this.getBaseUrl();
    var imageSlug = slug.replace("-movie-download/", ".webp");
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
    throw new Error("search not implemented");
  }

  async formatChapters(doc, releaseDate) {
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

      var listItems = item.select("li");

      contentName = isSeries
        ? listItems[0].text.replace("Moviesda.Mobi - ", "").replace(".mp4", "")
        : contentName;
      var seasonIndx = contentName.indexOf("Season ");
      contentName =
        seasonIndx > 0 ? contentName.substring(seasonIndx) : contentName;

      var fileSize = listItems[1].text.replace("File Size: ", "");
      chapters.push({
        name: contentName,
        url: contentLink,
        dateUpload: releaseDate.toString(),
        scanlator: fileSize,
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
    var author = "";
    var artist = "";
    var releaseDate = "";
    var status = 1;
    var genre = [];

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

    chapters = await this.formatChapters(doc, releaseDate);

    return { link, author, description, artist, genre, status, chapters };
  }

  async getVideoList(url) {
    throw new Error("getVideoList not implemented");
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

  getSourcePreferences() {
    throw new Error("getSourcePreferences not implemented");
  }
}
