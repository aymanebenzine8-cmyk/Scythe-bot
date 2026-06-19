
local fs = require("@lune/fs")
local process = require("@lune/process")
local luau = require("@lune/luau")
local targetfilename=process.args[1]
local input = fs.readFile("dumps\\original\\"..targetfilename)
local isluraph=input:find("(does your environment support load/loadstring?)",1,true)
local functionmetatable=setmetatable({},{__index=function()return function()end end})
local print=print
local r
local fakeenv,_tbl=require("fakegame.lua")
local chunk, err = luau.load(input)
if err then
    warn("BAD OMGG"..err)
    return
end
local cenv = {}
for i,v in fakeenv do
    cenv[i]=v
end
cenv.print=function()end
cenv.warn=function()end
cenv.wait=function()return 1 end
cenv.setclipbard=function()end
cenv.toclipboard=function()end
local fake_file_system={}
cenv.writefile=function(path,cont)
    fake_file_system[path]=cont
end
cenv.readfile=function(path)
    return fake_file_system[path]
end
cenv.isfile=function(path)
    return fake_file_system[path]~=nil
end
cenv.isfolder=function(path)
    return fake_file_system[path]~=nil
end
cenv.mkdir=function(path)
    fake_file_system[path]={}
end
cenv.require=error
cenv.getfenv=function(lvl)
    local res=getfenv(type(lvl)=="number" and lvl+2 or lvl)
    if res.require~=cenv.require then
        return cenv
    end
    return res
end
cenv.loadstring=function(src,b)
    if type(src)~="string"then
        return nil,"bad argument #1 to 'loadstring' (string expected, got "..type(src)..")"
    end
    print("a",src)
    r=src:find("-- http",1,true) and r or src
    if isluraph and #src>100 then
        error()
    end
    local _func,er=luau.load(src,b)
    if not _func then return _func, er end
    setfenv(_func,cenv)
    return _func
end
cenv.load=cenv.loadstring
print(cenv.game)
cenv.require=function()return {xd=true}end
cenv.getgenv=function()
    return cenv
end
local env=getfenv(chunk)
local order={
    cenv,
    env
}
setfenv(chunk,setmetatable({},{__index=function(_,k)
    for _,v in order do
        if v[k]~=nil then
            return v[k]
        end
    end
end,__metatable=false}))
-- chunk()
print(pcall(chunk))
fs.writeFile("dumps\\dumped\\"..targetfilename,r)
print("success")