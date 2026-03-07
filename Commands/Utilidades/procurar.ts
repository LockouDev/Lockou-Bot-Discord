import { InteractionContextType, EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, CommandInteraction, MessageFlags } from 'discord.js';
import Https from 'https';

const RobloxCookie = process.env.COOKIE?.trim() ?? null;

function Delay(Ms: number) {

  return new Promise(Resolve => setTimeout(Resolve, Ms));

}

// FunÃ§Ã£o para realizar requisiÃ§Ã£o POST
function PostRequest(Url: string, Data: any): Promise<any> {

  return new Promise((Resolve, Reject) => {

    const JsonData = JSON.stringify(Data);
    const Req = Https.request(Url, {

      method: 'POST',
      headers: {

        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JsonData),

      },

      timeout: 10000,

    }, (Res) => {

      let Body = '';

      Res.on('data', (Chunk) => (Body += Chunk));
      Res.on('end', () => {

        try { Resolve(JSON.parse(Body)); } catch { Resolve(Body); }

      });

    }

    );

    Req.on('error', Reject);
    Req.write(JsonData);
    Req.end();

  });

}

// FunÃ§Ã£o para realizar requisiÃ§Ã£o GET
function GetRequest(Url: string, UseCookie: boolean = false): Promise<any> {

  return new Promise((Resolve, Reject) => {

    const Headers: any = {

      'Accept': 'application/json',
      'Referer': 'https://www.roblox.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

    };

    if (UseCookie && RobloxCookie) {

      Headers['Cookie'] = `.ROBLOSECURITY=${RobloxCookie}`;

    }

    const Req = Https.request(Url, { method: 'GET', headers: Headers, timeout: 10000 }, (Res) => {

      let Body = '';

      Res.on('data', (Chunk) => (Body += Chunk));
      Res.on('end', () => {

        try {

          Resolve(JSON.parse(Body));

        } catch {

          const Trimmed = Body.trim();

          if (Trimmed === 'true') Resolve(true);

          else if (Trimmed === 'false') Resolve(false);

          else Resolve(Body);

        }

      });

    });

    Req.on('error', Reject);
    Req.end();

  });

}

// FunÃ§Ã£o para tentar buscar os dados com mÃºltiplas tentativas
async function FetchWithRetry<T>(Fn: () => Promise<T>, Retries = 3, DelayTime = 1000): Promise<T> {

  for (let I = 1; I <= Retries; I++) {

    try {

      return await Fn();

    } catch {

      if (I < Retries) await Delay(DelayTime);

    }

  }

  throw new Error('Falha apÃ³s vÃ¡rias tentativas');

}

async function HasPremium(UserId: number): Promise<boolean> {

  if (!RobloxCookie) {
    return false;
  }

  try {
    const Result = await GetRequest(`https://premiumfeatures.roblox.com/v1/users/${UserId}/validate-membership`, true);

    return Result === true;

  } catch (Error: any) {

    console.log(`[DEBUG] Erro no Premium check para ${UserId}:`, Error.message || Error);
    return false;

  }

}

async function FetchCounter(Url: string, Retries = 8, DelayMs = 900): Promise<string> {
  for (let Attempt = 1; Attempt <= Retries; Attempt++) {
    try {
      const Data = await GetRequest(Url);
      if (Data?.count != null) {
        return String(Data.count);
      }
    } catch {
      // ignora erro e tenta novamente
    }

    if (Attempt < Retries) {
      await Delay(DelayMs);
    }
  }

  return 'N/A';
}

async function FetchAllDataUntilComplete(UserId: number): Promise<any> {
  // 1. Dados crÃ­ticos â€” sempre carregam rÃ¡pido
  const [Info, Thumb, Headshot, PresenceRaw, Premium] = await Promise.all([
    GetRequest(`https://users.roblox.com/v1/users/${UserId}`),
    GetRequest(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${UserId}&size=420x420&format=Png&isCircular=false`),
    GetRequest(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${UserId}&size=150x150&format=Png&isCircular=true`),
    PostRequest('https://presence.roblox.com/v1/presence/users', { userIds: [UserId] }).catch(() => ({ userPresences: [] })),
    HasPremium(UserId)
  ]);

  // ValidaÃ§Ã£o dos dados essenciais
  if (!Info || !Thumb?.data?.[0]?.imageUrl || !Headshot?.data?.[0]?.imageUrl) {
    throw new Error('Erro ao carregar perfil ou avatar');
  }

  const PresenceInfo = PresenceRaw?.userPresences?.[0] || { userPresenceType: 0 };

  // 2. Contadores de amigos/seguidores/seguindo com retry (mÃ¡ximo 10 segundos)
  let FriendCount = 0;
  let FollowerCount = 0;
  let FollowingCount = 0;

  for (let I = 0; I < 15; I++) {
    try {
      const [F, Fo, Fi] = await Promise.all([
        GetRequest(`https://friends.roblox.com/v1/users/${UserId}/friends/count`),
        GetRequest(`https://friends.roblox.com/v1/users/${UserId}/followers/count`),
        GetRequest(`https://friends.roblox.com/v1/users/${UserId}/followings/count`)
      ]);

      if (F?.count != null) FriendCount = Number(F.count);
      if (Fo?.count != null) FollowerCount = Number(Fo.count);
      if (Fi?.count != null) FollowingCount = Number(Fi.count);

      // Se pegou pelo menos um valor diferente de zero, jÃƒÂ¡ tÃƒÂ¡ bom (conta nova pode ser tudo 0)
      if (FriendCount > 0 || FollowerCount > 0 || FollowingCount > 0 || I >= 10) {
        break;
      }
    } catch {
      // ignora erro e tenta de novo
    }

    await Delay(700);
  }

  return {
    playerInfo: Info,
    playerThumbnail: Thumb,
    playerHSThumbnail: Headshot,
    presenceInfo: PresenceInfo,
    premium: Premium,
    friendCount: FriendCount,
    followerCount: FollowerCount,
    followingCount: FollowingCount
  };
}

const Command = {

  data: new SlashCommandBuilder()
    .setName('procurar')
    .setDescription('Procurar um jogador no Roblox!')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addStringOption(Option =>
      Option.setName('player')
        .setDescription('Nickname do player')
        .setRequired(true)
    ),

  async run(Client: any, Interaction: any): Promise<void> {
    const Player = Interaction.options.getString('player');
    if (!Player?.trim()) return Interaction.reply({ content: 'Nome de jogador invÃ¡lido', ephemeral: true });

    await Interaction.deferReply();

    try {
      const UserResponse = await PostRequest('https://users.roblox.com/v1/usernames/users', {
        usernames: [Player],
        excludeBannedUsers: false,
      });

      const PlayerData = UserResponse?.data?.[0];
      if (!PlayerData) {
        return Interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FB5151')
            .setTitle('<:ContentDeleted:1315331180521979904> UsuÃ¡rio nÃ£o encontrado')
            .setDescription(`Parece que o jogador **${Player}** nÃ£o existe no Roblox`)
          ]
        });
      }

      const UserId = PlayerData.id;

      // 1. Pega os dados crÃ­ticos primeiro (rÃ¡pido)
      const [Info, Thumb, Headshot, PresenceRaw, Premium] = await Promise.all([
        GetRequest(`https://users.roblox.com/v1/users/${UserId}`),
        GetRequest(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${UserId}&size=420x420&format=Png&isCircular=false`),
        GetRequest(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${UserId}&size=150x150&format=Png&isCircular=true`),
        PostRequest('https://presence.roblox.com/v1/presence/users', { userIds: [UserId] }).catch(() => ({ userPresences: [] })),
        HasPremium(UserId)
      ]);

      if (!Info || !Thumb?.data?.[0]?.imageUrl || !Headshot?.data?.[0]?.imageUrl) {
        return Interaction.editReply({ content: 'Erro ao carregar avatar' });
      }

      const PresenceInfo = PresenceRaw?.userPresences?.[0] || { userPresenceType: 0 };
      const JoinDateUnix = Math.floor(new Date(Info.created).getTime() / 1000);

      const PresenceIcons: Record<number, string> = {
        0: '<:Offline:1315623606176190505>',
        1: '<:Online:1315623596730880001>',
        2: '<:Playing:1315623571619446784>',
        3: '<:Studio:1315623586903621632>'
      };

      const PresenceTexts: Record<number, string> = {
        0: 'Offline', 1: 'Online', 2: 'Jogando', 3: 'No Studio'
      };

      const PresenceIcon = PresenceIcons[PresenceInfo.userPresenceType] || '<:Offline:1315623606176190505>';
      const PresenceText = PresenceTexts[PresenceInfo.userPresenceType] || 'Desconhecido';

      const DisplayNameFormatted = Info.name === Info.displayName ? Info.name : `${Info.name} (${Info.displayName})`;
      const BanStatus = Info.isBanned ? '<:Confirm:1315286412664508426> Sim' : '<:Decline:1315286423170977803> NÃ£o';
      const PremiumStatus = Premium ? '<:Confirm:1315286412664508426> Sim' : '<:Decline:1315286423170977803> NÃ£o';
      const Description = Info.description?.trim() || null;

      // 2. EMBED INICIAL COM "CARREGANDO..."
      const Embed = new EmbedBuilder()
        .setColor(Info.isBanned ? '#FB5151' : '#50FB5B')
        .setAuthor({ name: `Perfil de ${Info.name}`, iconURL: 'https://img.icons8.com/ios11/200/FFFFFF/roblox.png' })
        .setTitle(`${PresenceIcon} ${DisplayNameFormatted}`)
        .setURL(`https://www.roblox.com/users/${UserId}/profile`)
        .setThumbnail(Thumb.data[0].imageUrl)
        .setDescription(Description)
        .addFields(
          { name: '<:PlayerIcon:1315270644107182140> ID do Jogador', value: `\`${UserId}\``, inline: true },
          { name: '<:ContentDeleted:1315331180521979904> Conta Banida', value: BanStatus, inline: true },
          { name: '<:Premium:1315261369955913728> Premium', value: PremiumStatus, inline: true },
          { name: '<:DateAccount:1315278306425438248> Data de CriaÃ§Ã£o', value: `<t:${JoinDateUnix}:d>`, inline: true },
          { name: '<:CreatedAccount:1315277832871739413> Idade da Conta', value: `${Math.floor((Date.now() - new Date(Info.created).getTime()) / 86400000)} dias`, inline: true },
          { name: `${PresenceIcon} Status`, value: PresenceText, inline: true },
          { name: '<:Friends:1315278590685745205> Total de Amigos', value: 'Carregando...', inline: true },
          { name: '<:Followers:1315279069029601371> Seguidores', value: 'Carregando...', inline: true },
          { name: '<:Following:1315280134244401204> Seguindo', value: 'Carregando...', inline: true }
        )
        .setFooter({ text: DisplayNameFormatted, iconURL: Headshot.data[0].imageUrl })
        .setTimestamp();

      if (Info.isBanned) {
        Embed.spliceFields(6, 3); // remove os 3 contadores se for banido
      }

      await Interaction.editReply({ embeds: [Embed] });

      if (!Info.isBanned) {
        const [FriendCount, FollowerCount, FollowingCount] = await Promise.all([
          FetchCounter(`https://friends.roblox.com/v1/users/${UserId}/friends/count`),
          FetchCounter(`https://friends.roblox.com/v1/users/${UserId}/followers/count`),
          FetchCounter(`https://friends.roblox.com/v1/users/${UserId}/followings/count`),
        ]);

        Embed.spliceFields(
          6,
          3,
          { name: '<:Friends:1315278590685745205> Total de Amigos', value: FriendCount, inline: true },
          { name: '<:Followers:1315279069029601371> Seguidores', value: FollowerCount, inline: true },
          { name: '<:Following:1315280134244401204> Seguindo', value: FollowingCount, inline: true },
        );

        await Interaction.editReply({ embeds: [Embed] });
      }
    } catch (Error) {
      console.error('Erro ao buscar informaÃ§Ãµes do jogador:', Error);
      await Interaction.editReply({
        content: '<:Roblox:1314141291621126165> Ocorreu um erro ao buscar as informaÃ§Ãµes, Tente novamente mais tarde',
      });
    }
  }

}

export default Command;

