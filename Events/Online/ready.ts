const Event = {
    name: 'clientReady',
    execute: (Client: any) => {
        Client.once('clientReady', async () => {
            console.log(`[READY] Bot online: ${Client.user?.tag ?? 'desconhecido'}`);
        });
    },
};

export default Event;
