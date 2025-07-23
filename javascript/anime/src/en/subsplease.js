const mangayomiSources = [
  {
    "name": "SubsPlease",
    "id": 2732508901,
    "baseUrl": "https://subsplease.org",
    "lang": "en",
    "typeSource": "single",
    "iconUrl":
      "https://raw.github.com/Swakshan/mangayomi-swak-extensions/main/javascript/icon/en.subsplease.jpg",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "https://subsplease.org/api",
    "version": "0.0.1",
    "isManga": false,
    "itemType": 1,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "anime/src/en/subsplease.js",
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
  getBaseUrl(){
    return this.source.baseUrl;
  }

  async requestAPI(slug){
    var apiUrl = this.source.apiUrl
    var api = `${apiUrl}/?${slug}`
    var res = await this.client.get(api)
    return JSON.parse(res.body) || {}
  }
  
  async animeList(slug){
    var baseUrl = this.getBaseUrl()
     var body = await this.requestAPI(slug)
     var list = []
     var hasNextPage = slug.includes("f=latest") //Only latest has next page, Search doesnt.
     for(var ep in body){
        var item = body[ep]
        var name = item.show
        var imageUrl = baseUrl+item.image_url
        var link = item.page
        list.push({ name, imageUrl, link });
     }

     return {list,hasNextPage}
  }

  async getPopular(page) {
    var slug = `f=latest&tz=&p=${page-1}`
    return await this.animeList(slug)
  }

  async getLatestUpdates(page) {
    var slug = `f=latest&tz=&p=${page-1}`
    return await this.animeList(slug)
  }

  async search(query, page, filters) {
    var slug = `f=search&tz=&s=${query}`
    return await this.animeList(slug)
  }

  async getDetail(url) {
    throw new Error("getDetail not implemented");
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
