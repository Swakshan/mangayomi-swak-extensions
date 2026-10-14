const mangayomiSources = [
    {
        "name": "Mangafire",
        "id": 4012742720,
        "baseUrl": "https://mangafire.to",
        "lang": "all",
        "typeSource": "single",
        "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://mangafire.to/",
        "dateFormat": "",
        "dateFormatLocale": "",
        "isNsfw": false,
        "hasCloudflare": false,
        "sourceCodeUrl": "",
        "apiUrl": "https://mangafire.to/api",
        "version": "2.1.0",
        "isManga": true,
        "itemType": 0,
        "isFullData": false,
        "appMinVerReq": "0.5.0",
        "additionalParams": "",
        "sourceCodeLanguage": 1,
        "notes": "",
        "pkgPath": "manga/src/all/mangafire.js"
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
        var vrf = this.generateVRF(slug);
        var appendChar = slug.includes("=") ? "&" : "?";
        api += `${appendChar}vrf=${vrf}`
        var res = await this.client.get(api, this.getHeaders());
        if (res.statusCode != 200) return null;
        return JSON.parse(res.body);
    }

    async searchManga({ keyword = "", order = "relevance", page = "1" }) {
        var slug = "/titles?"
        if (keyword.length > 0) slug += `keyword=${keyword}&`
        slug += `limit=30&order[${order}]=desc&page=${page}`

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
        var slug = `/titles/${mangaId}`
        var res = await this.requestAPI(slug);

        if (res != null) {
            if (res.hasOwnProperty("message")) throw new Error(res.message);

            var data = res.data
            description = data.synopsisHtml
            status = statusCode(res.status)
            data['genres'].forEach(item => {
                genre.push(item.title)
            })

            var prefLang = "en"
            var readingType = this.getPreference("mf_reading_type")
            var isVolumeEmpty = false;

            if (readingType.startsWith("v")) {
                var volSlug = `${slug}/${readingType}`
                res = await this.requestAPI(volSlug)
                if (res == null) {
                    isVolumeEmpty = true;
                } else {
                    var items = res.items
                    if (items.length > 1) {
                        items.forEach(item => {
                            var volLang = item.language
                            if (volLang == prefLang) {
                                var number = item.number
                                var volumeTitle = `Volume ${number}`
                                var volumeId = item.id
                                var description = `Includes ${item.chapterCount} chapters`

                                chapters.push({
                                    name: volumeTitle,
                                    url: `/${readingType}/${volumeId}`,
                                    description,
                                })
                            }
                        })
                        if (chapters.length == 0 && items.length > 0) {
                            //throw new Error("Volumes for " + prefLang + "language not available.");
                            readingType = "chapters"
                            isVolumeEmpty = true;
                        } else {
                            isVolumeEmpty = false;
                        }
                    } else {
                        readingType = "chapters"
                        isVolumeEmpty = true;
                    }
                }
            }

            if (readingType.startsWith("c") || isVolumeEmpty) {
                slug = `${slug}/${readingType}?language=${prefLang}&limit=200`
                var pageNum = 1
                var shouldContinue = true

                while (shouldContinue) {
                    var newSlug = `${slug}&page=${pageNum}`
                    res = await this.requestAPI(newSlug)
                    if (res == null) break
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
                            name: chapterTitle,
                            url: `/${readingType}/${chapterId}`,
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

        res['data']['pages'].forEach(item => {
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

    generateVRF(urlStr) {
        // Constants
        const TABLE_1 = "yINlmUNho8VYJT+ibTIP+9ESiULpVEtMOoD6U6lRE0R/xwXo/Xp9NrUgC4cw/Lmo33vUyjUE40kUoEWIr/fxfNNcq2s79ShQ5NhNrFnJ4hXPwOu/SuXzIbuTQKGFvfm08E9jvCfqAtoDqvQq3dVWPQFmJjgvkISBeXY3BgANR+yVnjGbcxZ47d6kLNfZPIayTq3/YGySb1KuVZodWp/WGNAO5pfMcpaK53Hhs0allBszaMaxuouOwdxbwgxIw6YunSsXjI05Yi0j9j4eHKfSXR8Ifo/Od+8iamRfCXTyvm7NGRGYdcQ0ywcK/u6RXhrbcCm4t2eCtrDgQVecJGkQ+A==";
        const KEY_1 = "0Ec58JOY3uBzJK9m3zqIOpdlF7UFiax9DmA=";
        const TABLE_2 = "IUFltCxD3Oc2cwCgkJffthaOg9cgPUb0LgW6H/VtfcF0kc5F25t+aWj6JH9VOhOaY0rAFdUxlDnl5BLNvwEJvQtP5qcw7vdb/K+chnbwnspSHT8mz5lqwz41TezG0hkO06FTjJZhsyNuFLDpD2ZZxQj/QIRcF90zpmQ7Byu483WsQqUE0C342HL+JXngRB6fRzxRyVTaKu83h7UYTJ0QMt6ixFh6S3F8gqkKwrGTL3jHNBsD45UnifK8+RGtishQV2K3rujLKEkiZxpr2dYcudFW4oFsDKhad3CLBvuyTqsCo4B7mL5IKQ1vXo/MOOvq1I1d8ar9X6Ttu5KF4fZgiA==";
        const KEY_2 = "AAdjb1iPY8CiDmq9H34tKTBF8a3oDQ==";
        const TABLE_3 = "NQHlu1/wVO5EmkwQymF810qqY2xG1k2obcas4Z9mCsPEIFl9pRIjFxbJ7ybMHbBckT5Ton85E0FOeHezbh/mjlEYpmpnlXOS8dgrqeq2KfxImTh1YK9y0PeMNhzA1OQzSY9brYOJq/l2QnE/hwOeZIhPixVSKIUlDb5vLcH6RWKxkIEMuP0bDwIqQ71AJJaEaMJL7A6YtyIwoRT+L5v4aZzodN/0+3nOGsfblFjgxSfPzVDjNFeNl5P26+kEC/8AHgdrpAbt3hHz3HrRN1Y6e+JHgF7ncFWnoF0y3THL1S71WgWGCa6KtSzTCCG58n68nTyj2T3Sshk7utqCtMi/ZQ==";
        const KEY_3 = "DELOJgPsVaCcblDtTGMdHzM=";

        // Native Base64 Decoder (replaces atob)
        function base64ToBytes(base64) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/_';
            const lookup = new Uint8Array(256);
            for (let i = 0; i < chars.length; i++) {
                lookup[chars.charCodeAt(i)] = i;
            }
            lookup['-'.charCodeAt(0)] = 62;
            lookup['_'.charCodeAt(0)] = 63;
            lookup['+'.charCodeAt(0)] = 62;
            lookup['/'.charCodeAt(0)] = 63;

            const cleanBase64 = base64.replace(/=+$/, '');
            const len = cleanBase64.length;
            const nBytes = (len * 3) >> 2;
            const bytes = new Uint8Array(nBytes);

            let j = 0;
            for (let i = 0; i < len; i += 4) {
                const encoded1 = lookup[cleanBase64.charCodeAt(i)];
                const encoded2 = lookup[cleanBase64.charCodeAt(i + 1)];
                const encoded3 = i + 2 < len ? lookup[cleanBase64.charCodeAt(i + 2)] : 0;
                const encoded4 = i + 3 < len ? lookup[cleanBase64.charCodeAt(i + 3)] : 0;

                bytes[j++] = (encoded1 << 2) | (encoded2 >> 4);
                if (i + 2 < len && cleanBase64.charAt(i + 2) !== '=') {
                    bytes[j++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
                }
                if (i + 3 < len && cleanBase64.charAt(i + 3) !== '=') {
                    bytes[j++] = ((encoded3 & 3) << 6) | encoded4;
                }
            }
            return bytes.subarray(0, j);
        }

        // Native URL-safe Base64 Encoder (replaces btoa)
        function bytesToBase64Url(bytes) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
            let result = '';
            let i = 0;
            const len = bytes.length;
            while (i < len) {
                const b1 = bytes[i++];
                const b2 = i < len ? bytes[i++] : null;
                const b3 = i < len ? bytes[i++] : null;

                const enc1 = b1 >> 2;
                const enc2 = ((b1 & 3) << 4) | (b2 !== null ? b2 >> 4 : 0);
                let enc3 = b2 !== null ? ((b2 & 15) << 2) | (b3 !== null ? b3 >> 6 : 0) : 64;
                let enc4 = b3 !== null ? b3 & 63 : 64;

                if (b2 === null) {
                    enc3 = 64;
                    enc4 = 64;
                } else if (b3 === null) {
                    enc4 = 64;
                }

                result += chars.charAt(enc1) + chars.charAt(enc2);
                if (enc3 !== 64) result += chars.charAt(enc3);
                if (enc4 !== 64) result += chars.charAt(enc4);
            }
            return result;
        }

        // Pure JS UTF-8 String to Uint8Array
        function stringToUtf8Bytes(str) {
            const bytes = [];
            for (let i = 0; i < str.length; i++) {
                let code = str.charCodeAt(i);
                if (code < 0x80) {
                    bytes.push(code);
                } else if (code < 0x800) {
                    bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
                } else if (code < 0xd800 || code >= 0xe000) {
                    bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                } else {
                    i++;
                    code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                    bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                }
            }
            return new Uint8Array(bytes);
        }

        const STAGES = [
            { table: base64ToBytes(TABLE_1), key: base64ToBytes(KEY_1), iv: 0x5A },
            { table: base64ToBytes(TABLE_2), key: base64ToBytes(KEY_2), iv: 0x35 },
            { table: base64ToBytes(TABLE_3), key: base64ToBytes(KEY_3), iv: 0xBA }
        ];

        function encryptStage(data, table, key, iv) {
            const out = new Uint8Array(data.length);
            let prev = iv;
            const keySize = key.length;
            for (let i = 0; i < data.length; i++) {
                prev = table[(data[i] ^ key[i % keySize] ^ prev) & 0xFF];
                out[i] = prev;
            }
            return out;
        }

        function encrypt(path) {
            let data = stringToUtf8Bytes(path);
            for (const stage of STAGES) {
                data = encryptStage(data, stage.table, stage.key, stage.iv);
            }
            return bytesToBase64Url(data);
        }
        return encrypt(urlStr);
    }
}
