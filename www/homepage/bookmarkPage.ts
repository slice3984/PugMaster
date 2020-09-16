import { debounce, postApi } from './util';

const SEARCH_DELAY = 500;

export default class BookmarkPage {
    private favoritesBoxEl: HTMLDivElement;
    private favoriteEls: Map<string, HTMLAnchorElement> = new Map();
    private currentSearchEls: Map<string, HTMLAnchorElement> = new Map();
    private searchResultsDiv: HTMLDivElement;
    private searchInfoEl: HTMLSpanElement;
    private inputEl: HTMLInputElement;
    private storedFavorites: string[];


    constructor(favoritesBoxEl: HTMLDivElement, searchResultsDiv: HTMLDivElement, searchInfoEl: HTMLSpanElement, inputEl: HTMLInputElement) {
        this.favoritesBoxEl = favoritesBoxEl;
        this.searchResultsDiv = searchResultsDiv;
        this.searchInfoEl = searchInfoEl;
        this.inputEl = inputEl;

        // Init
        this.getLSFavorites();
        this.initInput();

        // Attempt to request more guild info using the api
        (async () => {
            if (this.storedFavorites.length) {
                const extendedGuildInfo = await this.getFavoriteInfo();

                // Render favorites if any available
                extendedGuildInfo.forEach(info => {
                    const favoriteEl = this.generateFavEl(info.name, info.id, info.icon);
                    this.favoriteEls.set(info.id, favoriteEl);
                    this.favoritesBoxEl.appendChild(favoriteEl);
                });
            } else {
                this.favoritesBoxEl.innerHTML = '<h3>No servers bookmarked</h3>';
            }
        })();
    }

    private getLSFavorites() {
        this.storedFavorites = localStorage.getItem('favorites') ? (JSON.parse(localStorage.getItem('favorites')) as []) : [];
    }

    private async getFavoriteInfo(): Promise<{ name: string; id: string; icon: string | null }[]> {
        const guildInfo = await postApi('/info', { guilds: this.storedFavorites });

        return guildInfo.guilds.map(guild => {
            return {
                name: guild.name,
                id: guild.id,
                icon: guild.icon
            };
        });
    }

    private initInput() {
        this.inputEl.addEventListener('input', debounce(async () => {
            // Skip for empty inputs, clear search
            if (!this.inputEl.value.length) {
                this.searchResultsDiv.innerHTML = '';
                this.searchInfoEl.textContent = 'Start to search to see results here';
                return;
            }

            const results = await postApi('search', { query: this.inputEl.value });

            // Got results
            if (results && results.status === 'success' && results.sent) {
                this.searchResultsDiv.innerHTML = '';
                this.searchInfoEl.textContent = '';
                this.currentSearchEls.clear();

                results.matches.forEach(result => {
                    const searchEl = this.generateSearchResultEl(result);
                    this.currentSearchEls.set(result.id, searchEl);
                    this.searchResultsDiv.appendChild(searchEl);
                });

                // Render the x results left info
                if (results.left) {
                    this.searchInfoEl.textContent = `${results.left} more result${results.left > 1 ? 's' : ''} found`;
                }
            } else if (results && results.status === 'success' && !results.sent) {
                // No results
                this.searchResultsDiv.innerHTML = '';
                this.searchInfoEl.textContent = 'No results';
                this.currentSearchEls.clear();
            } else {
                // No success, maybe rate limited
                this.searchResultsDiv.innerHTML = '';
                this.searchInfoEl.textContent = '';
                this.currentSearchEls.clear();
            }
        }, SEARCH_DELAY));
    }

    private generateFavEl(name: string, id: string, image: string | null): HTMLAnchorElement {
        const favoriteEl = document.createElement('a');
        favoriteEl.className = 'favorite';
        favoriteEl.id = id;
        favoriteEl.href = `./stats?server=${id}`;

        const favoritecloseEl = document.createElement('div');
        favoritecloseEl.className = 'favorite__close';

        favoritecloseEl.addEventListener('click', e => {
            e.preventDefault();
            this.removeGuild(id);
        });

        const favoriteImgContainer = document.createElement('div');
        favoriteImgContainer.className = 'favorite__img';

        let favoriteImgEl: HTMLDivElement | HTMLImageElement;

        if (image) {
            favoriteImgEl = document.createElement('img');
            favoriteImgEl.setAttribute('src', image);
        } else {
            favoriteImgEl = document.createElement('div');
            favoriteImgEl.className = 'favorite__placeholder';
        }

        const favoriteInfoContainer = document.createElement('div');
        favoriteInfoContainer.className = 'favorite__info';

        const favoriteNameEl = document.createElement('div');
        favoriteNameEl.className = 'favorite__name';
        favoriteNameEl.textContent = name;

        const favoriteIdEl = document.createElement('div');
        favoriteIdEl.className = 'favorite__id';
        favoriteIdEl.textContent = id;

        favoriteEl.appendChild(favoritecloseEl);
        favoriteImgContainer.appendChild(favoriteImgEl);
        favoriteEl.appendChild(favoriteImgContainer);
        favoriteInfoContainer.appendChild(favoriteNameEl);
        favoriteInfoContainer.appendChild(favoriteIdEl);
        favoriteEl.appendChild(favoriteInfoContainer);

        return favoriteEl;
    }

    private generateSearchResultEl(result: { id: string; name: string; icon: string | null }): HTMLAnchorElement {
        const itemEl = document.createElement('a');
        itemEl.className = 'search-result';
        itemEl.href = `./stats?server=${result.id}`;

        // Child content
        const itemContentEl = document.createElement('div');
        itemContentEl.className = 'search-result__content';

        // Image container
        const guildImageEl = document.createElement('div');
        guildImageEl.className = 'search-result__image';

        // Image content
        let imageEl: HTMLDivElement | HTMLImageElement;

        if (result.icon) {
            imageEl = document.createElement('img');
            imageEl.setAttribute('src', result.icon);
        } else {
            imageEl = document.createElement('div');
            imageEl.className = 'search-result__placeholder';
        }

        // Guild info container
        const guildInfoEl = document.createElement('div');
        guildInfoEl.className = 'search-result__info';

        // Info container name
        const guildNameEl = document.createElement('span');
        guildNameEl.className = 'search-result__name';
        guildNameEl.textContent = result.name;

        // Info container id
        const guildIdEl = document.createElement('span');
        guildIdEl.className = 'search-result__id';
        guildIdEl.textContent = result.id;

        // Bookmark container
        const bookmarkEl = document.createElement('div');
        bookmarkEl.className = 'search-result__bookmark';

        // Bookmark svg
        const svgImg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgImg.innerHTML = '<use xlink:href="./www/homepage/img/sprite.svg#icon-star-full"></use>';

        if (this.storedFavorites.includes(result.id)) {
            svgImg.setAttribute('class', 'search-result__bookmark-icon search-result__bookmark-icon--fav');
        } else {
            svgImg.setAttribute('class', 'search-result__bookmark-icon search-result__bookmark-icon--nonfav');
        }

        bookmarkEl.addEventListener('click', e => {
            e.preventDefault();

            if (this.storedFavorites.includes(result.id)) {
                this.removeGuild(result.id);
            } else {
                if (this.storedFavorites.length >= 6) {
                    const limitReachedEl = document.createElement('span');

                    limitReachedEl.className = 'red';
                    limitReachedEl.textContent = 'You already reached the limit of 6 bookmarked servers';

                    guildNameEl.insertAdjacentElement('beforebegin', limitReachedEl);

                    setTimeout(() => {
                        limitReachedEl.remove();
                    }, 3000);

                    return;
                }

                this.addGuild(result.id, result.name, result.icon);
            }
        });

        // Add childs to parents
        guildImageEl.appendChild(imageEl);
        itemContentEl.appendChild(guildImageEl);

        guildInfoEl.appendChild(guildNameEl);
        guildInfoEl.appendChild(guildIdEl);

        itemContentEl.appendChild(guildInfoEl);

        bookmarkEl.appendChild(svgImg);

        itemEl.appendChild(itemContentEl);
        itemEl.appendChild(bookmarkEl);

        return itemEl;
    }

    private addGuild(id: string, name: string, icon: string | null) {
        if (!this.storedFavorites.length) {
            this.favoritesBoxEl.innerHTML = '';
        }

        this.storedFavorites.push(id);
        const favoriteEl = this.generateFavEl(name, id, icon);
        this.favoriteEls.set(id, favoriteEl);
        this.favoritesBoxEl.appendChild(favoriteEl);

        const searchElRef = this.currentSearchEls.get(id);

        if (searchElRef) {
            searchElRef.querySelector('svg').setAttribute('class', 'search-result__bookmark-icon search-result__bookmark-icon--fav');
        }

        this.updateLS();
    }

    private removeGuild(id: string) {
        this.storedFavorites.splice(this.storedFavorites.findIndex(storedId => storedId === id), 1);

        const favoriteRef = this.favoriteEls.get(id);

        if (favoriteRef) {
            favoriteRef.remove();
            this.favoriteEls.delete(id);
        }

        const searchElRef = this.currentSearchEls.get(id);

        if (searchElRef) {
            searchElRef.querySelector('svg').setAttribute('class', 'search-result__bookmark-icon search-result__bookmark-icon--nonfav');
        }

        if (!this.storedFavorites.length) {
            this.favoritesBoxEl.innerHTML = '<h3>No servers bookmarked</h3>';
        }

        this.updateLS();
    }

    private updateLS() {
        localStorage.setItem('favorites', JSON.stringify(this.storedFavorites));
    }
}