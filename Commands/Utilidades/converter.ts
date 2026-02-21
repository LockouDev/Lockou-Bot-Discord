import {
    ApplicationIntegrationType,
    ColorResolvable,
    EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder,
} from 'discord.js';

type Currency = { code: string; name: string };
type CachedQuote = { ask: number; updatedAt: string; timestamp: number };

const currencies: Currency[] = [
    { code: 'BRL', name: 'Real Brasileiro' },
    { code: 'USD', name: 'Dólar Americano' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'Libra Esterlina' },
    { code: 'JPY', name: 'Iene Japonês' },
    { code: 'AUD', name: 'Dólar Australiano' },
    { code: 'CAD', name: 'Dólar Canadense' },
    { code: 'CHF', name: 'Franco Suíço' },
    { code: 'CNY', name: 'Yuan Chinês' },
    { code: 'INR', name: 'Rúpia Indiana' },
    { code: 'KRW', name: 'Won Sul-Coreano' },
    { code: 'MXN', name: 'Peso Mexicano' },
    { code: 'NZD', name: 'Dólar Neozelandês' },
    { code: 'RUB', name: 'Rublo Russo' },
    { code: 'ZAR', name: 'Rand Sul-Africano' },
    { code: 'SGD', name: 'Dólar de Singapura' },
    { code: 'BTC', name: 'Bitcoin' },
    { code: 'ETH', name: 'Ethereum' },
    { code: 'LTC', name: 'Litecoin' },
    { code: 'SOL', name: 'Solana' },
    { code: 'BNB', name: 'Binance Coin' },
    { code: 'XRP', name: 'XRP' },
    { code: 'DOGE', name: 'Dogecoin' },
    { code: 'USDT', name: 'Tether (USDT)' },
];

const quoteCache = new Map<string, CachedQuote>();
const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000;

const addCurrencyChoices = (option: any) => {
    for (const currency of currencies) {
        option.addChoices({ name: currency.name, value: currency.code });
    }
    return option;
};

function getCachedQuote(cacheKey: string): CachedQuote | null {
    const cached = quoteCache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if (Date.now() - cached.timestamp > QUOTE_CACHE_TTL_MS) {
        quoteCache.delete(cacheKey);
        return null;
    }

    return cached;
}

function normalizeApiData(data: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
            key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
            value,
        ]),
    ) as Record<string, any>;
}

function formatDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString('pt-BR');
}

const command = {
    data: new SlashCommandBuilder()
        .setName('converter')
        .setDescription('Converte uma moeda para outra usando cotação atual')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .addStringOption((option) =>
            addCurrencyChoices(
                option
                    .setName('moeda_local')
                    .setDescription('Moeda de destino')
                    .setRequired(true),
            ),
        )
        .addStringOption((option) =>
            addCurrencyChoices(
                option
                    .setName('moeda_estrangeira')
                    .setDescription('Moeda de origem')
                    .setRequired(true),
            ),
        ),

    async run(_client: any, interaction: any) {
        const localCurrency = interaction.options.getString('moeda_local');
        const sourceCurrency = interaction.options.getString('moeda_estrangeira');

        const isInteractionAlreadyAcknowledged = (error: any): boolean =>
            error?.code === 40060 || error?.rawError?.code === 40060;
        const isUnknownInteraction = (error: any): boolean =>
            error?.code === 10062 || error?.rawError?.code === 10062;
        const isInteractionNotReplied = (error: any): boolean => error?.code === 'InteractionNotReplied';
        const isIgnorableInteractionError = (error: any): boolean =>
            isInteractionAlreadyAcknowledged(error) || isUnknownInteraction(error) || isInteractionNotReplied(error);

        const ensureInteractionAcknowledged = async (): Promise<boolean> => {
            if (interaction.deferred || interaction.replied) {
                return true;
            }

            try {
                await interaction.deferReply();
                return true;
            } catch (error) {
                if (isIgnorableInteractionError(error)) {
                    return false;
                }

                throw error;
            }
        };

        const respond = async (payload: any) => {
            const canReply = await ensureInteractionAcknowledged();
            if (!canReply) {
                return;
            }

            try {
                await interaction.editReply(payload);
            } catch (error) {
                if (isIgnorableInteractionError(error)) {
                    return;
                }

                throw error;
            }
        };

        const canReply = await ensureInteractionAcknowledged();
        if (!canReply) {
            return;
        }

        if (!localCurrency || !sourceCurrency) {
            await respond({
                content: 'Selecione as moedas corretamente',
            });
            return;
        }

        const sourceCode = sourceCurrency.trim().toUpperCase();
        const localCode = localCurrency.trim().toUpperCase();
        const pairKey = `${sourceCode}${localCode}`;
        const cacheKey = `${sourceCode}-${localCode}`;

        if (sourceCode === localCode) {
            const embed = new EmbedBuilder()
                .setColor('Green' as ColorResolvable)
                .setTitle(`Conversão: ${sourceCode} -> ${localCode}`)
                .addFields(
                    { name: 'Valor atual', value: '1,00', inline: true },
                    { name: 'Última atualização', value: new Date().toLocaleString('pt-BR'), inline: false },
                );

            await respond({ embeds: [embed] });
            return;
        }

        try {
            const token = process.env.ECONOMIA_API_KEY;
            const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
            const apiUrl = `https://economia.awesomeapi.com.br/json/last/${sourceCode}-${localCode}${tokenParam}`;

            const response = await fetch(apiUrl);
            if (response.status === 429) {
                const cached = getCachedQuote(cacheKey);
                if (cached) {
                    const embed = new EmbedBuilder()
                        .setColor('Yellow' as ColorResolvable)
                        .setTitle(`Conversão: ${sourceCode} -> ${localCode}`)
                        .addFields(
                            {
                                name: 'Valor atual',
                                value: cached.ask.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                }),
                                inline: true,
                            },
                            {
                                name: 'Última atualização',
                                value: formatDate(cached.updatedAt),
                                inline: false,
                            },
                        )
                        .setFooter({ text: 'API em rate limit. Exibindo cotação em cache' });

                    await respond({ embeds: [embed] });
                    return;
                }

                await respond({
                    content: 'A API de cotação está em rate limit. Tente novamente em alguns segundos',
                });
                return;
            }

            if (!response.ok) {
                throw new Error(`Erro na API de cotação (${response.status})`);
            }

            const data = (await response.json()) as Record<string, any>;
            const normalizedData = normalizeApiData(data);
            const pairData = normalizedData[pairKey] ?? Object.values(data).find((entry: any) => entry?.ask);

            if (!pairData?.ask) {
                const cached = getCachedQuote(cacheKey);
                if (cached) {
                    const embed = new EmbedBuilder()
                        .setColor('Yellow' as ColorResolvable)
                        .setTitle(`Conversão: ${sourceCode} -> ${localCode}`)
                        .addFields(
                            {
                                name: 'Valor atual',
                                value: cached.ask.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                }),
                                inline: true,
                            },
                            {
                                name: 'Última atualização',
                                value: formatDate(cached.updatedAt),
                                inline: false,
                            },
                        )
                        .setFooter({ text: 'Resposta da API inválida. Exibindo cotação em cache' });

                    await respond({ embeds: [embed] });
                    return;
                }

                await respond({
                    content: 'Não foi possível obter a cotação desta moeda',
                });
                return;
            }

            const ask = Number(pairData.ask);
            if (!Number.isFinite(ask)) {
                await respond({
                    content: 'Não foi possível obter a cotação desta moeda',
                });
                return;
            }

            const updatedAtRaw = String(pairData.create_date ?? new Date().toISOString());
            quoteCache.set(cacheKey, {
                ask,
                updatedAt: updatedAtRaw,
                timestamp: Date.now(),
            });

            const embed = new EmbedBuilder()
                .setColor('Green' as ColorResolvable)
                .setTitle(`Conversão: ${sourceCode} -> ${localCode}`)
                .addFields(
                    {
                        name: 'Valor atual',
                        value: ask.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                        }),
                        inline: true,
                    },
                    {
                        name: 'Última atualização',
                        value: formatDate(updatedAtRaw),
                        inline: false,
                    },
                );

            await respond({ embeds: [embed] });
        } catch (error) {
            console.error('[CONVERTER] Erro ao consultar cotação:', error);
            await respond({
                content: 'Ocorreu um erro ao consultar a cotação',
            });
        }
    },
};

export default command;
