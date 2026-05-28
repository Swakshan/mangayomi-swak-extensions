const mangayomiSources = [{
    "name": "RoyalRoad",
    "lang": "en",
    "baseUrl": "https://www.royalroad.com",
    "apiUrl": "",
    "iconUrl": "https://www.royalroad.com/dist/img/logo/rr-logo-gold-white-small-min.png",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.0.1",
    "pkgPath": "",
    "notes": ""
}];

class DefaultExtension extends MProvider {
    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        };
    }
    
    async getNovels(url) {
        const baseUrl = this.source.baseUrl;
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        
        const novels = doc.select("div#result  div, div.fiction-list  div");
        const novelList = [];
        for (const novel of novels) {
          const ancherElement = novel.selectFirst("figure.col-sm-2 a");
          const novelLink = baseUrl + ancherElement.attr("href");
          const novelTitle = ancherElement.selectFirst("img").attr("alt");
          const novelImage = ancherElement.selectFirst("img").attr("src")
          
          novelList.push({
                'name': novelTitle,
                'link': novelLink,
                'imageUrl': novelImage
          })
        }
        
        const nextButton = doc.selectFirst("ul.pagination li:has(a[aria-label='Next'])");
        const hasNextPage = nextButton != null && !nextButton.className.includes("disabled");
        
        return {'list': novelList, 'hasNextPage': hasNextPage};
    }
    
    async getPopular(page) {
        const baseUrl = this.source.baseUrl;
        const url = baseUrl + '/fictions/best-rated?page=' + page;
        return await this.getNovels(url);
    }
    get supportsLatest() {
        throw new Error("supportsLatest not implemented");
    }
    async getLatestUpdates(page) {
        const baseUrl = this.source.baseUrl;
        const url = baseUrl + '/fictions/latest-updates?page=' + page;
        return await this.getNovels(url);
    }
    async search(query, page, filters) {
        const baseUrl = this.source.baseUrl;
        const url =  `${baseUrl}/fictions/search?title=${query}&page=${page}`;
        return await this.getNovels(url);
    }
    async getDetail(url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        
        // title
        const bookTitle = doc.selectFirst("div.col-md-5 div.col h1.font-white").text.trim();
        
        // img
        const imgLink = doc.selectFirst("img.thumbnail").attr("src");
        
        // description
        const descriptionElement = doc.selectFirst('div.description div.hidden-content');
        const bookDescription = descriptionElement.text.trim();
        
        // author
        const bookAuthor = doc.selectFirst('h3.mt-card-name a')?.text?.trim() || doc.selectFirst('div.mt-card-content h3 a.font-red')?.text?.trim() || "";
        
        // genres
        const genreElements = doc.select('span.tags a.label');
        const bookGenres = [];
        for (const genre of genreElements) {
          bookGenres.push(genre.text.trim());
        }
    
        // status
        const statusText = doc.selectFirst("div.margin-bottom-10 span.label").text.toLowerCase();
        const status = statusText.includes("ongoing") ? 0 : 1;
          
        // chapters
        const chaptersList = [];
        const chapterElements = doc.select("table#chapters tbody tr");
        
        for (const element of chapterElements) {  
          const linkElement = element.selectFirst("td a");
          if (linkElement) {
            const chapterTitle = linkElement.text.trim();
            let chapterUrl = linkElement.attr("href");
            if (chapterUrl && !chapterUrl.startsWith('http')) {
              chapterUrl = this.source.baseUrl + chapterUrl;
            }
            
            chaptersList.push({
              'name': chapterTitle,
              'url': chapterUrl,
              'scanlator': ""
            });
          }
        }
        
        // return all the gathered info
        return {
          'name': bookTitle,
          'link': url,
          'imageUrl': imgLink,
          'description': bookDescription,
          'author': bookAuthor,
          'genre': bookGenres,
          'status': status,
          'chapters': chaptersList
      };
    }
    // For novel html content
    async getHtmlContent(name, url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        
        const chapterElement = doc.selectFirst("div.chapter-inner");
        if (!chapterElement) {
            throw new Error("Could not find chapter content");
        }
        
        const htmlString = chapterElement.outerHtml || "";
    
        return this.cleanHtmlContent(htmlString);
    }
    // Clean html up for reader
    async cleanHtmlContent(html) {
        if (!html) return "";
        return html
            .replace(/\sclass=["'][^"']*["']/g, "") // Remove classes
            .replace(/\sid=["'][^"']*["']/g, "")    // Remove IDs
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove scripts
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
    }
    // For anime episode video list
    async getVideoList(url) {
        throw new Error("getVideoList not implemented");
    }
    // For manga chapter pages
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
