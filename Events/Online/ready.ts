const event = {
    name: 'clientReady',
    execute: (client: any) => {
        client.once('clientReady', async () => {
            console.log(`[READY] Bot online: ${client.user?.tag ?? 'desconhecido'}`);
        });
    },
};

export default event;
