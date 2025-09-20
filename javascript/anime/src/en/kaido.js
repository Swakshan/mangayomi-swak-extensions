const mangayomiSources = [
  {
    "name": "Kaido",
    "id": 2457624982,
    "baseUrl": "https://kaido.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://kaido.to/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "1.0.0",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/en/kaido.js",
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
    var url = this.source.baseUrl + slug;
    var res = await this.client.get(url);
    return new Document(res.body);
  }

  async filter({ keyword = "", sort = "default", page = "1" }) {
    var titlePref = this.getPreference("kaido_title_lang");

    var slug = keyword == "" ? "/filter?" : `/search?keyword=${keyword}&`;
    slug += `sort=${sort}&page=${page}`;

    var doc = await this.request(slug);
    var list = [];

    doc.select(".flw-item").forEach((item) => {
      var name = item.selectFirst("h3").selectFirst("a").attr(titlePref);
      var link = item.selectFirst("a").attr("href");
      var imageUrl = item.selectFirst("img").attr("data-src");
      list.push({
        name,
        link,
        imageUrl,
      });
    });

    var page_item = doc.select(".page-item");
    var hasNextPage =
      page_item.length > 0 && page_item.at(-1).text != `${page}` ? true : false;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.filter({ "sort": "score", "page": page });
  }

  async getLatestUpdates(page) {
    return await this.filter({ "sort": "recently_updated", "page": page });
  }

  async search(query, page, filters) {
    return await this.filter({ "keyword": query, "page": page });
  }

  async ajaxRequest(slug) {
    var url = this.source.baseUrl + "/ajax/episode" + slug;
    var res = await this.client.get(url);
    var json = JSON.parse(res.body);
    return json["html"] || json["link"];
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          "Currently Airing": 0,
          "Finished Airing": 1,
        }[status] ?? 5
      );
    }

    var epTitlePref = this.getPreference("kaido_ep_title_lang");
    var baseUrl = this.source.baseUrl;
    var slug = url.replace(baseUrl, "");
    var link = baseUrl + "/watch" + slug;

    var doc = await this.request(slug);
    var anisc_info = doc.selectFirst(".anisc-info");
    var description = anisc_info.selectFirst(".text").text.trim();
    var genre = [];
    anisc_info
      .selectFirst(".item-list")
      .select("a")
      .forEach((item) => genre.push(item.text));

    var status = 5;
    for (var item of anisc_info.select(".item-title")) {
      var head = item.selectFirst(".item-head").text;
      if (head.includes("Status")) {
        status = statusCode(item.selectFirst(".name").text);
        break;
      }
    }

    var totalSub = parseInt(doc.selectFirst(".tick-sub").text);
    var totalDub = parseInt(doc.selectFirst(".tick-dub").text);
    var statsItem = doc.selectFirst(".film-stats").select("span.item");
    var animeType = statsItem[0].text.trim();
    var duration = statsItem[statsItem.length - 1].text.trim();

    var data_id = doc.selectFirst("#wrapper").attr("data-id");
    var epiRes = await this.ajaxRequest(`/list/${data_id}`);
    var epiDoc = new Document(epiRes);

    var chapters = [];
    epiDoc.select("a.ep-item").forEach((item) => {
      var isFiller = item.className.includes("ssl-item-filler");
      var episodeNum = item.attr("data-number");
      var episodeTitle = item.selectFirst(".ep-name").attr(epTitlePref);
      var episodeId = item.attr("data-id");
      var episodeTitle = `E${episodeNum}: ${episodeTitle}`;
      if (animeType == "Movie") {
        episodeTitle = animeType;
      } else {
        duration = null;
      }
      var scanlator = "";

      if (parseInt(episodeId) <= totalSub) scanlator += "SUB";
      if (parseInt(episodeId) <= totalDub) scanlator += ", DUB";
      chapters.push({
        name: episodeTitle,
        url: episodeId,
        scanlator,
        isFiller,
        duration,
      });
    });
    chapters.reverse();
    return { link, status, description, genre, chapters };
  }

  async getVideoList(url) {
    function serverName(serId) {
      return {
        "1": "Vidcloud",
        "4": "Vidstreaming",
      }[serId];
    }
    var streams = [];
    var prefServer = this.getPreference("kaido_stream_server");
    // If no server is chosen, use the default server 1
    if (prefServer.length < 1) prefServer.push("1");

    var prefDubType = this.getPreference("kaido_stream_subdub_type");
    // If no dubtype is chosen, use the default dubtype sub
    if (prefDubType.length < 1) prefDubType.push("sub");

    var serRes = await this.ajaxRequest(`/servers?episodeId=${url}`);
    var serDoc = new Document(serRes);

    for (var serData of serDoc.select(".server-item")) {
      var serId = serData.attr("data-server-id");
      if (!prefServer.includes(serId)) continue;

      var serDubType = serData.attr("data-type");
      if (!prefDubType.includes(serDubType)) continue;

      var dataId = serData.attr("data-id");
      var streamData = await this.serverData(
        dataId,
        serverName(serId),
        serDubType.toUpperCase()
      );
      if (streamData != null) streams = [...streams, ...streamData];
    }
    return streams;
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

  getSourcePreferences() {
    return [
      {
        key: "kaido_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 0,
          entries: ["English", "Romaji"],
          entryValues: ["title", "data-jname"],
        },
      },
      {
        key: "kaido_ep_title_lang",
        listPreference: {
          title: "Preferred episode title language",
          summary: "Choose in which language episode title should be shown",
          valueIndex: 0,
          entries: ["English", "Romaji"],
          entryValues: ["title", "data-jname"],
        },
      },
      {
        key: "kaido_stream_subdub_type",
        multiSelectListPreference: {
          title: "Preferred stream sub/dub type",
          summary: "",
          values: ["sub", "dub"],
          entries: ["Soft Sub", "Dub"],
          entryValues: ["sub", "dub"],
        },
      },
      {
        key: "kaido_stream_server",
        multiSelectListPreference: {
          title: "Preferred server",
          summary: "Choose the server/s you want to extract streams from",
          values: ["1", "4"],
          entries: ["Vidcloud", "Vidstreaming"],
          entryValues: ["1", "4"],
        },
      },
      {
        key: "kaido_extract_streams",
        switchPreferenceCompat: {
          title: "Split stream into different quality streams",
          summary: "Split stream Auto into 360p/720p/1080p",
          value: true,
        },
      },
    ];
  }

  //----------- Server -----------------
  formatSubtitles(subtitles, dubType) {
    var subs = [];
    subtitles.forEach((sub) => {
      if (!sub.kind.includes("thumbnail")) {
        subs.push({
          file: sub.file,
          label: `${sub.label} - ${dubType}`,
        });
      }
    });

    return subs;
  }

  async formatStreams(sUrl, serverName, dubType) {
    function streamNamer(res) {
      return `${res} - ${dubType} : ${serverName}`;
    }

    var streams = [
      {
        url: sUrl,
        originalUrl: sUrl,
        quality: streamNamer("Auto"),
      },
    ];

    var pref = this.getPreference("kaido_extract_streams");
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

  async serverData(dataId, serverName, dubType) {
    var streamLink = await this.ajaxRequest(`/sources?id=${dataId}`);
    var streamId = streamLink.split("/").pop().slice(0, -3);

    var res = await this.client.get(
      `https://rapid-cloud.co/embed-2/v2/e-1/getSources?id=${streamId}`
    );
    if (res.statusCode != 200) return null;

    var streamData = JSON.parse(res.body);

    var url = streamData.sources[0].file;
    var streams = await this.formatStreams(url, serverName, dubType);
    var subtitles = streamData.tracks;
    streams[0].subtitles = this.formatSubtitles(subtitles, dubType);
    return streams;
  }
}
