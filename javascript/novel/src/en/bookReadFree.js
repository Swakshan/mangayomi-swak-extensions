const mangayomiSources = [{
    "name": "bookReadFree",
    "lang": "en",
    "baseUrl": "https://bookreadfree.com",
    "apiUrl": "",
    "iconUrl": "https://cdn.pixabay.com/photo/2016/09/16/09/20/books-1673578_1280.png",
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

    async getPopular(page) {
        const baseUrl = this.source.baseUrl;
        const client = new Client();
        const res = await client.get(baseUrl, this.getHeaders(baseUrl));
        const doc = new Document(res.body);
        const books = doc.select("ul.l1 li");
        const bookList = [];

        if (books && books.length > 0) {
            for (const book of books) {
                const anchor = book.selectFirst("a");
                if (anchor) {
                    const bookRelPath = anchor.attr("href");
                    const bookTitle = anchor.text.trim();
                    const bookLink = bookRelPath.startsWith('http') ? bookRelPath : baseUrl + bookRelPath;
                    const imageLink = await this.getImage(bookLink);
                    bookList.push({
                        'name': bookTitle,
                        'link': bookLink,
                        'imageUrl': imageLink
                    });
                }
            }
        }
        return { 'list': bookList, 'hasNextPage': false };
    }

    async getImage(url) {
        const client = new Client();
        const imageRes = await client.get(url, this.getHeaders(url));
        const imageDoc = new Document(imageRes.body);
        const image = imageDoc.selectFirst("img");
        return image ? image.attr("src") : "";
    }
    
    async getLatestUpdates(page) {
        const baseUrl = this.source.baseUrl;
        const client = new Client();
        
        const res = await client.get(baseUrl, this.getHeaders(baseUrl));
        const doc = new Document(res.body);
        
        const books = doc.select("ol.l2 p");
        const bookList = [];
                    
        if (books && books.length > 0) {
            for (const book of books) {
                const anchor = book.selectFirst("a");
                
                if (anchor) {
                    const bookRelPath = anchor.attr("href");
                    const bookTitle = anchor.text.trim();
                    if (bookTitle == "View More>>") {
                      continue
                    }
                    
                    const bookLink = bookRelPath.startsWith('http') ? bookRelPath : baseUrl + bookRelPath;
                    // The image are in its own page
                    const imageLink = await this.getImage(bookLink);
                    
                    bookList.push({
                        'name': bookTitle,
                        'link': bookLink,
                        'imageUrl': imageLink
                    });
                }  
            }
        }
        
        return {
          'list': bookList,
          'hasNextPage': false
        }
    }
    async search(query, page, filters) {
        const baseUrl = this.source.baseUrl;
        const encodedQuery = encodeURIComponent(query);
        let searchUrl = `${baseUrl}/s/search?q=${encodedQuery}`;
        if (page > 1) {
          searchUrl += `&offset=${page}`;
        }
        
        const client = new Client();
        const res = await client.get(searchUrl);
        
        const doc = new Document(res.body);
        const books = doc.select('ul.books li');
        const bookList = [];
        
        if (books && books.length > 0) {
          for (const book of books) {
            const anchor = book.selectFirst("a.row");
            if (anchor) {
              const bookRelPath = anchor.attr("href");
              const bookTitle = anchor.selectFirst("i.hh")?.text.trim() || "";
              const bookAuthor = anchor.selectFirst("b.auto")?.text.trim().replace(/^by\s+/i, "") || "";
              
              const coverDiv = anchor.selectFirst("div.a");
              const bookCover = coverDiv?.attr("src") || "";
              
              bookList.push({
                'name': bookTitle,
                'link': baseUrl + bookRelPath,
                'imageUrl': bookCover
              })
            }
          }
        }
        
        let hasNextPage = false;
        const moreElements = doc.select('a.more');
        for (const el of moreElements) {
          if (el.text == 'Next >') {
            hasNextPage = true;
          }
        }
        
        return {
          'list': bookList,
          'hasNextPage': hasNextPage
        }
    }
    async getDetail(url) {
        const client = new Client();
        
        // Get the DOM content of the book url
        const res = await client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        
        // Get title
        const titleElement = doc.selectFirst("div.d b.t");
        const bookTitle = titleElement ? titleElement.text.trim() : "Unknown Title";
        
        // Get author
        const authorElement = doc.selectFirst("div.d p:contains(by) a");
        const bookAuthor = authorElement ? authorElement.text.trim() : "";
        
        // Get description
        const descElement = doc.selectFirst("div.dd");
        let bookDescription = descElement ? descElement.text.trim() : "";
        bookDescription = bookDescription.replace(/Read .* Storyline:\s+/i, "");
        
        // Get genere(but the geners inside this extensions are bad so other12 and Science on The name of the wind is going to accure)
        const genreElement = doc.selectFirst("div.d p:contains(Genre)");
        let bookGenres = [];
        if (genreElement) {
            const genreText = genreElement.text.replace("Genre:", "").trim();
            bookGenres = genreText.split(',').map(g => g.trim());
        }
        
        // Get chapters
        const chaptersUrl = url.replace('/book/', '/all/');
        const chaptersRes = await client.get(chaptersUrl, this.getHeaders(chaptersUrl));
        const chaptersDoc = new Document(chaptersRes.body);
        
        const chaptersLinksElements = chaptersDoc.select("div.l a")
        const chaptersList = []
        
        if (chaptersLinksElements && chaptersLinksElements.length > 0) {
          for (const element of chaptersLinksElements) {
            const chapterName = element.text.trim();
            const chapterRelPath = element.attr("href");
            const chapterLink = chapterRelPath.startsWith('http') ? chapterRelPath : this.source.baseUrl + chapterRelPath;
            
            chaptersList.push({
              'name': chapterName,
              'url': chapterLink,
              'scanlator': "",
            })
          }
        }
        chaptersList.reverse();
        
        // Return all the info
        return {
          'name': bookTitle,
          'link': url,
          'imageUrl': await this.getImage(url),
          'description': bookDescription,
          'author': bookAuthor,
          'genre': bookGenres,
          'status': 1,
          'chapters': chaptersList
        }
    }

    async getHtmlContent(name, url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const contentElement = doc.selectFirst("section.con");

        if (contentElement) {
            const formattedContent = await this.cleanHtmlContent(contentElement.innerHtml);
            //the docs says that i need to return array of words so some parts of the code may seem weird(at least they look weird to me...)
            return [formattedContent];
        }
        return [];
    }
    async cleanHtmlContent(html) {
        if (!html) return "";
        //cleaning the html
        let cleaned = html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<p[^>]*>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();
        //formating the text and returning him for the display
        return this.formatNovelText(cleaned);
    }

    formatNovelText(text) {
        if (!text) return "";
        let lines = text.split('\n');
        let formattedLines = lines.map(line => {
            let trimmed = line.trim();
            if (!trimmed) return "";

            // Handle Chapter Titles
            const chapterRegex = /^\s*(CHAPTER\s+[A-Z0-9V|X|L|C]+|PROLOGUE|EPILOGUE|ACKNOWLEDG[E]?MENTS)\s*$/i;
            if (chapterRegex.test(trimmed)) {
                return `<div style="text-align: center; margin: 40px 0 20px 0;">
                            <h2 style="font-size: 1.6em; letter-spacing: 2px; border-bottom: 1px solid currentColor; display: inline-block; padding-bottom: 10px; opacity: 0.9;">
                                ${trimmed.toUpperCase()}
                            </h2>
                        </div>`;
            }

            // Handle Scene Breaks (*** or ---)
            if (trimmed.match(/^(\*|\.|\-){3,}$/)) {
                return `<hr style="width: 30%; margin: 30px auto; border: 0; border-top: 1px double currentColor; opacity: 0.3;">`;
            }

            // Handle Small Headers (All caps short lines)
            if (trimmed.length < 60 && !trimmed.match(/[.?!,;]$/) && trimmed === trimmed.toUpperCase()) {
                return `<h3 style="text-align: center; font-style: italic; margin: 20px 0; opacity: 0.8;">${trimmed}</h3>`;
            }

            // Handle Standard Paragraphs
            return `<p style="margin-bottom: 1.2em; text-indent: 1.5em; line-height: 1.8; text-align: justify; font-family: 'Georgia', serif; font-size: 1.1em;">${trimmed}</p>`;
        });

        const finalHtml = formattedLines.filter(l => l !== "").join('');
        
        return `<div style="max-width: 900px; margin: 0 auto; padding: 15px; overflow-wrap: break-word;">
                    ${finalHtml}
                </div>`;
    }

    async getPageList(url) {
        const content = await this.getHtmlContent("", url);
        if (content && content.length > 0) {
          return content;
        }
        return [];
    }
}

const extension = new DefaultExtension();
