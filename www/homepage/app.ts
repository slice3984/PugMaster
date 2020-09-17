import BookmarkPage from './bookmarkPage';
import StatsPage from './statsPage';

// Load theme if required
const bodyEl = document.body;
const storedTheme = localStorage.getItem('light-theme');

if (storedTheme) {
    bodyEl.classList.toggle('light-theme');
}

// Theme selector
const toggle = document.getElementById('theme-switch');
toggle.addEventListener('click', () => {
    bodyEl.classList.toggle('light-theme');
    if (!bodyEl.classList.contains('light-theme')) {
        localStorage.removeItem('light-theme');
    } else {
        localStorage.setItem('light-theme', '1');
    }
});

// **** Command Navigation ****
if (document.getElementById('commands')) {
    const commandListParentEl = Array.from(document.getElementById('command-list').children);
    const commandBoxEl = Array.of(document.getElementById('command-box').children)[0];
    const categories = ['pickup', 'info', 'admin'];
    let activeCommandPoint;
    let activeCommand;
    let activeCategory;
    let activeCategoryNavEl;

    let anchor = document.URL.split('#')[1];

    // Make sure invalid anchor tags get ignored
    if (!anchor || !document.getElementById(`${anchor}-link`)) {
        activeCommandPoint = commandListParentEl[0].firstElementChild;
        activeCommand = commandBoxEl[0];
        activeCategory = document.getElementById(categories[0]);
        activeCategoryNavEl = document.getElementById(`${categories[0]}-nav`);
    } else {
        const category = document.getElementById(`${anchor}-link`).parentElement.id;
        activeCommandPoint = document.getElementById(`${anchor}-link`);
        activeCommand = document.getElementById(`${anchor}-content`);
        activeCategory = document.getElementById(category);
        activeCategoryNavEl = document.getElementById(`${category}-nav`);
    }

    activeCommandPoint.classList.toggle('active');
    activeCommand.classList.toggle('hidden');
    activeCategory.classList.toggle('hidden');
    activeCategoryNavEl.classList.toggle('active-command-nav');

    categories.forEach(category => {
        const navEl = document.getElementById(`${category}-nav`);

        navEl.addEventListener('click', () => {
            activeCategory.classList.toggle('hidden');
            const categoryEl = document.getElementById(category);
            categoryEl.classList.toggle('hidden');
            activeCategory = categoryEl;

            activeCategoryNavEl.classList.toggle('active-command-nav');
            navEl.classList.toggle('active-command-nav');
            activeCategoryNavEl = navEl;
        });
    });

    let id = 0;
    commandListParentEl.forEach(child => {
        if (child.nodeName.toLowerCase() === 'div') {
            const childs = Array.from(child.children);
            childs.forEach(child => {
                let elemId = id;
                child.addEventListener('click', () => {

                    if (child === activeCommandPoint) {
                        return;
                    }

                    child.classList.toggle('active');
                    activeCommandPoint.classList.toggle('active');
                    activeCommandPoint = child;

                    commandBoxEl[elemId].classList.toggle('hidden');
                    activeCommand.classList.toggle('hidden');
                    activeCommand = commandBoxEl[elemId];
                });
                id++;
            })
        }
    });

    // Defaults
    const defaultButtonEls = document.querySelectorAll('.command__defaults-button');
    defaultButtonEls.forEach(node => {
        node.addEventListener('click', () => {
            const parentCommandEl = node.parentElement.parentElement;

            const properties = parentCommandEl.querySelector('.command__content__properties');
            const values = parentCommandEl.querySelector('.command__content__values');
            const defaultContainerEl = parentCommandEl.querySelector('.command__content__defaults');

            node.textContent = node.textContent === 'Info' ? 'Defaults' : 'Info';

            properties.classList.toggle('hidden');
            values.classList.toggle('hidden');
            defaultContainerEl.classList.toggle('hidden');
        });
    })
}

// **** Help Navigation ****
if (document.getElementById('help-content')) {
    let anchor = document.URL.split('#')[1];
    let helpLinks = document.querySelector('.help-box__chapters').querySelectorAll('a');
    let activeHelpPoint;
    let activeHelpContent;

    if (!anchor || !document.getElementById(anchor)) {
        activeHelpPoint = helpLinks[0];
        activeHelpContent = document.getElementById(activeHelpPoint.href.split('#').pop());
    } else {
        activeHelpPoint = document.querySelector(`a[href='#${anchor}']`);
        activeHelpContent = document.getElementById(anchor);
    }

    activeHelpPoint.classList.toggle('active');
    activeHelpContent.classList.toggle('hidden');

    helpLinks.forEach(node => {
        node.addEventListener('click', () => {
            if (activeHelpPoint === node) {
                return;
            }

            activeHelpPoint.classList.toggle('active');
            activeHelpContent.classList.toggle('hidden');
            activeHelpPoint = node;
            activeHelpPoint.classList.toggle('active');
            activeHelpContent = document.getElementById(activeHelpPoint.href.split('#').pop());
            activeHelpContent.classList.toggle('hidden');

        });
    })
}

// **** Stats guild search ****
if (document.getElementById('stats-content')) {
    (async () => {
        const urlObj = new URL(window.location.href);
        const guildParam = urlObj.searchParams.get('server');
        const pageParam = urlObj.searchParams.get('page');

        const ratelimitBoxEl = document.getElementById('ratelimit-box');
        const rateLimitCloseEl = document.getElementById('ratelimit-box-close');
        rateLimitCloseEl.addEventListener('click', () => ratelimitBoxEl.classList.toggle('hidden'));

        const favoritesBoxEl = document.getElementById('server-favorites') as HTMLDivElement;
        const searchResultsDiv = document.getElementById('search-results') as HTMLDivElement;
        const searchInfoDiv = document.getElementById('search-info') as HTMLSpanElement;
        const inputEl = document.getElementById('server-search') as HTMLInputElement;

        if (guildParam) {
            document.getElementById('stats-page').classList.toggle('hidden');
            new StatsPage(pageParam);
        } else {
            document.getElementById('bookmark-page').classList.toggle('hidden');
            new BookmarkPage(favoritesBoxEl, searchResultsDiv, searchInfoDiv, inputEl);
        }
    })();
}