import {
    ApplicationIntegrationType,
    ColorResolvable,
    EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder,
} from 'discord.js';

type Currency = { code: string; name: string };
type CachedQuote = { ask: number; updatedAt: string; timestamp: number };

const Currencies: Currency[] = [
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

const QuoteCache = new Map<string, CachedQuote>();
const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000;

const AddCurrencyChoices = (Option: any) => {
    for (const Currency of Currencies) {
        Option.addChoices({ name: Currency.name, value: Currency.code });
    }
    return Option;
};

function GetCachedQuote(CacheKey: string): CachedQuote | null {
    const Cached = QuoteCache.get(CacheKey);
    if (!Cached) {
        return null;
    }

    if (Date.now() - Cached.timestamp > QUOTE_CACHE_TTL_MS) {
        QuoteCache.delete(CacheKey);
        return null;
    }

    return Cached;
}

function NormalizeApiData(Data: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
        Object.entries(Data).map(([Key, Value]) => [
            Key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
            Value,
        ]),
    ) as Record<string, any>;
}

function FormatDate(Value: string): string {
    const Parsed = new Date(Value);
    if (Number.isNaN(Parsed.getTime())) {
        return Value;
    }

    return Parsed.toLocaleString('pt-BR');
}

const Command = {
    data: new SlashCommandBuilder()
        .setName('converter')
        .setDescription('Converte uma moeda para outra usando cotação atual')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .addStringOption((Option) =>
            AddCurrencyChoices(
                Option
                    .setName('moeda_local')
                    .setDescription('Moeda de destino')
                    .setRequired(true),
            ),
        )
        .addStringOption((Option) =>
            AddCurrencyChoices(
                Option
                    .setName('moeda_estrangeira')
                    .setDescription('Moeda de origem')
                    .setRequired(true),
            ),
        ),

    async run(_client: any, Interaction: any) {
        const LocalCurrency = Interaction.options.getString('moeda_local');
        const SourceCurrency = Interaction.options.getString('moeda_estrangeira');

        const IsInteractionAlreadyAcknowledged = (Error: any): boolean =>
            Error?.code === 40060 || Error?.rawError?.code === 40060;
        const IsUnknownInteraction = (Error: any): boolean =>
            Error?.code === 10062 || Error?.rawError?.code === 10062;
        const IsInteractionNotReplied = (Error: any): boolean => Error?.code === 'InteractionNotReplied';
        const IsIgnorableInteractionError = (Error: any): boolean =>
            IsInteractionAlreadyAcknowledged(Error) || IsUnknownInteraction(Error) || IsInteractionNotReplied(Error);

        const EnsureInteractionAcknowledged = async (): Promise<boolean> => {
            if (Interaction.deferred || Interaction.replied) {
                return true;
            }

            try {
                await Interaction.deferReply();
                return true;
            } catch (Error) {
                if (IsIgnorableInteractionError(Error)) {
                    return false;
                }

                throw Error;
            }
        };

        const Respond = async (Payload: any) => {
            const CanReply = await EnsureInteractionAcknowledged();
            if (!CanReply) {
                return;
            }

            try {
                await Interaction.editReply(Payload);
            } catch (Error) {
                if (IsIgnorableInteractionError(Error)) {
                    return;
                }

                throw Error;
            }
        };

        const CanReply = await EnsureInteractionAcknowledged();
        if (!CanReply) {
            return;
        }

        if (!LocalCurrency || !SourceCurrency) {
            await Respond({
                content: 'Selecione as moedas corretamente',
            });
            return;
        }

        const SourceCode = SourceCurrency.trim().toUpperCase();
        const LocalCode = LocalCurrency.trim().toUpperCase();
        const PairKey = `${SourceCode}${LocalCode}`;
        const CacheKey = `${SourceCode}-${LocalCode}`;

        if (SourceCode === LocalCode) {
            const Embed = new EmbedBuilder()
                .setColor('Green' as ColorResolvable)
                .setTitle(`Conversão: ${SourceCode} -> ${LocalCode}`)
                .addFields(
                    { name: 'Valor atual', value: '1,00', inline: true },
                    { name: 'Última atualização', value: new Date().toLocaleString('pt-BR'), inline: false },
                );

            await Respond({ embeds: [Embed] });
            return;
        }

        try {
            const Token = process.env.ECONOMIA_API_KEY;
            const TokenParam = Token ? `?token=${encodeURIComponent(Token)}` : '';
            const ApiUrl = `https://economia.awesomeapi.com.br/json/last/${SourceCode}-${LocalCode}${TokenParam}`;

            const Response = await fetch(ApiUrl);
            if (Response.status === 429) {
                const Cached = GetCachedQuote(CacheKey);
                if (Cached) {
                    const Embed = new EmbedBuilder()
                        .setColor('Yellow' as ColorResolvable)
                        .setTitle(`Conversão: ${SourceCode} -> ${LocalCode}`)
                        .addFields(
                            {
                                name: 'Valor atual',
                                value: Cached.ask.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                }),
                                inline: true,
                            },
                            {
                                name: 'Última atualização',
                                value: FormatDate(Cached.updatedAt),
                                inline: false,
                            },
                        )
                        .setFooter({ text: 'API em rate limit. Exibindo cotação em cache' });

                    await Respond({ embeds: [Embed] });
                    return;
                }

                await Respond({
                    content: 'A API de cotação está em rate limit. Tente novamente em alguns segundos',
                });
                return;
            }

            if (!Response.ok) {
                throw new Error(`Erro na API de cotação (${Response.status})`);
            }

            const Data = (await Response.json()) as Record<string, any>;
            const NormalizedData = NormalizeApiData(Data);
            const PairData = NormalizedData[PairKey] ?? Object.values(Data).find((Entry: any) => Entry?.ask);

            if (!PairData?.ask) {
                const Cached = GetCachedQuote(CacheKey);
                if (Cached) {
                    const Embed = new EmbedBuilder()
                        .setColor('Yellow' as ColorResolvable)
                        .setTitle(`Conversão: ${SourceCode} -> ${LocalCode}`)
                        .addFields(
                            {
                                name: 'Valor atual',
                                value: Cached.ask.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                }),
                                inline: true,
                            },
                            {
                                name: 'Última atualização',
                                value: FormatDate(Cached.updatedAt),
                                inline: false,
                            },
                        )
                        .setFooter({ text: 'Resposta da API inválida. Exibindo cotação em cache' });

                    await Respond({ embeds: [Embed] });
                    return;
                }

                await Respond({
                    content: 'Não foi possível obter a cotação desta moeda',
                });
                return;
            }

            const Ask = Number(PairData.ask);
            if (!Number.isFinite(Ask)) {
                await Respond({
                    content: 'Não foi possível obter a cotação desta moeda',
                });
                return;
            }

            const UpdatedAtRaw = String(PairData.create_date ?? new Date().toISOString());
            QuoteCache.set(CacheKey, {
                ask: Ask,
                updatedAt: UpdatedAtRaw,
                timestamp: Date.now(),
            });

            const Embed = new EmbedBuilder()
                .setColor('Green' as ColorResolvable)
                .setTitle(`Conversão: ${SourceCode} -> ${LocalCode}`)
                .addFields(
                    {
                        name: 'Valor atual',
                        value: Ask.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                        }),
                        inline: true,
                    },
                    {
                        name: 'Última atualização',
                        value: FormatDate(UpdatedAtRaw),
                        inline: false,
                    },
                );

            await Respond({ embeds: [Embed] });
        } catch (Error) {
            console.error('[CONVERTER] Erro ao consultar cotação:', Error);
            await Respond({
                content: 'Ocorreu um erro ao consultar a cotação',
            });
        }
    },
};

export default Command;
