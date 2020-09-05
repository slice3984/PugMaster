// **** Command Navigation ****
const commandListParentEl = Array.from(document.getElementById('command-list').children);
const commandBoxEl = Array.of(document.getElementById('command-box').children)[0];
let activeCommandPoint = commandListParentEl[0].firstElementChild;
let activeCommand = commandBoxEl[0];
const commandLinkEls = [];
const categories = ['pickup', 'info', 'admin'];
let activeCategory = document.getElementById(categories[0]);
let activeCategoryNavEl = document.getElementById(`${categories[0]}-nav`);

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