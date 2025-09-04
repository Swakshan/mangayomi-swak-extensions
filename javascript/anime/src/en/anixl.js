const mangayomiSources = [
  {
    "name": "Anixl",
    "id": 2448777672,
    "baseUrl": "https://anixl.to",
    "lang": "en",
    "typeSource": "multi",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://anixl.to/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.5",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/en/anixl.js",
  },
];
class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getBaseUrl() {
    return this.source.baseUrl;
  }

  baseUrl = this.getBaseUrl();

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  getHeaders() {
    return { "content-type": "application/json" };
  }

  async request(query, variables) {
    var body = { query, variables: variables };
    var req = await this.client.post(
      this.baseUrl + "/apo/",
      this.getHeaders(),
      body
    );
    return JSON.parse(req.body);
  }

  listing(res, page) {
    var result = res["data"]["result"];
    var items = result["items"];
    var maxPage = result["paging"]["pages"];
    var list = [];

    items.forEach((item) => {
      var data = item["data"];
      list.push({
        "link": data.ani_id,
        "name": data.info_title,
        "imageUrl": `${this.baseUrl}${data.urlCover300}`,
      });
    });
    var hasNextPage = page < maxPage;
    return { list, hasNextPage };
  }

  async searchList({
    keyword = "",
    incGenres = null,
    excGenres = null,
    sortBy = "field_score",
    page = 1,
  } = {}) {
    var query = `query ($page: Int = 1,$sortby:String,$query:String,$incGenres:[String],$excGenres:[String]) {
                result: get_searchAnime(
                  select:  {
                    word: $query
                    page: $page
                    size: 20
                    sortby: $sortby
                    incGenres:$incGenres
                    excGenres:$excGenres
                  }
                ) {
                  items {
                    data {
                      ani_id
                      info_title
                      urlCover300
                    }
                  }paging {
                    pages
                  }
                }
              }`;
    var variables = {
      "query": keyword,
      "page": parseInt(page),
      "sortby": sortBy,
      "incGenres": incGenres,
      "excGenres": excGenres,
    };
    var res = await this.request(query, variables);
    return this.listing(res, page);
  }

  async getPopular(page) {
    return await this.searchList({page:page});
  }

  async getLatestUpdates(page) {
    var query = `query ($page: Int!) {
                result: get_latest_animes(select:  {
                  page: $page
                }) {
                  items {
                    data {
                      ani_id
                      info_title
                      urlCover300
                    }
                  } paging {
                    pages
                  }
                }
              }`;
    var variables = {
      "page": parseInt(page),
    };
    var res = await this.request(query, variables);
    return this.listing(res, page);
  }

  async search(query, page, filters) {
    return await this.searchList({ keyword:query,page:page});
  }

  async getAnimeDetail(ani_id) {
    function statusCode(status) {
      return (
        {
          "currently_airing": 0,
          "finished_airing": 1,
        }[status] ?? 5
      );
    }
      var query = `query ($ani_id: String!) {
          get_animesNode(id: $ani_id) {
            data {
              info_title
              info_filmdesc
              info_meta_genre
              info_meta_status
            }
          }
        }`;
    var variables = {
      "ani_id": ani_id
    };
    var res = await this.request(query, variables);
    var data = res['data']['get_animesNode']['data']
    var name = data.info_title
    var description = data.info_filmdesc
    var genre = data.info_meta_genre
    var status = statusCode(data.info_meta_status)
    var link = this.baseUrl+"/title/"+ani_id

    return { name, status, description, genre, link };
  }

  async getEpisodeDetail(ani_id,page) {
    var wholeItems = []
    var query = `query ($ani_id: String!, $page: Int!){
  get_animesEpisodesList(select:  {
    ani_id: $ani_id,
    page: $page
    size: 150
  }) {
    items {
      data {
        ep_index
        ep_title
        date_create
        sourcesNode_list {
          data {
            src_type
            sou_id
          }
        }
      }
    }
    paging {
      pages
    }
  }
}`;
    var variables = {
      "ani_id": ani_id,
      "page": page
    };
    var res = await this.request(query, variables);
    var animesEpisodesList = res['data']['get_animesEpisodesList']
    var items = animesEpisodesList['items']

    items.reverse()
    if (items.length >0){
      wholeItems = [...items,...wholeItems]     
    }

     var maxPage = animesEpisodesList['paging']['pages']
      if(page<maxPage){
        return this.getEpisodeDetail(ani_id,page+1)
      }

      return wholeItems
  }

  async getDetail(url) {
    var ani_id = url
    if (url.includes(this.baseUrl)){
      ani_id = url.split("/title/")[1]
    }
    var details = await this.getAnimeDetail(ani_id);

    var epDetails = await this.getEpisodeDetail(ani_id,1)
    var chapters = [];
    epDetails.forEach(item=>{
      var data = item.data
      var title = `E${data.ep_index}: ${data.ep_title}`
      var dateUpload = new Date(data.date_create).valueOf().toString()
      // var link = JSON.stringify(data.sourcesNode_list)
      var sourcesNode_list = data.sourcesNode_list

      var scanlator = "";
      var links = {}
      sourcesNode_list.forEach(node=>{
        var src_type = node.data.src_type
        links[src_type] = node.data.sou_id
        scanlator+=src_type.toUpperCase()+" ";
      })

      chapters.push({
        name:title,
        dateUpload:dateUpload,
        scanlator:scanlator.trim(),
        link:JSON.stringify(links)
      })

    })

    details.chapters = chapters
    return details
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
