const mangayomiSources = [
    {
        name: "Mangafire",
        id: 4012742720,
        baseUrl: "https://mangafire.to",
        lang: "all",
        typeSource: "single",
        iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://mangafire.to/",
        dateFormat: "",
        dateFormatLocale: "",
        isNsfw: false,
        hasCloudflare: false,
        sourceCodeUrl: "",
        apiUrl: "https://mangafire.to/api",
        version: "0.0.1",
        isManga: true,
        itemType: 0,
        isFullData: false,
        appMinVerReq: "0.5.0",
        additionalParams: "",
        sourceCodeLanguage: 1,
        notes: "",
        pkgPath: "manga/src/all/mangafire.js"
    }
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
            Referer: "https://mangafire.to",
            Origin: "https://mangafire.to",
            "User-Agent": "MangaYomi"
        };
    }

    async requestAPI(slug){
        var api = `${this.source.apiUrl}/${slug}`
        var res = await this.client.get(api, this.getHeaders());
        if (res.statusCode != 200) return null;
        return JSON.parse(res.body);
    }

    async searchManga({ keyword = "", order = "relevance", page = "1" }){
        var slug = `titles?order[${order}]=desc&page=${page}&limit=30`
        if(keyword.length > 0) slug+=`&keyword=${keyword}`
        
        var list = [];
        var hasNextPage = false;

        var res = this.requestAPI(slug);
        if(res!=null){
            if(res.hasOwnProperty("errors")) throw new Error(res.message);

            var meta = res.meta
            var lastPage = meta.lastPage
            var curPage = meta.page
            hasNextPage = curPage!=lastPage

            res['items'].forEach(item=>{
                var name = item.title
                var link = item.hid
                var imageUrl = item.poster.small

                list.push({ name, imageUrl, link });
            });
        }
        
        return { list, hasNextPage };
    }

    async getPopular(page) {
        return await this.searchManga({order:"score",page:page});
    }

    async getLatestUpdates(page) {
        return await this.searchManga({order:"chapter_updated_at",page:page});
    }

    async search(query, page, filters) {
        return await this.searchManga({keyword:query,page:page});
    }

    async getDetail(url) {
        throw new Error("getDetail not implemented");
    }

    async getPageList(url) {
        throw new Error("getPageList not implemented");
    }

    getFilterList() {
        throw new Error("getFilterList not implemented");
    }

    getSourcePreferences() {
        throw new Error("getSourcePreferences not implemented");
    }
}
