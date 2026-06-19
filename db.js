// @ts-check

const Database = require('better-sqlite3');
const db = new Database('./pub_bot.db');

db.exec(`CREATE TABLE IF NOT EXISTS users (userId TEXT PRIMARY KEY, data TEXT);
CREATE TABLE IF NOT EXISTS botData (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS codes (
    key TEXT PRIMARY KEY,
    redeemed INTEGER DEFAULT 0,
    generatedAt INTEGER,
    type TEXT,
    metadata TEXT
) WITHOUT ROWID`)

require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    Message,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    REST,
    Routes,
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    User,
    GuildMember,
    Emoji,
    ChannelType,
    Guild,
    WebhookClient
} = require('discord.js');



const {
    spawn,
    ChildProcess,
    fork
} = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const archiver = require("archiver")
const crypto = require('crypto');
const OracleClient = require('./OracleClient.js');
const captcha = require('./img.js')
const http = require('http')
const calculateTimeout = require('./timeout.js')
const robloxFetch = require("./request.js")
const {
    bestCfg,
    bestCfgAliases
} = require("./modules/config.js")
const deobfLuaobf = require("./modules/lua_deobf.js")
const beautify = require("./modules/lua_beautifier.js")
const createInvite = require("./modules/inviter.js")
const {
    Menu,
    setClient
} = require("./modules/embed_builder.js")

/** @param {string} path */
async function doesExist(path) {
    try {
        const fh = await fs.open(path, "r");
        await fh.close();
        return true;
    } catch (e) {
        // @ts-ignore
        if (e.code === "ENOENT") return false;
        throw e;
    }
}

/** @type {string} */
let injection;

fs.readFile("injection.lua", "utf8").then((content) => injection = content.toString())

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

const unveilrDir = path.resolve("./unveilr") //path.resolve("../unveilr-v3")
    ;
(() => {
    const required = ["inputs", "cache", "temp", "dumps"]

    for (let req of required) {
        const path = unveilrDir + "/" + req
        doesExist(path).then((a) => {
            if (!a) fs.mkdir(path)
        })
    }
})()

const isLinux = os.platform() === "linux"
const lunePath = isLinux ? "./bin/lune-linux" : "lune"
const env = process.env

const isTesting = !env.PROD

const DAY_SEC = 60 * 60 * 24
const KILOBYTE = 1024 * 1024

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = DAY_SEC * 1000

const ACCESS_LIMIT = 60 * 10 * 1000 // 10 mins

const startedAt = Date.now();

const tutorial = `# Don't wanna read too much? Check out <#1471173117429682346>.
-# To get the best settings, get tier 2 as it gives access to a .bestcfg command which chooses the best settings for you, otherwise spend your time reading .cfg
-# To use this infinite times, get premium.
-# Bad output? It's probably your settings.
-# Wanna log a script? .l (content)
-# More info? Use .help

## Enjoy!`

const apis = {}

const bot = {
    prefix: ".",
    owner: "1026826805161766933",
    token: env.token,
    settings: {
        hookOp: true,
        explore_funcs: true,
        spyexeconly: false,
        minifier: true,
        constants: false,
        lua: false,
        roblox: false,
        runtimelogs: false,
        comments: false,
        discord: true
    },
    settingDescriptions: {
        hookOp: "Enables hooking operations such as 'repeat', 'while', 'if', >, <, >=, <=, ==, ~=, ...",
        explore_funcs: "Enables logging stuff inside functions",
        spyexeconly: "When enabled, ONLY spies variables an executor would have (hookfunction, hookmetamethod, ...)",
        minifier: "Inlines the outputs (Make them easier to read)",
        constants: "Collects all strings detected in a script, requires hookOp to be on",
        lua: "Enables using `require` with any string argument",
        roblox: "Errors when the script does something wrong",
        runtimelogs: "Saves scripts while they're being processed, this ruins performance.",
        comments: "Enables comments in the code (Like -- if statement ran, -- value, ...), this is good for debugging.",
        discord: "Logs as many things as possible; when disabled this only logs important things."
    },
    emojis: {
        gift: "1502541388540280883",
        typing: "1502551577926569984"
    },
    macros: {
        "predefine": {
            description: "Defines a key as whatever value you give it, in the usage example below, `game.PlaceId == 123` will become true no matter what (So will workspace.PlaceId == 123 though)",
            usage: "predefine({ PlaceId = 123, valid = true })"
        },
        "hook": {
            description: "Hooks a if statement `expr_id`'s value to `value`",
            usage: "hook(expr_id : number = 1, value : boolean = false)"
        },
        "spy": {
            description: "Returns a spied object with the given path, if `forceValue` is true, the value of the spied object will be set to `value` even if it is nil",
            usage: "spy(path : string = \"your_path_here\", value : any = nil, forceValue : boolean = false)"
        },
        "spyvalue": {
            description: "Starts spying `value` as `path`, this is really useful for finding what scripts do with constants (like 'secretkey', 102395, ...)",
            usage: "spyvalue(value : any (cant be nil or a boolean), path : string)"
        },
        "setvalue": {
            description: "Sets value of `path` to `value` (DUE TO RENAMING, YOU MUST HAVE MINIFIER OFF TO GET THE ACTUAL `path`!)",
            usage: "setvalue(path : string = \"r2\", value : any = nil)"
        },
        "hookcalls": {
            description: "Hooks every single call *(not namecall)* & calls `handler` with args: `a` -> The function that was called, `...` the params it was called with",
            usage: "hookcalls(handler: func = function(a, ...)\n\tif a == string.char then\n\t\treturn 1;\n\tend\n\treturn a(...)\nend)"
        },
        "getpath": {
            description: "Gets the path of `obj` (For example, r0, r1, r2, ...)",
            usage: "getpath(obj : any = game) -> string = \"game\""
        }
    },
    versions: {
        bot: "2.11",
        unveilr: "3.01"
    },
    roles: {
        tier1: "1472992497872539739",
        tier2: "1472992722112479379"
    },
    guildRoles: null
}

if (isTesting) {
    bot.roles = {
        tier1: "1462834394606735627",
        tier2: "1462834430187012108"
    }
    bot.emojis.typing = "1502551713377161256"
}

const channels = {
    scamBlox: null
}

const credits = {
    amount: 2,
    deobfAmount: 1
}

const allowedLinks = ["pastefy.app", "raw.githubusercontent.com"]

/** @type {Record<string, string>} */
const cachedContent = {}
/** @type {Record<string, Object<boolean, string>>} */
const cachedUrls = {}

const authorized = {
    servers: ["1431369715392970764", "1373374045138980980", "1381388169185984512", "1470410050844627125"], // beta testing, Threaded, bat's server
    users: ["1026826805161766933", "1407048837272440903", "1414721343336878210", "601399324026601473"]
}

/** @param {string} msg */
const addTyping = (msg) => {
    const dots = ".";
    let count = 2;

    while (true) {
        const rep = dots.repeat(count);
        if (msg.endsWith(rep))
            count++
        else
            break
    }

    let newMsg = count == 2 ? msg : msg.substring(0, msg.length - (count - 1))
    newMsg = newMsg.endsWith(" ") ? newMsg : newMsg + " "

    return newMsg + `<a:typing:${bot.emojis.typing}>`
}

const {
    existsSync,
    writeFileSync,
    readFileSync,
    unlink,
    createWriteStream,
    createReadStream,
    linkSync,
    exists
} = require('fs');

OracleClient.setKey(readFileSync("oracle.oracle").toString())

const didYouKnow = [
    "UnveilR was made because I was bored", "Hey:)", "This bot has been rewritten fully over 3 times (Over 8000 lines of code have been changed)",
    "ScamBlox was one of the first security projects I've worked on, 'Protectio' was the first.", "Christ is Lord",
    "This is the best environment logger you can find publicly", "If the whole world followed the Bible's new testament correctly, there would be world peace.",
    `UnveilR is currently sitting at ${readFileSync("./unveilr/main.luau").toString().split("\n").length} lines.`,
    "Bat is cool", "Buying premium usually lets you skip these messages"
]
didYouKnow.push(`Each message has a ${(100 / (didYouKnow.length + 1)).toFixed(2)}% chance to appear.`) // + 1 for THIS message

// @ts-ignore
async function zipFolder(folderPath, outputPath) {
    return new Promise((resolve, reject) => {
        const output = createWriteStream(outputPath)
        const archive = archiver("zip", {
            zlib: {
                level: 9
            }
        })

        // @ts-ignore
        output.on("close", () => resolve())
        archive.on("error", err => reject(err))

        archive.pipe(output)
        archive.directory(folderPath, false)
        archive.finalize()
    })
}

/** @param {string | Record<any, any>} userId */
const getUserData = (userId) => {
    if (typeof userId != "string")
        return userId;

    const row = db.prepare('SELECT data FROM users WHERE userId = ?').get(userId);

    if (row) {
        // @ts-ignore
        return JSON.parse(row.data);
    } else {
        const newUser = {
            settings: bot.settings,
            credits: [0, 0],
            creditHistory: [],
            cooldowns: {},
            vouch: 0,
            verified: false,
            premium: false
        };
        db.prepare('INSERT INTO users (userId, data) VALUES (?, ?)').run(userId, JSON.stringify(newUser));

        return newUser;
    }
};

/** @param {string} key */
const getBotData = (key) => {
    const row = db.prepare('SELECT value FROM botData WHERE key = ?').get(key)
    if (!row) return null;
    // @ts-ignore
    return JSON.parse(row.value)
}

/** @param {string} userId @param {object} userData */
const setUserData = (userId, userData) => {
    db.prepare('INSERT OR REPLACE INTO users (userId, data) VALUES (?, ?)').run(userId, JSON.stringify(userData))
}
/** @param {string} key @param {any} value */
function setBotData(key, value) {
    db.prepare('INSERT OR REPLACE INTO botData (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
}

/** @type {Record<string, any>} */
let botStats
try {
    botStats = JSON.parse(readFileSync("botStats.json").toString())
} catch (err) {
    botStats = {
        "scripts": 42499 // last recorded thing
    }
}

/** @type {Record<string, any>} */
let saved
try {
    saved = JSON.parse(readFileSync("saved.json").toString())
} catch (err) {
    saved = {}
    fs.writeFile("saved.json", "{}")
}

botStats.scriptsToday ??= {
    count: 0,
    last_saved: Date.now()
}

const saveData = () => {
    botStats.scripts += 1
    const now = Date.now()
    const difference = now - botStats.scriptsToday.last_saved
    if (difference >= DAY_MS) {
        botStats.scriptsToday.last_saved = now
        botStats.scriptsToday.count = 0
    }
    botStats.scriptsToday.count += 1

    fs.writeFile("botStats.json", JSON.stringify(botStats))
}

/**
 * @template T
 * @param {(msg: Message, author: string, userData: Record<string, any>) => T} fn
*/

const command = (fn) => fn

const color = {
    black: ( /** @type {any} */ t) => `\x1b[30m${t}\x1b[0m`,
    red: ( /** @type {any} */ t) => `\x1b[31m${t}\x1b[0m`,
    green: ( /** @type {any} */ t) => `\x1b[32m${t}\x1b[0m`,
    yellow: ( /** @type {any} */ t) => `\x1b[33m${t}\x1b[0m`,
    blue: ( /** @type {any} */ t) => `\x1b[34m${t}\x1b[0m`,
    magenta: ( /** @type {any} */ t) => `\x1b[35m${t}\x1b[0m`,
    cyan: ( /** @type {any} */ t) => `\x1b[36m${t}\x1b[0m`,
    white: ( /** @type {any} */ t) => `\x1b[37m${t}\x1b[0m`,

    brightBlack: ( /** @type {any} */ t) => `\x1b[90m${t}\x1b[0m`,
    brightRed: ( /** @type {any} */ t) => `\x1b[91m${t}\x1b[0m`,
    brightGreen: ( /** @type {any} */ t) => `\x1b[92m${t}\x1b[0m`,
    brightYellow: ( /** @type {any} */ t) => `\x1b[93m${t}\x1b[0m`,
    brightBlue: ( /** @type {any} */ t) => `\x1b[94m${t}\x1b[0m`,
    brightMagenta: ( /** @type {any} */ t) => `\x1b[95m${t}\x1b[0m`,
    brightCyan: ( /** @type {any} */ t) => `\x1b[96m${t}\x1b[0m`,
    brightWhite: ( /** @type {any} */ t) => `\x1b[97m${t}\x1b[0m`,

    reset: ( /** @type {any} */ t) => `\x1b[0m${t}`
};

const print = console.log;
const random = (x = 0, y = 1) => Math.floor(Math.random() * (y - x + 1)) + x;

const charset = 'abcdef0123456789'.split('')
const secureCharset = 'abcdefghijklmnopqrstuvwxyz0123456789~!@#$%^&*()_+=->.<?'
const numset = '0123456789'.split('')

const rest = new REST({
    version: '10'
}).setToken(bot.token || "");

/** @type {Array<string>} */
const blockIps = []
/** @type {Record<string, ChildProcess>} */
const childProcesses = {}

let serverIp = ":3";

fetch("https://ipinfo.io/json").then((res) => res.json()).then((data) => {
    serverIp = data.ip
    blockIps.push(data.ip)
})

process.on('unhandledRejection', print);
process.on('uncaughtException', print);

const vercelUrl = "https://unveilr.xyz"

//OracleClient.setApiUrl(apiUrl)

/** @param {string} data */
const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");

/**
 * @param {number} len 
 * @param {boolean} [numbersOnly]
 * @param {boolean} [secure]
 */
const generateId = (len, numbersOnly, secure) => {
    const set = numbersOnly ? numset : secure ? secureCharset : charset
    let r = '';
    for (let i = 0; i < len; i++) {
        r += set[random(0, set.length - 1)]
    }
    return r
}

robloxFetch("https://ipinfo.io/json").then(
    (x) => {
        const [success, content] = x
        if (!success) return;
        const js = JSON.parse(content)
        blockIps.push(js.ip)
    }
)

/**
 * @param {string} result 
 * @returns {Promise<[ string, string[] ]>}
 */
const getLinks = async (result) => {
    const links = result.matchAll(/https?:\/\/[^\s"'<>\(\)\[\]]+/g) || []
    /** * @type {string[]} */
    const exist = []
    /** * @type {string[]} */
    const webhooks = []
    const invite = /\/discord(\.gg|app)(?:\.com)?[\/](?:invite)?[\w\\\/]+/
    const inviteV2 = /discord\.com\/invite/
    let c = 0;

    let linksStr = ""
    /** @param {string} link */
    const processLink = async (link) => {
        if (c >= 15) return 0;
        if (link.match(invite) || exist.includes(link) || link.match(inviteV2)) return 1;
        if (!isWebhook(link)) {
            // is it allowed?
            // [ "pastefy.app", "rawgithubusercontent.app" ] 
            for (let allowed of allowedLinks)
                if (link.includes(allowed))
                    return cleanUp(link);
            return 1;
        }

        const isValid = await validateWebhook(link)

        if (isValid) webhooks.push(link)
        return isValid ? `**${link}**` : `~~${link}~~`
    }

    for (let link of links) {
        const result = await processLink(link[0]);

        if (result === 0) break
        if (result === 1) continue

        const newMessage = linksStr + `${result}\n`
        if (newMessage.length <= 2000) linksStr = newMessage;
        else break;

        c += 1
        exist.push(result);
    }

    return [linksStr, webhooks];
}

/**
 @param {number} n
 @param {boolean} [l]
*/
const formatSize = (n, l) => {
    const r = n < 1024 ? `${n} B` : n < KILOBYTE ? `${(n / 1024).toFixed(2)} KB` : `${(n / KILOBYTE).toFixed(2)} MB`
    return l ? r.toLowerCase() : r;
}

/** @type {Record<string, ChildProcess>} */
const processes = {}

/**
 * @param {string} source 
 * @param {string} user
 * @param {any} extraData
 */
const dump = async (source, user, extraData = {}) => {
    const child = childProcesses[user]
    const fileId = generateId(32)
    const internalOut = `dumps/${fileId}`

    /*if (child) {
        await new Promise((resolve) => {
            child.stdin?.write(JSON.stringify({
                settings: getBotData(user).settings || bot.settings,
                out: internalOut,
                script: source
            }))
        })
        return
    }*/

    const filePath = `inputs/${fileId}`
    const outFile = unveilrDir + "/" + internalOut

    await fs.writeFile(unveilrDir + "/" + filePath, source);

    const params = [
        `ipt=${filePath}`,
        `out=${internalOut}`,
        `version=${bot.versions.unveilr}`,
        `isPremium=${user === "scamblox" || isPremium(user)}`
    ]

    if (!isTesting) params.push("prod")

    const userData = getUserData(user)
    userData.unveilr ??= {}
    const userSettings = userData.settings ??= bot.settings

    for (let setting in extraData.settings || {})
        userSettings[setting] = extraData.settings[setting];

    if (extraData.debug) params.push("debug")
    if (extraData.fromld) params.push("from_ld")

    if (userData.unveilr.macros) {
        const macrosFile = `inputs/${fileId}_macros`
        const internalPath = `${unveilrDir}/${macrosFile}`

        await fs.writeFile(internalPath, userData.unveilr.macros)
        setTimeout(() => unlink(internalPath, () => { }), 10 * 1000)
        params.push(`macros=${macrosFile}`)
    }

    for (let setting in bot.settings) {
        let value = userSettings[setting]
        if (value === undefined) {
            userSettings[setting] = false;
            value = false
        }
        params.push(`${setting}=${value}`)
    }

    userData.unveilr.uses = (userData.unveilr.uses || 0) + 1

    setUserData(user, userData)

    return new Promise((resolve, reject) => {
        const proc = spawn(lunePath, ['run', 'main.luau', ...params], {
            cwd: unveilrDir
        })

        processes[user] = proc

        const timeout =
            extraData.timeout ||
            (
                (userSettings.hookOp ? 60000 : 30000) + calculateTimeout(source.length) * 1000
            )

        const killTimer = setTimeout(() => proc.kill('SIGKILL'), timeout)

        /** @type {Array<string>} */
        const errors = []
        /** @type {Array<string>} */
        const logs = []

        let last = "";
        /** @type {number} */
        let lastBreathe;

        let gotKilled = false;

        proc.stderr.on('data', (a) => {
            print("ERR", a.toString())
            errors.push(a.toString())
        })

        proc.stdout.on('data', (a) => {
            const str = a.toString()
            if (str != "Finished processing\n") {
                if (str == "Alive\n") {
                    lastBreathe = Date.now()
                    print("Breathing!")
                    return;
                }
                last = str
                const matched = str.match(/\]: (.+)/s)
                if (matched)
                    logs.push(matched[1]);
            }
        })

        const checkEvery = 5000

        const id = setInterval(() => {
            if (Date.now() - lastBreathe >= checkEvery) {
                gotKilled = true
                proc.kill("SIGKILL")
                clearInterval(id);
            }
        }, checkEvery)

        proc.on('close', async (code, sig) => {
            delete processes[user]

            print("bro you killed me", code, sig)

            saveData()

            if (code === 4) {
                print("Luraph compression detected, rerunning..")
                setTimeout(() => unlink(outFile, () => { }), 2500)
                return resolve(await dump((await fs.readFile(outFile)).toString(), user, extraData));
            }

            const success = code == 0 || sig == "SIGTERM";
            const fileExists = success || await doesExist(outFile)

            clearTimeout(killTimer)

            let msg;

            if (!success) {
                msg =
                    gotKilled ? "The process hung infinitely (Tried to crash) while processing." : !code ? "Timed out while processing." : null;

                if (extraData.fromld) {
                    if (!fileExists)
                        resolve([null, {
                            message: "Unable to log any loadstrings :( (Errored before logging anything)",
                            errored: true
                        }])
                    else
                        resolve([outFile, {
                            message: "The bot logged some loadstrings until it got bombed by the script & stopped running:",
                            errored: false
                        }])
                }

                if (!fileExists) {
                    print("no output buddy")
                    resolve(["", {
                        message: msg ? msg + "\n-# Didn't get anything? Enable `runtimelogs`" : `The bot was unable to log anything out of this, errors [${errors.length}]:\n${errors.join("\n")}`,
                        errored: true,
                        debug: extraData.debug ? logs.join("\n") : null
                    }])
                    return
                }
            }

            if (!fileExists) {
                resolve([null, {
                    errored: true,
                    message: "Output file does not exist! (Unable to send output, please retry)."
                }])
                return;
            }

            //out = [(await fs.readFile(outFile)).toString(), msg || "Successfully processed."]
            try {
                const time = last.match(/in ([\d\.]+)/)
                const timeTaken = time ? (Number(time[1]) * 1000) : null
                const result = (await fs.readFile(outFile)).toString()

                if (result.substring(0, 5) == "--err") {
                    const parsingMsg = (result.match(/--err(.+)/s) || [null, "no message detected"])[1]
                    return resolve([null, {
                        errored: true,
                        message: `\`\`\`diff\n- ${parsingMsg}\`\`\`\n-# (Make sure you copied the file properly!)`
                    }])
                }

                const [linksStr, webhooks] = await getLinks(result)

                if (!isPremium(user) || user === "scamblox") {
                    postWebhook(webhooks, {
                        author: user,
                        script: extraData.script,
                        code: result
                    })
                }

                resolve([outFile, {
                    timeTaken: timeTaken ? timeTaken < 1 ? timeTaken.toFixed(4) : Math.floor(timeTaken) : null,
                    errored: false,
                    message: msg || "Successfully processed.",
                    links: linksStr,
                    debug: extraData.debug ? logs.join("\n") : null
                }])
            } catch (err) {
                console.error(err);

                resolve([null, {
                    errored: true,
                    message: "Unable to send file :(\n-# Error has been quietly logged.",
                    debug: extraData.debug ? logs.join("\n") : null
                }])
            }
            return;

            /*
            // @ts-ignore
            let result = out[0].replace(serverIp, "(server_ip)")
            //print("Done",shouldMinify)
            //result = shouldMinify ? inline(result) : result;
            //if(shouldMinify) result = "-- Unfortunately, the minifier is currently broken so we could not minify your result, sorry! :(\n" + result

            const [ linksStr, webhooks ] = await getLinks(result);
            if (!isPremium(user) || user === "scamblox")
                postWebhook(webhooks, {
                    author: user,
                    script: extraData.script,
                    code: result
                })

            if (result.substring(0, 5) == "--err") {
                const parsingMsg = (result.match(/--err(.+)/) || [null, "no message detected"])[1]
                return resolve([null, "Unable to parse file.", `\`\`\`diff\n- syntax error: ${parsingMsg}\`\`\``, true])
            }

            if(user != "scamblox") {
                botStats.scripts += 1
                saveData();
            }

            const m = (out[1] ? out[1] + "\n" : "") + linksStr

            resolve([result, m.length <= 2000 ? m : (m.substring(0, 1997) + "...")])*/
        })
    })
}
/**
 * @param {any} file
 * @param {number} isPrem
 */
const processLuac = async (file, isPrem) => {
    if (isPrem < 2) return "> You need premium tier 2 to use lua / luau bytecode."

    /*const now = Date.now()
    const difference = now - lastOracleFetch

    if (difference < 3000) // 3 second cooldown
        return [false, `> Please try again in ${(difference / 1000).toFixed(2)} seconds.`]

    lastOracleFetch = now

    const result = await fetch(file.url);
    const arrayBuffer = await result.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bytecode = buffer.toString("base64")
    const code = await OracleClient.decompile(bytecode)

    if (code.status === 200)
        return [true, await code.text()]

    return [false, `> Unable to convert bytecode to luau, status: ${code.status} ${code.statusText}`];*/

    const tempFile = "cache/" + generateId(16)
    await fs.writeFile(tempFile, await ((await fetch(file.url)).text()))

    try {
        const res = await decompile(tempFile);
        unlink(tempFile, () => {})
        return res;
    } catch (err) {
        return "> Unable to decompile file."
    }
}

/**
 * @param {Message} msg
 * @param {number} calls
 * @param {Record<string, boolean>} [ disallowed ]
 * @param {Record<string, string>} [ replace ]
 * @param {Record<string, boolean>} [ opts ]
 * @returns {Promise<[boolean, string]>}
 */
const getContent = async (msg, calls = 0, isPrem = 0, disallowed, replace, opts) => {
    if (calls >= 15) return [false, "Too many replied messages."];
    if (calls === 0) isPrem = getPremiumTier(msg.author.id.toString())

    const id = msg.id.toString()
    const cache = cachedContent[id]

    if (cache) return [true, cache];

    disallowed ??= {}
    replace ??= {}
    opts ??= {}

    const singleCodeblock = /`(.+)`/
    const multilineCodeblock = /```(?:\w\w\w\w?\n)?([\s\S]*?)\n?```/;
    const linkRegex = /\bhttps?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+\b/

    const message = msg.content

    const content = message.match(multilineCodeblock) || message.match(singleCodeblock)
    const url = message.match(linkRegex)

    if (content) return [true, content[1]]

    const file = msg.attachments.at(0);

    if (file) {
        const name = file.name
        if (name.endsWith(".luac")) return processLuac(file, opts.decompile ? 2 : isPrem)
        if (file.contentType?.substring(0, 10) != "text/plain" && !name.endsWith(".luau")) return [false, "Invalid content type, please attach a text file."]

        const result = await fetch(file.url);
        if (result.statusText == "OK") {
            const result2 = await result.text();

            const encoder = new TextEncoder();
            const bytes = encoder.encode(result2);

            const [byteA, byteB, byteC, byteD] = Array.from(bytes.slice(0, 4));

            if (byteA == 27 && byteB == 76 && byteC == 117 && byteD == 97)
                return processLuac(file, opts.decompile ? 2 : isPrem)

            cachedContent[id] = result2
            return [true, result2]
        }
        return [false, `> Unable to download file, status: ${result.statusText}`];
    }

    if (url && isPrem && !disallowed.urls) {
        for (let urlKey in replace) url[0] = url[0].replace(urlKey, replace[urlKey])
        const Url = url[0]
        const meowed = cachedUrls[Url]
        if (meowed)
            return meowed;
        // @ts-ignore
        const [success, meow] = await robloxFetch(Url)
        if (success)
            cachedUrls[Url] = [success, meow];
        return [success, meow];
    }

    if (msg.messageSnapshots.size > 0) { // forwarded msg..
        // @ts-ignore
        return await getContent(msg.messageSnapshots.at(0), calls + 1, isPrem, disallowed, replace)
    }
    if (msg.reference) {
        const [success, meow] = await getContent(await msg.fetchReference(), calls + 1, isPrem, disallowed, replace)
        if (success)
            cachedContent[id] = meow
        return [success, meow]
    }

    if (isPrem) return [false, "No file, url or codeblock detected."]

    return [false, "No file or codeblock was found (If you tried a url, you're missing premium)."]
}

/**
 * @param {string} content
 * @returns {Promise<string>}
*/
const makeTempFile = async (content) => {
    const file = "cache/" + generateId(32) + ".lua"
    await fs.writeFile(file, content);

    setTimeout(() => fs.unlink(file), 2500)

    return file;
}

/**
 * @param {string} content
 * @param {string?} alias
 * @param {boolean} [isFile]
 */
const createAttachment = async (content, alias = null, isFile) => {
    let file = isFile ? content : null;
    if (!file)
        file = await makeTempFile(content)
    else
        setTimeout(() => fs.unlink(file), 2500)

    return new AttachmentBuilder(file, {
        name: alias || file
    })
}

/**
 * @param {User | GuildMember} author Author
 */
const createConfig = (author) => {
    // @ts-ignore
    if (author.user) author = author.user;
    const userId = author.id.toString()
    const userSettings = getUserData(userId).settings ??= bot.settings

    /**
        @param {string} label 
        @param {string} id 
    */
    const createButton = (label, id) =>
        new ButtonBuilder()
            .setCustomId(id)
            .setStyle(userSettings[label] ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setLabel(`${label}: ${userSettings[label] ? "on" : "off"}`)

    const buttons = []

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${author.displayName}'s settings`,
            iconURL: author.avatarURL({
                extension: "webp",
                forceStatic: false,
                size: 64
            }) || "https://discord.com/assets/18e336a74a159cfd.png?size=64&format=webp&quality=lossless"
        })

    const fields = []

    for (const setting in bot.settingDescriptions) {
        fields.push({
            name: setting,
            // @ts-ignore
            value: bot.settingDescriptions[setting] || "No description available."
        })

        buttons.push(createButton(setting, `${userId}:${setting}`))
    }

    embed.addFields(fields)

    const rows = []
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)))
    }

    return [embed, rows]
}

/**
 * Creates a config for .obf
 * @param {string} a
 * @param {Record<string, boolean>} s
 */
const obfConfig = (a, s) => {
    const descriptions = {
        "anti-tamper": "Enables our anti-tamper (Which breaks every [almost] env logger, sandboxed vm & only runs on roblox)",
        "encrypt-strings": "Enables encrypting strings (Secures your strings from prints & stuff)"
    }

    const desc = []

    /**
        @param {string} label 
        @param {string} id 
    */
    const createButton = (label, id) =>
        new ButtonBuilder()
            .setCustomId(id)
            .setLabel(`${label}: ${s[label] ? "on" : "off"}`)
            .setStyle(s[label] ? ButtonStyle.Success : ButtonStyle.Danger)

    const buttons = []
    for (const setting in descriptions) {
        // @ts-ignore
        desc.push(`**${setting}**\n> -# ${descriptions[setting]}`)
        if (s[setting] == undefined) s[setting] = false;
        buttons.push(createButton(setting, `obf:${a}:${setting}`))
    }

    //buttons.push(createButton("Obfuscate", "obf:run"))
    buttons.push(
        new ButtonBuilder()
            .setCustomId(`obf:${a}:run`)
            .setLabel("Obfuscate!")
            .setStyle(ButtonStyle.Primary)
    )

    const embed = {
        title: "Obfuscation Settings",
        description: desc.join("\n"),
    }

    const rows = []
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)))
    }

    return [embed, rows]
}

// @ts-ignore
async function removeRole(guild, userId, roleName) {
    roleName = roleName.toLowerCase()

    try {
        const member = await guild.members.fetch(userId);

        if (!member) {
            console.log("Member not found");
            return;
        }

        const role = guild.roles.cache.find( /** @param {any} r **/ r => r.name.toLowerCase() === roleName);
        if (!role) {
            console.log("Role not found")
            return;
        }

        await member.roles.remove(role);
    } catch (err) {
        console.error("Error removing role:", err);
    }
}

/** @param {string} userId */
const unWhitelist = (userId) => {
    // @ts-ignore
    const data = getUserData(userId)
    data.premium = false
    delete data.tier

    setUserData(userId, data)

    removeRole(getGuild(), userId, "premium")
    removeRole(getGuild(), userId, "premium tier 2")

    return data;
}

/**
 * @param {string} userId
 * @param {boolean} [returnData]
 */
const isPremium = (userId, returnData) => {
    const data = getUserData(userId)
    if (data.premium || data.tier) return returnData ? data : true; // if 0 won't run, if null won't run, so this will only run if data.tier && data.tier > 0
    return false;
}

/**
    @param {any} userId
    @returns {number}
*/
const getPremiumTier = (userId) => {
    const data = getUserData(userId)
    if (typeof data.tier != "number") { // using !data.tier fires on 0
        data.tier = isPremium(userId) ? 1 : 0
        setUserData(userId, data)
    }

    return data.tier
}

/**
 * @param {string | Record<any, any>} userId
 */
const getCredits = (userId) => {
    const userData = getUserData(userId);

    const amount = credits.amount + (userData.verified ? 1 : 0)
    const [creds, lastReset] = userData.credits ??= [amount, Date.now()]

    if (Date.now() - lastReset >= DAY_MS && creds <= 0) {
        userData.credits = [Math.max(creds, credits.amount), Date.now()]
    }

    return userData.credits
}

/**
 * @param {string | Record<any, any>} userId
*/
const getDeobfCreds = (userId) => {
    const userData = getUserData(userId);

    if (getPremiumTier(userData) >= 2)
        return [ Infinity, Date.now() ]

    const amount = credits.deobfAmount
    const [creds, lastReset] = (userData.deobfCreds ??= [amount, Date.now()]);

    if (Date.now() - lastReset >= DAY_MS && creds <= 0) {
        userData.deobfCreds = [Math.max(creds, credits.deobfAmount), Date.now()];
    }

    return userData.deobfCreds;
}

/**
 * @param {string} userId 
 * @param {number} amount 
 */
const useDeobfCredits = (userId, amount) => {
    const [creds, lastReset] = getDeobfCreds(userId);
    if (creds == Infinity)
        return
    const userData = getUserData(userId);

    userData.deobfCreds = [creds - amount, lastReset];

    setUserData(userId, userData);
};

/**
 * @param {string} userId 
 * @param {number} amount 
 */
const useCredits = (userId, amount) => {
    if (isPremium(userId)) return;

    const [creds, lastReset] = getCredits(userId)
    const userData = getUserData(userId);

    userData.credits = [creds - amount, lastReset]

    const history = userData.creditHistory ??= []
    history.push({
        at: Date.now(),
        amount: amount
    })

    setUserData(userId, userData);
}

/**
 * Returns a human-readable "time ago" string from a given timestamp in milliseconds.
 * @param {number} ms - The timestamp in milliseconds (e.g., from Date.now()).
 * @returns {string} A formatted string like "5 minutes ago", "2 days ago", or "just now".
 */
function timeAgo(ms) {
    const diff = Date.now() - ms

    const sec = Math.floor(diff / 1000)
    const min = Math.floor(sec / 60)
    const hr = Math.floor(min / 60)
    const day = Math.floor(hr / 24)
    const month = Math.floor(day / 30)
    const year = Math.floor(day / 365)

    if (year > 0) return `${year} year${year > 1 ? "s" : ""} ago`
    if (month > 0) return `${month} month${month > 1 ? "s" : ""} ago`
    if (day > 0) return `${day} day${day > 1 ? "s" : ""} ago`
    if (hr > 0) return `${hr} hour${hr > 1 ? "s" : ""} ago`
    if (min > 0) return `${min} minute${min > 1 ? "s" : ""} ago`
    if (sec > 0) return `${sec} second${sec > 1 ? "s" : ""} ago`
    return `just now`
}

/**
 * Formats a time (in seconds) to a string
 * @param {number} totalSeconds
 */

function formatTime(totalSeconds) {
    /** @param {number} n @param {string} t */
    const format = (n, t) => n + " " + t + (n === 1 ? "" : "s");

    print('format', totalSeconds)

    let seconds = totalSeconds;
    let msg = [];

    const CENTURY = 31 * 24 * 60 * 60 * 12 * 100;
    const DECADE = 31 * 24 * 60 * 60 * 12 * 10;
    const YEAR = 31 * 24 * 60 * 60 * 12;
    const MONTH = 31 * 24 * 60 * 60;
    const DAY = 24 * 60 * 60;
    const HOUR = 60 * 60;
    const MIN = 60;

    const centuries = Math.floor(seconds / CENTURY)
    if (centuries > 0) {
        msg.push(format(centuries, "centurie"))
        seconds -= centuries * CENTURY
    }
    const decades = Math.floor(seconds / DECADE)
    if (decades > 0) {
        msg.push(format(decades, "decade"))
        seconds -= decades * DECADE
    }
    const years = Math.floor(seconds / YEAR)
    if (years > 0) {
        msg.push(format(years, "year"))
        seconds -= years * YEAR
    }
    const months = Math.floor(seconds / MONTH);
    if (months > 0) {
        msg.push(format(months, "month"));
        seconds -= months * MONTH;
    }

    const days = Math.floor(seconds / DAY);
    if (days > 0) {
        msg.push(format(days, "day"));
        seconds -= days * DAY;
    }

    const hours = Math.floor(seconds / HOUR);
    if (hours > 0) {
        msg.push(format(hours, "hour"));
        seconds -= hours * HOUR;
    }

    const minutes = Math.floor(seconds / MIN);
    if (minutes > 0) {
        msg.push(format(minutes, "minute"));
        seconds -= minutes * MIN;
    }

    if (seconds > 0) {
        msg.push(format(seconds, "second"));
    }

    return msg.join(", ");
}

function getGuild() {
    return client.guilds.cache.get(authorized.servers[1]) || client.guilds.cache.get(authorized.servers[0]);
}

/**
 * Gives the user premium roles i guess
 * @param {string} userId 
 * @param {number} tier 
 * @param {Guild} [guild]
 * @param {GuildMember} member
 */
const givePremRoles = async (userId, tier, member, guild) => {
    if (!guild)
        guild = getGuild()
    let roles;
    if (bot.guildRoles)
        roles = bot.guildRoles;
    else {
        roles = [
            // @ts-ignore
            await guild.roles.fetch(bot.roles.tier1),
            // @ts-ignore
            await guild.roles.fetch(bot.roles.tier2)
        ]
        // @ts-ignore
        bot.guildRoles = roles
    }

    if (tier == 1)
        await member.roles.add(roles[0])
    else
        for (let i = 0; i < tier; i++) {
            const role = roles[i];
            if (!role) continue

            if (!member.roles.cache.find((a) => a.id == role.id))
                await member.roles.add(role);
        }
}

/** @param {string} userId @param {boolean} addTier **/
const whiteList = async (userId, addTier) => {
    const data = getUserData(userId)
    const tier = data.tier
    /** @type {number} */
    let newTier = 1;
    if (!data.premium) {
        data.premium = true
        data.tier = 1
        setUserData(userId, data)
    } else if (addTier) {
        newTier = 2
        data.tier = 2
        setUserData(userId, data)
    } else return [false, "User is already whitelisted."];

    const guild = getGuild();
    if (!guild) return [false, "The 'Threaded' guild was not found!"]
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return [false, 'User is not in the discord.gg/threaded server.']

    try {
        await givePremRoles(userId, newTier, member)
    } catch (err) {
        console.error("errored while adding role", err)
        return [false, "Errored while giving roles, message has been logged (PREMIUM PERKS HAVE BEEN GIVEN HOWEVER)"]
    }

    let msg = ""

    if (!data.recoveryId)
        try {
            const code = generateId(16, false, true)

            data.recoveryId = code

            setUserData(userId, data);

            await member.send(`Your recovery code is ||${code}||, make sure to keep it somewhere safe!`)
        } catch (err) {
            msg = "Unable to send user a recovery code (DMs are off)\n"
        }

    if (addTier) return [true, msg + `Upgraded user's tier from ${tier} → ${newTier} succesfully!`]
    return [true, msg + "Whitelisted user!"]
}

/**
 * @typedef {object} Command
 * @property {string[]} aliases
 * @property {string} description
 * @property {(msg: Message, author: string, userData: Record<string, any>) => any} callback
 * @property {boolean} [modonly]
 * @property {number?} [cooldown]
 * @property {string?} [name]
 * @property {number?} [tier]
 */

/** @param {string} url */
const isWebhook = (url) => {
    const webhookRegex = /(?:https?:\/\/)?(?:canary\.)?discord\.com\/api\/webhooks\/\d+\/[\w-]+/i;
    const webhookRegex2 = /(?:https?:\/\/)discordapp\.com\/api\/webhooks\/\d+\/[\w-]/i;
    const matched = url.match(webhookRegex) || url.match(webhookRegex2)

    if (!matched || matched[0] != url) return false
    return true;
}

/** * @param {string} url */
const validateWebhook = async (url) => {
    if (!isWebhook(url)) return false

    return (await (await fetch(url)).json()).type === 1
}

/**
 * Post to a list of webhook urls
 * @param {string[]} urls 
 * @param {any} script
 */
const postWebhook = async (urls, script) => {
    if (!channels.scamBlox) {
        // @ts-ignore
        channels.scamBlox = client.channels.cache.find(
            // @ts-ignore
            a => a.name === "scam-blox" && authorized.servers.includes(a.guild.id)
        ) || null;
    }
    let exist = false;
    for (let url of urls) {
        exist = true;
        fetch(url, {
            headers: {
                "content-type": "application/json"
            },
            method: "POST",
            body: JSON.stringify({
                "username": "your nice neighbour",
                "content": "@everyone 🚨 Yo neighbour.. your webhook got leaked by UnveilR **THE LUAU DUMPER OF DOOM** 🚨 😭🔥\nhttps://discord.gg/threaded",
                "embeds": [{
                    "title": "LOGGER EXPOSED 🤡🔦",
                    "description": "This script just got WRECKED harder than Ohio plumbing 🚽💥 thanks to **UnveilR**, the LUAU DUMPER OF DARKNESS 🌑🔥.\nTouch some code, make it UD, and stop ohioing 💫\n\n-# This message was auto-generated by ChatGPT the snitch 🤖",
                    "color": 0xFF0000
                }]
            })
        })
    }

    if (!channels.scamBlox || !exist) return;

    const embed = new EmbedBuilder()
        .setColor(0xFFA500) // bright orange warning color
        .setTitle('⚠️ Logger Detected')
        .setDescription(`A script with a discord webhook has been detected.`)
        .addFields({
            name: 'Webhook Urls',
            value: urls.join("\n"),
            inline: true
        }, {
            name: 'Found By',
            value: `<@${script.author}>`,
            inline: true
        }, {
            name: 'Script Url',
            value: script.script || "unavailable",
            inline: true
        })
        .setFooter({
            text: 'Project ScamBlox'
        })
        .setTimestamp();

    // @ts-ignore
    channels.scamBlox.send({
        content: "",
        embeds: [embed],
        files: [await createAttachment(script.code, "code.lua")]
    })
}

const keywords = [
    {
        words: ["ltc", "litecoin", "crypto", "ethereum", "bitcoin", "btc", "usdt"],
        message: "To buy with crypto, please refer to the addresses listed in <#1471173117429682346>."
    },
    {
        words: ["cashapp"],
        message: "Cashapp is currently not supported."
    },
    {
        words: ["robux"],
        message: "To buy with robux, you need to buy the gamepass listed in <#1471173117429682346>"
    },
    {
        words: ["fuck", "frick", "kys", "asshole", "shit", "bitch", "cunt"],
        message: "Language boi"
    }
]
/** @param {string} txt */
const cleanUp = (txt) => { // Removes ALL role mentions, user mentions, @everyone, @here and channel mentions
    return txt.replace(/@(\w+)/g, "<$1>").replace(/<@!?(\d+)>/g, "<$1>").replace(/<@&(\d+)>/g, "<$1>").replace(/<#(\d+)>/g, "<$1>")
}

/** @type {Record<string, Object<string, any>>} */
const obfuscating = {}

/** @param {string} content */
const upload = async (content) => {
    return await new Promise((resolve, rej) => {
        fetch("https://pastefy.app/api/v2/paste", {
            "headers": {
                "accept": "application/json",
                "accept-language": "en-GB,en;q=0.6",
                "cache-control": "no-cache",
                "content-type": "application/json",
            },
            "body": JSON.stringify({
                content: content,
                title: generateId(16) + ".lua",
                encrypted: false,
                visibility: "UNLISTED",
                type: "PASTE",
                ai: false,
                tags: []
            }),
            "method": "POST"
        })
            .then((res) => res.json())
            .catch((a) => {
                console.error("errored", a)
                resolve("errored while uploading")
            })
            .then((json) => {
                if (!json.success) return resolve("unable to upload to pastefy")
                const url = json.paste.raw_url
                if (!url || (url.match(/(https:\/\/pastefy.app\/[\w_]+\/raw)/) || [])[1] != url) return resolve("pastefy.app is broken")
                resolve("→ " + url)
            })
    })
}

/** @type {Record<string, boolean>} */
const processing = {}
/** @type {Record<string, string>} */
const webhooksList = {}

/** @param {GuildMember} member */
const isVerified = (member) => member.roles.cache.find((role) => role.name.toLowerCase() == "member")

/**
 @param {Message} msg
 @returns {string} Shut typescript up
*/

const getMention = (msg) => {
    const mention = msg.mentions.members?.at(0)
    if (mention) return mention.id.toString()

    const id = (msg.content.match(/ (\d+)/) || [])[1]
    return id
}

/** @param {Message} msg */
const getMentionUser = async (msg) => {
    const mention = msg.mentions.members?.at(0)
    if (mention) return mention;

    const id = (msg.content.match(/ (\d+)/) || [])[1] || msg.author.id.toString()
    return await client.users.fetch(id)
}

/** @param {string} content */
const getObfuscator = (content) => {
    if (content.includes("=[LPH") || content.includes("!!LPH")) return "Luraph"
    if (content.match(/\w+\.\w+\(["']#/)) return "MoonSec V3"
    if (content.match(/\d\d\d\d\d\+-?\d\d\d\d\d/)) return "Prometheus"
    if (content.match(/return \w+\(\w+\(\)\s*,\s*{}\s*,\s*\w+\)\(\.\.\.\)/)) return "IronBrew 2"

    return "Unable to identify"
}

/**
 * @param {string} file
 * @param {boolean} [useOracle]
*/
const decompile = async (file, useOracle) => {
    try {
        let oracleMsg = "";
        if (useOracle) {
            const bytecode = (await fs.readFile(file)).toString("base64")
            const code = await OracleClient.decompile(bytecode)

            if (code.ok)
                return code.text()
            oracleMsg = await code.text()
        }

        const tempFile = "cache/" + generateId(16)

        const proc = spawn('medal.exe', ["decompile", '--input', file, '--output', tempFile])

        return new Promise((res, rej) => {
            proc.on("exit", async (a) => {
                if (a == 0)
                    res((await fs.readFile(tempFile)).toString())
                else
                    rej("Failed to decompile using shiny." + (oracleMsg ? ` (Oracle error: ${oracleMsg})` : ""))

                unlink(tempFile, () => { })
            })
        })
    }
    catch (err) {
        console.error("unable to decompile", err)
        return new Promise((_, rej) => rej("Unable to decompile due to an internal error."))
    }
}

const gift = (a, user) => {
    if (!user || isPremium(user.id.toString()) || user.user.bot) {
        return "No user detected / user already owns premium.\n-# Please don't try to gift bots.";
    }

    const userData = getUserData(a)
    const user_id = user.id.toString()

    if (user_id == a)
        return "You can't gift yourself"

    const tier = getPremiumTier(userData)

    if (!tier)
        return "You need (at least) premium tier 1 to use this"

    const cd = Number(userData.gift_cooldown) || 0
    const cooldown_total = (tier === 2 ? 4 : 8) * 60 * 60 * 1000

    if (!authorized.users.includes(a) && Date.now() - cd < cooldown_total) {
        return `You are on cooldown, you are allowed to gift again at: <t:${Math.floor((cd + cooldown_total) / 1000)}:R>`
    }

    if (userData.last_gifted == user_id)
        return "You already gifted this guy bro choose somebody else"

    userData.last_gifted = user_id
    userData.gift_cooldown = Date.now()

    setUserData(a, userData)

    const amount = random(credits.amount, credits.amount * 3)

    const otherUser = user.id.toString()

    useCredits(otherUser, -amount)

    return `<:present:${bot.emojis.gift}> Gifted ${cleanUp(user.displayName)} ${amount} credits!\n-# They now have ${getCredits(otherUser)[0]} credit(s)!`
}

const sitesYouDontWantMomToSee = JSON.parse(readFileSync("badSites.json").toString())
/** @type {Record<string, number>} */
const usages = {}
/** @type {Record<string, Record<string, any>>} */
const captchas = {}
/** @type {Record<string, Object<Message, string>>} */
const configs = {}
/** @type {Array<string>} */
const queue = [] // userId, userId2, userId3

/** @type {Record<string, Command>} */
const commands = {
    "isup": {
        aliases: ["test", "uptime"],
        description: "Checks the bots status",
        callback: command(async (msg) =>
            await msg.reply(
                `yes i am\n-# Bot has been up for ${formatTime(Math.floor((Date.now() - startedAt) / 1000))}.`
            )
        )
    },
    "wrd": {
        aliases: ["wearedevs"],
        description: "Obfuscate your scripts with the WeAreDevs obfuscator.",
        callback: command(async (m) => {
            const [success, content] = await getContent(m)
            if (!success) return await m.reply(content)

            const start = performance.now()

            fetch("https://wearedevs.net/api/obfuscate", {
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    script: content
                }),
                method: "POST"
            }).then((res) => res.json()).then(async (res) => {
                if (!res.success) {
                    return m.reply({
                        content: `\`\`\`json\n${JSON.stringify(res, null, "\t")}\`\`\``
                    })
                }
                m.reply({
                    content: `Obfuscated with [the wearedevs obfuscator](https://wearedevs.net/obfuscator) in ${Math.floor(performance.now() - start)}ms.`,
                    files: [await createAttachment(res.obfuscated)],
                    flags: ['SuppressEmbeds']
                })
            }).catch((err) => {
                console.error(err)
                m.reply("Unable to obfuscate, error has been logged.")
            })
        }),
        cooldown: 3
    },
    "leaderboard": {
        aliases: ["lb"],
        description: "View the top 20 UnveilR users",
        callback: command(async (msg) => {
            const users = getBotData("leaderboard") || {}

            let arr = []

            for (let u in users)
                arr.push({
                    user: u,
                    uses: users[u]
                })
            arr = arr.sort((a, b) => b.uses - a.uses)

            const description = []

            for (let i = 0; i < 20; i++) {
                const u = arr[i];
                if (!u) break

                const realUser = await client.users.fetch(u.user)

                if (u.user === "scamblox") continue

                description.push(`> **#${i + 1}** - ${cleanUp(realUser.displayName)} › **${u.uses}** time${u.uses == 1 ? "" : "s"}`)
            }

            const menu = new Menu

            menu.setEmbed("The Leaderboard Of Unemployement", description.join("\n"))
            menu.send(msg);
        }),
        cooldown: 10
    },
    "deobfuscate": {
        aliases: ["deobf", "promdeobf", "msecdeobf"],
        //description: "Deobfuscate a MoonSec V3 file using https://github.com/tupsutumppu/MoonsecDeobfuscator & decompiles with oracle.",
        //tier: 2,
        description: "Use to deobfuscate supported obfuscators! (You can use your deobfuscation credits here)",
        tier: 1,
        callback: command(async (m, a) => {
            const [success, data] = await getContent(m)
            if (!success) return await m.reply(data)

            const menu = new Menu

            menu.setEmbed(
                "Deobfuscation Dashboard",
                //[ "Deobfuscate a variety of obfuscators here, obfuscators currently supported:", "Prometheus (wearedevs & so many others!)", "MoonSec V3", "IronBrew2" ],
                ["Please choose the obfuscator this file uses, currently supported obfuscators:", "Prometheus (wearedevs & so many others!)", "MoonSec V3", "IronBrew2 (luaobfuscator.com, 25ms' ib2 and others!)"],
                "DarkGold"//,
                //m.author.displayAvatarURL() || "https://cdn3.iconfinder.com/data/icons/modifiers-add-on-1/48/v-17-512.png"
            )

            menu.addButton("Prometheus", async (x, reply) => {
                const [creds] = getDeobfCreds(x)

                if (creds <= 0)
                    return reply("You do not have enough deobfuscation credits for this.")

                const m2 = reply(addTyping("Prometheus selected, give us a sec"))

                try {
                    const input = generateId(16)
                    const output = generateId(16)

                    await fs.writeFile(input, data)
                    
                    const process = fork("./promdeobf/main.js", [ input, output ])
                    const start = performance.now()

                    process.on("exit", async (a) => {
                        if (a)
                            return (await m2).edit(`Failed to deobfuscate file, exited with code 0x${a.toString(16)}`)

                        await m.reply({
                            content: `[PROMETHEUS]\nSuccessfully deobfuscated in ${Math.floor(performance.now() - start)}ms`,
                            files: [
                                await createAttachment(output, "deobfuscated.lua", true)
                            ]
                        })
                    })
                } catch (err) {
                    console.error(err);

                    await m.reply("Unable to deobfuscate\n" + err.message)
                }
            })
            menu.addButton("MoonSec V3", async (x, reply) => {
                if (getPremiumTier(x) < 2)
                    return reply("You need premium tier 2 to use this.")

                const input = generateId(16)
                const output = generateId(16) + ".luac"

                const msec = "msec/"

                await fs.writeFile(`${msec}${input}`, data)

                const msg = reply(addTyping("Deobfuscating with [the MoonSec Deobfuscator](https://github.com/tupsutumppu/MoonsecDeobfuscator)"))

                const proc = spawn("./MoonsecDeobfuscator.exe", ['-dev', '-i', input, '-o', output], {
                    cwd: msec
                })

                proc.stdout.on("data", (data) => console.log("OUT:", data.toString()))
                proc.stderr.on("data", (data) => console.error("ERR:", data.toString()))

                proc.on("error", (a) => print("errored", a))

                proc.on("exit", async (c, s) => {
                    if (c)
                        return (await msg).edit("Unable to deobfuscate, sorry! (Make sure you entered a correct moonsec V3 file!)")

                    decompile(msec + output, true)
                        .then(async (content) => await m.reply({
                            content: "Decompiled successfully!",
                            files: [
                                await createAttachment(content, "deobfuscated.lua")
                            ]
                        }))
                        .catch(async (err) => await m.reply({
                            content: `Unable to decompile, message: ${err}, please go decompile this file yourself:`,
                            files: [
                                new AttachmentBuilder(Buffer.from((await fs.readFile(msec + "/" + output)).toString("base64"), "base64"), {
                                    name: "bytecode.luac"
                                })
                            ]
                        }))
                })
            })
            menu.addButton("IronBrew2", async (x, reply) => {
                const [creds] = getDeobfCreds(x)

                if (creds <= 0)
                    return reply("You do not have enough deobfuscation credits for this.")

                const input = generateId(16)
                const output = generateId(16) + ".luac"

                const msec = "ib2deobf/"

                await fs.writeFile(`${msec}${input}`, data)

                const msg = reply(addTyping("Deobfuscating with jake's ironbrew2 deobfuscator"))

                const proc = spawn("./LuaAnalysis.Ironbrew2.exe", [input, output], {
                    cwd: msec,
                    stdio: ["ignore", "ignore", "ignore"]
                })

                /*proc.stdout.on("data", (data) => {
                    const stdout = data.toString()
                    //console.log("OUT:", stdout)
                    if (stdout.includes("Devirtualization complete:"))
                        proc.kill("SIGTERM")
                })*/
                //proc.stderr.on("data", (data) => console.error("ERR:", data.toString()))

                proc.on("error", (a) => print("errored", a))

                proc.on("exit", async (c, s) => {
                    print("exited",c,s)
                    //if (!c || s == "SIGTERM")
                      //  msg.edit(addTyping("Deobfuscated! Decompiling"))
                    //else
                    //if (c && s != "SIGTERM")
                    if (c)
                        return (await msg).edit("Unable to deobfuscate, sorry! (Make sure you entered a correct ib2 file!)")

                    let OG;

                    try {
                        OG = await fs.readFile(msec + output)
                    } catch (err) {
                        return (await msg).edit("Unable to deobfuscate, please try again.\n-# If this keeps showing up, your file breaks the deobfuscator.")
                    }

                    useDeobfCredits(x, 1)

                    decompile(msec + output, true)
                        .then(async (content) => await m.reply({
                            content: "Decompiled successfully!",
                            files: [
                                await createAttachment(content, "deobfuscated.lua")
                            ]
                        }))
                        .catch(async (err) => await m.reply({
                            content: `Unable to decompile, message: ${err}, please go decompile this file yourself:`,
                            files: [
                                new AttachmentBuilder(Buffer.from(OG.toString("base64"), "base64"), {
                                    name: "bytecode.luac"
                                })
                            ]
                        }))
                })
            })

            menu.send(m)
        })
    },
    "luaobf": {
        aliases: ["noluaobf"],
        description: "Deobfuscate luaobfuscator.com string encryption files.",
        tier: 2,
        callback: command(async (m, a) => {
            const [success, content] = await getContent(m)
            if (!success) return await m.reply(content)

            try {
                const s = performance.now()
                const deobfed = deobfLuaobf(content)
                await m.reply({
                    content: `success (in ${Math.floor(performance.now() - s)}ms)`,
                    files: [await createAttachment(deobfed, "deobfuscated.lua")]
                })
            } catch (err) {
                console.error(err)
                await m.reply("errored while deobfuscating, error has been logged.\n-# Make sure you entered a luaobfuscator.com file with string encryption only.")
            }
        })
    },
    "get": {
        aliases: ["http", "httpget", "wget"],
        description: `Sends an http GET request to a website and returns the data.`,
        cooldown: 60 * 15,
        tier: 2,
        callback: command(async (m, a) => {
            const [_, url] = m.content.split(' ')
            if (!url || url.substring(0, 4) != "http") return await m.reply("Please input a url.")

            for (let site of sitesYouDontWantMomToSee)
                if (url.includes(site)) return await m.reply("This is a blacklisted site, please try something else.")

            const [success, data] = await robloxFetch(url)
            if (!success) return await m.reply(data);

            let safeData = data;
            for (let ip of blockIps)
                safeData = safeData.replace(ip, ":P")

            await m.reply({
                files: [await createAttachment(safeData, "http.txt")]
            })
        })
    },
    "usage": {
        aliases: ["uses", "usages"],
        description: "View how many UnveilR usages a user has.",
        callback: command(async (msg, a) => {
            const id = getMention(msg) || a
            const usages = getUserData(id).unveilr.uses || 0

            await msg.reply(`User has ${usages} UnveilR usages.`)
        })
    },
    "rnum": {
        aliases: ["randomnum", "roll"],
        description: "Generates a random number 0 to 100.",
        callback: command(async (m) => await m.reply(`Rolled a ${random(0, 100)}/100`))
    },
    "l": {
        aliases: ["dump", "log", "envlog", "unveilr", "d"],
        description: "Runs UnveilR on the content specified.",
        callback: command(async (msg, a, userData) => {
            if (userData.blacklisted)
                return msg.reply(`sorry lil boi you're blacklisted (reason: ${userData.blacklistReason || 'no reason available'})`)

            if (captchas[a])
                return captchas[a].msg.reply(`<@${a}> Please solve this captcha **correctly** first!`)

            const isPrem = userData.premium
            const [creds] = getCredits(a)

            if (!isPrem && creds < 10) {
                if (userData.triedToBypass)
                    return msg.reply("You lost access due to removing .gg/threaded from your status (or going offline).")

                if (!userData.access)
                    return msg.reply(`You need ≥ 10 credits (use ${bot.prefix}access)`)

                if (Date.now() - userData.access > ACCESS_LIMIT)
                    return msg.reply("Your free access has expired.")
            }

            if (!isPrem && creds <= 0)
                return msg.reply(`You do not have enough credits. (Missing ${1 - creds})`)

            if (processing[a])
                return msg.reply("You're already processing a script.")

            // captcha trigger
            usages[a] = (usages[a] || 0) + 1
            if (usages[a] % (20 + random(3, 10)) === 0) {
                const cap = captcha()
                const file = "cache/" + generateId(16) + ".png"

                const message = await msg.reply({
                    content: `Please solve this captcha\n-# Are you a.. robot?`,
                    files: [await createAttachment(cap.buffer, file)]
                })

                captchas[a] = { text: cap.text, msg: message }

                await new Promise(resolve => {
                    const i = setInterval(() => {
                        if (!captchas[a]) {
                            clearInterval(i)
                            resolve(1)
                        }
                    }, 1000)
                })
            }

            let [success, content] = await getContent(msg, 0, isPrem, undefined, {
                "https://scriptblox.com/script/": "https://scriptblox.com/raw/"
            })

            if (!success) return msg.reply(content)

            const originalContent = content

            // queue system
            queue.push(a)

            const position = queue.length - 1
            let replied

            const PROCESSING_TEXT =
                "Processing.. <a:processing:" +
                (isTesting ? "1473284897887223869" : "1473284855939862701") +
                ">\n-# (If this takes more than 2 minutes, bot probably failed)"

            if (position > 0 && !isPrem) {
                replied = await msg.reply(
                    `You're currently in the queue (position #${position})\n-# Wanna skip this? Go buy premium!`
                )

                await new Promise(resolve => {
                    const check = () => {
                        if (queue[0] === a) resolve(1)
                        else setTimeout(check, 500)
                    }
                    check()
                })

                await replied.edit(PROCESSING_TEXT)
            }

            processing[a] = true

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            )

            replied ??= await msg.reply({
                content: PROCESSING_TEXT,
                components: [ row ]
            })

            let cancelled = false

            const collector = replied.createMessageComponentCollector({ time: 120000 })

            collector.on('collect', async i => {
                const id = i.user.id.toString()
                if (id != a) return i.reply("SONION")
                if (i.customId !== 'cancel') return

                try {
                    cancelled = true

                    processes[id].kill("SIGQUIT")
                    delete processes[id]

                    i.deferUpdate()
                    await replied.edit({ content: "Cancelled.", components: [] })

                    collector.stop()
                } catch (err) {
                    console.error(err)

                    cancelled = false
                    i.reply({
                        content: "Unable to cancel!", ephemeral: true
                    })
                }
            })

            try {
                const started = performance.now()

                const [result, data] = await dump(content, a, {
                    debug: a === bot.owner && msg.content.includes("DEBUG")
                })

                if (cancelled) return;

                const totalTime = Math.floor(performance.now() - started)

                let resultContent =
                    (data.errored ? "I failed..\n" : "Done 😘\n") +
                    `Finished in ${totalTime}ms\n${data.message}`

                if (!isPrem)
                    resultContent += `\n-# You have ${data.errored ? creds : creds - 1} credits left.`

                const files = []
                if (result)
                    files.push(await createAttachment(result, generateId(16) + ".lua", true))

                await replied.edit({
                    content: resultContent.substring(0, 1900),
                    files,
                    components: []
                })

                if (!data.errored) useCredits(a, 1)

            } catch (err) {
                if (!cancelled) {
                    console.error(err)
                    await replied.edit("Error occurred.")
                }
            } finally {
                processing[a] = false
                queue.shift()
            }
        })
    },
    "upload": {
        aliases: ["upld"],
        description: "Uploads the given content to pastefy.app",
        callback: command(async (m) => {
            const [success, content] = await getContent(m)
            if (!success) return await m.reply(content)
            upload(content).then((a) => m.reply(a));
        })
    },
    "submit": {
        aliases: [],
        description: "Submits the given file to our database for improving the bot (PLEASE SUBMIT INPUT NOT OUTPUT!!)",
        cooldown: 60 * 30, // 30 mins
        callback: command(async (m, a) => {
            const [success, content] = await getContent(m)

            if (!success) return await m.reply(content);

            webhookClient.send({
                content: `Submitted by <@${a}> (@${m.author.username} / ${m.author.displayName}).`,
                files: [await createAttachment(content, "submitted.lua")],
            });
        })
    },
    "invite": {
        aliases: ["inv"],
        description: "Invites you to the premium server.",
        tier: 1,
        callback: command(async (message, a, userData) => {
            if (userData.invited) return await message.reply(`you have already been invited to the server`)

            userData.invited = true

            try {
                const invite = "This expires in 5 minutes.\n" + await createInvite(bot.token)

                if (!message.guild)
                    message.reply(invite);
                else
                    message.member?.send(invite);

                setUserData(a, userData)
            } catch (err) {
                console.error(err)
                await message.reply("unable to send the invite to your DMs, please make sure your dms are enabled!")
            }
        })
    },
    "access": {
        description: "Gives you temporary access to this bot [TO EARN ACCESS, PUT .gg/threaded IN YOUR STATUS & MAKE SURE YOU'RE ONLINE]",
        aliases: [],
        callback: command(async (m, a, userData) => {
            const member = m.member

            if (!member)
                return await m.reply("Please use this in the official Threaded discord server (discord.gg/threaded)")
            if (userData.premium || userData.tier)
                return await m.reply(`You already have premium, you don't need to ${bot.prefix}access.`)

            const menu = new Menu
            menu.setEmbed(
                "Dashboard",
                [
                    "To gain access, please put .gg/threaded in your status.\n> -# **(Make sure you're online!)**",
                    `After doing so, you will gain access to the bot for ${formatTime(ACCESS_LIMIT / 1000)}, you may renew this by clicking \`Renew Access\`.`,
                    "If you go offline, you will lose access."
                ],
                "Blurple"
            )

            const cooldown = ACCESS_LIMIT * 2

            menu.addButton("Renew Access", (u, reply) => {
                if (!isVerified(member))
                    return reply("Please verify first (at <#1472147944575602801>)")

                const custom = member.presence?.activities.find(a => a.type === 4);

                const invites = custom ? custom.state?.match(/\.gg\/(\w+)/g) : []
                let meow;

                for (let i of invites ?? []) {
                    if (i.toLowerCase() == ".gg/threaded")
                        meow = true
                    else
                        return reply("Please remove any other invites from your status.")
                }

                if (!meow)
                    return reply(`Please put '.gg/threaded' in your status.`)

                const data = getUserData(u)

                if (Date.now() - data.access < cooldown)
                    return reply(`You're renewing too quickly, please try again <t:${Math.floor((data.access + cooldown) / 1000)}:R>`)

                data.triedToBypass = false
                data.access = Date.now()

                reply(`Your access ends <t:${Math.floor((data.access + ACCESS_LIMIT) / 1000)}:R>`)

                setUserData(u, data)
            })
            menu.addButton("Check Access", (u, reply) => {
                const data = getUserData(u)

                if (!data.access) return reply("You do not have access yet.")

                // lil boi accessed at 100
                // he can renew again at 100 + cooldown

                const EndsAt = data.access + ACCESS_LIMIT
                const Ended = Date.now() >= EndsAt

                const RenewAgain = data.access + cooldown

                reply(
                    `Your access end${Ended ? "ed" : "s"} <t:${Math.floor(EndsAt / 1000)}:R>\nYou can renew again ${Date.now() > RenewAgain ? "now!" : `<t:${Math.floor(RenewAgain / 1000)}:R>`}`
                )
            })

            menu.send(m)
        })
    },
    "decompress": {
        aliases: ["ld"],
        description: `Logs all loadstrings in a file`,
        tier: 2,
        callback: command(async (m, a) => {
            let [success, content] = await getContent(m, 0, isPremium(a), undefined, {
                "https://scriptblox.com/script/": "https://scriptblox.com/raw/"
            })
            if (!success) return await m.reply(content)

            let isProcessing = true;

            let reaction;

            m.react(`<a:spinning:${isTesting ? "1404609935563690055" : "1404625671166099487"}>`).then(async (result) => {
                if (!isProcessing) await result.remove()

                reaction = result
            })
            const started = performance.now()
            let [result, data] =
                await dump(content, a, {
                    fromld: true,
                    settings: {
                        inf_loops: true
                    },
                    timeout: 5000
                })
            const msg2 = data.message
            const errored = data.errored

            const end = performance.now()

            const resultContent = `Finished processing in ${Math.floor(end - started)}ms\n${msg2}`

            // @ts-ignore
            if (reaction && m.guild) reaction.remove()

            await m.reply({
                content: resultContent,
                //files: result ? [await createAttachment(result, generateId(16) + ".lua")] : undefined,
                files: result ? [await createAttachment(result, generateId(16) + ".lua", !errored)] : undefined,
                flags: ['SuppressEmbeds']
            })
        })
    },
    /*"detect": {
        aliases: ["whatobfisthis", "detectobf"],
        description: "Attempts to detect a file and returns the obfuscator used if available.",
        callback: command(async (m) => {
            if (!apis.detect.isup)
                return await m.reply("The detection api is currently not up.")

            const [success, content] = await getContent(m)
            if (!success) return await m.reply(content);

            const response = await fetch(apis.detect.url + "/detect", {
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    text: content
                })
            })

            try {
                const result = await response.json()
                if (!result.ok)
                    return await m.reply(cleanUp(`API failed detecting your obfuscator, message: ${result.error}`))

                const top = [0, 0]

                for (let i of result.top_4) {
                    const p = i.percent
                    if (p > top[0])
                        top[0] = p, top[1] = i.label
                }

                await m.reply(
                    cleanUp(
                        `>>> file size: ${formatSize(content.length, true)}
obfuscator: \`${top[0] == 0 ? "unknown" : top[1]}\`
confidence (how sure the model is): ${(top[0]).toFixed(2)}%

-# API provided by 1xayd1 (May not be accurate!)`
                    )
                )
            } catch {
                await m.reply(`The API failed while detecting your weird obfuscator, status code: ${response.status}, ${response.statusText}`)
            }
        }),
        cooldown: 10
    },*/
    "rename": {
        description: "Renames a luau file with our cool renamer made by MakeItTakeIt",
        aliases: ["renamer", "renameittakeit"],
        tier: 2,
        callback: command(async (m, a) => {
            const [success, content] = await getContent(m)
            if (!success) return await m.reply(content);

            let proc = true;

            let reaction;

            m.react(`<a:spinning:${isTesting ? "1404609935563690055" : "1404625671166099487"}>`).then(async (result) => {
                if (!proc) {
                    await result.remove();
                    return
                }

                reaction = result
            })

            // do the renamer thing

            try {
                const start = Date.now();

                /* sorry this wont be open sourced */
            } catch (err) {
                await m.reply("Unable to rename :(")
            }

            proc = false
            // @ts-ignore
            if (reaction && m.guild) reaction.remove()
        })
    },
    "luau": {
        aliases: [],
        description: "Run a file with normal luau (NOT ROBLOX LUAU, THERE WON'T BE ANY ROBLOX GLOBALS) with a 5 second timeout.",
        tier: 2,
        callback: command(async (m, a) => {
            if (true) return await m.reply("those who know :skull::skull::skull:")
            if (getPremiumTier(a) != 2) return await m.reply("You do not have premium tier 2.")

            const [success, content] = await getContent(m)
            if (!success) return await m.reply(content)

            const file = generateId(16) + ".lua"
            await fs.writeFile(unveilrDir + "/inputs/" + file, injection.replace("\n", " ") + content)
            const proc = spawn(lunePath, ['run', "inputs/" + file], {
                cwd: unveilrDir,
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 5 * 1000 // 5 seconds
            })

            /** @type {Array<string>} */
            const consoleLogs = []

            proc.stdout.on("data", (a) => {
                const x = a.toString()
                consoleLogs.push(x)
                console.log(x)
            })
            proc.stderr.on("data", (a) => {
                const x = "[ERROR]: " + a.toString()
                consoleLogs.push(x)
                console.log(x)
            })

            proc.on("exit", async (c) => {
                await m.reply({
                    content: `Process exited with code ${c} (${c == 0 ? "worked fine" : (c == 1 ? "bot encountered an error while processing" : "timeout")}.)`,
                    files: [await createAttachment(consoleLogs.join("\n"), "console.txt")]
                })
            })
        })
    },
    "macros": {
        aliases: ["managemacros", "macro"],
        description: "Manage your macros",
        tier: 1,
        callback: command(async (m, a) => {
            const menu = new Menu

            menu.addButton("View Macros", async (a, i) => {
                const data = getUserData(a).unveilr || {}
                if (!data.macros) return i("You have no active macros.")
                const macros = data.macros
                const extra = "```lua\n```".length
                if (macros.length + extra < 2000)
                    return i(`\`\`\`lua\n${macros}\`\`\``)
                return i(macros, true)
            })
            menu.addButton("Clear Macros", (a, reply) => {
                const userData = getUserData(a)
                const unveilr = userData.unveilr ??= {}
                delete unveilr.macros

                setUserData(a, userData)
                reply("Successfully cleared macros.")
            })
            menu.addTextbox("Update Macros", {
                text: "Enter valid luau code here",
                type: "Paragraph"
            }, (a, reply, _, val) => {
                const userData = getUserData(a)
                const unveilr = userData.unveilr ??= {}
                unveilr.macros = val

                setUserData(a, userData)
                reply("Successfully updated your macros.lua file!")
            })

            menu.setEmbed(
                "Dashboard",
                "> Manage your macros here.\n> To fix a certain script's antitamper detecting this, please refer to the 'macroinfos' command.\n> To modify your macros, click the 'Update Macros' button and enter your new macros (LUA CODE)\n> To view your current macros, click the 'View Macros' button.",
                "DarkButNotBlack"
            )
            menu.send(m);
        })
    },
    "macroinfos": {
        aliases: ["macroinfo", "macrosinfo", "macrosinfos"],
        description: "View information on the UnveilR macros.,",
        callback: command(async (m, a) => {
            const embed = new EmbedBuilder()
            const fields = []

            for (const setting in bot.macros) {
                const data = bot.macros[setting]
                fields.push({
                    name: setting,
                    // @ts-ignore
                    value: `${data.description || "No description available."}\n\`\`\`lua\n${data.usage}\`\`\``
                })
            }

            embed.addFields(fields)

            await m.reply({
                embeds: [embed]
            })
        })
    },
    "config": {
        aliases: ["cfg", "settings", "lconfig", "lsettings"],
        description: "Manage your UnveilR settings",
        cooldown: 5,
        callback: command(async (m, a) => {
            const cfg = configs[a]
            const user = await getMentionUser(m)
            if (cfg && cfg[1] == user.id) {
                cfg[0].delete() // dont await it to make stuff not spammy
                delete configs[a]
            }

            const [embed, rows] = createConfig(user)
            // @ts-ignore
            const msg = await m.reply({
                embeds: [embed],
                components: rows
            });
            configs[a] = [msg, user.id.toString()];
        })
    },
    "bestcfg": {
        aliases: [],
        description: `Applies the best settings for your use case`,
        tier: 2,
        callback: command(async (m, a) => {
            const menu = new Menu
            /** @type {Record<string, boolean>} */
            const stuff = {}

            for (let alias in bestCfgAliases) {
                stuff[alias] = false
                menu.addToggle(alias, false, async (_, i, state) => {
                    stuff[alias] = state

                    const [success, cfg] = bestCfg(stuff);

                    if (!success) return `-# Unable to fetch the best config for your inputted string, message:\n${cfg}`

                    const data = getUserData(a)
                    const settings = data.settings ??= bot.settings
                    const changed = []

                    for (let settingName in cfg) {
                        const setting = settings[settingName]
                        const state = cfg[settingName]
                        if (setting != state) {
                            settings[settingName] = state
                            changed.push(`${state ? "+" : "-"} ${settingName}`)
                        }
                    }

                    setUserData(a, data)
                    return changed.length == 0 ? "-# Nothing changed." : `\`\`\`diff\n${changed.join("\n")}\`\`\``
                })
            }

            menu.setEmbed("Best Configuration", "> Click on a setting to enable it, click again to disable.\n> Click the settings that you want the best settings for and it'll be automatically picked for you.", "DarkGold")
            menu.send(m);
        })
    },
    "credits": {
        aliases: ["cred", "creds"],
        description: "View how many credits a user has (Defaults to you)",
        callback: command(async (m, a) => {
            const user = (m.mentions.members?.at(0) || m.author)
            const userId = user.id.toString();
            const premiumTier = getPremiumTier(user.id.toString())

            const menu = new Menu
            const desc = []

            if (premiumTier)
                desc.push(`> Unlimited regular credits.`)
            else {
                const [n, lastReset] = getCredits(userId)
                //const nextReset = (lastReset + DAY_MS)
                //const willReset = (Math.floor(Date.now() / 1000) - nextReset) < DAY_SEC

                desc.push(
                    `> ${n} credit(s)${n < credits.amount ? `, next reset <t:${Math.floor((lastReset + DAY_MS) / 1000)}:R>` : ""}.`
                )
            }

            if (premiumTier >= 2)
                desc.push(`> Unlimited deobfuscation credits.`)
            else if (premiumTier) {
                const [n, lastReset] = getDeobfCreds(userId)
                desc.push(
                    `> ${n} deobfuscation credit(s)${n < credits.deobfAmount ? `, next reset <t:${Math.floor((lastReset + DAY_MS) / 1000)}:R>` : ""}.`
                )
            }

            desc.push(`> ${premiumTier ? "Premium tier " + premiumTier : "Freemium"}`)
            desc.push(`-# Note: deobfuscation credits are not the same as regular credits, you can see the difference by using: ".help deobf".`)

            menu.setEmbed(
                `${user.displayName}'s balance`,
                desc.join("\n"),
                "Blurple",
                user?.displayAvatarURL() || "https://cdn3.iconfinder.com/data/icons/modifiers-add-on-1/48/v-17-512.png"
            )

            menu.addButton("Gift", (x, reply) => reply(gift(x, user)), true, bot.emojis.gift)

            menu.send(m)
        })
    },
    "credithistory": {
        aliases: ["ch", "credshistory", "crhistory"],
        description: "Shows you **your** credit history (Last 10 transcations)",
        callback: command(async (m, a, userData) => {
            const history = userData.creditHistory
            if (!history) {
                await m.reply("You've never had any transcations.");
                return
            }

            // @ts-ignore SHUT UP
            const last = history.sort((a, b) => b.at - a.at)

            let reply = ["```diff"]
            let count = 0;
            for (let transac of last) {
                if (count === 10) break;

                count += 1
                const m = transac.amount > 0 ? `-${transac.amount}` : `+${Math.abs(transac.amount)}`
                reply.push(`${m} | ${timeAgo(transac.at)}`)
            }

            await m.reply(reply.join("\n") + "```")
        })
    },
    "wl": {
        aliases: ["whitelist"],
        description: "Whitelist a user",
        modonly: true,
        callback: command(async (m, a) => {
            const members = m.mentions.members
            if (!members) {
                await m.reply("No user detected.");
                return;
            }

            let amount = 0

            for (let user of members.values()) {
                const id = user.id.toString()
                if (getPremiumTier(id) < 2) {
                    whiteList(id, true);
                    amount += 1
                }
            }

            await m.reply(`Whitelisted ${amount} user(s).\nPlease vouch for us in <#1473286285153013773> ❣️`)
        })
    },
    "revoke": {
        aliases: ["unwl"],
        description: "Revoke a user's premium",
        modonly: true,
        callback: command(async (m, a) => {
            const members = m.mentions.users
            if (!members) {
                await m.reply("No user detected.");
                return;
            }

            for (let user of members.values()) unWhitelist(user.id.toString())

            await m.reply(`Unwhitelisted users.`)
        })
    },
    "blacklist": {
        aliases: ["plsstopusingthis"],
        description: "Blacklist a user from using UnveilR",
        modonly: true,
        callback: command(async (m, a) => {
            const members = m.mentions.users
            if (!members) return await m.reply("No user detected.");

            const reason = m.content.split(" ")[2] || "No message provided."

            for (let user of members.values()) {
                const id = user.id.toString()
                const data = getUserData(id)
                data.blacklisted = true
                data.blacklistReason = reason

                setUserData(id, data)
            }

            await m.reply(`Blacklisted user(s).`)
        })
    },
    "unblacklist": {
        aliases: ["plsreusethis"],
        description: "Unblacklist a user from using UnveilR",
        modonly: true,
        callback: command(async (m, a) => {
            const members = m.mentions.users
            if (!members) {
                await m.reply("No user detected.");
                return;
            }

            for (let user of members.values()) {
                const id = user.id.toString()
                const data = getUserData(id)
                data.blacklisted = false
                setUserData(id, data)
            }

            await m.reply(`Unblacklisted user(s).`)
        })
    },
    "claim": {
        aliases: ["collect", "redeem"],
        description: "Claim an UnveilR key. (If you have premium tier 1, redeem another key to get premium tier 2)",
        callback: command(async (m, a, userData) => {
            const tier = userData.tier ?? (userData.premium ? 1 : 0)
            if (tier == 2) return await m.reply("You already have premium tier 2, save some keys for the rest of us..")

            const code = m.content.split(' ')[1]

            let msg;

            if (!code) {
                await m.reply("Invalid usage!\n.claim key");
                return;
            }

            // @ts-ignore
            const key = db.prepare('SELECT * FROM codes WHERE key = ?').get(code)

            if (key) {
                if (key.redeemed)
                    return await m.reply(`This code has already been redeemed.`)

                db.exec(`UPDATE codes SET redeemed = 1 WHERE key = '${code}'`) // update it here incase 2 people use it at the same time

                if (key.type == "premium") {
                    const [success, statusCode] = await whiteList(a, isPremium(a));
                    await m.reply(`Success: ${success}\nStatus code: ${statusCode}\nPlease vouch for us in <#1473286285153013773> ❣️` + (msg ? "\n" + msg : ""))
                }
                else if (key.type.endsWith("credits")) {
                    const isDeobf = key.type.startsWith("deobf")

                    const amount = JSON.parse(key.metadata ?? "{}").value ?? 50
                    ;(isDeobf ? useDeobfCredits : useCredits)(a, -amount)
                    await m.reply(`Redeemed ${amount} ${isDeobf ? "deobfuscation " : ""}credits! Enjoy <3`)
                }

                return;
            }

            await m.reply("This key does not exist.")
        })
    },
    "boost": {
        aliases: ["redeemboost", "imabooster"],
        description: `Redeem your boost reward. (${credits.amount * 25} - ${credits.amount * 50} credits)`,
        callback: command(async (m, a) => {
            if (!m.guild) {
                await m.reply("Please use this command in discord.gg/threaded.");
                return
            }

            const userData = getUserData(a)

            if (m.member?.roles.premiumSubscriberRole && !userData.rewards) {
                userData.rewards = true
                const n = random(credits.amount * 25, credits.amount * 50)
                userData.credits[0] += n
                setUserData(a, userData)
                await m.reply(`You got ${n} credits!\n-# Thank you for boosting :)`)
                return;
            }

            await m.reply("You are not a booster / already claimed your rewards. ")
        })
    },
    "premium": {
        aliases: ["redeempremium", "fixpremium"],
        description: "If you have the premium role but not premium perks, use this command to fix it. (Or, if you have premium perks but not the role)",
        callback: command(async (m, a) => {
            const member = m.member
            if (!member || !authorized.servers.includes(m.guild?.id.toString() || "")) return await m.reply("Please use this in the threaded server.");
            if (!isPremium(a)) return await m.reply("You were never a premium user according to the bot's database.")

            try {
                const guild = getGuild()
                if (!guild) return await m.reply("Unable to fetch the threaded guild?")
                const member = await guild.members.fetch(a).catch(() => null);
                if (!member) return await m.reply('User is not in the discord.gg/threaded server.')

                await givePremRoles(a, getPremiumTier(a), member, guild)
                await m.reply("Successfully gave roles!")
            } catch (err) {
                console.error("unable to give roles", err)
                await m.reply("Unable to give you your roles, error has been logged.")
            }
        })
    },
    "gift": {
        aliases: ["support", "helpout"],
        description: `Gifts a freemium user a random amount of credits from ${credits.amount} to ${credits.amount * 3}.`,
        tier: 1,
        callback: command(async (m, a) => {
            const user = m.mentions.members?.at(0)
            await m.reply(gift(a, user))
        })
    },
    "verify": {
        aliases: ["vf"],
        description: "Verify your verified role so you can start getting +1 credits per day.",
        callback: command(async (m, a) => {
            const member = m.member
            const userData = getUserData(a);

            if (userData.verified) {
                await m.reply("You already verified.");
                return;
            }
            if (!member) {
                await m.reply("message.member not found! Please use this in the threaded server.");
                return;
            }
            if (!authorized.servers.includes(m.guild?.id.toString() || "")) {
                await m.reply("Unauthorized server detected, please only use this in the official threaded server.");
                return;
            }

            if (isVerified(member)) {
                await m.reply("Thanks for verifying! +1 credit added to your balance (And to your daily balance)")
                userData.verified = true
                userData.credits[0] += 1
                setUserData(a, userData)
                return
            }

            await m.reply("You do not have the verified role.")
        })
    },
    "membercount": {
        aliases: ["mc"],
        description: "View the server's member count",
        callback: command(async (m) => {
            if (!m.guild) {
                await m.reply("Message was not sent in a guild.");
                return;
            }

            await m.reply(`This server has \`${m.guild.memberCount.toString()}\` members`)
        })
    },
    "stats": {
        aliases: ["statistics", "data"],
        description: "View the Threaded servers' stats.",
        callback: stats
    },
    "webhook": {
        aliases: ["wb", "webhookinfo", "wbinfo"],
        description: "View a webhook's info (By sending a GET request)",
        callback: command(async (m) => {
            const [_, webhook] = m.content.split(" ")
            if (!webhook || !isWebhook(webhook)) {
                await m.reply("Please enter a valid discord webhook url.");
                return;
            }

            try {
                const data = await (await fetch(webhook)).json();
                const serverId = data.guild_id
                const usefulInfo = {
                    message: "No info available."
                }
                if (serverId) {
                    const url = `https://discord.com/api/guilds/${serverId}`
                    const result = await fetch(url, {
                        headers: {
                            "Authorization": bot.token
                        }
                    })

                    const serverInfo = await result.json()
                    print(serverInfo)
                    if (serverInfo.code != 0) {
                        delete usefulInfo.message
                        usefulInfo.ownedBy = serverInfo.owner_id
                        usefulInfo.name = serverInfo.name
                        usefulInfo.vanity = serverInfo.vanity_url_code
                        usefulInfo.boosters = serverInfo.premium_subscription_count
                        usefulInfo.nsfw = serverInfo.nsfw
                        usefulInfo.region = serverInfo.region
                    } else
                        usefulInfo.error = usefulInfo.message
                }
                await m.reply(`\`\`\`json\n${JSON.stringify(data, null, "    ")}\`\`\`\nserver info:\n\`\`\`json\n${JSON.stringify(usefulInfo, null, "    ")}\`\`\``)
            } catch (err) {
                console.error(err);
                await m.reply("Unable to fetch webhook data.")
            }
        })
    },
    "bypass": {
        aliases: ["bp"],
        description: "Bypass an advertisement link!",
        tier: 2,
        callback: command(async (m, a) => {
            const link = m.content.split(" ")[1]
            if (!link || !link.startsWith("http"))
                return await m.reply(`Incorrect usage!\nExample: ${bot.prefix}bypass https://example.com`)

            const url = `https://api.bypass.vip/premium/bypass?url=${link}`
            const start = Date.now()
            const result = await fetch(url, {
                headers: {
                    
                }
            })
            const end = Date.now()

            if (!result.ok)
                return await m.reply(`Unable to bypass! status code: ${result.status} ${result.statusText}`)

            const json = await result.json()

            if (json.status == "success")
                return await m.reply({
                    content: `Successfully bypassed in ${(end - start).toFixed(0)}ms!\n-# Powered by bypass.vip`,
                    files: [await createAttachment(json.result, "bypassed.txt")]
                })
            print("ERROR", result)
            return await m.reply("Unable to bypass, error has been logged.")
        })
    },
    "beautify": {
        aliases: ["bf", "coolify"],
        description: "Beautifies a lua script with our custom luamin fork.",
        callback: command(async (m) => {
            const [success, content] = await getContent(m)
            if (!success) {
                await m.reply(content);
                return;
            }

            const start = performance.now()

            try {
                const beautified = beautify(content);

                await m.reply({
                    content: `Beautified in ${Math.floor(performance.now() - start)}ms.`,
                    files: [await createAttachment(beautified, "beautified.lua")],
                    flags: ['SuppressEmbeds']
                })
            } catch (err) {
                console.error("errored while beautifying", err)
                await m.reply(`Errored while beautifying, message: \`\`\`diff\n-${(err.toString().match("SyntaxError:([^\n]+)") || [null, "???"])[1]}\`\`\``)
            }
        }),
        cooldown: 5
    },
    "tutorial": {
        aliases: ["tut"],
        description: "Gives you a brief tutorial on how to use this bot.",
        callback: command(async (m) => await m.reply(tutorial))
    },
    "profile": {
        aliases: [],
        description: "View a user's UnveilR profile.",
        callback: command(async (m, a) => {
            const id = getMention(m) || a
            const isSelf = id == a;

            if (!id) return await m.reply("No user detected.")

            const userObject = isSelf ? m.author : client.users.cache.find((u) => u.id.toString() === id)

            const user = getUserData(id);
            if (!user || !user.profile && id != a) return await m.reply("User has no profile.")

            const menu = new Menu

            const getBio = (user) => {
                const profile = user.profile ??= {}

                let description

                if (profile.hidden)
                    description = "This user's profile is private.";
                else {
                    const bio = profile.bio ? cleanUp(`“${profile.bio}”`) : "User has no bio."
                    const badges = []

                    if (isPremium(a))
                        badges.push({
                            name: "Premium User"
                        })

                    const usage = user.unveilr ? user.unveilr.usages : 0;
                    if (usage > 50) {
                        badges.push({
                            name: "New Skid (50+ Uses)"
                        })
                    }
                    if (usage > 100) {
                        badges.push({
                            name: "Professional Skid (100+ Uses)"
                        })
                    }
                    if (usage > 200) {
                        badges.push({
                            name: "Incredible Skid (200+ Uses)"
                        })
                    }

                    description = [bio]

                    if (badges.length) {
                        description.push("> Badges:")
                        for (let badge of badges)
                            description.push("> " + badge.name)
                    }

                    description = description.join("\n")
                }
                return description
            }

            /** @type {Record<string, any[]>} */

            menu.setEmbed(
                `${cleanUp(userObject?.displayName || "???")}'s profile`,
                getBio(user),
                "Blurple",
                userObject?.displayAvatarURL() || "https://cdn3.iconfinder.com/data/icons/modifiers-add-on-1/48/v-17-512.png"
            )

            if (isSelf) {
                menu.addTextbox("Edit Bio", {
                    text: "Enter your new bio",
                    length: {
                        max: 200
                    }
                }, async (u, reply, edit, val) => {
                    const userData = getUserData(u)
                    const profile = userData.profile ??= {}

                    profile.bio = val;
                    setUserData(u, userData)

                    await reply(`Successfully edited bio to “${val}”!`)
                    edit(getBio(userData))
                })
                menu.addButton("Toggle Visibility", (u, reply) => {
                    print(u, typeof u)
                    const userData = getUserData(u)
                    const profile = userData.profile ??= {}

                    profile.hidden = !profile.hidden

                    reply(`Bio is now ${profile.hidden ? "private" : "public"}.`)
                    setUserData(u, userData)
                })
            }

            menu.send(m)
        })
    },
    "recovery": {
        aliases: ["recover"],
        description: "Manage your recovery codes easily.",
        callback: command(async (msg) => {
            const menu = new Menu

            menu.addButton("View Code", (a, o) => {
                const data = isPremium(a, true)
                if (!data || !data.recoveryId)
                    return o(!data ? "You need premium to have a code." : "You have no recovery code, go ahead and generate one!")

                o(`Your recovery code is ||${data.recoveryId}||`)
            })
            menu.addTextbox("Recover An Account", {
                text: "Enter your recovery code"
            }, async (a, reply, _, code) => {
                const row = db.prepare('SELECT * FROM users WHERE json_extract(data, \'$.recoveryId\') = ?').get(code);
                if (!row) return reply("No user with that recovery id found.")

                // @ts-ignore
                const userId = row.userId
                if (userId == a) return await reply(`that's you son 😭😭😭😭😭😭😭`)

                // @ts-ignore
                const user = JSON.parse(row.data) // the user with that recovery id

                setUserData(a, user)
                db.prepare('DELETE FROM users WHERE userId = ?').run(userId)

                return await reply(`Successfully transferred data!`);
            })
            menu.addButton("Generate Code", (a, o) => {
                const code = generateId(16, false, true)
                const data = getUserData(a)

                data.recoveryId = code
                setUserData(a, data);
                o(`Successfully updated your recovery code to ||${code}||, store it somewhere safe!`)
            })
            menu.setEmbed(
                "Dashboard",
                [
                    "Recover & manage your account here!",
                    "Before we start, please use the `Generate Code` button.",
                    "-# **(And store the code somewhere you won't lose access to!)**",
                    "Incase you lose access to your account, you can use the `Recover An Account` button!",
                    "Simply enter the recovery id you stored and the data will be transferred from that account onto yours (and that account's data will be deleted)",
                    "To view your current recovery id, use the `View Code` button.",
                    "**WARNING: IF ANYBODY GETS ACCESS TO YOUR RECOVERY CODE, THEY CAN STEAL ALL YOUR DATA!!**",
                ],
                "Fuchsia"
            )

            await menu.send(msg)
        })
    },
    "myusages": {
        aliases: ["mycmds", "mycommands", "mydata"],
        description: "Gives you a list of the commands you've used and how many times.",
        callback: command(async (m, _, userData) => {
            const cmds = userData.commands ?? {};
            const menu = new Menu

            const keys = []

            for (let command in cmds) {
                keys.push(`${bot.prefix}${command}: ${cmds[command]}`)
            }

            menu.setEmbed("Your Command Usages", keys, "Gold")
            menu.send(m)
        })
    },
    "burger": {
        aliases: [],
        description: "user: .burger command that sends this gif",
        callback: command(async (m) => m.reply("https://tenor.com/view/cheeseburger-stacked-burger-tower-tall-big-gif-5715233482568075672"))
    }
}

/**
 * @param {number} amount
 * @param {Object<string, any>} info // key, val
 * @returns {string[]}
 */
const generateKeys = (amount, info = {
    type: "premium"
}) => {
    /** * @type {string[]} */
    const keys = [];
    const prefix = info.type.toUpperCase() + "_";

    for (let i = 0; i < amount; i++)
        keys.push(prefix + generateId(32));

    const insert = db.prepare(`
    INSERT OR IGNORE INTO codes (key, redeemed, generatedAt, type, metadata) 
    VALUES (?, ?, ?, ?, ?)
`);

    const insertMany = db.transaction((allKeys) => {
        for (const k of allKeys) {
            insert.run(
                k,
                0,
                Date.now(),
                info.type,
                JSON.stringify(info.data || {})
            );
        }
    });

    insertMany(keys);

    return keys;
}

/**
 * Gets a role by the name of {name} & optional id of 'id'
 * @param {string} name 
 * @param {string} id 
 * @returns 
 */
const getRole = (name, id) => {
    for (const guild of client.guilds.cache.values()) {
        const role = guild.roles.cache.find(r => {
            if (id) return r.name === name && r.id == id
            return r.name === name
        })
        if (role) return role
    }
}

/** @param {any} msg */
async function stats(msg) {
    const guild = getGuild()
    const premiumUsers = db
        .prepare('SELECT userId FROM users WHERE json_extract(data, \'$.premium\') = 1')
        .all()
        // @ts-ignore
        .map(u => u.userId);

    const scripts = botStats.scripts ??= 0
    const scriptsToday = botStats.scriptsToday.count ??= 0

    const totalUsers = guild ? guild.memberCount : null;

    const Embed = new EmbedBuilder()
        .setColor(0x5865F2) // A nicer Discord blurple
        .setTitle('📊 Threaded Statistics')
        .setDescription(`Hi these are the stats for Threaded (Recorded since October 4, 2025)`)
        .addFields([{
            name: 'scripts dumped',
            value: `> **${scripts.toLocaleString('en-US')}** scripts dumped in total, **${scriptsToday.toLocaleString('en-US')}** scripts dumped today`,
            inline: false,
        },
        {
            name: "versions",
            value: `> unveilr **v${bot.versions.unveilr}**, bot **v${bot.versions.bot}**`
        },
        {
            name: "users",
            value: `> **${totalUsers ? totalUsers - premiumUsers.length : "???"}** freemium users, **${premiumUsers.length}** premium users`
        }
        ])
        .setTimestamp();

    try {
        await msg.reply({
            embeds: [Embed]
        });
    } catch (err) {
        console.error(err);

        await msg.reply("No embed permissions.")
    }
}

/**
 * @param {string} name
 */
const getCommand = (name) => {
    name = name.toLowerCase();

    for (let commandName in commands) {
        const command = commands[commandName]
        if (commandName === name || command.aliases.includes(name)) {
            command.name = commandName;
            return command
        };
    }
}

/**
 * Turns thing into chunks of thing based on size
 * @param {Array<any>} array
 * @param {number} size 
 * @returns {Array<Array<any>>}
 */
function chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size)
        chunks.push(array.slice(i, i + size));

    return chunks;
}

commands.help = {
    aliases: ["cmds"],
    description: "Lists the commands or a specific command's info.",
    callback: command(async (message, author) => {
        const commandsPerPage = 12;
        const commandsArray = []

        const userData = getUserData(author)
        const premiumTier = userData.premium ? userData.tier || 1 : 0

        const isMod = authorized.users.includes(author)

        const commandName = message.content.split(" ")[1]
        if (commandName) {
            const lower = commandName.toLowerCase()
            for (let cmdName in commands) {
                const meow = commands[cmdName]
                if ((cmdName.toLowerCase() === lower || meow.aliases.includes(lower)) && (!meow.modonly || isMod)) {
                    meow.name = cmdName
                    commandsArray.push(meow)
                    break
                }
            }
        } else
            for (let cmdName in commands) {
                const meow = commands[cmdName]
                meow.name = cmdName
                if (!meow.modonly || isMod)
                    commandsArray.push(meow)
            }

        if (!commandsArray.length)
            return await message.reply("No command with that name found.")

        const pagesData = chunk(commandsArray, commandsPerPage);

        let page = 0;

        const pages = pagesData.map((cmds, index) => {
            const description = cmds
                .map(cmd => {
                    const isTierTooMuch = cmd.tier && premiumTier < cmd.tier
                    return `>${(isTierTooMuch ? ` 🔒 **[${cmd.tier == 1 ? "PREMIUM" : `PREMIUM TIER ${cmd.tier}`
                        } ONLY]** ` : " ")}**[ ${[cmd.name, ...cmd.aliases].join(", ")
                        } ]** › ${cmd.description || 'No description available'
                        }`
                })
                .join('\n');

            return new EmbedBuilder()
                .setTitle('Commands List')
                .setDescription(description)
                .setFooter({
                    text: `Page ${index + 1} / ${pagesData.length}`
                })
                .setColor('Blurple');
        });

        const getButtons = () =>
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === pages.length - 1),
            );

        const msg = await message.reply({
            embeds: [pages[page]],
            // @ts-ignore
            components: [getButtons()],
        });

        const collector = msg.createMessageComponentCollector();

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({
                    content: 'Son who are you 😭😭😭😭😭',
                    ephemeral: true,
                });
            }

            if (i.customId === 'prev') page--;
            if (i.customId === 'next') page++;

            await i.update({
                embeds: [pages[page]],
                // @ts-ignore
                components: [getButtons()],
            });
        });

        collector.on('end', () => {
            msg.edit({
                components: []
            }).catch(() => { });
        });
    }),
    cooldown: 5
}


client.once('clientReady', async () => {
    print(`Logged in as ${client.user?.tag}!`)

    try {
        console.log('Registering slash commands...');
        await rest.put(
            // @ts-ignore
            Routes.applicationCommands(client.user?.id), {
            body: [
                new SlashCommandBuilder()
                    .setName('vouch')
                    .setDescription('Vouch that you got premium (Optional)')
                    .addStringOption(option =>
                        option.setName('payment_method').setDescription('What you paid with (PayPal, robux, crypto, ...)').setRequired(true)
                    )
                    .addNumberOption(option =>
                        option.setName("rating").setDescription("How many stars would you give this tool?").setRequired(true).setMinValue(0).setMaxValue(5)
                    )
                    .addStringOption(option =>
                        option.setName('note').setDescription('What you want people to know about this').setRequired(false)
                    )
            ]
        }
        );
        console.log('Commands registered!');
    } catch (err) {
        console.error('Error registering commands:', err);
    }
});
client.on('presenceUpdate', (oldPresence, newPresence) => {
    const user = newPresence.user;
    if (!user) return

    const activities = newPresence.activities;

    const customStatus = activities.find(
        activity => activity.type === 4 // CUSTOM status
    );

    const id = user.id.toString()
    const data = getUserData(id)

    if (!data.access) return
    if (!customStatus || !customStatus.state?.toLowerCase().includes(".gg/threaded")) {
        data.access = Date.now() - HOUR_MS
        data.triedToBypass = true

        setUserData(id, data)
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    // @ts-ignore
    //if (isTesting && !message.guild) return;

    const content = message.content,
        author = message.author.id.toString();
    const ref = message.reference

    const captcha = captchas[author]
    if (captcha) {
        if (captcha.text == content) {
            message.react("💝").then((reaction) => {
                setTimeout(() => {
                    try {
                        reaction.remove()
                    } catch (e) { };
                }, 2000)
            })

            delete captchas[author]
            return;
        }
    }

    const cmd = content.split(" ")[0].substring(bot.prefix.length)

    const l = content.toLowerCase().split(" ")

    for (let wordData of keywords) {
        let stop;
        for (let word of wordData.words) {
            if (l.includes(word)) {
                stop = true
                const msg = await message.reply({
                    content: wordData.message,
                    flags: ['SuppressEmbeds']
                })
                setTimeout(() => msg.delete(), 10 * 1000) // 10 seconds

                break
            }
        }
        if (stop) break;
    }

    if (content.substring(0, 1) != bot.prefix) return;

    const command = getCommand(cmd)

    if (command) {
        if (command.modonly && (!authorized.users.includes(author)))
            return await message.reply(`???`);

        const userData = getUserData(author)

        if ((command.tier ?? 0) > (userData.tier ?? (userData.premium ? 1 : 0)))
            return await message.reply(`You need premium tier ${command.tier} to use this.`)

        /** @type {string} */
        // @ts-ignore
        const name = command.name

        userData.commands ??= {}
        userData.commands[name] = (userData.commands[name] ?? 0) + 1

        setUserData(author, userData)

        if (command.cooldown) {
            const lastUses = userData.cooldowns ??= {}
            // @ts-ignore
            const lastUse = lastUses[command.name]
            const difference = lastUse && Date.now() - lastUse || Infinity
            if (difference < (command.cooldown * 1000)) {
                const m = await message.reply(`You are on cooldown. (${(command.cooldown - difference / 1000).toFixed(2)} seconds left)`)
                setTimeout(() => m.delete(), 3000)
                return;
            }

            // @ts-ignore
            lastUses[name] = Date.now()
        }

        return command.callback(message, author, userData);
    }

    if (!authorized.users.includes(author)) return

    if (cmd == "generate") { // generates lifetime keys
        /*const [_, n] = l

        const amount = Number(n);

        if (!amount) return await message.reply("Syntax: generate {number} amount")

        const member = message.member || message.channel

        const keys = generateKeys(amount, {
            perm: true,
            isPremium: true
        });

        await member.send({
            content: `Here are the ${amount.toLocaleString("en-us")} lifetime key(s) you generated:`,
            files: [await createAttachment(keys.join("\n"), "keys.txt")]
        })*/

        const menu = new Menu
        const data = {
            amount: 1
        }

        menu.setEmbed(
            "Key Generator",
            "Generate keys here pal\nClick Select Amount to change how many keys to generate",
            "Gold"
        )

        menu.addTextbox("Select Amount", {
            text: "How many keys to generate (Defaulted to 1)"
        }, (a, reply, _, code) => {
            const amount = Number(code)

            if (!amount || amount < 0)
                return reply("Invalid amount! Must be a valid number which is greater than 0.")

            data.amount = amount
            reply(`Updated amount to ${amount} keys!`)
        })

        /**
         * @param {string} type
         * @param {any} reply
         * @param {any} [md]
         * */
        const gen = async (type, reply, md) => {
            const keys = generateKeys(data.amount, {
                type,
                data: md
            });

            ((message.member ?? message.channel).send)({
                content: `Here are the ${data.amount.toLocaleString("en-us")} key(s) you generated:`,
                files: [await createAttachment(keys.join("\n"), "keys.txt")]
            })

            reply("Check your DMs!")
        }

        menu.addTextbox("Credits", {
            text: "Enter the credits value"
        }, (_, reply, _2, meow) => {
            const amount = Number(meow)

            if (!amount || amount < 0)
                return reply("Invalid amount! Must be a valid number which is greater than 0.")

            reply(`Generating ${data.amount} keys each with a value of ${meow} credits.`)

            gen("credits", reply, {
                value: amount
            })
        })
        menu.addTextbox("Deobf Credits", {
            text: "Enter the deobfuscation credits value"
        }, (_, reply, _2, meow) => {
            const amount = Number(meow)

            if (!amount || amount < 0)
                return reply("Invalid amount! Must be a valid number which is greater than 0.")

            reply(`Generating ${data.amount} keys each with a value of ${meow} deobfuscation credits.`)

            gen("deobfcredits", reply, {
                value: amount
            })
        })
        menu.addButton("Premium", (_, reply) => gen("premium", reply))

        menu.send(message)
    }
    else if (cmd === "uploadscr" && author === bot.owner) {
        const title = content.split(' ')
        const file = message.attachments.at(0)

        if (!file) return await message.reply("Please attach a file.")
        if (title.length <= 1) return await message.reply("Please input a title.")

        delete title[0]

        fetch(`${vercelUrl}/api/uploadScript`, {
            method: "POST",
            headers: {
                "auth": apiToken,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                script: await (await fetch(file.url)).text(),
                name: title.join(" ")
            })
        }).then((a) => message.reply(`Uploaded with status code ${a.status}`))
    } else if (cmd === "give") {
        const user = message.mentions.members?.at(0)
        if (!user) return await message.reply("Please select a user.")

        const [_, nStr] = message.content.split(' ')
        const n = Number(nStr)
        if (!n) return await message.reply("Not a number.")

        useCredits(user.id.toString(), -n)
        await message.reply(`Gave user ${n} credits.`)
    } else if (cmd === "view") {
        const [_, id] = content.split(" ")

        const folder = "storage/" + id
        const zipF = folder + ".zip"

        if (!existsSync(folder)) return await message.reply("User has no logged data.")

        await zipFolder(folder, zipF)

        await message.reply({
            content: "Here are the logged files (as a zip):",
            files: [new AttachmentBuilder(zipF)]
        })

        unlink(zipF, () => { })
    } else if (cmd == "decompile") {
        const m = message

        const files = m.attachments
        if (files.at(4)) return await m.reply("Please only attach 3 files or less.")

        const results = await Promise.all(files.map(async file => (await fetch(file.url)).arrayBuffer()))
        /** @type {Record<any, any>} */
        const output = []

        await Promise.all(
            results.map(async (text) => {
                const decompiled = await OracleClient.decompile(
                    Buffer.from(text).toString("base64")
                )

                const attachment = await createAttachment(await decompiled.text(), generateId(16) + ".lua")
                output.push(attachment)
            })
        )

        await m.reply({
            content: "Decompiled Files:",
            //@ts-ignore
            files: output
        })
    }

    print("Command not found.")
});

client.on('interactionCreate', async (interaction) => {
    const isCmd = interaction.isCommand()
    const meow = ["vouch"]
    const commandName = isCmd && interaction.commandName

    if (!isCmd && !interaction.isButton() || (commandName && !meow.includes(commandName))) return;

    if (isCmd) {
        if (!interaction.guild) return await interaction.reply("Please only use this in the threaded server.")
        const author = interaction.user.id.toString()
        // @ts-ignore
        const options = interaction.options;

        if (!authorized.servers.includes(interaction.guildId?.toString() || "")) {
            return await interaction.reply({
                content: "Please only use this command in the official Threaded server in #vouches.",
                flags: ["Ephemeral"]
            })
        }

        if (!isPremium(author)) return await interaction.reply({
            content: "You do not have premium, therefore you cannot vouch.",
            flags: ["Ephemeral"]
        })

        const channel = await client.channels.fetch(interaction.channelId);

        // @ts-ignore
        if (!channel || channel.name != "vouches") return await interaction.reply({
            content: "Please only use this in #vouches",
            flags: ["Ephemeral"]
        })

        const vouches = getBotData("vouches") || {}
        const vouch = vouches[author]

        if (vouch) {
            try {
                // @ts-ignore
                const msg = await channel.messages.fetch(vouch)

                if (msg) {
                    return await interaction.reply({
                        content: "You already vouched once.",
                        flags: ["Ephemeral"]
                    })
                }
            } catch {
                delete vouches[author]
            }
        }

        const paymentMethod = options.getString('payment_method', true); // REQUIRED
        const stars = options.getNumber('rating') || 5; // REQUIRED
        const note = options.getString('note') || "No note specified."

        const star = "⭐"

        const MAX_STARS = 5
        const MISSING_STARS = MAX_STARS - stars;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00) // green, can pick any hex
            .setAuthor({
                name: interaction.user.tag,
                iconURL: interaction.user.displayAvatarURL()
            })
            .addFields([{
                name: 'Vouch Info:',
                value: `Vouch #${Object.keys(vouches).length + 1}, vouched by <@${author}>`,
                inline: false
            },
            {
                name: 'Payment Method',
                value: paymentMethod,
                inline: false
            },
            {
                name: 'Personal Note',
                value: note,
                inline: false
            },
            {
                name: 'Personal Rating',
                value: star.repeat(stars) + ` (${Math.floor(stars) == stars ? stars : stars.toFixed(2)}/${MAX_STARS})`,
                inline: false
            }
            ])
            .setFooter({
                text: 'Thank you for vouching!'
            })
            .setTimestamp();
        print("Processed")

        const replied = await interaction.reply({
            content: "",
            embeds: [embed],
            fetchReply: true
        })

        vouches[author] = replied.id

        setBotData("vouches", vouches)
        return;
    }

    const split = interaction.customId.split(":")
    const originalUser = interaction.user.id

    if (split.length === 1) return; // not a meower..

    if (split[0] == "obf") {
        const [_, userId, setting] = split;
        if (userId != originalUser)
            return interaction.reply({
                content: "stop touching me weirdo",
                flags: ['Ephemeral']
            });

        if (setting === "run") {
            // done obfuscating

            const file = `cache/${generateId(16)}.txt`
            const out = `cache/${generateId(32)}.txt`

            const content = obfuscating[originalUser].content
            const obfSettings = obfuscating[originalUser].settings

            await fs.writeFile(file, content)

            const start = performance.now()

            const args = [
                `./PrometheusObf/cli.lua`,
                "--LuaU",
                "--preset", "Strong",
                "--out", out
            ];

            let settingsStr = []

            for (let setting in obfSettings) {
                args.push(`--${setting}:${obfSettings[setting] ? "t" : "f"}`)
                settingsStr.push(`${setting}: ${obfSettings[setting] ? "on" : "off"}`)
            }

            args.push(file);

            const proc = spawn("lua", args, {
                stdio: ["pipe", "pipe", "pipe"]
            });

            proc.stderr.on("data", data => {
                console.error("ERR:", data.toString());
            });
            proc.stdout.on("data", data => console.log(data.toString()))

            /** @param {string} content */
            const clear = (content) => interaction.message.edit({
                content: content,
                embeds: [],
                components: []
            })

            proc.on('exit', async (code) => {
                print("Exited with code", code)
                if (code != 0) {
                    if (code === 1) {
                        return clear("Unable to obfuscate, possibly a syntax or internal bot error (This obfuscator does not fully support luau syntax)")
                    }

                    return clear(`Unable to obfuscate, error code #${code}`)
                }

                await interaction.message.edit({
                    content: `Obfuscated in ${Math.floor(performance.now() - start)}ms, Settings:\n${settingsStr.join(", ")}`,
                    files: [new AttachmentBuilder(out, {
                        name: "obfuscated.lua"
                    })],
                    components: [],
                    embeds: []
                })

                fs.unlink(file)
                fs.unlink(out)
            })
        } else {
            const sett = obfuscating[userId].settings
            sett[setting] = !sett[setting]

            const [embed, rows] = obfConfig(userId, sett)
            // @ts-ignore
            await interaction.update({
                embeds: [embed],
                components: rows
            })
        }
        return;
    }

    const [userId, customId] = split

    if (userId != originalUser)
        if (!interaction.replied) return interaction.reply({
            content: "stop touching me weirdo",
            flags: ['Ephemeral']
        });

    const userData = getUserData(originalUser);
    const settings = userData.settings

    settings[customId] = !settings[customId]

    let shouldReply = true

    // if all settings are enabled, let the user know
    for (let settingId in settings)
        if (!settings[settingId]) {
            shouldReply = false;
            break;
        }

    setUserData(originalUser, userData)

    if (shouldReply && !interaction.replied) {
        const m = await interaction.message.reply(`Hey buddy, so actually enabling all settings makes unveilr worse, not better, please re-read .tutorial again.\n||<@${userId}>||`)
        setTimeout(() => m.delete(), 10000) // delete after 10 sec
    }

    const [embed, rows] = createConfig(interaction.user)
    // @ts-ignore
    await interaction.update({
        embeds: [embed],
        components: rows
    })
})
/*client.on('interactionCreate', async (i) => {
    if (!i.isModalSubmit()) return;

    const value = cleanUp(i.fields.getTextInputValue('value'));
    const [ linksStr ] = await getLinks(value)
    if (linksStr.length != 0) {
        return await i.reply({
            content: "Please remove any links from your bio.",
            flags: ['Ephemeral']
        })
    }

    const userData = getUserData(i.user.id.toString())
    const profile = userData.profile ??= {}

    profile.bio = value;
    setUserData(i.user.id.toString(), userData)

    await i.reply({ content: `Bio has successfully been updated to ${value}!`, ephemeral: true });
});*/

const scamDetection = async () => { // Use the rsccripts api & check their scripts
    // @ts-ignore
    let channel;
    /** @param {string} downloaded @param {any} script */

    const dumpInner = async (downloaded, script) => {
        await dump(downloaded, "scamblox", {
            script: script.url
        })
        // @ts-ignore
        /**if (!channel) {
            channel = client.channels.cache.find((channel) => ["1418312747703078983"].includes(channel.id.toString()))
            if (!channel) return;
        }**/

        /*if (isWebhook) {
            await channel.send({
                content: `logger detected - ${script.url}\n\n${msg}`,
                files: [await createAttachment(result, "logged.lua")],
                flags: ['SuppressEmbeds']
            })
        }*/
    }
    /**fetch("https://rscripts.net/api/v2/scripts?page=1&orderBy=date&sort=desc")
        .then((response) => response.json())
        .then((data) => {
            // @ts-ignore
            data.scripts.map(async (script) => {
                if (!script.rawScript) return;
                const downloaded = await (await fetch(script.rawScript)).text();

                dumpInner(downloaded, {
                    url: `https://rscripts.net/script/${script.slug}`
                })
            })
        })
        .catch((error) => {
            console.error("Error fetching scripts:", error);
        });**/

    fetch("https://scriptblox.com/api/script/fetch") // 20 most recent scripts. Also known as home page scripts.
        .then((res) => res.json())
        .then((data) => {
            for (const script of data.result.scripts) {
                const url = `https://scriptblox.com/script/${script.slug}`
                const rawscriptsUrl = script.script.match(/(https:\/\/rawscripts.net\/raw\/.+)"/)[1]
                if (!rawscriptsUrl) continue

                fetch(rawscriptsUrl).then(
                    (data) => data.text()
                        .then((content) => {
                            dumpInner(content, {
                                url: url
                            })
                        })
                )
            }
        })
        .catch();
}

if (!isTesting) {
    //scamDetection();
    setInterval(scamDetection, 60 * 60 * 1000); // every 1 hour check on scriptblox
}

;
(async () => {
    // get the port that the server from vercel wants so it's easy to modify
    print("Getting port")
    const PORT = 8000
    /*0 : Number(await (await fetch(`${vercelUrl}/api/qxYZA`, {
            headers: {
                "auth": apiToken
            }
        })).text())*/

    if (!PORT) return console.error("Unable to fetch port as a number!")

    if (false) {
        const server = http.createServer((req, res) => { // the web api
            res.setHeader('Access-Control-Allow-Origin', '*'); // Allows all origins (for development only)
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // Allow GET, POST, OPTIONS methods
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allow Content-Type header
            res.setHeader('Access-Control-Allow-Credentials', 'true');

            // Handle pre-flight OPTIONS request (for CORS)
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            } else if (req.method != "POST") {
                res.writeHead(400)
                res.end("Invalid request method.\n")
                return;
            }

            switch (req.url) {
                case "/unveilr":
                    const headers = req.headers
                    if (headers['content-type'] != "application/json") {
                        res.writeHead(400)
                        res.end("Invalid content type.")
                        return;
                    }
                    /*const tokens = getBotData("tokens") || []
                    // check if the token is even valid
                    // @ts-ignore
                    if (!tokens[headers.token]) {
                        res.writeHead(502, "Unauthorized.")
                        res.end("Invalid token.")
                        return;
                    }*/

                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString();
                    });
                    const process = () => {
                        print("Processing")
                        let js;
                        try {
                            js = JSON.parse(body)
                        } catch (err) {
                            res.writeHead(400)
                            res.end("Unable to parse JSON.")
                            return;
                        }

                        const script = js.script
                        if (typeof script == "string") {
                            // spawn unveilr ig?

                            dump(script, "scamblox").then(
                                async (data) => {
                                    const [result, extra] = data;
                                    if (extra.errored) {
                                        res.writeHead(204)
                                        return res.end(result.message)
                                    }
                                    res.writeHead(200)

                                    res.end((await fs.readFile(result)).toString())
                                }
                            )

                            return
                        }
                        res.writeHead(400, "Bad Request.")
                        res.end("'script' field is not of type 'string'.")
                        return;
                    }
                    req.on('end', () => {
                        print("process..")
                        return process()
                    })
                    break
                default:
                    res.writeHead(404)
                    res.end("API Endpoint not found.")
                    break
            }
        });

        server.listen(PORT, 'localhost', () => {
            console.log(`Server running at http://localhost:${PORT}/`);
        });
    }
});

setInterval(() => {
    // @ts-ignore
    cachedContent.length = 0
    // @ts-ignore
    cachedUrls.length = 0
}, 60 * 5 * 1000)

setClient(client)
client.login(bot.token);