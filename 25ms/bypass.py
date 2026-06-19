import re
from base64 import b64decode, b64encode
from urllib.parse import quote_plus,unquote
from json import loads
from requests import request
from collections import defaultdict
import aiohttp
import asyncio
import random
myip=request("GET","https://api.ipify.org").text
def dynamicLV(url):
    url_pattern = r'https:\/\/linkvertise\.com\/.*r=([^&]*)'
    match = re.search(url_pattern, url)
    if match:
        base64_string = match.group(1)
        decoded_base64 = unquote(base64_string)
        print(b64decode(decoded_base64).decode('utf-8'))
        return b64decode(decoded_base64).decode('utf-8')

async def asyncget(url,params,headers=None):
    async with aiohttp.ClientSession() as session:
        async with session.get(url,params=params,headers=headers) as response:
            return await response.json()
        
async def asyncpost(url, json_body,params=None, headers=None,returnResponseJson=True):
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=json_body, headers=headers,params=params) as response:
            if returnResponseJson: return await response.json()
            else: return await response.text()
async def cloudflare_gen(prompt):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("https://imgai.benomat.workers.dev", params={"prompt": prompt}) as response:
                if response.status == 200:
                    return await response.read()
                else:
                    print(response)
                    return None
    except Exception as er:
        print(er)
        return False




async def bypvip(url):
    try:
        async with asyncio.timeout(90):
            response = await asyncget("https://api.bypass.vip/premium/bypass",params={"url":url},headers={"x-api-key":"e403837d-c640-4017-bb36-581759c79ecf"})
            if response["status"]=="success":
                return response["result"]
            elif response["message"] and response["message"]!="Invalid URL given" and response["message"]!="Unsupported URL given" and response["message"]!="Please use our userscript to bypass this link (https://github.com/bypass-vip/userscript/raw/refs/heads/main/bypass-vip.user.js)":
                return "⚠ "+response["message"]
            else: return False
    except asyncio.TimeoutError as er:
        print(er)
        return "Reached timeout of 90 seconds."
    except Exception as er:
        print(er)
        return "api fail"
async def byplat(url):
    try:
        async with asyncio.timeout(120):
            response = await asyncget("https://iwoozie.baby/api/free/bypass",params={"url":unquote(url)})
            # if response["success"]:
            #     return response["result"]
            if response["result"] and response["result"]!="Invalid URL given" and response["result"]!="Unsupported URL given" and response["result"]!="Not Supported by FREE API!" and response["result"]!="bypass fail! report this link to iwoozy_real on discord":
                if myip in response["result"]: return "kys lmao"
                return response["result"] # "⚠ "+
            else: return False
    except asyncio.TimeoutError:
        return "Reached timeout of 2 minutes, if this is a lootlink trying again might help!"
    except:
        return False
bypassers={
    # "Bypass VIP":bypvip,
    "Bypass LAT":byplat,
    # "thebypasser":thebyp
}
async def generic(url):
    tasks = {name: func(url) for name, func in bypassers.items()}
    results = await asyncio.gather(
        *(task for task in tasks.values()), return_exceptions=True
    )
    
    # Prepare results in a consistent format
    processed_results = {
        name: (res if not isinstance(res, Exception) else None)
        for name,res in zip(tasks.keys(), results)
    }
    
    # Separate successful results
    successful_results = {name: res for name, res in processed_results.items() if res}
    
    if len(successful_results) > 1:
        values = list(successful_results.values())
        if all(value == values[0] for value in values):
            return values[0]  # All results match
        else:
            # Return differing results
            return "\n\n".join(f"{name}: {res}" for name, res in successful_results.items())
    elif successful_results:
        # If only one function succeeded, return its result
        name, result = next(iter(successful_results.items()))
        return result

def getsilentkey():

    querystring = {"token":"SilentOnTopForRealMyBroda","hash":"KodpjjbhT7XP37GicVr6EUSKLuwbi5feISSFNfcrhzTDrSExiYU88JlJ2KOvqRAq"}

    headers = {
        "Referer": "https://linkvertise.com/",
        "User-Agent": "Mozilla/5.0"
    }

    response = request("GET", "https://silenthub.cc/getkey", data="", headers=headers, params=querystring).text
    meowsicles=False
    try:
        meowsicles = response.split(response.split("box-shadow: 0")[0].split("{")[-2].split(".")[-1].split(" ")[0]+'">')[1].split("<")[0] 
    except: pass

    key = meowsicles or (response.find("SILENT-") and "SILENT-"+response.split("SILENT-")[1].split("<")[0]) or response.split('textbox">')[1].split("<")[0]

    return key
def silentcomplicated():
    querystring = {"token":"SilentOnTopForRealMyBroda","hash":"KodpjjbhT7XP37GicVr6EUSKLuwbi5feISSFNfcrhzTDrSExiYU88JlJ2KOvqRAq"}

    headers = {
        "Referer": "https://linkvertise.com/",
        "User-Agent": "Mozilla/5.0"
    }

    response = request("GET", "https://silenthub.cc/getkey", data="", headers=headers, params=querystring).text
    methods=defaultdict(int)
    try:
        methods[0] = response.split('"'+response.split("document.querySelector('.")[1].split("')")[0]+'">')[1].split("<")[0] 
    except Exception as er:
        print(er) 
        methods[0] = "couldnt find"
    try:
        methods[1] = len(response.split(".textbox")[1].split("}")[0].split("\n")) > len(response.split(".visible-textbox")[1].split("}")[0].split("\n")) and response.split('"textbox">')[1].split("<")[0] or response.split('"visible-textbox">')[1].split("<")[0]
    except:
        methods[1] = "couldnt find"
    try:
        methods[2] = (response.find("SILENT-") and "SILENT-"+response.split("SILENT-")[1].split("<")[0]) or "couldnt find"
    except:
        methods[2] = "error"
    try:
        methods[3] = (response.find("SILENT-") and "SILENT-"+response.split("SILENT-")[2].split("<")[0]) or "couldnt find"
    except: methods[3] = "error"
    try:
        methods[4] = response.split('"textbox">')[1].split("<")[0]
    except: methods[4] = "error"
    try:
        methods[5] = response.split(response.split("box-shadow: 0")[0].split("{")[-2].split(".")[-1].split(" ")[0]+'">')[1].split("<")[0] 
    except Exception as er:
        print(er)
        methods[5] = "couldnt find"
    return methods
def getsolarainfo():
    info = loads(request("GET","https://getsolara.dev/api/endpoint.json").text)
    return info
def getrobloxversioninfo():
    info = loads(request("GET","https://clientsettings.roblox.com/v2/client-version/WindowsPlayer/channel/live").text)
    return info

# proxies=request("GET","https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&protocol=http&proxy_format=protocolipport&format=json&timeout=600").json()["proxies"]

# async def proxy_request(url: str, method: str = "GET", **kwargs):
#     timeout = aiohttp.ClientTimeout(total=kwargs.pop("timeout", 30))
#     tried = set()

#     async with aiohttp.ClientSession(timeout=timeout) as session:
#         for _ in range(min(100, len(proxies))):
#             proxy_data=random.choice(proxies)
#             proxy = proxy_data["proxy"]
#             if proxy in tried:
#                 continue
#             tried.add(proxy)
#             try:
#                 print(f"trying {proxy}, is_alive: {proxy_data["alive"]}")
#                 async with session.request(
#                     method=method,
#                     url=url,
#                     proxy=proxy,
#                     **kwargs
#                 ) as response:
#                     response.raise_for_status()
#                     return await response.text()
#             except Exception as er:
#                 print(er)
#                 continue

#     raise RuntimeError("All proxy attempts failed")