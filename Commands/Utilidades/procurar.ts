import { InteractionContextType, EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, CommandInteraction, MessageFlags } from 'discord.js';
import https from 'https';

const ROBLOX_COOKIE = process.env.COOKIE?.trim();

if (!ROBLOX_COOKIE) {

  console.error('ERRO: Variável COOKIE não encontrada no .env');
  process.exit(1);

}

function delay(ms: number) {

  return new Promise(resolve => setTimeout(resolve, ms));

}

// Função para realizar requisição POST
function postRequest(url: string, data: any): Promise<any> {

  return new Promise((resolve, reject) => {

    const jsonData = JSON.stringify(data);
    const req = https.request(url, {

      method: 'POST',
      headers: {

        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData),

      },

      timeout: 10000,

    }, (res) => {

      let body = '';

      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {

        try { resolve(JSON.parse(body)); } catch { resolve(body); }

      });

    }

    );

    req.on('error', reject);
    req.write(jsonData);
    req.end();

  });

}

// Função para realizar requisição GET
function getRequest(url: string, useCookie: boolean = false): Promise<any> {

  return new Promise((resolve, reject) => {

    const headers: any = {

      'Accept': 'application/json',
      'Referer': 'https://www.roblox.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

    };

    if (useCookie && ROBLOX_COOKIE) {

      headers['Cookie'] = `.ROBLOSECURITY=${ROBLOX_COOKIE}`;

    }

    const req = https.request(url, { method: 'GET', headers, timeout: 10000 }, (res) => {

      let body = '';

      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {

        try {

          resolve(JSON.parse(body));

        } catch {

          const trimmed = body.trim();

          if (trimmed === 'true') resolve(true);

          else if (trimmed === 'false') resolve(false);

          else resolve(body);

        }

      });

    });

    req.on('error', reject);
    req.end();

  });

}

// Função para tentar buscar os dados com múltiplas tentativas
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, delayTime = 1000): Promise<T> {

  for (let i = 1; i <= retries; i++) {

    try {

      return await fn();

    } catch {

      if (i < retries) await delay(delayTime);

    }

  }

  throw new Error('Falha após várias tentativas');

}

async function hasPremium(userId: number): Promise<boolean> {

  try {
    const result = await getRequest(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, true);

    return result === true;

  } catch (error: any) {

    console.log(`[DEBUG] Erro no Premium check para ${userId}:`, error.message || error);
    return false;

  }

}
/**
async function fetchAllDataUntilComplete(userId: number) {

  const [

    info,
    thumb,
    headshot,
    presenceRaw,
    premium,
    friends,
    followers,
    followings

  ] = await Promise.allSettled([

    getRequest(`https://users.roblox.com/v1/users/${userId}`),
    getRequest(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
    getRequest(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`),
    postRequest('https://presence.roblox.com/v1/presence/users', { userIds: [userId] }),
    hasPremium(userId),
    getRequest(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
    getRequest(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
    getRequest(`https://friends.roblox.com/v1/users/${userId}/followings/count`)

  ]);

  // Extrai sÃ³ o que deu certo
  const playerInfo = info.status === 'fulfilled' ? info.value : null;
  const playerThumbnail = thumb.status === 'fulfilled' && thumb.value?.data?.[0]?.state === 'Completed' ? thumb.value : null;
  const playerHSThumbnail = headshot.status === 'fulfilled' && headshot.value?.data?.[0]?.state === 'Completed' ? headshot.value : null;
  const presenceInfo = presenceRaw.status === 'fulfilled' && presenceRaw.value?.userPresences?.[0] ? presenceRaw.value.userPresences[0] : { userPresenceType: 0 };
  const friendCount = friends.status === 'fulfilled' && friends.value?.count != null ? friends.value.count : '???';
  const followerCount = followers.status === 'fulfilled' && followers.value?.count != null ? followers.value.count : '???';
  const followingCount = followings.status === 'fulfilled' && followings.value?.count != null ? followings.value.count : '???';

  // Se nÃ£o tiver info bÃ¡sica, falha total
  if (!playerInfo || !playerThumbnail || !playerHSThumbnail) {

    throw new Error('Falha crÃ­tica ao carregar avatar ou informaÃ§Ãµes do usuÃ¡rio');

  }

  return {

    playerInfo,
    playerThumbnail,
    playerHSThumbnail,
    presenceInfo,
    premium: premium as unknown as boolean,
    friendCount,
    followerCount,
    followingCount

  };

}
*/

async function fetchAllDataUntilComplete(userId: number): Promise<any> {
  // 1. Dados críticos — sempre carregam rápido
  const [info, thumb, headshot, presenceRaw, premium] = await Promise.all([
    getRequest(`https://users.roblox.com/v1/users/${userId}`),
    getRequest(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
    getRequest(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`),
    postRequest('https://presence.roblox.com/v1/presence/users', { userIds: [userId] }).catch(() => ({ userPresences: [] })),
    hasPremium(userId)
  ]);

  // Validação dos dados essenciais
  if (!info || !thumb?.data?.[0]?.imageUrl || !headshot?.data?.[0]?.imageUrl) {
    throw new Error('Erro ao carregar perfil ou avatar');
  }

  const presenceInfo = presenceRaw?.userPresences?.[0] || { userPresenceType: 0 };

  // 2. Contadores de amigos/seguidores/seguindo com retry (máximo 10 segundos)
  let friendCount = 0;
  let followerCount = 0;
  let followingCount = 0;

  for (let i = 0; i < 15; i++) {
    try {
      const [f, fo, fi] = await Promise.all([
        getRequest(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
        getRequest(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
        getRequest(`https://friends.roblox.com/v1/users/${userId}/followings/count`)
      ]);

      if (f?.count != null) friendCount = Number(f.count);
      if (fo?.count != null) followerCount = Number(fo.count);
      if (fi?.count != null) followingCount = Number(fi.count);

      // Se pegou pelo menos um valor diferente de zero, jÃ¡ tÃ¡ bom (conta nova pode ser tudo 0)
      if (friendCount > 0 || followerCount > 0 || followingCount > 0 || i >= 10) {
        break;
      }
    } catch {
      // ignora erro e tenta de novo
    }

    await delay(700);
  }

  return {
    playerInfo: info,
    playerThumbnail: thumb,
    playerHSThumbnail: headshot,
    presenceInfo,
    premium,
    friendCount,
    followerCount,
    followingCount
  };
}

const command = {

  data: new SlashCommandBuilder()
    .setName('procurar')
    .setDescription('Procurar um jogador no Roblox!')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Nickname do player')
        .setRequired(true)
    ),

  async run(client: any, interaction: any): Promise<void> {
    const player = interaction.options.getString('player');
    if (!player?.trim()) return interaction.reply({ content: 'Nome de jogador inválido', ephemeral: true });

    await interaction.deferReply();

    try {
      const userResponse = await postRequest('https://users.roblox.com/v1/usernames/users', {
        usernames: [player],
        excludeBannedUsers: false,
      });

      const playerData = userResponse?.data?.[0];
      if (!playerData) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FB5151')
            .setTitle('<:ContentDeleted:1315331180521979904> Usuário não encontrado')
            .setDescription(`Parece que o jogador **${player}** não existe no Roblox`)
          ]
        });
      }

      const userId = playerData.id;

      // 1. Pega os dados críticos primeiro (rápido)
      const [info, thumb, headshot, presenceRaw, premium] = await Promise.all([
        getRequest(`https://users.roblox.com/v1/users/${userId}`),
        getRequest(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
        getRequest(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`),
        postRequest('https://presence.roblox.com/v1/presence/users', { userIds: [userId] }).catch(() => ({ userPresences: [] })),
        hasPremium(userId)
      ]);

      if (!info || !thumb?.data?.[0]?.imageUrl || !headshot?.data?.[0]?.imageUrl) {
        return interaction.editReply({ content: 'Erro ao carregar avatar', ephemeral: true });
      }

      const presenceInfo = presenceRaw?.userPresences?.[0] || { userPresenceType: 0 };
      const joinDateUnix = Math.floor(new Date(info.created).getTime() / 1000);

      const presenceIcons: Record<number, string> = {
        0: '<:Offline:1315623606176190505>',
        1: '<:Online:1315623596730880001>',
        2: '<:Playing:1315623571619446784>',
        3: '<:Studio:1315623586903621632>'
      };

      const presenceTexts: Record<number, string> = {
        0: 'Offline', 1: 'Online', 2: 'Jogando', 3: 'No Studio'
      };

      const presenceIcon = presenceIcons[presenceInfo.userPresenceType] || '<:Offline:1315623606176190505>';
      const presenceText = presenceTexts[presenceInfo.userPresenceType] || 'Desconhecido';

      const displayNameFormatted = info.name === info.displayName ? info.name : `${info.name} (${info.displayName})`;
      const banStatus = info.isBanned ? '<:Confirm:1315286412664508426> Sim' : '<:Decline:1315286423170977803> Não';
      const premiumStatus = premium ? '<:Confirm:1315286412664508426> Sim' : '<:Decline:1315286423170977803> Não';
      const description = info.description?.trim() || null;

      // 2. EMBED INICIAL COM "CARREGANDO..."
      const embed = new EmbedBuilder()
        .setColor(info.isBanned ? '#FB5151' : '#50FB5B')
        .setAuthor({ name: `Perfil de ${info.name}`, iconURL: 'https://img.icons8.com/ios11/200/FFFFFF/roblox.png' })
        .setTitle(`${presenceIcon} ${displayNameFormatted}`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setThumbnail(thumb.data[0].imageUrl)
        .setDescription(description)
        .addFields(
          { name: '<:PlayerIcon:1315270644107182140> ID do Jogador', value: `\`${userId}\``, inline: true },
          { name: '<:ContentDeleted:1315331180521979904> Conta Banida', value: banStatus, inline: true },
          { name: '<:Premium:1315261369955913728> Premium', value: premiumStatus, inline: true },
          { name: '<:DateAccount:1315278306425438248> Data de Criação', value: `<t:${joinDateUnix}:d>`, inline: true },
          { name: '<:CreatedAccount:1315277832871739413> Idade da Conta', value: `${Math.floor((Date.now() - new Date(info.created).getTime()) / 86400000)} dias`, inline: true },
          { name: `${presenceIcon} Status`, value: presenceText, inline: true },
          { name: '<:Friends:1315278590685745205> Total de Amigos', value: 'Carregando...', inline: true },
          { name: '<:Followers:1315279069029601371> Seguidores', value: 'Carregando...', inline: true },
          { name: '<:Following:1315280134244401204> Seguindo', value: 'Carregando...', inline: true }
        )
        .setFooter({ text: displayNameFormatted, iconURL: headshot.data[0].imageUrl })
        .setTimestamp();

      if (info.isBanned) {
        embed.spliceFields(6, 3); // remove os 3 contadores se for banido
      }

      await interaction.editReply({ embeds: [embed] });

      // 3. TENTA ATÃ‰ CONSEGUIR OS 3 VALORES (NUNCA DESISTE)
      let friendCount = null;
      let followerCount = null;
      let followingCount = null;

      while (friendCount === null || followerCount === null || followingCount === null) {
        try {
          const [f, fo, fi] = await Promise.all([
            getRequest(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            getRequest(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
            getRequest(`https://friends.roblox.com/v1/users/${userId}/followings/count`)
          ]);

          if (f?.count != null && friendCount === null) {
            friendCount = String(f.count);
            embed.spliceFields(6, 1, { name: '<:Friends:1315278590685745205> Total de Amigos', value: friendCount, inline: true });
            await interaction.editReply({ embeds: [embed] });
          }
          if (fo?.count != null && followerCount === null) {
            followerCount = String(fo.count);
            embed.spliceFields(7, 1, { name: '<:Followers:1315279069029601371> Seguidores', value: followerCount, inline: true });
            await interaction.editReply({ embeds: [embed] });
          }
          if (fi?.count != null && followingCount === null) {
            followingCount = String(fi.count);
            embed.spliceFields(8, 1, { name: '<:Following:1315280134244401204> Seguindo', value: followingCount, inline: true });
            await interaction.editReply({ embeds: [embed] });
          }

          if (friendCount && followerCount && followingCount) break;
        } catch (e) {
          // ignora erro e tenta de novo
        }

        await delay(1000);
      }

      // AtualizaÃ§Ã£o final garantida
      embed.spliceFields(6, 3, { name: '<:Friends:1315278590685745205> Total de Amigos', value: friendCount!, inline: true });
      embed.spliceFields(7, 1, { name: '<:Followers:1315279069029601371> Seguidores', value: followerCount!, inline: true });
      embed.spliceFields(8, 1, { name: '<:Following:1315280134244401204> Seguindo', value: followingCount!, inline: true });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Erro ao buscar informações do jogador:', error);
      await interaction.editReply({
        content: '<:Roblox:1314141291621126165> Ocorreu um erro ao buscar as informações, Tente novamente mais tarde',
        ephemeral: true,
      });
    }
  }

}

export default command;

