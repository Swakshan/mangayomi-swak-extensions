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
        version: "1.0.1",
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

    getBaseUrl() {
        return this.source.baseUrl;
    }

    getHeaders() {
        return {
            Referer: "https://mangafire.to",
            Origin: "https://mangafire.to",
            "User-Agent": "MangaYomi"
        };
    }

    async requestAPI(slug) {
        var api = `${this.getBaseUrl()}/api/${slug}`
        var res = await this.client.get(api, this.getHeaders());
        if (res.statusCode != 200) return null;
        return JSON.parse(res.body);
    }

    async searchManga({ keyword = "", order = "relevance", page = "1" }) {
        var slug = `titles?order[${order}]=desc&page=${page}&limit=30`
        if (keyword.length > 0) slug += `&keyword=${keyword}`

        var list = [];
        var hasNextPage = false;

        var res = await this.requestAPI(slug);
        if (res != null) {
            if (res.hasOwnProperty("errors")) throw new Error(res.message);
            hasNextPage = res.meta.hasNext

            res['items'].forEach(item => {
                var name = item.title
                var link = item.hid
                var imageUrl = item.poster.small

                list.push({ name, imageUrl, link });
            });
        }

        return { list, hasNextPage };
    }

    async getPopular(page) {
        return await this.searchManga({ order: "score", page: page });
    }

    async getLatestUpdates(page) {
        return await this.searchManga({ order: "chapter_updated_at", page: page });
    }

    async search(query, page, filters) {
        return await this.searchManga({ keyword: query, page: page });
    }

    async getDetail(url) {
        function statusCode(status) {
            return (
                {
                    "releasing": 0,
                    "finished": 1,
                }[status] ?? 5
            );
        }

        var baseUrl = this.getBaseUrl()
        var mangaId = url
        if (url.includes(baseUrl)) {
            mangaId = url.split("/title/")[1]
        }

        var link = `${baseUrl}/title/${mangaId}`
        var description = ""
        var genre = []
        var status = 5
        var chapters = []
        var slug = `titles/${mangaId}`
        var res = await this.requestAPI(slug);

        if (res != null) {
            if (res.hasOwnProperty("message")) throw new Error(res.message);

            var data = res.data
            description = data.synopsisHtml
            status = statusCode(res.status)
            data['genres'].forEach(item => {
                genre.push(item.title)
            })

            var readingType = this.getPreference("mf_reading_type")
            var isVolumeEmpty = false;
            
            if(readingType.startsWith("v")){
                var volSlug = `${slug}/${readingType}`
                res = await this.requestAPI(volSlug)
                if(res == null){
                    isVolumeEmpty = true;
                }else{
                    var items = res.items
                    if(items.length > 1) {
                        items.forEach(item => {
                            var number = item.number
                            var volumeTitle = `Volume ${number}`
                            var volumeId = item.id
                            var description = `Includes ${item.chapterCount} chapters`

                            chapters.push({
                                name:volumeTitle,
                                url: `${readingType}/${volumeId}`,
                                description,
                            })

                        })
                        isVolumeEmpty = false;
                    }else{
                          readingType = "chapters"
                         isVolumeEmpty = true;
                    }
                }
            }

            if (readingType.startsWith("c") || isVolumeEmpty) {
                slug = `${slug}/${readingType}?language=en&limit=200`
                var pageNum = 1
                var shouldContinue = true

                while (shouldContinue) {
                    var newSlug = `${slug}&page=${pageNum}`
                    res = await this.requestAPI(newSlug)
                    if(res == null) break
                    var meta = res.meta
                    shouldContinue = meta.hasNext

                    res['items'].forEach(item => {
                        var number = item.number
                        var chapterNum = `Chapter ${number}`
                        var scanlator = item.type
                        var chapterTitle = item.name
                        chapterTitle = chapterTitle.length > 1 ? `${chapterNum}: ${chapterTitle}` : chapterNum
                        var chapterId = item.id
                        var dateUpload = `${item.createdAt}`

                        chapters.push({
                            name:chapterTitle,
                            url: `${readingType}/${chapterId}`,
                            scanlator,
                            dateUpload,
                        })
                    })
                    pageNum++
                }
            }

        }

        return { link, description, genre, status, chapters };
    }

    async getPageList(url) {
        var res = await this.requestAPI(url)
        var urls = [];
        var headers = this.getHeaders()

        res['data']['pages'].forEach(item=>{
            urls.push({
                url: item.url,
                headers
            })
        })

        return urls
    }

    getFilterList() {
        throw new Error("getFilterList not implemented");
    }

    getSourcePreferences() {
        return [{
            key: "mf_reading_type",
            listPreference: {
                title: "Preferred reading type",
                summary: "Should be shown as Chapters or Volumes",
                valueIndex: 0,
                entries: ["Chapters", "Volumes"],
                entryValues: ["chapters", "volumes"],
            },
        },]
    }
}
