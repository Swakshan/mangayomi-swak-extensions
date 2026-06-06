const mangayomiSources = [
  {
    "name": "Anikoto",
    "id": 206730385,
    "baseUrl": "https://anikototv.to",
    "lang": "all",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://anikototv.to/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "1.0.2",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/all/anikoto.js",
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
    return {
      Referer: "https://anikototv.to",
      Origin: "https://anikototv.to",
      "User-Agent": "MangaYomi",
      "x-requested-with": "XMLHttpRequest",
    };
  }

  getBaseUrl() {
    return this.getPreference("anikoto_base_url");
  }

  async request(url,hdr){
    var res = await this.client.get(url, hdr);
    if(res.statusCode!=200) return null;
    return res.body;
  }

  async aniRequest(slug) {
    var baseUrl = this.getBaseUrl();
    var hdr = this.getHeaders();
    var url = slug.includes(baseUrl) ? slug : baseUrl + slug;
    return await this.request(url,hdr)
  }

  async requestDoc(slug) {
    var res = await this.aniRequest(slug);
    return new Document(res);
  }

  async jsonRequest(slug) {
    var res = await this.aniRequest(slug);
    return JSON.parse(res)["result"];
  }

  async requestJson(slug) {
    var res = await this.jsonRequest(slug);
    return new Document(res);
  }

  async filter({ keyword = "", sort = "default", page = "1" }) {
    var titlePref = this.getPreference("anikoto_title_lang");

    var slug = `/filter?keyword=${keyword}&type=&sort=${sort}&page=${page}`;

    var doc = await this.requestDoc(slug);

    var list = [];
    doc
      .selectFirst("#list-items")
      .select(".item")
      .forEach((item) => {
        var dataId = item.selectFirst(".tip").attr("data-tip");
        var nameSection = item.selectFirst(".d-title");
        var name =
          titlePref == "e" ? nameSection.text : nameSection.attr("data-jp");
        var imageUrl = item.selectFirst("img").attr("src");
        var link = item.selectFirst("a").attr("href") + "||" + dataId;
        list.push({
          name,
          link,
          imageUrl,
        });
      });

    var pagination = doc.selectFirst("ul.pagination").select("li");
    var hasNextPage = !pagination.reverse()[0].className.includes("active");
    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.filter({ "sort": "most-viewed", "page": page });
  }

  async getLatestUpdates(page) {
    return await this.filter({ "sort": "latest-updated", "page": page });
  }

  async search(query, page, filters) {
    return await this.filter({
      "keyword": query,
      "sort": "default",
      "page": page,
    });
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

    var urlSplit = url.split("||");

    var link = urlSplit[0];
    var dataId = urlSplit[1];

    var doc = await this.requestDoc(link);

    var binfo = doc.selectFirst(".binfo");
    var description = binfo
      .selectFirst(".synopsis")
      .selectFirst(".content").text;
    var genre = [];
    var bmeta = binfo
      .selectFirst(".bmeta")
      .selectFirst(".meta")
      .select("div")
      .reverse();

    bmeta[0].select("a").forEach((a) => {
      genre.push(a.text.trim());
    });

    var statusText = bmeta[1].selectFirst("a").text.trim();
    var status = statusCode(statusText);

    var chapters = [];
    var epBaseUrl = `/ajax/episode/list/${dataId}?vrf=`;
    doc = await this.requestJson(epBaseUrl);
    doc.select("li").forEach((item) => {
      var epTitle = item.attr("title");
      var a = item.selectFirst("a");
      var epNum = a.attr("data-num");
      var episodeTitle = `E${epNum}: ${epTitle}`;
      var episodeId = a.attr("data-ids");

      var scanlator = "";
      var dataSub = parseInt(a.attr("data-sub"));
      var dataDub = parseInt(a.attr("data-dub"));
      scanlator = dataSub ? "SUB, " : scanlator;
      scanlator = dataDub ? scanlator + "DUB" : scanlator;

      var dateUpload = a.attr("data-timestamp") + "000";

      chapters.push({
        name: episodeTitle,
        url: episodeId,
        scanlator,
        dateUpload,
      });
    });

    chapters.reverse();
    return { link, status, description, genre, chapters };
  }

  async getVideoList(url) {
    var audioPref = this.getPreference("anikoto_stream_subdub_type");
    var streams = [];
    var slug = `/ajax/server/list?servers=${url}`;
    var doc = await this.requestJson(slug);

    var tags = doc.select(".type");

    for (var tag of tags) {
      var dubType = tag.attr("data-type").toUpperCase();
      if (!audioPref.includes(dubType)) continue;

      var serverTags = tag.selectFirst("ul").select("li");
      for (var item of serverTags) {
        var serverName = item.text.trim();

        if (serverName.includes("VidCloud")) continue;
        var serverId = item.attr("data-link-id");
        var streamData = await this.serverData(serverId, serverName, dubType);

        if (streamData) streams.push(streamData);
      }
    }

    return streams;
  }

  getFilterList() {
    throw new Error("getFilterList not implemented");
  }

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

  async serverData(dataId, serverName, dubType) {
    function streamNamer(res) {
      return `${res} - ${dubType} : ${serverName}`;
    }

    var streamLinkData = await this.jsonRequest(`/ajax/server?get=${dataId}`);
    var streamEmbedUrl = streamLinkData["url"]

    var megaBuzzUrl = "https://megaplay.buzz/"
    var hdr = {
      Referer: megaBuzzUrl,
      Origin: megaBuzzUrl,
      "User-Agent": "MangaYomi",
    };

    var res = await this.request(streamEmbedUrl,hdr);
    var doc = new Document(res);

    var data_id = doc.selectFirst("#megaplay-player").attr("data-id");
    if(data_id.length<1) return null;
    var streamApi = `${megaBuzzUrl}stream/getSourcesNew?id=${data_id}&id=${data_id}`;
    res = await this.request(streamApi,hdr);
        if(res==null) return null;
    var streamData = JSON.parse(res);
    var url = streamData.sources.file;
    var subtitles = streamData.tracks;
    subtitles = this.formatSubtitles(subtitles, dubType);
    return {
      url: url,
      originalUrl: url,
      quality: streamNamer("Auto"),
      headers: hdr,
      subtitles,
    };
  }

  getSourcePreferences() {
    return [
      {
        key: "anikoto_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://anikototv.to",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "anikoto_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose in which language anime title should be shown",
          valueIndex: 0,
          entries: ["English", "Romaji"],
          entryValues: ["e", "r"],
        },
      },
      {
        key: "anikoto_stream_subdub_type",
        multiSelectListPreference: {
          title: "Preferred stream sub/dub type",
          summary: "",
          values: ["SUB", "HSUB", "DUB"],
          entries: ["Soft Sub", "Hard Sub", "Dub"],
          entryValues: ["SUB", "HSUB", "DUB"],
        },
      },
    ];
  }
}
