import random
import discord
from discord.utils import escape_mentions
from discord import CustomActivity
from datetime import timedelta,datetime
from collections import defaultdict
from json import loads,dumps
import asyncio
from asyncio import sleep
import re
import bypass
import os
from base64 import b64encode,b64decode
import time # yeah 
import requests
#from onlyfans import onlyfans,fansly,discord_reply
import threading
from shutil import move as file_move
import tempfile
from PIL import Image, ImageDraw, ImageFont, ImageColor
import io
import licensing
#from util import *
from discord.ui import Button, View, Select
from hashlib import sha256
import aiohttp
import ssl, certifi
import urllib.parse
#from obf_detect import detect_obf

is_localhost=False

ssl_context = ssl.create_default_context(cafile=certifi.where())
ownerid = 1123674631266639914
ApiToken = "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"
intents = discord.Intents.all()

tag_access=[]
sent_conflict_msg={}

def get_roles(id):
    crack_g = client.get_guild(1306714913539887237)
    if crack_g:
        member = crack_g.get_member(id)
        if member:
            return member.roles
    return []
class RetardCommands:
    def __init__(self):
        self.commands = {}
        self.users = defaultdict(int)
    
    # def add_command(self, name, description, func, cooldown:int=5, **channelid:int):
    #     self.commands[name] = {
    #         'description': description,
    #         'func': func,
    #         'cooldown': cooldown,
    #         'channelid': channelid
    #     }
    
        
    def is_cd(self,id,cmdcd):
        currenttime=time.time()
        if self.users[id] and self.users[id]>currenttime: #why didnt you into the command name
            return True
        self.users[id]=currenttime+cmdcd
    async def handle_command(self, msg: discord.Message):
        command_name = len(msg.content.split())!=0 and msg.content.split()[0]
        if msg.author.id !=client.user.id and command_name and command_name in self.commands:
            command=self.commands[command_name]
            if self.is_cd(msg.author.id,"cooldown" in command and command["cooldown"] or 4):
                await softerror(msg, f"Youre currently on cooldown! Please wait {round(self.users[msg.author.id]-time.time(),2)}s")
                return
            elif 'allow_channels' in command and msg.channel.id in command['allow_channels']:
                pass
            elif  'channelid' in command and command['channelid'] != msg.channel.id:
                await softerror(msg,f"You can only use this command in <#{command['channelid']}>")
                return
            elif "roles" in command:
                if not any(role.id in command['roles'] for role in get_roles(msg.author.id)):
                    await softerror(msg,f'You dont have permissions to use this command')
                    return
            if msg.channel.id==1351444142852411454 and not msg.author.id in [1123674631266639914,713113056346898522] and command_name!="meow":
                await softerror(msg,"Please use commands like this in dms with me!")
            await command['func'](msg)
            return True
            

command_manager = RetardCommands()


class RenameLuaView(View):
    def __init__(self, lua_path: str, luac_path: str, requester_id: int):
        super().__init__(timeout=30)
        self.lua_path = lua_path
        self.luac_path = luac_path
        self.requester_id = requester_id
        self.renamed = False
        self.message = None

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.requester_id:
            await interaction.response.send_message("This is not your message.", ephemeral=True)
            return False
        return True
    @discord.ui.button(label="rename", style=discord.ButtonStyle.primary)
    async def rename_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if self.renamed:
            await interaction.response.send_message("Already being renamed.", ephemeral=True)
            return
        random_id=random.random()
        self.renamed=random_id
        await asyncio.sleep(random_id/10)
        if self.renamed!=random_id:
            await interaction.response.send_message("Already being renamed", ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)

        stem = os.path.splitext(os.path.basename(self.lua_path))[0]
        renamed_path = os.path.join(os.path.dirname(self.lua_path), f"{stem}_rename.lua")
        success = await makeit_rename(self.lua_path, renamed_path)

        if not success or not os.path.isfile(renamed_path):
            print(success,os.path.isfile(renamed_path))
            await interaction.followup.send("Failed to rename the file.", ephemeral=True)
            return

        attachments = []
        try:
            attachments.append(discord.File(renamed_path))
            if self.luac_path and os.path.isfile(self.luac_path):
                attachments.append(discord.File(self.luac_path))
        except Exception as er:
            print(f"rename_button attachment error: {er}")
            await interaction.followup.send("Failed to load renamed file.", ephemeral=True)
            return

        try:
            await interaction.message.edit(attachments=attachments, view=None)
        except Exception as er:
            print(f"rename_button edit error: {er}")
            await interaction.followup.send("Failed to update the message.", ephemeral=True)
            return

        self.renamed = True
        await interaction.followup.send("Success", ephemeral=True)
        self.stop()

    async def on_timeout(self) -> None:
        if not self.renamed and self.message:
            try:
                await self.message.edit(view=None)
            except Exception as er:
                print(f"RenameLuaView timeout edit error: {er}")
        self.stop()
darklua_user_settings = defaultdict(dict)
try:
    loaded_darklua = loads(open("darklua_usersettings.json").read())
    for user_id in loaded_darklua:
        darklua_user_settings[int(user_id)] = loaded_darklua[user_id]
except:
    pass

async def save_darklua_settings():
    try:
        with open("darklua_usersettings.json", "w") as f:
            f.write(dumps(darklua_user_settings))
    except Exception as e:
        print(f"Error saving darklua settings: {e}")

class DarkluaConfigView(View):
    def __init__(self, user_id: int, filename: str):
        super().__init__(timeout=300)
        self.user_id = user_id
        self.filename = filename
        
        # Load user's saved settings or use defaults
        user_config = darklua_user_settings.get(user_id, {
            "generator": "readable",
            "column_span": 80,
            "selected_rules": []
        })
        
        self.generator = user_config.get("generator", "readable")
        self.column_span = user_config.get("column_span", 80)
        self.selected_rules = user_config.get("selected_rules", [])
        
        # All available darklua rules
        self.available_rules = [
            "compute_expression",
            "remove_unused_while",
            "remove_unused_if_branch",
            "remove_nil_declaration",
            "convert_index_to_field",
            "remove_comments",
            "remove_method_definition",
            "remove_spaces",
            "remove_types",
            "remove_unused_variable",
            "remove_function_call_parens",
            "remove_empty_do",
            "remove_compound_assignment",
            "remove_continue",
            "remove_if_expression",
            "remove_interpolated_string",
            "remove_floor_division",
            "filter_after_early_return",
            "group_local_assignment",
            "rename_variables",
        ]
        
        self.processing = False
        
        # Add rule selection dropdown
        self.add_item(self.RuleSelect(self))
        
        # Add generator buttons
        self.add_item(self.GeneratorButton("readable", self))
        self.add_item(self.GeneratorButton("dense", self))
        self.add_item(self.GeneratorButton("retain_lines", self))
        
        # Add column span input and unlimited button
        self.add_item(self.ColumnInputButton(self))
        self.add_item(self.UnlimitedColumnButton(self))
        
        # Add apply button
        self.add_item(self.ApplyButton(self))

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("This is not your configuration.", ephemeral=True)
            return False
        return True

    def _save_config(self):
        """Save current configuration to user settings"""
        darklua_user_settings[self.user_id] = {
            "generator": self.generator,
            "column_span": self.column_span,
            "selected_rules": self.selected_rules
        }
        # Save to file asynchronously would be better, but sync is simpler here
        import asyncio
        asyncio.create_task(save_darklua_settings())

    def get_content(self):
        return "select your darklua configuration"

    class RuleSelect(Select):
        def __init__(self, view):
            self.view_ref = view
            options = [
                discord.SelectOption(
                    label=rule, 
                    value=rule,
                    default=rule in view.selected_rules
                )
                for rule in view.available_rules[:25]  # Discord limit
            ]
            super().__init__(
                placeholder="Select rules to apply...",
                min_values=0,
                max_values=len(options),
                options=options
            )

        async def callback(self, interaction: discord.Interaction):
            self.view_ref.selected_rules = list(self.values)
            self.view_ref._save_config()
            
            # Update the dropdown to reflect new selections
            for option in self.options:
                option.default = option.value in self.view_ref.selected_rules
            
            await interaction.response.edit_message(
                content=self.view_ref.get_content(),
                view=self.view_ref
            )

    class GeneratorButton(Button):
        def __init__(self, generator: str, view):
            self.generator_type = generator
            self.view_ref = view
            style = discord.ButtonStyle.primary if view.generator == generator else discord.ButtonStyle.secondary
            super().__init__(label=f"Gen: {generator}", style=style, row=1)

        async def callback(self, interaction: discord.Interaction):
            self.view_ref.generator = self.generator_type
            self.view_ref._save_config()
            # Update all generator buttons
            for item in self.view_ref.children:
                if isinstance(item, DarkluaConfigView.GeneratorButton):
                    item.style = discord.ButtonStyle.primary if item.generator_type == self.generator_type else discord.ButtonStyle.secondary
            await interaction.response.edit_message(
                content=self.view_ref.get_content(),
                view=self.view_ref
            )

    class ColumnInputButton(Button):
        def __init__(self, view):
            self.view_ref = view
            col_display = "unlimited" if view.column_span >= int(9e9) else str(view.column_span)
            super().__init__(label=f"Column: {col_display}", style=discord.ButtonStyle.primary, row=2)

        async def callback(self, interaction: discord.Interaction):
            modal = DarkluaConfigView.ColumnModal(self.view_ref, self)
            await interaction.response.send_modal(modal)

    class ColumnModal(discord.ui.Modal, title="Set Column Span"):
        def __init__(self, view, button):
            super().__init__()
            self.view_ref = view
            self.button_ref = button
            
            current_val = "" if view.column_span >= int(9e9) else str(view.column_span)
            self.column_input = discord.ui.TextInput(
                label="Column Span",
                placeholder="Enter a number (e.g., 80, 120)",
                default=current_val,
                required=True,
                max_length=10
            )
            self.add_item(self.column_input)

        async def on_submit(self, interaction: discord.Interaction):
            try:
                value = int(self.column_input.value)
                if value <= 0:
                    await interaction.response.send_message("Column span must be positive!", ephemeral=True)
                    return
                
                self.view_ref.column_span = value
                self.view_ref._save_config()
                
                # Update button label
                self.button_ref.label = f"Column: {value}"
                
                # Update unlimited button style
                for item in self.view_ref.children:
                    if isinstance(item, DarkluaConfigView.UnlimitedColumnButton):
                        item.style = discord.ButtonStyle.secondary
                
                await interaction.response.edit_message(
                    content=self.view_ref.get_content(),
                    view=self.view_ref
                )
            except ValueError:
                await interaction.response.send_message("Please enter a valid number!", ephemeral=True)

    class UnlimitedColumnButton(Button):
        def __init__(self, view):
            self.view_ref = view
            style = discord.ButtonStyle.primary if view.column_span >= int(9e9) else discord.ButtonStyle.secondary
            super().__init__(label="∞", style=style, row=2)

        async def callback(self, interaction: discord.Interaction):
            self.view_ref.column_span = int(9e9)
            self.view_ref._save_config()
            
            # Update button styles
            self.style = discord.ButtonStyle.primary
            for item in self.view_ref.children:
                if isinstance(item, DarkluaConfigView.ColumnInputButton):
                    item.label = "Column: unlimited"
            
            await interaction.response.edit_message(
                content=self.view_ref.get_content(),
                view=self.view_ref
            )

    class ApplyButton(Button):
        def __init__(self, view):
            self.view_ref = view
            super().__init__(label="Apply", style=discord.ButtonStyle.success, row=3)

        async def callback(self, interaction: discord.Interaction):
            if self.view_ref.processing:
                await interaction.response.send_message("Already processing...", ephemeral=True)
                return
            
            self.view_ref.processing = True
            await interaction.response.defer()
            
            filepath = f"./dumps/beautify/{self.view_ref.filename}"
            
            try:
                # Apply darklua with selected configuration
                await applydarklua(
                    filepath,
                    self.view_ref.selected_rules,
                    {
                        "name": self.view_ref.generator,
                        "column_span": self.view_ref.column_span
                    }
                )
                
                # Send the processed file
                await interaction.followup.send(
                    "Darklua processing complete!",
                    file=discord.File(filepath)
                )
                
                # Disable all buttons
                for item in self.view_ref.children:
                    item.disabled = True
                
                await interaction.message.edit(
                    content=self.view_ref.get_content(),
                    view=self.view_ref
                )
                
                self.view_ref.stop()
                
            except Exception as e:
                await interaction.followup.send(f"Error processing file: {str(e)}", ephemeral=True)
                self.view_ref.processing = False

    async def on_timeout(self):
        for item in self.children:
            item.disabled = True
        if hasattr(self, 'message') and self.message:
            try:
                await self.message.edit(view=self)
            except:
                pass


# Add this command function
async def darklua_gui_cmd(msg):
    filename = await getfile(msg, "./dumps/beautify/")
    if not filename:
        return
    
    view = DarkluaConfigView(msg.author.id, filename)
    sent_msg = await msg.reply(content=view.get_content(), view=view)
    view.message = sent_msg
async def say_command(msg: discord.Message):
    
    texttosay = msg.content[len('.say '):]  #oh
    texttosay = escape_mentions(texttosay)
    await msg.reply(texttosay)

async def help_command(msg: discord.Message):
    roles=get_roles(msg.author.id)
    help_message = 'Commands:\n```ansi\n'
    help_message +="\n".join(
        f'- [2;35m{command}[0m -> {info["description"]}'
        for command,info in command_manager.commands.items()
        if not "roles" in info or any(role.id in info['roles'] for role in roles))
    help_message+="\n```"
    await msg.reply(help_message)
async def nonfunc(msg):
    pass
async def makeit_rename(inpath,outpath):
    try:
        with open(inpath, "r", encoding="utf-8", errors="replace") as infile:
            code = infile.read()
    except Exception as er:
        print(f"makeit_rename read fail: {er}")
        return False

    if not code:
        print("makeit_rename: no code content provided")
        return False

    try:
        response = await bypass.asyncpost(
            "https://renamer-api.vercel.app/api/rename",
            {"code": code},
            headers={
                "x-api-key": "33ms-DHJHS-24633",
                "Content-Type": "application/json"
            }
        )
    except Exception as er:
        print(f"makeit_rename request fail: {er}")
        return False
    renamed_code = response and response.get("renamedCode")
    if not renamed_code:
        print(f"makeit_rename: unexpected response {response}")
        return False
    try:
        with open(outpath, "w", encoding="utf-8", newline="\n") as outfile:
            outfile.write(renamed_code)
    except Exception as er:
        print(f"makeit_rename write fail: {er}")
        return False
    try:print("Rename credits left:",response.get("remainingCredits"))
    except:pass
    return True
async def rename_cmd(msg):
    # if msg.author.id != ownerid: # TODO: remove this comment lel
    #     await softerror(msg,"Only the owner can use this command.")
    #     return
    rename_dir = "./dumps/rename/"
    os.makedirs(rename_dir, exist_ok=True)
    filename = await getfile(msg, rename_dir)
    if not filename:
        return
    input_path = os.path.join(rename_dir, filename)
    output_path = os.path.join(rename_dir, f"{os.path.splitext(filename)[0]}_renamed.lua")
    async with msg.channel.typing():
        success = await makeit_rename(input_path, output_path)
    if not success or not os.path.isfile(output_path):
        await msg.reply("Renaming failed.")
        return
    try:
        await msg.reply(file=discord.File(output_path))
    except Exception as er:
        print(f".rename send error: {er}")
        await msg.reply("Renamed file is ready but could not be sent. Ping 25ms if you need it.")
async def msdeobf(msg,no_attach_error=True):
    if msg.channel.id==1442240581110861965 and not (msg.attachments or "http" in msg.content):
        await msg.delete()
        return
    result, filename = await luafilehandler(msg,"","./dumps/original/","./dumps/dumped/",msdeobf=True,no_attach_error=no_attach_error)
    print("deobf done")
    if not filename:return
    elif not os.path.isfile(f'./dumps/dumped/{filename}c'):
        if msg.channel.id==1442240581110861965:
            await softerror(msg,"Deobfuscation failed. For non-moonsec v3 scripts use .l in <#1348000639753519205> (its free)",12)
        else:await msg.reply("Deobfuscation failed, make sure you sent a valid moonsec v3 script.")
        return
    process, success = await medal51_decompile_on_file(f'./dumps/dumped/{filename}c',f'./dumps/dumped/{filename}')
    print("decomp done")
    files=[]
    text=f"Here you go twin! <@{msg.author.id}>"
    lua_output_path=None
    if os.path.isfile(f'./dumps/dumped/{filename}'):
        files.append(discord.File(f'./dumps/dumped/{filename}'))
        lua_output_path=f'./dumps/dumped/{filename}'
        await luabeautify(f'./dumps/dumped/{filename}',["remove_comments"])
        webhooks = sexwebhooks(msg,'./dumps/dumped/' + filename,True)
    else:
        text="Deobfuscated to luac. To decompile use your decompiler of choice, free option: https://luadec.metaworm.site/"
        # print("msdeobf error:\n" + (process.stderr if process else ""))
    files.append(discord.File(f'./dumps/dumped/{filename}c'))
    rename_view=None
    target_role=1373857675497963601
    if lua_output_path and any(role.id==target_role for role in get_roles(msg.author.id)):
        rename_view=RenameLuaView(lua_output_path,f'./dumps/dumped/{filename}c',msg.author.id)
    try:
        sent_msg=await msg.reply(text,files=files,view=rename_view)
        if rename_view:
            rename_view.message=sent_msg
    except:
        pass
async def luaobf_deobf(msg):
    result, filename = await luafilehandler(msg,"badluaobf.lua","./dumps/original/",lune=True)
    if not result or not filename:
        return
    elif result and "success" in result.stdout:
        try:
            await applydarklua('./dumps/dumped/' + filename,[
                "compute_expression",
                "remove_unused_while",
                "remove_unused_if_branch",
                "remove_nil_declaration",
                "convert_index_to_field"
        ])
            await luabeautify('./dumps/dumped/' + filename)
        except Exception as er:
            print("beauty error",er)
        webhooks=sexwebhooks(msg,'./dumps/dumped/' + filename,True)
        file = discord.File('./dumps/dumped/' + filename)
        await msg.reply(webhooks,file=file)
    else:
        await msg.reply(f"`This only works for luaobfuscator's string encryption (\"Chaotic Good\")`")
        print("Deobf error:\n"+result.stderr)
async def solara_cmd(msg):
    info = bypass.getsolarainfo()
    rblxinfo = bypass.getrobloxversioninfo()
    await msg.reply(f'Download: {info["BootstrapperUrl"]}\n{(info["SupportedClient"]==rblxinfo["clientVersionUpload"] and ":white_check_mark: Solara is currently updated") or ":broken_heart: Solara is currently **NOT** updated"}\nChangelog:```diff\n{info["Changelog"].replace("[+]","+").replace("[-]","-")}```')
async def beautify_cmd(msg):
    print("hi0")
    filename = await getfile(msg,f"./dumps/beautify/")
    print("hi")
    if filename:
        if await luabeautify(f"./dumps/beautify/{filename}",[
            "compute_expression"
        ]):
            file = discord.File(f"./dumps/beautify/{filename}")
            await msg.reply(file=file)
        else:
            await msg.reply("`Unable to beautify`")
    else:
        print("unable to get file heh")
async def minify_cmd(msg):
    filename = await getfile(msg,"./dumps/beautify/")
    if filename:
        if await applydarklua(f"./dumps/beautify/{filename}",[
            "convert_index_to_field",
            "compute_expression",
            # "convert_luau_number",
            "filter_after_early_return",
            "group_local_assignment",
            "remove_comments",
            "remove_method_definition",
            "remove_nil_declaration",
            "remove_spaces",
            "remove_types",
            "remove_unused_if_branch",
            "remove_unused_variable",
            "remove_unused_while",
            "remove_function_call_parens",
            {
                "rule": "rename_variables",
                "globals": ["$default", "$roblox"],
            },
        ],{ "name": "dense", "column_span": int(9e9) }):
            file = discord.File(f"./dumps/beautify/{filename}")
            await msg.reply(file=file)
        else:
            await obfhandler(msg)
            # await msg.reply("`Unable to minify`")
def lzw_compress(s: bytes) -> str:
    dictionary = {bytes([i]): bytes([i, 0]) for i in range(256)}
    a, b = 0, 1
    def nextcode():
        nonlocal a, b, dictionary
        c = bytes([a, b])
        a += 1
        if a >= 256:
            a = 0
            b += 1
            if b >= 256:
                dictionary = {bytes([i]): bytes([i, 0]) for i in range(256)}
                b = 1
        return c
    w = s[:1]
    out = []
    for c in s[1:]:
        c = bytes([c])
        if w + c in dictionary:
            w = w + c
        else:
            dictionary[w + c] = nextcode()
            out.append(dictionary.get(w, bytes([w[0], 0])))
            w = c
    out.append(dictionary.get(w, bytes([w[0], 0])))
    raw = b"".join(out)
    return raw.hex()
async def compress_cmd(msg):
    filename = await getfile(msg,"./dumps/beautify/")
    if filename:
        await applydarklua(f"./dumps/beautify/{filename}",[
            "convert_index_to_field",
            "compute_expression",
            # "convert_luau_number",
            "filter_after_early_return",
            "group_local_assignment",
            "remove_comments",
            "remove_method_definition",
            "remove_nil_declaration",
            "remove_spaces",
            "remove_types",
            "remove_unused_if_branch",
            "remove_unused_variable",
            "remove_unused_while",
            "remove_function_call_parens",
            {
                "rule": "rename_variables",
                "globals": ["$default", "$roblox"],
            },
        ],{ "name": "dense", "column_span": int(9e9) })
        compressed_code="return(function(a,b,c,d,e)for f=0,255 do a[b(f,0)]=b(f)end function d(f,g,h,i)if h>255 then h=0 i+=1 if i>255 then g={}i=1 end end g[b(h,i)]=f h+=1 return g,h,i end e=({('"+lzw_compress(open(f"./dumps/beautify/{filename}","rb").read())+"'):gsub('..',function(f)return b(tonumber(f,16))end)})[1]local f,g,h,i,j,k,l=#e,{},0,1,{},1,c(e,1,2)j[k]=a[l]or g[l]k+=1 for m=3,f,2 do local n,o=c(e,m,m+1),a[l]or g[l]local p=a[n]or g[n]if p then j[k]=p k+=1 g,h,i=d(o..c(p,1,1),g,h,i)else local q=o..c(o,1,1)j[k]=q k+=1 g,h,i=d(q,g,h,i)end l=n end return loadstring(table.concat(j))end)({},string.char,string.sub)(...)"
        buffer = io.StringIO()
        buffer.write(compressed_code)
        buffer.seek(0)
        await msg.reply(file=discord.File(buffer,"compressed.lua"))
def to_buffer(string=None,raw=None):
    if string:
        buffer = io.StringIO()
        buffer.write(string)
        buffer.seek(0)
        return buffer
    elif raw:
        buffer = io.BytesIO(raw)
        buffer.seek(0)
        return buffer
async def gen_cmd(msg):
    smsg=msg.content.split(" ")
    if smsg==1:
        await msg.reply("You didnt put a prompt you fucking idiot")
        return
    botmsg = await msg.reply("`Generating...`")
    image = await bypass.cloudflare_gen(" ".join(smsg[1:]))
    if image:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
            temp_file.write(image)
            temp_file.seek(0)
            await botmsg.delete()
            await msg.reply(file=discord.File(temp_file.name, "generated_image.png"))
    else:
        await botmsg.delete()
        await msg.reply("`couldn't generate image`")
async def deobfhandler(msg):
    isfullcode=True
    try:print(f"lol {msg.author.name} did {msg.content}")
    except:pass
    randomfilename = await getfile(msg, "./deobfuscate/.in/")
    if not randomfilename:
        return False,False,False
    basename = randomfilename[:-4]
    process1 = await asyncio.create_subprocess_exec(
        *(['node', './index.js', f'./.in/{randomfilename}', f'./.out/{basename}.luac']),
        cwd='./deobfuscate',
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout1, stderr1 = await process1.communicate()
    process1.stdout = stdout1.decode("utf-8")
    process1.stderr = stderr1.decode("utf-8")
    return process1, basename, False
    process2 = await asyncio.create_subprocess_exec(
        './deobfuscate/Luadec51.exe', f'./deobfuscate/.out/{basename}.luac',
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout2, stderr2 = await process2.communicate()
    process2.stdout = stdout2.decode("utf-8")
    process2.stderr = stderr2.decode("utf-8")
    if process2.stdout and not process2.stderr:
        with open("./deobfuscate/.out/" + randomfilename, 'w') as outfile:
            outfile.writelines(process2.stdout.split("\n")[3:])
    else:
        print("result1",process2.stdout)
        process3 = await asyncio.create_subprocess_exec(
            'java','-jar','./deobfuscate/unluac.jar', f'./deobfuscate/.out/{basename}.luac',"-o", f"./deobfuscate/.out/{randomfilename}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout3, stderr3 = await process3.communicate()
        process3.stdout = stdout3.decode("utf-8")
        process3.stderr = stderr3.decode("utf-8")
        if process3.stderr:
            isfullcode=False
    return process1, basename,isfullcode
    # except Exception as er:
    #     return False, er
async def ib2_deobf(msg):
    result, filename,isfullcode = await deobfhandler(msg)
    if not result or not filename:
        print(result,filename)
        return
    elif result and "success" in result.stdout:
        decomp_fail=not os.path.isfile(f'./deobfuscate/.out/{filename}.lua')
        files = []
        if not decomp_fail: files.append(discord.File(f'./deobfuscate/.out/{filename}.lua'))
        files.append(discord.File(f'./deobfuscate/.out/{filename}.luac'))        
        await msg.reply(decomp_fail and "Decompilation failed. Download the luac file and just decompile it at https://luadec.metaworm.site yourself" or (not isfullcode and "*The decompiled code doesnt seem to be complete*\n" or "")+"You can decompile the .luac file at https://luadec.metaworm.site/ for a better result",files=files)
    else:
        await msg.reply(f"`This only works on ironbrew 2`")
        print("Deobf error:\n"+result.stderr)
async def meow_cmd(msg):
    await msg.reply("meow " * random.randint(1,5))
async def luau_decompile_api(filelocation,outpath):
    content=open(filelocation,"rb").read()
    result=await bypass.asyncpost("https://api.lua.expert/decompile",{"script": b64encode(content).decode()},returnResponseJson=False)
    open(outpath,"w").write(result)
    return True
    
async def roblox_decompile_cmd(msg):
    # store inputs/outputs under dumps/decompile like other decompile commands
    decompile_dir = "./dumps/decompile/"
    os.makedirs(decompile_dir, exist_ok=True)
    randomfilename = await getfile(msg, decompile_dir, mode="binary", usehash=True, file_extension=".luac")
    if not randomfilename:
        return
    outpath = f'{decompile_dir}{randomfilename[:-1]}'
    os.makedirs(os.path.dirname(outpath), exist_ok=True)
    process = await asyncio.create_subprocess_exec(
        './medal51/luau-lifter.exe', f'{decompile_dir}{randomfilename}', "-e",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()
    process.stdout = stdout.decode("utf-8")
    process.stderr = stderr.decode("utf-8")
    if process.stderr:
        try:
            if not await luau_decompile_api(f'{decompile_dir}{randomfilename}',outpath):
                raise Exception("Decompilation API failed")
        except Exception as er:
            print(er)
            await msg.reply("Failed 💔")
            return
    else:
        with open(outpath, 'w', encoding='utf-8') as outfile:
            outfile.writelines(process.stdout)

    await luabeautify(outpath,["remove_comments"])
    await msg.reply(file=discord.File(outpath))


async def claim_license(msg):
    if is_localhost: return await msg.reply("Claiming is currently unavailable, try again later")
    # return msg.reply("Licensing system is unavailable, dm 33ms for more info.")
    smsg = msg.content.split(" ")
    if len(smsg) < 2:
        await msg.reply("Please provide a license key")
        return
    key = smsg[1]
    await msg.reply(await licensing.claim(msg.author.id,client,key))
async def dumpConfig_cmd(msg):
    if msg.author.id in malicious_users: return await msg.reply("You are not allowed to use this command anymore :'(")
    embed = discord.Embed(title="Settings for the holy .l")
    embed.add_field(name="Varnames", value="When enabled gives variables names based on context", inline=False)
    embed.add_field(name="usesimplefunctions", value="When enabled doesnt explore found functions", inline=False)
    embed.add_field(name="watchoutforloop", value="Will give the iconic 'infinitelooperror' when it detects repeating code.", inline=False)
    embed.add_field(name="spynilglobals", value="Will spy all globals, even if they might not be defined in a normal env", inline=False)
    embed.add_field(name="hook_op", value='Attempts to hook stuff like "==", "or" (**EXPERIMENTAL**)', inline=False)
    embed.add_field(name="hook_op_default_return", value="Returns either a spy value, the value it would've been by default, true, or false on every hooked opcode", inline=False)
    view = dumpConfig(msg.author)
    await msg.reply(embed=embed, view=view)

async def get_recovery_cmd(msg):
    if not isinstance(msg.channel, discord.DMChannel):
        await softerror(msg,"You can only use this command in dms!")
        return
    await msg.reply(f"||{await licensing.get_recovery(msg.author)}||")
async def cmds_access_cmd(msg):
    user_profile=requests.request("GET", f"https://discord.com/api/v9/users/{msg.author.id}/profile", data="", headers=headers, params={"type":"popout","with_mutual_guilds":"true","with_mutual_friends":"true","with_mutual_friends_count":"false"}).json()["user"]
    if "clan" in user_profile and user_profile["clan"] and "tag" in user_profile["clan"] and user_profile["clan"]["tag"]=="25ms":
        roles= get_roles(msg.author.id)
        if roles and not any(role.id==1385300853526892584 for role in roles):
            tag_access.append(msg.author.id)
            role = client.get_guild(1306714913539887237).get_role(1385300853526892584)
            await msg.author.add_roles(role)
            await softerror(msg,"You have been given the 25ms server tag role!")
        else: await softerror(msg,"You already have the 25ms server tag role!")
    else:
        await softerror(msg,"You need to be using the 25ms tag!")


mv_data=loads(open("mvdata.json").read())
mv_save_in_use=False
async def save_mv_data():
    global mv_save_in_use
    if mv_save_in_use:
        return
    mv_save_in_use=True
    with open("mvdata.json", "w") as f:
        f.write(dumps(mv_data))
    mv_save_in_use=False
async def moonveil_obfuscate(msg):
    if msg.author.id in mv_data and mv_data[msg.author.id] > time.time() - 86400:
        await msg.reply(f"You have already used your free daily obfuscation, wait {seconds_to_str(round((mv_data[msg.author.id] + 86400) - time.time()))} to use it again")
        return
    content=await getfile(msg)
    if not content:
        return
    mv_data[msg.author.id] = time.time()
    await save_mv_data()
    payload = {
        "options": {
            "cffDecomposeExpr": False,
            "cffEnable": True,
            "cffHoistLocals": True,
            "cffWrapBlocks": True,
            "mangleEnable": True,
            "mangleGlobals": True,
            "mangleNamedIndex": True,
            "mangleNumbers": False,
            "mangleSelfCalls": True,
            "mangleStrings": True,
            "prettify": False,
            "removeCompoundAssign": True,
            "removeIfExpr": True,
            "vmEnable": True,
            "vmWrapScript": True
        },
        "script": content
    }
    response=await bypass.asyncpost("https://moonveil.cc/api/obfuscate",payload,headers={
        "Authorization": "Bearer mv-secret-7ce5ffab-57fa-45d7-b621-741f392fc6ff",
        "Content-Type": "application/json",
    },returnResponseJson=False)
    buffer = io.StringIO()
    buffer.write(response)
    buffer.seek(0)
    await msg.reply(file=discord.File(buffer, filename="moonveil.lua"))
async def goofy_fus(msg):
    content=await getfile(msg)
    if not content:
        return
    response=await bypass.asyncpost("https://goofyscator.lua.cz/obfuscate",{
        "source": content,
        "settings": {
            "dontModifyBytecode": True,
            "hexNumbers": True,
            "renameGlobals": False,
            "generator": "Shuffled"
        }
    })
    if response["status"]!="success":
        await msg.reply("Error while obfuscating")
        return
    buffer = io.StringIO()
    buffer.write("--[[ obfuscated @ discord.gg/25ms ]]\n"+response["result"])
    buffer.seek(0)
    await msg.reply(file=discord.File(buffer, filename="goofyscator.lua"))
async def asyncget(url,headers=None,params=None,proxy=None,proxy_auth=None,getjson=False):
    async with aiohttp.ClientSession(
            headers=headers,
        ) as session:
            async with session.get(
                url,
                params=params,
                proxy=proxy,
                proxy_auth=proxy_auth,
                ssl=ssl_context,
            ) as resp:
                if getjson:
                    return await resp.json()
                return await resp.text()
async def asyncpost(url,headers=None,data=None):
    async with aiohttp.ClientSession(
            headers=headers
        ) as session:
            async with session.post(
                url, data=data
            ) as resp:
                return await resp.text()
def _25ms_detect(content):
    regexes={
        r"return [A-z0-9_]+\([0-9A-z_]+\(\),[A-z0-9,_\{\}\)\(]+\)": "ib2 (or similar)",
        r"newproxy,...metatable,...metatable,select,":"prometheus",
        r"\(\[\[This file was protected with MoonSec V3[A-z9_#\s]+\]\]\):gsub\('\.\+', \(function\([A-z0-9_]+\) [A-z0-9_]+":"moonsec v3",
        r"local v0=string\.char;local v1=string\.byte;local v2=string.sub;local v3=bit32 or bit ;local v4=v3\.bxor;local v5=table\.concat;local v6=table\.insert;local function v7":"luaobfuscator.com string enc"
    }
    for pattern, result in regexes.items():
        if re.findall(pattern,content):
            return result
async def detect_cmd(msg): # bro make this an embed 😭
    content = await getfile(msg)
    data = aiohttp.FormData()
    data.add_field(
        name="file",
        value=io.BytesIO(content.encode()),
        filename="input.txt",
        content_type="text/plain",
    )
    result=""
    try:
        raw = await bypass.asyncpost("https://detector.lua.cz/detect",{
            "text": content
        })
        if not raw["ok"]:
            raise Exception("Error")
        probs={}
        for item in raw["top_4"]:
            probs[item["label"]]=item["probability"]
        ordered = sorted(probs.items(), key=lambda x: x[1], reverse=True)
        hits = [(k, v) for k, v in ordered if v >= 0.20]
        use = hits if hits else ordered[:1]
        result+= "## 1xayd1 ai detect\n"+("\n".join(f"{v*100:.2f}% {k}" for k, v in use))
    except Exception as e:
        result += "1xayd1 API: Fail"
    result+="\n"
    try:
        raw = await asyncpost(
            "https://aktheportal.helpso.me/predict",
            headers={"X-API-Key": "25ms120h1donw4t3sdawnfke"},
            data=data
        )
        j = loads(raw)
        probs = j.get("probabilities", {})
        ordered = sorted(probs.items(), key=lambda x: x[1], reverse=True)
        hits = [(k, v) for k, v in ordered if v >= 0.20]
        use = hits if hits else ordered[:1]
        result+= "## Qardruss ai detect\n"+("\n".join(f"{v*100:.2f}% {k}" for k, v in use))
    except Exception as e:
        result = "Qardruss API: Fail (File too big?)"
    result+="\n"
    try:
        ordered=sorted(detect_obf(content).items(), key=lambda x: x[1], reverse=True)
        hits=[(k, v) for k, v in ordered if v >= 0.20]
        use = hits if hits else ordered[:1]
        result+="## y3i6 ai detect\n"+("\n".join(f"{v*100:.2f}% {k}" for k, v in use))
    except Exception as e:
        print(e)
        result+="y3i6 fail"
    _25ms_res=_25ms_detect(content)
    if _25ms_res:
        result="25ms thinks this is **"+_25ms_res+"**, below is ai results\n"+result
    await msg.reply(result)
    asyncio.create_task(send_discord_webhook("https://discord.com/api/webhooks/1487508927292772544/kH064ZNIWKiDetzlMcZBDGGZVnTorua71Fmy9xwk2NNTrr7sVd0X1yN7B8G96sfyhWgh","huge"))

async def obf77fus(msg):
    result, filename = await luafilehandler(msg,"","./unobfuscated/",ssfus=True)
    if not result or not filename:
        return
    elif result and "Done" in result.stdout:
        file = discord.File('./obfuscated/' + filename)
        await msg.reply(file=file)
    else:
        await msg.reply(f"`77fus obfuscation failed`")
        print("Obf error:\n"+result.stderr)
        print(result.stdout)

async def medal51_decompile_on_file(inpath,outpath):
    process = await asyncio.create_subprocess_exec(
        *(["./medal51/lua51-lifter.exe","--file",inpath,"--out",outpath] ),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    try:
        stdout_task = asyncio.create_task(read_stream(process.stdout))
        stderr_task = asyncio.create_task(read_stream(process.stderr))
        await asyncio.wait_for(process.wait(), timeout=40)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        process.stdout = await stdout_task
        process.stderr = await stderr_task
        return process,False
    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
    process.stdout = await stdout_task
    process.stderr = await stderr_task
    return process, True
async def medal51_cmd(msg):
    filename = await getfile(msg, "./dumps/decompile/", mode="binary", usehash=True, file_extension=".luac")
    print(filename)
    if not filename:
        return
    outfilepath = f'./dumps/decompile/{filename[:-5]}_medal51.lua'
    process, success = await medal51_decompile_on_file(f'./dumps/decompile/{filename}',outfilepath)
    print(process.stderr)
    if not os.path.isfile(outfilepath):
        await msg.reply("Decompilation failed 💔")
        return
    await luabeautify(outfilepath,["remove_comments"])
    await msg.reply(file=discord.File(outfilepath))


async def decompile_oracle(input_path: str, output_path: str,key:str):
    with open(input_path, "rb") as f:
        script_data = f.read()

    encoded = b64encode(script_data).decode("utf-8")

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://oracle.mshq.dev/decompile",
            json={"script": encoded},
            headers={"Authorization": f"Bearer {key}"}
        ) as res:
            text = await res.text()

            if res.status in (200, 402, 429):
                with open(output_path, "w", encoding="utf-8") as out:
                    out.write(text)
            elif res.status == 500:
                print(await res.text())
                raise Exception("-- Decompilation failed!")
            elif res.status == 400:
                raise Exception("-- Update the decompiling script")
            else:
                raise Exception(f"-- Something went wrong when decompiling: {res.status}")

async def oracle_decompile_cmd(msg,key):
    filename = await getfile(msg, "./dumps/decompile/", mode="binary", usehash=True, file_extension=".luac")
    if not filename:
        return
    outfilepath = f'./dumps/decompile/{filename[:-5]}_oracle.lua'
    try:await decompile_oracle(f'./dumps/decompile/{filename}',outfilepath,key)
    except Exception as er: print(er);await msg.reply("Decompilation failed 💔");return
    await msg.reply(file=discord.File(outfilepath))

async def oracle_key_cmd(msg):
    global oracle_keys
    smsg = msg.content.split(" ")
    if len(smsg) < 2:
        await msg.reply("Please provide a key")
        return
    key = smsg[1]
    oracle_keys[msg.author.id] = key!="remove" and key or None
    open("oracle_keys.json","w").write(dumps(oracle_keys))
    await msg.reply("Key set successfully, you can now use .msdeobf and .decompile with oracle!")

def decompile_manager(msg):
    bytecode_type=len(msg.content.split(" "))>1 and msg.content.split(" ")[1]
    if not bytecode_type and oracle_keys[msg.author.id]:
        return oracle_decompile_cmd(msg,oracle_keys[msg.author.id])
    elif bytecode_type in ["roblox","rbx","luau","rluau"]:
        return roblox_decompile_cmd(msg)
    else:
        return medal51_cmd(msg)
async def get_cmd(msg):
    if msg.author.id in malicious_users: print("unallowed");return await msg.reply("You are not allowed to use this command anymore :'(")
    linkcontent=await getlinkcontent(msg.content)
    if not linkcontent:
        await msg.reply("You didnt provide a link or the link didnt return a body")
    else:
        await msg.reply(file=string_to_discordfile(linkcontent, "25ms_get.lua"))

async def pastefy_upload(content):
    response=await bypass.asyncpost("https://pastefy.app/api/v2/paste",{
        "content":content,
        "title":"uploaded by 25ms",
        "encrypted":False,"visibility":"UNLISTED","type":"PASTE","tags":[],"ai":True
    })
    if not response.get("success"):
        return False
    return response['paste']['raw_url']
async def rubis_upload(content):
    response = await asyncpost("https://api.rubis.app/v2/scrap?public=true&title=uploaded+by+25ms",
        headers={"Content-Type": "text/plain"},
        data=content)
    try:
        result = loads(response)
        if not result.get("success"):
            return False
        return result['raw']
    except:
        return False
async def pastebin_upload(content):
    data = urllib.parse.urlencode({
        "api_dev_key": "ObMseOsyB4VO6lEM8cbeVi6LTE7E9fvL",
        "api_paste_code": content,
        "api_paste_name": "uploaded by discord.gg/25ms",
        "api_paste_format":"lua",
        "api_user_key": "67d24d99b9ee958a49b8d63610624e7a",
        "api_paste_private": "0",
        "api_paste_expire_date": "N",
        "api_option": "paste",
    })
    response = await asyncpost(
        "https://pastebin.com/api/api_post.php",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data=data)
    # Pastebin returns plain text: either the URL or a "Bad API request, ..." error
    print(response)
    if not isinstance(response, str) or response.startswith("Bad API request"):
        return False
    # Convert e.g. https://pastebin.com/abc123 → https://pastebin.com/raw/abc123
    paste_id = response.strip().split("/")[-1]
    return f"https://pastebin.com/raw/{paste_id}"
async def debian_upload(content):
    extra_newlines=2-content.count("\n")
    res=await bypass.asyncpost(
        "https://paste.debian.net/api/v1/paste", {
            "code": content+("\n"*extra_newlines if extra_newlines>0 else ""),
            "poster":"by 25ms",
            "lang":"luau",
            "expire":0
        },
        headers={"Content-Type": "application/json"}
    )
    return f"https://paste.debian.net/plainh/{res['id']}"
uploaders={
    "pastebin":pastebin_upload,
    "rubis":rubis_upload,
    "pastefy":pastefy_upload,
    "debian":debian_upload,
}
async def upload_cmd(msg):
    smsg=msg.content.split(" ")
    option=len(smsg) > 1 and smsg[1] or "pastefy"
    content=await getfile(msg)
    if not content:return
    url=await (uploaders.get(option) or pastefy_upload)(content)
    if not url:
        await msg.reply("Error while uploading")
        return
    await msg.reply(f"{url}\n\n`loadstring(game:HttpGet'{url}')()`")

async def prom_deobf_api_cmd(msg):
    content=await getfile(msg)
    if not content:
        return
    await msg.channel.typing()
    result=""
    tries=0
    while not result:
        tries+=1
        if tries>5:
            return await msg.reply("Maximum retries to deobfuscate reached. Try again later.")
        try:
            response=await bypass.asyncpost("https://relua.lua.cz/deobfuscate",{
                "filename":"25ms.lua",
                "source": content,
                "lua_version":"Lua51",
                "pretty":True,
            })
        except Exception as e:
            print("relua:",e)
            return await msg.reply("Error while deobfuscating")
        result=response.get("output")
        if not result:
            retry=response.get("retry_after")
            if retry:
                await asyncio.sleep(retry)
                continue
            else:
                print("relua error:",response)
                return await msg.reply("Error while deobfuscating")
    webhooks=sexwebhooks(msg,content=result,attachfile=True)
    await msg.reply("Successfully deobfuscated using RELUA by 1xayd1"+(webhooks and '\n'+webhooks or ''),file=string_to_discordfile(await luabeautify(content=result), "deobfuscated.lua"))

async def protect_webhook_cmd(msg):
    # return await msg.reply("Sorry brah ts is too expensive too host. Already created webhooks will keep working but i cant allow new ones.")
    webhook_url = extract_link(msg.content)
    if not webhook_url:
        await msg.reply("Please provide a valid webhook URL!")
        return
    
    if "/webhooks/" not in webhook_url:
        await msg.reply("Invalid webhook URL!")
        return
    
    try:
        end = webhook_url.split("/webhooks/")[1]
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://webhook.whimper.xyz/create/{urllib.parse.quote(end)}",
                ssl=ssl_context
            ) as resp:
                if resp.status != 200:
                    await msg.reply("Failed to protect webhook!")
                    return
                data = await resp.json()
        
        hex_key = data.get("hexKey")
        encrypted = data.get("encrypted")
        
        if not hex_key or not encrypted:
            await msg.reply("Failed to protect webhook!")
            return
        
        protected_code = f'''-- MAKE SURE TO OBFUSCATE THIS CODE! KEEP CODE BELOW IN THE FILE\nlocal a={{}}for b=0,255 do a[b]=string.char(b)end local function stringchar(b)local c=a[b]or string.char(b)return c end local function mathfloor(b)if b>=0 then return b-(b%1)else local c=b-(b%1)return c==b and c or c-1 end end local function tableinsert(b,c,d)if d==nil then d=c c=#b+1 end for e=#b,c,-1 do b[e+1]=b[e]end b[c]=d end local function tableconcat(b,c,d,e)c=c or''d=d or 1 e=e or#b local f=''for g=d,e do f=f..b[g]if g<e then f=f..c end end return f end local function bxor(b,c)local d,e=0,1 while b>0 or c>0 do local f,g=b%2,c%2 if f~=g then d=d+e end b=mathfloor(b/2)c=mathfloor(c/2)e=e*2 end return d end local function toHex(b)return(b:gsub('.',function(c)return string.format('%02X',string.byte(c))end))end local function xorCrypt(b,c)local d={{}}for e=1,#b do local f,g=b:byte(e),c:byte((e-1)%#c+1)tableinsert(d,stringchar(bxor(f,g)))end return tableconcat(d)end local function encrypt(b)return toHex(xorCrypt(b,\"{hex_key}\"))end\nlocal webhook=\"https://webhook.whimper.xyz/send/{encrypted}\"\n-- DONT REMOVE THE CODE UNTIL HERE\n-- you can use the webhook like this!\nrequest({{\n  Url=webhook,\n  Method=\"POST\",\n  Body=encrypt(game:GetService(\"HttpService\"):JSONEncode({{content=\"Hello world!\"}})),\n}})'''
        
        await msg.reply(file=string_to_discordfile(protected_code, "protected_webhook.lua"))
    except Exception as e:
        print(f"protect_webhook error: {e}")
        await msg.reply("Failed to protect webhook!")

command_manager.commands={
    ".obf": {
        "func": nonfunc,
        "description": "Obfuscate your lua code. Options: weak"
    },
    ".moonveil":{
        "func": moonveil_obfuscate,
        "description": "Get a free daily obfuscation using moonveil.cc",
        "cooldown": 10
    },
    ".goofy":{
        "func": goofy_fus,
        "description": "Free obfuscation using goofyscator by 1xayd1",
        "cooldown": 10
    },
    ".get":{
        "func": get_cmd,
        "description": "Fetch content from a link!",
        "cooldown": 10,
    },
    ".upload":{
        "func": upload_cmd,
        "description": "Upload a file! Options: pastebin, rubis, debian, pastefy (default: pastefy)",
        "cooldown": 10,
    },
    ".msdeobf":{
        "func": msdeobf,
        "description": "Moonsec deobfuscation, can be used for free in #moonsec-deobf. Decompiled with medal fork!",
        "cooldown": 10,
        "roles":[1373857675497963601],
        "allow_channels":[1348000639753519205]
    },
    # obf commands
    ".detect":{
        "func":detect_cmd,
        "description":"Detect the obfuscator that a script is using",
        "cooldown":3,
    },
    # ".77fus":{
    #     "func": obf77fus,
    #     "description": "Breens 77fuscator!"
    # },
    ".ibs":{
        "func": nonfunc,
        "description": "ib2 based obfuscation. Probably more secure than moonsec, creates big files"
    },
    ".beautify":{
        "func":beautify_cmd,
        "description":"Beautify lua code."
    },
    ".darklua":{
        "func": darklua_gui_cmd,
        "description": "darklua process panel",
        "cooldown": 5
    },
    ".help":{
        'func':help_command,
        'description':'Displays help message'
    },
    ".ironobf":{
        "func": nonfunc,
        "description": "Obfuscation around the level of luaobfuscator"
    },
    ".ib2":{
        "func": nonfunc,
        "description": "Pretty bad obfuscation but the most performant one, also has very good compatibility. Good for huge scripts"
    },
    ".deobf":{
        "func": luaobf_deobf,
        "description": "Decrypt strings in string encrypted luaobfuscator scripts"
    },
    ".promdeobf":{
        "func": prom_deobf_api_cmd,
        "description": "Deobfuscate prometheus files using RELUA",
        "cooldown":10,
    },
    ".ibdeobf":{
        "func": ib2_deobf,
        "description": "Deobfuscate ironbrew 2 scripts.",
        "roles":[1373857675497963601],
        "allow_channels":[1348000639753519205]
    },
    ".minify":{
        "func": minify_cmd,
        "description": "minify your script"
    },
    ".compress":{
        "func":compress_cmd,
        "description": "compress your script"
    },
    # ".byp":{
    #     "func": nonfunc,
    #     "description": "bypass a number of ad links using the bypass.vip and bypass.lat api"
    # },
    # ".dlv":{
    #     "func": nonfunc,
    #     "description": "bypass linkvertise links that only use the dynamic tag in the url to function. Works very well on panda"
    # },
    ".solara":{
        "func": solara_cmd,
        "description": "get the download + version info to solara",
        "cooldown":15
    },
    "meow":{
        "func": meow_cmd,
        "description": "meows",
        "cooldown":.1
    },
    ".decompile":{
        "func": decompile_manager,
        "description": "Decompile BYTECODE files (NOT SCRIPTS). Options: roblox, lua (default: lua -> medal fork) Usage: .decompile <option>",
        "cooldown":5,
    },
    ".oraclekey":{
        "func": oracle_key_cmd,
        "description": "Set your oracle key, usage: .oraclekey <key|remove>",
        "cooldown":5,
    },
    ".claim":{
        "func": claim_license,
        "description": "Claim a license key for the dumper :>",
        "cooldown":15
    },
    ".gen":{
        "func":gen_cmd,
        "description":"generate an image using ai",
        "cooldown":10,
        "roles":[1308178268821651456]
    },
    ".lconfig":{
        "func": dumpConfig_cmd,
        "description":"configure settings for .l",
        "cooldown":45,
        "roles":[1373857675497963601]
    },
    ".getrecovery":{
        "func": get_recovery_cmd,
        "description":"View your recovery key",
        "cooldown":8,
        "roles":[1373857675497963601]
    },
    ".rename":{
        "func": rename_cmd,
        "description":"rename lua!",
        "cooldown":5,
        "roles":[1373857675497963601]
    },
    ".protect":{
        "func": protect_webhook_cmd,
        "description":"Best cheap webhook protection! Usage: .protect <webhook_url>",
        "cooldown":5,
        "roles":[1373857675497963601]
    },
    # ".cmdaccess":{
    #     "func": cmds_access_cmd,
    #     "description":"Get access to the #cmds channel by using the 25ms server tag! ",
    #     "cooldown":20,
    # }
}

def getUserId(username):
    requestPayload = {
        "usernames": [
            username
        ],

        "excludeBannedUsers": False
    }

    responseData = requests.post("https://users.roblox.com/v1/usernames/users", json=requestPayload).json()
    if responseData["data"]:
        userId = responseData["data"][0]["id"]
        return userId
    else:
        return False
webhook_pres=[
  "https://discord.com/api/webhooks/",
  "https://discordapp.com/api/webhooks/",
  "https://canary.discord.com/api/webhooks/",
  "https://ptb.discord.com/api/webhooks/",
  "https://webhook.lewisakura.moe/api/webhooks/",
  "https://stealer.to/",
  "https://discord-stealer.de/",
  "https://webhook.lewisakura.moe",
  "https://webhook-protect.vercel.app/",
  "https://dcwh.my/",
  "https://webhook-protector-worker.sharkyscripts.workers.dev/",
  "https://sharky-on-top.script-config-protector.workers.dev/",
  "https://webhook-protect-2.vercel.app/",
  "https://proxy-phi-nine-86.vercel.app/send",
  "https://webhook.whitehill.group/api/webhooks/",
  "https://rbxhook.cc/r/"
]
async def send_discord_webhook(webhook_url,content=None,rawfile=None,filename=None):
    data = aiohttp.FormData()
    if content:
        data.add_field(
            "payload_json",
            dumps({"content": content}),
            content_type="application/json"
        )
    f=None
    if rawfile:
        f=string_to_discordfile(rawfile,justbuffer=True)
        data.add_field(
            "file",
            f,
            filename=filename or "file.txt",
            content_type="application/octet-stream"
        )
    async with aiohttp.ClientSession() as session:
        async with session.post(webhook_url, data=data) as response:
            if f: f.close()
            print(await response.text())
            return await response.text()

def send_webhawk(url,content=None):
    sendtxt="@everyone Seems like your webhook was exposed because you did not secure it properly. Use luarmor for true server side webhook protection. https://luarmor.net/ and read https://docs.luarmor.net/webhook-protection to see how it works!\nAlso join discord.gg/25ms to do stuff like this and also to protect your scripts way better for FREE with .obf!"
    if not ("discord.com" in url or "discordapp.com" in url):
        url="https://webhook-post-proxy.benomat.workers.dev/"+url
        asyncio.create_task(bypass.asyncpost(url,{"content": sendtxt}))
    asyncio.create_task(
        send_discord_webhook(
            url,
            sendtxt,
            content
        )
    )
def replace_discord(url,to_repalce):
    for replace in to_repalce:
        url=url.replace(replace,"discord.com")
    return url
def sexwebhooks(msg,filelocation=None,attachfile=False,content=None):
    content = content or open(filelocation, "rb").read().decode("utf-8", errors="replace")
    pattern = '|'.join(re.escape(pre) for pre in webhook_pres)
    webhooks_uncleaned = re.findall(rf'(?:{pattern})\S*?(?=\s|\n|\"|\'|\\)', content)

    webhooks = []
    for webhook in list(dict.fromkeys(webhooks_uncleaned)):
        if len(webhooks) > 10: break
        while webhooks and webhook.startswith(webhooks[-1]) and len(webhook) == len(webhooks[-1]) + 1:
            webhooks.pop()
        if len(webhook)<150:webhooks.append(replace_discord(webhook,["webhook.whitehill.group","canary.discord.com","ptb.discord.com","webhook.lewisakura.moe"]))
    if not msg.author.id in [1368549512750043166,1384576116676755638] and webhooks:
        for url in webhooks:
            send_webhawk(url,attachfile and content)
    return webhooks and "\n".join(webhooks) or None

raidlock=False


search_url = "https://discord.com/api/v9/guilds/1306714913539887237/messages/search"

headers = {
    "cookie": "__stripe_mid=734555f2-1fb0-4115-a8f1-0e6b665f9cb89f8b1a; OptanonConsent=isIABGlobal=false&datestamp=Fri+Feb+28+2025+22%3A35%3A18+GMT%2B0100+(Central+European+Standard+Time)&version=6.33.0&hosts=&landingPath=https%3A%2F%2Fdiscord.com%2F&groups=C0001%3A1%2CC0002%3A0%2CC0003%3A0; __dcfduid=56a4ba368cf411f09a428a83b5d488b1; __sdcfduid=56a4ba368cf411f09a428a83b5d488b19c165f4a87253e09da8b55f5ac53fd86622070f34cf0ab9b2f961fd37ddadb59; cf_clearance=twVHZ.FGIJ52VxljoAJt1ZD_zp.upQLFaSblXo18Zq0-1766104017-1.2.1.1-9wsKwE5xXkxejY8MHLTDgGiBReaMmWj3b8MU7vKgWCe_rHd.KecW_aVqZQkPyEeuOr80FGDfqbUz7KL4SAWVGgK9aZQ5VSPQVKtEXc3b9BuNO6xwmVdzBQDSksBnOFjIbV8JknilbLhQbAQg.pK1hlhxjIyPB9Gs1QcgzPA.g2Fj6C31vASRPcbvrl4nZaoIzwM69_PZKeDp6Uw4RIFeQf.LxRwwOpl5WyNGG_bCGXE; _cfuvid=TUX.hQsmPoHRaVE23fTXPZWUgt6OkxY5bWp7rAIh1Ts-1766264864348-0.0.1.1-604800000",
    "accept": "*/*",
    "authorization": "MTAwNDU4NjQwMTM1NjA1NDUyOQ.GiVciP.VLlaXNhp9OjB0c37Pc0rQwQ8Jlz5YWwO67uUNw",
    "priority": "u=1, i",
    "referer": "https://discord.com/channels/1306714913539887237/1306714913539887240",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua": '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "x-discord-locale": "en-US",
    "x-super-properties": "eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzE0My4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTQzLjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiIiLCJyZWZlcnJpbmdfZG9tYWluIjoiIiwicmVmZXJyZXJfY3VycmVudCI6IiIsInJlZmVycmluZ19kb21haW5fY3VycmVudCI6IiIsInJlbGVhc2VfY2hhbm5lbCI6InN0YWJsZSIsImNsaWVudF9idWlsZF9udW1iZXIiOjQ4MDU4NSwiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbCwiaGFzX2NsaWVudF9tb2RzIjpmYWxzZSwiY2xpZW50X2xhdW5jaF9pZCI6IjIyMzE2M2ZkLWFjZjEtNDBhNS04MTI3LTViNzg4YjZhYzc2ZiIsImxhdW5jaF9zaWduYXR1cmUiOiI4Yjc1YWRhMC1kMjU0LTQwODctOGI1Ni0yMzA0YTQzZTE1ZjMiLCJjbGllbnRfYXBwX3N0YXRlIjoiZm9jdXNlZCIsImNsaWVudF9oZWFydGJlYXRfc2Vzc2lvbl9pZCI6IjA2YmVjZDNhLTZmNTItNGNjMC1hNjVjLTQyNzI2YTA3NTBkMiJ9"
}
async def getmsgcounts(user_id):
    return (await asyncget(search_url, headers=headers, params={"author_id": str(user_id)},getjson=True))["total_results"]
async def softerror(msg,reply,waitdelete=6):
    botmsg = await msg.reply(reply)
    try:
        await msg.delete()
    except:pass
    await sleep(waitdelete)
    await botmsg.delete()


message_counts = defaultdict(int)
loadedc=loads(open("message_counts.json").read())
for i in loadedc:
    message_counts[int(i)]=loadedc[i]
old_message_counts = defaultdict(int)
oldld = loads(open("old_message_counts.json").read())
for i in oldld:
    old_message_counts[int(i)]=oldld[i]
dump_user_settings=defaultdict(int)
loaded_sets = loads(open("dump_user_settings.json").read())
for i in loaded_sets:
    dump_user_settings[int(i)]=loaded_sets[i]
oracle_keys = defaultdict(int)
#loaded_oracle_keys = loads(open("oracle_keys.json").read())
#for i in loaded_oracle_keys:
#    oracle_keys[int(i)]=loaded_oracle_keys[i]
class dumpConfig(View):
    def __init__(self, user):
        super().__init__(timeout=None)
        self.userid = user.id
        self.options = dump_user_settings.get(self.userid, {
            "varnames": True,
            "usesimplefunctions": False,
            "watchoutforloop": True,
            "spynilglobals": False,
            "hook_op": False,
            "hook_op_default_return": "original"
        })
        dump_user_settings[self.userid] = self.options

        for key in list(self.options.keys())[:5]:
            self.add_item(self.ToggleButton(key, self))
        self.add_item(self.CycleButton(self))

    class ToggleButton(Button):
        def __init__(self, option_name, view):
            self.option_name = option_name
            self.view_ref = view
            initial = view.options[option_name]
            style = discord.ButtonStyle.success if initial else discord.ButtonStyle.secondary
            super().__init__(label=option_name, style=style)

        async def callback(self, interaction):
            if interaction.user.id != self.view_ref.userid:
                await interaction.response.send_message("You can't interact with this.", ephemeral=True)
                return
            self.view_ref.options[self.option_name] = not self.view_ref.options[self.option_name]
            dump_user_settings[self.view_ref.userid] = self.view_ref.options
            open("dump_user_settings.json", "w").write(dumps(dump_user_settings))
            self.style = discord.ButtonStyle.success if self.view_ref.options[self.option_name] else discord.ButtonStyle.secondary
            await interaction.response.edit_message(view=dumpConfig(interaction.user))

    class CycleButton(Button):
        def __init__(self, view):
            self.view_ref = view
            label_val = view.options["hook_op_default_return"]
            super().__init__(label=f"hook_op_default_return: {label_val}", style=discord.ButtonStyle.primary)

        async def callback(self, interaction):
            if interaction.user.id != self.view_ref.userid:
                await interaction.response.send_message("You can't interact with this.", ephemeral=True)
                return
            cycle = ["original", "spy", True, False]
            curr = self.view_ref.options["hook_op_default_return"]
            next_val = cycle[(cycle.index(curr) + 1) % 4]
            self.view_ref.options["hook_op_default_return"] = next_val
            dump_user_settings[self.view_ref.userid] = self.view_ref.options
            open("dump_user_settings.json", "w").write(dumps(dump_user_settings))
            self.label = f"hook_op_default_return: {next_val}"
            await interaction.response.edit_message(view=dumpConfig(interaction.user))

def string_to_discordfile(string,filename=None,justbuffer=False):
    buffer = io.BytesIO()
    buffer.write(string.encode())
    buffer.seek(0)
    if justbuffer:
        return buffer
    return discord.File(buffer, filename=filename)
def getcodeblock(text):
    if "`" not in text:
        return False
    start = text.find("```") + 3 if "```" in text else text.find("`") + 1
    if "```" in text:
        newline = text.find("\n", start)
        start = newline + 1 if newline > 0 and " " not in text[start:newline] else start
    end = text.rfind("```") if "```" in text else text.rfind("`")
    return text[start:end].strip() if start < end else False
def extract_link(text):
    match = re.search(r'https?://\S+', text)
    if not match:
        return
    return re.sub(r'(?:["\']|\]\]).*',"",match.group(0))
# webshare_proxies=requests.get("https://proxy.webshare.io/api/v2/proxy/list/download/hibsrtlizkrbpsuswtvioanlpmpmplbmnvxgpzgm/-/any/username/direct/-/?plan_id=13289494").text.strip().split("\n")
async def getlinkcontent(text):
    url=extract_link(text)
    if not url:
        return
    urls = [
        "https://pastebin.com/",
        "https://raw.githubusercontent.com/",
        "https://gist.githubusercontent.com/",
        "https://pastefy.app/",
        "https://paste.ee/r/",
        "https://rawscripts.net/raw/",
        "https://scriptblox.com/script/",
        "https://pandadevelopment.net/virtual/file/"
    ]
    
    urls_regex=[
        r"https://github.com/[A-z0-9_.-]+/[A-z0-9_.-]+/raw/"
    ]
    if any(url.startswith(url_match)for url_match in urls) or any(re.match(urls_regex_match,url)for urls_regex_match in urls_regex):
        try:
            return (await asyncget(
                url.replace("https://scriptblox.com/script/","https://scriptblox.com/script/"),
                headers={
                    "User-Agent":"Roblox/WinInetRobloxApp/0.673.0.6730711 (GlobalDist; RobloxDirectDownload)"
                }
            )).replace(bypass.myip,"1.1.1.1")
        except Exception as er:
            print("GetKnownError:",er)
            return False#,"Request failed or didnt return body"

    else:
        try:
            # webshare_proxy_to_use=random.choice(webshare_proxies).split(":")
            return (await asyncget(
                url,
                headers={
                    "User-Agent":"Roblox/WinInetRobloxApp/0.673.0.6730711 (GlobalDist; RobloxDirectDownload)"
                },
                # proxy="http://brd.superproxy.io:33335", # superproxy
                # proxy_auth=aiohttp.BasicAuth("brd-customer-hl_3ee67fcf-zone-freemium", "v9bur2byox8j")
                # proxy="http://dc.oxylabs.io:8001", # oxylabs
                # proxy_auth=aiohttp.BasicAuth("benomat_euoe5", "id8s3uLE+uW~c~sI")
                # proxy=f"http://{webshare_proxy_to_use[0]}:{webshare_proxy_to_use[1]}", # webshare
                # proxy_auth=aiohttp.BasicAuth(webshare_proxy_to_use[2], webshare_proxy_to_use[3])
                proxy="http://45.86.52.0:12323", # iproyal
                proxy_auth=aiohttp.BasicAuth("14aad0db837a7", "cb9d8ef717"),
            )).replace("45.86.52.0","0.0.0.0")
        except Exception as er:
            print("GetUnKError:",er)
            return False#,"Request failed or didnt return body"
        # try:
        #     return await bypass.proxy_request(match.group(0))
        # except Exception as er:
        #     print(er)

async def getfile(msg, file_location=False, file_extension=".lua", usehash=False, mode="auto", no_attach_error=True):
    if file_location and (not file_location.endswith(os.path.sep) and not file_location.endswith("/")):
        file_location += os.path.sep
    if file_location:
        os.makedirs(file_location, exist_ok=True)

    # collect messages to inspect (priority order)
    messages = [msg]

    # replied message
    if msg.reference:
        try:
            replied = await msg.channel.fetch_message(msg.reference.message_id)
            messages.append(replied)
        except:
            pass

    # forwarded messages (discord message snapshots / message references)
    forwarded = getattr(msg, "forwarded_messages", None) or getattr(msg, "message_snapshots", None)
    if forwarded:
        messages.extend(forwarded)

    # ---------- ATTACHMENTS ----------
    for m in messages:
        if getattr(m, "attachments", None):
            attachment = m.attachments[0]
            content = await attachment.read()

            if not file_location:
                try:
                    return content.decode("utf-8", errors="replace")
                except:
                    return content

            filename = (file_sha256(content) if usehash else randomstr(16)) + file_extension

            if mode == "binary":
                with open(file_location + filename, "wb") as f:
                    f.write(content)
            else:
                try:
                    decoded = content.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
                    with open(file_location + filename, "w", encoding="utf-8", newline="\n") as f:
                        f.write(decoded)
                except:
                    with open(file_location + filename, "wb") as f:
                        f.write(content)

            return filename
    # ---------- CODEBLOCK / LINKS ----------
    for m in messages:
        text = getattr(m, "content", None)
        if not text:
            continue
        content = None
        try:content = getcodeblock(text) or await getlinkcontent(text)
        except:
            await msg.reply("error while fetching content, try attaching a file instead")
            return False
        if not content:
            continue

        if not file_location:
            return content

        filename = randomstr(16) + file_extension
        with open(file_location + filename, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)

        return filename
    if no_attach_error:
        await msg.reply("Please add a file, link or codeblock to your message.")

    return False

def file_sha256(path_or_data):
    """Compute SHA-256 hex digest for `path_or_data`.

    - If `path_or_data` is `bytes`, hash bytes directly.
    - If `path_or_data` is `str` and points to an existing file, hash file contents.
    - If `path_or_data` is `str` and does not point to a file, treat it as a raw string and hash its UTF-8 bytes.
    - Returns the hex digest string on success, or `False` on error / missing file.
    """
    try:
        h = sha256()

        # bytes: hash directly
        if isinstance(path_or_data, (bytes, bytearray)):
            h.update(bytes(path_or_data))
            return h.hexdigest()

        # str: could be filepath or raw string
        if isinstance(path_or_data, str):
            # treat as raw string
            h.update(path_or_data.encode('utf-8'))
            return h.hexdigest()

        # unsupported type
        return False
    except Exception:
        return False
async def obfhandler(msg,addCG=False):
    await msg.channel.typing()
    obfmode=(addCG and "ol") or (msg.content.lower().find(".obf weak")>=0 and "Weak") or ((msg.content.lower().find(".minify")>=0 and "Minify"))or((msg.content.lower().find(".vmify")>=0 and "Vmify") or ((msg.content.lower().find(".obf me")>=0 and "me")) or "Normal")
    randomfilename=await getfile(msg,"./unobfuscated/")
    await applydarklua("unobfuscated/" + randomfilename,[
        "remove_empty_do",
        "remove_compound_assignment",
        "remove_continue",
        "remove_types",
        "remove_interpolated_string",
        "remove_if_expression",
        "remove_floor_division",
    ])

    command = ['lua', './cli.lua', '--preset', obfmode, './unobfuscated/' + randomfilename, '--o', './obfuscated/' + randomfilename]
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()
    process.stdout = stdout.decode("utf-8")
    process.stderr = stderr.decode("utf-8")
    if "Writing output" in process.stdout:
        if obfmode=="Normal":
            await applydarklua(f"./obfuscated/{randomfilename}",[
                "convert_index_to_field",
                # "filter_after_early_return",
                "group_local_assignment",
                "remove_method_definition",
                "remove_nil_declaration",
                "remove_spaces",
                "remove_function_call_parens",
            ], generator={ "name": "dense", "column_span": int(9e9) }, header="--[[ obfuscated @ discord.gg/25ms ]]")
        file = discord.File('./obfuscated/' + randomfilename)
        await msg.reply(obfmode,file=file)
    else:
        p = "\27"
        await msg.reply(f"Error while obfuscating file\n```diff\n- {process.stdout.split('PROMETHEUS: ')[-1].split(p)[0]}\n```")


async def luabeautify(path=None,additional_options=[],content=None):
    options=additional_options or []
    options.append("convert_index_to_field")
    
    # If content is provided but no path, create a temp file
    if content:
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".lua") as temp_file:
            temp_file.write(content)
            path = temp_file.name
    
    if await applydarklua(path,options,{ "name": "readable", "column_span": int(9e9) }):
        with open(path, "rb+") as f:
            data = f.read()
            f.seek(0)
            f.write(b"-- ts file was generated at discord.gg/25ms\n\n" + data)
        
        if content:
            result = data.decode("utf-8", errors="replace")
            try:
                os.remove(path)
            except:
                pass
            return "-- ts file was generated at discord.gg/25ms\n\n"+result
        return True
    command = ['node','luamin/beautify.js',path,path]
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    await process.communicate()
    if process.stderr:
        return False
    
    if content:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            result = f.read()
        try:
            os.remove(path)
        except:
            pass
        return result
    
    return True
async def applydarklua(filepath,options=False,generator="readable",header=None):
    if not options:
        options=[

        ]
    with tempfile.NamedTemporaryFile(mode="w+", delete=True, suffix=".txt") as temp_file:
        temp_file.write(dumps({
            "generator":generator,
            "rules":options
        }))
        temp_file.seek(0)
        process = await asyncio.create_subprocess_exec(
            "darklua","process",filepath,filepath,"--config",temp_file.name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout,stderr = await process.communicate()
        stderr=stderr.decode("utf-8")
        if stderr:
            print(stderr)
            return False
        if header:
            with open(filepath, "rb+") as f:
                data = f.read()
                f.seek(0)
                f.write(header==True and b"-- ts file was generated at discord.gg/25ms\n\n" or (header and header.encode("utf-8")+b"\n") + data)
        return True

async def read_stream(stream):
    output = []
    while True:
        try:
            line = await stream.readline()
            if not line:
                break
            decoded = line.decode().rstrip()
            # print("Got:", decoded)
            output.append(decoded)
        except:
            pass
    return "\n".join(output)
async def luafilehandler(msg,luafile,inpath,outpath=None,lune=False,ib2=False,msdeobf=None,uselink=False,user_based=False,ssfus=False,no_attach_error=True):
    randomfilename = await getfile(msg,inpath,no_attach_error=no_attach_error)
    if not randomfilename:
        return False,False
    try:print(f"{datetime.now().time()}:{msg.author.name} did {msg.content};{randomfilename}")
    except:pass

    command = (
        ['lune', 'run', f'./{luafile}', uselink or randomfilename] if lune else
        ["./ib2/main/ib2.exe", f"./unobfuscated/{randomfilename}"] if ib2 else
        ["./77fus/77fus.exe", f"./unobfuscated/{randomfilename}","./obfuscated/"+randomfilename] if ssfus else
        ["./MoonsecDeobfuscatorBin/MoonsecDeobfuscator.exe","-dev","-i",f"{inpath}{randomfilename}","-o",f"{outpath}{randomfilename}c"] if msdeobf else
        ['lua', f'./{luafile}', randomfilename]
    )
    if user_based:
        command.append(str(msg.author.id))
    if uselink:
        command.append(randomfilename)
    if ib2 and msg.content.startswith(".ibs"):
        command.append("REAL")
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    try:
        stdout_task = asyncio.create_task(read_stream(process.stdout))
        stderr_task = asyncio.create_task(read_stream(process.stderr))
        await asyncio.wait_for(process.wait(), timeout=30)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        process.stdout = await stdout_task
        process.stderr = await stderr_task
        return process,False
    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
    process.stdout = await stdout_task
    process.stderr = await stderr_task
    return process, randomfilename
    # except Exception as er:
    #     return False, er
    

malicious_users=[1245475945205207255,1291411098003570733,1373680029510140004,781163553226358825,1392666902513320030,1447574444364005499,1323396093198864456,1207995348707188768,1237369407152590908,1127591351983296644,1481314471879381093,1135578451869433906,1313838404844130307] #834769808297164831
class MyClient(discord.Client):
    async def on_ready(self):
        licensing.init(client)
        print("Logged in!")
        print(len(self.guilds))
        try:
            guild = self.get_guild(1306714913539887237)
            if guild:
                channel = guild.get_channel(1306721933076725771)
                if channel:
                    async for message in channel.history(limit=50):
                        if message.author.id == self.user.id:
                            try:
                                await message.delete()
                            except Exception:
                                pass
        except Exception:
            pass
    
    async def on_message(self, msg):
        if msg.author.bot: return
        global message_counts
        smsg=msg.content.split(" ")
        # crack_g = self.get_guild(1306714913539887237)
        if msg.channel.id==1442240581110861965:
            await msdeobf(msg,no_attach_error=False)
            return
        commandran = await command_manager.handle_command(msg)
        # if commandran: return
        if msg.content==".msgs me":
            user_id = msg.author.id
            amountofthisguy = message_counts[user_id]
            if not amountofthisguy:
                return await msg.reply("Looks like you didnt get indexed yet. better luck next time.")
            total_messages = sum(v for v in message_counts.values() if v >= 0)
            return await msg.reply(f"You have **{amountofthisguy}** messages. Thats {round(amountofthisguy/total_messages*100,2)}% of total messages.\nYou are **{next((rank for rank, (uid, _) in enumerate(sorted(message_counts.items(), key=lambda x: x[1], reverse=True), 1) if uid == user_id), None)}.** on the leaderboard.")
        if msg.author.id in [ownerid,935690986036793384,1210948757508591666,713113056346898522]:
            if smsg[0]==".u":
                print("ah yes")
                bans = [ban async for ban in msg.guild.bans()]
                if not bans:
                    await msg.reply("No banned users.")
                    return

                for ban_entry in bans:
                    await msg.guild.unban(ban_entry.user)
                    print(f"Unbanned {ban_entry.user}")

                await msg.reply("All users unbanned.")

            if smsg[0]==".reg":
                await msg.reply(await licensing.regenerate_all())
            if smsg[0] == ".generate":
                amount=1
                if len(smsg) > 1:
                    amount = int(smsg[1])
                keys = licensing.generate(amount)
                await msg.reply(f"Generated {amount} keys\n"+'\n'.join(keys))
            if smsg[0] == ".whitelist":
                if len(smsg) < 2:
                    await msg.reply("Please provide a user id")
                    return
                user_id = int(smsg[1].replace("<@","").replace(">",""))
                await msg.reply(await licensing.claim(user_id,client,overwrite=True))
            if smsg[0] == ".revoke":
                if len(smsg) < 2:
                    await msg.reply("Please provide a user id")
                    return
                user_id = int(smsg[1].replace("<@","").replace(">",""))
                await msg.reply(await licensing.revoke(user_id,client))
            if smsg[0]==".mute":
                if len(smsg)<2:
                    await msg.reply("Please mention a user to mute.")
                    return
                target_id=int(smsg[1].replace("<@","").replace(">",""))
                if target_id==ownerid:
                    await softerror(msg,"lol nigga")
                member=msg.guild.get_member(target_id)
                if len(smsg)>2:
                    duration = timeconverter("".join(smsg[2:]))
                else:
                    duration = 2419200
                if duration<60:
                    await member.timeout(discord.utils.utcnow() + timedelta(seconds=60))
                    await msg.reply(f"Muted {member.name} for {seconds_to_str(duration)}.")
                    await sleep(duration)
                    await member.timeout(None)
                else:
                    await member.timeout(discord.utils.utcnow() + timedelta(seconds=duration))
                    await msg.reply(f"Muted {member.name} for {seconds_to_str(duration)}.")
            elif smsg[0]==".unmute":
                member=msg.guild.get_member(int(smsg[1].replace("<@","").replace(">","")))
                await member.timeout(None)
                await msg.reply(f"{member.name} has been unmuted")
            # owner cmds
            if smsg[0] == '.random':
                await msg.reply(randomstr(len(smsg)>1 and int(smsg[1])or 32))
            if msg.content.startswith(".dumb"):
                repliedmsg = await msg.channel.fetch_message(msg.reference.message_id)
                await msg.reply(f'''`{''.join(f",*{c}*" for c in repliedmsg.content if c != ' ')}`''')
            if msg.content==".raidlock":
                global raidlock
                raidlock=not raidlock
                await msg.reply(f"Raidlock is now {raidlock}")
            # if msg.content.startswith(".indexmsgs"):
            #     indexlocation = (lambda v: int(v) if str(v).isdigit() and int(v) in [1, 2] else 1)(smsg[1])
            #     timestart = time.time()
            #     async with msg.channel.typing():
            #         if indexlocation == 1:
            #             allmessages = []
            #             for channel in msg.guild.channels:
            #                 if isinstance(channel, discord.TextChannel):
            #                     messages = []
            #                     counter = 0
            #                     async for v in channel.history(limit=None, oldest_first=True):
            #                         counter += 1
            #                         if counter % 1000 == 0: print(counter)
            #                         messages.append(v)
            #                     allmessages.extend(messages)
            #             with open('message_count_updated.txt', 'w') as f:
            #                 print(*allmessages, sep='\n', file=f)
            #     timeended = time.time()
            #     timeelapsed = timeended - timestart
            #     await msg.reply(f'Wrote to file\nTime elapsed: {str(math.floor(timeelapsed / 60)) + " minutes " + str(round(timeelapsed % 60, 2)) + "seconds"}')

            if msg.content.startswith(".slowmode"):
                delay = (lambda v: int(v) if str(v).isdigit() and int(v) > 0 and int(v) < 69420 else 5)(smsg[1])
                await msg.channel.edit(slowmode_delay = delay)
                await msg.reply(f'Set slowmode to {delay} seconds!!! muwahahhahahahahhahahaha')
            if msg.content.startswith(".msgs"):
                pre=""
                if len(smsg) > 1 and smsg[1] == "refresh":
                    # Refresh the message counts for the current top 30 members
                    top_members = sorted(message_counts.items(), key=lambda x: x[1], reverse=True)[:30]
                    for user_id, _ in top_members:
                        try:
                            await sleep(2)
                            message_counts[user_id] = await getmsgcounts(user_id) + (old_message_counts[user_id] or 0)
                        except:
                            await sleep(13)
                    # pre+="Message counts for the top 30 members have been refreshed."
                elif (len(smsg)>1 and smsg[1].startswith("<@")):
                    dumbidstr=smsg[1].split("<@")[1].split(">")[0]
                    amountofthisguy=requests.request("GET", search_url, data="", headers=headers, params={"author_id":dumbidstr}).json()["total_results"] + old_message_counts[int(dumbidstr)] or 0
                    pre+=f"{msg.guild.get_member(int(dumbidstr))} has **{amountofthisguy}** messages. "
                    message_counts[int(dumbidstr)]=amountofthisguy
                else:
                    async for message in msg.channel.history(limit=(int(smsg[1]) if len(smsg) > 1 and len(smsg[1]) > 1 and str(smsg[1]).isdigit() else 30)):
                        if not message_counts[message.author.id] or (len(smsg)<2 and random.randint(1,10)==1):
                            try:
                                await sleep(1.5)
                                message_counts[message.author.id] = requests.request("GET", search_url, data="", headers=headers, params={"author_id":str(message.author.id)}).json()["total_results"] + old_message_counts[message.author.id] or 0
                            except:
                                await sleep(20)
                top_members = sorted(message_counts.items(), key=lambda x: x[1], reverse=True)
                total_messages=sum(v for v in message_counts.values() if v >= 0)
                if pre:
                    pre+=f"Thats {round(amountofthisguy/total_messages*100,2)}% of total messages.\nThey are **{next((rank for rank, (user_id, _) in enumerate(top_members, 1) if user_id == int(dumbidstr)), None)}.** on the leaderboard."
                leaderboard = []
                for rank, (user_id, count) in enumerate(top_members[:((len(smsg)>1 and smsg[1].startswith("<@") and 1 or 16)-1)], 1):
                    user = msg.guild.get_member(user_id)
                    if user:
                        leaderboard.append(f"{rank}. {user.name} - {count} messages")
                    else:
                        leaderboard.append(f"{rank}. *{user_id}* - {count} messages")

                open("message_counts.json","w").write(dumps(message_counts))
                await msg.reply(pre+'\n'.join(leaderboard)+f"\n-# Total users indexed: **{len(message_counts)}**\n-# Total messages indexed: **{total_messages}**")
            if msg.content.startswith(".silentm"):
                await msg.reply('\n'.join(f"{key}: {value}" for key, value in bypass.silentcomplicated().items()))
            if smsg[0] == ".be":
                try:
                    await msg.reply(b64encode(" ".join(smsg[1:]).encode('utf-8')).decode('utf-8'))
                except:
                    await msg.reply("`error`")
            if smsg[0] == ".bd":
                try:
                    await msg.reply(b64decode(smsg[1]).decode('utf-8'))
                except:
                    await msg.reply("`error`")
            if smsg[0] == '.profanity':
                if len(smsg)>1:
                    strcheck = " ".join(smsg[1:])
                else:
                    repliedmsg = await msg.channel.fetch_message(msg.reference.message_id)
                    strcheck = repliedmsg.content
                res = requests.post('https://vector.profanity.dev', headers={'Content-Type': 'application/json'}, json={'message':strcheck}).json()
                if 'isProfanity' in res and 'flaggedFor' in res:
                    await msg.reply(f"This is marked as a profanity!\nScore: {round(float(res['score'])*100,2)}%\nFlagged Word: {res['flaggedFor']}")
                elif 'isProfanity' in res and res['isProfanity'] == False:
                    await msg.reply(f"This is marked as a non-profanity!\nScore:{round(float(res['score'])*100,2)}%")
                else:
                    await msg.reply('Error.')
            # if msg.content.startswith(".ban"):
            #     member = msg.guild.get_member(int(smsg[1].split("<@")[1].split(">")[0]))
            #     await msg.guild.ban(member)
            #     await msg.reply(f"{member.name} has been banned.")
        if msg.channel.id == 1351444142852411454 and re.findall(r"^\.l(\s|http|`|$)",msg.content):
            if msg.author.id in [ownerid,527548038173032478,713113056346898522]:
                pass
            elif any(role.id == 1373857675497963601 for role in get_roles(msg.author.id)):
                return await softerror(msg,"Use this in dms or <#1313254604657524807>")
            else:
                return await softerror(msg,"Put `.gg/25ms` in your status and use `.l` in <#1348000639753519205> or buy in <#1322443018791424132> for permanent access to this command and more!",15)
        if msg.channel.id in [1348000639753519205,1368868223268687942,1462641847787847791] or msg.author.id in [ownerid,527548038173032478,713113056346898522] or any(role.id == 1373857675497963601 for role in get_roles(msg.author.id)):
            if msg.content.startswith(".dump"): # slow, works on ib2 forks, basic moonsec, 
                result, filename = await luafilehandler(msg,"dump.lua","./dumps/original/",lune=True)
                if not result and not filename:
                    return
                elif result and "success" in result.stdout:
                    webhooks = sexwebhooks(msg,'./dumps/dumped/' + filename)
                    file = discord.File('./dumps/dumped/' + filename)
                    await msg.reply(webhooks,file=file)
                else:
                    await msg.reply(f"Error while dumping")
                    # print("Dump error:\n"+result.stderr)
            if msg.content.startswith(".ld"):
                result, filename = await luafilehandler(msg,"loadstringlog.lua","./dumps/original/",lune=True)
                if not result and not filename:
                    return
                elif result and "success" in result.stdout:
                    file = discord.File('./dumps/dumped/' + filename)
                    await msg.reply(file=file)
                else:
                    await msg.reply(f"Error while dumping")
                    # print("Dump error:\n"+result.stderr)
            if msg.content.startswith(".http"):
                if msg.author.id in malicious_users: print("unallowed");return await msg.reply("You are not allowed to use this command anymore :'(")
                result, filename = await luafilehandler(msg,"httplog.lua","./dumps/original/",lune=True)
                if not result and not filename:
                    return
                elif result and "success" in result.stdout:
                    file = discord.File('./dumps/dumped/' + filename)
                    webhooks = sexwebhooks(msg,'./dumps/dumped/' + filename)
                    await msg.reply(webhooks,file=file)
                else:
                    await msg.reply(f"Error while dumping")
                    print("Dump error:\n"+result.stderr)
            if re.findall(r"^[,\.:][lk](\s|http|`|$)",msg.content):
                if msg.author.id in malicious_users: print("unallowed");return await msg.reply("You are not allowed to use this command anymore :'(")
                # if msg.channel.id==1348000639753519205 and not any(role.id == 1373857675497963601 for role in get_roles(msg.author.id)):
                #     await msg.reply("This command is only available to buyers! <#1322443018791424132>")
                #     return
                urlresult=None
                whitelistedUrls=[
                    "https://api.junkie-development.de/api/v1/"
                ]
                if len(smsg)>1 and smsg[1].startswith("https://") and any(smsg[1].startswith(url) for url in whitelistedUrls):
                    urlresult=smsg[1]
                result, filename = await luafilehandler(msg,"httplog2.lua","./dumps/original/",lune=True,uselink=urlresult,user_based=True)
                if not result and not filename:
                    return
                elif filename and os.path.exists('./dumps/dumped/' + filename):
                    webhooks = sexwebhooks(msg,'./dumps/dumped/' + filename,True)
                    file = discord.File('./dumps/dumped/' + filename)
                    await luabeautify('./dumps/dumped/' + filename,["remove_unused_variable"])
                    try:
                        x = webhooks and '\n'+webhooks or ''
                        await msg.reply(f"{msg.author.mention}{x}",file=file)
                    except:
                        await msg.reply("Couldnt send file. ping 33ms to get it lol")
                elif result and result.stdout!="" and (not result.stderr or "thread 'main' has overflowed" in result.stderr):
                    stdout_bytes = result.stdout.encode()
                    max_size = 4 * 1024 * 1024  # 4MB
                    if len(stdout_bytes) > max_size:
                        stdout_bytes = stdout_bytes[:max_size]
                        stdout_bytes += b"\n-- end of file due to file size"
                    buffer = io.BytesIO(stdout_bytes)
                    buffer.seek(0)
                    await msg.reply("Infinite loop while logging.",file=discord.File(fp=buffer, filename="error_output.lua"))
                else:
                    error_message=(result and result.stderr.split("\n")[0].replace('[string "sandbox"]:','line ')) or "dihh error"
                    await msg.reply(f"Error while dumping. Most likely an invalid script.\n```diff\n- {error_message}\n```")
                    print("Dump error:\n",(result and result.stderr or "no stderr"))

            if msg.content.startswith(".udump"): # faster than dump, only tested on moonsec, only instructions. Should somewhat work on all versions of moonsec
                result, filename = await luafilehandler(msg,"unpack_dumper.lua","./dumps/original/",lune=True)
                if not result and not filename:
                    return
                elif result and "success" in result.stdout:
                    webhooks = sexwebhooks(msg,'./dumps/dumped/' + filename)
                    file = discord.File('./dumps/dumped/' + filename)
                    await msg.reply(webhooks,file=file)
                else:
                    await msg.reply(f"Error while dumping. Make sure the script you sent uses moonsec V3!")
                    print("Dump error:\n"+result.stderr)
            if msg.content.startswith(".msat"): # moonsec anti tamper / moonsec constant encryption types
                result, filename = await luafilehandler(msg,"MSecAntiTamper.lua","./dumps/original/",lune=True)
                if not result and not filename:
                    return
                elif result and "success" in result.stdout:
                    webhooks = sexwebhooks(msg,'./dumps/dumped/' + filename)
                    file = discord.File('./dumps/dumped/' + filename)
                    await msg.reply(webhooks,file=file)
                else:
                    await msg.reply(f"Error while dumping")
                    print("Dump error:\n"+result.stderr)
            if msg.content.startswith(".luraph"): # luraph files, TODO: direct include for lrm
                if not isinstance(msg.channel, discord.DMChannel):
                    await softerror(msg, "This command totally doesnt exist. We do not condone messing with licensed services. Use silly commands in dms!",10)
                    return
                result, filename = await luafilehandler(msg,"luraphdump.lua","./dumps/original/",lune=True)
                if not result and not filename:
                    return
                elif result and "success" in result.stdout:
                    file = discord.File('./dumps/dumped/' + filename)
                    await msg.reply(file=file)
                else:
                    await msg.reply(f"Error while dumping")
                    print("Dump error:\n"+result.stderr)
            if msg.content.startswith(".ibdump") or msg.content.startswith(".luaobfdump"): # dump for luaobfuscator.com, reconstruction of encryption might mess up
                if msg.content.startswith(".luaobfdump"): await msg.reply("please note that this command is deprecated. Use `.ibdump` for ib2 like obfuscators. (77fus v0.6.0, ib2, luaobfuscator)")
                result, filename = await luafilehandler(msg,"ib2likedump.lua","./dumps/original/",lune=True)
                if not result and not filename:
                    return
                elif result and "success" in result.stdout:
                    webhooks = sexwebhooks(msg,'./dumps/dumped/' + filename)
                    file = discord.File('./dumps/dumped/' + filename)
                    await msg.reply(webhooks,file=file)
                else:
                    await msg.reply(f"Error while dumping")
                    print("Dump error:\n"+result.stderr)
        # protect
        # if (msg.channel.id==1286432914518573098 or msg.channel.id==1284867617303035989 or msg.author.id==ownerid) and msg.content.startswith(".protect"):
        #     await obfhandler(msg,True)
        ## everyone commands
        # if msg.content.startswith(".deobf2"):
        #     result, filename = await luafilehandler(msg,"badotherstringencrypt.lua","./dumps/original/")
        #     if not result and not filename:
        #         return
        #     elif result and "success" in result.stdout:
        #         try:
        #             await luabeautify('./dumps/dumped/' + filename)
        #         except Exception as er:
        #             print(er)
        #         file = discord.File('./dumps/dumped/' + filename)
        #         await msg.reply(file=file)
        #     else:
        #         await msg.reply(f"`Only works on this weird string encryption idk vro`")
        #         print("Deobf error:\n"+result.stderr)
        #     return
        if smsg[0] == ".onlyfans":
            if not msg.author.id in [ownerid,713113056346898522]:
                await softerror(msg,"gooner xd")
                return
            await msg.reply(f"Fetching onlyfans of `{smsg[1]}`, this might take a while.")
            _thread = threading.Thread(target=asyncio.run, args=(onlyfans(smsg[1], len(smsg)>2 and int(smsg[2]),Token,msg.guild.id,msg.channel.id,msg.id),))
            _thread.start()
        if smsg[0] == ".fansly":
            if not msg.author.id in [ownerid,713113056346898522]:
                await softerror(msg,"gooner xd")
                return
            await msg.reply(f"Fetching fansly of `{smsg[1]}`, this might take a while.")
            _thread = threading.Thread(target=asyncio.run, args=(fansly(smsg[1], len(smsg)>2 and int(smsg[2]),Token,msg.guild.id,msg.channel.id,msg.id),))
            _thread.start()
        if msg.content.startswith(".ib2") or msg.content.startswith(".ibs"):
                result, filename = await luafilehandler(msg,"","./unobfuscated/",ib2=True)
                if not result and not filename:
                    return
                elif result and "Done!" in result.stdout:
                    file_move("out.lua", f"./obfuscated/{filename}")
                    file = discord.File('./obfuscated/' + filename)
                    await msg.reply(file=file)
                elif result:
                    await msg.reply(f"Error while obfuscating")
                    print("Obf error:\n"+result.stderr)
                else:
                    print(result,filename)
        if msg.content.startswith(".ironobf"):
            result, filename = await luafilehandler(msg,"IronBrikked.lua","./unobfuscated/")
            if not result and not filename:
                    return
            elif result and "success" in result.stdout:
                file = discord.File('./obfuscated/' + filename)
                await msg.reply(file=file)
            else:
                await msg.reply(f"Error while obfuscating :(")
        if msg.content.startswith(".obf"):
            await obfhandler(msg,False)
        if msg.content.startswith(".vmify"):
            await obfhandler(msg,False)
        if msg.content.startswith(".silentkey"):
            await msg.reply(bypass.getsilentkey())
        # if smsg[0] ==".timer":
        #     if len(smsg) > 1:
        #         await msg.add_reaction("✅")
        #         await sleep(timeconverter("".join(smsg[1:])))
        #         await msg.reply("Your timer is over!")
        #     else:
        #         await softerror(msg,"Please define the time you want to set the timer for.")
        if smsg[0] == ".color":
            try:
                hex_code1 = smsg[1].lstrip("#")  # Remove # if present
                if not (len(hex_code1) == 6 or len(hex_code1) == 8):
                    raise ValueError
                
                hex_code2 = smsg[2].lstrip("#") if len(smsg) > 2 else None  # Optional second color
                
                # Convert hex to RGB(A)
                color1 = ImageColor.getcolor(f"#{hex_code1}", "RGBA" if len(hex_code1) == 8 else "RGB")
                color2 = None
                
                if hex_code2:
                    if not (len(hex_code2) == 6 or len(hex_code2) == 8):
                        raise ValueError
                    color2 = ImageColor.getcolor(f"#{hex_code2}", "RGBA" if len(hex_code2) == 8 else "RGB")
                else:
                    color2 = color1  # If no second color, use solid fill
                
                # Ensure both colors are in the same format
                if len(color1) == 3:  # RGB -> Convert to RGBA by adding alpha = 255
                    color1 = (*color1, 255)
                if len(color2) == 3:
                    color2 = (*color2, 255)
                
                mode = "RGBA"

                # Create an 80x80 image
                image = Image.new(mode, (80, 80))
                draw = ImageDraw.Draw(image)
                
                # Apply gradient if second color is provided
                for y in range(80):
                    blend_factor = y / 79  # Normalize blend between 0 and 1
                    blended_color = tuple(
                        int(color1[i] * (1 - blend_factor) + color2[i] * blend_factor) for i in range(4)
                    )
                    draw.line([(0, y), (80, y)], fill=blended_color)
                
                # Save the image to a bytes buffer
                buffer = io.BytesIO()
                image.save(buffer, format="PNG")
                buffer.seek(0)
                await msg.reply(file=discord.File(buffer, filename="color.png"))
            except ValueError:
                await msg.reply("Invalid usage. Please use the format `.color #RRGGBB`.")
        if msg.content.startswith(".dlv"):
            await msg.channel.typing()
            try:
                await msg.reply(bypass.dynamicLV(smsg[1]))
            except Exception as er:
                print(er)
                await msg.reply("⚠ Make sure to send a proper *linkvertise* link.")
        if msg.content.startswith(".byp"):
            # await softerror(msg,"\\.byp is disabled for now, use https://bypass.vip")
            errormsg="⚠ Make sure to send a proper link. If you are sure this should be supported then try using `/bypass`\nSupports: Linkvertise, paster.so, Admaven, Lootlinks/Lootlabs, work.ink, boost.ink, mboost.me (bst.gg, booo.st), socialwolvez.com, sub2get.com, social-unlock.com, unlocknow.net, sub2unlock.com, sub2unlock.net, sub2unlock.io, sub4unlock.io, rekonise.com, adfoc.us, v.gd, wc.wtf, bit.ly, tinyurl.com, is.gd, rebrand.ly, tinylink.onl, t.co, bit.do, tiny.cc"#"⚠ Make sure to send a proper link.\nSupports: Linkvertise, Work.ink (for now, sorry)"
            if msg.channel.id!=1348000639753519205:
                await softerror(msg,"Please use the <#1348000639753519205> channel",4)
                return
            if len(smsg)<2 or not "https://" in smsg[1]:
                await softerror(msg,errormsg,12)
                return
            try:
                botmsg = await msg.reply("`Bypassing...`")
                await msg.channel.typing()
                await msg.reply(
                    await bypass.generic(smsg[1])
                    or errormsg)
                await botmsg.delete()
            except Exception as er:
                print(er)
                await msg.reply("`error while bypassing`")
        if msg.channel.id==1351444142852411454:
            if not msg.author.id in message_counts or random.randint(1,100)==1:
                message_counts[msg.author.id]=await getmsgcounts(msg.author.id)+(old_message_counts[msg.author.id] or 0)
                open("message_counts.json","w").write(dumps(message_counts))
            else:
                message_counts[msg.author.id]+=1
                
        
    # async def on_member_join(self,member):
    #     global raidlock
    #     if raidlock:
    #         try:
    #             await member.timeout(timedelta(minutes=120))
    #             print(f"{member} has been timed out.")
    #         except discord.Forbidden:
    #             print("Bot does not have permission to timeout members.")
    #         except discord.HTTPException:
    #             print("Failed to timeout the member due to an HTTP exception.")
    # async def on_message_edit(self, before, after):
    #     if after.edited_at and after.created_at and not after.author.bot and (after.edited_at - after.created_at).total_seconds() <= .8:
    #         await softerror(after,"please refrain from using selfbots")
    async def on_presence_update(self,before, after):
        global sent_conflict_msg
        before_status = None
        after_status = None

        for activity in after.activities:
            if isinstance(activity, CustomActivity):
                after_status = activity
        if after_status and ".gg/25ms" in after_status.name[:12]:
            for _ in range(3):
                if not any(role.id == 1385300853526892584 for role in get_roles(after.id)):
                    guild = client.get_guild(1306714913539887237)
                    member = guild.get_member(after.id)
                    if not member:
                        return
                    
                    # Check if account is under 1 year old or joined server less than 1 week ago
                    now = discord.utils.utcnow()
                    is_new_account = after.created_at > (now - timedelta(days=365))
                    is_new_member = member and member.joined_at > (now - timedelta(days=7))
                    has_no_verify_role = not any(role.id == 1373824067437858816 for role in get_roles(after.id))
                    
                    # If new account/member and no verification role, add verification role and send message
                    if (is_new_account or is_new_member) and has_no_verify_role:
                        if sent_conflict_msg.get(after.id):
                            return
                        dm_channel = await after.create_dm()
                        alert_msg=f"You put .gg/25ms in your status but {is_new_account and 'your account is too new' or is_new_member and 'you joined the server too recently'}. Verify here https://discord.com/channels/1306714913539887237/1306721933076725771/1306727174744576125 and then change your status once to receive access to cmds!"
                        try:
                            await dm_channel.send(alert_msg)
                            sent_conflict_msg[after.id] = True
                        except:
                            verify_channel = guild.get_channel(1306721933076725771)
                            msg=await verify_channel.send(f"<@{after.id}> {alert_msg}")
                            sent_conflict_msg[after.id] = True
                            await asyncio.sleep(120)
                            await msg.delete()
                        return
                    role=guild.get_role(1385300853526892584)
                    try:
                        await after.add_roles(role)
                        break
                    except:
                        await asyncio.sleep(.3)
                else:break
        else:
            for activity in before.activities:
                if isinstance(activity, CustomActivity):
                    before_status = activity
            for _ in range(3):
                if any(role.id == 1385300853526892584 for role in get_roles(after.id)) and (not before_status or ".gg/25ms" in before_status.name[:12]):
                    role=client.get_guild(1306714913539887237).get_role(1385300853526892584)
                    try:
                        await after.remove_roles(role)
                        break
                    except:
                        await asyncio.sleep(.3)
                else:break


if __name__ == "__main__":
    client = MyClient(intents=intents)

    enter_token_here = None

    if not enter_token_here:
        print("PLEASE ENTER A TOKEN!! CHANGE THE = None line to = 'TOKEN'")

    client.run(enter_token_here)
