const mangayomiSources = [
  {
    "name": "ReadComicOnline",
    "lang": "en",
    "id": 376287717,
    "baseUrl": "https://readcomiconline.li",
    "apiUrl": "",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://readcomiconline.li/",
    "typeSource": "single",
    "isManga": true,
    "itemType": 0,
    "version": "0.2.5",
    "pkgPath": "manga/src/en/readcomiconline.js",
  },
];

// Authors: - Swakshan, kodjodevf

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
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6832.64 Safari/537.36",
      Referer: this.source.baseUrl,
      Origin: this.source.baseUrl,
    };
  }

  async request(slug) {
    var url = slug;
    var baseUrl = this.source.baseUrl;
    if (!slug.includes(baseUrl)) url = baseUrl + slug;
    var res = await this.client.get(url, this.getHeaders());
    return new Document(res.body);
  }

  async getListPage(slug, page) {
    var url = `${slug}page=${page}`;
    var doc = await this.request(url);
    var baseUrl = this.source.baseUrl;
    var list = [];

    var comicList = doc.select(".list-comic > .item");
    comicList.forEach((item) => {
      var name = item.selectFirst(".title").text;
      var link = item.selectFirst("a").getHref;
      var imageSlug = item.selectFirst("img").getSrc;
      var imageUrl = imageSlug.includes("http")
        ? imageSlug
        : `${baseUrl}${imageSlug}`;
      list.push({ name, link, imageUrl });
    });

    var pager = doc.select("ul.pager > li");

    var hasNextPage = false;
    if (pager.length > 0)
      hasNextPage = pager[pager.length - 1].text.includes("Last")
        ? true
        : false;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.getListPage("/ComicList/MostPopular?", page);
  }
  get supportsLatest() {
    throw new Error("supportsLatest not implemented");
  }
  async getLatestUpdates(page) {
    return await this.getListPage("/ComicList/LatestUpdate?", page);
  }
  async search(query, page, filters) {
    function getFilter(state) {
      var rd = "";
      state.forEach((item) => {
        if (item.state) {
          rd += `${item.value},`;
        }
      });
      return rd.slice(0, -1);
    }

    var isFiltersAvailable = !filters || filters.length != 0;
    var genre = isFiltersAvailable ? getFilter(filters[0].state) : [];
    var status = isFiltersAvailable
      ? filters[1].values[filters[1].state].value
      : "";
    var year = isFiltersAvailable
      ? filters[2].values[filters[2].state].value
      : "";

    var slug = `/AdvanceSearch?comicName=${query}&ig=${encodeURIComponent(
      genre
    )}&status=${status}&pubDate=${year}&`;

    return await this.getListPage(slug, page);
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          Ongoing: 0,
          Completed: 1,
        }[status] ?? 5
      );
    }
    var baseUrl = this.source.baseUrl;
    if (url.includes(baseUrl)) url = url.replace(baseUrl, "");
    var link = baseUrl + link;
    var doc = await this.request(url);

    var detailsSection = doc.selectFirst(".barContent");
    var name = detailsSection.selectFirst("a").text;
    var imageSlug = doc.selectFirst(".rightBox").selectFirst("img").getSrc;
    var imageUrl = imageSlug.includes("http")
      ? imageSlug
      : `${this.source.baseUrl}${imageSlug}`;
    var pTag = detailsSection.select("p");

    var description = pTag[pTag.length - 2].text;

    var status = 5;
    var genre = [];
    var author = "";
    var artist = "";

    pTag.forEach((p) => {
      var itemText = p.text.trim();

      if (itemText.includes("Genres")) {
        genre = itemText.replace("Genres:", "").trim().split(", ");
      } else if (itemText.includes("Status")) {
        var sts = itemText.replace("Status: ", "").trim().split("\n")[0];
        status = statusCode(sts);
      } else if (itemText.includes("Writer")) {
        author = itemText.replace("Writer: ", "");
      } else if (itemText.includes("Artist")) {
        artist = itemText.replace("Artist: ", "");
      }
    });
    var chapters = [];
    var tr = doc.selectFirst("table").select("tr");
    tr.splice(0, 2); // 1st item in the table is headers & 2nd item is a line break
    tr.forEach((item) => {
      var tds = item.select("td");
      var aTag = tds[0].selectFirst("a");
      var chapLink = aTag.getHref;

      var chapTitle = aTag.text.trim().replace(`${name} `, "");
      chapTitle = chapTitle[0] == "_" ? chapTitle.substring(1) : chapTitle;

      var uploadDate = tds[1].text.trim();
      var date = new Date(uploadDate);
      var dateUpload = date.getTime().toString();

      chapters.push({ url: chapLink, name: chapTitle, dateUpload });
    });

    return {
      name,
      link,
      imageUrl,
      description,
      genre,
      status,
      author,
      artist,
      chapters,
    };
  }

  // For manga chapter pages
  async getPageList(url) {
    var pages = [];
    var hdr = this.getHeaders();
    let match;
    var imageQuality = this.getPreference("readcomiconline_image_quality");
    var prefServer = this.getPreference("readcomiconline_server");

    var url = `${url}&s=${prefServer}&quality=${imageQuality}`;
    var doc = await this.request(url);
    var html = doc.html;

    // Find host url for images
    var baseUrlOverride = "";
    const hostRegex = /return\s+baeu\s*\(\s*l\s*,\s*'([^']+?)'\s*\);?/g;
    match = hostRegex.exec(html);
    if (match != null && match.length > 0) {
      baseUrlOverride = match[1];
      if (baseUrlOverride.slice(-1) == "/")
        baseUrlOverride = baseUrlOverride.substring(0, -1);
    }

    var sKey = "var pth = '';";
    var eKey = "=";
    var s = html.indexOf(sKey) + sKey.length;
    var e = html.indexOf(eKey, s);
    var variableTag = html.substring(s, e).trim().split(" ")[1];

    eKey = "//beau";
    var lines = html.substring(eKey, html.indexOf(eKey, e)).split("\n");

    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith(variableTag)) {
        var encodedImageUrl = line
          .replace(`${variableTag} = '`, "")
          .slice(0, -2);
        var decodedImageUrl = this.decodeImageUrl(
          encodedImageUrl,
          baseUrlOverride
        );
        pages.push({
          url: decodedImageUrl,
          headers: hdr,
        });
      }
    });
    return pages;
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
      "Anthology",
      "Anthropomorphic",
      "Biography",
      "Children",
      "Comedy",
      "Crime",
      "Drama",
      "Family",
      "Fantasy",
      "Fighting",
      "Graphic Novels",
      "Historical",
      "Horror",
      "Leading Ladies",
      "LGBTQ",
      "Literature",
      "Manga",
      "Martial Arts",
      "Mature",
      "Military",
      "Mini-Series",
      "Movies & TV",
      "Music",
      "Mystery",
      "Mythology",
      "Personal",
      "Political",
      "Post-Apocalyptic",
      "Psychological",
      "Pulp",
      "Religious",
      "Robots",
      "Romance",
      "School Life",
      "Sci-Fi",
      "Slice of Life",
      "Sport",
      "Spy",
      "Superhero",
      "Supernatural",
      "Suspense",
      "Teen",
      "Thriller",
      "Vampires",
      "Video Games",
      "War",
      "Western",
      "Zombies",
    ];

    var values = [
      "1",
      "2",
      "38",
      "46",
      "41",
      "49",
      "3",
      "17",
      "19",
      "25",
      "20",
      "31",
      "5",
      "28",
      "15",
      "35",
      "51",
      "44",
      "40",
      "4",
      "8",
      "33",
      "56",
      "47",
      "55",
      "23",
      "21",
      "48",
      "42",
      "43",
      "27",
      "39",
      "53",
      "9",
      "32",
      "52",
      "16",
      "50",
      "54",
      "30",
      "22",
      "24",
      "29",
      "57",
      "18",
      "34",
      "37",
      "26",
      "45",
      "36",
    ];
    filters.push({
      type_name: "GroupFilter",
      name: "Genres",
      state: formateState("CheckBox", items, values),
    });

    // Status
    items = ["Any", "Ongoing", "Completed"];
    values = ["", "Ongoing", "Completed"];
    filters.push({
      type_name: "SelectFilter",
      name: "Status",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Years
    const currentYear = new Date().getFullYear();
    items = Array.from({ length: currentYear - 1919 }, (_, i) =>
      (1920 + i).toString()
    ).reverse();
    items = ["All", ...items];
    values = ["", ...items];
    filters.push({
      type_name: "SelectFilter",
      name: "Year",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    return filters;
  }
  getSourcePreferences() {
    return [
      {
        key: "readcomiconline_image_quality",
        listPreference: {
          title: "Preferred image quality",
          summary: "",
          valueIndex: 1,
          entries: ["Low", "High"],
          entryValues: ["lq", "hq"],
        },
      },
      {
        key: "readcomiconline_server",
        listPreference: {
          title: "Preferred server",
          summary: "",
          valueIndex: 0,
          entries: ["Server 1", "Server 2"],
          entryValues: ["s1", "s2"],
        },
      },
    ];
  }

  // -------- ReadComicOnline Image Decoder --------
  // Source:- https://readcomiconline.li/Scripts/rguard.min.js

  base64UrlDecode(input) {
    let base64 = input.replace(/-/g, "+").replace(/_/g, "/");

    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    const base64abc =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const outputBytes = [];

    for (let i = 0; i < base64.length; i += 4) {
      const c1 = base64abc.indexOf(base64[i]);
      const c2 = base64abc.indexOf(base64[i + 1]);
      const c3 = base64abc.indexOf(base64[i + 2]);
      const c4 = base64abc.indexOf(base64[i + 3]);

      const triplet = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);

      outputBytes.push((triplet >> 16) & 0xff);
      if (base64[i + 2] !== "=") outputBytes.push((triplet >> 8) & 0xff);
      if (base64[i + 3] !== "=") outputBytes.push(triplet & 0xff);
    }

    // Convert bytes to ISO-8859-1 string
    return String.fromCharCode(...outputBytes);
  }

  extractAndConcatParts(input) {
    return input.substring(15, 33) + input.substring(50);
  }

  trimAndAppendChars(input) {
    return (
      input.substring(0, input.length - 11) +
      input[input.length - 2] +
      input[input.length - 1]
    );
  }

  decodeImageUrl(obfuscatedUrl, customDomain) {
    var decodedUrl = "";
    obfuscatedUrl = obfuscatedUrl
      .replace(/6UUQS__ACd__/g, "g")
      .replace(/b/g, "b")
      .replace(/h/g, "h");

    // If URL does not already start with HTTPS
    if (!obfuscatedUrl.startsWith("https")) {
      let queryParams = obfuscatedUrl.substring(obfuscatedUrl.indexOf("?"));

      // Trim to base URL, removing size suffix
      if (obfuscatedUrl.includes("=s0?")) {
        decodedUrl = obfuscatedUrl.substring(0, obfuscatedUrl.indexOf("=s0?"));
      } else {
        decodedUrl = obfuscatedUrl.substring(
          0,
          obfuscatedUrl.indexOf("=s1600?")
        );
      }

      // Extract and decode URL
      decodedUrl = this.extractAndConcatParts(decodedUrl);
      decodedUrl = this.trimAndAppendChars(decodedUrl);
      decodedUrl = this.base64UrlDecode(decodedUrl);

      // Remove 4 characters from index 13 to 17
      decodedUrl = decodedUrl.substring(0, 13) + decodedUrl.substring(17);

      // Append size indicator
      if (obfuscatedUrl.includes("=s0")) {
        decodedUrl = decodedUrl.substring(0, decodedUrl.length - 2) + "=s0";
      } else {
        decodedUrl = decodedUrl.substring(0, decodedUrl.length - 2) + "=s1600";
      }

      // Combine decoded base URL with original query params
      decodedUrl = "https://2.bp.blogspot.com/" + decodedUrl + queryParams;
    } else {
      decodedUrl = obfuscatedUrl;
    }

    // Optionally replace domain with a custom one
    if (customDomain && customDomain !== "") {
      decodedUrl = decodedUrl.replace(
        "https://2.bp.blogspot.com",
        customDomain
      );
    }

    return decodedUrl;
  }
}
