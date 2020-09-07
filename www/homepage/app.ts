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
    const commandLinkEls = [];
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
    })
}