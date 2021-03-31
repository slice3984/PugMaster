export default async (route: string, data: Object) => {
    const port = location.port;
    let subFolder = 'pickup'; // Set to null if not hosted in any sub directory

    if (port) {
        // Running in dev mode
        subFolder = null;
    }

    const res = await fetch(`${location.protocol}//${location.hostname}${port ? `:${port}` : ''}${subFolder ? `/${subFolder}` : ''}/api/${route}`, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (res.status === 429) {
        // Ratelimit
        return null;
    }

    return res.json();
}