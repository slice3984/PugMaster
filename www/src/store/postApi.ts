export default async (route: string, data: Object) => {
    const res = await fetch(`/api/${route}`, {
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