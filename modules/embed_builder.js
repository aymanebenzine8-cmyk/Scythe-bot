const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, TextDisplayBuilder, SectionBuilder, ContainerBuilder, Colors, SeparatorBuilder,
    SeparatorSpacingSize, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder
} = require('discord.js');
const fs = require("fs").promises

const random = (x = 0, y = 1) => Math.floor(Math.random() * (y - x + 1)) + x;
const charset = 'abcdef0123456789'.split('')

const generateId = (len) => {
    let r = '';
    for (let i = 0; i < len; i++)
        r += charset[random(0, charset.length - 1)]
    return r
}

const createAttachment = async (content, alias = null, isFile) => {
    let file = isFile ? content : null;
    if (!file) {
        const n = generateId(32) + ".lua"
        alias ??= n
        file = "cache/" + n
        await fs.writeFile(file, content);
    }
    setTimeout(() => fs.unlink(file), 2500)

    return new AttachmentBuilder(file, {
        name: alias
    })
}

const modals = {}

class Menu {
    children = {};
    embed = null;
    addButton = (text, callback, anyone, emoji) => this.children[text] = {
        callback,
        emoji,
        anyone,
        type: "button"
    };
    addToggle = (text, state, callback, anyone) => this.children[text] = {
        callback,
        anyone,
        type: "toggle",
        state
    };
    addTextbox = (text, info, callback) => {
        this.children[text] = {
            callback,
            info,
            type: "textbox"
        }
    }
    setEmbed = (title, description, color, thumbnail) => {
        this.title = title
        this.thumbnail = thumbnail
        this.description = description;
        this.color = color;

        let embed = new ContainerBuilder()
            .setAccentColor(Colors[color] || Colors.Blurple)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("### " + title),
            )
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        
        const desc = typeof description == "string" ? description : "> " + description.join("\n> ")
        
        if (thumbnail) {
            const section = new SectionBuilder()
                .addTextDisplayComponents((textDisplay) =>
		            textDisplay.setContent(
			            desc
		            ),
	            )
                .setThumbnailAccessory((thumbnaila) => thumbnaila.setDescription('thumbnail').setURL(thumbnail))
            
            embed.addSectionComponents(
                section
            )
        } else {
            embed = embed.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(desc)
            )
        }

        this.embed = embed
        return embed
    };
    createActionRow = () => {
        const buttons = []
        for (let text in this.children) {
            const data = this.children[text]
            const butt = new ButtonBuilder()
                .setCustomId(text)
                .setLabel(text)
                .setStyle(
                    data.type != "toggle" ? ButtonStyle.Secondary :
                        data.state ? ButtonStyle.Success : ButtonStyle.Danger
                )
            buttons.push(
                data.emoji ? butt.setEmoji(data.emoji) : butt
            )
        }

        if (buttons.length == 0)
            return

        return new ActionRowBuilder().addComponents(buttons);
    };
    getComponents = () => {
        const embed = this.embed
        const action = this.createActionRow()

        if (!embed)
            throw new Error("No embed available")

        const components = [ embed ]
        
        if (action)
           components.push(action)
        return components
    };
    /** @param {Message} orig */
    send = async (orig) => {
        const components = this.getComponents()

        const msg = await orig.reply({
            //embeds: [ embed ],
            components: components,
            flags: [ 1 << 15 ]
        });

        const collector = msg.createMessageComponentCollector();
        const author = orig.author.id.toString()

        collector.on('collect', async (i) => {
            const reply = async (text, asAttach) => {
                const args = text.length >= 2000 || asAttach ?
                    {content:"",ephemeral:true, files:[ await createAttachment(text) ]} :
                    {content:text,ephemeral:true}

                return await i.reply(args);
            }
            const edit = async (text) => {
                this.setEmbed(this.title, text, this.color, this.thumbnail)

                await i.editReply({
                    components: this.getComponents(),
                    flags: [ 1 << 15 ]
                })
            }

            const id = i.user.id.toString()

            const button = this.children[i.customId]

            if (!button)
                return await edit("An error occured while handling the menu, please report this!\n`ERR_NO_CALLBACK`")

            if (id != author && !button.anyone)
                return reply('Son who are you 😭😭😭😭😭');
            
            if (button.type == "toggle") {
                button.state = !button.state

                const content = await button.callback( id, reply, button.state )
                const newer = []

                if (content)
                    newer.push({
                        type: 10,
                        content: content
                    })

                newer.push(this.embed)
                newer.push(this.createActionRow())

                await i.update({
                    //content: typeof content == "string" ? content : msg.content,
                    embeds: msg.embeds,
                    components: newer
                })
            } else if (button.type == "textbox") {
                const id = `${i.customId}_${id}`
                const modal = new ModalBuilder()
                    .setCustomId(id)
                    .setTitle(i.customId);

                const input = new TextInputBuilder()
                    .setCustomId('value')
                    .setLabel(button.info.text)
                    .setStyle(TextInputStyle[button.info.type || "Short"])
                    .setRequired(true);
                
                if (button.info.length) {
                    if (button.info.min) input.setMinLength(button.info.min)
                    if (button.info.max) input.setMaxLength(button.info.max)
                }

                modal.addComponents(new ActionRowBuilder().addComponents(input));

                modals[id] = {
                    callback: button.callback,
                    edit,
                    id
                }

                return await i.showModal(modal)
            }

            return await button.callback( id, reply, i )
        });

        collector.on('end', () => {
            msg.edit({ components: [] }).catch(() => {});
        });

        return msg;
    };
}

module.exports = {
    Menu,
    setClient: (a) => a.on("interactionCreate", async (i) => {
        if (!i.isModalSubmit()) return;

        const modal = modals[i.customId]

        if (!modal) return console.error("NO MODAL HANDLER FOR " + i.customId)

        await modal.callback(modal.author, (a) => {
            i.reply({
                content: a,
                flags: [ 'Ephemeral' ]
            })
        }, modal.edit, i.fields.getTextInputValue('value'))
    })
}